// ═══════════════════════════════════════════════════════════════════
//  discord.js — Lanyard WebSocket  (real-time, auto-reconnect)
//  Falls back to REST on WS failure. No polling needed.
// ═══════════════════════════════════════════════════════════════════

(function () {
    'use strict';

    // ── Config ────────────────────────────────────────────────────
    var DISCORD_ID       = '748831508776878110';
    var WS_URL           = 'wss://api.lanyard.rest/socket';
    var REST_URL         = 'https://api.lanyard.rest/v1/users/' + DISCORD_ID;
    var HEARTBEAT_MS     = 30000;        // fallback if server omits interval
    var RECONNECT_BASE   = 2000;
    var RECONNECT_MAX    = 30000;

    // ── DOM refs ──────────────────────────────────────────────────
    var pfpEl      = document.getElementById('discord-pfp');
    var decoEl     = document.getElementById('discord-decoration');
    var skeletonEl = document.getElementById('hero-pfp-skeleton');
    var dotEl      = document.getElementById('discord-dot');
    var statusEl   = document.getElementById('discord-status');
    var activityEl = document.getElementById('discord-activity');

    // ── Status maps ───────────────────────────────────────────────
    var STATUS_COLOR = {
        online:    '#23a55a',
        idle:      '#f0b232',
        dnd:       '#f23f43',
        offline:   '#80848e',
        streaming: '#593695'
    };

    // ── Internal state ────────────────────────────────────────────
    var ws              = null;
    var heartbeatTimer  = null;
    var reconnectTimer  = null;
    var reconnectDelay  = RECONNECT_BASE;
    var avatarCached    = null;   // avoid re-setting same src (prevents flicker)
    var initialised     = false;  // true after first successful render
    var elapsedTimer    = null;   // interval for Spotify elapsed counter
    var fallbackTimer   = setTimeout(doRestFallback, 5000);

    // ─────────────────────────────────────────────────────────────
    //  Utility
    // ─────────────────────────────────────────────────────────────

    function escHtml(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function timeAgo(ms) {
        if (!ms) return '';
        var diff = Date.now() - ms;
        var s = Math.floor(diff / 1000);
        var m = Math.floor(s / 60);
        var h = Math.floor(m / 60);
        var d = Math.floor(h / 24);
        if (s < 60)  return 'just now';
        if (m < 60)  return m + 'm ago';
        if (h < 24)  return h + 'h ' + (m % 60) + 'm ago';
        return d + 'd ago';
    }

    function fmtElapsed(startMs) {
        if (!startMs) return '';
        var s = Math.max(0, Math.floor((Date.now() - startMs) / 1000));
        var m = Math.floor(s / 60);
        var h = Math.floor(m / 60);
        if (h > 0) return h + ':' + pad(m % 60) + ':' + pad(s % 60) + ' elapsed';
        return m + ':' + pad(s % 60) + ' elapsed';
    }

    // ─────────────────────────────────────────────────────────────
    //  Avatar / decoration / banner helpers
    // ─────────────────────────────────────────────────────────────

    function resolveAvatarUrl(user) {
        if (!user || !user.avatar) {
            return 'https://cdn.discordapp.com/embed/avatars/'
                + (parseInt(DISCORD_ID.slice(-4)) % 6) + '.png';
        }
        var ext = user.avatar.startsWith('a_') ? 'gif' : 'webp';
        return 'https://cdn.discordapp.com/avatars/'
            + DISCORD_ID + '/' + user.avatar + '.' + ext + '?size=128';
    }

    function resolveBannerUrl(user) {
        if (!user || !user.banner) return null;
        var ext = user.banner.startsWith('a_') ? 'gif' : 'webp';
        return 'https://cdn.discordapp.com/banners/'
            + DISCORD_ID + '/' + user.banner + '.' + ext + '?size=480';
    }

    function applyAvatar(user) {
        var url = resolveAvatarUrl(user);
        if (avatarCached === url) return; // same image — don't flicker
        avatarCached = url;
        if (skeletonEl) skeletonEl.style.display = 'none';
        if (!pfpEl) return;
        pfpEl.onerror = function () {
            pfpEl.style.display = 'none';
            if (skeletonEl) skeletonEl.style.display = 'block';
        };
        pfpEl.style.display = 'block';
        pfpEl.src = url;
    }

    function applyDecoration(user) {
        if (!decoEl) return;
        var deco = user && user.avatar_decoration_data;
        if (!deco || !deco.asset) {
            decoEl.style.display = 'none';
            return;
        }
        var url = 'https://cdn.discordapp.com/avatar-decoration-presets/'
            + deco.asset + '.png?size=96&passthrough=true';
        if (decoEl.getAttribute('src') === url) return;
        decoEl.onload  = function () { decoEl.style.display = 'block'; };
        decoEl.onerror = function () { decoEl.style.display = 'none';  };
        decoEl.src = url;
    }

    function applyBanner(user) {
        var bannerEl  = document.getElementById('discord-banner');
        var bannerImg = document.getElementById('discord-banner-img');
        if (!bannerEl) return;

        var bUrl   = resolveBannerUrl(user);
        var bColor = (user && user.banner_color) || null;

        if (bUrl && bannerImg) {
            bannerImg.style.display = 'block';
            bannerImg.onerror = function () {
                bannerImg.style.display = 'none';
                if (bColor) bannerEl.style.background = bColor;
            };
            if (bannerImg.src !== bUrl) bannerImg.src = bUrl;
        } else {
            if (bannerImg) bannerImg.style.display = 'none';
            if (bColor) bannerEl.style.background = bColor;
            // else CSS gradient fallback stays intact
        }
    }

    // ─────────────────────────────────────────────────────────────
    //  Status dot
    // ─────────────────────────────────────────────────────────────

    function applyDot(status) {
        if (!dotEl) return;
        dotEl.className = 'discord-status-dot ds-' + (STATUS_COLOR[status] ? status : 'offline');
    }

    // ─────────────────────────────────────────────────────────────
    //  Status pill — Discord-accurate SVG icons, no @ handle
    // ─────────────────────────────────────────────────────────────

    // Exact SVG shapes Discord uses per status
    var STATUS_SVG = {
        online:
            '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">'
          + '<circle cx="5" cy="5" r="5" fill="#23a55a"/>'
          + '</svg>',
        idle:
            '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">'
          + '<path fill="#f0b232" d="M10 5a5 5 0 1 1-5-5 3.5 3.5 0 0 0 0 7A3.5 3.5 0 0 0 10 5Z"/>'
          + '</svg>',
        dnd:
            '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">'
          + '<circle cx="5" cy="5" r="5" fill="#f23f43"/>'
          + '<rect x="2.5" y="4.25" width="5" height="1.5" rx="0.75" fill="#fff"/>'
          + '</svg>',
        offline:
            '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">'
          + '<circle cx="5" cy="5" r="3.5" stroke="#80848e" stroke-width="2" fill="none"/>'
          + '</svg>',
        streaming:
            '<svg width="10" height="10" viewBox="0 0 10 10" fill="none">'
          + '<circle cx="5" cy="5" r="5" fill="#593695"/>'
          + '<polygon points="4,3 8,5 4,7" fill="#fff"/>'
          + '</svg>'
    };

    var STATUS_LABEL = {
        online:    'Online',
        idle:      'Idle',
        dnd:       '',
        offline:   'Offline',
        streaming: 'Streaming'
    };

    var STATUS_GLOW = {
        online:    'rgba(35,165,90,',
        idle:      'rgba(240,178,50,',
        dnd:       'rgba(242,63,67,',
        offline:   'rgba(128,132,142,',
        streaming: 'rgba(89,54,149,'
    };

    function applyStatus(status, lastSeenMs) {
        if (!statusEl) return;
        var s    = STATUS_SVG[status]  || STATUS_SVG.offline;
        var glow = STATUS_GLOW[status] || STATUS_GLOW.offline;

        // Build the label string
        var label = '';
        if (status === 'offline') {
            label = lastSeenMs ? 'Offline · ' + timeAgo(lastSeenMs) : 'Offline';
        } else if (status === 'dnd') {
            label = ''; // no text — activity line handles it
        } else {
            label = STATUS_LABEL[status] || '';
        }

        // Tighten pill when no text
        var padding = label ? '3px 10px 3px 7px' : '3px 7px';
        var labelHtml = label
            ? '<span style="font-size:0.66rem;font-weight:500;letter-spacing:0.3px;color:rgba(255,255,255,0.70);">' + label + '</span>'
            : '';

        statusEl.innerHTML =
            '<span style="'
          +   'display:inline-flex;align-items:center;gap:6px;'
          +   'background:' + glow + '0.10);'
          +   'border:1px solid ' + glow + '0.22);'
          +   'border-radius:99px;padding:' + padding + ';'
          + '">'
          +   '<span style="display:flex;align-items:center;flex-shrink:0;'
          +     'filter:drop-shadow(0 0 3px ' + glow + '0.7));">'
          +     s
          +   '</span>'
          +   labelHtml
          + '</span>';
    }

    // ─────────────────────────────────────────────────────────────
    //  Activity line
    //  Priority: Spotify (type 2) > Custom status (type 4)
    //            > Streaming (type 1) > Game / app (type 0)
    // ─────────────────────────────────────────────────────────────

    function applyActivity(activities, spotifyTopLevel) {
        if (elapsedTimer) { clearInterval(elapsedTimer); elapsedTimer = null; }
        if (!activityEl) return;

        var acts = activities || [];
        var spotify = null, custom = null, game = null, stream = null;

        for (var i = 0; i < acts.length; i++) {
            var a = acts[i];
            if (a.type === 2 && !spotify) spotify = a;
            if (a.type === 4 && !custom)  custom  = a;
            if (a.type === 1 && !stream)  stream  = a;
            if (a.type === 0 && !game)    game    = a;
        }

        // Lanyard exposes a parsed `spotify` field — use it when present
        // to get cleaner data (avoids Spotify activity type=2 quirks)
        if (spotifyTopLevel && spotifyTopLevel.song) {
            var startMs = spotifyTopLevel.timestamps && spotifyTopLevel.timestamps.start;
            function refreshSpotify() {
                var elapsed = startMs ? ' &middot; ' + fmtElapsed(startMs) : '';
                activityEl.innerHTML =
                    '<span style="color:rgba(255,255,255,0.55);">🎵</span>'
                  + '<span style="margin-left:4px;color:rgba(255,255,255,0.42);">'
                  +   escHtml(spotifyTopLevel.song) + '</span>'
                  + '<span style="color:rgba(255,255,255,0.24);"> — '
                  +   escHtml(spotifyTopLevel.artist) + '</span>'
                  + (elapsed
                      ? '<span style="color:rgba(255,255,255,0.18);font-size:0.60rem;">' + elapsed + '</span>'
                      : '');
            }
            refreshSpotify();
            if (startMs) elapsedTimer = setInterval(refreshSpotify, 5000);
            return;
        }

        if (spotify) {
            var spStart = spotify.timestamps && spotify.timestamps.start;
            function refreshSpotifyAct() {
                var elapsed = spStart ? ' &middot; ' + fmtElapsed(spStart) : '';
                activityEl.innerHTML =
                    '<span style="color:rgba(255,255,255,0.55);">🎵</span>'
                  + '<span style="margin-left:4px;color:rgba(255,255,255,0.42);">'
                  +   escHtml(spotify.details || '') + '</span>'
                  + '<span style="color:rgba(255,255,255,0.24);"> — '
                  +   escHtml(spotify.state   || '') + '</span>'
                  + (elapsed
                      ? '<span style="color:rgba(255,255,255,0.18);font-size:0.60rem;">' + elapsed + '</span>'
                      : '');
            }
            refreshSpotifyAct();
            if (spStart) elapsedTimer = setInterval(refreshSpotifyAct, 5000);
            return;
        }

        if (custom) {
            var emoji = '';
            if (custom.emoji) {
                if (custom.emoji.id) {
                    emoji = '<img src="https://cdn.discordapp.com/emojis/'
                        + custom.emoji.id + '.webp?size=20"'
                        + ' style="width:14px;height:14px;vertical-align:middle;'
                        + 'margin-right:3px;border-radius:2px;" alt="">';
                } else if (custom.emoji.name) {
                    emoji = escHtml(custom.emoji.name) + ' ';
                }
            }
            activityEl.innerHTML =
                '<span style="color:rgba(255,255,255,0.38);">'
              + emoji + escHtml(custom.state || '') + '</span>';
            return;
        }

        if (stream) {
            activityEl.innerHTML =
                '<span style="color:#593695;">🔴</span>'
              + '<span style="margin-left:4px;color:rgba(255,255,255,0.38);">'
              + escHtml(stream.name || 'Streaming') + '</span>';
            return;
        }

        if (game) {
            var detail = game.details
                ? escHtml(game.name) + '<span style="color:rgba(255,255,255,0.24);"> — ' + escHtml(game.details) + '</span>'
                : escHtml(game.name);
            activityEl.innerHTML =
                '<span style="color:rgba(255,255,255,0.55);">🎮</span>'
              + '<span style="margin-left:4px;color:rgba(255,255,255,0.38);">' + detail + '</span>';
            return;
        }

        activityEl.innerHTML = ''; // nothing active
    }

    // ─────────────────────────────────────────────────────────────
    //  Master render — called on every presence update
    // ─────────────────────────────────────────────────────────────

    function render(data) {
        if (!data) return;

        var user       = data.discord_user || {};
        var status     = data.discord_status || 'offline';
        var activities = data.activities     || [];
        var spotify    = data.spotify        || null;  // Lanyard top-level spotify object

        // "last seen" from activity start timestamps when offline
        var lastSeenMs = null;
        if (status === 'offline') {
            for (var i = 0; i < activities.length; i++) {
                var ts = activities[i].timestamps;
                if (ts && ts.start && ts.start > (lastSeenMs || 0)) {
                    lastSeenMs = ts.start;
                }
            }
        }

        applyAvatar(user);
        applyDecoration(user);
        applyBanner(user);
        applyDot(status);
        applyStatus(status, lastSeenMs);
        applyActivity(activities, spotify);

        initialised = true;
    }

    // ─────────────────────────────────────────────────────────────
    //  REST fallback (fires if WS hasn't delivered within 5 s)
    // ─────────────────────────────────────────────────────────────

    function doRestFallback() {
        if (initialised) return;
        fetch(REST_URL)
            .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
            .then(function (json) {
                if (!initialised && json && json.data) render(json.data);
            })
            .catch(function (err) {
                console.warn('[discord.js] REST fallback failed:', err);
                if (!initialised) renderOffline();
            });
    }

    function renderOffline() {
        if (skeletonEl) skeletonEl.style.display = 'none';
        if (pfpEl) {
            pfpEl.src = 'https://cdn.discordapp.com/embed/avatars/'
                + (parseInt(DISCORD_ID.slice(-4)) % 6) + '.png';
            pfpEl.style.display = 'block';
        }
        applyDot('offline');
        applyStatus('offline', null);
        applyActivity([], null);
        initialised = true;
    }

    // ─────────────────────────────────────────────────────────────
    //  WebSocket lifecycle
    // ─────────────────────────────────────────────────────────────

    function connect() {
        if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

        try { ws = new WebSocket(WS_URL); }
        catch (e) { scheduleReconnect(); return; }

        ws.onopen = function () {
            reconnectDelay = RECONNECT_BASE; // reset backoff
        };

        ws.onmessage = function (evt) {
            var msg;
            try { msg = JSON.parse(evt.data); } catch (e) { return; }

            switch (msg.op) {

                case 1: // Hello — server tells us the heartbeat interval
                    var interval = (msg.d && msg.d.heartbeat_interval) || HEARTBEAT_MS;
                    startHeartbeat(interval);
                    // Subscribe to this specific user
                    ws.send(JSON.stringify({
                        op: 2,
                        d:  { subscribe_to_id: DISCORD_ID }
                    }));
                    break;

                case 0: // Dispatch event
                    if (msg.t === 'INIT_STATE') {
                        // d = { [userId]: presenceObject }
                        clearTimeout(fallbackTimer);
                        var presence = msg.d && msg.d[DISCORD_ID];
                        if (presence) render(presence);
                    } else if (msg.t === 'PRESENCE_UPDATE') {
                        // d = presenceObject directly
                        clearTimeout(fallbackTimer);
                        if (msg.d) render(msg.d);
                    }
                    break;

                case 3: // Heartbeat ACK
                    break;
            }
        };

        ws.onerror = function () { /* onclose fires after, handled there */ };

        ws.onclose = function () {
            stopHeartbeat();
            if (!initialised) doRestFallback(); // try REST while we reconnect
            scheduleReconnect();
        };
    }

    function startHeartbeat(interval) {
        stopHeartbeat();
        heartbeatTimer = setInterval(function () {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ op: 3 }));
            }
        }, interval);
    }

    function stopHeartbeat() {
        if (heartbeatTimer) { clearInterval(heartbeatTimer); heartbeatTimer = null; }
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(function () {
            reconnectTimer = null;
            connect();
        }, reconnectDelay);
        reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX); // exponential backoff
    }

    // ── Boot ──────────────────────────────────────────────────────
    connect();

})();

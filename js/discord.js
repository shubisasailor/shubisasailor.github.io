// ═══════════════════════════════════════════════════════════════════
//  discord.js — status, avatar, banner, decoration via Lanyard
// ═══════════════════════════════════════════════════════════════════

(function () {
    var DISCORD_ID = '748831508776878110';
    var USERNAME   = 'shub.is.a.sailor';
    var DISPLAY    = 'Shub';

    var skeletonEl  = document.getElementById('discord-skeleton');
    var cardEl      = document.getElementById('discord-card');
    var pfpEl       = document.getElementById('discord-pfp');
    var decoEl      = document.getElementById('discord-decoration');
    var nameEl      = document.getElementById('discord-name');
    var statusEl    = document.getElementById('discord-status');
    var heroBgEl    = document.getElementById('hero-banner');
    var heroImgEl   = document.getElementById('hero-banner-img');

    if (!skeletonEl || !cardEl) return;

    var STATUS_COLORS = {
        online:    '#23a55a',
        idle:      '#f0b232',
        dnd:       '#f23f43',
        offline:   '#80848e',
        streaming: '#593695'
    };
    var STATUS_LABELS = {
        online:    'Online',
        idle:      'Idle',
        dnd:       'Do Not Disturb',
        offline:   'Offline',
        streaming: 'Streaming'
    };

    function timeAgo(ms) {
        if (!ms) return null;
        var diff = Date.now() - ms;
        var s = Math.floor(diff / 1000), m = Math.floor(s / 60),
            h = Math.floor(m / 60),     d = Math.floor(h / 24);
        if (s < 60)  return 'just now';
        if (m < 60)  return m + 'm ago';
        if (h < 24)  return h + 'h ago';
        return d + 'd ago';
    }

    function dot(color) {
        return '<span style="display:inline-block;width:9px;height:9px;border-radius:50%;'
            + 'background:' + color + ';box-shadow:0 0 6px ' + color + ';'
            + 'margin-right:5px;flex-shrink:0;vertical-align:middle;"></span>';
    }

    // ── Banner ────────────────────────────────────────────────────
    function applyBanner(user) {
        if (!heroImgEl || !heroBgEl) return;

        if (user && user.banner) {
            var ext = user.banner.startsWith('a_') ? 'gif' : 'webp';
            var url = 'https://cdn.discordapp.com/banners/'
                + DISCORD_ID + '/' + user.banner + '.' + ext + '?size=600';

            // Reset any stale error state before setting a new src
            heroImgEl.removeAttribute('src');
            heroImgEl.onerror = null;
            // Attach handlers BEFORE setting src so cached images don't
            // fire onload before the handler is registered.
            heroImgEl.onload  = function () { heroImgEl.classList.add('visible'); };
            heroImgEl.onerror = function () {
                heroImgEl.style.display = 'none';
                useAccentColor(user);
            };
            heroImgEl.src = url;

            // If the image was already cached and loaded synchronously,
            // the onload above may never fire — handle that edge case.
            if (heroImgEl.complete && heroImgEl.naturalWidth) {
                heroImgEl.classList.add('visible');
            }
        } else {
            useAccentColor(user);
        }
    }

    function useAccentColor(user) {
        if (user && user.accent_color && heroBgEl) {
            var hex = '#' + ('000000' + (user.accent_color >>> 0).toString(16)).slice(-6);
            heroBgEl.style.background =
                'linear-gradient(135deg,' + hex + 'cc 0%,#0d0d1a 100%)';
        }
    }

    // ── Decoration ────────────────────────────────────────────────
    // Lanyard exposes avatar_decoration_data.asset on discord_user
    function applyDecoration(user) {
        if (!decoEl) return;
        var deco = user && user.avatar_decoration_data;
        if (!deco || !deco.asset) return;

        var url = 'https://cdn.discordapp.com/avatar-decoration-presets/'
            + deco.asset + '.png?size=96&passthrough=true';
        decoEl.onload  = function () { decoEl.classList.add('show'); };
        decoEl.onerror = function () { decoEl.style.display = 'none'; };
        decoEl.src = url;
    }

    // ── Main render ───────────────────────────────────────────────
    function render(avatarSrc, lanyardData) {

        // Avatar — attach onerror BEFORE setting src
        pfpEl.onerror = function () {
            pfpEl.style.display = 'none';
            var init = document.createElement('div');
            init.style.cssText = 'width:42px;height:42px;border-radius:50%;'
                + 'background:linear-gradient(135deg,#5865F2,#7289da);'
                + 'display:flex;align-items:center;justify-content:center;'
                + 'font-weight:bold;font-size:1.1rem;color:white;flex-shrink:0;';
            init.textContent = DISPLAY.charAt(0).toUpperCase();
            pfpEl.parentNode.insertBefore(init, pfpEl);
        };
        pfpEl.src = avatarSrc;

        nameEl.textContent = DISPLAY;

        // Status
        var status = 'offline', lastSeenTs = null;
        if (lanyardData) {
            status = lanyardData.discord_status || 'offline';
            (lanyardData.activities || []).forEach(function (a) {
                if (a.timestamps && a.timestamps.start) lastSeenTs = a.timestamps.start;
            });
        }

        var dotEl = document.getElementById('discord-dot');
        if (dotEl) dotEl.className = 'discord-status-dot ds-' + status;

        var color = STATUS_COLORS[status] || STATUS_COLORS.offline;
        var label = STATUS_LABELS[status] || 'Offline';
        var ago   = (status === 'offline' && lastSeenTs)
            ? ' · last seen ' + timeAgo(lastSeenTs) : '';

        statusEl.innerHTML =
            '<div style="display:flex;align-items:center;margin-top:2px;">'
            + dot(color)
            + '<span style="font-size:0.72rem;color:rgba(255,255,255,0.45);letter-spacing:0.4px;">'
            + label + ago + '</span></div>'
            + '<div style="margin-top:3px;">'
            + '<a href="https://discord.com/users/' + DISCORD_ID + '" target="_blank" rel="noopener noreferrer"'
            + ' style="color:rgba(255,255,255,0.30);text-decoration:none;font-size:0.68rem;letter-spacing:0.5px;transition:color 0.2s;"'
            + ' onmouseover="this.style.color=\'rgba(255,255,255,0.75)\'"'
            + ' onmouseout="this.style.color=\'rgba(255,255,255,0.30)\'">@ ' + USERNAME + '</a></div>';

        // Activity
        var acts = (lanyardData && lanyardData.activities) || [];
        var activity = null;
        for (var j = 0; j < acts.length; j++) {
            if (acts[j].type === 2) {
                activity = '🎵 ' + acts[j].details + ' — ' + acts[j].state;
                break;
            }
            if (acts[j].type === 0 && !activity) activity = '🎮 ' + acts[j].name;
        }
        if (activity) {
            statusEl.innerHTML +=
                '<div style="margin-top:4px;font-size:0.68rem;color:rgba(255,255,255,0.35);'
                + 'white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px;">'
                + activity + '</div>';
        }

        skeletonEl.style.display = 'none';
        cardEl.classList.add('loaded');
    }

    // ── Fallback ──────────────────────────────────────────────────
    var defaultIdx    = parseInt(DISCORD_ID.slice(-4)) % 6;
    var defaultAvatar = 'https://cdn.discordapp.com/embed/avatars/' + defaultIdx + '.png';
    var done = false;

    function fallback() {
        if (done) return;
        done = true;
        render(defaultAvatar, null);
    }

    var timer = setTimeout(fallback, 4000);

    // ── Fetch ─────────────────────────────────────────────────────
    fetch('https://api.lanyard.rest/v1/users/' + DISCORD_ID)
        .then(function (r) { return r.ok ? r.json() : Promise.reject('bad response'); })
        .then(function (json) {
            clearTimeout(timer);
            if (done) return;
            done = true;

            var d    = json.data;
            var user = d && d.discord_user;

            // Avatar
            var avatarUrl = defaultAvatar;
            if (user && user.avatar) {
                var ext = user.avatar.startsWith('a_') ? 'gif' : 'webp';
                avatarUrl = 'https://cdn.discordapp.com/avatars/'
                    + DISCORD_ID + '/' + user.avatar + '.' + ext + '?size=128';
            }

            // Banner + decoration
            applyBanner(user);
            applyDecoration(user);

            render(avatarUrl, d);
        })
        .catch(function (e) {
            console.warn('[discord.js] Lanyard fetch failed:', e);
            clearTimeout(timer);
            fallback();
        });

})();
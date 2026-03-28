// ═══════════════════════════════════════════════════════════════════
//  discord.js — pfp, status dot, status text via Lanyard
//  New flat layout: no separate card, renders directly into hero
// ═══════════════════════════════════════════════════════════════════

(function () {
    var DISCORD_ID = '748831508776878110';
    var USERNAME   = 'shub.is.a.sailor';
    var DISPLAY    = 'Shub';

    var pfpEl      = document.getElementById('discord-pfp');
    var decoEl     = document.getElementById('discord-decoration');
    var skeletonEl = document.getElementById('hero-pfp-skeleton');
    var statusEl   = document.getElementById('discord-status');
    var activityEl = document.getElementById('discord-activity');

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

    function applyDecoration(user) {
        if (!decoEl) return;
        var deco = user && user.avatar_decoration_data;
        if (!deco || !deco.asset) { decoEl.style.display = 'none'; return; }
        var url = 'https://cdn.discordapp.com/avatar-decoration-presets/'
            + deco.asset + '.png?size=96&passthrough=true';
        decoEl.onload  = function () { decoEl.style.display = 'block'; };
        decoEl.onerror = function () { decoEl.style.display = 'none'; };
        decoEl.src = url;
    }

    function render(avatarSrc, lanyardData) {
        // Show PFP, hide skeleton
        if (skeletonEl) skeletonEl.style.display = 'none';
        if (pfpEl) {
            pfpEl.onerror = function () {
                pfpEl.style.display = 'none';
                if (skeletonEl) skeletonEl.style.display = 'block';
            };
            pfpEl.style.display = 'block';
            pfpEl.src = avatarSrc;
        }

        // Status dot
        var status = 'offline', lastSeenTs = null;
        if (lanyardData) {
            status = lanyardData.discord_status || 'offline';
            (lanyardData.activities || []).forEach(function (a) {
                if (a.timestamps && a.timestamps.start) lastSeenTs = a.timestamps.start;
            });
        }

        var dotEl = document.getElementById('discord-dot');
        if (dotEl) dotEl.className = 'discord-status-dot ds-' + status;

        // Status text
        if (statusEl) {
            var color = STATUS_COLORS[status] || STATUS_COLORS.offline;
            var label = STATUS_LABELS[status] || 'Offline';
            var ago   = (status === 'offline' && lastSeenTs)
                ? ' · last seen ' + timeAgo(lastSeenTs) : '';
            statusEl.innerHTML =
                '<span style="display:inline-flex;align-items:center;gap:5px;">'
                + '<span style="display:inline-block;width:8px;height:8px;border-radius:50%;'
                + 'background:' + color + ';box-shadow:0 0 5px ' + color + ';flex-shrink:0;"></span>'
                + '<span style="font-size:0.70rem;color:rgba(255,255,255,0.42);letter-spacing:0.3px;">'
                + label + ago + '</span>'
                + '<a href="https://discord.com/users/' + DISCORD_ID + '" target="_blank" rel="noopener noreferrer"'
                + ' style="color:rgba(255,255,255,0.22);text-decoration:none;font-size:0.64rem;letter-spacing:0.4px;transition:color 0.2s;margin-left:2px;"'
                + ' onmouseover="this.style.color=\'rgba(255,255,255,0.65)\'"'
                + ' onmouseout="this.style.color=\'rgba(255,255,255,0.22)\'">@' + USERNAME + '</a>'
                + '</span>';
        }

        // Activity
        if (activityEl) {
            var acts = (lanyardData && lanyardData.activities) || [];
            var activity = null;
            for (var j = 0; j < acts.length; j++) {
                if (acts[j].type === 2) {
                    activity = '🎵 ' + acts[j].details + ' — ' + acts[j].state;
                    break;
                }
                if (acts[j].type === 0 && !activity) activity = '🎮 ' + acts[j].name;
            }
            activityEl.textContent = activity || '';
        }
    }

    // Fallback
    var defaultIdx    = parseInt(DISCORD_ID.slice(-4)) % 6;
    var defaultAvatar = 'https://cdn.discordapp.com/embed/avatars/' + defaultIdx + '.png';
    var done = false;

    function fallback() {
        if (done) return;
        done = true;
        render(defaultAvatar, null);
    }

    var timer = setTimeout(fallback, 4000);

    fetch('https://api.lanyard.rest/v1/users/' + DISCORD_ID)
        .then(function (r) { return r.ok ? r.json() : Promise.reject('bad'); })
        .then(function (json) {
            clearTimeout(timer);
            if (done) return;
            done = true;
            var d    = json.data;
            var user = d && d.discord_user;
            var avatarUrl = defaultAvatar;
            if (user && user.avatar) {
                var ext = user.avatar.startsWith('a_') ? 'gif' : 'webp';
                avatarUrl = 'https://cdn.discordapp.com/avatars/'
                    + DISCORD_ID + '/' + user.avatar + '.' + ext + '?size=128';
            }
            applyDecoration(user);
            render(avatarUrl, d);
        })
        .catch(function (e) {
            console.warn('[discord.js] Lanyard fetch failed:', e);
            clearTimeout(timer);
            fallback();
        });

})();

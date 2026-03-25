// ═══════════════════════════════════════════════════════════════════
//  discord.js — real status dot, last active, avatar via Lanyard
// ═══════════════════════════════════════════════════════════════════

(function () {
    var DISCORD_ID = '748831508776878110';
    var USERNAME   = 'shub.is.a.sailor';
    var DISPLAY    = 'Shub';

    var skeletonEl = document.getElementById('discord-skeleton');
    var cardEl     = document.getElementById('discord-card');
    var pfpEl      = document.getElementById('discord-pfp');
    var nameEl     = document.getElementById('discord-name');
    var statusEl   = document.getElementById('discord-status');

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
        var s  = Math.floor(diff / 1000);
        var m  = Math.floor(s / 60);
        var h  = Math.floor(m / 60);
        var d  = Math.floor(h / 24);
        if (s < 60)  return 'just now';
        if (m < 60)  return m + 'm ago';
        if (h < 24)  return h + 'h ago';
        return d + 'd ago';
    }

    function statusDotHTML(color) {
        return '<span style="'
            + 'display:inline-block;'
            + 'width:9px;height:9px;'
            + 'border-radius:50%;'
            + 'background:' + color + ';'
            + 'box-shadow:0 0 6px ' + color + ';'
            + 'margin-right:5px;'
            + 'flex-shrink:0;'
            + 'vertical-align:middle;'
            + '"></span>';
    }

    function render(avatarSrc, lanyardData) {
        pfpEl.src = avatarSrc;
        pfpEl.onerror = function () {
            pfpEl.style.display = 'none';
            var init = document.createElement('div');
            init.style.cssText = [
                'width:45px','height:45px','border-radius:50%',
                'background:linear-gradient(135deg,#5865F2,#7289da)',
                'display:flex','align-items:center','justify-content:center',
                'font-weight:bold','font-size:1.1rem','color:white','flex-shrink:0'
            ].join(';');
            init.textContent = DISPLAY.charAt(0).toUpperCase();
            cardEl.insertBefore(init, pfpEl);
        };

        nameEl.textContent = DISPLAY;

        // Build status line
        var status = 'offline';
        var lastSeenTs = null;

        if (lanyardData) {
            status = lanyardData.discord_status || 'offline';
            // Lanyard provides active_on_discord_mobile / desktop / web
            // Last active timestamp isn't directly in Lanyard but we can
            // infer from activities timestamps if present
            var acts = lanyardData.activities || [];
            for (var i = 0; i < acts.length; i++) {
                if (acts[i].timestamps && acts[i].timestamps.start) {
                    lastSeenTs = acts[i].timestamps.start;
                }
            }
        }

        var color = STATUS_COLORS[status] || STATUS_COLORS.offline;
        var label = STATUS_LABELS[status] || 'Offline';
        var ago   = (status === 'offline' && lastSeenTs) ? ' · last seen ' + timeAgo(lastSeenTs) : '';

        statusEl.innerHTML = [
            '<div style="display:flex;align-items:center;gap:0;margin-top:2px;">',
            statusDotHTML(color),
            '<span style="font-size:0.72rem;color:rgba(255,255,255,0.45);letter-spacing:0.4px;">',
            label, ago,
            '</span>',
            '</div>',
            '<div style="margin-top:3px;">',
            '<a href="https://discord.com/users/' + DISCORD_ID + '" ',
            'target="_blank" rel="noopener noreferrer" ',
            'style="color:rgba(255,255,255,0.30);text-decoration:none;',
            'font-size:0.68rem;letter-spacing:0.5px;transition:color 0.2s;" ',
            'onmouseover="this.style.color=\'rgba(255,255,255,0.75)\'" ',
            'onmouseout="this.style.color=\'rgba(255,255,255,0.30)\'">',
            '@ ' + USERNAME + '</a>',
            '</div>'
        ].join('');

        // Show activity (game/spotify) if present
        var acts2 = (lanyardData && lanyardData.activities) || [];
        var activity = null;
        for (var j = 0; j < acts2.length; j++) {
            if (acts2[j].type === 2) { // Spotify
                activity = '🎵 ' + acts2[j].details + ' — ' + acts2[j].state;
                break;
            }
            if (acts2[j].type === 0 && !activity) { // Playing
                activity = '🎮 ' + acts2[j].name;
            }
        }
        if (activity) {
            statusEl.innerHTML += '<div style="margin-top:4px;font-size:0.68rem;'
                + 'color:rgba(255,255,255,0.35);white-space:nowrap;overflow:hidden;'
                + 'text-overflow:ellipsis;max-width:180px;">'
                + activity + '</div>';
        }

        skeletonEl.style.display = 'none';
        cardEl.classList.add('loaded');
    }

    // Default avatar fallback
    var defaultIdx    = parseInt(DISCORD_ID.slice(-4)) % 6;
    var defaultAvatar = 'https://cdn.discordapp.com/embed/avatars/' + defaultIdx + '.png';

    var done = false;
    function fallback() {
        if (done) return;
        done = true;
        render(defaultAvatar, null);
    }

    var timer = setTimeout(fallback, 3000);

    fetch('https://api.lanyard.rest/v1/users/' + DISCORD_ID)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(); })
        .then(function (json) {
            clearTimeout(timer);
            if (done) return;
            done = true;
            var d    = json && json.data;
            var user = d && d.discord_user;
            var avatarUrl = defaultAvatar;
            if (user && user.avatar) {
                var ext = user.avatar.startsWith('a_') ? '.gif' : '.webp';
                avatarUrl = 'https://cdn.discordapp.com/avatars/'
                    + DISCORD_ID + '/' + user.avatar + ext + '?size=128';
            }
            render(avatarUrl, d);
        })
        .catch(function () { clearTimeout(timer); fallback(); });

})();
// ═══════════════════════════════════════════════════════════════════
//  rope-theme.js
//  • Anchor: top-right of viewport
//  • Pull direction: DOWNWARD — ball travels down, rope stretches
//  • Destroy: at TUG_THRESHOLD px down → burst at that position,
//    no snap back up. Respawns from top after burst.
//  • Speaker icon: always glows white (both themes)
//  • Light mode: text/inputs/cards adapt, icons go dark EXCEPT speaker
//  • Contact page: two videos (contact-night.mp4 / contact-day.mp4)
//    that sync playback position on theme switch
// ═══════════════════════════════════════════════════════════════════

(function () {

    var ROPE_SEGMENTS = 12;
    var SEGMENT_LEN   = 13;
    var BALL_RADIUS   = 9;
    var GRAVITY       = 0.55;
    var DAMPING       = 0.80;
    var STIFFNESS     = 0.85;
    var TUG_THRESHOLD = 60;   // px pulled DOWN before toggle fires
    var MAX_PULL      = 120;  // max stretch from rest position

    var BALL_COLORS = ['#ffffff', '#a78bfa', '#67e8f9', '#f9a8d4', '#86efac', '#fde68a'];
    var colorIdx    = 0;

    // ── Themes ────────────────────────────────────────────────────
    var THEMES = {
        dark: {
            '--card-bg':          'rgba(0,0,0,0.25)',
            '--card-border':      'rgba(255,255,255,0.08)',
            '--text':             '#ffffff',
            '--text-muted':       'rgba(255,255,255,0.75)',
            '--skill-bg':         'rgba(255,255,255,0.06)',
            '--skill-border':     'rgba(255,255,255,0.10)',
            '--skill-text':       'rgba(255,255,255,0.70)',
            '--divider':          'rgba(255,255,255,0.07)',
            '--input-bg':         'rgba(255,255,255,0.04)',
            '--input-border':     'rgba(255,255,255,0.08)',
            '--input-text':       '#ffffff',
            '--input-ph':         'rgba(255,255,255,0.25)',
            '--email-row-bg':     'rgba(255,255,255,0.04)',
            '--email-row-border': 'rgba(255,255,255,0.08)',
            '--email-row-text':   'rgba(255,255,255,0.70)',
            '--submit-bg':        'rgba(255,255,255,0.08)',
            '--submit-border':    'rgba(255,255,255,0.15)',
            '--submit-text':      'rgba(255,255,255,0.70)',
            '--nav-opacity':      '0.38',
            '--nav-active-opacity': '1',
            '--section-label-color': 'rgba(255,255,255,0.45)',
            '--bio-text-color':   'rgba(255,255,255,0.6)',
            '--views-color':      'rgba(255,255,255,0.22)',
            '--discord-name':     '#ffffff',
            '--discord-status':   'rgba(255,255,255,0.45)',
            '--discord-activity': 'rgba(255,255,255,0.3)'
        },
        light: {
            '--card-bg':          'rgba(255,255,255,0.28)',   /* more transparent in light */
            '--card-border':      'rgba(255,255,255,0.35)',
            '--text':             '#ffffff',                   /* white text stays readable on photos */
            '--text-muted':       'rgba(255,255,255,0.75)',
            '--skill-bg':         'rgba(255,255,255,0.12)',
            '--skill-border':     'rgba(255,255,255,0.28)',
            '--skill-text':       'rgba(255,255,255,0.85)',
            '--divider':          'rgba(255,255,255,0.18)',
            '--input-bg':         'rgba(255,255,255,0.12)',
            '--input-border':     'rgba(255,255,255,0.28)',
            '--input-text':       '#ffffff',
            '--input-ph':         'rgba(255,255,255,0.40)',
            '--email-row-bg':     'rgba(255,255,255,0.12)',
            '--email-row-border': 'rgba(255,255,255,0.28)',
            '--email-row-text':   'rgba(255,255,255,0.85)',
            '--submit-bg':        'rgba(255,255,255,0.14)',
            '--submit-border':    'rgba(255,255,255,0.35)',
            '--submit-text':      'rgba(255,255,255,0.85)',
            '--nav-opacity':      '0.55',
            '--nav-active-opacity': '1',
            '--section-label-color': 'rgba(255,255,255,0.60)',
            '--bio-text-color':   'rgba(255,255,255,0.78)',
            '--views-color':      'rgba(255,255,255,0.55)',
            '--discord-name':     '#ffffff',
            '--discord-status':   'rgba(255,255,255,0.60)',
            '--discord-activity': 'rgba(255,255,255,0.45)'
        }
    };

    var isDark = localStorage.getItem('theme') !== 'light';

    // ── CSS injection ─────────────────────────────────────────────
    var styleEl = document.createElement('style');
    styleEl.textContent = [
        // Cards
        '.glass-card{background:var(--card-bg)!important;border-color:var(--card-border)!important;transition:background 0.4s,border-color 0.4s;}',

        // Section labels
        '.section-label{color:var(--section-label-color)!important;}',

        // Bio text
        '.bio-text{color:var(--bio-text-color)!important;}',

        // Skill tags
        '.skill-tag{background:var(--skill-bg)!important;border-color:var(--skill-border)!important;color:var(--skill-text)!important;}',

        // Divider
        '.card-divider{background:var(--divider)!important;}',

        // Nav tabs — color AND opacity adapt
        '.nav-tab,.nav-tabs span{color:var(--text)!important;opacity:var(--nav-opacity);}',
        '.nav-tab.active,.nav-tabs span.active{opacity:var(--nav-active-opacity)!important;}',
        '.nav-tab:hover,.nav-tabs span:hover{opacity:0.8!important;}',

        // Music player
        '.song-title,#music-time{color:var(--text)!important;}',

        // Views row — all children use views-color
        '.views-row{opacity:1!important;}',
        '.views-row,.views-row *{color:var(--views-color)!important;}',

        // Subtitle (CS Student)
        '.subtitle-text{color:var(--text)!important;opacity:0.38!important;}',

        // Display name + cursor — always white glow
        '#display-name{color:#fff!important;text-shadow:0 0 22px rgba(255,255,255,0.65),0 0 50px rgba(255,255,255,0.18)!important;}',
        '#tw-cursor{background:#fff!important;box-shadow:0 0 10px white,0 0 22px rgba(255,255,255,0.35)!important;}',

        // Discord skeleton
        '.discord-skeleton,.discord-real{background:var(--input-bg)!important;}',
        '.skeleton-avatar,.skeleton-line{background:var(--skill-bg)!important;}',
        '#discord-name{color:var(--discord-name)!important;}',
        '#discord-status,#discord-status a{color:var(--discord-status)!important;}',
        '#discord-activity{color:var(--discord-activity)!important;}',

        // Email row
        '.email-row{background:var(--email-row-bg)!important;border-color:var(--email-row-border)!important;color:var(--email-row-text)!important;}',
        '#email-display{color:var(--email-row-text)!important;}',
        '.email-row i{color:var(--email-row-text)!important;}',
        '.email-copy{color:var(--email-row-text)!important;}',

        // Form inputs
        '.form-input,.form-textarea{background:var(--input-bg)!important;border-color:var(--input-border)!important;color:var(--input-text)!important;}',
        '.form-input::placeholder,.form-textarea::placeholder{color:var(--input-ph)!important;}',

        // Submit button
        '.submit-btn{background:var(--submit-bg)!important;border-color:var(--submit-border)!important;color:var(--submit-text)!important;}',
        '.submit-btn:hover:not(:disabled){background:rgba(255,255,255,0.18)!important;color:#fff!important;}',
        '.btn-label{color:inherit!important;}',

        // Project items in about page
        '.project-item{background:var(--skill-bg)!important;border-color:var(--skill-border)!important;}',
        '.project-title,.project-arrow{color:var(--text)!important;}',
        '.project-desc{color:var(--text-muted)!important;}',
        '.project-link{background:var(--submit-bg)!important;border-color:var(--submit-border)!important;color:var(--text)!important;}',

        /* ── Speaker: ALWAYS white + glowing ── */
        '#mute-btn{color:#ffffff!important;text-shadow:0 0 8px rgba(255,255,255,0.9),0 0 18px rgba(255,255,255,0.4)!important;transition:text-shadow 0.3s;}',
        '#mute-btn:hover{text-shadow:0 0 12px rgba(255,255,255,1),0 0 28px rgba(255,255,255,0.65)!important;}',

        /* All other control icons adapt to theme text color */
        '.control-icon:not(#mute-btn){color:var(--text)!important;}',

        /* Toast adapts */
        '#toast{color:var(--text)!important;}'
    ].join('\n');
    document.head.appendChild(styleEl);

    function applyTheme(dark) {
        var t = dark ? THEMES.dark : THEMES.light;
        var r = document.documentElement;
        Object.keys(t).forEach(function (k) { r.style.setProperty(k, t[k]); });
        document.body.classList.toggle('theme-light', !dark);
        document.body.classList.toggle('theme-dark',  dark);
    }

    applyTheme(isDark);

    // ── Dual contact video management ─────────────────────────────
    // Expects: #contact-video-night and #contact-video-day in the DOM
    // (or a single #contact-video that we manage by src swap)
    // We use two <video> elements, crossfade on theme switch, sync time.

    function getContactVideos() {
        return {
            night: document.getElementById('contact-video-night'),
            day:   document.getElementById('contact-video-day')
        };
    }

    // Called by index.html when entering contact tab, or on contact.html load
    window._syncContactVideos = function (isNowDark) {
        var vids = getContactVideos();
        if (!vids.night || !vids.day) return;

        var active   = isNowDark ? vids.night : vids.day;
        var inactive = isNowDark ? vids.day   : vids.night;

        // Sync time from inactive → active before switching
        var t = inactive.currentTime;
        active.currentTime = t;

        // Crossfade
        active.style.opacity   = '1';
        inactive.style.opacity = '0';

        // Play active, pause inactive
        active.play().catch(function () {});
        inactive.pause();
    };

    // ══════════════════════════════════════════════════════════════
    //  ROPE
    // ══════════════════════════════════════════════════════════════

    var ANCHOR_RIGHT = 38;
    var ANCHOR_TOP   = 0;

    var canvas, ctx, hitDiv;
    var W, H, anchorX, anchorY;
    var nodes        = [];
    var ballX = 0, ballY = 0, ballVx = 0, ballVy = 0;
    var dragging     = false;
    var didToggle    = false;
    var tuggedDown   = 0;
    var currentColor = BALL_COLORS[0];
    var broken       = false;
    var particles    = [];
    var ropeBuilt    = false;

    function getAnchor() {
        return { x: window.innerWidth - ANCHOR_RIGHT, y: ANCHOR_TOP };
    }

    function restPos(ax, ay) {
        return { x: ax, y: ay + ROPE_SEGMENTS * SEGMENT_LEN };
    }

    function resetNodes(ax, ay) {
        nodes = [];
        for (var i = 0; i <= ROPE_SEGMENTS; i++) {
            nodes.push({
                x: ax, y: ay + i * SEGMENT_LEN,
                px: ax, py: ay + i * SEGMENT_LEN,
                pinned: i === 0
            });
        }
        var r = restPos(ax, ay);
        ballX = r.x; ballY = r.y;
        ballVx = 0;  ballVy = 0;
    }

    function buildRope() {
        if (ropeBuilt) return;
        ropeBuilt = true;

        canvas = document.createElement('canvas');
        canvas.id = 'rope-canvas';
        canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:200;';
        document.body.appendChild(canvas);
        ctx = canvas.getContext('2d');

        hitDiv = document.createElement('div');
        hitDiv.id = 'rope-hit';
        var hs = BALL_RADIUS * 4;
        hitDiv.style.cssText = [
            'position:fixed',
            'width:' + hs + 'px',
            'height:' + hs + 'px',
            'border-radius:50%',
            'z-index:201',
            'cursor:grab',
            'transform:translate(-50%,-50%)',
            'touch-action:none'
        ].join(';');
        document.body.appendChild(hitDiv);

        resize();
        window.addEventListener('resize', resize);

        function clientPos(e) {
            return e.touches
                ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
                : { x: e.clientX,            y: e.clientY };
        }

        function onStart(e) {
            if (e.cancelable) e.preventDefault();
            if (broken) return;
            dragging   = true;
            didToggle  = false;
            tuggedDown = 0;
            hitDiv.style.cursor = 'grabbing';
        }

        function onMove(e) {
            if (!dragging) return;
            if (e.cancelable) e.preventDefault();
            var p    = clientPos(e);
            var rest = restPos(anchorX, anchorY);

            var pullDown = p.y - rest.y;
            if (pullDown < 0) pullDown = 0;
            pullDown   = Math.min(pullDown, MAX_PULL);
            tuggedDown = pullDown;

            var dx = p.x - anchorX;
            var maxDx = MAX_PULL * 0.45;
            if (dx >  maxDx) dx =  maxDx;
            if (dx < -maxDx) dx = -maxDx;

            ballX = anchorX + dx;
            ballY = rest.y  + pullDown;

            nodes[ROPE_SEGMENTS].x = ballX;
            nodes[ROPE_SEGMENTS].y = ballY;

            if (!didToggle && pullDown >= TUG_THRESHOLD) {
                didToggle = true;
                triggerToggle();
            }
        }

        function onEnd() {
            if (!dragging) return;
            dragging   = false;
            tuggedDown = 0;
            hitDiv.style.cursor = 'grab';
            ballVy = -3;
            ballVx = 0;
        }

        hitDiv.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup',   onEnd);

        hitDiv.addEventListener('touchstart', onStart, { passive: false });
        window.addEventListener('touchmove',  onMove,  { passive: false });
        window.addEventListener('touchend',   onEnd);

        loop();
    }

    function resize() {
        W = canvas.width  = window.innerWidth;
        H = canvas.height = window.innerHeight;
        var a = getAnchor();
        anchorX = a.x; anchorY = a.y;
        if (!broken) resetNodes(anchorX, anchorY);
    }

    function triggerToggle() {
        isDark = !isDark;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        applyTheme(isDark);

        // Sync dual contact videos on theme switch
        window._syncContactVideos && window._syncContactVideos(isDark);

        colorIdx = (colorIdx + 1) % BALL_COLORS.length;
        var nextColor = BALL_COLORS[colorIdx];

        broken   = true;
        dragging = false;
        particles = [];
        for (var i = 0; i < 26; i++) {
            var angle = (Math.PI * 2 * i) / 26 + Math.random() * 0.2;
            var speed = 2 + Math.random() * 5.5;
            particles.push({
                x: ballX, y: ballY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed + 0.8,
                life: 1.0,
                decay: 0.022 + Math.random() * 0.02,
                r: 2.5 + Math.random() * 4,
                color: currentColor
            });
        }

        setTimeout(function () {
            currentColor = nextColor;
            broken       = false;
            particles    = [];
            var a = getAnchor();
            anchorX = a.x; anchorY = a.y;
            resetNodes(anchorX, anchorY);
        }, 750);
    }

    function simulate() {
        if (broken) return;
        var a = getAnchor();
        anchorX = a.x; anchorY = a.y;

        for (var i = 1; i < nodes.length; i++) {
            var n  = nodes[i];
            var vx = (n.x - n.px) * DAMPING;
            var vy = (n.y - n.py) * DAMPING;
            n.px = n.x; n.py = n.y;
            n.x += vx; n.y += vy + GRAVITY;
        }

        for (var it = 0; it < 8; it++) {
            nodes[0].x = anchorX; nodes[0].y = anchorY;
            for (var j = 0; j < nodes.length - 1; j++) {
                var a2 = nodes[j], b = nodes[j + 1];
                var dx = b.x - a2.x, dy = b.y - a2.y;
                var d  = Math.sqrt(dx * dx + dy * dy) || 0.001;
                var f  = (d - SEGMENT_LEN) / d * 0.5;
                if (!a2.pinned) { a2.x += dx * f; a2.y += dy * f; }
                if (!b.pinned)  { b.x  -= dx * f; b.y  -= dy * f; }
            }
        }

        if (!dragging) {
            var tail = nodes[ROPE_SEGMENTS];
            ballVx += (tail.x - ballX) * STIFFNESS;
            ballVy += (tail.y - ballY) * STIFFNESS;
            ballVx *= DAMPING; ballVy *= DAMPING;
            ballX  += ballVx;  ballY  += ballVy;
        }
    }

    function hexToRgba(hex, a) {
        var r = parseInt(hex.slice(1,3),16);
        var g = parseInt(hex.slice(3,5),16);
        var b = parseInt(hex.slice(5,7),16);
        return 'rgba('+r+','+g+','+b+','+a+')';
    }

    function draw() {
        ctx.clearRect(0, 0, W, H);

        if (broken) {
            for (var i = particles.length - 1; i >= 0; i--) {
                var p = particles[i];
                p.x += p.vx; p.y += p.vy; p.vy += 0.28;
                p.life -= p.decay;
                if (p.life <= 0) { particles.splice(i,1); continue; }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI*2);
                ctx.fillStyle   = p.color;
                ctx.globalAlpha = p.life;
                ctx.shadowColor = p.color;
                ctx.shadowBlur  = 10;
                ctx.fill();
            }
            ctx.globalAlpha = 1;
            ctx.shadowBlur  = 0;
            hitDiv.style.left = '-400px';
            hitDiv.style.top  = '-400px';
            return;
        }

        var ropeColor = isDark ? 'rgba(200,200,200,0.60)' : 'rgba(60,60,60,0.55)';

        ctx.beginPath();
        ctx.moveTo(nodes[0].x, nodes[0].y);
        for (var i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(ballX, ballY);
        ctx.strokeStyle = ropeColor;
        ctx.lineWidth   = 1.5;
        ctx.stroke();

        if (tuggedDown > 8) {
            var t = Math.min(tuggedDown / MAX_PULL, 1);
            ctx.beginPath();
            ctx.moveTo(nodes[0].x, nodes[0].y);
            for (var i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(ballX, ballY);
            ctx.strokeStyle = 'rgba(255,' + Math.round(60*(1-t)) + ',' + Math.round(60*(1-t)) + ',' + (t * 0.65) + ')';
            ctx.lineWidth   = 1.5;
            ctx.stroke();
        }

        var glowA = currentColor.startsWith('#') ? hexToRgba(currentColor, 0.18) : 'rgba(255,255,255,0.1)';
        var grd   = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, BALL_RADIUS * 2.8);
        grd.addColorStop(0, glowA);
        grd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_RADIUS * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle   = currentColor;
        ctx.shadowColor = currentColor;
        ctx.shadowBlur  = 16;
        ctx.fill();
        ctx.shadowBlur  = 0;

        ctx.beginPath();
        ctx.arc(anchorX, anchorY, 3, 0, Math.PI * 2);
        ctx.fillStyle = ropeColor;
        ctx.fill();

        hitDiv.style.left = ballX + 'px';
        hitDiv.style.top  = ballY + 'px';
    }

    function loop() {
        simulate();
        draw();
        requestAnimationFrame(loop);
    }

    window._ropeInit = buildRope;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { setTimeout(buildRope, 60); });
    } else {
        setTimeout(buildRope, 60);
    }

    window.ropeTheme = {
        toggle: function () { isDark=!isDark; localStorage.setItem('theme',isDark?'dark':'light'); applyTheme(isDark); },
        isDark: function () { return isDark; }
    };

})();
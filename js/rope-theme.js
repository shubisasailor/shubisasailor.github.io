// ═══════════════════════════════════════════════════════════════════
//  rope-theme.js
//  • Auto-detects OS/browser preferred color scheme on first visit
//  • Dark mode  → white rope + white ball
//  • Light mode → dark rope + dark ball (readable on bright video)
//  • Pull rope down to toggle theme
//  • Speaker icon always glows white
// ═══════════════════════════════════════════════════════════════════

(function () {

    // ── Rope physics constants ─────────────────────────────────────
    var ROPE_SEGMENTS = 12;
    var SEGMENT_LEN   = 13;
    var BALL_RADIUS   = 9;
    var GRAVITY       = 0.55;
    var DAMPING       = 0.80;
    var STIFFNESS     = 0.85;
    var TUG_THRESHOLD = 60;
    var MAX_PULL      = 120;

    // ── Theme detection ───────────────────────────────────────────
    // Use stored preference; if none, auto-detect from OS
    var stored = localStorage.getItem('theme');
    var isDark;
    if (stored === 'dark') {
        isDark = true;
    } else if (stored === 'light') {
        isDark = false;
    } else {
        // Auto-detect: match OS/browser preference
        isDark = !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    // ── Theme CSS variables ───────────────────────────────────────
    var THEMES = {
        dark: {
            // Cards
            '--card-bg':               'rgba(0,0,0,0.30)',
            '--card-border':           'rgba(255,255,255,0.09)',
            // Text
            '--text':                  '#ffffff',
            '--text-muted':            'rgba(255,255,255,0.80)',
            '--section-label-color':   'rgba(255,255,255,0.55)',
            '--bio-text-color':        'rgba(255,255,255,0.75)',
            '--views-color':           'rgba(255,255,255,0.45)',
            '--subtitle-color':        'rgba(255,255,255,0.45)',
            // Divider
            '--divider':               'rgba(255,255,255,0.08)',
            // Skill tags
            '--skill-bg':              'rgba(255,255,255,0.06)',
            '--skill-border':          'rgba(255,255,255,0.11)',
            '--skill-text':            'rgba(255,255,255,0.75)',
            // Inputs
            '--input-bg':              'rgba(255,255,255,0.05)',
            '--input-border':          'rgba(255,255,255,0.10)',
            '--input-text':            '#ffffff',
            '--input-ph':              'rgba(255,255,255,0.30)',
            // Email row
            '--email-row-bg':          'rgba(255,255,255,0.05)',
            '--email-row-border':      'rgba(255,255,255,0.10)',
            '--email-row-text':        'rgba(255,255,255,0.75)',
            // Submit button
            '--submit-bg':             'rgba(255,255,255,0.07)',
            '--submit-border':         'rgba(255,255,255,0.14)',
            '--submit-text':           'rgba(255,255,255,0.75)',
            // Nav
            '--nav-opacity':           '0.40',
            '--nav-active-opacity':    '1',
            // Discord
            '--discord-name':          '#ffffff',
            '--discord-status':        'rgba(255,255,255,0.55)',
            '--discord-activity':      'rgba(255,255,255,0.38)',
            // Under-process badge
            '--under-process-bg':      'rgba(255,255,255,0.04)',
            '--under-process-border':  'rgba(255,255,255,0.08)',
            '--under-process-text':    'rgba(255,255,255,0.45)',
            '--under-process-dot':     'rgba(255,255,255,0.45)'
        },
        light: {
            // Cards — semi-transparent white so bright video shows through
            '--card-bg':               'rgba(255,255,255,0.18)',
            '--card-border':           'rgba(255,255,255,0.35)',
            // Text — pure white works on most light videos; use text-shadow for contrast
            '--text':                  '#ffffff',
            '--text-muted':            '#ffffff',
            '--section-label-color':   '#ffffff',
            '--bio-text-color':        '#ffffff',
            '--views-color':           '#ffffff',
            '--subtitle-color':        'rgba(255,255,255,0.85)',
            // Divider
            '--divider':               'rgba(255,255,255,0.30)',
            // Skill tags
            '--skill-bg':              'rgba(255,255,255,0.20)',
            '--skill-border':          'rgba(255,255,255,0.40)',
            '--skill-text':            '#ffffff',
            // Inputs
            '--input-bg':              'rgba(255,255,255,0.20)',
            '--input-border':          'rgba(255,255,255,0.40)',
            '--input-text':            '#ffffff',
            '--input-ph':              'rgba(255,255,255,0.60)',
            // Email row
            '--email-row-bg':          'rgba(255,255,255,0.20)',
            '--email-row-border':      'rgba(255,255,255,0.40)',
            '--email-row-text':        '#ffffff',
            // Submit button
            '--submit-bg':             'rgba(255,255,255,0.20)',
            '--submit-border':         'rgba(255,255,255,0.45)',
            '--submit-text':           '#ffffff',
            // Nav
            '--nav-opacity':           '0.70',
            '--nav-active-opacity':    '1',
            // Discord
            '--discord-name':          '#ffffff',
            '--discord-status':        '#ffffff',
            '--discord-activity':      'rgba(255,255,255,0.85)',
            // Under-process badge
            '--under-process-bg':      'rgba(255,255,255,0.20)',
            '--under-process-border':  'rgba(255,255,255,0.40)',
            '--under-process-text':    '#ffffff',
            '--under-process-dot':     '#ffffff'
        }
    };

    // ── Inject CSS overrides ──────────────────────────────────────
    var styleEl = document.createElement('style');
    styleEl.textContent = [
        /* Cards */
        '.glass-card{background:var(--card-bg)!important;border-color:var(--card-border)!important;transition:background 0.4s,border-color 0.4s;}',
        /* Light mode: add text-shadow to all card text for contrast against bright backgrounds */
        'body.theme-light .glass-card *{text-shadow:0 1px 4px rgba(0,0,0,0.45),0 0 12px rgba(0,0,0,0.25)!important;}',
        /* But don't shadow canvas/rope elements */
        'body.theme-light #rope-canvas,body.theme-light #rope-hit{filter:none!important;}',
        /* Labels / text */
        '.section-label{color:var(--section-label-color)!important;}',
        '.bio-text{color:var(--bio-text-color)!important;}',
        '.subtitle-text{color:var(--subtitle-color)!important;}',
        /* Skill tags */
        '.skill-tag{background:var(--skill-bg)!important;border-color:var(--skill-border)!important;color:var(--skill-text)!important;}',
        /* Divider */
        '.card-divider{background:var(--divider)!important;}',
        /* Nav */
        '.nav-tab,.nav-tabs span{color:var(--text)!important;opacity:var(--nav-opacity)!important;}',
        '.nav-tab.active,.nav-tabs span.active{opacity:var(--nav-active-opacity)!important;}',
        '.nav-tab:hover,.nav-tabs span:hover{opacity:0.88!important;}',
        /* Music */
        '.song-title{color:var(--text)!important;}',
        '#music-time{color:var(--text)!important;opacity:0.55!important;}',
        /* Views */
        '.views-row,.views-row *{color:var(--views-color)!important;}',
        /* Display name — always bright */
        '#display-name{color:#fff!important;text-shadow:0 0 22px rgba(255,255,255,0.65),0 0 50px rgba(255,255,255,0.18)!important;}',
        '#tw-cursor{background:#fff!important;box-shadow:0 0 10px white,0 0 22px rgba(255,255,255,0.35)!important;}',
        /* Discord */
        '.discord-skeleton,.discord-real{background:var(--input-bg)!important;}',
        '.skeleton-avatar,.skeleton-line{background:var(--skill-bg)!important;}',
        '#discord-name{color:var(--discord-name)!important;}',
        '#discord-status,#discord-status a{color:var(--discord-status)!important;}',
        '#discord-activity{color:var(--discord-activity)!important;}',
        /* Email row */
        '.email-row{background:var(--email-row-bg)!important;border-color:var(--email-row-border)!important;color:var(--email-row-text)!important;}',
        '#email-display{color:var(--email-row-text)!important;}',
        '.email-row i,.email-copy{color:var(--email-row-text)!important;}',
        /* Inputs */
        '.form-input,.form-textarea{background:var(--input-bg)!important;border-color:var(--input-border)!important;color:var(--input-text)!important;}',
        '.form-input::placeholder,.form-textarea::placeholder{color:var(--input-ph)!important;}',
        /* Submit */
        '.submit-btn{background:var(--submit-bg)!important;border-color:var(--submit-border)!important;color:var(--submit-text)!important;}',
        '.submit-btn:hover:not(:disabled){background:rgba(255,255,255,0.30)!important;color:#fff!important;}',
        '.btn-label{color:inherit!important;}',
        /* Under-process */
        '.under-process{background:var(--under-process-bg)!important;border-color:var(--under-process-border)!important;}',
        '.under-process-text{color:var(--under-process-text)!important;}',
        '.under-process-dot{background:var(--under-process-dot)!important;}',
        /* Speaker — ALWAYS white glowing */
        '#mute-btn{color:#ffffff!important;text-shadow:0 0 8px rgba(255,255,255,0.9),0 0 18px rgba(255,255,255,0.4)!important;transition:text-shadow 0.3s;}',
        '#mute-btn:hover{text-shadow:0 0 12px rgba(255,255,255,1),0 0 28px rgba(255,255,255,0.65)!important;}',
        '.control-icon:not(#mute-btn){color:var(--text)!important;}',
        /* Toast */
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

    // ══════════════════════════════════════════════════════════════
    //  ROPE PHYSICS
    // ══════════════════════════════════════════════════════════════

    var ANCHOR_RIGHT = 38;
    var ANCHOR_TOP   = 0;

    var canvas, ctx, hitDiv;
    var W, H, anchorX, anchorY;
    var nodes = [];
    var ballX = 0, ballY = 0, ballVx = 0, ballVy = 0;
    var dragging   = false;
    var didToggle  = false;
    var tuggedDown = 0;
    var broken     = false;
    var particles  = [];
    var ropeBuilt  = false;

    function getBallColor() {
        // Dark mode → white ball; Light mode → dark ball
        return isDark ? '#ffffff' : '#1a1a1a';
    }

    function getRopeColor() {
        return isDark ? 'rgba(210,210,210,0.65)' : 'rgba(30,30,30,0.70)';
    }

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
            'width:'  + hs + 'px',
            'height:' + hs + 'px',
            'border-radius:50%',
            'z-index:201',
            'transform:translate(-50%,-50%)',
            'touch-action:none',
            'cursor:grab'
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
            ballVy = -3;
            ballVx = 0;
        }

        hitDiv.addEventListener('mousedown',  onStart);
        window.addEventListener('mousemove',  onMove);
        window.addEventListener('mouseup',    onEnd);
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
        if (window._syncBgVideos) window._syncBgVideos(isDark);

        // Burst with current ball color before switching
        var burstColor = getBallColor();
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
                color: burstColor
            });
        }

        setTimeout(function () {
            broken    = false;
            particles = [];
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

    function draw() {
        ctx.clearRect(0, 0, W, H);

        if (broken) {
            for (var i = particles.length - 1; i >= 0; i--) {
                var p = particles[i];
                p.x += p.vx; p.y += p.vy; p.vy += 0.28;
                p.life -= p.decay;
                if (p.life <= 0) { particles.splice(i, 1); continue; }
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
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

        var ropeColor = getRopeColor();
        var ballColor = getBallColor();

        // Rope line
        ctx.beginPath();
        ctx.moveTo(nodes[0].x, nodes[0].y);
        for (var i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
        ctx.lineTo(ballX, ballY);
        ctx.strokeStyle = ropeColor;
        ctx.lineWidth   = 1.8;
        ctx.stroke();

        // Tension glow when pulled
        if (tuggedDown > 8) {
            var t = Math.min(tuggedDown / MAX_PULL, 1);
            ctx.beginPath();
            ctx.moveTo(nodes[0].x, nodes[0].y);
            for (var i = 1; i < nodes.length; i++) ctx.lineTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(ballX, ballY);
            ctx.strokeStyle = 'rgba(255,' + Math.round(80 * (1 - t)) + ',' + Math.round(80 * (1 - t)) + ',' + (t * 0.6) + ')';
            ctx.lineWidth   = 1.8;
            ctx.stroke();
        }

        // Ball glow halo
        var glowRgb = isDark ? '255,255,255' : '0,0,0';
        var grd = ctx.createRadialGradient(ballX, ballY, 0, ballX, ballY, BALL_RADIUS * 2.8);
        grd.addColorStop(0, 'rgba(' + glowRgb + ',0.20)');
        grd.addColorStop(1, 'transparent');
        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_RADIUS * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();

        // Ball
        ctx.beginPath();
        ctx.arc(ballX, ballY, BALL_RADIUS, 0, Math.PI * 2);
        ctx.fillStyle   = ballColor;
        ctx.shadowColor = ballColor;
        ctx.shadowBlur  = isDark ? 16 : 8;
        ctx.fill();
        ctx.shadowBlur  = 0;

        // Anchor dot
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

    // Rope is initialised by _ropeInit (called from enterSite after overlay dismisses).
    // Do NOT auto-build on load — the hitDiv would intercept overlay clicks.

    window.ropeTheme = {
        toggle:  function () { isDark = !isDark; localStorage.setItem('theme', isDark ? 'dark' : 'light'); applyTheme(isDark); },
        isDark:  function () { return isDark; }
    };

})();
// ═══════════════════════════════════════════════════════════════════
//  rope-theme.js
//  • First visit: auto-detect OS preferred color scheme
//  • Subsequent visits: restore saved preference
//  • Pull rope ball down to toggle theme (marks as manually set)
//  • OS preference changes respected until user manually toggles
//  • Cursor switches automatically with theme (white.cur / black.cur)
// ═══════════════════════════════════════════════════════════════════

(function () {

    // ── Rope physics constants ─────────────────────────────────────
    var ROPE_SEGMENTS = 14;
    var SEGMENT_LEN   = 12;
    var BALL_RADIUS   = 9;
    var GRAVITY       = 0.90;
    var DAMPING       = 0.76;
    var STIFFNESS     = 0.88;
    var MAX_PULL      = window.innerHeight * 0.45; // max pull = 45% of screen height

    // ── Theme detection ───────────────────────────────────────────
    var stored = localStorage.getItem('theme');
    var isDark;
    if (stored === 'dark') {
        isDark = true;
    } else if (stored === 'light') {
        isDark = false;
    } else {
        // Auto-detect from OS preference
        isDark = !(window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
    }

    // ── Theme CSS variables ───────────────────────────────────────
    var THEMES = {
        dark: {
            '--card-bg':               'rgba(0,0,0,0.30)',
            '--card-border':           'rgba(255,255,255,0.09)',
            '--text':                  '#ffffff',
            '--text-muted':            'rgba(255,255,255,0.80)',
            '--section-label-color':   'rgba(255,255,255,0.55)',
            '--bio-text-color':        'rgba(255,255,255,0.75)',
            '--views-color':           'rgba(255,255,255,0.45)',
            '--subtitle-color':        'rgba(255,255,255,0.45)',
            '--divider':               'rgba(255,255,255,0.08)',
            '--skill-bg':              'rgba(255,255,255,0.06)',
            '--skill-border':          'rgba(255,255,255,0.11)',
            '--skill-text':            'rgba(255,255,255,0.75)',
            '--input-bg':              'rgba(255,255,255,0.05)',
            '--input-border':          'rgba(255,255,255,0.10)',
            '--input-text':            '#ffffff',
            '--input-ph':              'rgba(255,255,255,0.30)',
            '--email-row-bg':          'rgba(255,255,255,0.05)',
            '--email-row-border':      'rgba(255,255,255,0.10)',
            '--email-row-text':        'rgba(255,255,255,0.75)',
            '--submit-bg':             'rgba(255,255,255,0.07)',
            '--submit-border':         'rgba(255,255,255,0.14)',
            '--submit-text':           'rgba(255,255,255,0.75)',
            '--nav-opacity':           '0.40',
            '--nav-active-opacity':    '1',
            '--discord-name':          '#ffffff',
            '--discord-status':        'rgba(255,255,255,0.55)',
            '--discord-activity':      'rgba(255,255,255,0.38)',
            '--under-process-bg':      'rgba(255,255,255,0.04)',
            '--under-process-border':  'rgba(255,255,255,0.08)',
            '--under-process-text':    'rgba(255,255,255,0.45)',
            '--under-process-dot':     'rgba(255,255,255,0.45)'
        },
        light: {
            '--card-bg':               'rgba(255,255,255,0.18)',
            '--card-border':           'rgba(255,255,255,0.35)',
            '--text':                  '#ffffff',
            '--text-muted':            '#ffffff',
            '--section-label-color':   '#ffffff',
            '--bio-text-color':        '#ffffff',
            '--views-color':           '#ffffff',
            '--subtitle-color':        'rgba(255,255,255,0.85)',
            '--divider':               'rgba(255,255,255,0.30)',
            '--skill-bg':              'rgba(255,255,255,0.20)',
            '--skill-border':          'rgba(255,255,255,0.40)',
            '--skill-text':            '#ffffff',
            '--input-bg':              'rgba(255,255,255,0.20)',
            '--input-border':          'rgba(255,255,255,0.40)',
            '--input-text':            '#ffffff',
            '--input-ph':              'rgba(255,255,255,0.60)',
            '--email-row-bg':          'rgba(255,255,255,0.20)',
            '--email-row-border':      'rgba(255,255,255,0.40)',
            '--email-row-text':        '#ffffff',
            '--submit-bg':             'rgba(255,255,255,0.20)',
            '--submit-border':         'rgba(255,255,255,0.45)',
            '--submit-text':           '#ffffff',
            '--nav-opacity':           '0.70',
            '--nav-active-opacity':    '1',
            '--discord-name':          '#ffffff',
            '--discord-status':        '#ffffff',
            '--discord-activity':      'rgba(255,255,255,0.85)',
            '--under-process-bg':      'rgba(255,255,255,0.20)',
            '--under-process-border':  'rgba(255,255,255,0.40)',
            '--under-process-text':    '#ffffff',
            '--under-process-dot':     '#ffffff'
        }
    };

    // ── Inject CSS overrides ──────────────────────────────────────
    var styleEl = document.createElement('style');
    styleEl.textContent = [
        '.glass-card{background:var(--card-bg)!important;border-color:var(--card-border)!important;transition:background 0.4s,border-color 0.4s;}',
        'body.theme-light .glass-card *{text-shadow:0 1px 4px rgba(0,0,0,0.45),0 0 12px rgba(0,0,0,0.25)!important;}',
        'body.theme-light #rope-canvas,body.theme-light #rope-hit,body.theme-light #touch-fx{filter:none!important;}',
        '.section-label{color:var(--section-label-color)!important;}',
        '.bio-text{color:var(--bio-text-color)!important;}',
        '.subtitle-text{color:var(--subtitle-color)!important;}',
        '.skill-tag{background:var(--skill-bg)!important;border-color:var(--skill-border)!important;color:var(--skill-text)!important;}',
        '.card-divider{background:var(--divider)!important;}',
        '.nav-tab,.nav-tabs span{color:var(--text)!important;opacity:var(--nav-opacity)!important;}',
        '.nav-tab.active,.nav-tabs span.active{opacity:var(--nav-active-opacity)!important;}',
        '.nav-tab:hover,.nav-tabs span:hover{opacity:0.88!important;}',
        '.song-title{color:var(--text)!important;}',
        '#music-time{color:var(--text)!important;opacity:0.45!important;}',
        '.views-row,.views-row *{color:var(--views-color)!important;}',
        '#display-name{color:#fff!important;text-shadow:0 0 22px rgba(255,255,255,0.65),0 0 50px rgba(255,255,255,0.18)!important;}',
        '#tw-cursor{background:#fff!important;box-shadow:0 0 10px white,0 0 22px rgba(255,255,255,0.35)!important;}',
        '.discord-skeleton,.discord-real{background:var(--input-bg)!important;}',
        '.skeleton-avatar,.skeleton-line{background:var(--skill-bg)!important;}',
        '#discord-name{color:var(--discord-name)!important;}',
        '#discord-status,#discord-status a{color:var(--discord-status)!important;}',
        '#discord-activity{color:var(--discord-activity)!important;}',
        '.email-row{background:var(--email-row-bg)!important;border-color:var(--email-row-border)!important;color:var(--email-row-text)!important;}',
        '#email-display{color:var(--email-row-text)!important;}',
        '.email-row i,.email-copy{color:var(--email-row-text)!important;}',
        '.form-input,.form-textarea{background:var(--input-bg)!important;border-color:var(--input-border)!important;color:var(--input-text)!important;}',
        '.form-input::placeholder,.form-textarea::placeholder{color:var(--input-ph)!important;}',
        '.submit-btn{background:var(--submit-bg)!important;border-color:var(--submit-border)!important;color:var(--submit-text)!important;}',
        '.submit-btn:hover:not(:disabled){background:rgba(255,255,255,0.30)!important;color:#fff!important;}',
        '.btn-label{color:inherit!important;}',
        /* Volume controls always white-ish */
        '#mute-btn{color:rgba(255,255,255,0.45)!important;transition:color 0.2s!important;}',
        '#mute-btn:hover{color:rgba(255,255,255,0.90)!important;}',
        '#vol-pct{color:rgba(255,255,255,0.28)!important;}',
        '.control-icon:not(#mute-btn){color:var(--text)!important;opacity:0.65;}',
        '.control-icon:not(#mute-btn):hover{opacity:1!important;}',
        '#toast{color:var(--text)!important;}',
        '.stat-card{background:var(--card-bg)!important;border-color:var(--card-border)!important;}',
        '.stat-num{color:var(--text)!important;}',
        '.stat-lbl{color:var(--views-color)!important;}',
        /* Pill player theming */
        '#mobile-player-pill{background:var(--card-bg)!important;border-color:var(--card-border)!important;}',
        '#bored-btn{color:var(--views-color)!important;}',
        '#song-title-el{color:var(--text)!important;}',
        '#song-artist-el{color:var(--discord-status)!important;}',
        '#music-time-m,#vol-pct-m{color:var(--views-color)!important;}',
        '#mute-btn-m,#player-expand-hint{color:var(--views-color)!important;}',
        '.control-icon{color:var(--text)!important;}'
    ].join('\n');
    document.head.appendChild(styleEl);

    function applyTheme(dark) {
        var t = dark ? THEMES.dark : THEMES.light;
        var r = document.documentElement;
        Object.keys(t).forEach(function (k) { r.style.setProperty(k, t[k]); });
        document.body.classList.toggle('theme-light', !dark);
        document.body.classList.toggle('theme-dark',  dark);

        // ── Cursor sync: keep rope-hit grab cursor correct after theme swap ──
        var hit = document.getElementById('rope-hit');
        if (hit) { hit.style.cursor = 'grab'; }
    }

    applyTheme(isDark);

    // ── Live OS preference change (only if not manually overridden) ──
    if (window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
            if (!localStorage.getItem('theme_manual')) {
                isDark = e.matches;
                localStorage.setItem('theme', isDark ? 'dark' : 'light');
                applyTheme(isDark);
                if (window._syncBgVideos) window._syncBgVideos(isDark);
            }
        });
    }

    // ══════════════════════════════════════════════════════════════
    //  ROPE PHYSICS
    // ══════════════════════════════════════════════════════════════

    var ANCHOR_RIGHT = 38;   // px from right edge
    var ANCHOR_TOP   = 0;    // px from top

    var canvas, ctx, hitDiv;
    var W, H, anchorX, anchorY;
    var nodes = [];
    var ballX = 0, ballY = 0, ballVx = 0, ballVy = 0;
    var dragging   = false;
    var didToggle  = false;
    var tuggedDown = 0;   // how far down the ball has been pulled
    var broken     = false;
    var particles  = [];
    var ropeBuilt  = false;

    function getBallColor() {
        return isDark ? '#ffffff' : '#1a1a1a';
    }
    function getRopeColor() {
        return isDark ? 'rgba(210,210,210,0.65)' : 'rgba(30,30,30,0.70)';
    }
    function getAnchor() {
        return { x: window.innerWidth - ANCHOR_RIGHT, y: ANCHOR_TOP };
    }
    function restPos(ax, ay) {
        // Ball rests directly below the anchor
        return { x: ax, y: ay + ROPE_SEGMENTS * SEGMENT_LEN };
    }
    function resetNodes(ax, ay) {
        nodes = [];
        for (var i = 0; i <= ROPE_SEGMENTS; i++) {
            nodes.push({ x:ax, y:ay+i*SEGMENT_LEN, px:ax, py:ay+i*SEGMENT_LEN, pinned: i===0 });
        }
        var r = restPos(ax, ay);
        ballX = r.x; ballY = r.y; ballVx = 0; ballVy = 0;
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
            'position:fixed','width:'+hs+'px','height:'+hs+'px',
            'border-radius:50%','z-index:201',
            'transform:translate(-50%,-50%)',
            'touch-action:none','cursor:grab',
            'left:-400px','top:-400px'
        ].join(';');
        document.body.appendChild(hitDiv);

        resize();
        window.addEventListener('resize', resize);

        function clientPos(e) {
            return e.touches ? {x:e.touches[0].clientX,y:e.touches[0].clientY} : {x:e.clientX,y:e.clientY};
        }
        function onStart(e) {
            if (e.cancelable) e.preventDefault();
            if (broken) return;
            dragging=true; didToggle=false; tuggedDown=0;
        }
        function onMove(e) {
            if (!dragging) return;
            if (e.cancelable) e.preventDefault();
            var p = clientPos(e);

            // Free drag — follow the pointer, clamped to screen
            ballX = Math.max(0, Math.min(window.innerWidth, p.x));
            ballY = Math.max(anchorY + ROPE_SEGMENTS * SEGMENT_LEN * 0.2,
                             Math.min(window.innerHeight * 0.85, p.y));
            nodes[ROPE_SEGMENTS].x = ballX;
            nodes[ROPE_SEGMENTS].y = ballY;

            // Track how far below rest position the ball is
            tuggedDown = ballY - (anchorY + ROPE_SEGMENTS * SEGMENT_LEN);

            // Trigger when ball reaches 50% of screen height
            if (!didToggle && ballY >= window.innerHeight * 0.5) {
                didToggle = true;
                triggerToggle();
            }
        }
        function onEnd() {
            if (!dragging) return;
            dragging=false; tuggedDown=0;
            // Fling back upward toward rest
            ballVy = -6;
            didToggle=false;
        }

        hitDiv.addEventListener('mousedown',  onStart);
        window.addEventListener('mousemove',  onMove);
        window.addEventListener('mouseup',    onEnd);
        hitDiv.addEventListener('touchstart', onStart, {passive:false});
        window.addEventListener('touchmove',  onMove,  {passive:false});
        window.addEventListener('touchend',   onEnd);

        loop();
    }

    function resize() {
        W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight;
        var a=getAnchor(); anchorX=a.x; anchorY=a.y;
        if (!broken) resetNodes(anchorX,anchorY);
    }

    function triggerToggle() {
        var burstColor = getBallColor();
        isDark = !isDark;
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        localStorage.setItem('theme_manual', '1');
        applyTheme(isDark);
        if (window._syncBgVideos) window._syncBgVideos(isDark);
        /* Reset ALL drag state so red overlay never persists */
        broken=true; dragging=false; tuggedDown=0; didToggle=false; particles=[];
        for (var i=0; i<26; i++) {
            var angle=(Math.PI*2*i)/26+Math.random()*0.2;
            var speed=2+Math.random()*5.5;
            particles.push({
                x:ballX,y:ballY,
                vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed+0.8,
                life:1.0,decay:0.022+Math.random()*0.02,
                r:2.5+Math.random()*4,color:burstColor
            });
        }
        setTimeout(function(){
            broken=false; particles=[];
            var a=getAnchor(); anchorX=a.x; anchorY=a.y;
            resetNodes(anchorX,anchorY);
        },750);
    }

    function simulate() {
        if (broken) return;
        var a=getAnchor(); anchorX=a.x; anchorY=a.y;
        for (var i=1; i<nodes.length; i++) {
            var n=nodes[i], vx=(n.x-n.px)*DAMPING, vy=(n.y-n.py)*DAMPING;
            n.px=n.x; n.py=n.y; n.x+=vx; n.y+=vy+GRAVITY;
        }
        for (var it=0; it<8; it++) {
            nodes[0].x=anchorX; nodes[0].y=anchorY;
            for (var j=0; j<nodes.length-1; j++) {
                var a2=nodes[j], b=nodes[j+1];
                var dx=b.x-a2.x, dy=b.y-a2.y;
                var d=Math.sqrt(dx*dx+dy*dy)||0.001;
                var f=(d-SEGMENT_LEN)/d*0.5;
                if(!a2.pinned){a2.x+=dx*f;a2.y+=dy*f;}
                if(!b.pinned){b.x-=dx*f;b.y-=dy*f;}
            }
        }
        if (!dragging) {
            var tail=nodes[ROPE_SEGMENTS];
            ballVx+=(tail.x-ballX)*STIFFNESS; ballVy+=(tail.y-ballY)*STIFFNESS;
            ballVx*=DAMPING; ballVy*=DAMPING;
            ballX+=ballVx; ballY+=ballVy;
        }
    }

    function draw() {
        ctx.clearRect(0,0,W,H);
        ctx.globalAlpha = 1;
        ctx.shadowBlur  = 0;
        ctx.strokeStyle = 'transparent';
        ctx.fillStyle   = 'transparent';
        if (broken) {
            for (var i=particles.length-1; i>=0; i--) {
                var p=particles[i];
                p.x+=p.vx; p.y+=p.vy; p.vy+=0.28; p.life-=p.decay;
                if (p.life<=0){ particles.splice(i,1); continue; }
                ctx.beginPath(); ctx.arc(p.x,p.y,p.r*p.life,0,Math.PI*2);
                ctx.fillStyle=p.color; ctx.globalAlpha=p.life;
                ctx.shadowColor=p.color; ctx.shadowBlur=10; ctx.fill();
            }
            ctx.globalAlpha=1; ctx.shadowBlur=0;
            hitDiv.style.left='-400px'; hitDiv.style.top='-400px';
            return;
        }
        var ropeColor=getRopeColor(), ballColor=getBallColor();
        ctx.beginPath();
        ctx.moveTo(nodes[0].x,nodes[0].y);
        for (var i=1; i<nodes.length; i++) ctx.lineTo(nodes[i].x,nodes[i].y);
        ctx.lineTo(ballX,ballY);
        ctx.strokeStyle=ropeColor; ctx.lineWidth=1.8; ctx.stroke();

        if (dragging && tuggedDown > 8) {
            // Red glow as ball approaches 50% screen height trigger
            var restY    = anchorY + ROPE_SEGMENTS * SEGMENT_LEN;
            var triggerY = window.innerHeight * 0.5;
            var t = Math.min(tuggedDown / Math.max(1, triggerY - restY), 1);
            ctx.beginPath();
            ctx.moveTo(nodes[0].x,nodes[0].y);
            for (var i2=1; i2<nodes.length; i2++) ctx.lineTo(nodes[i2].x,nodes[i2].y);
            ctx.lineTo(ballX,ballY);
            ctx.strokeStyle='rgba(255,'+Math.round(80*(1-t))+','+Math.round(80*(1-t))+','+(t*0.50)+')';
            ctx.lineWidth=1.8; ctx.stroke();
        }

        var glowRgb=isDark?'255,255,255':'0,0,0';
        var grd=ctx.createRadialGradient(ballX,ballY,0,ballX,ballY,BALL_RADIUS*2.8);
        grd.addColorStop(0,'rgba('+glowRgb+',0.20)');
        grd.addColorStop(1,'transparent');
        ctx.beginPath(); ctx.arc(ballX,ballY,BALL_RADIUS*2.8,0,Math.PI*2);
        ctx.fillStyle=grd; ctx.fill();

        ctx.beginPath(); ctx.arc(ballX,ballY,BALL_RADIUS,0,Math.PI*2);
        ctx.fillStyle=ballColor; ctx.shadowColor=ballColor; ctx.shadowBlur=isDark?16:8; ctx.fill(); ctx.shadowBlur=0;

        // Contrasting outline: black outline on dark theme (white ball), white outline on light theme (black ball)
        ctx.beginPath(); ctx.arc(ballX,ballY,BALL_RADIUS,0,Math.PI*2);
        ctx.strokeStyle=isDark?'rgba(0,0,0,0.70)':'rgba(255,255,255,0.85)';
        ctx.lineWidth=1.5; ctx.stroke();

        ctx.beginPath(); ctx.arc(anchorX,anchorY,3,0,Math.PI*2);
        ctx.fillStyle=ropeColor; ctx.fill();

        hitDiv.style.left=ballX+'px'; hitDiv.style.top=ballY+'px';
    }

    function loop() { simulate(); draw(); requestAnimationFrame(loop); }

    window._ropeInit = buildRope;

    window.ropeTheme = {
        toggle: function () {
            isDark=!isDark;
            localStorage.setItem('theme', isDark?'dark':'light');
            localStorage.setItem('theme_manual','1');
            applyTheme(isDark);
        },
        isDark: function () { return isDark; }
    };

})();
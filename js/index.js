// ═══════════════════════════════════════════════════════════════════
//  index.js — overlay, name typewriter (once), no autoplay
// ═══════════════════════════════════════════════════════════════════

(function () {

    // ── Name typewriter — types once, stops ──────────────────────
    window._startNameTypewriter = (function () {
        var el     = document.getElementById('display-name');
        var cursor = document.getElementById('tw-cursor');
        if (!el) return function () {};

        var name  = 'Francisco';
        var idx   = 0;
        var timer = null;

        function tick() {
            idx++;
            el.textContent = name.slice(0, idx);
            if (idx < name.length) {
                timer = setTimeout(tick, 105);
            } else {
                // Done — hide cursor after a short pause
                setTimeout(function () {
                    if (cursor) cursor.style.display = 'none';
                }, 900);
            }
        }

        return function () {
            clearTimeout(timer);
            idx = 0;
            el.textContent = '';
            if (cursor) cursor.style.display = 'inline-block';
            setTimeout(tick, 700);
        };
    })();

    // ── Overlay logic — no autoplay ───────────────────────────────
    var overlay     = document.getElementById('overlay');
    var mainContent = document.getElementById('main-content');

    function onEnter() {
        sessionStorage.setItem('site_entered', '1');
        // No autoplay — user starts music via "feeling bored?" button
        overlay.style.opacity = '0';
        setTimeout(function () {
            overlay.style.display = 'none';
            mainContent.classList.add('visible');
            document.title = 'Francisco | Portfolio';
            window._startNameTypewriter();
        }, 800);
    }

    if (sessionStorage.getItem('site_entered')) {
        overlay.style.display = 'none';
        mainContent.classList.add('visible');
        document.title = 'Francisco | Portfolio';
        window._startNameTypewriter();
        // No autoplay on return either
    } else {
        overlay.addEventListener('click', onEnter, { once: true });
    }

})();

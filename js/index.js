// ═══════════════════════════════════════════════════════════════════
//  index.js — typewriter effect, overlay, title animation
//  Title: "Francisco | " is static — only the suffix types in.
// ═══════════════════════════════════════════════════════════════════

(function () {

    // ── Title typewriter (browser tab title) ─────────────────────
    // prefix stays fixed; only suffix animates character by character.
    function startTitleTypewriter(prefix, suffix, delay) {
        var i = 0;
        function step() {
            i++;
            document.title = prefix + suffix.slice(0, i) + (i < suffix.length ? '|' : '');
            if (i < suffix.length) setTimeout(step, 72);
        }
        setTimeout(step, delay || 0);
    }

    // ── Name typewriter (h1 display name) ────────────────────────
    window._startNameTypewriter = (function () {
        var el      = document.getElementById('display-name');
        var cursor  = document.getElementById('tw-cursor');
        if (!el) return function () {};

        var name    = 'Francisco';
        var idx     = 0;
        var erasing = false;
        var timer   = null;

        function tick() {
            if (!erasing) {
                idx++;
                el.textContent = name.slice(0, idx);
                if (idx === name.length) {
                    erasing = true;
                    timer = setTimeout(tick, 2600);
                } else {
                    timer = setTimeout(tick, 105);
                }
            } else {
                idx--;
                el.textContent = name.slice(0, idx);
                if (idx === 0) {
                    erasing = false;
                    timer = setTimeout(tick, 550);
                } else {
                    timer = setTimeout(tick, 58);
                }
            }
        }

        return function () {
            clearTimeout(timer);
            idx     = 0;
            erasing = false;
            el.textContent = '';
            setTimeout(tick, 700);
        };
    })();

    // ── Overlay logic ─────────────────────────────────────────────
    var overlay     = document.getElementById('overlay');
    var mainContent = document.getElementById('main-content');

    function onEnter() {
        sessionStorage.setItem('site_entered', '1');

        audio.play().catch(function () {
            document.addEventListener('click', function () { audio.play(); }, { once: true });
        });
        if (typeof playPauseBtn !== 'undefined') {
            playPauseBtn.classList.replace('fa-play', 'fa-pause');
        }

        overlay.style.opacity = '0';
        setTimeout(function () {
            overlay.style.display = 'none';
            mainContent.classList.add('visible');
            startTitleTypewriter('Francisco | ', 'Portfolio', 200);
            window._startNameTypewriter();
        }, 800);
    }

    if (sessionStorage.getItem('site_entered')) {
        overlay.style.display = 'none';
        mainContent.classList.add('visible');
        startTitleTypewriter('Francisco | ', 'Portfolio', 300);
        window._startNameTypewriter();

        audio.play().catch(function () {
            document.addEventListener('click', function () { audio.play(); }, { once: true });
        });
        if (typeof playPauseBtn !== 'undefined') {
            playPauseBtn.classList.replace('fa-play', 'fa-pause');
        }
    } else {
        overlay.addEventListener('click', onEnter, { once: true });
    }

})();
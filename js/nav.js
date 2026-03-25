// ═══════════════════════════════════════════════════════════════════
//  nav.js — SPA tab switching, background crossfade, keyboard nav
//  Title: "Francisco | " prefix is static; only suffix types in.
// ═══════════════════════════════════════════════════════════════════

(function () {

    var BG_MAP = {
        overview: 'bg-index',
        about:    'bg-about',
        contact:  'bg-contact'
    };

    // Suffix only — "Francisco | " stays put in the tab title.
    var SUFFIX_MAP = {
        overview: 'Portfolio',
        about:    'About',
        contact:  'Contact'
    };

    var TAB_ORDER  = ['overview', 'about', 'contact'];
    var currentTab = 'overview';

    // ── Title typewriter — prefix static, suffix types in ─────────
    var _titleTimer = null;
    function animateTitle(suffix) {
        clearTimeout(_titleTimer);
        var prefix = 'Francisco | ';
        var i = 0;
        function step() {
            i++;
            document.title = prefix + suffix.slice(0, i) + (i < suffix.length ? '|' : '');
            if (i < suffix.length) _titleTimer = setTimeout(step, 72);
        }
        // Start immediately (first char)
        document.title = prefix + '|';
        _titleTimer = setTimeout(step, 72);
    }

    // ── Core switch function ───────────────────────────────────────
    window.switchTab = function (tab) {
        if (tab === currentTab) return;
        if (!document.getElementById('panel-' + tab)) return;

        // Nav highlight
        var prevTabEl = document.getElementById('tab-' + currentTab);
        var nextTabEl = document.getElementById('tab-' + tab);
        if (prevTabEl) prevTabEl.classList.remove('active');
        if (nextTabEl) nextTabEl.classList.add('active');

        // Panel swap
        var prevPanel = document.getElementById('panel-' + currentTab);
        var nextPanel = document.getElementById('panel-' + tab);
        if (prevPanel) prevPanel.classList.remove('active');
        if (nextPanel) nextPanel.classList.add('active');

        // Background crossfade
        var prevBg = document.getElementById(BG_MAP[currentTab]);
        var nextBg = document.getElementById(BG_MAP[tab]);
        if (prevBg) prevBg.style.opacity = '0';
        if (nextBg) nextBg.style.opacity = '1';

        // Animate title suffix
        animateTitle(SUFFIX_MAP[tab] || tab);

        // Pushstate
        var url = tab === 'overview' ? './' : tab + '.html';
        history.pushState({ tab: tab }, '', url);

        currentTab = tab;
    };

    // ── Browser back/forward ───────────────────────────────────────
    window.addEventListener('popstate', function (e) {
        if (e.state && e.state.tab) window.switchTab(e.state.tab);
    });

    // ── Keyboard navigation ────────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        var tag = document.activeElement && document.activeElement.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA') return;

        var idx = TAB_ORDER.indexOf(currentTab);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
            e.preventDefault();
            window.switchTab(TAB_ORDER[(idx + 1) % TAB_ORDER.length]);
        } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
            e.preventDefault();
            window.switchTab(TAB_ORDER[(idx - 1 + TAB_ORDER.length) % TAB_ORDER.length]);
        }
    });

    // ── Tab keyboard accessibility ─────────────────────────────────
    document.querySelectorAll('.nav-tab').forEach(function (el) {
        el.setAttribute('tabindex', '0');
        el.setAttribute('role', 'tab');
        el.addEventListener('keydown', function (e) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                window.switchTab(el.id.replace('tab-', ''));
            }
        });
    });

    // ── Initial title (on page load) ──────────────────────────────
    // Runs once so "Portfolio" types in from the start.
    animateTitle('Portfolio');

})();
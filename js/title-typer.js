// ═══════════════════════════════════════════════════════════════════
//  title-typer.js
//  Types the suffix word letter by letter, waits, erases, repeats.
//  Usage: window.startTitleLoop('Portfolio', delayMs)
//         window.startTitleLoop('About', 0)
//  The PREFIX "Francisco | " is always static in the tab title.
// ═══════════════════════════════════════════════════════════════════

(function () {
    var PREFIX     = 'Francisco | ';
    var _timer     = null;
    var _suffix    = '';
    var _idx       = 0;
    var _erasing   = false;
    var _running   = false;

    // Called externally to start/restart the loop with a new suffix
    window.startTitleLoop = function (suffix, delay) {
        clearTimeout(_timer);
        _suffix  = suffix || '';
        _idx     = 0;
        _erasing = false;
        _running = true;
        document.title = PREFIX; // reset immediately
        _timer = setTimeout(_tick, delay != null ? delay : 300);
    };

    function _tick() {
        if (!_running) return;

        if (!_erasing) {
            // Typing forward
            _idx++;
            document.title = PREFIX + _suffix.slice(0, _idx);
            if (_idx < _suffix.length) {
                _timer = setTimeout(_tick, 72);
            } else {
                // Fully typed — pause, then erase
                _timer = setTimeout(function () {
                    _erasing = true;
                    _tick();
                }, 2200);
            }
        } else {
            // Erasing
            _idx--;
            document.title = PREFIX + _suffix.slice(0, _idx);
            if (_idx > 0) {
                _timer = setTimeout(_tick, 45);
            } else {
                // Fully erased — pause, then retype
                _erasing = false;
                _timer = setTimeout(_tick, 500);
            }
        }
    }
})();
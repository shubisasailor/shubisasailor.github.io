// ═══════════════════════════════════════════════════════════════════
//  player.js — random song, prev/next, draggable seek, time display
// ═══════════════════════════════════════════════════════════════════

var SONGS = [
    { src: 'audio/cry.mp3',               cover: './media/music-cover/cry.jpg',               title: 'cry.mp3' },
    { src: 'audio/the-night-we-met.mp3',  cover: './media/music-cover/the-night-we-met.jpg',  title: 'the-night-we-met.mp3' }
];

// ── Pick random song per session ──────────────────────────────────
var _idx = sessionStorage.getItem('song_index');
if (_idx === null) {
    _idx = Math.floor(Math.random() * SONGS.length);
    sessionStorage.setItem('song_index', _idx);
} else {
    _idx = parseInt(_idx, 10);
}

// ── DOM refs ──────────────────────────────────────────────────────
var audio             = document.getElementById('bg-audio');
var playPauseBtn      = document.getElementById('play-pause-btn');
var prevBtn           = document.getElementById('prev-btn');
var nextBtn           = document.getElementById('next-btn');
var muteBtn           = document.getElementById('mute-btn');
var volumeBar         = document.getElementById('volume-bar');
var progressContainer = document.getElementById('progress-container');
var progressBar       = document.getElementById('music-progress');
var timeEl            = document.getElementById('music-time');

// ── Load song by index ────────────────────────────────────────────
function loadSong(idx, autoplay) {
    _idx = ((idx % SONGS.length) + SONGS.length) % SONGS.length;
    sessionStorage.setItem('song_index', _idx);

    var song = SONGS[_idx];

    var src = audio.querySelector('source');
    if (src) { src.src = song.src; } 
    else { src = document.createElement('source'); src.type = 'audio/mpeg'; audio.appendChild(src); src.src = song.src; }
    audio.load();

    var coverImg = document.querySelector('.music-row img');
    if (coverImg) coverImg.src = song.cover;

    var titleEl = document.querySelector('.music-row .song-title');
    if (titleEl) titleEl.textContent = song.title;

    progressBar.style.width = '0%';
    if (timeEl) timeEl.textContent = '0:00';

    if (autoplay) {
        audio.play().catch(function () {});
    }
}

// Load initial song (no autoplay — overlay handles that)
loadSong(_idx, false);

// ── Prev / Next ───────────────────────────────────────────────────
if (prevBtn) prevBtn.addEventListener('click', function () { loadSong(_idx - 1, !audio.paused); });
if (nextBtn) nextBtn.addEventListener('click', function () { loadSong(_idx + 1, !audio.paused); });

// Auto-advance when song ends
audio.addEventListener('ended', function () { loadSong(_idx + 1, true); });

// ── Volume ────────────────────────────────────────────────────────
var _savedVol = parseFloat(localStorage.getItem('music_volume') || '1');
audio.volume    = _savedVol;
if (volumeBar) volumeBar.value = _savedVol;
_updateMuteIcon();

if (volumeBar) {
    volumeBar.addEventListener('input', function (e) {
        var vol = parseFloat(e.target.value);
        audio.volume = vol;
        audio.muted  = vol === 0;
        localStorage.setItem('music_volume', vol);
        _updateMuteIcon();
    });
}

if (muteBtn) {
    muteBtn.addEventListener('click', function () {
        audio.muted = !audio.muted;
        if (!audio.muted && audio.volume === 0) {
            audio.volume = 0.5;
            if (volumeBar) volumeBar.value = 0.5;
            localStorage.setItem('music_volume', 0.5);
        }
        _updateMuteIcon();
    });
}

function _updateMuteIcon() {
    if (!muteBtn) return;
    var muted = audio.muted || audio.volume === 0;
    muteBtn.className = muted ? 'fas fa-volume-mute control-icon'
        : (audio.volume < 0.5 ? 'fas fa-volume-down control-icon' : 'fas fa-volume-up control-icon');
}

// ── Play / Pause ──────────────────────────────────────────────────
if (playPauseBtn) {
    playPauseBtn.addEventListener('click', function () {
        if (audio.paused) {
            audio.play().catch(function (e) { console.warn('Playback blocked:', e); });
        } else {
            audio.pause();
        }
    });
}

audio.addEventListener('pause', function () { if (playPauseBtn) playPauseBtn.classList.replace('fa-pause', 'fa-play'); });
audio.addEventListener('play',  function () { if (playPauseBtn) playPauseBtn.classList.replace('fa-play', 'fa-pause'); });

// ── Time formatting ───────────────────────────────────────────────
function fmtTime(s) {
    if (!isFinite(s) || isNaN(s)) return '0:00';
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
}

// ── Progress bar — update + drag to seek ─────────────────────────
var _seeking = false;

audio.addEventListener('timeupdate', function () {
    if (_seeking || !audio.duration || !isFinite(audio.duration)) return;
    var pct = (audio.currentTime / audio.duration) * 100;
    progressBar.style.width = pct + '%';
    sessionStorage.setItem('music_time', audio.currentTime);

    // Show remaining time: -m:ss
    if (timeEl) {
        var remaining = audio.duration - audio.currentTime;
        timeEl.textContent = '-' + fmtTime(remaining);
    }
});

function seekFromEvent(e) {
    if (!audio.duration || !isFinite(audio.duration)) return;
    var rect  = progressContainer.getBoundingClientRect();
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    audio.currentTime = ratio * audio.duration;
    progressBar.style.width = (ratio * 100) + '%';
    if (timeEl) {
        var remaining = audio.duration - audio.currentTime;
        timeEl.textContent = '-' + fmtTime(remaining);
    }
}

if (progressContainer) {
    // Click to seek
    progressContainer.addEventListener('click', seekFromEvent);

    // Drag to seek
    progressContainer.addEventListener('mousedown', function (e) {
        _seeking = true;
        seekFromEvent(e);
        function onMove(e) { seekFromEvent(e); }
        function onUp()   { _seeking = false; window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); }
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });

    // Touch drag
    progressContainer.addEventListener('touchstart', function (e) {
        _seeking = true;
        seekFromEvent(e);
    }, { passive: true });
    progressContainer.addEventListener('touchmove', function (e) {
        seekFromEvent(e);
    }, { passive: true });
    progressContainer.addEventListener('touchend', function () { _seeking = false; });
}

// ── Restore position across pages ────────────────────────────────
window._restoreMusicTime = function () {
    var t = parseFloat(sessionStorage.getItem('music_time') || '0');
    if (t > 0 && isFinite(t)) audio.currentTime = t;
};

// ── View counter ──────────────────────────────────────────────────
var _viewEl = document.querySelector('.visit-count-val');
if (_viewEl) {
    (function () {
        var SEED = 1100;
        function fmt(n) {
            if (n >= 1000) { var k = n / 1000; return (Number.isInteger(k) ? k : k.toFixed(1)) + 'k'; }
            return String(n);
        }
        if (!localStorage.getItem('unique_views')) localStorage.setItem('unique_views', SEED);
        var count = parseInt(localStorage.getItem('unique_views'), 10);
        if (isNaN(count) || count < SEED) { count = SEED; localStorage.setItem('unique_views', SEED); }
        _viewEl.textContent = fmt(count);
        fetch('https://api.ipify.org?format=json')
            .then(function (r) { return r.json(); })
            .then(function (j) {
                var today = new Date().toDateString();
                if (localStorage.getItem('visitor_ip') !== j.ip || localStorage.getItem('visitor_date') !== today) {
                    count++;
                    localStorage.setItem('unique_views', count);
                    localStorage.setItem('visitor_ip', j.ip);
                    localStorage.setItem('visitor_date', today);
                    _viewEl.textContent = fmt(count);
                }
            }).catch(function () {});
    })();
}
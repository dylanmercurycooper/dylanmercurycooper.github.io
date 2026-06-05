/* ============================================================
   Personal website — Dylan Mercury Cooper
   script.js

   Sections:
     1. Theme toggle (click to swap light/dark; persisted)
     2. Email button (assembles mailto on click; address not in HTML)
     3. YouTube thumbnail fallback (high-res to medium-res)
     4. Custom audio player (Spitfire-style controls per track)
   ============================================================ */


/* 1. Theme toggle
   ------------------------------------------------------------
   The inline <head> script already sets data-theme on first
   paint (from localStorage if set, otherwise OS preference).

   This script handles user interaction:
     - clicking the button swaps theme + persists choice
     - the icon and aria-label stay in sync with the current state
     - if the user hasn't manually chosen, OS theme changes are followed
*/

(function () {
    'use strict';

    /* Inline SVG icons. Using currentColor so they inherit the
       button's text colour (which itself uses the theme's --text). */
    const SUN_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`;

    const MOON_ICON = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

    const toggleButton = document.getElementById('theme-toggle');
    const html = document.documentElement;

    /* Show the icon for what clicking would switch TO.
       In light mode, show moon (clicking goes dark).
       In dark mode, show sun (clicking goes light). */
    function syncButton(theme) {
        const target = theme === 'dark' ? 'light' : 'dark';
        toggleButton.innerHTML = target === 'dark' ? MOON_ICON : SUN_ICON;
        toggleButton.setAttribute('aria-label', 'Switch to ' + target + ' mode');
    }

    function applyTheme(theme, persist) {
        html.setAttribute('data-theme', theme);
        if (persist) localStorage.setItem('theme', theme);
        syncButton(theme);
    }

    /* Initialise: whatever theme the inline <head> script set,
       sync the button's icon and label to match. */
    syncButton(html.getAttribute('data-theme') || 'light');

    /* Click handler — persists the user's choice */
    toggleButton.addEventListener('click', function () {
        const current = html.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        applyTheme(next, true);
    });

    /* If the user hasn't made a manual choice, follow OS theme changes live.
       Once they click the toggle once, their choice is persisted to
       localStorage and OS changes are ignored. */
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', function (e) {
        if (!localStorage.getItem('theme')) {
            applyTheme(e.matches ? 'dark' : 'light', false);
        }
    });
})();


/* 2. Email button
   ------------------------------------------------------------
   Assembles the mailto link at click time so the email address
   never appears as a literal string in the HTML source. Useful
   against naive scrapers; not bulletproof against ones that run JS.
*/

(function () {
    'use strict';

    const button = document.querySelector('.contact-email-btn');
    if (!button) return;

    button.addEventListener('click', function () {
        const u = button.dataset.uname;
        const d = button.dataset.dname;
        if (u && d) {
            window.location.href = 'mailto:' + u + '@' + d;
        }
    });
})();


/* 3. YouTube thumbnail fallback
   ------------------------------------------------------------
   YouTube doesn't always have maxresdefault.jpg (1280x720)
   for every video — older or non-HD uploads return a small
   grey placeholder instead. When that happens, fall back to
   sddefault.jpg (640x480), which is always available.

   We detect both cases:
     - 404 error → image fails to load → swap src
     - Returned a placeholder → image loads but with naturalWidth <= 120
*/

(function () {
    'use strict';

    const images = document.querySelectorAll('.youtube-thumbnail img');
    if (!images.length) return;

    function tryFallback(img) {
        if (img.src.indexOf('maxresdefault.jpg') !== -1) {
            img.src = img.src.replace('maxresdefault.jpg', 'sddefault.jpg');
        }
    }

    images.forEach(function (img) {
        img.addEventListener('error', function () {
            tryFallback(img);
        });

        img.addEventListener('load', function () {
            if (img.naturalWidth <= 120 && img.src.indexOf('maxresdefault.jpg') !== -1) {
                tryFallback(img);
            }
        });

        // Handle the case where the image already loaded before we attached listeners
        if (img.complete) {
            if (img.naturalWidth === 0) {
                tryFallback(img);
            } else if (img.naturalWidth <= 120 && img.src.indexOf('maxresdefault.jpg') !== -1) {
                tryFallback(img);
            }
        }
    });
})();


/* 4. Custom audio player
   ------------------------------------------------------------
   Each <audio class="audio-player"> on the page is wrapped
   with a custom UI: play button, scrubbable progress, time,
   mute toggle, volume slider.

   Only one track plays at a time across the page (shared
   registry). Keyboard: space (play/pause), arrows (seek/volume).
   The native <audio> element stays in the DOM but hidden;
   the class controls it via the standard HTMLAudioElement API.
*/

(function () {
    'use strict';

    const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';
    const PAUSE_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>';
    const VOLUME_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>';
    const VOLUME_MUTED_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" fill="currentColor"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>';

    /* Shared registry: tracks the currently playing player so a
       new play() call pauses any other. */
    let currentlyPlaying = null;

    function fmtTime(s) {
        if (!isFinite(s) || s < 0) return '--:--';
        const m = Math.floor(s / 60);
        const sec = Math.floor(s % 60).toString().padStart(2, '0');
        return m + ':' + sec;
    }

    class AudioPlayer {
        constructor(audioEl) {
            this.audio = audioEl;
            this.title = audioEl.dataset.title || 'Untitled';
            this.audio.style.display = 'none';
            this.buildUI();
            this.attachListeners();
        }

        buildUI() {
            const c = document.createElement('div');
            c.className = 'custom-audio';

            this.playBtn = document.createElement('button');
            this.playBtn.type = 'button';
            this.playBtn.className = 'custom-audio-play';
            this.playBtn.setAttribute('aria-label', 'Play ' + this.title);
            this.playBtn.innerHTML = PLAY_ICON;
            c.appendChild(this.playBtn);

            this.progress = document.createElement('input');
            this.progress.type = 'range';
            this.progress.className = 'custom-audio-progress';
            this.progress.min = '0';
            this.progress.max = '0';
            this.progress.value = '0';
            this.progress.step = '0.1';
            this.progress.setAttribute('aria-label', 'Seek ' + this.title);
            c.appendChild(this.progress);

            this.time = document.createElement('span');
            this.time.className = 'custom-audio-time';
            this.time.textContent = '--:-- / --:--';
            c.appendChild(this.time);

            this.volumeBtn = document.createElement('button');
            this.volumeBtn.type = 'button';
            this.volumeBtn.className = 'custom-audio-volume-btn';
            this.volumeBtn.setAttribute('aria-label', 'Mute');
            this.volumeBtn.innerHTML = VOLUME_ICON;
            c.appendChild(this.volumeBtn);

            this.volumeSlider = document.createElement('input');
            this.volumeSlider.type = 'range';
            this.volumeSlider.className = 'custom-audio-volume';
            this.volumeSlider.min = '0';
            this.volumeSlider.max = '1';
            this.volumeSlider.step = '0.05';
            this.volumeSlider.value = '1';
            this.volumeSlider.setAttribute('aria-label', 'Volume');
            c.appendChild(this.volumeSlider);

            // Insert the custom UI just after the original <audio>
            this.audio.parentNode.insertBefore(c, this.audio.nextSibling);
            this.container = c;
        }

        attachListeners() {
            this.playBtn.addEventListener('click', () => this.toggle());

            this.progress.addEventListener('input', () => {
                if (isFinite(this.audio.duration)) {
                    this.audio.currentTime = parseFloat(this.progress.value);
                    this.updateTime();
                }
            });

            this.volumeSlider.addEventListener('input', () => {
                this.audio.volume = parseFloat(this.volumeSlider.value);
                this.audio.muted = false;
                this.updateVolumeIcon();
            });

            this.volumeBtn.addEventListener('click', () => {
                this.audio.muted = !this.audio.muted;
                this.updateVolumeIcon();
            });

            this.audio.addEventListener('loadedmetadata', () => {
                this.progress.max = this.audio.duration;
                this.updateTime();
            });

            this.audio.addEventListener('timeupdate', () => {
                this.progress.value = this.audio.currentTime;
                this.updateTime();
            });

            this.audio.addEventListener('ended', () => {
                this.setPaused();
                if (currentlyPlaying === this) currentlyPlaying = null;
            });

            // Keyboard: space toggles when play button focused; arrows seek/volume
            this.playBtn.addEventListener('keydown', (e) => this.handleKey(e));
            this.progress.addEventListener('keydown', (e) => this.handleKey(e));
        }

        handleKey(e) {
            if (e.code === 'Space' && e.target === this.playBtn) {
                e.preventDefault();
                this.toggle();
            }
        }

        toggle() {
            if (this.audio.paused) {
                this.play();
            } else {
                this.pause();
            }
        }

        play() {
            // Pause any other player first
            if (currentlyPlaying && currentlyPlaying !== this) {
                currentlyPlaying.pause();
            }
            const promise = this.audio.play();
            if (promise && promise.catch) {
                promise.catch(() => {
                    /* Play can fail if no source, autoplay blocked, etc.
                       Silent fail; keep button in paused state. */
                    this.setPaused();
                });
            }
            currentlyPlaying = this;
            this.setPlaying();
        }

        pause() {
            this.audio.pause();
            if (currentlyPlaying === this) currentlyPlaying = null;
            this.setPaused();
        }

        setPlaying() {
            this.playBtn.innerHTML = PAUSE_ICON;
            this.playBtn.dataset.state = 'playing';
            this.playBtn.setAttribute('aria-label', 'Pause ' + this.title);
        }

        setPaused() {
            this.playBtn.innerHTML = PLAY_ICON;
            this.playBtn.dataset.state = 'paused';
            this.playBtn.setAttribute('aria-label', 'Play ' + this.title);
        }

        updateTime() {
            this.time.textContent = fmtTime(this.audio.currentTime) + ' / ' + fmtTime(this.audio.duration || 0);
        }

        updateVolumeIcon() {
            if (this.audio.muted || this.audio.volume === 0) {
                this.volumeBtn.innerHTML = VOLUME_MUTED_ICON;
                this.volumeBtn.setAttribute('aria-label', 'Unmute');
            } else {
                this.volumeBtn.innerHTML = VOLUME_ICON;
                this.volumeBtn.setAttribute('aria-label', 'Mute');
            }
        }
    }

    /* Initialise: find every <audio class="audio-player"> on the page
       and wrap it. */
    document.querySelectorAll('audio.audio-player').forEach(function (audio) {
        new AudioPlayer(audio);
    });
})();

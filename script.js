/* ============================================================
   Personal website — Dylan Mercury Cooper
   script.js

   Sections:
     1. Theme toggle (click to swap light/dark; persisted)
     2. Email button (assembles mailto on click; address not in HTML)
     3. YouTube thumbnail fallback (high-res to medium-res)
     4. Custom audio player (Spitfire-style controls per track)
     5. Drum videos (big centre play button; one video at a time)
     6. Drum video carousel (arrows + dots; one slide at a time)
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


/* 5. Drum videos
   ------------------------------------------------------------
   Each <video> inside a .drum-video figure starts with the
   browser's own small controls (so it still works without JS).

   This script:
     - hides those small controls before playing
     - adds a big round play button over the middle of the video
     - on click: shows the normal controls, hides the big button, plays
     - when a video finishes, brings the big button back
     - only lets one drum video play at a time
*/

(function () {
    'use strict';

    const PLAY_ICON = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

    // Find every drum video on the page (none on other pages → stop here)
    const videos = document.querySelectorAll('.drum-video video');
    if (!videos.length) return;

    videos.forEach(function (video) {
        // Hide the small built-in controls until the visitor presses play
        video.controls = false;

        // Build the big button: a full-size clickable area with a round icon in the middle
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'drum-video-play';
        button.setAttribute('aria-label', 'Play ' + (video.getAttribute('aria-label') || 'video'));
        button.innerHTML = '<span class="drum-video-play-icon">' + PLAY_ICON + '</span>';

        // Put the button inside the same <figure> as the video, on top of it
        video.parentNode.appendChild(button);

        // Click → show normal controls, hide the big button, start playing
        button.addEventListener('click', function () {
            video.controls = true;
            button.hidden = true;
            video.play();
        });

        // Whenever this video starts, pause every other drum video
        video.addEventListener('play', function () {
            videos.forEach(function (other) {
                if (other !== video) other.pause();
            });
        });

        // When the video reaches the end, go back to the big-button look
        video.addEventListener('ended', function () {
            video.controls = false;
            button.hidden = false;
        });
    });
})();


/* 6. Drum video carousel
   ------------------------------------------------------------
   The HTML is just a row of slides that can be scrolled sideways;
   the CSS makes only one slide fit at a time and snaps to each.

   This script adds:
     - left/right arrow buttons (hidden at the first/last slide)
     - one dot per slide underneath, highlighting the current one
     - pausing a video when you move away from its slide
   Swiping on a phone or trackpad works on its own (that's the CSS).
*/

(function () {
    'use strict';

    const LEFT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>';
    const RIGHT_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>';

    document.querySelectorAll('.drum-carousel').forEach(function (carousel) {
        const track = carousel.querySelector('.drum-carousel-track');
        const slides = track.querySelectorAll('.drum-video');
        if (slides.length < 2) return;      // one clip → no arrows or dots needed

        // Label each slide for screen readers: "1 of 3", "2 of 3", ...
        slides.forEach(function (slide, i) {
            slide.setAttribute('aria-roledescription', 'slide');
            slide.setAttribute('aria-label', (i + 1) + ' of ' + slides.length);
        });

        // Build an arrow button (direction: -1 = previous, +1 = next)
        function makeArrow(className, label, icon, direction) {
            const arrow = document.createElement('button');
            arrow.type = 'button';
            arrow.className = 'drum-carousel-arrow ' + className;
            arrow.setAttribute('aria-label', label);
            arrow.innerHTML = icon;
            arrow.addEventListener('click', function () {
                goTo(currentIndex() + direction);
            });
            carousel.appendChild(arrow);
            return arrow;
        }

        const prev = makeArrow('drum-carousel-prev', 'Previous video', LEFT_ICON, -1);
        const next = makeArrow('drum-carousel-next', 'Next video', RIGHT_ICON, +1);

        // Build the row of dots, one per slide; clicking a dot jumps to that slide
        const dotsRow = document.createElement('div');
        dotsRow.className = 'drum-carousel-dots';
        const dots = Array.prototype.map.call(slides, function (_, i) {
            const dot = document.createElement('button');
            dot.type = 'button';
            dot.className = 'drum-carousel-dot';
            dot.setAttribute('aria-label', 'Go to video ' + (i + 1));
            dot.addEventListener('click', function () { goTo(i); });
            dotsRow.appendChild(dot);
            return dot;
        });
        carousel.appendChild(dotsRow);

        // Distance from the start of one slide to the start of the next
        // (slide width + the gap between them), measured from the page
        function step() {
            return slides[1].offsetLeft - slides[0].offsetLeft;
        }

        // Which slide is showing? (how far we've scrolled ÷ one step)
        function currentIndex() {
            return Math.round(track.scrollLeft / step());
        }

        // Scroll to slide number i (kept within the first and last slide)
        function goTo(i) {
            const target = Math.max(0, Math.min(slides.length - 1, i));
            track.scrollTo({ left: target * step() });
        }

        // Clicking a faded clip brings it forward instead of playing it.
        // "true" = catch the click on its way in, before the play button sees it.
        slides.forEach(function (slide, i) {
            slide.addEventListener('click', function (e) {
                if (i !== currentIndex()) {
                    e.preventDefault();
                    e.stopPropagation();
                    goTo(i);
                }
            }, true);
        });

        // Bring the arrows, dots and videos in line with the current slide
        function update() {
            const index = currentIndex();
            prev.disabled = index === 0;
            next.disabled = index === slides.length - 1;
            dots.forEach(function (dot, i) {
                dot.setAttribute('aria-current', i === index ? 'true' : 'false');
            });
            // Mark the current slide (the CSS fades all the others)
            slides.forEach(function (slide, i) {
                slide.classList.toggle('is-current', i === index);
            });
            // Pause any video that isn't on the visible slide
            slides.forEach(function (slide, i) {
                const video = slide.querySelector('video');
                if (video && i !== index) video.pause();
            });
        }

        // Re-check after every scroll (arrow click, dot click, or swipe).
        // requestAnimationFrame waits for the next screen redraw, so we
        // don't redo the work dozens of times during one smooth glide.
        let pending = false;
        track.addEventListener('scroll', function () {
            if (pending) return;
            pending = true;
            requestAnimationFrame(function () {
                pending = false;
                update();
            });
        });

        // Keyboard: left/right arrow keys move between slides while
        // focus is inside the carousel, except on a video itself,
        // where those keys skip backwards/forwards within the clip
        carousel.addEventListener('keydown', function (e) {
            if (e.target.tagName === 'VIDEO') return;
            if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(currentIndex() - 1); }
            if (e.key === 'ArrowRight') { e.preventDefault(); goTo(currentIndex() + 1); }
        });

        update();                           // set the starting state (slide 1)
        carousel.classList.add('is-ready'); // switch on the fading (see styles.css)
    });
})();

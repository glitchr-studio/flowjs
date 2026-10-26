// StickyScenes - scenes the scroll drives (1.6). A scene is a section the page
// scrolls through while its stage stays pinned to the screen: as if the reader
// were not scrolling, an object turns, opens, comes in from the side - the
// scroll is the scene's timeline.
//
//   <section class="sticky-scene" data-scene-length="150vh" data-scene-steps="0.3, 0.6">
//       <div class="sticky-scene-stage">…</div>
//   </section>
//
// The section is the stage's height plus its length (`length`: px, "150vh",
// "2rem"...): across that length the stage stays (position: sticky, the
// stylesheet css/scenes.scss), and the scene's progress goes from 0 to 1.
// What the scene says, at each frame its progress changes:
//
//  - CSS: on the section, --scene-progress (0 to 1), --scene-step (the
//    number of steps passed) and --scene-step-progress (0 to 1 inside the
//    current step); data-scene-state "before", "active" or "after", and
//    data-scene-step. A style computes from them: transform:
//    rotateY(calc(var(--scene-progress) * 40deg));
//  - JS: "scene:progress" on the section (it bubbles), detail {progress,
//    step, stepProgress, state, frame};
//  - an image sequence: a <canvas data-scene-sequence="/img/turn-{i}.webp"
//    data-scene-frames="90" data-scene-pad="3"> in the stage is drawn with
//    the frame of the progress (frame 1 to 90; {i} padded to 3 digits), the
//    pictures loaded ahead, the nearest one drawn while one is missing.
//
// With prefers-reduced-motion the scene is its end (the `reduced` option:
// "end" by default, "start", or "live" to keep it moving): progress 1, no
// pinned stage, the section no taller than its stage (data-scene-reduced).
//
// The stops (StickyStops) and the scenes: a scene marked .sticky-stop is a
// stop taller than the screen - the scroll rests at its start and is free
// across it (a stop never pulls the reader out of a scene half-way), and
// with the stops' `screens` the keys scrub it a screen at a time. Put no
// stop inside a scene.
//
// The keyboard (the `keys` option, on by default; data-scene-keys="false"
// leaves the keys to the page): while a scene's stage is pinned, ArrowDown,
// PageDown and Space take it to its next step - the progress where the
// next step begins, then its end - and from its end to the section after it;
// ArrowUp, PageUp and Shift+Space back, step by step, then to the section
// before - and from the top of the section after it, back to its end. Keys in a field, on a widget with keys of its own, with Alt, Ctrl
// or Meta, or already taken by a handler of the page (preventDefault) are
// left alone; the scene listens on the document, before StickyStops (on the
// window), which then leaves the key to it.
//
// Sideways (data-scene-axis="x", the `axis` option): the scene is read by a
// horizontal scroll, the vertical one stays free - the page never waits for
// the scene. Its track ([data-scene-track], else the scene itself) is a
// native overflow-x scroller: a trackpad, Shift+wheel, a finger's swipe and,
// focused, ArrowLeft and ArrowRight (a step at a time; Home, End) move it,
// and its panels' scroll-snap gives the steps. The progress is
// scrollLeft / (scrollWidth - clientWidth); the steps, unless data-scene-steps
// names them, are where the track's panels ([data-scene-panel], else its
// children) begin - a step per panel, data-scene-step 0 on the first. The track is made focusable (tabindex 0, role region,
// its aria-label kept or "Scene"). At the first movement the scene takes
// data-scene-touched, for good: a hint ([data-scene-hint], an arrow that
// blinks, still under reduced motion) is shown until then.
//
// The progress is read in the frame the scroll is heard in (Flow.onScroll),
// and for 400ms after the last scroll event: iOS tells its page's position a
// frame or more late (1.5.4), and a momentum scroll may end with no event.
/**
 * @file StickyScenes, scenes the scroll plays: a section whose stage stays pinned while the page scrolls through it, its progress in CSS and in events - or read sideways, by a horizontal scroll of its track.
 */
/**
 * Told on the scene (it bubbles) at each frame its progress changes: detail {progress, step, stepProgress, state, frame, scene}.
 * @event StickyScenes#scene:progress
 */
/**
 * Told on the scene when a key takes it to a step, or out of it: detail {progress, top, scene} (progress 2: the section after, -1: the one before).
 * @event StickyScenes#scene:key
 */
(function (root, factory) {

    var core = root.Flow && root.Flow.core === true ? root.Flow : (typeof require === 'function' ? require('./core.js') : null);
    if (!core) throw new Error('scenes.js: load core.js first');

    var api = factory(root, core);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.StickyScenes = api;
    core.scenes = api;

})(typeof window !== 'undefined' ? window : this, function (window, Flow) {

    var document = window.document;

    var defaults = {
        selector: '.sticky-scene',
        stage: '.sticky-scene-stage',
        length: '100vh',       // how long the scene lasts, in scroll: px, vh, rem...
        steps: [],             // the progress at which each step begins after the first: [0.3, 0.6]
        reduced: 'end',        // prefers-reduced-motion: 'end', 'start', or 'live'
        tail: 400,             // ms the progress is still read after the last scroll event (late positions, momentum)
        keys: true,            // arrows, page keys and Space step through a pinned scene
        axis: 'y',             // 'x': read by a horizontal scroll of its track
        track: '[data-scene-track]',
        panel: '[data-scene-panel]'
    };

    // Where the keys belong to something else: typing, a widget of its own, Space on what it presses.
    var TYPING = 'input, textarea, select, iframe, [contenteditable]:not([contenteditable="false"])';
    var WIDGET = '[role="slider"], [role="spinbutton"], [role="scrollbar"], [role="tab"], [role="tablist"], [role="menu"], [role="menubar"], [role="menuitem"], [role="listbox"], [role="option"], [role="radiogroup"], [role="radio"], [role="grid"], [role="tree"], [role="textbox"], [role="combobox"], audio, video, [data-scene-track]';
    var PRESSABLE = 'button, a[href], summary, label, [role="button"], [role="link"], [role="checkbox"], [role="switch"]';

    var scenes = [];
    var running = false, until = 0;

    function extend(target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            if (!source) continue;
            for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
        }
        return target;
    }

    function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

    function list(value) {
        if (Array.isArray(value)) return value.map(Number).filter(function (n) { return !isNaN(n); });
        if (typeof value === 'string' && value.trim()) return value.split(',').map(function (n) { return parseFloat(n); }).filter(function (n) { return !isNaN(n); });
        return [];
    }

    /** "150vh", "120svh", "800", "800px", "40rem": in px (a viewport unit of the window's height). */
    function lengthOf(value, el) {
        var text = String(value === undefined || value === null ? '' : value).trim();
        var m = /^(-?[\d.]+)(s|d|l)?vh$/.exec(text);
        if (m) return parseFloat(m[1]) * window.innerHeight / 100;
        return Flow.toPixels(text, el, window.innerHeight);
    }

    function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function Scene(el, options) {
        this.el = el;
        var data = el.dataset;
        this.options = extend({}, defaults, options || {});
        if (data.sceneLength) this.options.length = data.sceneLength;
        if (data.sceneSteps) this.options.steps = data.sceneSteps;
        if (data.sceneReduced && data.sceneReduced !== 'true') this.options.reduced = data.sceneReduced;
        if (data.sceneKeys) this.options.keys = data.sceneKeys !== 'false';
        if (data.sceneAxis) this.options.axis = data.sceneAxis;
        this.horizontal = this.options.axis === 'x';
        this.given = list(this.options.steps).length > 0;
        this.steps = list(this.options.steps).sort(function (a, b) { return a - b; });
        this.stage = el.querySelector(this.options.stage);
        this.last = null;
        this.sequence = null;
        this.aim = null;
        el.classList.add('sticky-scene');
        if (this.horizontal) this.sideways();
        this.measureLength();
        var canvas = el.querySelector('canvas[data-scene-sequence], canvas[data-scene-frames-list]');
        if (canvas) this.sequence = new Sequence(canvas);
        this.update(true);
    }

    Scene.prototype.reduced = function () {
        return this.options.reduced !== 'live' && reducedMotion();
    };

    // ── Sideways: a track the reader scrolls ──
    Scene.prototype.sideways = function () {
        var el = this.el, self = this;
        el.setAttribute('data-scene-axis', 'x');
        var track = el.querySelector(this.options.track) || el;
        this.track = track;
        if (!track.hasAttribute('tabindex')) track.setAttribute('tabindex', '0');
        if (!track.hasAttribute('role')) track.setAttribute('role', 'region');
        if (!track.hasAttribute('aria-label') && !track.hasAttribute('aria-labelledby')) track.setAttribute('aria-label', 'Scene');
        this.onTrack = function () {
            if (!el.hasAttribute('data-scene-touched') && track.scrollLeft > 1) el.setAttribute('data-scene-touched', '');
            self.update(false);
        };
        Flow.onScroll(track, this.onTrack);
        this.onTrackKey = function (e) { self.trackKey(e); };
        track.addEventListener('keydown', this.onTrackKey);
    };

    /** Where the panels begin, as progress (the steps of a sideways scene that names none). */
    Scene.prototype.panelSteps = function () {
        var track = this.track, max = track.scrollWidth - track.clientWidth;
        if (max <= 0) return [];
        var panels = track.querySelectorAll(this.options.panel);
        if (!panels.length) panels = track.children;
        var origin = track.getBoundingClientRect().left - track.scrollLeft;
        var out = [];
        Array.prototype.forEach.call(panels, function (panel) {
            var at = (panel.getBoundingClientRect().left - origin) / max;
            // Each panel after the first is a step - the last one too, which begins at the end of the range.
            if (at > 0.001) out.push(Math.min(1, Math.round(at * 10000) / 10000));
        });
        return out;
    };

    /** The scroll positions of the steps, in order: where each begins, then the end. */
    Scene.prototype.marks = function () {
        return [0].concat(this.steps, [1]);
    };

    Scene.prototype.trackKey = function (e) {
        if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.target !== this.track) return;
        var marks = this.marks(), max = this.track.scrollWidth - this.track.clientWidth;
        var from = this.aim !== null && Flow.now() < this.aimUntil ? this.aim : this.progress();
        var to = null, i;
        if (e.key === 'ArrowRight') { for (i = 0; i < marks.length; i++) if (marks[i] > from + 0.002) { to = marks[i]; break; } }
        else if (e.key === 'ArrowLeft') { for (i = marks.length - 1; i >= 0; i--) if (marks[i] < from - 0.002) { to = marks[i]; break; } }
        else if (e.key === 'Home') to = 0;
        else if (e.key === 'End') to = 1;
        else return;
        e.preventDefault();
        if (to === null) return;
        this.aim = to; this.aimUntil = Flow.now() + 700;
        this.track.scrollTo({ left: Math.round(to * max), behavior: reducedMotion() ? 'auto' : 'smooth' });
    };

    // ── The keys of a pinned scene ──
    Scene.prototype.pinned = function () {
        if (this.horizontal || this.reduced() || !this.stage) return false;
        var box = this.el.getBoundingClientRect();
        var top = parseFloat(getComputedStyle(this.stage).top) || 0;
        var stage = this.stage.getBoundingClientRect().height;
        return box.top <= top + 1 && box.bottom >= top + stage - 1;
    };

    /** The window's scroll position at a progress of the scene. */
    Scene.prototype.scrollAt = function (p) {
        var box = this.el.getBoundingClientRect();
        var top = parseFloat(getComputedStyle(this.stage).top) || 0;
        var run = box.height - this.stage.getBoundingClientRect().height;
        return window.pageYOffset + box.top - top + p * run;
    };

    /** Where a key sends the window: a scroll position, or null (the key is not the scene's). */
    Scene.prototype.keyed = function (e) {
        if (!this.options.keys || e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey || e.isComposing) return null;
        var key = e.key, space = key === ' ' || key === 'Spacebar', direction = 0;
        if (e.shiftKey && !space) return null;
        if (key === 'ArrowDown' || key === 'Down' || key === 'PageDown' || (space && !e.shiftKey)) direction = 1;
        else if (key === 'ArrowUp' || key === 'Up' || key === 'PageUp' || (space && e.shiftKey)) direction = -1;
        if (!direction) return null;
        var target = e.target instanceof Element ? e.target : null;
        if (target && (target.closest(TYPING) || target.closest(WIDGET) || target.closest('dialog[open]'))) return null;
        if (target && space && target.closest(PRESSABLE)) return null;
        // On its way out (a key sent it to a section beside it): the keys are the page's again.
        if (this.leaving && Flow.now() < this.leaving && direction === this.leavingWay) return null;
        var chained = this.aim !== null && Flow.now() < this.aimUntil;
        if (!chained && !this.pinned()) {
            // Just after its end (the section after it read from its top), back up: the scene's end, its last step.
            var bottom0 = this.el.getBoundingClientRect().bottom;
            if (direction < 0 && !this.horizontal && !this.reduced() && this.stage && bottom0 >= -2 && bottom0 <= window.innerHeight / 2) return { progress: 1, top: this.scrollAt(1) };
            return null;
        }
        var p = chained ? this.aim : this.progress(), marks = this.marks(), i;
        if (direction > 0) {
            for (i = 0; i < marks.length; i++) if (marks[i] > p + 0.002) return { progress: marks[i], top: this.scrollAt(marks[i]) };
            // Past its end: the section after it.
            var next = this.el.nextElementSibling;
            var bottom = window.pageYOffset + this.el.getBoundingClientRect().bottom;
            return { progress: 2, top: next ? window.pageYOffset + next.getBoundingClientRect().top : bottom };
        }
        for (i = marks.length - 1; i >= 0; i--) if (marks[i] < p - 0.002) return { progress: marks[i], top: this.scrollAt(marks[i]) };
        // Before its start: the section before it (its last screen when it is taller than one).
        var start = window.pageYOffset + this.el.getBoundingClientRect().top;
        var previous = this.el.previousElementSibling;
        var before = previous ? window.pageYOffset + previous.getBoundingClientRect().top : start - window.innerHeight;
        return { progress: -1, top: Math.max(before, start - window.innerHeight) };
    };

    Scene.prototype.measureLength = function () {
        if (this.horizontal) {
            this.el.toggleAttribute('data-scene-reduced', this.reduced());
            this.el.style.removeProperty('--scene-length');
            if (!this.given) this.steps = this.panelSteps();
            return;
        }
        var reduced = this.reduced();
        this.el.toggleAttribute('data-scene-reduced', reduced);
        var px = lengthOf(this.options.length, this.el);
        this.el.style.setProperty('--scene-length', (reduced ? 0 : Math.max(0, Math.round(px))) + 'px');
    };

    /** The progress (0 to 1) of the scene at the scroll position now. */
    Scene.prototype.progress = function () {
        if (this.reduced()) return this.options.reduced === 'start' ? 0 : 1;
        if (this.horizontal) {
            var max = this.track.scrollWidth - this.track.clientWidth;
            return max > 0 ? clamp(this.track.scrollLeft / max) : 0;
        }
        var box = this.el.getBoundingClientRect();
        var stage = this.stage ? this.stage.getBoundingClientRect().height : window.innerHeight;
        var top = this.stage ? parseFloat(getComputedStyle(this.stage).top) || 0 : 0;
        var run = box.height - stage;
        if (run <= 0) return box.top <= top ? 1 : 0;
        return clamp((top - box.top) / run);
    };

    Scene.prototype.update = function (force) {
        var p = Math.round(this.progress() * 10000) / 10000;
        if (!force && p === this.last) return;
        this.last = p;
        var step = 0;
        for (var i = 0; i < this.steps.length; i++) if (p >= this.steps[i]) step = i + 1;
        var from = step === 0 ? 0 : this.steps[step - 1];
        var to = step < this.steps.length ? this.steps[step] : 1;
        var stepProgress = to > from ? clamp((p - from) / (to - from)) : 1;
        var state = this.reduced() ? 'reduced' : p <= 0 ? 'before' : p >= 1 ? 'after' : 'active';
        var style = this.el.style;
        style.setProperty('--scene-progress', String(p));
        style.setProperty('--scene-step', String(step));
        style.setProperty('--scene-step-progress', String(Math.round(stepProgress * 10000) / 10000));
        this.el.setAttribute('data-scene-state', state);
        this.el.setAttribute('data-scene-step', String(step));
        var frame = this.sequence ? this.sequence.draw(p) : null;
        this.el.dispatchEvent(new CustomEvent('scene:progress', { bubbles: true, detail: { progress: p, step: step, stepProgress: stepProgress, state: state, frame: frame, scene: this } }));
    };

    Scene.prototype.destroy = function () {
        var self = this;
        scenes = scenes.filter(function (s) { return s !== self; });
        if (this.track) { Flow.offScroll(this.track, this.onTrack); this.track.removeEventListener('keydown', this.onTrackKey); }
        ['--scene-progress', '--scene-step', '--scene-step-progress', '--scene-length'].forEach(function (p) { self.el.style.removeProperty(p); });
    };

    // ── An image sequence on a canvas ────────────────────────────────────
    function Sequence(canvas) {
        this.canvas = canvas;
        var data = canvas.dataset;
        var urls = [];
        if (data.sceneFramesList) {
            try { urls = JSON.parse(data.sceneFramesList); } catch (e) { urls = []; }
        } else {
            var count = parseInt(data.sceneFrames, 10) || 1, pad = parseInt(data.scenePad, 10) || 0;
            for (var i = 1; i <= count; i++) {
                var n = String(i);
                while (n.length < pad) n = '0' + n;
                urls.push(data.sceneSequence.replace('{i}', n));
            }
        }
        this.urls = urls;
        this.images = new Array(urls.length);
        this.current = -1;
        this.load(0);
        var self = this;
        // The rest ahead, a few at a time, when the browser is idle.
        var next = 1;
        var later = function (fn) { if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 200 }); else setTimeout(fn, 50); };
        var ahead = function () {
            for (var k = 0; k < 6 && next < urls.length; k++) self.load(next++);
            if (next < urls.length) later(ahead);
        };
        later(ahead);
    }

    Sequence.prototype.load = function (i) {
        if (this.images[i] || !this.urls[i]) return;
        var img = new Image(), self = this;
        img.decoding = 'async';
        img.onload = function () { img.ready = true; if (self.wanted === i) self.paint(i); };
        img.src = this.urls[i];
        this.images[i] = img;
    };

    /** The frame of a progress, drawn (or the nearest one loaded while it is not). */
    Sequence.prototype.draw = function (p) {
        var n = this.urls.length;
        if (!n) return null;
        var i = Math.round(p * (n - 1));
        this.wanted = i;
        this.load(i);
        var shown = i;
        if (!(this.images[i] && this.images[i].ready)) {
            for (var d = 1; d < n; d++) {
                if (this.images[i - d] && this.images[i - d].ready) { shown = i - d; break; }
                if (this.images[i + d] && this.images[i + d].ready) { shown = i + d; break; }
            }
        }
        this.paint(shown);
        return i + 1;
    };

    Sequence.prototype.paint = function (i) {
        var img = this.images[i];
        if (!img || !img.ready || i === this.current) return;
        var c = this.canvas, ctx = c.getContext('2d');
        if (!ctx) return;
        if (c.width !== img.naturalWidth || c.height !== img.naturalHeight) { c.width = img.naturalWidth; c.height = img.naturalHeight; }
        ctx.clearRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0);
        this.current = i;
        c.setAttribute('data-scene-frame', String(i + 1));
    };

    // ── One loop for every scene ─────────────────────────────────────────
    function tick() {
        for (var i = 0; i < scenes.length; i++) scenes[i].update(false);
        if (Flow.now() < until) Flow.frame(tick);
        else running = false;
    }

    function heard() {
        until = Flow.now() + defaults.tail;
        if (!running) { running = true; Flow.frame(tick); }
    }

    // One keydown listener for every scene, on the document (bubble): before
    // StickyStops' on the window, which leaves a key taken here alone.
    function onKeydown(e) {
        for (var i = 0; i < scenes.length; i++) {
            var scene = scenes[i], to = scene.keyed(e);
            if (!to) continue;
            e.preventDefault();
            var inside = to.progress >= 0 && to.progress <= 1;
            scene.aim = inside ? to.progress : null;
            scene.aimUntil = Flow.now() + 700;
            scene.leaving = inside ? 0 : Flow.now() + 700;
            scene.leavingWay = to.progress > 1 ? 1 : -1;
            window.scrollTo({ top: Math.round(to.top), behavior: reducedMotion() ? 'auto' : 'smooth' });
            scene.el.dispatchEvent(new CustomEvent('scene:key', { bubbles: true, detail: { progress: to.progress, top: Math.round(to.top), scene: scene } }));
            return;
        }
    }

    var listening = false;
    function listen() {
        if (listening) return;
        listening = true;
        Flow.onScroll(window, heard);
        document.addEventListener('keydown', onKeydown);
        Flow.onResize(function () { scenes.forEach(function (s) { s.measureLength(); s.update(true); }); });
        if (window.matchMedia) {
            var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
            var changed = function () { scenes.forEach(function (s) { s.measureLength(); s.update(true); }); };
            if (mq.addEventListener) mq.addEventListener('change', changed); else if (mq.addListener) mq.addListener(changed);
        }
    }

    var api = {
        defaults: defaults,
        Scene: Scene,
        /** The scene of an element (made if needed). */
        attach: function (el, options) {
            for (var i = 0; i < scenes.length; i++) if (scenes[i].el === el) return scenes[i];
            listen();
            var scene = new Scene(el, options);
            scenes.push(scene);
            return scene;
        },
        get: function (el) {
            for (var i = 0; i < scenes.length; i++) if (scenes[i].el === el) return scenes[i];
            return null;
        },
        /** Attach every scene of the document (or of an element) not attached yet; forget those gone. */
        scan: function (within) {
            scenes = scenes.filter(function (s) { return s.el.isConnected; });
            Array.prototype.forEach.call((within || document).querySelectorAll(defaults.selector), function (el) { api.attach(el); });
            return scenes.slice();
        },
        /** Measure again (content that moved) and update every scene. */
        refresh: function () {
            scenes.forEach(function (s) { s.measureLength(); s.update(true); });
        },
        all: function () { return scenes.slice(); }
    };

    // On the page as it is parsed, at its load, and on every page the navigation swaps in.
    Flow.onPage(function () { api.scan(); });

    return api;
});

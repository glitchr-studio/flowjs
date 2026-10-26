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
// The progress is read in the frame the scroll is heard in (Flow.onScroll),
// and for 400ms after the last scroll event: iOS tells its page's position a
// frame or more late (1.5.4), and a momentum scroll may end with no event.
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
        tail: 400              // ms the progress is still read after the last scroll event (late positions, momentum)
    };

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
        this.steps = list(this.options.steps).sort(function (a, b) { return a - b; });
        this.stage = el.querySelector(this.options.stage);
        this.last = null;
        this.sequence = null;
        el.classList.add('sticky-scene');
        this.measureLength();
        var canvas = el.querySelector('canvas[data-scene-sequence], canvas[data-scene-frames-list]');
        if (canvas) this.sequence = new Sequence(canvas);
        this.update(true);
    }

    Scene.prototype.reduced = function () {
        return this.options.reduced !== 'live' && reducedMotion();
    };

    Scene.prototype.measureLength = function () {
        var reduced = this.reduced();
        this.el.toggleAttribute('data-scene-reduced', reduced);
        var px = lengthOf(this.options.length, this.el);
        this.el.style.setProperty('--scene-length', (reduced ? 0 : Math.max(0, Math.round(px))) + 'px');
    };

    /** The progress (0 to 1) of the scene at the scroll position now. */
    Scene.prototype.progress = function () {
        if (this.reduced()) return this.options.reduced === 'start' ? 0 : 1;
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

    var listening = false;
    function listen() {
        if (listening) return;
        listening = true;
        Flow.onScroll(window, heard);
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

// StickyStops - scroll stops that act once the scroll has come to rest.
//
// Mark the stops with .sticky-stop, in the page or inside any scrolling
// element. Once a scroll comes to rest - momentum included - the scroller
// glides on to the stop the reader was heading for, or back to the one they
// had barely left:
//
//  - between two stops, heading down: the lower stop - unless the scroll rests
//    inside the upper stop's band below it (data-sticky-band-down), in which
//    case it was a nudge and the page settles back up;
//  - between two stops, heading up: the upper stop - unless inside the lower
//    stop's band above it (data-sticky-band-up), which settles back down. So a
//    band is also the least a scroll must travel before the next stop takes;
//  - past the last stop: free scrolling, from the first pixel, except that a
//    scroll up that rests inside the last stop's band below it goes back to
//    the stop - and so does a scroll down that started above the stop and
//    overshot into that band (a trackpad flick past a stop near the top);
//  - before the first stop: the mirror image.
//
// A band never reaches past halfway to the neighbouring stop, so every stop
// stays reachable however the bands are set. Two stops at the same place are
// one stop. A stop past the end of the scroll (a footer shorter than the
// screen) is at the end of the scroll.
//
// Nothing happens during the scroll. Acting at the first movement fights
// trackpad momentum, which keeps pushing during and after the glide; and the
// browser's own scroll-snap is blind to direction and pulls to the NEAREST
// stop, so a small scroll down from the top jumps straight back up. Here the
// glide is the browser's smooth scroll, which any wheel, touch, key or click
// interrupts, so the reader always keeps control: the stops only complete, or
// undo, a movement the reader started. With prefers-reduced-motion the glide
// is a jump.
//
// Nor does a scroll the browser makes to bring a focused field into view: an
// invalid form submission revealing its first empty field, or Tab. Heading up
// from the text, that scroll was taken for the reader's and carried the page
// on to the stop above - the form gone from the screen it had just asked for.
//
// Progress: with two stops or more, the scroller (the <html> element for the
// page) carries three custom properties - --sticky-stop, the index of the stop
// above the scroll; --sticky-progress, 0 at that stop and 1 at the next; and
// --sticky-progress-held, the same but held at 0 across the upper stop's band
// below it and at 1 across the lower stop's band above it, so that whatever it
// drives does not move for a nudge that will settle back. A sticky:progress
// event on the scroller (it bubbles to the window) carries the same numbers
// for scripts, and a sticky:stop event announces each glide.
//
// Standalone: no jQuery and no sticky.js, and only the window's own scroll
// listener until a stop exists. Attached to the window by itself when the
// document has stops; StickyStops.attach(scroller) for a scrolling element,
// or for stops added after the page loaded. Sticky.stops is the same object
// when sticky.js is loaded.
(function (root, factory) {

    var api = factory(root);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.StickyStops = api;
    if (root.Sticky) root.Sticky.stops = api;

})(typeof window !== 'undefined' ? window : this, function (window) {

    var document = window.document;

    var defaults = {
        selector: '.sticky-stop',
        settle: 160,     // ms of quiet that counts as "at rest": longer than the gap between momentum events
        tolerance: 3,    // px: within this of a stop is at it
        bandUp: 0,       // px, for a stop without data-sticky-band-up
        bandDown: 0,     // px, for a stop without data-sticky-band-down
        progress: true,  // the custom properties and sticky:progress events
        smooth: true     // glide, rather than jump, to a stop
    };

    // The reader taking over ends a glide; the browser has already stopped it.
    var INTERRUPT = ['wheel', 'touchstart', 'keydown', 'mousedown'];

    // ms after a focus change in which a scroll starting is the browser
    // revealing the focused field, not the reader.
    var REVEAL = 250;

    function now() { return window.performance ? performance.now() : Date.now(); }

    function extend(target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            if (!source) continue;
            for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key) && source[key] !== undefined) target[key] = source[key];
            }
        }
        return target;
    }

    function clamp(x, low, high) { return Math.min(high, Math.max(low, x)); }

    // "90", "90px", "2rem" or "1.5em" to px; anything else is the fallback.
    function toPixels(value, el, fallback) {
        if (value === undefined || value === null || value === '') return fallback;
        var text = String(value).trim();
        var number = parseFloat(text);
        if (isNaN(number)) return fallback;
        if (text.slice(-3) === 'rem') return number * parseFloat(getComputedStyle(document.documentElement).fontSize);
        if (text.slice(-2) === 'em') return number * parseFloat(getComputedStyle(el).fontSize);
        return number;
    }

    function reducedMotion() {
        return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }

    function Stops(scroller, options) {
        this.scroller = scroller;
        this.isWindow = scroller === window;
        // Carries the custom properties and dispatches the events.
        this.root = this.isWindow ? document.documentElement : scroller;
        this.options = extend({}, defaults, options);

        this.stops = [];
        this.state = null;
        this.last = this.top();
        // Where the current gesture began: the position before its first event.
        this.start = this.last;
        this.direction = 0;
        this.gliding = false;
        this.paused = 0;
        this.timer = null;
        this.glideTimer = null;
        this.frame = null;
        this.focusedAt = -Infinity;
        this.revealing = false;

        this.onScroll = this.onScroll.bind(this);
        this.onInterrupt = this.onInterrupt.bind(this);
        this.onFocus = this.onFocus.bind(this);
        this.onResize = this.onResize.bind(this);
        this.settle = this.settle.bind(this);
        this.tick = this.tick.bind(this);

        // focusin bubbles, so the scroller hears its own fields; the window
        // does not, so the page's are heard on the document.
        this.focusTarget = this.isWindow ? document : this.scroller;

        this.scroller.addEventListener('scroll', this.onScroll, { passive: true });
        for (var i = 0; i < INTERRUPT.length; i++) {
            this.scroller.addEventListener(INTERRUPT[i], this.onInterrupt, { passive: true });
        }
        this.focusTarget.addEventListener('focusin', this.onFocus, true);
        window.addEventListener('resize', this.onResize);

        this.refresh();
    }

    Stops.prototype.detach = function () {
        this.scroller.removeEventListener('scroll', this.onScroll);
        for (var i = 0; i < INTERRUPT.length; i++) {
            this.scroller.removeEventListener(INTERRUPT[i], this.onInterrupt);
        }
        this.focusTarget.removeEventListener('focusin', this.onFocus, true);
        window.removeEventListener('resize', this.onResize);
        clearTimeout(this.timer);
        clearTimeout(this.glideTimer);
        if (this.frame !== null) cancelAnimationFrame(this.frame);

        var style = this.root.style;
        style.removeProperty('--sticky-stop');
        style.removeProperty('--sticky-progress');
        style.removeProperty('--sticky-progress-held');

        var at = instances.indexOf(this);
        if (at !== -1) instances.splice(at, 1);
        return this;
    };

    /** Hold the stops off, e.g. while a script scrolls the page itself. Nests. */
    Stops.prototype.pause = function () { this.paused++; return this; };
    Stops.prototype.resume = function () { this.paused = Math.max(0, this.paused - 1); return this; };

    Stops.prototype.top = function () {
        return this.isWindow ? (window.scrollY || window.pageYOffset || 0) : this.scroller.scrollTop;
    };

    /** The furthest the scroller can scroll. */
    Stops.prototype.max = function () {
        return Math.max(0, this.isWindow
            ? document.documentElement.scrollHeight - window.innerHeight
            : this.scroller.scrollHeight - this.scroller.clientHeight);
    };

    /** The scroller's scroll-padding-top: where a stop should rest below its edge. */
    Stops.prototype.padding = function () {
        var value = parseFloat(getComputedStyle(this.root).scrollPaddingTop);
        return isNaN(value) ? 0 : value;
    };

    /** A stop's scroll position: where it is on screen now, not its layout box. */
    Stops.prototype.position = function (el) {
        var origin = this.isWindow ? 0 : this.scroller.getBoundingClientRect().top;
        return el.getBoundingClientRect().top - origin + this.top() - this.padding();
    };

    Stops.prototype.measure = function () {
        var options = this.options;
        var elements = this.root.querySelectorAll(options.selector);
        var max = this.max();
        var stops = [];
        var i;

        for (i = 0; i < elements.length; i++) {
            var el = elements[i];
            if (!el.getClientRects().length) continue; // display: none
            stops.push({
                element: el,
                // A stop the scroll cannot bring to the top (a footer shorter
                // than the screen) rests where the scroll ends. Taken as out
                // of reach, it made every scroll up from the very bottom -
                // Safari's bounce included - glide away to the stop above.
                top: Math.min(Math.round(this.position(el)), max),
                bandUp: Math.max(0, toPixels(el.dataset.stickyBandUp, el, options.bandUp)),
                bandDown: Math.max(0, toPixels(el.dataset.stickyBandDown, el, options.bandDown))
            });
        }
        stops.sort(function (a, b) { return a.top - b.top; });

        // Two stops at the same place are one stop.
        var unique = [];
        for (i = 0; i < stops.length; i++) {
            if (unique.length && stops[i].top - unique[unique.length - 1].top <= options.tolerance) continue;
            unique.push(stops[i]);
        }

        // A band reaches at most halfway to the neighbouring stop, so both
        // stay reachable however the bands are set.
        for (i = 0; i < unique.length; i++) {
            if (i > 0) unique[i].bandUp = Math.min(unique[i].bandUp, (unique[i].top - unique[i - 1].top) / 2);
            if (i < unique.length - 1) unique[i].bandDown = Math.min(unique[i].bandDown, (unique[i + 1].top - unique[i].top) / 2);
        }

        this.stops = unique;
        return unique;
    };

    Stops.prototype.glide = function (stop) {
        var behavior = this.options.smooth && !reducedMotion() ? 'smooth' : 'auto';

        this.gliding = true;
        // A stop the scroller cannot reach (past its end) fires no scroll
        // event: do not stay "gliding" waiting for one.
        clearTimeout(this.glideTimer);
        this.glideTimer = setTimeout(this.onInterrupt, 2 * this.options.settle);

        this.root.dispatchEvent(new CustomEvent('sticky:stop', {
            bubbles: true,
            detail: { scroller: this.scroller, stop: stop.element, top: stop.top }
        }));
        this.scroller.scrollTo({ top: stop.top, behavior: behavior });
    };

    Stops.prototype.settle = function () {
        this.timer = null;

        // A glide of ours has just arrived (or been interrupted): let go.
        if (this.gliding) {
            this.gliding = false;
            return;
        }
        // The browser bringing a focused field into view: it rests where the
        // field is, wherever that falls between the stops.
        if (this.revealing) {
            this.revealing = false;
            return;
        }
        if (this.paused || api.paused) return;

        var stops = this.measure();
        if (!stops.length) return;

        var tolerance = this.options.tolerance;
        var y = this.top();
        var direction = this.direction;
        var from = this.start;
        var i;

        // At a stop already: nothing to finish.
        for (i = 0; i < stops.length; i++) {
            if (Math.abs(y - stops[i].top) <= tolerance) return;
        }

        var first = stops[0];
        var last = stops[stops.length - 1];

        // Before the first stop: inside its band above it, heading down - or
        // an overshoot from below - goes to the stop. Otherwise free.
        if (y < first.top) {
            var overshotUp = from > first.top + tolerance;
            if (y > first.top - first.bandUp && (direction > 0 || overshotUp)) this.glide(first);
            return;
        }

        // Past the last stop: inside its band below it, heading up - or an
        // overshoot from above - goes back to the stop. Otherwise free.
        if (y > last.top) {
            var overshotDown = from < last.top - tolerance;
            if (y < last.top + last.bandDown && (direction < 0 || overshotDown)) this.glide(last);
            return;
        }

        // Between two stops: on to the one the reader was heading for, unless
        // the scroll barely left the other, in which case back to it.
        for (i = 0; i < stops.length - 1; i++) {
            var upper = stops[i];
            var lower = stops[i + 1];
            if (y <= upper.top || y >= lower.top) continue;

            if (direction > 0) this.glide(y < upper.top + upper.bandDown ? upper : lower);
            else if (direction < 0) this.glide(y > lower.top - lower.bandUp ? lower : upper);
            return;
        }
    };

    Stops.prototype.onScroll = function () {
        var y = this.top();
        var step = y > this.last ? 1 : (y < this.last ? -1 : 0);

        clearTimeout(this.glideTimer);

        // The first event after a rest starts a new gesture.
        if (this.timer === null && !this.gliding) {
            this.start = this.last;
            this.revealing = now() - this.focusedAt < REVEAL;
        }
        this.last = y;

        // Which way the READER is going, not our own glide.
        if (!this.gliding && step) this.direction = step;

        clearTimeout(this.timer);
        this.timer = setTimeout(this.settle, this.options.settle);

        if (this.options.progress) this.queue();
    };

    Stops.prototype.onInterrupt = function () {
        this.gliding = false;
    };

    Stops.prototype.onFocus = function () {
        this.focusedAt = now();
    };

    Stops.prototype.onResize = function () {
        this.refresh();
    };

    /** Re-measure the stops and report the progress. For content that moved. */
    Stops.prototype.refresh = function () {
        this.measure();
        if (this.options.progress) this.progress();
        return this;
    };

    Stops.prototype.queue = function () {
        if (this.frame !== null) return;
        this.frame = requestAnimationFrame(this.tick);
    };

    Stops.prototype.tick = function () {
        this.frame = null;
        this.progress();
    };

    /**
     * Where the scroll is between its two nearest stops: {index, from, to,
     * top, progress, held}, also written to the custom properties and sent as
     * sticky:progress when it changed. null with fewer than two stops.
     */
    Stops.prototype.progress = function () {
        var stops = this.measure();
        var style = this.root.style;

        if (stops.length < 2) {
            if (this.state) {
                style.removeProperty('--sticky-stop');
                style.removeProperty('--sticky-progress');
                style.removeProperty('--sticky-progress-held');
            }
            this.state = null;
            return null;
        }

        var y = this.top();
        var i = 0;
        while (i < stops.length - 2 && y >= stops[i + 1].top) i++;

        var upper = stops[i];
        var lower = stops[i + 1];
        var progress = clamp((y - upper.top) / (lower.top - upper.top), 0, 1);

        // Held across the bands: still until the scroll has cleared them.
        var a = upper.top + upper.bandDown;
        var b = lower.top - lower.bandUp;
        var held = b > a ? clamp((y - a) / (b - a), 0, 1) : (y < b ? 0 : 1);

        var previous = this.state;
        var state = {
            scroller: this.scroller,
            index: i,
            from: upper.element,
            to: lower.element,
            top: y,
            progress: progress,
            held: held
        };
        this.state = state;

        if (previous && previous.index === i && previous.progress === progress && previous.held === held) return state;

        style.setProperty('--sticky-stop', String(i));
        style.setProperty('--sticky-progress', progress.toFixed(4));
        style.setProperty('--sticky-progress-held', held.toFixed(4));
        this.root.dispatchEvent(new CustomEvent('sticky:progress', { bubbles: true, detail: state }));

        return state;
    };

    var instances = [];

    function normalize(scroller) {
        if (!scroller || scroller === document || scroller === document.documentElement || scroller === document.body) return window;
        return scroller;
    }

    var api = {
        defaults: defaults,
        Stops: Stops,
        paused: 0,

        /** The stops of a scroller (the window by default); made if needed. */
        attach: function (scroller, options) {
            scroller = normalize(scroller);
            var found = api.get(scroller);
            if (found) {
                if (options) extend(found.options, options);
                return found.refresh();
            }
            var made = new Stops(scroller, options);
            instances.push(made);
            return made;
        },

        get: function (scroller) {
            scroller = normalize(scroller);
            for (var i = 0; i < instances.length; i++) {
                if (instances[i].scroller === scroller) return instances[i];
            }
            return null;
        },

        /** Hold every scroller's stops off, e.g. while a script scrolls the page. Nests. */
        pause: function () { api.paused++; return api; },
        resume: function () { api.paused = Math.max(0, api.paused - 1); return api; },

        refresh: function () {
            for (var i = 0; i < instances.length; i++) instances[i].refresh();
            return api;
        }
    };

    // The page's own stops, without being asked - and again on load, for a
    // page swapped in place that re-dispatches it.
    function auto() {
        if (document.querySelector(defaults.selector)) api.attach(window);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', auto);
    else auto();
    window.addEventListener('load', auto);

    return api;
});

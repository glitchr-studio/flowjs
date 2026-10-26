// FlowFrame - a website in the website: a frame of the page whose links and
// forms load their page in the background and swap it into the frame alone,
// the visitor's page staying where it is (1.6). Part of the navigation entry
// (Transparent.frame is the same object), with no jQuery.
//
//   <div data-flow-frame="tour" data-flow-frame-src="/tour/start">
//       <form data-flow-frame-go><button data-flow-frame-back>←</button>
//           <button data-flow-frame-forward>→</button>
//           <input data-flow-frame-address aria-label="Address"></form>
//       <div data-flow-frame-view>…the first page's block…</div>
//   </div>
//
// A link (same origin, no target, no download, not held with a modifier)
// or a form inside the view is fetched, the block of the answer that the
// `select` option names ([data-flow-frame-page] by default; the whole body
// without one) swapped into the view, its scroll put back to the top. The
// frame keeps its own history: its back and forward buttons go through the
// pages it showed (given back from memory, where their scroll was left), the
// address field says the frame's page and takes another. The window's history
// is not touched: the browser's Back leaves the page that holds the frame,
// as it would leave any page - the frame is a part of the page, not a tab.
//
// The click is the frame's: Transparent, whose listener is the document's,
// never hears it. Scripts in a page shown in a frame are not run, and its
// head is not read (its styles are the host page's): a frame shows pages
// written for it, or pages of the same site. "flow:frame:load" is dispatched
// on the frame (it bubbles) with {url, title, frame} after each page, the
// moment for the host page's script to set up what it holds;
// "flow:frame:error" with {url, status} when no page came.
//
// While a page takes longer than `delay` (200ms), the frame carries
// .flow-frame-loading - on the progress bar's timing, never a blink.
/**
 * @file FlowFrame, a website in the website: a frame of the page whose links and forms load their page into the frame alone, with its own history and address.
 */
/**
 * Told on the frame (it bubbles) after each page it shows: detail {url, title, frame}.
 * @event FlowFrame#flow:frame:load
 */
/**
 * Told on the frame when no page came: detail {url, status}.
 * @event FlowFrame#flow:frame:error
 */
(function (root, factory) {

    var core = root.Flow && root.Flow.core === true ? root.Flow : (typeof require === 'function' ? require('./core.js') : null);
    if (!core) throw new Error('frame.js: load core.js first');

    var api = factory(root, core);
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.FlowFrame = api;
    core.frames = api;   // not core.frame: that is the core's own animation frame
    if (root.Transparent) root.Transparent.frame = api;

})(typeof window !== 'undefined' ? window : this, function (window, Flow) {

    var document = window.document;

    var defaults = {
        select: '[data-flow-frame-page]', // the block of a fetched page shown in the frame; the body without it
        src: null,                         // the first page's address (data-flow-frame-src; the frame's content as written)
        delay: 200,                        // ms before .flow-frame-loading shows a load
        min: 300,                          // ms .flow-frame-loading stays once shown
        headers: { 'X-Flow-Frame': '1' }   // sent with each request, for a server that answers a frame differently
    };

    var frames = [];

    function extend(target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];
            if (!source) continue;
            for (var key in source) if (Object.prototype.hasOwnProperty.call(source, key)) target[key] = source[key];
        }
        return target;
    }

    function Frame(root, options) {
        this.root = root;
        this.options = extend({}, defaults, options || {});
        this.name = root.getAttribute('data-flow-frame') || '';
        this.view = root.querySelector('[data-flow-frame-view]') || root;
        this.stack = [];
        this.index = -1;
        this.cache = {};
        this.request = 0;
        var first = this.options.src || root.getAttribute('data-flow-frame-src') || window.location.href;
        this.stack.push({ url: new URL(first, window.location.href).href, title: this.titleOf(this.view), scroll: 0 });
        this.index = 0;
        this.cache[this.stack[0].url] = this.view.innerHTML;
        var self = this;
        this.onClick = function (event) { self.click(event); };
        this.onSubmit = function (event) { self.submit(event); };
        root.addEventListener('click', this.onClick);
        root.addEventListener('submit', this.onSubmit);
        root.classList.add('flow-frame');
        this.chrome();
    }

    Frame.prototype.titleOf = function (el) {
        var h = el && el.querySelector && el.querySelector('[data-flow-frame-title], h1');
        return h ? h.textContent.trim() : '';
    };

    Frame.prototype.current = function () { return this.stack[this.index]; };

    /** A link or a button of the frame: its chrome's buttons, a page's links. */
    Frame.prototype.click = function (event) {
        var target = event.target.closest ? event.target : event.target.parentElement;
        if (!target) return;
        var control = target.closest('[data-flow-frame-back], [data-flow-frame-forward], [data-flow-frame-reload]');
        if (control && this.root.contains(control)) {
            event.preventDefault();
            event.stopPropagation();
            if (control.hasAttribute('data-flow-frame-back')) this.back();
            else if (control.hasAttribute('data-flow-frame-forward')) this.forward();
            else this.reload();
            return;
        }
        // A form's button: the browser's submit comes to the frame (submit()); the document's listeners
        // (Transparent submits forms from their buttons' clicks) must not take the click first.
        var button = target.closest('button, input[type="submit"], input[type="image"]');
        if (button && button.form && this.root.contains(button.form) && (!button.type || button.type === 'submit' || button.type === 'image')) {
            event.stopPropagation();
            return;
        }
        var link = target.closest('a[href]');
        if (!link || !this.view.contains(link)) return;
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        if (link.hasAttribute('download') || (link.target && link.target !== '_self') || link.hasAttribute('data-flow-frame-ignore')) return;
        var url = new URL(link.getAttribute('href'), this.current().url);
        if (url.origin !== window.location.origin) return;
        // Neither the document's listeners (Transparent) nor the browser follow it: the frame does.
        event.preventDefault();
        event.stopPropagation();
        var here = new URL(this.current().url);
        if (url.hash && url.pathname === here.pathname && url.search === here.search) {
            var anchor = this.view.querySelector('[id="' + decodeURIComponent(url.hash.slice(1)).replace(/"/g, '\\"') + '"]');
            if (anchor) anchor.scrollIntoView({ block: 'start' });
            return;
        }
        this.go(url.href);
    };

    /** A form of a page in the frame, or the address field's. */
    Frame.prototype.submit = function (event) {
        var form = event.target;
        if (!form || form.tagName !== 'FORM' || event.defaultPrevented) return;
        if (form.hasAttribute('data-flow-frame-go')) {
            event.preventDefault();
            event.stopPropagation();
            var field = form.querySelector('[data-flow-frame-address]');
            if (!field || !field.value.trim()) return;
            var typed = new URL(field.value.trim(), this.current().url);
            if (typed.origin === window.location.origin) this.go(typed.href);
            return;
        }
        if (!this.view.contains(form) || (form.target && form.target !== '_self')) return;
        var action = new URL(form.getAttribute('action') || this.current().url, this.current().url);
        if (action.origin !== window.location.origin) return;
        event.preventDefault();
        event.stopPropagation();
        var method = (form.getAttribute('method') || 'get').toUpperCase();
        var data = new FormData(form);
        if (event.submitter && event.submitter.name) data.append(event.submitter.name, event.submitter.value);
        if (method === 'GET') {
            action.search = new URLSearchParams(data).toString();
            this.go(action.href);
        } else {
            this.go(action.href, { method: method, body: data });
        }
    };

    /** Show a page in the frame: fetched, its block swapped in, the frame's history moved on. */
    Frame.prototype.go = function (url, init, how) {
        var self = this;
        how = how || 'push';
        var mine = ++this.request;
        var loading = this.loading();
        var request = extend({ headers: extend({ Accept: 'text/html' }, this.options.headers), credentials: 'same-origin' }, init || {});
        return window.fetch(url, request).then(function (response) {
            return response.text().then(function (text) { return { response: response, text: text }; });
        }).then(function (got) {
            if (mine !== self.request) return;
            var page = self.extract(got.text);
            if (page === null) {
                loading();
                self.root.dispatchEvent(new CustomEvent('flow:frame:error', { bubbles: true, detail: { url: url, status: got.response.status } }));
                return;
            }
            var landed = got.response.url || url;
            if (how === 'push') {
                self.current().scroll = self.view.scrollTop;
                self.stack = self.stack.slice(0, self.index + 1);
                self.stack.push({ url: landed, title: '', scroll: 0 });
                self.index = self.stack.length - 1;
            } else if (how === 'replace') {
                self.current().url = landed;
            }
            if (!request.method || request.method === 'GET') self.cache[landed] = page;
            self.show(page, how === 'push' ? 0 : self.current().scroll);
            loading();
        }, function () {
            if (mine !== self.request) return;
            loading();
            self.root.dispatchEvent(new CustomEvent('flow:frame:error', { bubbles: true, detail: { url: url, status: 0 } }));
        });
    };

    /** The block of a page the frame shows, or null for an answer that has none to show. */
    Frame.prototype.extract = function (text) {
        var doc = new DOMParser().parseFromString(text, 'text/html');
        var block = this.options.select ? doc.querySelector(this.options.select) : null;
        var from = block || doc.body;
        if (!from) return null;
        // The frame runs no script of the page it shows.
        Array.prototype.forEach.call(from.querySelectorAll('script'), function (s) { s.remove(); });
        return from.innerHTML;
    };

    Frame.prototype.show = function (html, scroll) {
        this.view.innerHTML = html;
        this.current().title = this.titleOf(this.view);
        this.view.scrollTop = scroll || 0;
        this.chrome();
        this.root.dispatchEvent(new CustomEvent('flow:frame:load', { bubbles: true, detail: { url: this.current().url, title: this.current().title, frame: this } }));
    };

    /** Back and forward: from memory, where the page's scroll was left; fetched again when it is not there. */
    Frame.prototype.travel = function (delta) {
        var to = this.index + delta;
        if (to < 0 || to >= this.stack.length) return;
        this.current().scroll = this.view.scrollTop;
        this.index = to;
        var entry = this.current();
        if (this.cache[entry.url] !== undefined) this.show(this.cache[entry.url], entry.scroll);
        else this.go(entry.url, null, 'travel');
    };
    Frame.prototype.back = function () { this.travel(-1); };
    Frame.prototype.forward = function () { this.travel(1); };
    Frame.prototype.reload = function () { delete this.cache[this.current().url]; this.go(this.current().url, null, 'replace'); };

    /** The chrome: the address field says the frame's page, the buttons what they can do. */
    Frame.prototype.chrome = function () {
        var entry = this.current();
        var url = new URL(entry.url);
        var shown = url.origin === window.location.origin ? url.pathname + url.search + url.hash : url.href;
        Array.prototype.forEach.call(this.root.querySelectorAll('[data-flow-frame-address]'), function (el) {
            if ('value' in el && el.tagName !== 'OUTPUT') { if (document.activeElement !== el) el.value = shown; } else el.textContent = shown;
        });
        var back = this.index > 0, forward = this.index < this.stack.length - 1;
        Array.prototype.forEach.call(this.root.querySelectorAll('[data-flow-frame-back]'), function (b) { b.disabled = !back; });
        Array.prototype.forEach.call(this.root.querySelectorAll('[data-flow-frame-forward]'), function (b) { b.disabled = !forward; });
        this.root.setAttribute('data-flow-frame-url', shown);
    };

    /** .flow-frame-loading on the progress bar's timing: after `delay`, at least `min`. The function ends it. */
    Frame.prototype.loading = function () {
        var root = this.root, delay = +this.options.delay || 0, min = +this.options.min || 0;
        var shownAt = 0, ended = false;
        var timer = setTimeout(function () { if (!ended) { shownAt = Date.now(); root.classList.add('flow-frame-loading'); } }, delay);
        return function () {
            ended = true;
            clearTimeout(timer);
            if (!shownAt) return;
            setTimeout(function () { root.classList.remove('flow-frame-loading'); }, Math.max(0, min - (Date.now() - shownAt)));
        };
    };

    Frame.prototype.destroy = function () {
        this.root.removeEventListener('click', this.onClick);
        this.root.removeEventListener('submit', this.onSubmit);
        this.root.classList.remove('flow-frame', 'flow-frame-loading');
        frames = frames.filter(function (f) { return f !== this; }, this);
    };

    var api = {
        defaults: defaults,
        Frame: Frame,
        /** The frame of an element (made if needed). */
        attach: function (root, options) {
            for (var i = 0; i < frames.length; i++) if (frames[i].root === root) return frames[i];
            var frame = new Frame(root, options);
            frames.push(frame);
            return frame;
        },
        get: function (root) {
            for (var i = 0; i < frames.length; i++) if (frames[i].root === root) return frames[i];
            return null;
        },
        /** Attach every [data-flow-frame] of the document (or of an element) not attached yet. */
        scan: function (within) {
            frames = frames.filter(function (f) { return f.root.isConnected; });
            Array.prototype.forEach.call((within || document).querySelectorAll('[data-flow-frame]'), function (el) { api.attach(el); });
            return frames.slice();
        }
    };

    // On load, and on each page the navigation swaps in.
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { api.scan(); });
    else api.scan();
    window.addEventListener('transparent:load', function () { api.scan(); });

    return api;
});

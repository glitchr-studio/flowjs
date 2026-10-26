/*
 * The flowjs website's own script: Flow started for the whole site (the navigation, the header that
 * steps aside, the page's stops, the demonstration consent panel), then each page's demonstrations set
 * up - at the first load and after every page Transparent swaps in (transparent:load). No dependency
 * but Flow's own modules (src/js, loaded before this file) and jQuery for the navigation.
 */
(function () {
    'use strict';

    var swaps = 0;
    var state = { cookie: false };

    function $(selector, root) { return (root || document).querySelector(selector); }
    function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }

    // ---- once, for the whole site --------------------------------------------------------

    function boot() {
        // The header steps aside on the way down (.sticky-top); the address is omnidocs' to keep on the
        // manual, so Sticky leaves it alone.
        // The address follows the section read on the showcase (its sections are .sticky-headlines); on the
        // manual it is omnidocs' table of contents that keeps it (page()).
        if (window.Sticky) Sticky.ready({ scrollhide: true, replacehash: !!document.querySelector('main.home'), scrollsnap: false, autoscroll: false, swipe: false });
        // The showcase's sections are stops: the arrows and Space go from one to the next, a tall one is
        // read a screen at a time, and going back up is free.
        if (window.StickyStops) StickyStops.attach(window, { keys: true, screens: true, up: false, reach: '40vh' });
        if (window.Transparent) {
            Transparent.ready({ identifier: '#page', exceptions: ['*.json', '*.xml'], prefetch: true, smoothscroll_duration: '150ms' });
        }
        cookie();
    }

    // The demonstration consent panel, as omnibase/consent shows it on a real site: a cookie button
    // (in the corner of every page, and one in the Cookie station) opening the floating panel - the
    // library's banner, two places for it in a page (templates/site/_consent.html.twig). Not opened by
    // itself; "See it as a first visitor" forgets the answer and asks again, with the countdown when
    // it is ticked. Nothing of this site is kept: the answer under its own name, in this browser.
    function cookie() {
        if (!window.Cookie || state.cookie) return;
        state.cookie = true;
        Cookie.ready({
            autoOpen: false,
            bare: false,
            position: 'bottom-left',
            record: { name: 'flow-demo-consent', store: 'local', lifetime: '30d' },
            countdown: false,
            categories: {
                necessary: { label: 'The site itself', required: true, description: 'Nothing is kept: a static site, served as files.' },
                demo: { label: 'A demonstration feature', description: 'Lights the dot of the Cookie station, and nothing else.', features: ['demo-dot'] }
            },
            texts: {
                label: 'Cookies', title: 'Cookies, your choice',
                text: 'A demonstration of a real site\'s consent panel: Flow keeps your answer in this browser only.',
                accept: 'Accept', refuse: 'Refuse', customize: 'Customize',
                detailsTitle: 'Your choices', acceptAll: 'Accept all', refuseAll: 'Refuse all',
                save: 'Save', close: 'Close', required: 'Always on',
                countdown: 'No answer: refused in {count} s.'
            }
        });
        Cookie.use('demo', function () { show(); }, function () { show(); });
        Cookie.onConsent(function (detail) { if (detail && detail.source !== 'api') { Cookie.configure({ autoOpen: false }); floating(false); } show(); });
        window.addEventListener('cookie:open', expanded);
        window.addEventListener('cookie:close', function () { Cookie.configure({ autoOpen: false }); floating(false); expanded(); });
    }

    // The demo's placement: the selected position, the gutter, and the corner button moved to that corner
    // when the panel follows it.
    function where() {
        if (!window.Cookie) return;
        var select = $('[data-cookie-demo-position]');
        var gutter = $('[data-cookie-demo-gutter]');
        var follow = $('[data-cookie-demo-follow]');
        var corner = $('[data-fc="corner"]');
        var position = select ? select.value : 'bottom-left';
        var px = gutter ? +gutter.value : 16;
        var out = $('[data-cookie-demo-gutter-out]');
        if (out) out.textContent = px + 'px';
        var following = !!(follow && follow.checked);
        if (corner) {
            corner.setAttribute('data-corner', following ? position : 'bottom-left');
            corner.style.setProperty('--fc-gutter', px + 'px');
        }
        Cookie.configure({ position: position, gutter: px, follow: following ? '.fc.is-corner .fc-button' : null });
        var banner = Cookie.banner();
        if (banner && !banner.hidden) Cookie.open(Cookie.pending() ? 'banner' : 'details');
    }

    // The panel floats at the bottom of the screen while a first visitor is asked (omnibase/consent's
    // is-floating), else it opens over the button pressed.
    function floating(on) {
        $$('[data-fc]').forEach(function (place) { place.classList.toggle('is-floating', !!on && place.contains(Cookie.banner())); });
    }

    function expanded() {
        var banner = window.Cookie && Cookie.banner();
        var open = !!banner && !banner.hidden;
        $$('[data-fc]').forEach(function (place) {
            var button = $('[data-fc-toggle]', place);
            if (button) button.setAttribute('aria-expanded', String(open && place.contains(banner)));
        });
    }

    function show() {
        var out = $('[data-cookie-demo-state]');
        var dot = $('[data-cookie-demo-dot]');
        var answered = !!(window.Cookie && Cookie.answered && Cookie.answered());
        var on = answered && Cookie.granted('demo');
        if (dot) dot.classList.toggle('is-on', on);
        if (!out) return;
        out.textContent = answered ? 'the demonstration feature is ' + (on ? 'granted' : 'refused') : 'none yet';
        out.dataset.answer = answered ? (on ? 'granted' : 'refused') : '';
    }

    // ---- each page ------------------------------------------------------------------------

    function page() {
        // The header's current page: Transparent swaps #page, not the header.
        $$('.site-nav a').forEach(function (a) {
            var here = a.pathname.replace(/\/$/, '') === location.pathname.replace(/\/$/, '');
            if (here) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
        });
        if (window.Sticky && Sticky.set) Sticky.set('replacehash', !!$('main.home'));
        stops();
        navigation();
        bar();
        scene();
        sortable();
        tree();
        ajaxer();
        stickyButton();
        cookieButtons();
        copy();
    }

    function stops() {
        var scroller = $('[data-stops-scroller]');
        if (!scroller || scroller.dataset.ready || !window.StickyStops) return;
        scroller.dataset.ready = '1';
        StickyStops.attach(scroller, { keys: true, screens: true, duration: 600, reach: 200 });
        var out = $('[data-stops-state]');
        scroller.addEventListener('sticky:progress', function (e) {
            if (out && e.detail) out.textContent = 'stop ' + Math.min(5, e.detail.index + (e.detail.progress >= 0.5 ? 2 : 1)) + ' of 5';
        });
        if (window.StickyStops.scan) StickyStops.scan();
    }

    // The progress bar: its look switched (a class of <html> setting its custom properties), its timing shown
    // on a load the button makes (html.loading for a while: the bar's own logic decides, as for a navigation).
    function bar() {
        var card = $('[data-demo="bar"]');
        if (!card || card.dataset.ready) return;
        card.dataset.ready = '1';
        var root = document.documentElement;
        var out = $('[data-bar-timeline]', card);
        $$('[data-bar-look]', card).forEach(function (button) {
            var rainbow = button.dataset.barLook === 'rainbow';
            button.setAttribute('aria-pressed', String(rainbow === root.classList.contains('bar-rainbow')));
            button.addEventListener('click', function () {
                root.classList.toggle('bar-rainbow', rainbow);
                $$('[data-bar-look]', card).forEach(function (b) { b.setAttribute('aria-pressed', String(b === button)); });
            });
        });
        $$('[data-bar-load]', card).forEach(function (button) {
            button.addEventListener('click', function () {
                var ms = +button.dataset.barLoad, t0 = performance.now(), steps = ['0ms load starts'];
                var say = function () { out.textContent = steps.join(' · '); };
                var told = function (e) { steps.push(Math.round(performance.now() - t0) + 'ms bar ' + e.detail.state); say(); if (e.detail.state === 'hidden') window.removeEventListener('transparent:progress', told); };
                window.addEventListener('transparent:progress', told);
                root.classList.add('loading');
                say();
                setTimeout(function () {
                    root.classList.remove('loading');
                    steps.push(ms + 'ms load ends');
                    say();
                    setTimeout(function () {
                        if (steps.length === 2) { steps.push('no bar at all: under the delay'); say(); window.removeEventListener('transparent:progress', told); }
                    }, 300);
                }, ms);
            });
        });
    }

    // The sideways scene's meter: what scene:progress says.
    function scene() {
        var section = $('.scene-x.sticky-scene');
        var meter = $('[data-scene-meter]');
        if (!section || !meter || section.dataset.meter) return;
        section.dataset.meter = '1';
        section.addEventListener('scene:progress', function (e) {
            meter.textContent = 'progress ' + e.detail.progress.toFixed(2) + ' · step ' + (e.detail.step + 1) + ' of 3' + (e.detail.state === 'reduced' ? ' · reduced motion: its end' : '');
        });
        if (window.StickyScenes) { StickyScenes.scan(); var s = StickyScenes.get(section); if (s) { s.refresh ? s.refresh() : s.measureLength(); s.update(true); } }
    }

    function navigation() {
        var loads = $('[data-nav-loads]');
        var count = $('[data-nav-swaps]');
        if (loads) loads.textContent = '1';
        if (count) count.textContent = String(swaps);
        frame();
    }

    // The website in the website: the pages seen in the frame, this document loaded once, the page's
    // scroll where it was - the frame moves, the page does not.
    function frame() {
        var box = $('[data-flow-frame="tour"]');
        if (!box || box.dataset.counted) return;
        box.dataset.counted = '1';
        var pages = 1, y = null;
        var seen = $('[data-frame-pages]'), scroll = $('[data-frame-scroll]');
        box.addEventListener('click', function () { y = window.scrollY; }, true);
        box.addEventListener('submit', function () { y = window.scrollY; }, true);
        box.addEventListener('flow:frame:load', function () {
            pages++;
            if (seen) seen.textContent = String(pages);
            if (scroll && y !== null) scroll.textContent = Math.abs(window.scrollY - y) < 2 ? 'did not move' : 'moved by ' + Math.round(window.scrollY - y) + 'px';
        });
    }

    // A slow page for the frame: the Journal's answer held 1.6 s (a static host answers at once), long
    // enough to see the frame's loading bar. Only the frame's requests (X-Flow-Frame), only that page.
    if (window.fetch && !window.fetch.flowSlow) {
        var fetch = window.fetch;
        window.fetch = function (input, init) {
            var url = typeof input === 'string' ? input : (input && input.url) || '';
            var framed = init && init.headers && (init.headers['X-Flow-Frame'] || (init.headers.get && init.headers.get('X-Flow-Frame')));
            var answer = fetch.apply(this, arguments);
            if (!framed || !/\/demo\/frame\/journal\//.test(url)) return answer;
            return answer.then(function (response) { return new Promise(function (resolve) { setTimeout(function () { resolve(response); }, 1600); }); });
        };
        window.fetch.flowSlow = true;
    }

    function sortable() {
        var list = $('[data-sortable-list]');
        if (!list || list.dataset.ready || !window.StickySortable) return;
        list.dataset.ready = '1';
        var out = $('[data-sortable-order]');
        new StickySortable(list, {
            handle: '.grip',
            onChange: function (order) {
                if (out) out.textContent = order.map(function (item) { return item.textContent.replace('⠿', '').trim(); }).join(', ');
            }
        });
    }

    // The tree: chapters and their sections, the serialized tree shown as it changes.
    function tree() {
        var root = $('[data-sortable-tree]');
        if (!root || root.dataset.ready || !window.StickySortable || !StickySortable.Tree) return;
        root.dataset.ready = '1';
        var out = $('[data-sortable-tree-out]');
        var tree = new StickySortable.Tree(root, {
            handle: '.grip',
            maxDepth: 1,
            labels: {
                moved: '%item%: position %index% of %count%, level %depth%.',
                nested: '%item% is now a section of %parent%.',
                outdented: '%item% is now a chapter, after %parent%.',
                refused: '%item% cannot go there.'
            }
        });
        var write = function () {
            if (!out) return;
            out.textContent = JSON.stringify(tree.serialize().map(function (node) {
                return node.children.length ? { id: node.id, children: node.children.map(function (c) { return c.id; }) } : { id: node.id };
            }), null, 1).replace(/\n\s+(?=[\]"}])/g, ' ').replace(/\{\n\s+/g, '{ ').replace(/\[\n\s+/g, '[');
        };
        root.addEventListener('sortable:change', write);
        write();
    }

    // The channel names a project: one of 64 static answers (/demo/names/<n>.json) taken at random each
    // time - a real request, a different name; the throttle lets one a second leave, the counters say so.
    function ajaxer() {
        var button = $('[data-ajaxer-send]');
        if (!button || button.dataset.ready || !window.Ajaxer) return;
        button.dataset.ready = '1';
        var box = button.closest('[data-demo="ajaxer"]');
        var out = $('[data-ajaxer-out]', box);
        var name = $('[data-ajaxer-name]', box);
        var history = $('[data-ajaxer-history]', box);
        var counter = $('[data-ajaxer-count]', box);
        var asked = 0, answered = 0;
        var first = button.dataset.ajaxerUrl;           // .../demo/names/1.json, under the site's folder
        var say = function () { counter.textContent = asked + ' asked · ' + answered + ' answered'; };
        Ajaxer.setMethod('names', 'GET');
        Ajaxer.setThrottle('names', '1s');
        Ajaxer.setTarget('names', box);
        Ajaxer.setLoaderDebounce('names', 200);
        button.addEventListener('click', function () {
            asked++;
            say();
            var n = 1 + Math.floor(Math.random() * 64);
            Ajaxer.setUrl('names', first.replace(/\d+\.json$/, n + '.json'));
            Ajaxer.send('names', {}, function (data) {
                answered++;
                say();
                if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = { name: String(data) }; } }
                var previous = name.dataset.name;
                name.textContent = data.name;
                name.dataset.name = data.name;
                name.classList.remove('is-new'); void name.offsetWidth; name.classList.add('is-new');
                if (previous) {
                    var li = document.createElement('li');
                    li.textContent = previous;
                    history.insertBefore(li, history.firstChild);
                    while (history.children.length > 5) history.removeChild(history.lastChild);
                }
                out.textContent = JSON.stringify(data, null, 2);
            });
        });
    }

    function stickyButton() {
        var button = $('[data-sticky-top-demo]');
        if (!button || button.dataset.ready) return;
        button.dataset.ready = '1';
        button.addEventListener('click', function () {
            if (window.Sticky && Sticky.scrollTo) Sticky.scrollTo(0); else window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }

    // The cookie buttons: each takes the panel to its place (Cookie.mount) and opens it - the question
    // while there is no answer, the switches once there is one -, or closes it when it is open there.
    function cookieButtons() {
        if (!window.Cookie) return;
        $$('[data-fc]').forEach(function (place) {
            var button = $('[data-fc-toggle]', place);
            if (!button || button.dataset.ready) return;
            button.dataset.ready = '1';
            button.addEventListener('click', function () {
                var banner = Cookie.banner();
                if (banner && !banner.hidden && place.contains(banner)) { Cookie.close(); return; }
                floating(false);
                Cookie.mount($('[data-cookie-banner]', place) || place);
                Cookie.open(Cookie.answered() ? 'details' : 'banner', button);
                expanded();
            });
        });
        var first = $('[data-cookie-demo-first]');
        if (first && !first.dataset.ready) {
            first.dataset.ready = '1';
            first.addEventListener('click', function () {
                var counted = $('[data-cookie-demo-countdown]');
                Cookie.close();
                var corner = $('[data-fc="corner"]');
                Cookie.mount($('[data-cookie-banner]', corner) || corner);
                floating(true);
                where();
                // As on a first visit: the question shown by itself (autoOpen), counted down when asked
                // for; once answered or closed, the demo asks only when a button is pressed again.
                Cookie.ready({ autoOpen: true, countdown: counted && counted.checked ? { duration: '10s', action: 'refuse' } : false });
                Cookie.forget();
                floating(true);
                expanded();
                show();
            });
        }
        // Where the floating panel goes (1.6: position, gutter, follow): the corner button moves to the
        // corner chosen when the panel follows it.
        var box = $('[data-cookie-demo-where]');
        if (box && !box.dataset.ready) {
            box.dataset.ready = '1';
            box.addEventListener('input', function () { where(); });
            box.addEventListener('change', function () {
                where();
                var banner = Cookie.banner();
                if (banner && !banner.hidden && $('[data-fc="corner"]').contains(banner)) Cookie.open(Cookie.pending() ? 'banner' : 'details');
            });
            where();
        }
        show();
    }

    // The install line, copied by a click.
    function copy() {
        $$('[data-copy]').forEach(function (code) {
            if (code.dataset.ready) return;
            code.dataset.ready = '1';
            code.setAttribute('role', 'button');
            code.setAttribute('tabindex', '0');
            code.title = 'Copy';
            var go = function () {
                if (!navigator.clipboard) return;
                navigator.clipboard.writeText(code.textContent.trim()).then(function () {
                    code.classList.add('is-copied');
                    setTimeout(function () { code.classList.remove('is-copied'); }, 1200);
                }, function () {});
            };
            code.addEventListener('click', go);
            code.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        });
    }

    window.addEventListener('transparent:load', function () { swaps++; page(); });
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { boot(); page(); });
    } else {
        boot();
        page();
    }
})();

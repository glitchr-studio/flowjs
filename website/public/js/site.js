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

    // The demonstration consent panel: nothing of this site is kept; the answer under its own name.
    function cookie() {
        if (!window.Cookie || state.cookie) return;
        state.cookie = true;
        Cookie.ready({
            autoOpen: false,
            bare: true,
            container: '[data-cookie-place]',
            record: { name: 'flow-demo-consent', store: 'local', lifetime: '30d' },
            categories: {
                necessary: { label: 'The site itself', required: true, description: 'Nothing is kept: a static site, served as files.' },
                demo: { label: 'A demonstration feature', description: 'Turns the dot below on, and nothing else.', features: ['demo-dot'] }
            },
            texts: {
                title: 'Your choice',
                text: 'A demonstration of the consent panel: Flow keeps your answer in this browser only.',
                accept: 'Accept all', refuse: 'Refuse', customize: 'Choose', save: 'Save my choice',
                detailsTitle: 'What each category does', required: 'Always on'
            }
        });
        Cookie.use('demo', function () { show('granted'); }, function () { show('refused'); });
        Cookie.onConsent(function () { show(Cookie.granted('demo') ? 'granted' : 'refused'); });
    }

    function show(answer) {
        var out = $('[data-cookie-demo-state]');
        if (!out) return;
        var answered = window.Cookie && Cookie.answered && Cookie.answered();
        out.textContent = answered ? 'the demonstration feature is ' + answer + (answer === 'granted' ? ' ●' : ' ○') : 'none yet';
        out.dataset.answer = answered ? answer : '';
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

    // The scene's meter: what scene:progress says.
    function scene() {
        var section = $('#scenes.sticky-scene');
        var meter = $('[data-scene-meter]');
        if (!section || !meter || section.dataset.meter) return;
        section.dataset.meter = '1';
        section.addEventListener('scene:progress', function (e) {
            meter.textContent = 'progress ' + e.detail.progress.toFixed(2) + ' · step ' + e.detail.step + (e.detail.state === 'reduced' ? ' · reduced motion: its end' : '');
        });
        if (window.StickyScenes) { StickyScenes.scan(); var s = StickyScenes.get(section); if (s) s.update(true); }
    }

    function navigation() {
        var loads = $('[data-nav-loads]');
        var count = $('[data-nav-swaps]');
        if (loads) loads.textContent = '1';
        if (count) count.textContent = String(swaps);
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

    function ajaxer() {
        var button = $('[data-ajaxer-send]');
        if (!button || button.dataset.ready || !window.Ajaxer) return;
        button.dataset.ready = '1';
        var out = $('[data-ajaxer-out]');
        var counter = $('[data-ajaxer-count]');
        var asked = 0, sent = 0;
        Ajaxer.setUrl('demo', button.dataset.ajaxerUrl);
        Ajaxer.setMethod('demo', 'GET');
        Ajaxer.setThrottle('demo', '1s');
        Ajaxer.setTarget('demo', out);
        Ajaxer.setLoaderDebounce('demo', 200);
        button.addEventListener('click', function () {
            asked++;
            Ajaxer.send('demo', {}, function (data) {
                sent++;
                out.textContent = JSON.stringify(data, null, 2);
                counter.textContent = asked + ' asked, ' + sent + ' answered';
            });
            counter.textContent = asked + ' asked, ' + sent + ' answered';
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

    function cookieButtons() {
        var open = $('[data-cookie-demo-open]');
        if (!open || open.dataset.ready || !window.Cookie) return;
        open.dataset.ready = '1';
        var place = $('[data-cookie-place]');
        if (place && Cookie.mount) Cookie.mount(place);
        open.addEventListener('click', function () {
            if (place && Cookie.mount) Cookie.mount(place);
            Cookie.open();
        });
        $('[data-cookie-demo-forget]').addEventListener('click', function () {
            Cookie.forget();
            show('');
        });
        show(Cookie.granted('demo') ? 'granted' : 'refused');
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

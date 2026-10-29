---
title: Transparent (navigation)
order: 20
---

# Transparent (navigation)

`src/js/transparent.js` - links and forms load the next page in the background
and the page's block (`identifier`, `#page` by default) is swapped in place,
with the history, the scroll positions, the head and the scripts kept in step.
Needs jQuery and the core.

```js
import '@glitchr/flowjs/navigation';

Transparent.ready({ identifier: '#page', prefetch: true, nest: ['/admin/*'] });
```

After each swap the page announces `transparent:load` (the stops, the sticky
effects and the other modules attach themselves again to the new page through
the core). A link with `rel="prefetch"` is fetched when the pointer settles on it.

## Starting it

`@glitchr/flowjs/navigation` loads the core, `transparent.js` and `src/css/navigation.scss`.
Without a bundler, jQuery, `src/js/core.js` and `src/js/transparent.js` in that order (a page
without jQuery gets `transparent.js: jQuery is needed`; one without the core
`transparent.js: load core.js first`). The script sets `window.Transparent` and `Flow.navigation`.

Loading the script already does some of the work: it puts `transparent loading first active` on
`<html>`, replaces the current history entry with one of its own (`{uuid, status, method, data,
href}`), listens to clicks, submissions, Back/Forward and hash changes, starts the form memory,
the lazy loading of pictures and the hover prefetch, and gives a reloaded page its scroll position
back. Nothing is swapped yet: until `Transparent.ready()` is called, a click on a link is left to
the browser (a full page load) and `<html>` keeps `loading first`.

```html
<!-- the page as the server renders it -->
<html>
<head>...</head>
<body>
    <div id="page" data-layout="article">...</div>
    <div id="loader"></div>
    <script src="/js/jquery.js"></script>
    <script src="/js/core.js"></script>
    <script src="/js/transparent.js"></script>
    <script>Transparent.ready({ identifier: '#page', exceptions: ['/download/*'] });</script>
</body>
</html>
```

`Transparent.ready(options)`:

- sets the options (`configure()`), and the internal `x-ajax-request` setting to `true`;
- the first time only: checks `cache_version` and dispatches `transparent:first`, and starts
  checking `cache_version` again each time the tab becomes visible;
- each time: dispatches `transparent:ready`, adds `ready` to `<html>`, notes the page's layout,
  starts the lazy loading again;
- while `<html>` has `first`: scrolls to the address's hash (not after a reload, which already put
  the page back where it was) and then plays the leaving phases (`active-out`), which end with
  `<html>` at `transparent ready`.

It returns `Transparent`. `Transparent.configure(options)` only sets the options (and the
`progress-bar-native` class, see `progress_bar`); it also returns `Transparent`.

Two ways to turn the navigation off:

- `class="disable"` on the server's `<html>` when the script loads: no listener is added at all,
  `<html>` gets `transparent ready disable`, every link and form is the browser's.
- `Transparent.ready({ disable: true })` (or `configure`): the listeners stay, and give up at once,
  so every click and submission is the browser's; the nest does not open either.

An answer whose `<html>` carries `reload` or `disable` is not swapped in: the page is loaded by
the browser at its address (see [The answer](#the-answer)).

## Options (`Transparent.settings`)

Set with `Transparent.ready({...})` or `Transparent.configure({...})`.

| Option | Default | Meaning |
| --- | --- | --- |
| `identifier` | `"#page"` | the block swapped |
| `loader` | `"#loader"` | |
| `throttle` | `1000` | |
| `rescue_reload` | `5000` | ms before the page reloads after a failure that came with an empty page |
| `lazyload` | `true` | the lazy loading of `img[data-src]`; `false` switches it off |
| `exceptions` | `[]` | paths (RegExp or wildcard strings) left to the browser |
| `prefetch` | `true` | only anchors with `rel="prefetch"` are fetched ahead; `false` switches the mechanism off |
| `prefetch_delay` | `65` | ms the pointer dwells before the fetch |
| `prefetch_ttl` | `30000` | ms a prefetched page stays usable |
| `prefetch_max` | `15` | |
| `exit_duration` | `0` | ms `html.exiting` is held after the response arrives, before the swap (plain milliseconds) |
| `smoothscroll_duration` / `_speed` / `_easing` | `"200ms"` / `0` / `"swing"` | |
| `headlock` | `[]` | URL substrings or patterns kept in `<head>` across pages; `data-headlock="true"` / `"false"` on an element overrides |
| `use_view_transitions` | `false` | wrap the swap in `document.startViewTransition()` where supported |
| `skip_transition_for_cache` | `false` | a page given back from the history's cache (Back, Forward) skips the view transition |
| `progress_bar` | `true` | the native bar (below); `false` or `'off'` for another indicator |
| `progress_bar_delay` | `200` | ms a navigation must last before the bar shows: a faster one shows none (1.6) |
| `progress_bar_min` | `400` | ms the bar stays once shown (1.6) |
| `progress_bar_finish` | `250` | ms the finished bar takes to fill and fade (1.6) |
| `cache_version` | `null` | a value changing at each deploy purges the response cache on mismatch |
| `nest` | `[]` | path patterns opened as a nested website-in-website panel; the target must send the `X-Transparent-Nest` header |
| `nest_move`, `nest_resize`, `nest_snap` | `true` | drag the chrome bar, resize by the edges, magnetic snapping |
| `nest_snap_threshold` | `8` | px |
| `nest_dock` | `true` | docking against an edge; `nest_dock_target` (`null`) names an element to dock into |
| `nest_swipe` | `true` | small screens: drag the bar down to dismiss |
| `nest_keepalive` | `true` | closing parks the nested session, the next open resumes it |
| `nest_remember` | `true` | the panel's layout is kept in localStorage under `nest_remember_key` (`"transparent[nest][layout]"`) |
| `nest_esc_confirm` | `"Close this panel? Any unsaved changes may be lost."` | confirm before ESC closes a nest |
| `disable`, `debug` | `false` | |

The comments above each option in `src/js/transparent.js` give the reasoning.

### Every option, read from the source

The settings object in the order the source declares it, with what the code does with each.

| Option | Type | Default | Effect |
| --- | --- | --- | --- |
| `headers` | object | `{}` | extra request headers of every navigation request (jQuery adds `X-Requested-With: XMLHttpRequest` to it); not sent by the prefetch nor by the nest |
| `data` | object | `{}` | data kept by history entry (`uuid` -> object), read and written by `getData(uuid)` / `setData(uuid, data)`; what a hash change carries |
| `disable` | boolean | `false` | every listener gives up at once: the browser handles the links and forms, the nest does not open, ESC does nothing |
| `global_code` | boolean | `true` | run the `<script>` elements inside the swapped block; `false`: none of them runs (neither inline nor with `src`) |
| `debug` | boolean | `false` | says in the console what it does (running, a failed `pushState`, a track-reload, a view transition that failed, the nest's failures); with `debug`, a JSON answer that does not parse is rescued |
| `lazyload` | boolean | `true` | the lazy loading (see [Lazy loading](#lazy-loading)); `false`: none of its runs - at `DOMContentLoaded`, at `ready()`, at each swap, a call of `Transparent.lazyLoad()` - gives a picture its `src`, and the pictures already watched keep their `data-src` when they come into view |
| `response_text` | object | `{}` | declared, never read |
| `response_limit` | number | `25` | how many pages the `sessionStorage` cache keeps (the oldest goes first) |
| `throttle` | number (ms) | `1000` | the wait before a full page load when Back or Forward lands on an entry the cache does not have; nothing else |
| `rescue_reload` | duration | `5000` | a failure that came with an empty page (no head and no body, or both empty - a 500 with nothing in it): the block reads `<div class='error'></div>` and the page reloads this long after (a number of ms, `"5s"`, `"300ms"`); see [A page under another status than 200](#a-page-under-another-status-than-200) |
| `prefetch` | boolean | `true` | `false` turns the hover prefetch off; `true` prefetches only the links marked `rel="prefetch"` (see [Prefetch](#prefetch)) |
| `prefetch_delay` | number (ms) | `65` | how long the pointer rests on a link before its prefetch starts; a touch starts it at once |
| `prefetch_ttl` | number (ms) | `30000` | how long a prefetched page answers a click; `0`: no limit |
| `prefetch_max` | number | `15` | how many prefetched pages are kept (the oldest goes first) |
| `exit_duration` | number (ms) | `0` | how long `exiting` stays on `<html>` between the answer and the swap, for an exit animation; plain milliseconds, never a string with a unit |
| `identifier` | selector | `"#page"` | the block swapped; a page without it is neither swapped in nor taken from (a click on a page that lacks it is the browser's) |
| `loader` | selector | `"#loader"` | the element whose CSS transition and animation times (its own, `::before`, `::after`) set the length of each phase; `<html>` when nothing matches. Read again at each `DOMContentLoaded`, the ones the navigation dispatches included |
| `smoothscroll_duration` | duration | `"200ms"` | the scroll to an anchor of the page, and to the hash of the first page |
| `smoothscroll_speed` | number (px/s) | `0` | when set, the anchor scroll's duration follows from the distance instead |
| `smoothscroll_easing` | jQuery easing name | `"swing"` | the anchor scroll's easing, when jQuery animates it |
| `exceptions` | array | `[]` | RegExp or wildcard strings (`*` matches anything), tested against the path only (no query, no hash): matching links and forms are the browser's; never prefetched |
| `nest` | array | `[]` | the same kind of patterns: links whose path matches open in the nest (see [The nest](#the-nest)) |
| `nest_move` | boolean | `true` | the panel is moved by its chrome bar |
| `nest_resize` | boolean | `true` | the panel is resized by its edges and corners |
| `nest_snap` | boolean | `true` | a resize snaps flush to the viewport's edge within `nest_snap_threshold`; `false` also stops a drag past an edge from docking there |
| `nest_snap_threshold` | number (px) | `8` | how close counts as flush for a resize, how far past the viewport's edge a drag must go to dock against it |
| `nest_dock` | boolean | `true` | `false` forbids docking of every kind (the dock button, a move or a resize away from the centre, a drag to an edge, `nest_dock_target`) |
| `nest_dock_target` | selector or `null` | `null` | an element of the host page the dock button docks the panel into (its own children are put aside and given back on undock); `null`: the dock button floats the panel |
| `nest_swipe` | boolean | `true` | on a screen of 768 px or less, dragging the chrome bar down (120 px, or 0.5 px/ms) closes the panel |
| `nest_keepalive` | boolean | `true` | a closed panel is parked (hidden, its page still alive) and comes back on the next open of the same page; `false`: closed is destroyed |
| `nest_remember` | boolean | `true` | where the panel was put, its size, its dock and its edge are kept in `localStorage` and given back at the next open (not full page, not tucked away, never on a screen of 768 px or less) |
| `nest_remember_key` | string | `"transparent[nest][layout]"` | the `localStorage` key of that layout |
| `headlock` | array | `[]` | strings (contained in) or RegExp (tested on) the `src` or `href` of a head element, or the text of an inline `<style>`: such elements stay in the head across swaps (see [The head and the scripts](#the-head-and-the-scripts)) |
| `use_view_transitions` | boolean | `false` | the swap runs inside `document.startViewTransition()` where the browser has it; elsewhere, and if it throws, the swap runs as usual |
| `skip_transition_for_cache` | boolean | `false` | with `use_view_transitions`, a page given back from the history's cache (Back, Forward) is swapped without the view transition; a page from the network (a link, a form, a prefetched page) still goes through it |
| `progress_bar` | boolean or `"off"` | `true` | `false` or `"off"` takes `progress-bar-native` off `<html>`, which hides the bar and the progress cursor of `navigation.scss` |
| `progress_bar_delay` | number (ms) | `200` | a navigation shorter than this shows no bar at all (1.6, see [The progress bar](#the-progress-bar-16)) |
| `progress_bar_min` | number (ms) | `400` | once shown, the bar stays at least this long (1.6) |
| `progress_bar_finish` | number (ms) | `250` | the finished bar fills and fades over this (1.6) |
| `nest_esc_confirm` | string | `"Close this panel? Any unsaved changes may be lost."` | the `confirm()` question before Escape closes the nest |
| `cache_version` | any or `null` | `null` | compared, as a string, with the one kept in `sessionStorage` at the first `ready()`, at each navigation and each time the tab becomes visible: different, every cached page is dropped. `null`: never checked |




## What the navigation takes, and what it leaves to the browser

### Links

A click on an `<a href>` (or on anything inside one) is a navigation of the page when all of
these hold; otherwise the browser follows the link as usual:

- `Transparent.ready()` was called, and `disable` is off;
- nothing called `preventDefault()` on the click before (an inline `onclick` returning `false`
  counts);
- the current page has the `identifier` block;
- the path matches none of `exceptions` and does not start with `/css`, `/js`, `/images` or
  `/vendor`;
- the link is of this origin;
- no modifier key is held (Cmd, Ctrl, Shift, Alt) and the link has no `target="_blank"`;
- the link has no `download` attribute (the browser saves its file, under the name the attribute
  gives; the prefetch leaves such a link alone too).

A link to another page of the site is then fetched and swapped in. A link to the same address
and query with a hash scrolls to that anchor (see [Anchors of the page](#anchors-of-the-page));
the very same address with no hash does nothing.


`class="reload"` lets the browser have a form (see below); on a link it changes nothing: the link
is still swapped in (checked in headless Chrome). An excepted path is the way to have one link
loaded by the browser.

### Forms

A submission is taken the same way: a click on a `type="submit"` button or input (its form found
through its `form` attribute, its ancestor, or a form named like it), and every `submit` event
that reaches the document (Enter in a field, `requestSubmit()`, a `<button>` that is a submit
button by default). A submit listener of the site that calls `preventDefault()` keeps the form
from being sent.

- **Validation**: a form the browser finds invalid is not sent. `Invalid form submission.` and
  each invalid control as `name: message` are said in the console, the form gets `was-validated`,
  and the first invalid control shows the browser's own message (`reportValidity()`), focused and
  in view. `class="skip-validation"` on the button that sends it skips the check.
- **Where and how**: the button's `formaction` and `formmethod` first, then the form's `action`
  and `method`; a form without `action` goes to its own page, query included. A submission by
  `submit` event defaults to GET, a click on a submit button to POST, when nothing names a method.
- **What is sent**: what a browser sends - named, enabled controls only; a checkbox or radio only
  when ticked; of the buttons only the one pressed (a click on its icon counts); each file of a
  file input; each selected option of a multiple select; the controls outside the form bound to
  it by `form="its-id"`. A form that shares its `name` with no other also takes every control of
  the page whose name starts with `name[`.
- **GET**: the fields become the address's query (a file is left out), so the address can be
  reloaded and shared.
- **One at a time**: while a form's request is out, its submit buttons are `disabled`, and a
  second submission of the same form is ignored; any answer frees it.
- **`class="reload"`** on the form or on the button pressed: the browser submits the form itself.

The navigation dispatches its own `submit` event on the form (cancelable, not bubbling) before
sending, so the site's submit listeners and the form memory see every submission; the browser's
own submission of that event is cancelled (Firefox would send it a second time).

After a POST answered under 400 every cached page is dropped (`invalidateResponses()`): Back must
not give back a form as it was before the write.

### Anchors of the page

A link to an anchor of the current page (same path and query) scrolls there smoothly
(`smoothscroll_duration`, `_speed`, `_easing`), the target under the core's scroll padding (see
[the core](core.md)), in the nearest scrolling ancestor of the link; on arrival the hash is
written in the address, unless the link has `data-skip-hash="true"` or the reader took the scroll
on the way. Changing the hash by hand (`location.hash = '#x'`) scrolls the same way.

## What a swap does

### The request

A navigation request is a jQuery `$.ajax` call (`X-Requested-With: XMLHttpRequest`, plus the
`headers` option), with the method found, the fields as a `FormData` for a POST. A newer
navigation aborts the one in flight: the reader's last click wins, and a late answer of an older
one is discarded. A GET already prefetched answers at once; one whose prefetch is still on the
wire waits for that request instead of sending a second one.

### The answer

What the answer is decides what happens:

| Answer | What happens |
| --- | --- |
| a page with the `identifier` block, any status | swapped in, at the address the request ended at (redirects followed), with a history entry `{uuid, status, method, data: {}, href}` |
| status 0, nothing received | the page stays: see [A request that gets no answer](#a-request-that-gets-no-answer) |
| `Content-Type: application/json` (exactly) | not a page: the form that was sent is reset and its buttons enabled; `{"code": "302", "target": url}` sends the browser to `target` (or reloads); `load` is dispatched on `window` |
| `Content-Type: text/html` (exactly) without `<html`, `<head>` or `<body` in it | rescued (below) |
| status 302 as seen by the request | the browser goes to the answer's address |
| a status other than 200 without the block | rescued: see [A page under another status than 200](#a-page-under-another-status-than-200) |
| a page without the block | the browser loads the address itself (a POST's fields are not sent again) |
| a page whose block has another `data-name` than the current one (`default` when none) | the browser loads the address itself; a POST that sent fields is the exception, swapped in |
| `<html>` with `reload` or `disable` | the browser reloads the address |
| a head whose `data-track="reload"` elements differ from the current ones | the browser loads the address (an asset bundle changed: a deploy) |

`data-layout` on the block names its layout: `<html>` gets `new` the first time a layout is seen in
the tab, `same` when the next page has the current layout, and `<previous>-to-<next>` (for example
`article-to-home`, with the event `transparent:article-to-home`); the incoming block gets
`data-layout-prev` with the layout it replaces. The `<previous>-to-<next>` class is on `<html>`
from the answer to the end of the entrance: the swap spares it (it takes off the other classes
the new page's `<html>` does not carry) and it goes once the page is in, with `new`, `submit` and
`popstate`. CSS can animate an entrance by layout pair on it.


### The head and the scripts

- The attributes of `<html>` (all but `class`), `<head>` and `<body>` become the new page's.
- **Head**: an element of the current head that the new head has no equal of (`isEqualNode`) is
  removed, unless it is headlocked; an element of the new head that the current head has no equal
  of is added. A headlocked element: `data-headlock` with any value but `"false"`; anything added
  to the head after the script loaded (a widget's style, an analytics tag); or a match of the
  `headlock` option. `data-headlock="false"` makes it removable again.
- **Scripts of the head and of `<body>`'s children**: a new `<script>` is created in the live
  document (its attributes copied, `async = false` to keep their order), so it runs as it would in
  a page load; a stylesheet `<link>` added is waited for too. The `load` of the swap waits until
  they have loaded or failed (10 s at most). A `body > script` the current body already has (equal
  node) does not run again.
- **Scripts inside the block**: with `global_code` on, each `<script>` of a JavaScript type (no
  type, a JavaScript MIME type or `module`; never `application/json`, `ld+json` or a template) is
  replaced by a fresh copy, which the browser runs once, as on a page load: a `var` of its own is a
  global, a module runs as a module, `document.currentScript` is the copy. A script that throws
  is the browser's uncaught error, as any page script's, and the swap goes on.


- **Canvases**: a `<canvas>` with an `id` that the new block has too is moved into it, drawn as it
  was; one without an `id` is kept where the new page has the same place for it.

### The block and `<html>`

The new block is inserted before the old one, which is removed. `<html>` takes the classes of the
new page's `<html>`, and loses those it does not carry, except the state classes (below), the
classes of `Transparent.persistentClasses` (a `Set`: `progress-bar-native`, `nested`,
`nest-docked`, `nest-loading`; add a site's own runtime class to it) and the layout-switch class.

### The scroll

A frame after the swap (once the browser has laid the page out):

- a page reached by a link or a GET form starts at its top, or at its hash's element when the
  address has one;
- a page given back by Back or Forward gets the positions it was left with - the window's and
  every scrolling element's - and the window's position is held while the page grows (see
  [Back, Forward, and a page that is not whole yet](#back-forward-and-a-page-that-is-not-whole-yet));
- a POST that comes back to the address it was sent from (a form the server refused) keeps the
  reader where they were;
- a POST that lands elsewhere is not scrolled by the navigation.

### The announcement

Once the scripts the swap brought have run: `DOMContentLoaded` on `document` and on `window`, then
the leaving phases start, then `transparent:load` and `load` on `window` - the order of a page
load, so a site's own start-up code runs again for the new page.

## The classes on `<html>`

| Class | When |
| --- | --- |
| `transparent` | always, once the script is loaded |
| `first` | from the load of the document until the first `ready()` has played its leaving phases |
| `ready` | after `ready()` |
| `loading` | from the click until the new page is in and its phases are over |
| `pre-active`, `active-in`, `active`, `active-out`, `post-active` | the phases (below) |
| `exiting` | between the answer and the swap, for `exit_duration` ms (only when it is above 0) |
| `new` | the incoming page's layout is the first of its kind in this tab |
| `same` | the incoming page has the current layout |
| `<previous>-to-<next>` | the two layouts, from the answer on (see the defect above) |
| `submit`, `popstate` | the navigation came from a form, from Back/Forward |
| `disable` | the navigation is off (see [Starting it](#starting-it)) |
| `progress-bar-native` | `progress_bar` on |
| `nested`, `nest-docked`, `nest-loading` | the nest (see [The nest](#the-nest)) |

The phases and their timing: at the click `pre-active`, at once replaced by `active-in`; after
the loader's delay `active` (`active-in` removed); the answer arrives, waits for what is left of
the loader's delay and duration, then the swap; then `active-out`, after the loader's delay
`active` goes, after its duration `active-out` goes and, `loading` being set, every state class
goes and `<html>` is `transparent ready` again; `post-active` then stays for the loader's delay and
duration. The loader's times are the largest `transition-delay`/`animation-delay` and
`transition-duration`/`animation-duration` of the `loader` element and of its `::before` and
`::after`, read when each phase starts: a curtain whose transition lasts 300 ms holds each phase
300 ms. With no CSS time at all, the phases follow each other within the same task.

```scss
#loader { position: fixed; inset: 0; background: #fff; opacity: 0; pointer-events: none; transition: opacity .25s; }
html.loading.active #loader { opacity: 1; }            // the curtain is down while the page changes
html.exiting #page { transform: translateY(-1rem); opacity: 0; transition: all .12s; }   // with exit_duration: 120
```

With `progress_bar` on, `navigation.scss` draws a bar at the top of the window and a progress cursor
while `html.progress-bar-shown` (since 1.6: only for a navigation longer than `progress_bar_delay`,
at least `progress_bar_min`, then `html.progress-bar-done` while it fills and fades - never on the
first page load; see [The progress bar](#the-progress-bar-16)).

## Events

Dispatched on `window` (none bubbles from an element); the `transparent:*` ones are plain `Event`s
unless a `detail` is given.

| Event | When | `detail` |
| --- | --- | --- |
| `transparent:active` | when the script loads (`<html>` gets `active`), and when a phase adds `active` | |
| `transparent:first` | the first `ready()` | |
| `transparent:ready` | every `ready()` | |
| `transparent:link` | a click, submission, Back/Forward or hash change that names a destination - before any check, so also for a link the browser then follows (another origin, an exception) | `{method, url, target}`: the method, a `URL`, and the link, button or form (for Back/Forward the entry's data) |
| `transparent:beforeunload` | the page is about to be replaced (and kept in the cache); followed by a `beforeunload` (cancelable, not obeyed) | |
| `transparent:pre-active`, `transparent:active-in` | the phases of the click | |
| `transparent:exiting` | the answer is in, `exiting` is set (only with `exit_duration`) | |
| `transparent:new` | the incoming layout is new to the tab | |
| `transparent:popstate`, `transparent:submit` | the navigation came from Back/Forward, from a form | |
| `transparent:<previous>-to-<next>` | the two layouts of the swap, every swap (`transparent:article-to-article` included) | |
| `DOMContentLoaded` | on `document` and `window`, after the swap and its scripts | |
| `transparent:active-out` | the leaving phase starts | |
| `transparent:loading` | the phases are over and `loading` is taken off (despite its name: the end) | |
| `transparent:load`, then `load` | the new page is in | |
| `transparent:post-active` | `post-active` taken off | |
| `transparent:nest:*` | the nest: see [Events of the nest](#events-of-the-nest) | |

```js
addEventListener('transparent:link', (e) => {
    if (e.detail.target instanceof HTMLFormElement) console.log('sent', e.detail.method, e.detail.url.pathname);
});
addEventListener('transparent:beforeunload', () => myWidget.destroy());   // before the page is kept
addEventListener('transparent:load', () => myWidget.mount(document.querySelector('#page')));
```

What the script listens to: `click` on `document`; `submit` on `document` (jQuery delegation);
`window.onpopstate`, `window.onhashchange` and `window.onbeforeunload`, set as properties (a site
that assigns them afterwards replaces the navigation's own); `mouseover`, `mouseout` and
`touchstart` (capture) for the prefetch; `input`, `change` and `submit` (capture) for the form
memory; `DOMContentLoaded` (the loader, the lazy loading, the form memory); `visibilitychange`
(`cache_version`); `pagehide` (the reload position, the nest's layout); `keydown` (capture: Escape
in the nest).

## Back, Forward, and a page that is not whole yet

A page left by a link, by Back or by Forward is kept as it is (its DOM in
memory for five minutes, its HTML in `sessionStorage`), with the scroll
position of the window and of every element that scrolls. Coming back, it is
given its place again - and that place is held while the page finishes
growing (sections a controller sizes, pictures without dimensions): put back
at each change of size, the browser's scroll anchoring off meanwhile, until
the page has been quiet for 1.5 s (6 s at most). The reader taking the scroll
(a wheel, a finger, a press, a key), a script of the page scrolling it, or the
next navigation ends the hold at once.

The kept page includes what scripts added to it. `transparent:beforeunload`
is dispatched before a page is kept: the moment to take away what should not
come back with it.

### The cache

| Where | What | Bound |
| --- | --- | --- |
| memory (`Transparent._liveDomCache`) | a copy of the whole `<html>` of each page left, with its scroll positions | 25 pages (`Transparent.liveDomCacheMax`), 5 minutes each (`Transparent.liveDomCacheTTL`, ms) |
| `sessionStorage["transparent"]` | the list of the cached entries' uuids | `response_limit` (25) |
| `sessionStorage["transparent[response][<uuid>]"]` | the page's HTML | |
| `sessionStorage["transparent[position][<uuid>]"]` | the `[top, left]` of every scrolling element, in document order | |
| `sessionStorage["transparent[window][<uuid>]"]` | the window's own `[top, left]` | |
| `sessionStorage["transparent[version]"]` | the last `cache_version` seen | |

Back or Forward to an entry the cache no longer has (another tab session, an evicted page) loads
the page through the browser after `throttle` ms. A full `sessionStorage` drops the oldest half of
the cached pages and tries again; a page too large to fit at all clears `sessionStorage`.
`Transparent.invalidateResponses()` drops every cached page (it runs after each POST answered under
400); a `cache_version` that changed does the same.

### A reload keeps its place

Outside the nest, the window's position is written at `pagehide` in
`sessionStorage["transparent[reload]"]` as `{href, top, left}`, and a reload of the same address
puts it back - at once, at `DOMContentLoaded`, at `load` and once more after - until the visitor
scrolls, presses, touches or types. `Transparent.getReloadPosition()` returns `{top, left}` when the
current load is such a reload, `null` otherwise: a script that runs before the bundle can read the
same key to avoid painting the top of the page first.

## Prefetch

A link marked `rel="prefetch"` is fetched when the pointer has rested on it for `prefetch_delay`
ms (65), or at once when a finger touches it. Only a plain GET to another page of this origin:
not a `download` link, not one with a `target` other than `_self`, not an excepted path, not a
nest path, not the current page. Two prefetches at most are on the wire at a time; the answer
(2xx only) is kept by address for `prefetch_ttl` ms (30 s), `prefetch_max` (15) pages at most.

```html
<a href="/articles/42" rel="prefetch">Next article</a>
```

The request carries `X-Purpose: prefetch` and `Purpose: prefetch` (no `X-Requested-With`): a
server may skip what a real visit does (counting a view, writing a session). A click on the link
then swaps the prefetched page in without a request; a click while the prefetch is still on the
wire waits for it. A prefetch never reports a failure: the click then makes its own request.

`Transparent.prefetch(href)` prefetches an address by script (the same rules of count and cache,
no check of the link); `getPrefetched(href)`, `setPrefetched(href, html)`, `clearPrefetched()` and
`claimPrefetch(href, callback)` reach the cache.

## A request that gets no answer

When the connection drops or the server cannot be reached (status 0, nothing
received), the page stays as it is, at its address, and is announced again as
a swap announces one (`DOMContentLoaded`, `transparent:load`, `load`): what a
site put on for the wait - a curtain, a progress bar - comes off through the
handlers it already has. jQuery's `ajaxError` tells the failure.

## A page under another status than 200

A status does not make an answer unusable. When the answer is a page of the
site - the block the navigation swaps (`identifier`) is in it, in a layout it
can swap - it is shown like any other: in place, at its address, with its
history entry (which keeps the status), and nothing is said in the console.
That is a form the server refuses, sent back with its errors under 422 (what
Symfony answers for an invalid form), a creation under 201, and the site's
own page for what is missing, forbidden or broken (404, 403, 500, 503).

An answer that is no such page - a proxy's 502, a debug trace, a bare server
error - is a failure: `Transparent.rescue()` says so in the console
(`Rescue mode.. called`; `Unexpected XHR response` for a 5xx), replaces the
document with what came, and `Transparent.isRescueMode()` is `true` from
then on.

The rescue sets the answer's head and body as the document's (`innerHTML`) and runs their scripts
through `evalScript()` (each once, as in the swapped block: see
[The head and the scripts](#the-head-and-the-scripts)). An answer with nothing in it (no head and no
body, or both empty: a 500 that came with an empty page) is not put in place of the document,
which would leave a blank page: the block reads `<div class='error'></div>` and the page reloads
`rescue_reload` (5000 ms) later. A draft of the form that was being sent is
kept (see [Form memory](#form-memory)) and the form is usable again. While in rescue mode, the page
left by Back or Forward is not kept.

## Form memory

`Transparent.formMemory` keeps what the visitor types in a form, in `localStorage`, so that a
reload, a closed tab, a crash or a session that expired under the form loses nothing. It runs as
soon as the script is loaded, `ready()` or not, `disable` or not.

- **Which forms**: a form with a `name` or an `id` attribute, without `data-no-persist`. Same-named
  forms (one reply form per comment) are told apart by their `action`.
- **Which fields**: named ones, except `password`, `file`, buttons, hidden fields whose name
  contains `_token` or `csrf`, and any field with `data-no-persist`.
- **When saved**: 500 ms after a keystroke or a change made by the visitor (trusted events only:
  a script filling a field is not saved), at each submission, and at `beforeunload` when the
  visitor typed something.
- **When given back**: at `DOMContentLoaded`, the page's first and each swap's; each field given
  back gets `data-restored-from-draft`. A `<textarea data-edjs>` (Editor.js) gets the value in
  `data-edjs` too.
- **When dropped**: once the server answered the submission and the next page is in - the form is
  on it again (accepted, or sent back with its errors) or the visitor was sent elsewhere: dropped;
  the next page asks for a password (a sign-in page: the session had died): kept, and given back
  the next time that form is on screen; no answer at all (network error, rescue): kept. Also after
  7 days, and by `Transparent.formMemory.clear(form)`.

The key is `"tx-form-memory:" + location.pathname + ":" + (name or id)`, plus `"@"` and what the
form's `action` adds to the page's address; the record is `{t, d}` (time, fields) and `s: "lost"`
for a draft kept from a sign-in bounce. `sessionStorage["tx-form-memory:pending"]` holds the
submission awaiting its verdict in this tab.

| Member | Effect |
| --- | --- |
| `enabled` | `true`; `false` stops saving and restoring |
| `ttl` | ms a draft lives (7 days) |
| `debounce` | ms after typing before a save (500) |
| `save(form)`, `restore(form)`, `clear(form)` | one form |
| `saveAll()`, `restoreAll()` | every form of the page (`restoreAll` settles a pending submission first) |
| `markSent(form)`, `settle()`, `abandon()` | the submission's verdict (called by the library) |
| `clearExpired()` | removes the drafts past `ttl` (run 2 s after load) |

```html
<form name="comment" method="post" action="/articles/42/comments">
    <textarea name="comment[body]"></textarea>
    <input type="hidden" name="comment[_token]" value="...">   <!-- never kept -->
    <input name="comment[captcha]" data-no-persist>              <!-- never kept -->
</form>
```

## Lazy loading

An `img[data-src]` without the class `loaded` gets its `src` from `data-src` when it comes into view
(an `IntersectionObserver`; without one, on scroll and resize, 20 ms throttled). The picture gets
`loading`, then `loaded` or `error`; an ancestor `.lazybox` gets the same classes. It runs at
`DOMContentLoaded` (each swap's too) and at each `ready()`; `Transparent.lazyLoad(images)` runs it
on a list of one's own. `lazyload: false` switches it off: none of these runs gives a picture its
`src`, and a picture already watched keeps its `data-src` when it comes into view. Set before
`DOMContentLoaded` (`Transparent.configure({lazyload: false})` in a script of the page) it keeps
the first page's pictures out too; given to `ready()` at the window's `load`, it stops the lazy
loading from then on. `navigation.scss` hides an `img[data-src]` until `loaded` and makes a
`.lazybox.loading` blink.

```html
<div class="lazybox"><img data-src="/media/large.jpg" width="1200" height="800" alt=""></div>
```

## The nest

A website within the website: a link whose path matches one of `nest`'s patterns opens its page in
a panel over the current one - an `iframe` with the page, its own scripts and styles - while the
host page stays live underneath, at its address. Both sides must agree: the site names the paths,
and the page answers with an `X-Transparent-Nest` header (any value) and a status under 400.
Without the header, the link is followed the ordinary way.

```js
Transparent.ready({ identifier: '#page', nest: ['/admin', '/admin/*'] });
```

```php
// the nested application, on each page it allows in the panel
$response->headers->set('X-Transparent-Nest', '1');
```

The nested page should load the library and call `Transparent.ready()` itself, with the same
`nest` patterns: its own navigation then runs inside the panel, and knows which links leave it.

### Opening

A click on a matching same-origin link (no modifier key, no `target="_blank"`) opens the panel as
soon as `nest` is set (by `ready()` or `configure()`); the nest's listener runs in the capture
phase, before the page's own click handlers. Inside a nested page, a nest link never opens a
second level.
The panel (`#transparent-nest`) appears at once, its page arriving after: `html.nest-loading` and a
bar while the page is fetched (a GET with `X-Requested-With`, 20 s timeout), `html.nested` and the
body's overflow hidden while the panel is open. The page is written into the iframe (`srcdoc`)
with a `<base href>` of its real address (`data-headlock="true"`), and the host's title becomes the
nested page's. It is shown when the iframe has loaded and its DOM has been quiet 250 ms (3 s after
the load at most, 7 s in all), or when the nested page calls `parent.Transparent.notifyNestReady()`.

Pointing at a nest link prefetches it (15 s; separate from the navigation's prefetch). A network
failure shows an error in the panel with a retry button; an answer without the header closes the
panel and loads the address in the browser.

### History and addresses

Opening pushes one history entry at the host's own address: Back closes the panel. Each page
visited inside the panel gets an entry of the host's history too (the address bar stays the
host's), so Back and Forward walk through them, replayed from the nested page's own cache when it
has them. A link inside the panel to a path outside `nest` leaves it: the panel closes (parked) and
the host navigates there, the panel's entry kept - Back brings the panel back as it was. A
redirect inside the panel to such a path does the same.

### The panel

| Control | Effect |
| --- | --- |
| the chrome bar (drag) | moves the panel (`nest_move`); away from the centre the panel is docked: no backdrop, the host page usable again (`html.nest-docked`) |
| a drag past a viewport edge | docks it against that edge (`data-dock-edge` `left`, `right`, `top`, `bottom`), full height or width, the chrome reduced to a grab tab |
| a click on the grab tab | tucks the docked panel away (`is-hidden`), only the tab showing; again: back |
| a double click on the chrome bar | back to the centred default |
| the edges and corners (drag) | resize (`nest_resize`), flush to the viewport's edge within `nest_snap_threshold` |
| expand (`.transparent-nest-share`) | full page (`is-full`): the address bar takes the nested page's address |
| exit full page (`.transparent-nest-collapse`) | the centred panel and the host's address again |
| dock (`.transparent-nest-dock-toggle`) | docks into `nest_dock_target`, else floats the panel docked; again: undock |
| retry (`.transparent-nest-retry`) | after a network error |
| close (`.transparent-nest-close`), a click on the backdrop | closes |
| Escape (on the host or inside the panel) | asks `nest_esc_confirm`, then closes |
| on a screen of 768 px or less | the panel is full screen; a drag of the bar down closes it (`nest_swipe`) |

The buttons' labels are English (`Expand to full page`, `Exit full page`, `Dock`, `Retry`,
`Close`), set by the script, with no option to change them.

### Closing, parking, resuming

Closing fades the panel out in 300 ms. With `nest_keepalive`, a panel that showed a page is then
parked (`is-parked`, hidden, the iframe alive): opening the page it shows - or the page it was
opened with, unless a form was sent from it since - brings it back as it was left, half-filled
forms included. Opening another page discards it; one session at most is parked. With
`nest_remember`, the panel's place, size and dock are kept in `localStorage` at each close and at
`pagehide`, and given back at the next open.

### Classes of the nest

`#transparent-nest`: `is-loading`, `is-entering`, `is-error`, `is-busy` (the nested page is
navigating: its `<html>` has `loading`), `is-closing`, `is-parked`, `is-full`, `is-docked`,
`is-container-docked`, `is-hidden`, `is-movable`, `is-dragging`, `is-host-dragging`,
`is-swiping`, `is-chrome-peek`, `is-chrome-inside`, `data-dock-edge`. Its parts:
`.transparent-nest-panel` (`role="dialog"`, `aria-modal`; `is-free` once moved or resized),
`.transparent-nest-chrome`, `.transparent-nest-busy`, `.transparent-nest-grab`,
`.transparent-nest-btn`, `.transparent-nest-handle-n` ... `-sw`, `.transparent-nest-body` (the
iframe), `.transparent-nest-spinner`, `.transparent-nest-error`. On `<html>`: `nested`,
`nest-docked`, `nest-loading`. All are styled by `src/css/navigation.scss`.

### Events of the nest

`CustomEvent`s on `window`; `detail.href` is the page the panel shows.

| Event | `detail` |
| --- | --- |
| `transparent:nest:loading` | `{href, fresh}`: a page is being fetched (`fresh`: the panel was not open) |
| `transparent:nest:fade-in-start`, `:fade-in-end` | `{href}` |
| `transparent:nest:open`, `:navigate` | `{href}`: the page is shown, first or next |
| `transparent:nest:navigated` | `{href, committed}`: the nested page moved on (`committed`: full page, the address bar follows) |
| `transparent:nest:busy`, `:idle` | `{href}` |
| `transparent:nest:error`, `:retry` | `{href, fresh}`, `{href}` |
| `transparent:nest:move`, `:resize` | `{href, rect}` (the panel's `DOMRect`) |
| `transparent:nest:dock` | `{href, edge, target}` (`edge` `null` for a floating dock, `target` the selector of `nest_dock_target`) |
| `transparent:nest:restore`, `:hide`, `:show` | `{href}`, `{href, edge}` |
| `transparent:nest:share` | `{href}`: full page |
| `transparent:nest:esc`, `:esc-confirmed`, `:esc-cancelled` | `{href}` |
| `transparent:nest:backdrop`, `:swipe-close` | `{href}` |
| `transparent:nest:fade-out-start`, `:fade-out-end` | `{href}`, `{href, parked}` |
| `transparent:nest:close` | none |
| `transparent:nest:resume` | `{href}`: a parked session came back |
| `transparent:nest:leave` | `{href}`: the panel was left for a host page |

### API of the nest

| Member | Effect |
| --- | --- |
| `Transparent.nest.open(href)` (`Transparent.openNest`) | opens the page in the panel (navigates the open panel, resumes a parked one) |
| `Transparent.nest.navigate(href)` | shows another page in the open panel |
| `Transparent.nest.close(goBack)` (`Transparent.closeNest`) | closes; `false`: without stepping back over the panel's history entry |
| `Transparent.nest.isOpen()` (`Transparent.isNested`) | `true` while a panel is open (not closing, not parked) |
| `Transparent.nest.getContainer()` | `#transparent-nest`, or `null` |
| `Transparent.nest.inScope(href)` | whether the path matches `nest` |
| `Transparent.nest.leave(href)` | closes the panel and navigates the host to `href` (called from inside) |
| `Transparent.nest.prefetch(href)` | the hover prefetch |
| `Transparent.nest.notifyReady()` (`Transparent.notifyNestReady`) | called by the nested page: show it now |
| `Transparent.nest.notifyNavigated(href, title, info)` | called by the nested page's navigation after each of its swaps |
| `Transparent.nest.owns(event)` | whether a `popstate` belongs to the nest |
| `Transparent.nestCanReplay(href)`, `Transparent.nestReplay(href)` | inside the iframe: whether a page can be given back from its cache, and doing it |

```html
<!-- in the nested page: a close button of its own, and "shown" said explicitly -->
<button type="button" onclick="parent.Transparent.closeNest(); return false">Close</button>
<script>addEventListener('load', () => parent.Transparent && parent.Transparent.notifyNestReady());</script>
```

## Attributes and classes, all of them

| Attribute or class | On | Effect |
| --- | --- | --- |
| `identifier` (`#page`) | the block | swapped |
| `data-layout` | the block | its layout: `new`, `same`, `<previous>-to-<next>` |
| `data-layout-prev` | the block (set) | the layout it replaced |
| `data-name` | the block | another name than the current page's: the browser loads the page |
| `rel="prefetch"` | a link | prefetched on hover or touch |
| `data-skip-hash` | a link to an anchor | the hash is not written in the address |
| `target="_blank"` | a link | the browser's |
| `class="reload"` | a form, its submit button | the browser submits it |
| `class="skip-validation"` | a submit button | the browser's validation is skipped |
| `was-validated` | a form (set) | the browser refused it |
| `data-no-persist` | a form, a field | not kept by the form memory |
| `data-restored-from-draft` | a field (set) | given back by the form memory |
| `data-edjs` | a textarea | Editor.js's value, given back too |
| `data-headlock` | a head element | kept across swaps (`"false"`: not) |
| `data-track="reload"` | a head script or link | a change of these loads the page in the browser |
| `data-src`, `loading`, `loaded`, `error`, `.lazybox` | a picture, its box | the lazy loading |
| `reload`, `disable` | `<html>` of an answer | the browser reloads |
| `disable` | `<html>` when the script loads | the navigation is off |
| `#loader` (`loader`) | any element | its CSS times give the phases' length |

## Methods

Beside `ready(options)` and `configure(options)` (both return `Transparent`):

| Method | Returns, does |
| --- | --- |
| `isRescueMode()` | `true` after a rescue |
| `rescue(dom)` | replaces the document with `dom`'s head and body and runs their scripts |
| `getData(uuid)`, `setData(uuid, data)` | the data of a history entry (`{}` when none) |
| `getResponse(uuid)` | `[html, positions]` of a cached page; `getResponseText(uuid)`, `getResponsePosition(uuid)` each half |
| `setResponse(uuid, html, positions)`, `setResponseText`, `setResponsePosition` | caches a page (an `<html>` element also goes to the memory cache) |
| `hasResponse(uuid)` | whether `sessionStorage` has it |
| `invalidateResponses()` | drops every cached page |
| `getLiveResponse(uuid)`, `setLiveResponse(uuid, html, positions)`, `clearLiveResponse()` | the memory cache (a copy is returned) |
| `prefetch(href)`, `getPrefetched(href)`, `setPrefetched(href, html)`, `clearPrefetched()`, `claimPrefetch(href, callback)` | the prefetch cache |
| `getLayout(dom)`, `addLayout()`, `isKnownLayout(dom)` | the block's `data-layout`, noting it as seen, whether it was |
| `isPage(dom)`, `isCompatiblePage(dom, method, data)` | whether `dom` has the block; whether it can be swapped in |
| `findLink(event)` | `[method, URL, element or data]` of an interaction, or `null` |
| `findNearestForm(element)`, `formInvalidity(form)`, `refuseInvalidForm(form, element)` | a control's form; `["name: message", ...]`; the refusal described above |
| `scrollTo({top, left, duration, ...}, element, callback)` | the core's scroll, a tick later (see [the core](core.md)) |
| `scrollToHash(hash, options, callback, element)` | scrolls to `hash`'s element under the scroll padding |
| `getScrollableElement(root)`, `getScrollableElementXY()` | the scrolling elements (jQuery set, document order), their `[top, left]` |
| `getReloadPosition()` | `{top, left}` of a reload, or `null` |
| `lazyLoad(images)`, `findImages()`, `loadImages()` | the lazy loading; every picture URL of the page; a promise of those that load within 500 ms |
| `activeIn(callback)`, `activeOut(callback)`, `activeTime(element)`, `callback(fn, delay)` | the phases; `{delay, duration}` in ms of an element's CSS |
| `onLoad(uuid, dom, callback, scrollTo, keepScroll)` | the swap itself |
| `replaceCanvases(dom)`, `transferAttributes(dom)`, `adoptNode(node, target)`, `whenScriptsSettled(callback)`, `evalScript(element)` | its steps |
| `preload({as: [urls]}, callback)` | adds `<link rel="preload" as crossorigin>` for each URL, calls back when all have loaded |
| `isHeadlocked(element)` | whether a head element stays across swaps |
| `isElement(object)`, `findElementFromParents(dom, parents, from)` | helpers |
| `parseDuration`, `debounce`, `userScroll`, `remToPixel`, `emToPixel`, `parseToPixel`, `getScrollPadding` | the core's (see [the core](core.md)); `percentToPixel(p, element)`: `p` times the element's outer width |

Properties: `Transparent.settings`, `Transparent.state` (the state class names), `Transparent.html`
(`<html>` as jQuery), `Transparent.loader`, `Transparent.persistentClasses`,
`Transparent.formMemory`, `Transparent.nest`, `Transparent.version` (`"3.0.31"`, the line of
@glitchr/transparentjs it continues), `liveDomCacheMax`, `liveDomCacheTTL`.

## What the server sees

| Request | Headers |
| --- | --- |
| a navigation | `X-Requested-With: XMLHttpRequest`, the `headers` option; a POST's fields as `multipart/form-data` |
| a prefetch | `X-Purpose: prefetch`, `Purpose: prefetch` |
| a nest page | `X-Requested-With: XMLHttpRequest`; the answer must carry `X-Transparent-Nest` |

A server can answer a navigation as it answers a browser: the same HTML page, any status. It can
also answer a form's request with JSON (`Content-Type: application/json`, exactly), for instance
`{"code": "302", "target": "/thanks"}`.

## The progress bar (1.6)

The bar never blinks. A navigation that completes within `progress_bar_delay`
(200ms: a page from the cache, a static host a few dozen ms away) shows no bar
at all; one that takes longer shows it - `html.progress-bar-shown` - for at
least `progress_bar_min`, then finishes it - `html.progress-bar-done`, the bar
filled and fading over `progress_bar_finish` - and it goes. Up to 1.5 the bar
was drawn for as long as `html.loading` was set, a few frames on a cached page:
a flash at the top of the screen at each click. `transparent:progress` is
dispatched at each step (`detail.state`: `shown`, `done`, `hidden`), for an
indicator of a site's own on the same timing (with `progress_bar: false`).

Its look is CSS, custom properties on `:root` (or `html`):

| Property | Default | Meaning |
| --- | --- | --- |
| `--transparent-bar-height` | `3px` | |
| `--transparent-bar-color` | `#2563eb` | the streak's colour, and the finished bar's |
| `--transparent-bar-background` | a streak of the colour | any background: a gradient |
| `--transparent-bar-size` | `50% 100%` | the background's size: how wide the streak is |
| `--transparent-bar-duration` | `1s` | one sweep |
| `--transparent-bar-done` | the colour | the finished bar's fill |
| `--transparent-bar-z` | `100001` | |

A rainbow that runs along the top:

```css
:root {
    --transparent-bar-height: 4px;
    --transparent-bar-background: linear-gradient(90deg, #ff3b30, #ff9500, #ffcc00, #34c759, #5ac8fa, #007aff, #af52de, #ff3b30);
    --transparent-bar-size: 200% 100%;
    --transparent-bar-duration: 1.4s;
    --transparent-bar-done: linear-gradient(90deg, #ff3b30, #ffcc00, #34c759, #007aff, #af52de);
}
```

## A website in the website: FlowFrame (1.6)

`src/js/frame.js` (global `FlowFrame`, also `Transparent.frame`; part of the
navigation entry, no jQuery): a frame of the page whose links and forms load
their page in the background and swap it into the frame alone - the visitor's
page, its address and its history stay as they are.

```html
<div data-flow-frame="tour" data-flow-frame-src="/tour/start">
    <form data-flow-frame-go>
        <button type="button" data-flow-frame-back aria-label="Back">←</button>
        <button type="button" data-flow-frame-forward aria-label="Forward">→</button>
        <input data-flow-frame-address aria-label="Address">
    </form>
    <div data-flow-frame-view>…the first page's block…</div>
</div>
```

- A link of the view (same origin, no `target`, no `download`, no modifier
  key, no `data-flow-frame-ignore`) or a form is fetched; the block of the
  answer the `select` option names (`[data-flow-frame-page]`, the whole body
  without one) is swapped into the view, whose scroll goes back to the top.
  Transparent, whose listener is the document's, never hears the click.
- The frame keeps its own history: `[data-flow-frame-back]` and
  `[data-flow-frame-forward]` go through the pages it showed, given back from
  memory where their scroll was left; `[data-flow-frame-address]` says the
  frame's page and, in a `[data-flow-frame-go]` form, takes another (same
  origin only); `[data-flow-frame-reload]` fetches it again.
- **The browser's Back is not the frame's**: the window's history is not
  touched, so Back leaves the page that holds the frame, as it would leave any
  page - the frame is a part of the page, not a tab of its own.
- A page shown in a frame runs no script and its head is not read (the host
  page's styles apply): a frame shows pages written for it, or the site's own.
- `flow:frame:load` (it bubbles; `{url, title, frame}`) after each page - the
  moment to set up what it holds; `flow:frame:error` (`{url, status}`) when no
  page came. While a page takes longer than `delay` (200ms) the frame carries
  `.flow-frame-loading`, at least `min` (300ms): the progress bar's timing.
- Frames are found by themselves (`[data-flow-frame]`, at load and after each
  navigation); `FlowFrame.attach(element, {select, delay, min, headers})` for
  options, `FlowFrame.get(element)` for its frame (`go(url)`, `back()`,
  `forward()`, `reload()`).

Unlike `nest` (an iframe panel opened over the site), a frame is in the page,
inline, and needs nothing of the server: a static site has them too.

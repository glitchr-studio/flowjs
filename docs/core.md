---
title: Flow (core)
order: 10
---

# Flow (core)

`src/js/core.js` - what every module shares, once: the units and durations, the scrollers, one
native listener per scroller and per kind, the one animation frame in which the modules measure,
the programmatic scroll, the address's hash, the moments a page is (re)loaded, and the jQuery
plugins. It needs nothing; it uses jQuery when there is one.

Every entry point loads it first. Under a bundler a module asks for it as `require('./core.js')`;
in a page it is loaded by a `<script>` before the modules, which find it as `window.Flow`:

```html
<script src="jquery.js"></script>          <!-- for the modules that need it -->
<script src="src/js/core.js"></script>
<script src="src/js/stops.js"></script>
```

Loaded twice (two bundles of one page), the second copy finds `window.Flow` (`Flow.core === true`)
and hands it back: there is one core per page, one set of listeners, one frame. Each module
registers itself on it: `Flow.navigation`, `Flow.sticky`, `Flow.stops`, `Flow.sortable`,
`Flow.ajaxer`, `Flow.cookie`.

> [!WARNING]
> Known defect: `Flow.version` reads `1.3.1` (`src/js/core.js:28`), where the package is at
> 1.5.4: the number was not raised with the releases. Read the version from `package.json`.

## jQuery

`Flow.jquery()` returns jQuery, or `null` when the page has none. It looks for it when first asked
(the bare `jQuery` identifier a bundler's `ProvidePlugin` gives, else `window.jQuery`), so a jQuery
loaded after `core.js` is still found. The first time it finds one it installs the
[jQuery plugins](#jquery-plugins), once.

What changes with jQuery and without:

| | With jQuery | Without |
|---|---|---|
| `Flow.scrollTo` with a `duration` or a `speed` | animated (`$.fn.animate`, the `easing` named) | at once, whatever the duration |
| the `user-scroll` flag | a jQuery property (`$(el).prop('user-scroll')`) | a property of the element |
| the plugins | installed | none |

## Time and durations

| Function | Returns |
|---|---|
| `Flow.now()` | `performance.now()` (or `Date.now()` without it), in ms |
| `Flow.parseDuration(value)` | a duration in **seconds**: `"250ms"` gives 0.25, `"1s"` 1, `"0.3"` 0.3 (a bare number is seconds). Several separated by a comma and a space (`"1s, 250ms"`, as `getComputedStyle` writes transition durations): the longest |
| `Flow.debounce(fn, wait, immediate)` | a function that calls `fn` once `wait` ms have passed without a call; with `immediate`, at the first call and not after |

Every duration option of the modules (`"250ms"`, `"2s"`) is read with `parseDuration`.

## Units

| Function | Returns |
|---|---|
| `Flow.parseToPixel(value, el)` | px from `"90"`, `"90px"`, `"2rem"` (the root's font size), `"1.5em"` (the font size of `el`'s parent), `"15%"`; several separated by a comma and a space: the largest. `undefined` gives `undefined` |
| `Flow.toPixels(value, el, fallback)` | one value to px: `"90"`, `"90px"`, `"2rem"`, `"1.5em"` (the font size of `el` itself); empty or unreadable gives `fallback`. A `%` is not read: `"15%"` gives 15 |
| `Flow.remToPixel(rem)`, `Flow.emToPixel(em, el)`, `Flow.percentToPixel(p, el)` | the three conversions `parseToPixel` uses |
| `Flow.scrollPadding(el)` | the `scroll-padding` of an element (the `<html>` element by default, also for `window` and `document`), `{top, left, right, bottom}` in px, each side read with `parseToPixel` (0 when unreadable) |
| `Flow.viewport()` | the viewport's `{width, height}`: the larger of the root's client size and the window's inner size, read once per frame |

> [!WARNING]
> Known defect: a percentage is multiplied by the width without being divided by 100:
> `Flow.parseToPixel('15%')` gives 15 times the window's width (15000 in a window 1000 px wide),
> `percentToPixel` likewise, and so a `scroll-padding-top: 10%` on `<html>` reads as
> `Flow.scrollPadding().top === 10000` (checked in headless Chrome), where 15 % of the width
> (150) and a tenth of it (100) are expected. Every module that reads the scroll padding or
> `data-sticky-offset-*` through it inherits this; write the scroll padding in px, rem or em.

## Scrollers

A scroller is the window (the page) or an element whose content overflows and whose `overflow`
scrolls (`scroll` or `auto`). Everywhere an element is taken, a jQuery object is accepted too (its
first element is meant).

| Function | Returns |
|---|---|
| `Flow.isScrollableNode(node)` | whether this one node scrolls: content larger than its box on an axis whose overflow is `scroll` or `auto`; the `<html>` element as soon as its content is larger (`window` and `document` mean it) |
| `Flow.closestScrollable(el)` | the element itself when it scrolls, else its closest ancestor that does, else `<html>` when the page scrolls, else `undefined` - also for an element no longer in the page |
| `Flow.normalize(scroller)` | `window` for nothing, `document`, `<html>` or `<body>`; the element otherwise: the key the listeners are kept under |
| `Flow.element(scroller)` | the element to read `scrollTop` from and to scroll: `<html>` for the window |

## Listeners

One native listener per scroller and per kind, however many modules listen. Scroll and resize
callbacks run together in [the frame](#the-frame), after the browser has laid the page out, with
the last event of the frame; an interruption by the reader is told at once, so that a glide stops
under their finger.

| Function | Calls |
|---|---|
| `Flow.onScroll(scroller, fn)` | `fn(event, scroller)` once per frame in which the scroller scrolled (`scroll`, passive). The window for the page. Returns `fn` |
| `Flow.offScroll(scroller, fn)` | stops; the native listener goes with the last callback |
| `Flow.onInterrupt(scroller, fn)` | `fn(event, scroller)` at once when the reader takes over on the scroller: `wheel`, `touchstart` or `mousedown` (`Flow.INTERRUPT`), passive |
| `Flow.offInterrupt(scroller, fn)` | stops |
| `Flow.onResize(fn)` | `fn(event)` once per frame in which the window was resized (`resize`, `orientationchange`) |
| `Flow.offResize(fn)` | stops |

A function added twice to the same scroller is called once. At each `transparent:load` the
listeners of a scroller that left the page with the page the navigation swapped out are removed:
kept, each page visited would stay in memory through them.

```js
var onScroll = Flow.onScroll(window, function (event, scroller) {
    var top = Flow.element(scroller).scrollTop;      // read in the frame, after layout
    progress.style.width = 100 * top / (document.documentElement.scrollHeight - innerHeight) + '%';
});
// later
Flow.offScroll(window, onScroll);
```

## The frame

`Flow.frame(fn)` queues `fn(time)` for the next animation frame and returns it. Every function
queued runs in that one `requestAnimationFrame`, each once however often it was queued, in the
order queued. Queued from inside the frame (a scroll heard there queues what it draws), it runs in
the same frame after the others, unless it has run in this frame already: then it runs in the
next. An exception thrown by one does not stop the others (it is thrown again outside the frame).
`Flow.cancelFrame(fn)` takes it out of the queue.

Run in headless Chrome: `Flow.frame(a); Flow.frame(a); Flow.frame(() => { b(); Flow.frame(c); })`
calls `a`, `b`, `c`, in that order, in one frame.

## Programmatic scroll

The modules tell a scroll of their own from the reader's by two marks:

- the `user-scroll` property of the scroller, false while a script moves it;
- `Flow.scripted(scroller)`, true while a script moves it, for 250 ms after, and as long as the
  scroller stays where a script left it without a scroll listener having heard it there (after a
  swap, the frame carrying that scroll event can come late).

| Function | Effect |
|---|---|
| `Flow.userScroll(el)` | whether the reader has the scroll of `el`'s scroller (`<html>` by default): true unless a script set `user-scroll` to false; true too when nothing scrolls |
| `Flow.scripted(scroller)` | see above |
| `Flow.jump(scroller, top, left)` | puts the scroller there at once (`behavior: 'instant'`, whatever the page's `scroll-behavior`), marked as a script's move. `null` or `undefined` leaves an axis as it is |
| `Flow.scrollTo(scroller, options, callback)` | scrolls, see below |
| `Flow.release(event, scroller)` | gives the scroll back to the reader: stops jQuery's animation of the scroller, sets `user-scroll` to true, ends its movement as `interrupted` (unless the movement holds) |

### Flow.scrollTo

```js
Flow.scrollTo(window, { top: 1200, duration: '400ms', easing: 'swing' }, function (end) {
    // end: {completed, reason, top, left}
    if (end.reason === 'interrupted') console.log('the reader took over at', end.top);
});
```

| Option | Type | Default | Effect |
|---|---|---|---|
| `top`, `left` | number (px) | where the scroller is | the place to go to, clamped to what the scroller can reach |
| `duration` | duration | `0` | the time of the movement (`"250ms"`, `"1s"`); 0 or no jQuery: at once |
| `duration-x`, `duration-y` | duration | `duration` | the time along each axis: the movement goes down first, then across, each only when there is a way to go |
| `speed` | number (px/s) | `0` | instead of a duration: each axis takes its distance divided by the speed |
| `easing` | string | `'swing'` | a jQuery easing (`swing`, `linear`, or one a plugin adds) |
| `debounce` | number (ms) | `0` | the end (the callback, `user-scroll` given back) comes that many ms after the movement stopped |
| `hold` | boolean | `false` | the reader's wheel, finger or press does not stop the movement |

The callback is called once, however the movement ends, with `{completed, reason, top, left}`:

| `reason` | `completed` | When |
|---|---|---|
| `arrived` | `true` | the scroller is there (also when there was no way to go); a `scroll` event (not bubbling) is dispatched on the element scrolled - `<html>` for the page |
| `interrupted` | `false` | the reader took over (a wheel, a finger, a press) |
| `replaced` | `false` | another `Flow.scrollTo` of the same scroller began |

While it moves the scroller's `user-scroll` is false; it is true again at the end unless the
callback began another movement. An animation something else stopped (a site's own `.stop()`,
frames that never came) is not waited for: a second past its time, the scroller is put where it
was going and the movement ends `arrived`.

> [!WARNING]
> Known defect: with `speed`, a movement up (or left) to a place other than the top (or the left
> edge) takes the time of the whole distance from the top, not of the way to go
> (`src/js/core.js:479-480`): from 3000 to 2000 at 1000 px/s it took 3012 ms in headless Chrome,
> where 1 s is expected; down, from 1000 to 2000, it took 1014 ms.

> [!WARNING]
> Known defect: the core gives the scroll back only on the window: its one interrupt listener is
> on `window` (`src/js/core.js:565`), and `Flow.release` then stops the page's movement. A
> `Flow.scrollTo` of an element scroller goes on under a wheel on that element (it ended
> `arrived` in headless Chrome), where the reader's wheel, finger or press is expected to stop it.
> The sticky module registers `Flow.onInterrupt(element, Flow.release)` for the scrollers it
> animates; a script of a site's does the same for its own:
> `Flow.onInterrupt(box, Flow.release)`.

## The hash

`Flow.replaceHash(hash, triggerHashChange = true, skipIfEmptyIdentifier = true)` changes the
address's `#hash` without a history entry (`history.replaceState`, keeping the query string and
the history state, `href` set to the new address). It returns true when the address changed.
`window.replaceHash` is the same function.

- `hash` with or without its `#`.
- No element with that id, or the new element contains the current hash's element (going "up" to
  a section that holds where the reader is): `hashfallback` (a `HashChangeEvent`, with `oldURL`
  and `newURL`) is dispatched on `window`, and the hash is emptied (no element) or left as it is
  (the containing section).
- An empty hash with `skipIfEmptyIdentifier`: `hashfallback`, and the hash is emptied.
- When the address changed and `triggerHashChange` is true: `hashchange` (a `HashChangeEvent`) is
  dispatched on `window`.
- Inside a `srcdoc` frame (a nested panel of the navigation), where the state may not be
  replaced, the address stays and the events are still dispatched.

Run in headless Chrome on a page with an `#anchor` element: `replaceHash('anchor')` true, the hash
`#anchor`, one `hashchange`; `replaceHash('missing')` true, the hash emptied, `hashfallback` then
`hashchange`; `replaceHash('')` false, `hashfallback`.

## The page's moments

`Flow.onPage(fn)` calls `fn(moment)` at each moment a page is in, and returns `fn`:

| `moment` | When |
|---|---|
| `'ready'` | at once, when `onPage` is called after the document was parsed |
| `'DOMContentLoaded'` | the document parsed |
| `'load'` | the page loaded |
| `'transparent:load'` | each page the navigation swapped in place |

A module that needs the page's elements attaches there, and is attached again after every
navigation without knowing there was one. `Flow.offPage(fn)` stops. Registered in the `<head>`, a
function hears `DOMContentLoaded` then `load`; registered after the page loaded, `ready` only
(then each `transparent:load`).

```js
Flow.onPage(function (moment) {
    document.querySelectorAll('.gallery:not(.is-ready)').forEach(startGallery);
});
```

## jQuery plugins

Installed once, the first time `Flow.jquery()` finds jQuery (each module asks):

| Plugin | Effect |
|---|---|
| `$.event.special.touchstart`, `touchmove` | jQuery's listeners for them are passive, unless the event's namespace contains `noPreventDefault` (`.on('touchmove.noPreventDefault', ...)`: then a handler may call `preventDefault()`) |
| `$.event.special.wheel`, `mousewheel` | always passive |
| `$(form).serializeObject()` | the fields as an object; a name given several times becomes an array |
| `$(el).isScrollable()` | whether one of the elements scrolls (`Flow.isScrollableNode`) |
| `$(el).isScrollableX()`, `isScrollableY()` | a jQuery set of booleans, one per element, for one axis |
| `$(el).closestScrollable()` | the set of `Flow.closestScrollable` of each element |
| `$(el).closestScrollableWindow()` | the same, `window` in place of `<html>` |
| `$(el).repaint(duration = 1000, reiteration = 5)` | forces the elements to be laid out again, now and `reiteration` times over `duration` ms (a browser that leaves a stale paint) |

The special events change how every jQuery listener of the page for these events is added, the
site's included: a site's `$(el).on('touchmove', fn)` that calls `preventDefault()` needs the
`noPreventDefault` namespace.

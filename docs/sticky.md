---
title: Sticky and stops
order: 30
---

# Sticky and stops

`src/js/sticky.js` (global `Sticky`) and `src/js/stops.js` (global `StickyStops`). The options of Sticky are listed in the README and in `Sticky.settings`; this page describes the address following the reading and the scroll stops, then every option, class, attribute, event and method of each (Sticky needs jQuery and the core; the stops need the core only).

## The address follows the reading

With `replacehash` on (the default), the page's address carries the `#id` of
the headline being read: `.sticky-headlines[id]`, any `[id]` inside a
`.sticky-headlines`, or a `.sticky-magnet[id]` (`.sticky-headlines-skip` left
out). A headline is being read once it has reached where its own link would
land it - the scroller's `scroll-padding-top` plus the headline's
`scroll-margin-top` - and until it has scrolled out of sight. At the top, with
none reached, the address has no hash. The change is a `history.replaceState`:
it adds nothing to the history.

```html
<section id="menus" class="sticky-headlines" style="scroll-margin-top: 4rem">…</section>
```

## The header that hides, the magnets

A `.sticky-top` element hides as the page scrolls down past it and shows again
on the way up (the classes `show` and `skip-transition`, an inline `top`),
unless `scrollhide` is `false` or the element carries
`aria-scrollhide="false"`. Up to 1.0.2 (and since stickyjs' 2022 versions) the
library itself wrote that attribute on every scroll, and no header ever hid: a
site that had come to count on its header staying sets `scrollhide: false` in
`Sticky.ready()`, or the attribute in its template.

`Sticky.getMagnets(el)` gives the `.sticky-magnet` elements of `el`, top to
bottom, as `{element, offsetTop, offsetLeft, visible}` (`visible`: the share
of its scroller's box the magnet fills, 0 to 1); `.sticky-magnet-first`,
`-prev`, `-next` and `-last` scroll to them (`Sticky.scrollToNextSnap()`...).

With `scrollsnap` (and `passive: false`), a scroll of the reader's that leaves
a magnet takes the page to the next one in its direction. On the way `<html>`
carries `.sticky-prevent-scroll` (`overflow: hidden`) and the movement holds
the scroll: a wheel on the way neither stops it nor adds to it, so a quick
gesture leads one magnet further, not two. The class is taken off `debounce`
after the movement ended, however it ended.

### A way the reader may take: `scrollsnap_hold` (1.1)

`scrollsnap_hold` (`true`) is that held way. Set to `false`, the way to a
magnet is the reader's to take: nothing is set on `<html>`, and a wheel, a
finger, a press or a key on the way stops the page where it is and gives the
scroll back at once. The snap does not start again against that gesture: it
waits until the scroll has been quiet for `debounce`, then acts as it always
does, at the reader's next scroll. The option is the library's, read each time
a way begins: `Sticky.ready({...})` or `Sticky.set("scrollsnap_hold", false)`.

```js
Sticky.ready({ scrollsnap: true, passive: false, scrollsnap_hold: false });
```

### The arrow keys: `scrollsnap_keys` (1.1)

`scrollsnap_keys` (`false`): the arrows go from magnet to magnet, with the
snap's movement (`smoothscroll_duration`, `smoothscroll_easing`) and the way
`scrollsnap_hold` says. <kbd>↓</kbd> / <kbd>↑</kbd> where the magnets follow
each other down a scroller - the page, most often -, <kbd>→</kbd> /
<kbd>←</kbd> where they follow each other across one (a row with
`overflow-x: auto` holding `.sticky-magnet` children). The scroller is the one
the key is pressed in (the focus inside it, or the pointer over it), the page
otherwise; a magnet is met under the scroller's `scroll-padding`, and a
scroller's magnets are its own: the page's keys never count a row's.

```html
<section class="sticky-magnet">…</section>
<section class="sticky-magnet">
    <div class="row" tabindex="0" style="display: flex; overflow-x: auto">
        <article class="sticky-magnet">…</article>
        <article class="sticky-magnet">…</article>
    </div>
</section>
<script>Sticky.ready({ scrollsnap: true, scrollsnap_keys: true });</script>
```

Down goes on to the next magnet, up back to the one being read, then to the
one before. Two presses in a row lead two magnets further (the second goes on
from where the first was going); a key held down goes one magnet at a time,
each way finished first. The key is left alone - to the browser, or to the
page - past the last magnet and before the first, along an axis where no
magnets follow each other, in a field (`input`, `textarea`, `select`,
`contenteditable`), on a widget with keys of its own (a slider, tabs, a menu,
audio, video), in an open `<dialog>`, with Shift, Alt, Ctrl or Meta held,
inside an element that scrolls by itself along that axis, and when a handler
of the page took it (`preventDefault`): the library listens on the window, in
the bubble phase. The keys do not need `passive: false`: they work with or
without the snap under the wheel. `Sticky.getMagnetPositions(scroller, axis)`
gives the scroll positions the keys go through (`"y"` by default).

The buttons (`.sticky-magnet-prev`, `-next`...) are as they were. For
`.sticky-stop` sections, the same keys are the stops' `keys` option, below.

`Sticky.scrollTo(dict, callback, el)` and `Flow.scrollTo(el, dict, callback)`
call back once, whatever becomes of the movement, with
`{completed, reason, top, left}`: `"arrived"` (also when there was no way to
go), `"interrupted"` (the reader took over: a wheel, a finger, a press),
`"replaced"` (another scroll of the same scroller began) or, from
`Sticky.scrollTo` only, `"refused"` (a script had the scroll already). What a
caller sets for the time of a movement, it lifts in the callback; what it does
on arrival only, it does when `completed`. `{hold: true}` in `dict` makes a
movement the reader's gesture does not stop.

The effects run once per frame in which the scroller scrolled, through the
core, and once when the page is loaded. `Sticky.trigger(el)` runs them now,
as `$(window).trigger('scrolldelta.sticky')` did in stickyjs; a page's own
`scrolldelta` handlers (jQuery) still receive the computed event.

## Loading Sticky

```js
import '@glitchr/flowjs/sticky';       // Sticky, its stylesheet, the stops and the core
Sticky.ready({ scrollsnap: true, passive: false, scrollsnap_keys: true });
```

Without a bundler: jQuery, `src/js/core.js`, then `src/js/sticky.js` (it throws "load core.js
first" or "jQuery is needed" otherwise), and `src/css/sticky.scss` compiled. The `sticky` entry
also loads `stops.js`. Loaded, the module:

- runs its load pass (`Sticky.onLoad()`) at once when the document is parsed already, else at
  `DOMContentLoaded` - which the navigation dispatches again after each swap, so the pass runs on
  every page;
- hears the window's scroll through the core, once per frame, and the `.sticky-scrollpercent`
  scrollers it finds;
- at `beforeunload` (the browser's, and the one the navigation dispatches before a swap) stops
  hearing the window and forgets its measurements until the next load pass.

`Sticky.ready(options)` sets the options (as `Sticky.configure`), marks the module ready and
dispatches `sticky:ready` on `window`. The load pass marks it ready too: `ready()` is for setting
options, not a condition for the effects to run.


## Options (`Sticky.settings`)

Set with `Sticky.ready({...})`, `Sticky.configure({...})` or `Sticky.set(key, value)`; read with
`Sticky.get(key)` (`null` for a key that is not set). The effects read them as they run, so a
change applies from the next scroll. Durations are read with
[`Flow.parseDuration`](core.md#time-and-durations) (`"250ms"`, `"2s"`, a bare number is seconds).

| Option | Type | Default | Effect |
|---|---|---|---|
| `debounce` | duration | `"500ms"` | how long after a scroll the measurements are forgotten (`Sticky.reset`), and how long after a magnet's way the snap waits before it may act again |
| `threshold` | duration | `"5000ms"` | `.sticky-bottom`: how long the reader must push against the bottom of the page before the bar shows; how long against the top before it goes |
| `scrollcatch` | boolean or z-index | `false` | `.sticky-top`: when the header has scrolled to the top, a clone takes its place and the header turns `position: fixed` at that z-index (`true`: its own). `aria-scrollcatch` on the element says it for that one |
| `scrolllock` | boolean | `true` | during a held way to a magnet, the wheel and the finger move nothing: `wheel` (`mousewheel` where there is no `wheel` event) and `touchmove` listeners on the window, not passive, prevent their default until the page is given back (`Sticky.disableScroll()` / `Sticky.enableScroll()`; `Sticky.allowScrolling()` is false meanwhile). The keys are not blocked: the page's overflow is hidden meanwhile, and a magnet key has its own rules. Checked in Chromium; written against the DOM spec, not checked in Firefox |
| `scrollhide` | boolean | `true` | `.sticky-top` hides on the way down and shows on the way up (`aria-scrollhide="false"` on one keeps it in place); `.sticky-bottom` is handled only while it is on |
| `scrollhint` | number 0..1 | `0.25` | `.sticky-bottom`: the share of `threshold` after which the bar shows a hint (class `hint`; a click on it shows the bar); `0`: no hint |
| `overscroll` | object | `{top: false, bottom: false, left: false, right: false}` | written by the module (with `passive: false`, from the wheel at an edge): the page is pushed past that edge; set by hand for a browser that sends no scroll event there |
| `passive` | boolean | `true` | `false` lets the module listen to the wheel (`wheel.sticky`, for the overscroll) and turns the magnets' snap on |
| `scrollpercent` | boolean | `true` | the `.sticky-scrollpercent-*` triggers and their `scrollpercent` events |
| `scrollsnap` | boolean | `true` | the magnets: the snap (with `passive: false`), the `.sticky-magnet-*` buttons, the keys (with `scrollsnap_keys`) |
| `scrollsnap_proximity` | number 0..1 | `0.01` | the share of the screen a magnet must fill to be a candidate for the snap |
| `scrollsnap_hold` | boolean | `true` | the way to a magnet holds the scroll (`.sticky-prevent-scroll` on `<html>`); `false`: the reader's gesture stops it. See [A way the reader may take](#a-way-the-reader-may-take-scrollsnap_hold-11) |
| `scrollsnap_keys` | boolean | `false` | the arrows go from magnet to magnet. See [The arrow keys](#the-arrow-keys-scrollsnap_keys-11) |
| `swipe` | boolean | `true` | `.sticky-swipe` elements dispatch `sticky.swipe_left` and `sticky.swipe_right` |
| `swipe_timegate` | duration | `"1s"` | the longest a swipe may take: a number of ms, `"1s"`, `"250ms"` (read with `Flow.toMilliseconds`, 1.6) |
| `swipe_threshold` | number (px) | `200` | the least a finger must travel sideways for a swipe (and at most 100 px up or down) |
| `swipehint` | boolean | `true` | `.sticky-swipehint` elements get `sticky-swipehint-reveal` after `swipehint_delay`, lost at their first scroll; `.sticky-swipehint-container` gets an `<img>` of its `data-image` |
| `swipehint_delay` | duration | `"1s"` | before the hint is revealed |
| `swipehint_debounce` | duration | `0` | when not 0, the hint comes back that long after the element's scroll stopped |
| `autoscroll` | boolean | `true` | `.sticky-autoscroll` blocks scroll by themselves (both axes unless `data-autoscroll-x` / `-y` say otherwise) |
| `autoscroll_bouncing` | boolean | `true` | at the end, the block scrolls back, then over again |
| `autoscroll_speed` | number (px/s) | `100` | the speed of the autoscroll |
| `autoscroll_delay` | duration | `"2s"` | before the autoscroll starts, and again after the reader left the block |
| `autoscroll_easing` | string | `"linear"` | the jQuery easing of the autoscroll |
| `autoscroll_minwidth`, `autoscroll_minheight` | number (px) | `200`, `400` | a block that scrolls less than that along an axis is not autoscrolled along it |
| `autoscroll_startover` | boolean | `true` | after the reader's pointer or finger left the block, the autoscroll starts again (`false`: it stops for good) |
| `autoscroll_delay_reverse` | duration | `"3s"` | before a block marked to start reversed scrolls to its end first |
| `autoscroll_reverse` | boolean | `false` | the block scrolls from its end towards its start |
| `autoscroll_mouse_action` | boolean | `true` | a wheel, the pointer entering or a finger on the block stops its autoscroll |
| `smoothscroll_duration` | duration | `"250ms"` | the movement to a magnet (the snap, the buttons, the keys) |
| `smoothscroll_speed` | number (px/s) | `0` | instead of the duration, when not 0 |
| `smoothscroll_easing` | string | `"swing"` | the jQuery easing of that movement |
| `easein` | number (px) | `"100px"` | `.sticky-easein`: a margin around the screen - the block shows once it is closer than that to entering it; negative, once it is that far inside (at most its own height) |
| `easeout` | number (px) | `"50px"` | `.sticky-easeout`: the block is hidden once it is farther than that out of the screen; negative, once less than that of it is still inside |
| `easetime` | duration | `"250ms"` | the duration of a fading block's opacity transition |
| `easedelay` | duration | `"250ms"` | its delay |
| `easethrottle` | duration | `"0ms"` | added to the delay of each fading block after the first, in the page's order: a cascade |
| `ready` | boolean | `true` | the effects run; the module sets it false at `beforeunload` and true again at the load pass |
| `debug` | boolean or number | `false` | prints to the console; `2` prints every scroll |
| `disable` | boolean | `false` | no effect runs; at the load pass `.sticky` elements get `sticky-disabled` |
| `replacehash` | boolean | `true` | the address follows the reading (see [The address follows the reading](#the-address-follows-the-reading)) |

Two keys are read without being declared: `autoscroll_speed_reverse` and
`autoscroll_duration_reverse` (the first movement of a block marked to start reversed; unset, it
is at once). Give them with `Sticky.set()`.

`easein` and `easeout` are read with `parseInt`: `"100px"` is 100, `"2rem"` is 2. Give px.




## Classes and attributes (Sticky)

What the page marks, and what the module sets in return.

| Mark | Effect | Set by the module |
|---|---|---|
| `.sticky-top` | a header that hides on the way down, shows on the way up | `show`, `skip-transition`, an inline `top`; with `scrollcatch`: `caught`, `aria-scrollcatch-pos`, `aria-labelledby` (the clone's id), and a clone marked `aria-scrollcatch-clone` |
| `aria-scrollhide="false"` (on `.sticky-top`) | this header stays | |
| `aria-scrollcatch="<z-index>"` (on `.sticky-top`) | `scrollcatch` for this one | |
| `.sticky-bottom` | a bar that shows when the reader pushes against the bottom of the page | `show`, `hint`, `skip-transition`, an inline `bottom` |
| `.sticky-widget` | stays in view (`position: sticky` in the stylesheet), its offset from its margins and the scroll padding | inline `top`, `margin-top`, `margin-bottom`; `skip-transition` |
| `data-sticky-offset-top`, `data-sticky-offset-bottom` (on `.sticky-widget`) | its distance from the top and the bottom, at least the scroll padding (`"2rem"`, `"90px"`) | |
| `.sticky-easein`, `.sticky-easeout` | a block that fades in as it comes into the screen, out as it leaves | `show` while shown; an inline `transition` for its opacity |
| `data-sticky-easein`, `data-sticky-easeout`, `data-sticky-easeinout` | its own `easein` / `easeout` (px) | |
| `data-sticky-easetime`, `data-sticky-easedelay` | its own `easetime` / `easedelay` | |
| `.sticky-headlines`, `[id]` inside one, `.sticky-magnet[id]` | the headlines the address follows | `highlight` on the current one and on the links to it (`a[href^="#id"]`) |
| `.sticky-headlines-skip` | a headline the address does not follow | |
| `.sticky-magnet` | a place the snap and the keys take the page to | `magnet` on the one gone to, `closest` on the candidates |
| `.sticky-magnet-first`, `-prev`, `-next`, `-last` | buttons: a click scrolls to that magnet | `show` on `-first` unless at the first magnet, on `-last` unless at the last; hidden (`display: none`) without magnets |
| `<html>` | | `sticky-prevent-scroll` during a held way to a magnet |
| `.sticky-scrollpercent` and a class `sticky-scrollpercent[-from\|-every\|-once]-<N>[u\|d\|l\|r]` | a scroller that dispatches `scrollpercent` at N % of its scroll, heading down (`d`, the default), up, left or right | |
| `.sticky-swipe` | an element that dispatches `sticky.swipe_left` / `sticky.swipe_right` | |
| `.sticky-swipehint` | a scroller that shows a hint until its first scroll | `sticky-swipehint-reveal` |
| `.sticky-swipehint-container` + `data-image="<url>"` | holds the hint's picture | a `<span><img></span>` appended |
| `.sticky-autoscroll` | a block that scrolls by itself | jQuery data `autoscroll-prevent`, `autoscroll-reverse` |
| `data-autoscroll-x`, `data-autoscroll-y` | `true` or `false`: the axes (the `autoscroll` option by default) | |
| `data-autoscroll-speed`, `-easing`, `-delay`, `-minwidth`, `-minheight`, `-startover`, `-reverse`, `-bouncing`, `-mouse-action` | the block's own `autoscroll_*` option | |
| `data-autoscroll-delay-reverse`, `-speed-reverse`, `-duration-reverse` | the first movement of a block marked reversed | |
| `data-autoscroll-prevent` | set, the block does not autoscroll | |
| `.sticky` | | `sticky-disabled` with `disable` |
| `a[href^="#"]` | a click notes where its anchor lands, so the header shows there | |

The scroll-percent class, read by its parts: `sticky-scrollpercent-every-50d` (each time the scroll
passes 50 % going down, again after it went back under), `-once-80` (the first time the scroll
reaches 80 % going down - once for the life of the window, the navigation's swaps included: the
module keeps that state for the window), `-from-20u` (at every frame of a scroll heading up while
the scroll is at 80 % or more: `u` and `l` count from the end, 100 - N).

```html
<div class="sticky-scrollpercent sticky-scrollpercent-once-90d" style="overflow-y: auto; height: 20rem">…</div>
<script>
    document.querySelector('.sticky-scrollpercent').addEventListener('scrollpercent', function (e) {
        loadMore();   // e.detail: {scroll, trigger, dir, percent}
    });
</script>
```

A class on `<html>` makes the page itself the scroller, and its events go to `window`.

## Events (Sticky)

| Event | Target | When | `detail` |
|---|---|---|---|
| `sticky:ready` | `window` | `Sticky.ready()` | none |
| `scrollpercent` | the scroller (`window` for the page), not bubbling | a scroll-percent class's mark passed | `{scroll, trigger, dir, percent}`: the computed scroll event, `0` from / `1` once / `2` every, `up` / `down` / `left` / `right`, the percentage reached |
| `sticky.swipe_left`, `sticky.swipe_right` | the `.sticky-swipe` element, not bubbling | a swipe on it | none |
| `hashchange` | `window` | the address followed the reading (a plain `HashChangeEvent`, without `oldURL` / `newURL`) | |
| `scrolldelta` (jQuery) | the scroller | a page's own `$(window).on('scrolldelta', fn)`: the jQuery special event, with the computed scroll (`deltaX`, `deltaY`, `scrollX`, `scrollY`, `scrollT`, `screen`, `first`, `last`, `reset`) | |

The module listens to `DOMContentLoaded` and `beforeunload` on `window`, the window's scroll
(through the core), `keydown` on `window` (the magnets' keys), `touchstart` and `touchend` on
`window` (the swipes), the wheel on `window` (with the option `passive: false`), clicks on the magnet buttons
and on `a[href^="#"]`.

## Methods (Sticky)

| Method | Effect |
|---|---|
| `Sticky.ready(options)` | sets the options, marks ready, dispatches `sticky:ready`; returns `Sticky` |
| `Sticky.configure(options)` | sets the options given (an `undefined` value is skipped) |
| `Sticky.get(key)`, `Sticky.set(key, value)` | read (`null` when unset), write one option |
| `Sticky.add(key, value)`, `Sticky.remove(key, value)` | add a value to (remove one from) a list option |
| `Sticky.scrollTo(dict, callback, el = window)` | [`Flow.scrollTo`](core.md#flowscrollto) of `el`, unless a script has its scroll already: then the callback gets `{completed: false, reason: "refused"}` and nothing moves |
| `Sticky.toMagnet(scroller, {top, left})` | the way to a magnet, held or not as `scrollsnap_hold` says, with the `smoothscroll_*` movement |
| `Sticky.getMagnets(el)` | the `.sticky-magnet` elements inside `el`, top to bottom: `{element, offsetTop, offsetLeft, visible}` |
| `Sticky.getMagnetPositions(scroller = window, axis = 'y')` | the scroll positions that meet a scroller's own magnets, in order, each once, clamped to the scroll |
| `Sticky.getSnap(el)`, `getFirstSnap(el)`, `getLastSnap(el)`, `getPreviousSnap(el)`, `getNextSnap(el)` | the magnet closest to the scroll, the first, the last, the one before, the one after |
| `Sticky.scrollToSnap(el, callback)`, `scrollToFirstSnap`, `scrollToLastSnap`, `scrollToPreviousSnap`, `scrollToNextSnap` | scroll there with the `smoothscroll_*` movement (the first / last: the top / bottom when there is no magnet) |
| `Sticky.listen(el = window, full = true)` | hear a scroller: every effect, or (`full: false`) the scroll-percent triggers only |
| `Sticky.unlisten(el = window)` | stop hearing it |
| `Sticky.trigger(target = window)` | run the effects now, as if the scroller had scrolled |
| `Sticky.compute(event)` | the computed scroll event (deltas, percentages, edges, timings) |
| `Sticky.reset(el = window)` | forget the measurements kept on a scroller (jQuery data) |
| `Sticky.onLoad(el = window)` | the load pass (next tick): listeners, buttons, swipes, hints, autoscrolls, the first run |
| `Sticky.userScroll(el)` | [`Flow.userScroll`](core.md#programmatic-scroll); `true` for a selector or a jQuery set that matches nothing |
| `Sticky.getScrollPadding(el)` | `Flow.scrollPadding` of `el`'s scroller |
| `Sticky.overscrollTop(event, el)`, `overscrollBottom`, `overscrollLeft`, `overscrollRight` | whether a wheel event pushes past that edge |
| `Sticky.onSwipe(el)` | names the elements the swipes are told to |
| `Sticky.closestTo(x, numbers)`, `closestToZero(numbers)`, `epsilon(a, b)` | helpers: the index of the closest number, whether two numbers are within 1 |
| `Sticky.parseDuration`, `parseToPixel`, `remToPixel`, `emToPixel`, `debounce` | the core's (see [Flow](core.md)) |
| `Sticky.percentToPixel(p, el)` | `parseFloat(p)` times `el`'s outer width (no division by 100, as the core's) |
| `Sticky.stops` | the `StickyStops` object |
| `Sticky.version` | `"1.7.0"`, the module's own number |

## Scroll stops

`src/js/stops.js` - places on the page a scroll settles on, once it has come
to rest. Standalone: no jQuery, and `import '@glitchr/flowjs/stops'`
brings in nothing else.

```html
<header class="sticky-stop" data-sticky-band-down="0">…</header>
<div id="site" class="sticky-stop" data-sticky-band-up="90" data-sticky-band-down="280"></div>
```

A stop rests where the browser would put an anchor: below the scroller's
`scroll-padding-top` (`-left` for a row) plus the stop's own `scroll-margin-top`
(`-left`), the two added. A section with `scroll-margin-top: 4rem` under a
header of that height rests under it, as a link to its id does.

Each stop has a band above and below it, in px (`rem` and `em` work too).
Once a scroll comes to rest - trackpad momentum included:

- between two stops it glides on to the one it was heading for, unless it
  rests inside the band of the stop it just left: that was a nudge, and it
  settles back. So a band is the least a scroll must travel before the next
  stop takes;
- past the last stop (and before the first) it scrolls freely, except inside
  that stop's band: a scroll back towards the stop, or an overshoot past it,
  returns to it.

A stop taller than the screen is read freely, from its top until its bottom
meets the bottom of the screen; its band below counts from there, and coming
back up from the next stop settles on its last screen, not its top.
Unless it is barely taller than the screen: a stop at most a quarter of a
screen taller (`shortEnd`, 1.5.2) rests at its top only. Its few extra pixels
are read freely all the same, but it is otherwise a stop the screen holds:
its band below counts from its top (1.5.3), so a scroll heading down that
comes to rest past its end within that band glides back to its top, and one
further down goes on to the next stop (within the `reach`); one heading up
goes to its top (with `up: false`, it rests where it is), and no key stops at
its end.

A band never reaches past halfway to the neighbouring stop. The glide is the
browser's smooth scroll, which any wheel, touch, key or click interrupts, and
a jump under `prefers-reduced-motion`.

Gentler stops, for a page that should be discovered rather than led:

- `reach` (px, or `"10rem"`, `"20vh"`; `Infinity` by default): the farthest a
  glide may go. When the stop a rest would glide to is farther than that, the
  page stays where it is - only a rest near a stop is completed, and what lies
  between two stops can be looked at. A band wider than the reach is pointless;
- `duration` (ms; `0` by default, the browser's smooth scroll): the glide is
  animated by the library over that time, on an ease-in-out curve (less for a
  glide under 100px, in proportion, down to 40%). Any wheel, touch, key or
  click stops it where it is, and it is not taken up again unless the reader
  scrolls on;
- `end` (`false` by default): the end of the scroll is a stop too - from the
  last section a glide goes down to the very bottom (a footer), and one back
  up, however far: `reach` does not bind it.
- `ends` (`false` by default, with `keys`; 1.4): an arrow shows a tall stop's
  two ends - down, from its top (or from inside it) to its end, its last
  screen, then on to the next stop's top; up, from its end back to its top,
  and from the top of the stop below to the end of a tall one before its top.
  Without it an arrow goes from top to top, however tall the stop.
- `screens` (`false` by default, with `keys`; 1.5): arrows and page keys read
  a tall stop a whole screen at a time - its top, a screen further, and so on
  to its end (its last screen), exactly - then go on to the next stop's top;
  up, the same back to its top, then to the end of the stop above. Down, from
  less than a quarter of a screen before that end a key goes on to the next
  stop rather than to the end; up, a step that would rest less than that under
  the stop's top goes to the top: a key never makes a short step to rest just
  before a section. A stop barely
  taller than the screen has its top alone. It takes the place of `ends` and
  of the page keys' own step (seven eighths of a screen) where it is set.
- `shortEnd` (a share of the screen, `0.25` by default, a line at the least;
  1.5.2): a stop at most that much taller than the screen has one rest, its
  top - for a scroll at rest, for the arrows with `ends`, for the page keys
  and for `screens` (whose "less than a quarter of a screen" it also sets).
  `data-sticky-short-end` on a stop gives it a share of its own (`0` keeps
  its end as a rest down to a line taller than the screen).
- `easing` (with a `duration`): the curve of the glide - a cubic Bezier as CSS
  writes it, `'cubic-bezier(.65, 0, .35, 1)'` by default (gathering speed,
  then slowing into the stop), its four numbers in an array, one of CSS's
  names (`linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`), or a
  function of the time gone (0 to 1) giving the way made. Every glide follows
  it: the one finishing a scroll at rest, and the one a key asks for, down the
  page or along a row (`data-sticky-easing` on a row).
- `settle` (ms, `160` by default): how long the scroll must have been quiet
  before anything happens.
- `up` and `down` (`true` by default): each way on its own. With `up: false`
  a scroll heading up rests where the reader left it - neither carried on to
  the stop above nor settled back to the one below - while a scroll heading
  down still goes on to its stop: the page leads the way down and lets the
  reader wander back up. `down: false` is the other way round. The reader's
  direction is what counts (a nudge down that settles back up belongs to the
  downward scroll), and the keys are not concerned - a key is asked for. A
  stop says it for itself with `data-sticky-up` and `data-sticky-down`
  (`"false"`, or `"true"` against the option): a reader heading up is not
  taken to a stop marked `data-sticky-up="false"`, and one marked
  `data-sticky-up="true"` - a full sky at the top of the page - keeps its pull
  upwards where going back up is otherwise free. On a sideways row up is
  towards its start, and the row takes the same two attributes.

```js
StickyStops.attach(window, { reach: 140, settle: 320, duration: 700, bandUp: 140, bandDown: 140 });
```

### Keys (1.5)

`keys: true` lets the keyboard go from stop to stop, with the same glide:
<kbd>↓</kbd>, <kbd>PageDown</kbd> and <kbd>Space</kbd> to the next stop,
<kbd>↑</kbd>, <kbd>PageUp</kbd> and <kbd>Shift</kbd>+<kbd>Space</kbd> to the
previous one (a tall one: its last screen), <kbd>Home</kbd> / <kbd>End</kbd> to
the first / last stop.

- An arrow always goes to a stop: down to the next one, up to the top of the
  one being read and then to the one before - however tall the stop. A tall
  stop is read with the wheel, the finger or the page keys: a page key moves
  one screen inside it, never past its end or top, before going on.
- A key pressed during a key's glide goes on from where that glide was going:
  presses chain stop after stop. A key held down goes one stop at a time.
- A neighbour farther than a screen and a half away (past the last stop,
  before the first, a long way between two) is left to the browser's own
  scroll - a separator shorter than half a screen is glided over, which then rests where the key put it.
  `reach` does not apply to keys. Shift goes with Space only.
- Left alone: focus in a field, a frame, an open `<dialog>`, a widget with keys
  of its own (slider, tabs, menu, listbox, audio, video) or an element that
  scrolls by itself; Alt, Ctrl or Meta held; Space on a button or a link; and
  any key a handler of the page already took (`event.defaultPrevented`) - the
  library listens on the window in the bubble phase, after the document's
  handlers, so a music player's Space stays the player's.

```js
StickyStops.attach(window, { reach: 140, settle: 320, duration: 800, easing: 'cubic-bezier(.7, 0, .2, 1)', bandUp: 140, bandDown: 140, keys: true, end: true });
```

### Sideways (1.5)

`axis: 'x'` on an element scroller meets the stops by their left edge (its
`scroll-padding-left`) and glides its `scrollLeft`: the same rest, reach, bands
and wide-stop reading, along x - a horizontal wheel, trackpad or swipe settles
on the stop it was heading for. With `keys`, <kbd>←</kbd> / <kbd>→</kbd> go
from stop to stop while focus is inside the row or the pointer is over it.

A row marked `data-sticky-axis="x"` with `.sticky-stop` children is attached
by itself on load, keys on (`data-sticky-keys="false"` to keep them off), with
optional `data-sticky-duration`, `-settle`, `-reach` and `-tolerance`. Its
stops are its own: the page's stops never count them. Leave CSS scroll-snap off
the row - it pulls to the nearest item meanwhile.

```html
<div class="photos" data-sticky-axis="x" data-sticky-duration="500" style="overflow-x: auto; display: flex">
    <figure class="sticky-stop">…</figure>
    <figure class="sticky-stop">…</figure>
</div>
```

```js
StickyStops.attach(row, { axis: 'x', keys: true });
StickyStops.scan();  // attach the data-sticky-axis rows swapped in since
```

With two stops or more the scroller (`<html>` for the page) carries
`--sticky-stop` (the index of the stop above), `--sticky-progress` (0 at that
stop, 1 at the next) and `--sticky-progress-held` (the same, held still across
the bands), and dispatches `sticky:progress` with `{index, from, to, top,
progress, held}` in `event.detail` when they change, and `sticky:stop` with
`{stop, top, axis, key}` at each glide. Both bubble to the window.

The window attaches itself when the document has stops at `DOMContentLoaded`
or `load`. Otherwise, and for scrolling elements:

```js
StickyStops.attach(scroller, { settle: 160, tolerance: 3, reach: Infinity, duration: 0, easing: 'cubic-bezier(.65, 0, .35, 1)', bandUp: 0, bandDown: 0, up: true, down: true, progress: true, smooth: true, axis: 'y', keys: false });
StickyStops.get(scroller).state;      // the last progress, or null
StickyStops.get(scroller).refresh();  // after content moved
StickyStops.pause(); StickyStops.resume();  // while a script scrolls the page itself; nests
```

The window's stops are measured once and kept while the page keeps its shape
(its size, its nodes); a resize, `refresh()`, a rest and a key measure again,
and at each frame of a scroll the two stops the scroll is between are checked.
`stops.measure()` always measures; `stops.measure(true)` may give the kept
measure back.

Two stops at the same place (within `tolerance`) are one stop - the first in
the document. A script that makes stops of its own (markers along a track)
should clear the ones it finds before making them: a page the navigation gives
back from its cache comes as it was left, the script's markers included, and
the script runs again on it. `transparent:beforeunload` is dispatched before a
page is kept, for a script that would rather take its nodes away then.

A scroll a script makes through the library (the navigation giving a position
back or going to an anchor, `Sticky.scrollTo`, `Flow.scrollTo`, `Flow.jump`)
rests where it was put: the stops only complete the reader's own scrolls.

`Sticky.stops` is the same object when `sticky.js` is loaded.

### Options (`StickyStops.defaults`)

Given to `StickyStops.attach(scroller, {...})`; the window's stops, attached by themselves, take
`StickyStops.defaults` - change a default there before the page loads, or call
`StickyStops.attach(window, {...})`, which merges the options given into the attached stops and
measures again. A row marked `data-sticky-axis` takes its options from its attributes (below).

| Option | Type | Default | Effect |
|---|---|---|---|
| `selector` | CSS selector | `".sticky-stop"` | the stops, inside the scroller (`<html>` for the page) |
| `settle` | number (ms) | `160` | how long the scroll must have been quiet to be at rest; a glide that fires no scroll event is given up after twice that |
| `tolerance` | number (px) | `3` | within this of a stop is at it; two stops this close are one |
| `reach` | number (px) or string | `Infinity` | the farthest a glide may go: px, `"10rem"`, `"2em"`, `"20vh"` or `"20%"` (of the screen); a negative number or an unreadable string is no limit. Not for keys, nor for the `end` stop |
| `duration` | number (ms) | `0` | the glide animated by the library over that time (less under 100 px, down to 40 %); `0`: the browser's smooth scroll |
| `easing` | string, array or function | `"cubic-bezier(.65, 0, .35, 1)"` | the curve of an animated glide: `cubic-bezier(...)`, its four numbers, `linear`, `ease`, `ease-in`, `ease-out`, `ease-in-out`, or a function of the time gone (0..1); anything unreadable is the default |
| `bandUp`, `bandDown` | number (px) | `0` | the band above and below a stop without `data-sticky-band-up` / `-down` |
| `up`, `down` | boolean | `true` | a scroll heading up (left), down (right) is taken to a stop |
| `progress` | boolean | `true` | the custom properties and the `sticky:progress` events |
| `smooth` | boolean | `true` | glide; `false` (or `prefers-reduced-motion: reduce`): jump |
| `axis` | `"y"`, `"x"` | `"y"` | `"x"`: the stops are met sideways, by their left edge (an element scroller); fixed when the stops are made |
| `keys` | boolean | `false` | the keyboard goes from stop to stop (see [Keys](#keys-15)) |
| `ends` | boolean | `false` | with `keys`: an arrow rests at a tall stop's end before going on |
| `screens` | boolean | `false` | with `keys`: arrows and page keys read a tall stop a screen at a time |
| `shortEnd` | number (share of the screen) | `0.25` | a stop at most this much taller than the screen rests at its top only (at least a line, 40 px; a negative or unreadable value is 0.25) |
| `end` | boolean | `false` | the end of the scroll is a stop too |

### Attributes (stops)

| Attribute | On | Effect |
|---|---|---|
| `class="sticky-stop"` | an element in the scroller | a stop (the `selector`); one with `display: none` is not counted, nor one inside a row marked `data-sticky-axis` or inside another attached scroller |
| `data-sticky-band-up`, `data-sticky-band-down` | a stop | its bands, px (`"90"`, `"90px"`, `"2rem"`, `"1.5em"`); at most halfway to the neighbour |
| `data-sticky-up`, `data-sticky-down` | a stop, or a row | `"false"`, `"0"`, `"off"`, `"no"`: a reader heading that way is not taken to it; anything else: they are, against the option |
| `data-sticky-short-end` | a stop | its own `shortEnd` |
| `style="scroll-margin-top: ..."` (`-left` on a row) | a stop | where it rests, under the scroller's `scroll-padding-top` (`-left`), as an anchor |
| `data-sticky-axis="x"` (or `"y"`) | a scrolling element holding stops | attached by itself, `keys` on |
| `data-sticky-keys="false"` | such a row | keys off |
| `data-sticky-duration`, `-settle`, `-tolerance` | such a row | numbers, its own options |
| `data-sticky-reach`, `data-sticky-easing` | such a row | its own `reach` and `easing` |

Written by the stops, on the scroller (`<html>` for the page), with two stops or more and
`progress` on:

| Custom property | Holds |
|---|---|
| `--sticky-stop` | the index of the stop above the scroll, from 0 |
| `--sticky-progress` | 0 at that stop, 1 at the next, four decimals |
| `--sticky-progress-held` | the same, held at 0 across the upper stop's band below it and at 1 across the lower stop's band above it |

```css
.hero { opacity: calc(1 - var(--sticky-progress-held, 0)); }
```

### Events (stops)

Dispatched on the scroller (`<html>` for the page); both bubble to `window`.

| Event | When | `detail` |
|---|---|---|
| `sticky:stop` | each glide, a key's included, when it starts | `{scroller, stop, top, axis, key}`: the scroller (`window` for the page), the stop's element (`<html>` for the `end` stop), where it goes, `"x"` or `"y"`, whether a key asked for it |
| `sticky:progress` | the scroll moved between two stops (at most once a frame), or the stops were measured again | `{scroller, index, from, to, top, progress, held}`: the index of the stop above, the two stops' elements, the scroll position, the two progress numbers |

```js
window.addEventListener('sticky:stop', function (event) {
    analytics.track('section', event.detail.stop.id);
});
```

The stops listen, through the core, to the scroller's scroll, its interruptions (wheel, touch,
press) and the window's resize; to `focusin` (on the document for the page: a scroll right after
a focus change is the browser revealing the field, not the reader); to `keydown` on `window`, one
listener for every scroller, in the bubble phase; and to the page's moments
([`Flow.onPage`](core.md#the-pages-moments)): at each, the marked rows are attached, the rows gone
from the page detached, and the window's stops attached (or measured again) when the document has
any.

### Methods (stops)

| Member | Effect |
|---|---|
| `StickyStops.attach(scroller, options)` | the stops of a scroller (the window by default; `document`, `<html>` and `<body>` mean it), made if needed; on stops already attached, merges `options` and measures again. Returns the instance |
| `StickyStops.get(scroller)` | the instance, or `null` |
| `StickyStops.pause()`, `StickyStops.resume()` | hold every scroller's stops off (no settle, no key), e.g. while a script scrolls; nests |
| `StickyStops.refresh()` | measure every scroller's stops again |
| `StickyStops.scan(within)` | attach the `[data-sticky-axis]` elements holding stops (in the document, or under `within`), detach the attached elements no longer in the page |
| `StickyStops.defaults` | the defaults (above) |
| `StickyStops.Stops` | the class of an instance |
| `stops.refresh()` | measure again and report the progress: after content moved |
| `stops.measure(kept)` | the stops as measured: `[{element, top, end, rest, bandUp, bandDown, up, down, shortEnd}]`, sorted; `measure(true)` may give the kept measure back |
| `stops.progress()` | where the scroll is between its two nearest stops (the `sticky:progress` detail), written to the custom properties; `null` with fewer than two stops |
| `stops.state` | the last progress, or `null` |
| `stops.pause()`, `stops.resume()` | hold this scroller's stops off; nests |
| `stops.detach()` | stops listening, cancels a glide, removes the custom properties, forgets the instance |
| `stops.options`, `stops.scroller`, `stops.stops` | its options, its scroller, the stops last measured |

## License

MIT since 2026-10-10; earlier versions remain published under LGPL-3.0-or-later.

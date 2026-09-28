# Sticky JS library

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

## Scroll stops

`src/js/stops.js` - places on the page a scroll settles on, once it has come
to rest. Standalone: no jQuery, and `import '@glitchr/stickyjs/src/js/stops.js'`
brings in nothing else.

```html
<header class="sticky-stop" data-sticky-band-down="0">…</header>
<div id="site" class="sticky-stop" data-sticky-band-up="90" data-sticky-band-down="280"></div>
```

Each stop has a band above and below it, in px (`rem` and `em` work too).
Once a scroll comes to rest - trackpad momentum included:

- between two stops it glides on to the one it was heading for, unless it
  rests inside the band of the stop it just left: that was a nudge, and it
  settles back. So a band is the least a scroll must travel before the next
  stop takes;
- past the last stop (and before the first) it scrolls freely, except inside
  that stop's band: a scroll back towards the stop, or an overshoot past it,
  returns to it.

A band never reaches past halfway to the neighbouring stop. The glide is the
browser's smooth scroll, which any wheel, touch, key or click interrupts, and
a jump under `prefers-reduced-motion`.

With two stops or more the scroller (`<html>` for the page) carries
`--sticky-stop` (the index of the stop above), `--sticky-progress` (0 at that
stop, 1 at the next) and `--sticky-progress-held` (the same, held still across
the bands), and dispatches `sticky:progress` with `{index, from, to, top,
progress, held}` in `event.detail` when they change, and `sticky:stop` with
`{stop, top}` at each glide. Both bubble to the window.

The window attaches itself when the document has stops at `DOMContentLoaded`
or `load`. Otherwise, and for scrolling elements:

```js
StickyStops.attach(scroller, { settle: 160, tolerance: 3, bandUp: 0, bandDown: 0, progress: true, smooth: true });
StickyStops.get(scroller).state;      // the last progress, or null
StickyStops.get(scroller).refresh();  // after content moved
StickyStops.pause(); StickyStops.resume();  // while a script scrolls the page itself; nests
```

`Sticky.stops` is the same object when `sticky.js` is loaded.

---
title: Scroll-driven scenes
order: 35
---

# Scroll-driven scenes

`src/js/scenes.js` (global `StickyScenes`, entry `@glitchr/flowjs/scenes`, no jQuery) and its
stylesheet `src/css/scenes.scss`. A scene is a section the page scrolls through while its stage stays
pinned to the screen: as if the reader were not scrolling, an object turns, opens, comes in from the
side - the scroll is the scene's timeline. New in 1.6.

```html
<section class="sticky-scene" data-scene-length="150vh" data-scene-steps="0.3, 0.6">
    <div class="sticky-scene-stage">
        <div class="device">…</div>
    </div>
</section>
```

```css
.device { transform: rotateY(calc(-35deg + var(--scene-progress) * 45deg)); }
.device .lid { transform: rotateX(calc(-90deg + var(--scene-progress) * 90deg)); }
```

The section is its stage's height plus its length (`data-scene-length`: px, `vh`, `svh`, `rem`...):
across that length the stage stays (`position: sticky`, `top: var(--scene-top, 0)`), and the scene's
progress goes from 0, when the stage reaches its place, to 1, when the scene's end comes up.

## What a scene says

At each frame its progress changes:

| Where | What |
| --- | --- |
| `--scene-progress` | 0 to 1, on the section |
| `--scene-step` | the number of steps passed (`data-scene-steps`: the progress each step after the first begins at) |
| `--scene-step-progress` | 0 to 1 inside the current step: one reveal after another |
| `data-scene-state` | `before`, `active`, `after` (`reduced`, see below) |
| `data-scene-step` | the step, for a selector |
| `scene:progress` | an event on the section (it bubbles): `{progress, step, stepProgress, state, frame, scene}` |

## An image sequence

A canvas in the stage draws the picture of the progress:

```html
<canvas data-scene-sequence="/img/turn-{i}.webp" data-scene-frames="90" data-scene-pad="3"></canvas>
```

`{i}` is the frame's number, 1 to 90, padded to `data-scene-pad` digits (or
`data-scene-frames-list='["a.webp", "b.webp"]'`). The first picture loads at once, the others when the
browser is idle; while the frame asked for has not arrived, the nearest one loaded is drawn. The canvas
says the frame drawn in `data-scene-frame`, the event in `detail.frame`.

## Reduced motion

With `prefers-reduced-motion: reduce` a scene is its end (`data-scene-reduced` on the section, state
`reduced`): progress 1, no length, the stage in the flow of the page - nothing moves as the page
scrolls. `data-scene-reduced="start"` shows its start instead; `"live"` keeps it moving.

## The keyboard

While a scene's stage is pinned, the keys go from step to step (the `keys` option, on by default;
`data-scene-keys="false"` leaves them to the page):

| Key | Goes to |
|---|---|
| <kbd>ArrowDown</kbd>, <kbd>PageDown</kbd>, <kbd>Space</kbd> | where the next step begins; from the last step, the scene's end; from its end, the section after it |
| <kbd>ArrowUp</kbd>, <kbd>PageUp</kbd>, <kbd>Shift</kbd>+<kbd>Space</kbd> | where the step before begins, down to the scene's start; from there, the section before it (its last screen when it is taller than one) |

With steps `0.3, 0.6`, from the scene's start: 0.3, 0.6, 1, then the next section - three presses
show the three steps. From the top of the section right after a scene, <kbd>ArrowUp</kbd> comes back
to the scene's end, and the steps go back from there. A key pressed during the glide goes on from
where the glide is going. The scroll is the browser's (`window.scrollTo`, smooth, instant under
reduced motion); each one is told in `scene:key` (detail `{progress, top, scene}`; progress `2` for the
section after, `-1` for the one before).

The keys are left alone in a field (input, textarea, select, contenteditable), on a widget with keys
of its own (a slider, tabs, a listbox, audio, video, a sideways scene's track), in an open dialog, with
<kbd>Alt</kbd>, <kbd>Ctrl</kbd> or <kbd>Meta</kbd>, for <kbd>Space</kbd> on what it presses (a button, a
link), with <kbd>Shift</kbd> on an arrow (a selection), and when a handler of the page took the key
first (`preventDefault`).

## Sideways

`data-scene-axis="x"` (or `{ axis: 'x' }`): the scene is read by a horizontal scroll, and the page's
vertical scroll stays free - the scene never holds the page. It has no length and no pinning; its
track is a native `overflow-x` scroller, so everything that scrolls sideways moves it: a trackpad,
<kbd>Shift</kbd>+wheel, a finger's swipe, and the keys on the focused track.

```html
<section class="sticky-scene" data-scene-axis="x">
    <div class="sticky-scene-stage">
        <div class="laptop">…</div>
        <div data-scene-track aria-label="The laptop, opened step by step">
            <article data-scene-panel>Closed</article>
            <article data-scene-panel>Opening</article>
            <article data-scene-panel>Open</article>
        </div>
        <span data-scene-hint aria-hidden="true">→</span>
    </div>
</section>
```

- The progress is the track's `scrollLeft / (scrollWidth - clientWidth)`, in the same
  `--scene-progress`, `--scene-step`, `data-scene-state` and `scene:progress` as a vertical scene.
- The steps, unless `data-scene-steps` names them, are where the panels begin
  (`[data-scene-panel]`, else the track's children): three full-width panels begin at `0`, `0.5` and
  `1` of the track's range, the steps are `0.5, 1`, and `data-scene-step` is `0`, `1`, `2` on the
  three panels - the keys rest at each. css/scenes.scss makes each panel a full-width snap point
  (`scroll-snap-type: x mandatory`, `scroll-snap-stop: always`), the scrollbar hidden,
  `overscroll-behavior-x: contain` (no browser Back at the left edge on a trackpad).
- The track is made focusable (`tabindex="0"`, `role="region"`, its `aria-label` kept, else
  "Scene"): <kbd>ArrowRight</kbd> and <kbd>ArrowLeft</kbd> go a step at a time, <kbd>Home</kbd> and
  <kbd>End</kbd> to the first and the last; the vertical keys stay the page's.
- At the first movement the scene takes `data-scene-touched`, and keeps it. The hint
  (`[data-scene-hint]`, an arrow saying "this way") blinks until then and goes; under reduced motion it
  is shown still.
- Reduced motion applies as for a vertical scene (`reduced: 'end'` by default: the scene at its end,
  the panels still readable sideways); `data-scene-reduced="live"` keeps it following the track.

## With the stops

A scene marked `.sticky-stop` is a stop taller than the screen: a scroll comes to rest at its start, and
across it the scroll is free - a stop never pulls the reader out of a scene half-way. The scene's keys
come first: it listens on the document, StickyStops on the window, and a key the scene took is left to
it; once the scene sends the reader to the section after it, the stops' keys go on. Put no stop inside
a scene.

## iOS, momentum

The progress is read in the frame a scroll is heard in (one listener for the page, Flow's), and for
400ms after the last scroll event (`StickyScenes.defaults.tail`): iOS tells its page's position a frame
or more late (see 1.5.4), and a momentum scroll may end without an event.

## API

```js
StickyScenes.attach(section, { length: '150vh', steps: [0.3, 0.6], reduced: 'end', keys: true });
StickyScenes.attach(section, { axis: 'x' });   // read sideways: track, panels
StickyScenes.get(section).progress();   // the progress now
StickyScenes.scan();                    // attach the scenes a script added
StickyScenes.refresh();                 // measure again, after content moved
```

Scenes are found by themselves (`.sticky-scene`), at load and after each page the navigation swaps in.

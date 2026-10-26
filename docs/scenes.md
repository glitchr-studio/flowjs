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

## With the stops

A scene marked `.sticky-stop` is a stop taller than the screen: a scroll comes to rest at its start, and
across it the scroll is free - a stop never pulls the reader out of a scene half-way. With the stops'
`keys` and `screens`, the arrows and the page keys scrub it a screen at a time, then go on to the next
stop. Put no stop inside a scene.

## iOS, momentum

The progress is read in the frame a scroll is heard in (one listener for the page, Flow's), and for
400ms after the last scroll event (`StickyScenes.defaults.tail`): iOS tells its page's position a frame
or more late (see 1.5.4), and a momentum scroll may end without an event.

## API

```js
StickyScenes.attach(section, { length: '150vh', steps: [0.3, 0.6], reduced: 'end' });
StickyScenes.get(section).progress();   // the progress now
StickyScenes.scan();                    // attach the scenes a script added
StickyScenes.refresh();                 // measure again, after content moved
```

Scenes are found by themselves (`.sticky-scene`), at load and after each page the navigation swaps in.

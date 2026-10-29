---
title: StickySortable
order: 40
---

# StickySortable

`src/js/sortable.js` - drag-and-drop reordering with Pointer Events (not HTML5
drag-and-drop), so a custom placeholder and touch share one code path. The handle
needs `touch-action: none` in CSS. Needs the core (for the scroller it
autoscrolls); jQuery only for the `$.fn.stickySortable` plugin.

```html
<ul id="list">
    <li data-sortable-item><span class="grip">::</span> One</li>
    <li data-sortable-item><span class="grip">::</span> Two</li>
</ul>
```

```js
new StickySortable(document.getElementById('list'), {
    handle: '.grip',
    onChange: function (order, container) { /* order: the items, once, on drop */ }
});
$('#list').stickySortable({ handle: '.grip' });   // the same, with jQuery
```

On a handle, <kbd>ArrowUp</kbd> / <kbd>ArrowDown</kbd> move the item up or down
and call `onChange`.

## Loading

| Entry | Loads |
|---|---|
| `import '@glitchr/flowjs/sortable'` | `src/js/core.js` and `src/js/sortable.js`; no stylesheet: the placeholder and the dragged item are the page's to style |
| `import '@glitchr/flowjs'` | every module, this one included |
| `<script src="src/js/sortable.js">` | after `src/js/core.js` (and jQuery, for the plugin) |

The script throws `sortable.js: load core.js first` without the core: it registers itself on it
(`Flow.sortable`) and takes jQuery from it. The scroller it autoscrolls is its own choice, not the
core's (see [Autoscroll](#autoscroll)). It sets `window.StickySortable` and `Flow.sortable` (the
same constructor), exports it to CommonJS, and defines `$.fn.stickySortable` when jQuery is there.

## Options (`StickySortable.defaults`)

| Option | Default | Meaning |
| --- | --- | --- |
| `handle` | `null` | selector, relative to the item; `null` drags the whole item |
| `items` | `'[data-sortable-item]'` | the items |
| `axis` | `'y'` | |
| `dragThreshold` | `4` | px of pointer movement before a press is a drag, not a click |
| `autoscroll` | `true` | scroll the closest ancestor that scrolls down (`overflow-y: auto` or `scroll`), the page otherwise, when an item is dragged to its edge |
| `autoscrollEdge` | `40` | px from the edge that triggers it |
| `autoscrollInsetTop` | `null` | px of the top edge covered by something pinned; `null` measures it |
| `autoscrollSpeed` | `12` | px per frame at full deflection |
| `draggingClass` | `'is-dragging'` | |
| `placeholderClass` | `'is-sortable-placeholder'` | |
| `placeholderVerticalClass` | `'is-placeholder-vertical'` | marker between two cards of one row of a grid |
| `placeholderHorizontalClass` | `'is-placeholder-horizontal'` | marker between rows |
| `onChange` | `null` | `function(order, container)`, once on drop, if the order changed |
| `mergeable` | `false` | dropping in the inner zone of another item fires `onMerge` instead of reordering |
| `mergeInset` | `28` | px inset that counts as the merge zone |
| `mergeTargetClass` | `'is-merge-target'` | |
| `isMergeable` | `null` | `function(el)`: can the dragged item be a merge source |
| `isMergeTarget` | `null` | `function(el)`: can an item be a target; falls back to `isMergeable` |
| `onMerge` | `null` | `function(draggedEl, targetEl, container)`, on drop, instead of `onChange` |

Each option in detail, with its type:

| Option | Type | Effect |
|---|---|---|
| `handle` | CSS selector or `null` | a press counts only when it starts inside an element matching it (`closest()`, so inside the item or above it); the keyboard works only with a handle |
| `items` | CSS selector | the items are the container's **direct children** matching it; an element deeper in the container is not an item |
| `axis` | `'y'` or anything else | `'y'`: a single column - the dragged item keeps its left edge and the place is found by comparing vertical midpoints, in the DOM's order. Any other value (`'both'`, `'xy'`, ...): a grid - the item follows the pointer on both axes and the place is beside the nearest item (see [Grids](#grids)) |
| `dragThreshold` | number (px) | the distance from the press, in a straight line, before the drag starts; under it, a release is a click |
| `autoscroll` | boolean | see [Autoscroll](#autoscroll) |
| `autoscrollEdge` | number (px) | the band at the top and at the bottom of the scroller that scrolls it; at least 90 px under a coarse pointer (`(pointer: coarse)`, a finger) |
| `autoscrollInsetTop` | number (px) or `null` | added to the top band: the part of the scroller's top covered by a sticky or fixed element; `null` finds it at the first move of each drag |
| `autoscrollSpeed` | number (px) | the scroll at each animation frame while the pointer is in a band (a constant speed: the band's depth does not change it) |
| `draggingClass` | class name | on the dragged item during the drag |
| `placeholderClass` | class name | the placeholder's class (its only one besides the orientation) |
| `placeholderVerticalClass`, `placeholderHorizontalClass` | class names | one of them on the placeholder after each move, see [The placeholder](#the-placeholder) |
| `onChange` | `function(order, container)` or `null` | `order` is the array of the items (elements) in their new order, `container` the list; called at a drop that changed the dragged item's index, and at each move by the keyboard |
| `mergeable` | boolean | arms the merge zones, see [Merging](#merging) |
| `mergeInset` | number (px) | the margin, inside an item's box, that still reorders; inside it is the merge zone |
| `mergeTargetClass` | class name | on the item that the dragged one would merge into, while armed |
| `isMergeable` | `function(el)` or `null` | called with the dragged item at each move: `false` and the drag only reorders; `null`: any item may merge |
| `isMergeTarget` | `function(el)` or `null` | called with each candidate: `false` and that item is never a target; `null`: `isMergeable` decides, or every item when it is `null` too |
| `onMerge` | `function(draggedEl, targetEl, container)` or `null` | called at a drop on a merge zone, instead of `onChange` |

`StickySortable.defaults` is the defaults object itself: a change to it applies to every list
made afterwards.

## A drag, step by step

1. **Press** (`pointerdown` on the container): ignored during a drag, for a mouse button other
   than the main one, outside a `handle` (when there is one), and outside a direct item. The
   press is kept and its moves are watched.
2. **Past `dragThreshold`**: the drag begins. The item gets `draggingClass`, the pointer is
   captured on it, a placeholder takes its place in the list, and the item is lifted out of the
   flow: `position: fixed`, its width kept, `z-index: 1000`, `pointer-events: none`, `top` and
   `left` following the pointer.
3. **Each move** (`pointermove` on the document, the captured pointer only): the item follows
   the pointer; with `mergeable`, a merge zone is looked for first; otherwise the placeholder is
   moved before or after the item the pointer is nearest (at the end of the list past the last
   one), its orientation is set, and the autoscroll is updated.
4. **Release** (`pointerup` on the document): the item's inline styles are cleared, it takes the
   placeholder's place, the placeholder is removed, the autoscroll stops; then `onMerge` (armed
   on a target) or `onChange` (the index changed).

A press released before the threshold is a click: nothing moves, a link in the item is followed.
The press is forgotten wherever it ends - a `pointerup` on the list or anywhere else in the
document, a `pointercancel`, or a move with no button held - so a later move of the pointer over
the list starts no drag. A drag the browser cancels (`pointercancel`: the page took the gesture)
puts the item back where it was and calls neither `onChange` nor `onMerge`.


## The placeholder

An element of the dragged item's tag (`li` for an `li`), with the class `placeholderClass` and
two custom properties, the dragged item's size: `--sortable-item-height` and
`--sortable-item-width` (in px). No inline size: the marker's thickness is the stylesheet's, and
the custom properties tell it how long to be.

After each move it gets one of the orientation classes:

| Where it stands | Class |
|---|---|
| nothing before it | `placeholderHorizontalClass` (it starts a row) |
| between two items that share a visual row (overlapping by more than half the shorter one's height) | `placeholderVerticalClass` |
| between two items on different rows | `placeholderHorizontalClass` |
| last, with room left on the row for the dragged item | `placeholderVerticalClass` |
| last, without room | `placeholderHorizontalClass` |

A plain column never has two neighbours on one row, so it always reads horizontal.

```css
.is-sortable-placeholder { list-style: none; background: currentColor; opacity: .4; }
.is-sortable-placeholder.is-placeholder-horizontal { height: 3px; width: var(--sortable-item-width); }
.is-sortable-placeholder.is-placeholder-vertical { width: 3px; height: var(--sortable-item-height); }
.is-dragging { box-shadow: 0 6px 18px rgb(0 0 0 / .2); cursor: grabbing; }
.grip { touch-action: none; cursor: grab; }
```

## Grids

With an `axis` other than `'y'`, the item nearest the pointer is the one whose box is closest to
it (the distance to the nearest point of the box, 0 alongside it), so a wide card next to the
pointer wins over a small one whose centre is nearer. The side is read from that item's centre:
on the axis where the pointer is farther from the centre, before when the pointer is left of it
(or above it), after otherwise.

## Autoscroll

The scroller is chosen once, when the list is made: the closest ancestor that scrolls down (its
content taller than it, `overflow-y` `auto` or `scroll`), else the page
(`document.scrollingElement`). An ancestor that scrolls only sideways (a table in an
`overflow-x` box) is passed over. `instance.scroller` holds it.

While the pointer is within `autoscrollEdge` of the scroller's top (plus the inset of a sticky
header) or bottom, the scroller scrolls by `autoscrollSpeed` px a frame; leaving the band or
dropping stops it. Only vertical scrolling is done. The inset under a pinned header is measured
once per drag: the element at the middle of the scroller's top line, or one of its ancestors,
that is `position: sticky` or `fixed`.

## Merging

With `mergeable: true`, a move over an item's inner zone (its box minus `mergeInset` on each
side) arms that item as the merge target: it gets `mergeTargetClass`, and the placeholder stays
where it was while armed. Dropping then calls `onMerge(draggedEl, targetEl, container)` - the
dragged item has been put back at the placeholder's place, and the page decides what a merge is
(both replaced by a composite, a group...). `onChange` is not called for that drop.

```js
new StickySortable(grid, {
    axis: 'both',
    handle: '.card-grip',
    mergeable: true,
    isMergeable: (el) => !el.classList.contains('is-composite'),   // a composite does not merge further
    isMergeTarget: (el) => el.dataset.kind !== 'banner',
    onMerge: (dragged, target) => fetch('/cards/merge', { method: 'POST', body: JSON.stringify([dragged.id, target.id]) }),
    onChange: (order) => fetch('/cards/order', { method: 'POST', body: JSON.stringify(order.map((el) => el.id)) }),
});
```

## The keyboard

`keydown` on the container: with a `handle`, <kbd>ArrowUp</kbd> or <kbd>ArrowDown</kbd> pressed on
it moves its item before the previous item or after the next one, keeps the focus on the handle,
and calls `onChange` with the new order. At the first or last place nothing happens. Without a
`handle` the keys do nothing; give the handle a `tabindex="0"` (or make it a `button`) for it to
take the focus. The keys move along the DOM's order, also in a grid.

## A tree (`StickySortable.Tree`)

Nested lists - an item holding a list of its own - reordered and re-parented: a book's chapters
and their sections, a menu and its entries. New in 1.6.

```html
<ol id="toc">
    <li data-sortable-item data-id="intro">
        <div class="row"><button class="grip" aria-label="Move">⠿</button>
            <button data-sortable-toggle aria-label="Fold">▾</button> Introduction</div>
        <ol>
            <li data-sortable-item data-id="why"><div class="row"><button class="grip">⠿</button> Why</div></li>
        </ol>
    </li>
    <li data-sortable-item data-id="notes" data-sortable-leaf>…</li>
</ol>
```

```js
const tree = new StickySortable.Tree(document.getElementById('toc'), { handle: '.grip', maxDepth: 2 });
document.getElementById('toc').addEventListener('sortable:change', (e) => save(e.detail.tree));
tree.serialize();   // [{ id: 'intro', children: [{ id: 'why', children: [] }] }, { id: 'notes', children: [] }]
```

An item's children are its first `ol`/`ul` child (`lists`); the list is made when an item takes its
first child and removed when its last one leaves.

**The pointer.** Dragged by its handle, the item follows the pointer and a marker
(`li.is-tree-marker`, `data-depth` and `--sortable-depth` on it) shows where it will land: between
two items, at the level the pointer's horizontal place asks for - one `indent` (24px) to the right is
a child of the item above, one to the left the level of its parent. The level is kept within what the
neighbours allow: never deeper than one below the item above, never shallower than the item below
(that would take the item below away from its parent), never under an item that accepts no child or
is folded, never deeper than `maxDepth` counting the dragged item's own subtree. On a touch screen
the drag begins after a long press (`longPress`, 350ms, `is-held` meanwhile); a finger that moves
before is a scroll. A `pointercancel` puts nothing anywhere.

**The keyboard**, on a focused handle:

| Key | Does |
|---|---|
| <kbd>ArrowUp</kbd>, <kbd>ArrowDown</kbd> | moves the item before the previous sibling, after the next one |
| <kbd>ArrowRight</kbd> | makes it the last child of the sibling above (unfolded if it was folded) |
| <kbd>ArrowLeft</kbd> | takes it out of its parent, just after it |

Each move, or a move refused (the first sibling going up, a leaf, `maxDepth`), is said in an
`aria-live="polite"` region added after the tree (`.sortable-live`, visually hidden), in the `labels`
option's words; the focus stays on the handle.

**Folding.** A `[data-sortable-toggle]` button in an item folds and unfolds its children
(`is-collapsed` on the item, `hidden` on its list, `aria-expanded` and `aria-controls` on the button);
it is hidden while the item has no children. `tree.collapse(item)`, `tree.expand(item)`.

| Option (`StickySortable.Tree.defaults`) | Default | |
|---|---|---|
| `handle` | `null` | the handle's selector, inside an item; `null` drags the whole item |
| `items` | `'[data-sortable-item]'` | an item |
| `lists` | `'ol, ul'` | an item's own list of children |
| `indent` | `24` | px of horizontal movement that is one level |
| `maxDepth` | `Infinity` | levels below the root: `0` a flat list, `1` children and no grandchildren |
| `accepts` | `null` | `function (item)`: may it take children; by default, all but `[data-sortable-leaf]` |
| `dragThreshold` | `4` | px before a press is a drag |
| `longPress` | `350` | ms a finger holds the handle before the item is dragged |
| `draggingClass`, `markerClass`, `collapsedClass` | `is-dragging`, `is-tree-marker`, `is-collapsed` | |
| `labels` | English | `moved`, `nested`, `outdented`, `refused`, with `%item%`, `%index%`, `%count%`, `%depth%`, `%parent%` |
| `onChange` | `null` | `function (detail)` after each move |

After each move, `onChange(detail)` and a `sortable:change` event on the root (it bubbles), detail
`{item, parent, index, depth, tree}`: the item, its new parent item (`null` at the top), its place
among its siblings, its level (0 at the top), and `tree.serialize()` - nested `{id, children}`, the
id being `data-id`, else `id`, else the item's text. `tree.destroy()` lets go of the listeners and the
live region; `$(ol).stickySortableTree(options)` makes one per root.

The marker has no style of its own; a line at its level is enough:

```css
.is-tree-marker { list-style: none; height: 0; position: relative; }
.is-tree-marker::before { content: ""; position: absolute; inset: -1px 0 auto 0; height: 2px; background: currentColor; }
.is-dragging { opacity: .6; }
```

## Instance

| Member | Holds or does |
|---|---|
| `new StickySortable(container, options)` | listens to `pointerdown` and `keydown` on the container |
| `container` | the list |
| `options` | the options in force (defaults, then the options given) |
| `scroller` | the element autoscrolled |
| `items()` | the items, in their order: the direct children matching `items` |
| `dragging` | the item being dragged, or `null` |
| `placeholder` | the placeholder during a drag, or `null` |
| `mergeTarget` | the armed merge target, or `null` |

There is no `destroy()`: the listeners stay as long as the container. `$(el).stickySortable(options)`
makes one per element, keeps it in `el._stickySortable`, returns the jQuery set, and does
nothing for an element that has one already (the new options are ignored).

A flat StickySortable dispatches no event: `onChange` and `onMerge` are the way to hear a change
(a tree also says `sortable:change`). It reads no
data attribute besides the default `items` selector (`[data-sortable-item]`), and sets only the
classes and inline styles above.

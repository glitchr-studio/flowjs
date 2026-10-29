// StickySortable - drag-and-drop reordering, standing alone: it is loaded
// after the core (Flow) like every module, and takes jQuery for its $.fn
// plugin only, so a consumer who only wants sorting pays for none of the scroll
// effects. Pointer Events (not HTML5 drag-and-drop) so a custom placeholder
// and touch both work with one code path - requires touch-action: none on
// the handle in CSS.
/**
 * @file StickySortable, sortable lists and trees: drag-and-drop with pointer events (mouse, pen, touch), the arrows on a handle for the keyboard, items moved between the levels of a tree.
 */
/**
 * Told on a tree's root (StickySortable.Tree) after each move: detail {item, parent, index, depth, tree}.
 * @event StickySortable#sortable:change
 */
(function (root, factory) {

    var core = root.Flow && root.Flow.core === true ? root.Flow : (typeof require === 'function' ? require('./core.js') : null);
    if (!core) throw new Error('sortable.js: load core.js first');

    var api = factory(root, core, core.jquery());
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.StickySortable = api;
    core.sortable = api;

})(typeof window !== 'undefined' ? window : this, function (window, Flow, $) {

    var document = window.document;

    var defaults = {
        handle: null,          // selector, relative to the item, or null to drag the whole item
        items: '[data-sortable-item]',
        axis: 'y',
        dragThreshold: 4,      // px of pointer movement before a press counts as a drag, not a click
        autoscroll: true,
        autoscrollEdge: 40,    // px from the scroll container's edge that triggers scrolling
        autoscrollInsetTop: null, // px of the top edge already covered by something pinned over it; null = measure it
        autoscrollSpeed: 12,   // px per animation frame at full deflection
        draggingClass: 'is-dragging',
        placeholderClass: 'is-sortable-placeholder',
        // Orientation of the drop marker, set per move. A grid wraps items
        // onto rows, so "insert here" is a vertical line BETWEEN two cards on
        // one row but a horizontal line between rows - the same marker read
        // one way in both places was telling you the welcome banner would slot
        // in beside a card when it was actually about to take a row of its own.
        placeholderVerticalClass: 'is-placeholder-vertical',
        placeholderHorizontalClass: 'is-placeholder-horizontal',
        onChange: null,        // function(order, container) - fires once, on drop, if the order changed
        mergeable: false,      // opt-in: dropping in the INNER zone of another item fires onMerge instead of reordering
        mergeInset: 28,        // px inset from an item's edges that counts as its "merge zone" rather than its "reorder edge"
        mergeTargetClass: 'is-merge-target',
        isMergeable: null,     // function(el): bool - gates the item being DRAGGED (can it be a merge source at all); null = anything can
        isMergeTarget: null,   // function(el): bool - gates merge TARGET candidates; null = falls back to isMergeable (same rule both ways)
        onMerge: null,         // function(draggedEl, targetEl, container) - fires on drop instead of onChange, only when armed
    };

    // The scroller the list autoscrolls while an item is dragged to its edge:
    // the closest ancestor that scrolls DOWN (overflow-y auto or scroll, and
    // taller inside than out), the page otherwise. Not the core's closest
    // scroller, which a wrapper scrolling sideways is too (a table in an
    // overflow-x box): its scrollTop goes nowhere, and the page stood still
    // under the dragged row.
    function closestScrollable(el) {
        for (var node = el.parentElement; node && node !== document.body && node !== document.documentElement; node = node.parentElement) {
            if (node.scrollHeight <= node.clientHeight) continue;
            var overflowY = getComputedStyle(node).overflowY;
            if (overflowY === 'auto' || overflowY === 'scroll') return node;
        }
        return document.scrollingElement || document.documentElement;
    }

    function StickySortable(container, options) {
        this.container = container;
        this.options = Object.assign({}, defaults, options);
        this.scroller = closestScrollable(container);
        this.dragging = null;
        this.placeholder = null;
        this.startY = 0;
        this.startIndex = -1;
        this.pointerId = null;
        this.autoscrollFrame = null;
        this.autoscrollDirection = 0;
        this.mergeTarget = null;

        this.onPointerDown = this.onPointerDown.bind(this);
        this.onPointerMove = this.onPointerMove.bind(this);
        this.onPointerUp = this.onPointerUp.bind(this);

        container.addEventListener('pointerdown', this.onPointerDown);
        container.addEventListener('keydown', this.onKeyDown.bind(this));
    }

    StickySortable.prototype.items = function () {
        return Array.prototype.slice.call(this.container.querySelectorAll(this.options.items))
            .filter(function (el) { return el.parentElement === this.container; }.bind(this));
    };

    StickySortable.prototype.onPointerDown = function (e) {
        if (this.dragging || e.button !== undefined && e.button !== 0) {
            return;
        }

        var handle = this.options.handle ? e.target.closest(this.options.handle) : e.target;
        if (!handle) {
            return;
        }

        var item = e.target.closest(this.options.items);
        if (!item || item.parentElement !== this.container) {
            return;
        }

        this.forgetPress();
        this.pendingItem = item;
        this.pendingPointerId = e.pointerId;
        this.pendingStartX = e.clientX;
        this.pendingStartY = e.clientY;

        this.container.addEventListener('pointermove', this.onPendingMove = function (moveEvent) {
            if (moveEvent.pointerId !== this.pendingPointerId) {
                return;
            }
            // no button held any more: the press ended where nothing told us
            if (moveEvent.buttons === 0) {
                this.forgetPress();
                return;
            }
            var dx = moveEvent.clientX - this.pendingStartX;
            var dy = moveEvent.clientY - this.pendingStartY;
            if (Math.sqrt(dx * dx + dy * dy) >= this.options.dragThreshold) {
                this.beginDrag(this.pendingItem, this.pendingPointerId, moveEvent);
            }
        }.bind(this));

        // A press released before the threshold is a click: forgotten wherever it ends - on the
        // list, outside it, or cancelled by the browser. (Only a pointerup on the container forgot
        // it: released a few px out, the next move of the pointer over the list dragged with no
        // button held.)
        this.onPendingUp = function (upEvent) {
            if (upEvent.pointerId === this.pendingPointerId) this.forgetPress();
        }.bind(this);
        document.addEventListener('pointerup', this.onPendingUp, true);
        document.addEventListener('pointercancel', this.onPendingUp, true);
    };

    /** The press waiting for the drag threshold, forgotten: its listeners removed. */
    StickySortable.prototype.forgetPress = function () {
        if (this.onPendingMove) this.container.removeEventListener('pointermove', this.onPendingMove);
        if (this.onPendingUp) {
            document.removeEventListener('pointerup', this.onPendingUp, true);
            document.removeEventListener('pointercancel', this.onPendingUp, true);
        }
        this.onPendingMove = null;
        this.onPendingUp = null;
        this.pendingItem = null;
    };

    StickySortable.prototype.beginDrag = function (item, pointerId, e) {
        this.forgetPress();

        this.dragging = item;
        this.pointerId = pointerId;
        this.startIndex = this.items().indexOf(item);
        this.startNext = item.nextSibling;

        item.setPointerCapture(pointerId);
        item.classList.add(this.options.draggingClass);

        this.placeholder = document.createElement(item.tagName);
        this.placeholder.className = this.options.placeholderClass;
        // Published as a custom property, not as height: the marker is a line
        // whose thickness is the stylesheet's business, but it still needs the
        // dragged item's measurements to know how LONG to be along the axis it
        // ends up on. Setting height here instead would be an inline style the
        // orientation rules could only beat with !important.
        this.placeholder.style.setProperty('--sortable-item-height', item.offsetHeight + 'px');
        this.placeholder.style.setProperty('--sortable-item-width', item.offsetWidth + 'px');
        item.parentElement.insertBefore(this.placeholder, item.nextSibling);

        var rect = item.getBoundingClientRect();
        this.offsetX = e.clientX - rect.left;
        this.offsetY = e.clientY - rect.top;
        item.style.position = 'fixed';
        item.style.width = rect.width + 'px';
        item.style.zIndex = 1000;
        item.style.pointerEvents = 'none';
        this.moveItemTo(e.clientX, e.clientY);

        document.addEventListener('pointermove', this.onPointerMove);
        document.addEventListener('pointerup', this.onPointerUp);
        document.addEventListener('pointercancel', this.onPointerUp);
    };

    // axis:'y' locks left to wherever the drag started (a single-column
    // list has nothing to gain from tracking x, and this keeps that case's
    // behavior byte-for-byte unchanged) - any other axis value follows the
    // pointer on both axes, needed for a multi-column grid like the
    // dashboard's widget grid.
    StickySortable.prototype.moveItemTo = function (clientX, clientY) {
        this.dragging.style.top = (clientY - this.offsetY) + 'px';
        this.dragging.style.left = 'y' === this.options.axis
            ? this.dragging.getBoundingClientRect().left + 'px'
            : (clientX - this.offsetX) + 'px';
    };

    // Single-column mode (axis:'y'): unchanged from before - compare only
    // vertical midpoints, in DOM order. Free/grid mode: "nearest sibling
    // wins" alone doesn't say which SIDE to drop on (a grid has more than
    // one neighbor at similar distance), so whichever axis has the larger
    // offset from that sibling's center decides before-vs-after.

    /**
     * Do these two boxes sit on the same visual row?
     *
     * Overlap of more than half the shorter box, not "same top": widgets on a
     * row are stretched to the tallest of them but a shorter neighbour that
     * has not stretched still shares the row, and an exact-top test would
     * call that a different one.
     */
    StickySortable.prototype.sharesRow = function (a, b) {
        if (!a || !b) {
            return false;
        }
        var ra = a.getBoundingClientRect();
        var rb = b.getBoundingClientRect();
        if (!ra.height || !rb.height) {
            return false;
        }

        return Math.min(ra.bottom, rb.bottom) - Math.max(ra.top, rb.top) > Math.min(ra.height, rb.height) / 2;
    };

    /**
     * Which way the drop marker should read, from where it has just landed.
     *
     * Decided from the NEIGHBOURS rather than the placeholder itself: the
     * placeholder is styled as a thin line, so it has no footprint of its own
     * left to compare against anything.
     *
     *   between two cards sharing a row  -> vertical, it goes between them
     *   nothing before it                -> horizontal, it starts a new row
     *   neighbours on different rows     -> horizontal, it goes between rows
     *   last position, room left on the row -> vertical
     *
     * A plain vertical list (the sidebar menu uses this same sortable) never
     * has two neighbours sharing a row, so it always reads horizontal, which
     * is the right answer there without a special case.
     */
    StickySortable.prototype.orientPlaceholder = function () {
        if (!this.placeholder) {
            return;
        }

        var isItem = function (el) {
            return el && el !== this.dragging && el.matches(this.options.items);
        }.bind(this);

        var prev = this.placeholder.previousElementSibling;
        while (prev && !isItem(prev)) {
            prev = prev.previousElementSibling;
        }
        var next = this.placeholder.nextElementSibling;
        while (next && !isItem(next)) {
            next = next.nextElementSibling;
        }

        var vertical;
        if (!prev) {
            vertical = false;
        } else if (next) {
            vertical = this.sharesRow(prev, next);
        } else {
            // Nothing after it, so there is no pair to read a row from. The
            // question becomes whether the dragged item still fits beside the
            // last one, which is what decides if it joins that row or starts
            // the next.
            var prevRect = prev.getBoundingClientRect();
            var containerRect = this.container.getBoundingClientRect();
            var draggedWidth = this.dragging ? this.dragging.getBoundingClientRect().width : 0;
            vertical = (prevRect.right + draggedWidth) <= containerRect.right;
        }

        this.placeholder.classList.toggle(this.options.placeholderVerticalClass, vertical);
        this.placeholder.classList.toggle(this.options.placeholderHorizontalClass, !vertical);
    };

    StickySortable.prototype.findDropTarget = function (siblings, x, y) {
        if ('y' === this.options.axis) {
            for (var i = 0; i < siblings.length; i++) {
                var rect = siblings[i].getBoundingClientRect();
                if (y < rect.top + rect.height / 2) {
                    return { el: siblings[i], before: true };
                }
            }
            return null;
        }

        // Distance to the nearest point ON EACH RECT (clamped to its
        // edges), not to its center. A wide/tall item (e.g. a 3-of-5-
        // column chart card) has empty grid space free in its OWN row -
        // center-to-center distance made that empty space attract to
        // whatever smaller item happened to sit directly above/below it
        // in a different row instead, since a small item's center can be
        // numerically closer than a big item's center even though the
        // big item's actual edge is right there. Rect-distance is 0 for
        // any point already alongside the item (same row, past its edge),
        // so the item you're visually next to wins regardless of size.
        var closest = null;
        var closestDist = Infinity;
        siblings.forEach(function (el) {
            var r = el.getBoundingClientRect();
            var nearestX = Math.max(r.left, Math.min(x, r.right));
            var nearestY = Math.max(r.top, Math.min(y, r.bottom));
            var dist = Math.pow(x - nearestX, 2) + Math.pow(y - nearestY, 2);
            if (dist < closestDist) {
                closestDist = dist;
                closest = { el: el, cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
            }
        });
        if (!closest) {
            return null;
        }

        var dx = x - closest.cx;
        var dy = y - closest.cy;
        var before = Math.abs(dx) > Math.abs(dy) ? dx < 0 : dy < 0;
        return { el: closest.el, before: before };
    };

    // Only relevant when options.mergeable - an inset "inner zone" of a
    // sibling's own rect, distinct from findDropTarget()'s reorder logic
    // above (which reacts to nearest EDGE/point, not containment). A
    // point can be simultaneously "nearest" a sibling for reorder purposes
    // and inside its merge zone; onPointerMove checks merge FIRST and
    // short-circuits reorder entirely while a merge target is armed, so
    // there's never a conflict between the two at drop time.
    StickySortable.prototype.findMergeTarget = function (siblings, x, y) {
        var inset = this.options.mergeInset;
        // isMergeTarget, not isMergeable, for the CANDIDATE side - a
        // composite can be a valid drop target (gains a pane) without
        // being draggable to merge further itself; falls back to
        // isMergeable when the two aren't meant to differ.
        var isTarget = this.options.isMergeTarget || this.options.isMergeable;
        for (var i = 0; i < siblings.length; i++) {
            var el = siblings[i];
            if (isTarget && !isTarget(el)) {
                continue;
            }
            var r = el.getBoundingClientRect();
            if (x >= r.left + inset && x <= r.right - inset && y >= r.top + inset && y <= r.bottom - inset) {
                return el;
            }
        }
        return null;
    };

    StickySortable.prototype.onPointerMove = function (e) {
        if (!this.dragging || e.pointerId !== this.pointerId) {
            return;
        }

        this.moveItemTo(e.clientX, e.clientY);

        var siblings = Array.prototype.slice.call(this.container.children).filter(function (el) {
            return el !== this.dragging && el !== this.placeholder && el.matches(this.options.items);
        }.bind(this));

        if (this.options.mergeable) {
            var mergeCandidate = this.options.isMergeable && !this.options.isMergeable(this.dragging)
                ? null // the item being dragged isn't itself a valid merge source (e.g. a composite) - never arm a merge for it, only allow it to reorder
                : this.findMergeTarget(siblings, e.clientX, e.clientY);
            if (mergeCandidate !== this.mergeTarget) {
                if (this.mergeTarget) {
                    this.mergeTarget.classList.remove(this.options.mergeTargetClass);
                }
                this.mergeTarget = mergeCandidate;
                if (this.mergeTarget) {
                    this.mergeTarget.classList.add(this.options.mergeTargetClass);
                }
            }
            if (this.mergeTarget) {
                // Armed: leave the placeholder exactly where it is - the
                // dragged item's eventual REORDER position is moot, it's
                // about to be replaced (along with the target) by onMerge.
                if (this.options.autoscroll) {
                    this.updateAutoscroll(e.clientY);
                }
                return;
            }
        }

        var target = this.findDropTarget(siblings, e.clientX, e.clientY);
        if (target) {
            this.container.insertBefore(this.placeholder, target.before ? target.el : target.el.nextSibling);
        } else if (siblings.length) {
            this.container.insertBefore(this.placeholder, null);
        }

        this.orientPlaceholder();

        if (this.options.autoscroll) {
            this.updateAutoscroll(e.clientY);
        }
    };

    // How much of the scroller's top edge is hidden under something pinned
    // across it. A sticky header covers exactly the band that triggers upward
    // scrolling, so the pointer can never reach it and dragging a card upwards
    // simply refuses to scroll - reported on the dashboard, whose topbar is
    // sticky and ~53px tall against a 40px band. Measured once per drag.
    StickySortable.prototype.topInset = function (rect) {

        if (this._topInset !== undefined && this._topInset !== null) return this._topInset;
        if (this.options.autoscrollInsetTop !== null && this.options.autoscrollInsetTop !== undefined) {
            this._topInset = this.options.autoscrollInsetTop;
            return this._topInset;
        }

        var inset = 0;
        try {
            var probe = document.elementFromPoint(Math.max(1, Math.round(window.innerWidth / 2)), Math.round(rect.top) + 1);
            while (probe && probe !== document.body) {
                var position = getComputedStyle(probe).position;
                if (position === 'sticky' || position === 'fixed') {
                    var bottom = probe.getBoundingClientRect().bottom;
                    if (bottom > rect.top) inset = Math.max(inset, bottom - rect.top);
                    break;
                }
                probe = probe.parentElement;
            }
        } catch (e) {}

        this._topInset = inset;
        return inset;
    };

    StickySortable.prototype.updateAutoscroll = function (clientY) {
        var rect = this.scroller === document.scrollingElement || this.scroller === document.documentElement
            ? { top: 0, bottom: window.innerHeight }
            : this.scroller.getBoundingClientRect();

        var edge = this.options.autoscrollEdge;
        // A finger needs a wider target than a pointer, and on a phone the
        // outermost pixels belong to the browser's own edge gestures.
        if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
            edge = Math.max(edge, 90);
        }

        if (clientY < rect.top + this.topInset(rect) + edge) {
            this.autoscrollDirection = -1;
        } else if (clientY > rect.bottom - edge) {
            this.autoscrollDirection = 1;
        } else {
            this.autoscrollDirection = 0;
        }

        if (this.autoscrollDirection !== 0 && !this.autoscrollFrame) {
            this.runAutoscroll();
        }
    };

    StickySortable.prototype.runAutoscroll = function () {
        if (!this.dragging || this.autoscrollDirection === 0) {
            this.autoscrollFrame = null;
            return;
        }
        this.scroller.scrollTop += this.autoscrollDirection * this.options.autoscrollSpeed;
        this.autoscrollFrame = requestAnimationFrame(this.runAutoscroll.bind(this));
    };

    StickySortable.prototype.onPointerUp = function (e) {

        // Measured per drag: a swap or a resize can move the sticky header.
        this._topInset = undefined;
        if (!this.dragging || e.pointerId !== this.pointerId) {
            return;
        }

        var item = this.dragging;
        item.releasePointerCapture(this.pointerId);
        item.classList.remove(this.options.draggingClass);
        item.style.position = '';
        item.style.top = '';
        item.style.left = '';
        item.style.width = '';
        item.style.zIndex = '';
        item.style.pointerEvents = '';

        // A drag the browser cancelled (pointercancel: the page took the gesture, a call...) puts
        // the item back where it was, and tells nothing.
        var cancelled = e.type === 'pointercancel';
        if (cancelled) this.container.insertBefore(item, this.startNext && this.startNext.parentNode === this.container ? this.startNext : null);
        else this.container.insertBefore(item, this.placeholder);
        this.placeholder.remove();
        this.placeholder = null;

        this.autoscrollDirection = 0;
        if (this.autoscrollFrame) {
            cancelAnimationFrame(this.autoscrollFrame);
            this.autoscrollFrame = null;
        }

        document.removeEventListener('pointermove', this.onPointerMove);
        document.removeEventListener('pointerup', this.onPointerUp);
        document.removeEventListener('pointercancel', this.onPointerUp);

        var mergeTarget = this.mergeTarget;
        if (mergeTarget) {
            mergeTarget.classList.remove(this.options.mergeTargetClass);
            this.mergeTarget = null;
        }
        if (cancelled) {
            this.dragging = null;
            this.pointerId = null;
            return;
        }

        var newIndex = this.items().indexOf(item);
        this.dragging = null;
        this.pointerId = null;

        if (mergeTarget) {
            if (typeof this.options.onMerge === 'function') {
                this.options.onMerge(item, mergeTarget, this.container);
            }
            return;
        }

        if (newIndex !== this.startIndex && typeof this.options.onChange === 'function') {
            this.options.onChange(this.items(), this.container);
        }
    };

    /** Keyboard fallback: focus a handle, ArrowUp/ArrowDown moves its item, no pointer needed. */
    StickySortable.prototype.onKeyDown = function (e) {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') {
            return;
        }

        var handle = this.options.handle ? e.target.closest(this.options.handle) : null;
        if (!handle) {
            return;
        }

        var item = e.target.closest(this.options.items);
        if (!item || item.parentElement !== this.container) {
            return;
        }

        var items = this.items();
        var index = items.indexOf(item);
        var swapWith = e.key === 'ArrowUp' ? items[index - 1] : items[index + 1];
        if (!swapWith) {
            return;
        }

        e.preventDefault();
        if (e.key === 'ArrowUp') {
            this.container.insertBefore(item, swapWith);
        } else {
            this.container.insertBefore(item, swapWith.nextSibling);
        }
        handle.focus();

        if (typeof this.options.onChange === 'function') {
            this.options.onChange(this.items(), this.container);
        }
    };

    if ($) {
        $.fn.stickySortable = function (options) {
            return this.each(function () {
                if (!this._stickySortable) {
                    this._stickySortable = new StickySortable(this, options);
                }
            });
        };
        // $(ol).stickySortableTree({ handle: '.grip', maxDepth: 2 }): StickySortable.Tree, once per root.
        $.fn.stickySortableTree = function (options) {
            return this.each(function () {
                if (!this._stickySortableTree) {
                    this._stickySortableTree = new StickySortable.Tree(this, options);
                }
            });
        };
    }


    // ── StickySortable.Tree: a hierarchy (1.6) ──────────────────────────────
    // Nested lists - an item holding a list of its own - reordered and
    // re-parented: a chapter's sections, a menu's entries.
    //
    //   <ol id="toc">
    //     <li data-sortable-item data-id="c1"><button class="grip">⠿</button> Chapter 1
    //       <ol><li data-sortable-item data-id="s1"><button class="grip">⠿</button> Section</li></ol>
    //     </li>
    //     <li data-sortable-item data-id="c2" data-sortable-leaf>…</li>   (accepts no child)
    //   </ol>
    //   var tree = new StickySortable.Tree(document.getElementById('toc'), { handle: '.grip', maxDepth: 2 });
    //
    // Dragged by its handle (the pointer; on a touch screen after a long
    // press), an item is dropped where a marker shows: between two items, at
    // the level the pointer's horizontal place asks for - one step right is
    // the child of the item above, a step left the level of its parent - as
    // far as the neighbours allow (never deeper than under the item above,
    // never shallower than the item below), within maxDepth and the items
    // that accept children. On a focused handle: ↑ ↓ move the item among its
    // siblings, → makes it the last child of the one above, ← takes it out to
    // its parent's level, just after its parent; each move said in an
    // aria-live region. A [data-sortable-toggle] button folds and unfolds an
    // item's children (aria-expanded). After a move: onChange({item, parent,
    // index, depth, tree}) and "sortable:change" on the root, the same detail;
    // tree.serialize() is the tree as nested ids ([{id, children: [...]}]).
    var treeDefaults = {
        handle: null,                       // selector, relative to the item; null drags the whole item
        items: '[data-sortable-item]',
        lists: 'ol, ul',                    // an item's own list of children: its first such child element
        indent: 24,                         // px of horizontal movement that is one level
        maxDepth: Infinity,                 // levels below the root (0: a flat list; 1: children, no grandchildren)
        accepts: null,                      // function(item): bool - may it have children; default: not [data-sortable-leaf]
        dragThreshold: 4,
        longPress: 350,                     // ms a finger holds a handle before the item is dragged
        draggingClass: 'is-dragging',
        markerClass: 'is-tree-marker',
        collapsedClass: 'is-collapsed',
        labels: {                           // the announcements, in the page's words; %s: the item, the place
            moved: '%item% moved: position %index% of %count%, level %depth%.',
            nested: '%item% is now inside %parent%.',
            outdented: '%item% moved out of %parent%.',
            refused: '%item% cannot move there.'
        },
        onChange: null
    };

    function Tree(root, options) {
        this.root = root;
        this.options = Object.assign({}, treeDefaults, options);
        this.options.labels = Object.assign({}, treeDefaults.labels, options && options.labels);
        this.drag = null;
        this.live = document.createElement('div');
        this.live.className = 'sortable-live';
        this.live.setAttribute('aria-live', 'polite');
        this.live.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap';
        root.parentNode.insertBefore(this.live, root.nextSibling);
        this.onPointerDown = this.onPointerDown.bind(this);
        this.onMove = this.onMove.bind(this);
        this.onUp = this.onUp.bind(this);
        this.onKeyDown = this.onKeyDown.bind(this);
        this.onClick = this.onClick.bind(this);
        root.addEventListener('pointerdown', this.onPointerDown);
        root.addEventListener('keydown', this.onKeyDown);
        root.addEventListener('click', this.onClick);
        var self = this;
        this.all().forEach(function (item) { self.sync(item); });
    }

    Tree.prototype.all = function () {
        return Array.prototype.slice.call(this.root.querySelectorAll(this.options.items));
    };
    Tree.prototype.isItem = function (el) { return !!el && el.matches && el.matches(this.options.items) && this.root.contains(el); };
    Tree.prototype.listOf = function (item, create) {
        for (var i = 0; i < item.children.length; i++) if (item.children[i].matches(this.options.lists)) return item.children[i];
        if (!create) return null;
        var list = document.createElement(this.root.tagName);
        item.appendChild(list);
        return list;
    };
    Tree.prototype.parentOf = function (item) {
        var p = item.parentElement && item.parentElement.closest(this.options.items);
        return p && this.root.contains(p) ? p : null;
    };
    Tree.prototype.depthOf = function (item) {
        var d = 0;
        for (var p = this.parentOf(item); p; p = this.parentOf(p)) d++;
        return d;
    };
    Tree.prototype.siblingsOf = function (item) {
        var opts = this.options;
        return Array.prototype.filter.call(item.parentElement.children, function (el) { return el.matches(opts.items); });
    };
    /** How many levels an item's subtree holds below it (0 for an item without children). */
    Tree.prototype.heightOf = function (item) {
        var list = this.listOf(item), h = 0, self = this;
        if (!list) return 0;
        Array.prototype.forEach.call(list.children, function (child) { if (self.isItem(child)) h = Math.max(h, 1 + self.heightOf(child)); });
        return h;
    };
    Tree.prototype.accepts = function (item) {
        return typeof this.options.accepts === 'function' ? !!this.options.accepts(item) : !item.hasAttribute('data-sortable-leaf');
    };
    Tree.prototype.label = function (item) {
        var l = item.getAttribute('data-sortable-label');
        if (l) return l;
        var clone = item.cloneNode(true), opts = this.options;
        var strip = [opts.lists, '[data-sortable-toggle]', '[aria-hidden="true"]'].concat(opts.handle ? [opts.handle] : []).join(',');
        Array.prototype.forEach.call(clone.querySelectorAll(strip), function (el) { el.remove(); });
        return clone.textContent.replace(/\s+/g, ' ').trim();
    };

    /** The tree as nested ids: data-id, else id. */
    Tree.prototype.serialize = function (list) {
        var self = this;
        list = list || this.root;
        return Array.prototype.filter.call(list.children, function (el) { return self.isItem(el); }).map(function (item) {
            var children = self.listOf(item);
            return { id: item.getAttribute('data-id') || item.id || self.label(item), children: children ? self.serialize(children) : [] };
        });
    };

    /** An item's children folded (true) or unfolded. */
    Tree.prototype.collapse = function (item, folded) {
        if (folded === undefined) folded = true;
        item.classList.toggle(this.options.collapsedClass, folded);
        var list = this.listOf(item);
        if (list) list.hidden = folded;
        this.sync(item);
    };
    Tree.prototype.expand = function (item) { this.collapse(item, false); };
    Tree.prototype.sync = function (item) {
        var toggle = item.querySelector(':scope > [data-sortable-toggle]') || (item.firstElementChild && item.firstElementChild.querySelector && item.firstElementChild.querySelector('[data-sortable-toggle]'));
        var list = this.listOf(item);
        var has = !!list && Array.prototype.some.call(list.children, this.isItem.bind(this));
        if (toggle) {
            toggle.hidden = !has;
            toggle.setAttribute('aria-expanded', String(!item.classList.contains(this.options.collapsedClass)));
            if (list && !list.id) list.id = 'sortable-children-' + Math.random().toString(36).slice(2, 9);
            if (list) toggle.setAttribute('aria-controls', list.id);
        }
        // An empty list left behind by the last child moved away: gone.
        if (list && !has) list.remove();
    };

    Tree.prototype.say = function (key, item, extra) {
        var text = this.options.labels[key].replace('%item%', this.label(item));
        Object.keys(extra || {}).forEach(function (k) { text = text.replace('%' + k + '%', extra[k]); });
        this.live.textContent = text;
        return text;
    };

    Tree.prototype.changed = function (item, previousParent) {
        var self = this;
        [item, this.parentOf(item), previousParent].forEach(function (el) { if (el) self.sync(el); });
        var parent = this.parentOf(item);
        var detail = { item: item, parent: parent, index: this.siblingsOf(item).indexOf(item), depth: this.depthOf(item), tree: this.serialize() };
        if (typeof this.options.onChange === 'function') this.options.onChange(detail);
        this.root.dispatchEvent(new CustomEvent('sortable:change', { bubbles: true, detail: detail }));
        return detail;
    };

    /** Whether an item (its whole subtree) may sit at a depth under a parent. */
    Tree.prototype.allowed = function (item, parent, depth) {
        if (depth + this.heightOf(item) > this.options.maxDepth) return false;
        if (parent && (!this.accepts(parent) || parent === item || item.contains(parent))) return false;
        return true;
    };

    // ── The keyboard ──
    Tree.prototype.onKeyDown = function (e) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) === -1 || e.altKey || e.ctrlKey || e.metaKey) return;
        var handle = this.options.handle ? e.target.closest(this.options.handle) : e.target;
        var item = handle && handle.closest(this.options.items);
        if (!item || !this.root.contains(item) || (this.options.handle && !handle.matches(this.options.handle))) return;
        e.preventDefault();
        var siblings = this.siblingsOf(item), index = siblings.indexOf(item), previousParent = this.parentOf(item);
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            var other = siblings[index + (e.key === 'ArrowUp' ? -1 : 1)];
            if (!other) { this.say('refused', item); return; }
            item.parentElement.insertBefore(item, e.key === 'ArrowUp' ? other : other.nextSibling);
            this.changed(item, previousParent);
            this.say('moved', item, { index: this.siblingsOf(item).indexOf(item) + 1, count: siblings.length, depth: this.depthOf(item) + 1 });
        } else if (e.key === 'ArrowRight') {
            var above = siblings[index - 1];
            if (!above || !this.allowed(item, above, this.depthOf(item) + 1)) { this.say('refused', item); return; }
            this.listOf(above, true).appendChild(item);
            this.expand(above);
            this.changed(item, previousParent);
            this.say('nested', item, { parent: this.label(above) });
        } else {
            var parent = this.parentOf(item);
            if (!parent) { this.say('refused', item); return; }
            parent.parentElement.insertBefore(item, parent.nextSibling);
            this.changed(item, previousParent);
            this.say('outdented', item, { parent: this.label(parent) });
        }
        if (handle && handle.focus) handle.focus();
    };

    Tree.prototype.onClick = function (e) {
        var toggle = e.target.closest && e.target.closest('[data-sortable-toggle]');
        if (!toggle || !this.root.contains(toggle)) return;
        var item = toggle.closest(this.options.items);
        if (item) this.collapse(item, !item.classList.contains(this.options.collapsedClass));
    };

    // ── The pointer ──
    Tree.prototype.onPointerDown = function (e) {
        if (this.drag || (e.button !== undefined && e.button !== 0)) return;
        var handle = this.options.handle ? e.target.closest(this.options.handle) : e.target;
        var item = handle && e.target.closest(this.options.items);
        if (!item || !this.root.contains(item) || e.target.closest('[data-sortable-toggle]')) return;
        var self = this, start = { x: e.clientX, y: e.clientY, id: e.pointerId, at: Flow.now() };
        var touch = e.pointerType === 'touch';
        var armed = !touch, timer = null;
        if (touch) timer = setTimeout(function () { armed = true; item.classList.add('is-held'); }, this.options.longPress);
        var pending = function (m) {
            if (m.pointerId !== start.id) return;
            var dx = m.clientX - start.x, dy = m.clientY - start.y;
            if (Math.sqrt(dx * dx + dy * dy) < self.options.dragThreshold) return;
            if (!armed) { cancel(); return; }       // a finger that moved before the long press: not a drag
            cancel();
            self.begin(item, start, m);
        };
        var cancel = function () {
            clearTimeout(timer);
            item.classList.remove('is-held');
            document.removeEventListener('pointermove', pending);
            document.removeEventListener('pointerup', cancel);
            document.removeEventListener('pointercancel', cancel);
        };
        document.addEventListener('pointermove', pending);
        document.addEventListener('pointerup', cancel);
        document.addEventListener('pointercancel', cancel);
    };

    Tree.prototype.begin = function (item, start, e) {
        var marker = document.createElement('li');
        marker.className = this.options.markerClass;
        marker.setAttribute('aria-hidden', 'true');
        this.drag = { item: item, start: start, marker: marker, place: null, from: this.parentOf(item) };
        item.classList.add(this.options.draggingClass);
        item.style.pointerEvents = 'none';
        document.addEventListener('pointermove', this.onMove);
        document.addEventListener('pointerup', this.onUp);
        document.addEventListener('pointercancel', this.onUp);
        this.onMove(e);
    };

    /** Where a pointer at (x, y) drops the item: {list, before, parent, depth}. */
    Tree.prototype.place = function (x, y) {
        var self = this, item = this.drag.item;
        var visible = this.all().filter(function (el) {
            if (el === item || item.contains(el)) return false;
            for (var p = self.parentOf(el); p; p = self.parentOf(p)) if (p.classList.contains(self.options.collapsedClass)) return false;
            return true;
        });
        // The item before which the marker goes: the first whose middle is below the pointer.
        var nextIndex = visible.length;
        for (var i = 0; i < visible.length; i++) {
            var r = visible[i].getBoundingClientRect();
            var top = r.top, firstLine = visible[i].firstElementChild ? visible[i].firstElementChild.getBoundingClientRect() : r;
            if (y < top + Math.min(r.height, firstLine.height || r.height) / 2) { nextIndex = i; break; }
        }
        var prev = visible[nextIndex - 1] || null, next = visible[nextIndex] || null;
        var maxDepth = prev ? this.depthOf(prev) + (this.accepts(prev) && !prev.classList.contains(this.options.collapsedClass) ? 1 : 0) : 0;
        var minDepth = next ? this.depthOf(next) : 0;
        if (minDepth > maxDepth) minDepth = maxDepth;
        // The level asked for: the item's own, plus one per indent the pointer went right.
        var wanted = Math.round((x - this.drag.start.x) / this.options.indent) + this.depthOf(item);
        var depth = Math.max(minDepth, Math.min(maxDepth, wanted));
        while (depth > minDepth && !this.allowed(item, depth === 0 ? null : this.ancestorAt(prev, depth - 1), depth)) depth--;
        var parent = depth === 0 ? null : this.ancestorAt(prev, depth - 1);
        if (!this.allowed(item, parent, depth)) return null;
        // The list and the place in it.
        if (prev && depth === this.depthOf(prev) + 1) return { parent: prev, depth: depth, list: this.listOf(prev), before: this.firstItemOf(this.listOf(prev)), into: prev };
        var sibling = prev ? this.ancestorAt(prev, depth) : null;
        if (sibling) return { parent: parent, depth: depth, list: sibling.parentElement, before: sibling.nextSibling };
        return { parent: null, depth: 0, list: this.root, before: this.firstItemOf(this.root) };
    };
    Tree.prototype.ancestorAt = function (item, depth) {
        if (!item) return null;
        var chain = [item];
        for (var p = this.parentOf(item); p; p = this.parentOf(p)) chain.unshift(p);
        return chain[depth] || null;
    };
    Tree.prototype.firstItemOf = function (list) {
        if (!list) return null;
        for (var i = 0; i < list.children.length; i++) if (this.isItem(list.children[i])) return list.children[i];
        return null;
    };

    Tree.prototype.onMove = function (e) {
        if (!this.drag || e.pointerId !== this.drag.start.id) return;
        if (e.cancelable) e.preventDefault();
        // The item follows the pointer; where it will land, the marker says.
        this.drag.item.style.transform = 'translate(' + (e.clientX - this.drag.start.x) + 'px,' + (e.clientY - this.drag.start.y) + 'px)';
        var place = this.place(e.clientX, e.clientY), was = this.drag.place;
        this.drag.place = place;
        var marker = this.drag.marker;
        var tidy = function (self) { if (was && was.into && (!place || place.into !== was.into)) self.sync(was.into); };
        if (!place) { marker.remove(); tidy(this); return; }
        // The marker: a line at the level aimed at, shifted as a tree is.
        marker.style.setProperty('--sortable-depth', String(place.depth));
        marker.setAttribute('data-depth', String(place.depth));
        var list = place.list || this.listOf(place.into, true);
        if (place.before) list.insertBefore(marker, place.before); else list.appendChild(marker);
        tidy(this);                                     // a list opened for an earlier place, now empty: gone
    };

    Tree.prototype.onUp = function (e) {
        if (!this.drag || (e.pointerId !== undefined && e.pointerId !== this.drag.start.id)) return;
        document.removeEventListener('pointermove', this.onMove);
        document.removeEventListener('pointerup', this.onUp);
        document.removeEventListener('pointercancel', this.onUp);
        var drag = this.drag, item = drag.item, marker = drag.marker;
        this.drag = null;
        item.classList.remove(this.options.draggingClass);
        item.style.transform = item.style.pointerEvents = '';
        if (e.type === 'pointercancel' || !drag.place || !marker.parentNode) {
            marker.remove();
            if (drag.place && drag.place.into) this.sync(drag.place.into);
            return;
        }
        marker.parentNode.insertBefore(item, marker);
        marker.remove();
        if (drag.place.into) this.expand(drag.place.into);
        var detail = this.changed(item, drag.from);
        this.say('moved', item, { index: detail.index + 1, count: this.siblingsOf(item).length, depth: detail.depth + 1 });
    };

    Tree.prototype.destroy = function () {
        this.root.removeEventListener('pointerdown', this.onPointerDown);
        this.root.removeEventListener('keydown', this.onKeyDown);
        this.root.removeEventListener('click', this.onClick);
        this.live.remove();
    };

    Tree.defaults = treeDefaults;
    StickySortable.Tree = Tree;

    StickySortable.defaults = defaults;

    return StickySortable;
});

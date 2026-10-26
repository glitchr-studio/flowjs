# @glitchr/flowjs

Scroll and navigation for pages that are server-rendered: links and forms that load the next
page in the background, scroll effects, scroll stops, sortable lists, named AJAX channels, and the
cookies with the visitor's consent. One library, one module per feature, one shared core. The
modules are independent of each other: a page imports what it needs, and each module finds the
others through the core when they are there (the stops hear the navigation's swaps, the sticky
effects share the core's scroll listeners with the stops).

The pages stay the server's: no virtual DOM, no client-side routing table, no build step required.
A module reads classes and data attributes the templates write, and announces what it does with
DOM events a page listens to.

## When to use it

- A server-rendered site (Symfony, Laravel, any templates) that wants page changes without a full
  reload, with the history, the scroll positions, the head and the scripts kept in step.
- Pages read by scrolling: a header that hides, sections a scroll settles on, the address that
  follows the headline being read, blocks that fade in.
- A consent panel whose categories, cookies and features the site declares, in its own words.

When not: a single-page application with its own router and state (the navigation swaps a block of
server HTML); a page that needs none of the modules - the core alone does nothing visible.

## Modules

| Module | Global | Entry | What it does | Needs | Manual |
| --- | --- | --- | --- | --- | --- |
| core | `Flow` | loaded by every entry | units and durations, scrollers, one scroll/resize/interrupt listener per scroller, one animation frame for the measurements, programmatic scroll, the address hash, page-loaded moments, the jQuery plugins | nothing | [Flow (core)](core.md) |
| navigation | `Transparent`, `FlowFrame` | `navigation` | links and forms load in the background and swap the page in place; history, scroll positions, head and scripts kept in step; a progress bar that never blinks; a website in the website (1.6); nested panels, prefetch, form memory, lazy loading | jQuery (FlowFrame: nothing) | [Transparent](navigation.md) |
| sticky | `Sticky` | `sticky` | scroll effects: hiding header, bottom bar, widgets, fading blocks, the address following the headline read, magnets, scroll-percent triggers, swipes, autoscroll | jQuery | [Sticky and stops](sticky.md) |
| stops | `StickyStops` | `stops` | places on the page that a scroll settles on once it comes to rest, with keys and sideways rows | nothing | [Scroll stops](sticky.md#scroll-stops) |
| scenes | `StickyScenes` | `scenes` | sections the scroll drives while their stage stays pinned: a progress 0 to 1 in CSS and in an event, steps, an image sequence (1.6) | nothing | [Scroll-driven scenes](scenes.md) |
| sortable | `StickySortable` | `sortable` | drag-and-drop reordering with pointer events | nothing (jQuery only for the `$.fn.stickySortable` plugin) | [StickySortable](sortable.md) |
| ajaxer | `Ajaxer` | `ajaxer` | named AJAX channels over `$.ajax`: throttle, debounce, loader, retry, request limit | jQuery | [Ajaxer](ajaxer.md) |
| cookie | `Cookie` | `cookie` | what a site stores in the browser and the visitor's consent to it: categories, the cookies and storage entries under each, features started at a grant and stopped at a withdrawal, a banner and a detailed section in the site's words | nothing | [Cookie](cookie.md) |

Each module sets its global (`window.Transparent`, ...) and registers itself on the core
(`Flow.navigation`, `Flow.sticky`, `Flow.stops`, `Flow.sortable`, `Flow.ajaxer`, `Flow.cookie`).
A module that needs jQuery and does not find it throws when loaded (`"sticky.js: jQuery is
needed"`); one loaded without the core throws `"... load core.js first"`.

## Installation

### With a bundler

```sh
npm install @glitchr/flowjs
```

Everything, with the stylesheets (a bundler with Sass, and jQuery provided - e.g. webpack's
`ProvidePlugin`, which gives the bare `jQuery` identifier the modules look for first):

```js
import '@glitchr/flowjs';
```

One module (its stylesheet when it has one, and the core):

```js
import '@glitchr/flowjs/navigation';   // Transparent, src/css/navigation.scss
import '@glitchr/flowjs/sticky';       // Sticky, src/css/sticky.scss
import '@glitchr/flowjs/stops';        // StickyStops (no stylesheet)
import '@glitchr/flowjs/sortable';     // StickySortable (no stylesheet)
import '@glitchr/flowjs/ajaxer';       // Ajaxer, src/css/ajaxer.scss
import '@glitchr/flowjs/cookie';       // Cookie (no stylesheet imported)
```

The stylesheets are `src/css/navigation.scss`, `sticky.scss`, `ajaxer.scss`, and `index.scss` for
all three. `cookie.scss`, a minimal look for the cookie banner, is imported by no entry - a site
asks for it (`@glitchr/flowjs/src/css/cookie.scss`) or styles its banner itself.

A webpack Encore site, for instance:

```js
// webpack.config.js
Encore.autoProvidejQuery();            // jQuery for the navigation, sticky and ajaxer
// assets/app.js
import '@glitchr/flowjs/navigation';
import '@glitchr/flowjs/stops';
Transparent.ready({ identifier: '#page' });
```

### Without a bundler

The files of `src/js/` in a page, `core.js` first, after jQuery for the modules that need it:

```html
<script src="jquery.js"></script>
<script src="src/js/core.js"></script>
<script src="src/js/stops.js"></script>
```

The modules are plain scripts (UMD-style: they set their global, and `module.exports` under
CommonJS). The stylesheets are Sass: compile `src/css/*.scss` to CSS for such a page.

## How this manual is organised

- [Flow (core)](core.md): what every module shares - units, durations, scrollers, listeners, the
  frame, programmatic scroll, the hash, the page's moments, the jQuery plugins.
- [Transparent (navigation)](navigation.md): the navigation, its options, events, cache, prefetch,
  form memory, lazy loading and nested panels.
- [Sticky and stops](sticky.md): the scroll effects (options, classes, events, methods), then the
  scroll stops.
- [Scroll-driven scenes](scenes.md): a pinned stage the scroll plays (1.6).
- [StickySortable](sortable.md), [Ajaxer](ajaxer.md), [Cookie](cookie.md): one page each, with its
  options table, attributes, events and methods.
- [Testing](testing.md): the test pages, how to run them, what each covers.

Headings that end with a version, "(1.1)", name the version that brought what they describe.

## Changelog and versions

[CHANGELOG.md](../CHANGELOG.md) says what each version changed; this manual describes 1.5.4
(`package.json`). Each module also carries a number of its own, older than the package's
(`Transparent.version`, `Sticky.version`, `Ajaxer.version`, `Flow.version`): read the version from
`package.json`.

The website, https://glitchr-studio.github.io/flowjs/, runs every module live beside its code and
holds this manual on one page with the API reference and the changelog.

## Licence

MIT since 2026-10-10; earlier versions remain published under LGPL-3.0-or-later.

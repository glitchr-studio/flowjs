---
title: Cookie
order: 60
---

# Cookie

`src/js/cookie.js` - what a site keeps in the visitor's browser, and the
visitor's say over it. The successor of `@glitchr/cookie` 1.0.53: the `Cookie`
global and its methods keep their names and their meaning (see
[From @glitchr/cookie](#from-glitchrcookie)). Needs the core; no jQuery.

```js
import '@glitchr/flowjs/cookie';      // the core and the Cookie global, no stylesheet
```

Three things are declared by the site, never by the library:

- **categories** of consent - a key, the site's words for it, whether it is on
  before any answer, whether it can be refused;
- **what is stored** - each cookie, `localStorage` or `sessionStorage` entry,
  by name or pattern, with its duration and its purpose, under a category;
- **features** - what to start when a category is granted and to stop when it
  is withdrawn: a function, or an inert element of the page.

The library keeps the answer, asks again when it has to, shows the banner and
the detailed section, and enforces the answer: nothing is read or written
through it under a refused category, and what a withdrawn category governed is
erased.

**No sentence is written in the library.** Every word the visitor reads comes
from the configuration (`texts`, the categories' `label` and `description`) or
from the site's own HTML.

## Loading

| Entry | Loads |
|---|---|
| `import '@glitchr/flowjs/cookie'` | `src/js/core.js` and `src/js/cookie.js`; no stylesheet |
| `import '@glitchr/flowjs'` | every module, this one included (still no cookie stylesheet) |
| `<script src="src/js/cookie.js">` | after `src/js/core.js`; jQuery is not needed |
| `@import '@glitchr/flowjs/src/css/cookie.scss'` | the optional minimal look, see [The stylesheet](#the-stylesheet) |

The script throws `cookie.js: load core.js first` without the core. It sets `window.Cookie` and
`Flow.cookie` (the same object) and exports it to CommonJS. Loaded twice (two bundles of one
page), the second copy keeps the first `Cookie` (`Cookie.flow === true`): one answer, one banner.
`Cookie.version` is the library's version (`Flow.version`).

Nothing is shown before the site declares a category: `Cookie.ready()` without categories, or no
call at all, shows no banner and binds no click. The module works at each moment of a page, as
the core gives them (`Flow.onPage`: the document parsed, the window's `load`, and every
`transparent:load` of the navigation): it reads the page's configuration blocks, then, once
`Cookie.ready()` has been called, wakes or puts to sleep the inert elements, keeps the banner
in the page and shows it while an answer is wanted.

## A site's configuration

```js
Cookie.ready({
    version: '2026-10',                       // of the categories: changed, the visitor is asked again
    position: 'bottom-left',                  // a word for the stylesheet (data-cookie-position)

    categories: {
        necessary: {
            label: 'Le fonctionnement du site',
            description: 'Votre session et votre panier.',
            required: true,                   // cannot be refused: its switch is locked on
            storage: [
                { type: 'cookie', name: 'PHPSESSID', duration: 'session', purpose: 'Votre session.' }
            ]
        },
        preferences: {
            label: 'Vos préférences',
            description: 'Votre langue, votre thème, votre fuseau horaire.',
            default: true,                    // on until refused
            storage: [
                { type: 'cookie', name: 'USER/*', duration: '30d', purpose: 'Langue, thème, fuseau horaire.' },
                { type: 'local', name: 'theme', purpose: 'Le thème choisi.' }
            ]
        },
        analytics: {
            label: 'La mesure d\'audience',
            description: 'Un identifiant anonyme pour compter les visites.',
            storage: [
                { type: 'cookie', name: '_pk_*', duration: '13mo', purpose: 'Matomo.' },
                { type: 'cookie', name: 'VISITOR_ID', duration: '1y', purpose: 'Un identifiant tiré au hasard.' }
            ]
        },
        location: {
            label: 'Votre position',
            description: 'Pour indiquer la boutique la plus proche.',
            storage: [
                { type: 'session', name: 'position', purpose: 'Votre position, le temps de la visite.' }
            ]
        }
    },

    countdown: { duration: '10s', action: 'default' },   // the site's choice; none by default

    texts: {
        label: 'Les cookies',
        text: { html: 'Le site ne garde que ce qui le fait marcher. <a href="/confidentialite">Confidentialité</a>.' },
        countdown: 'Sans réponse de votre part, ce choix est retenu dans {count} s.',
        accept: 'D\'accord',
        refuse: 'Refuser',
        customize: 'Personnaliser',
        detailsTitle: 'Vos choix',
        acceptAll: 'Tout accepter',
        refuseAll: 'Tout refuser',
        save: 'Enregistrer mes choix',
        close: 'Fermer',
        required: 'Toujours actif'
    }
});

// A measure of audience: started on a yes, stopped on a withdrawal.
Cookie.use('analytics', function () { startMatomo(); }, function () { stopMatomo(); });

// The time zone, remembered only under "preferences".
Cookie.use('preferences', function () {
    Cookie.cookies.set('USER/TIMEZONE', Intl.DateTimeFormat().resolvedOptions().timeZone);
});

// The position, read only under "location".
Cookie.use('location', function () {
    navigator.geolocation.getCurrentPosition(function (position) {
        Cookie.session.set('position', { lat: position.coords.latitude, lng: position.coords.longitude });
        showNearestShop(position);
    });
}, function () { hideNearestShop(); });
```

```html
<!-- An analysis script that waits for "analytics" -->
<script type="text/plain" data-cookie-category="analytics" data-src="https://stats.example.org/matomo.js"></script>

<!-- A map that waits for "location", and what is shown meanwhile -->
<template data-cookie-category="location"><div id="map"></div></template>
<p data-cookie-placeholder="location">La carte s'affiche une fois votre position autorisée.
    <button type="button" data-cookie-open>Cookies</button></p>

<!-- The footer's link: the detailed section, at any time -->
<a href="#" data-cookie-open>Cookies</a>
```

The same configuration can be handed by the page instead of a script - what a
server that translates its texts does:

```html
<script type="application/json" data-cookie-config>{"version": "2026-10", "categories": {...}, "texts": {...}}</script>
```

It is read when the page is loaded (and after every page the navigation swaps
in), as `Cookie.ready()` would be called with it. The block is looked for
under `data-cookie-config` whatever the site's `prefix` - a page can announce
its prefix there -, under the site's prefix (`data-consent-config`), and where
the `config` option says (a selector: `config: 'script[data-settings]'`).

## Categories

`categories` in the configuration (an object by key, or a list of
`{key: ...}`), or `Cookie.category(key, definition)` at any time.

| Field | Default | Meaning |
| --- | --- | --- |
| `key` | | the category's name: in the answer kept, in `Cookie.use()`, in `data-cookie-category`. Not case-sensitive |
| `label`, `description` | the key, nothing | the site's words, shown in the detailed section |
| `default` | `false` | its state before any answer: `true` is on until refused, `false` waits for a yes |
| `required` | `false` | cannot be refused: always granted, its switch locked on |
| `storage` | `[]` | what it stores, see below |
| `features` | `[]` | names (or `{name, label}`) of what it governs besides storage, for the detailed section; `Cookie.use()` with a `feature` adds to it |
| `onDemand` | `false` | known (its words are ready) but listed only once something uses it - `Cookie.use()`, an inert element - and never a reason by itself to ask the visitor again |

```js
Cookie.category('chat', { label: 'La messagerie', storage: [{ type: 'cookie', name: 'crisp-client*' }] });
Cookie.category('chat');     // {key, label, description, default, required, onDemand, storage, features, state, granted}
Cookie.categories();         // every category listed, in order
Cookie.state('chat');        // true | false | null (no answer)
Cookie.granted('chat');      // what a script should do now: the answer, else the default
```

## What is stored

Each entry: `{type, name, category, duration, durationLabel, purpose, path,
domain}` - under a
category's `storage`, in the configuration's `storage` list (with its
`category`), or by `Cookie.storage(entry)`.

| Field | Meaning |
| --- | --- |
| `type` | `cookie` (default), `local` (`localStorage`) or `session` (`sessionStorage`) |
| `name` | the name, or a pattern with `*` (`_pk_*`, `USER/*`); a `RegExp` in a script |
| `duration` | how long it is kept: seconds, or `"30d"`, `"12h"`, `"13mo"`, `"1y"`, `"session"`. The lifetime of a cookie written through the library; shown in the detailed section, in the site's words when it has some (below) |
| `durationLabel` | the site's words for that duration, shown in its place |
| `label` | the site's words for the name, shown in its place |
| `purpose` | the site's words for what it is for |
| `path`, `domain` | of the cookie, when it is not the site's default (needed to erase a third party's) |

The duration is the cookie's; what the visitor reads of it is the site's.
An entry's `durationLabel` first, else the `durations` option, else the
duration as declared (`30d`):

```js
durations: { '30d': '30 jours', '13mo': '13 mois', session: 'Le temps de la visite' }     // by duration as declared
durations: function (duration, entry, seconds) { return seconds ? Math.round(seconds / 86400) + ' jours' : null; }
```

A function that returns nothing leaves the duration as declared. The element
keeps it in its attribute (`data-cookie-entry-duration="30d"`).

Reading and writing through the library goes by the declaration:

```js
Cookie.cookies.set('VISITOR_ID', id);          // written for a year, if "analytics" is granted
Cookie.cookies.get('VISITOR_ID');              // null while it is not
Cookie.cookies.remove('VISITOR_ID');
Cookie.local.set('theme', 'dark');   Cookie.local.get('theme');   Cookie.local.remove('theme');
Cookie.session.set('position', {lat: 48.58, lng: 7.75});          // an object is kept as JSON
```

- Under a category that is not granted, `set` writes nothing and returns
  `false`, `get` returns `null`; with `debug: true` the console says which
  entry and which category.
- An entry that was not declared is refused the same way (`undeclared: 'deny'`,
  the default); `undeclared: 'allow'` lets it through.
- When a category is refused or withdrawn, everything it declares is erased:
  the cookies matching its names (on the declared path and domain, on `/`, and
  on the host's parent domains), the `localStorage` and `sessionStorage`
  entries.

| Method | Returns | Effect |
|---|---|---|
| `Cookie.cookies.get(name)` | the value (URI-decoded), or `null` | `null` too when the cookie is absent, undeclared (with `undeclared: 'deny'`) or its category not granted |
| `Cookie.cookies.set(name, value, options)` | `true`, or `false` when refused | writes `name=value` (`encodeURIComponent`; an object as JSON). `options`: `path`, `domain`, `sameSite`, `secure`, `duration` - each, when not given, from the entry's declaration, else from the `cookie` option; the lifetime from the duration (`max-age` and `expires`), none for `session` or no duration |
| `Cookie.cookies.remove(name, options)` | `true` | erases the cookie whatever the answer, on `options.path` / `options.domain`, else the declared ones, on `/`, on the page's path, on the host and its parent domains |
| `Cookie.local.get(name)`, `Cookie.session.get(name)` | the string kept, or `null` | an object written as JSON comes back as its JSON text: `JSON.parse()` it |
| `Cookie.local.set(name, value)`, `Cookie.session.set(name, value)` | `true`, or `false` | `false` too when the storage is closed (a private window) or full |
| `Cookie.local.remove(name)`, `Cookie.session.remove(name)` | `true` | removes the entry whatever the answer |

`Cookie.storage(entry | list)` declares at any time (returns `Cookie`); an entry is the same as
an earlier one when its type, name and category are, and is then completed. A name declared
twice under two categories answers to the first declared.

The durations (`duration`, `record.lifetime`, `countdown`) are read by `Cookie.seconds(value)`,
in seconds:

| Written | Seconds |
|---|---|
| a number | as it is (`10` is 10 s) |
| `"45min"`, `"45m"` | minutes |
| `"12h"`, `"30d"`, `"2w"` | hours, days, weeks |
| `"13mo"` | months of 30 days |
| `"1y"` | years of 365 days |
| `"10s"`, `"250ms"`, `"1.5"` | through the core's `Flow.parseDuration`: seconds |
| `"session"`, `""`, `null`, `false`, anything unreadable | `null`: no lifetime (a cookie for the session; no countdown) |

A script that writes with `document.cookie` or `localStorage` itself is not
stopped by the library: have it wait for its category with `Cookie.use()`.

## Features

```js
var on = Cookie.use(category, [options], onGrant, onRevoke);
```

`onGrant` runs now if the category is granted, and each time it becomes so;
`onRevoke` each time it is withdrawn. Returns whether it is granted now. A
category that is not known yet is declared from `options` (`label`,
`description`, `default`, `required`, `storage`) as an on-demand one - the
shape of omnibase/consent's `Consent.use(name, options, onEnable, onDisable)`,
whose `implicit` (for `default`) and `erase` (name prefixes of cookies) are
understood too. `options.feature` (a name, or `{name, label}`) adds the
feature to the category's list, in the detailed section.
`Cookie.unuse(category, onGrant, onRevoke)` takes them back.

The order of the scripts does not matter: a feature registered before its
category is declared follows the declaration when it comes - `onGrant` runs
(and `cookie:grant` is sent) if the category is declared on until refused or
required, `onRevoke` if it was on and is declared off.

Elements of the page wait for a category too, inert until it is granted:

| Markup | At the grant | At the withdrawal |
| --- | --- | --- |
| `<script type="text/plain" data-cookie-category="k" [data-src] [data-type]>` | replaced by a script that runs (once) | nothing: a script that ran cannot be taken back - stop it in `onRevoke`, or reload |
| `<template data-cookie-category="k">` | its content is put in the page, before it | that content is removed |
| `<iframe data-cookie-category="k" data-cookie-src="...">` (any element with a `src`) | `src` is set | `src` is removed |
| `<... data-cookie-placeholder="k">` | hidden | shown |

They are looked for when the page is loaded, after every page the navigation
swaps in, at each answer, by `Cookie.scan(root)`, and continuously with
`observe: true` (a `MutationObserver`, for pages built by scripts).

An element woken gets `data-cookie-active` (a woken element is not woken twice). A script is
replaced by a new `<script>` that takes every attribute of the inert one but `type`, `data-src`
and `data-type`, its `type` from `data-type` (none: a classic script), its `src` from
`data-src`, and its inline text. A `<template>` puts a copy of its content just before itself,
and takes those nodes away at the withdrawal. Any other element gets `src` from its
`data-cookie-src` (and loses it at the withdrawal). A placeholder whose category is not declared
stays shown. A `data-cookie-category` naming a category the site has not declared declares it,
on demand: listed in the detailed section from then on, never a reason to ask.

```html
<script type="text/plain" data-cookie-category="analytics" data-type="module">
    import { start } from '/js/stats.js'; start();
</script>
<iframe data-cookie-category="videos" data-cookie-src="https://www.youtube-nocookie.com/embed/xyz" title="The video"></iframe>
<p data-cookie-placeholder="videos">The video shows once "videos" is allowed. <button type="button" data-cookie-open>Choose</button></p>
```

## Events

On `window`:

| Event | When | `detail` |
| --- | --- | --- |
| `cookie:consent` | an answer was given or changed | `{categories: {key: bool}, granted: [keys], revoked: [keys], source, pending}` - `source`: `accept`, `refuse`, `save`, `countdown`, `dismiss`, `signal` or `api` |
| `cookie:grant`, `cookie:revoke` | one category went on, or off | `{category}` |
| `cookie:open`, `cookie:close` | the banner or the detailed section opened, closed | `{view}` - `banner` or `details` |
| `cookie:ready` | `Cookie.ready()` was called | as in `@glitchr/cookie` |
| `cookie:confirm`, `cookie:deny`, `cookie:check` | `Cookie.refresh()`, as in `@glitchr/cookie` | |

`Cookie.onConsent(fn)` listens to the first.

Every event is dispatched on `window`, does not bubble and cannot be cancelled. In detail:

| Event | Dispatched | `detail` |
|---|---|---|
| `cookie:consent` | after every kept answer (a button, `Cookie.save()`, `accept()`, `refuse()`, `grant()`, `revoke()`, `setConsent()` on a category, the countdown, a click outside, a signal) and after `Cookie.forget()`; after the features and the inert elements were told | `categories`: every declared category by key, `true` when granted now; `granted`, `revoked`: the keys that changed; `source`; `pending`: whether an answer is still wanted |
| `cookie:grant`, `cookie:revoke` | for each category whose state changed, after its `onGrant` or `onRevoke` functions ran; also when a declaration changes the state of a category a feature waits for | `{category}`: its key, as declared |
| `cookie:open` | the banner or the detailed section shows, or one replaces the other | `{view}`: `banner` or `details` |
| `cookie:close` | it is closed, or the detailed section is left for the question | `{view}`: the view that closed |
| `cookie:ready` | at each `Cookie.ready()` | none (a plain `Event`) |
| `cookie:confirm` / `cookie:deny` | at each `Cookie.ready()` and after each answer (`Cookie.refresh()`): `confirm` when at least one group (every declared category is one) is not refused - granted, or without an answer -, `deny` when every one is refused or there is none | none |
| `cookie:check` | only for `Cookie.refresh(null)` with no consent counted | none |

`Cookie.onConsent(fn)` calls `fn(detail, event)`; `Cookie.onConfirm(fn)`, `onDeny(fn)` and
`onCheck(fn)` add `fn` as a listener of their event. Each returns `Cookie`.

```js
window.addEventListener('cookie:revoke', function (event) {
    if (event.detail.category === 'analytics') window._paq = [];
});
Cookie.onConsent(function (detail) {
    navigator.sendBeacon('/consent-log', JSON.stringify({ categories: detail.categories, source: detail.source }));
});
```

## The interface

A **banner** - the question, accept, refuse, and "customize" - and a
**detailed section** - one row per category with its switch, accept all,
refuse all, save. The banner shows by itself while an answer is wanted
(`Cookie.pending()`); anything with `data-cookie-open` opens the detailed
section at any time (`data-cookie-open="banner"` the banner).

The HTML is the site's, or the library's minimal one:

- an element with `data-cookie-banner` in the page is used as it is (a
  `<template data-cookie-banner>` is cloned into the page);
- or `template`: a selector, an element, HTML, or a function returning one;
- else a bare default is built - a `<div>` with the parts below whose words
  `texts` has (a button without its word is not made), the classes of
  `classes`, and no style. Its texts: `label` (the dialog's name), `title`,
  `text`, `countdown` (with `{count}` where the seconds go), `accept`,
  `refuse`, `customize`, `detailsTitle`, `detailsText`, `acceptAll`,
  `refuseAll` (else `accept` and `refuse`), `save`, `close`, `required`.

The bare default is for a site that has no banner of its own (`bare:
'auto'`). Once the site has shown one - found in a page, or named by `root`
or `template` - a page where it put none gets none: nothing is built there,
the question (and its countdown) waits for the next page that has a banner.
`bare: true` builds the default on such a page, `bare: false` never builds it.

### Several places in a page

A page may have several places for the banner - a footer, a bar that folds
away on a phone, a corner -, each with its `data-cookie-banner`. One is the
live banner; the others stay hidden.

- By itself, the library takes the first whose parent the visitor can see
  (not `display: none`, `visibility: hidden`, transparent or under `hidden`),
  else the first of the page. A banner left where it cannot be seen opens, the
  next time, in a place that can.
- `root` names it: an element, a selector, or a function returning one,
  asked again at each opening - the live banner then goes where it says.
- `Cookie.mount(target)` puts the live banner there, as it is (its view, its
  switches, its countdown, the focus): in the place of another
  `[data-cookie-banner]`, which takes the place it leaves and stays hidden;
  before a `<template data-cookie-banner>`; or at the end of any other
  element. Called before there is a banner, with a `[data-cookie-banner]`, it
  names the one that becomes it. It returns the banner (`null` when there is
  none); a place the site chose this way is kept, seen or not.

```js
Cookie.mount('#footer [data-cookie-banner]');     // the panel now sits in the footer
button.addEventListener('click', function () { Cookie.mount(button.parentNode); Cookie.open(); });
```

The parts are found by attribute, wherever they are in the banner:

| Attribute | Part |
| --- | --- |
| `data-cookie-banner` | the root; gets `data-cookie-position`, the state classes and the `variables` |
| `data-cookie-summary` | the question; hidden while the detailed section is open |
| `data-cookie-text="key"` | filled with `texts[key]` when the configuration has it (left as written otherwise) |
| `data-cookie-accept`, `data-cookie-refuse` | every category on / off (but the required ones) |
| `data-cookie-customize` | opens the detailed section |
| `data-cookie-details` | the detailed section (a modal dialog) |
| `data-cookie-categories` | where the rows go |
| `<template data-cookie-row>` | the site's row, cloned per category; else a default row |
| `data-cookie-toggle`, `data-cookie-label`, `data-cookie-description`, `data-cookie-required`, `data-cookie-entries`, `data-cookie-features` | in a row: the checkbox (`role="switch"`), the words, the mark of a required category (`texts.required`), the lists of what it stores (an item per entry, `data-cookie-entry="cookie"` with its `-name`, `-duration` - in the site's words, the duration declared in the attribute - and `-purpose`) and governs |
| `data-cookie-save` | keeps the switches as set |
| `data-cookie-close` | closes without answering |
| `data-cookie-countdown`, `data-cookie-count` | the countdown's sentence (shown only while it counts) and the seconds left |

The prefix is an option (`prefix: 'data-consent'`), and each name too
(`hooks: {category: 'data-consent-script'}`).

Every attribute the module reads or sets, by its `hooks` name (the attribute is `hooks[name]`
when given, else `prefix` + `-` + the name):

| Hook | Attribute (default prefix) | Read or set |
|---|---|---|
| `banner` | `data-cookie-banner` | read: the banner's places; set on the banner the library uses or builds |
| `summary` | `data-cookie-summary` | read: the question (without one, the banner itself is the question) |
| `text` | `data-cookie-text="key"` | read: filled with `texts[key]` |
| `accept`, `refuse`, `customize`, `save`, `close` | `data-cookie-accept`, ... | read: the buttons, by a click anywhere inside them |
| `details` | `data-cookie-details` | read: the detailed section - in the banner, else anywhere in the page |
| `categories` | `data-cookie-categories` | read: the list the rows go in (without one, no rows are made) |
| `row` | `data-cookie-row` | read on a `<template>`: the site's row; set to the category's key on each row |
| `toggle` | `data-cookie-toggle` | read in a row: its checkbox; set to the category's key |
| `label`, `description`, `required`, `entries`, `features` | `data-cookie-label`, ... | read in a row: where the words, the description, the required mark and the two lists go |
| `entry` | `data-cookie-entry="cookie"` | set on each item of the entries' list: the entry's type (`cookie`, `local`, `session`) |
| `entry-name`, `entry-duration`, `entry-purpose` | `data-cookie-entry-name`, ... | set on the spans of an item; `data-cookie-entry-duration` holds the duration as declared |
| `countdown`, `count` | `data-cookie-countdown`, `data-cookie-count` | read: the countdown's sentence and where the seconds go (made from `texts.countdown` when the sentence has no `count` inside) |
| `open` | `data-cookie-open`, `data-cookie-open="banner"` | read: anything that opens the panel (its default action is prevented) |
| `position` | `data-cookie-position` | set on the banner from the `position` option |
| `category` | `data-cookie-category="key"` | read: an inert element (see [Features](#features)) |
| `placeholder` | `data-cookie-placeholder="key"` | read: shown while the category is not granted |
| `src` | `data-cookie-src` | read: the `src` an element gets at the grant |
| `active` | `data-cookie-active` | set on an inert element once woken |
| `config` | `data-cookie-config` | read: a page's configuration block (`data-cookie-config` is looked for whatever the prefix) |

The module also sets, for screen readers: `role="dialog"`, `aria-live="polite"` and
`aria-label` (`texts.label`) on the question, unless they are there; on the detailed section
`role="dialog"`, `aria-modal="true"`, `tabindex="-1"` and `aria-label` (`texts.detailsLabel`,
else `texts.detailsTitle`, else `texts.label`); `aria-expanded` on the `customize` buttons; on
each switch `role="switch"`, `aria-describedby` (the description, given an `id` made from the
prefix) and `disabled` for a required category. The banner and its parts are shown and hidden
with the `hidden` attribute.

### Classes

`classes` gives the class of each part of the bare banner, and of each state on the banner the
library uses, whoever wrote it. Given in part, it is merged with the defaults. A state class set
to an empty value is not set.

| Key | Default | On |
|---|---|---|
| `root` | `cookie-banner` | the banner (added to the site's banner too) |
| `summary`, `title`, `text` | `cookie-summary`, `cookie-title`, `cookie-text` | the bare banner's question, its title and its text (also the detailed section's title and text) |
| `countdown`, `count` | `cookie-countdown`, `cookie-count` | the countdown's sentence; the span of the seconds (made in the site's banner too) |
| `actions`, `button` | `cookie-actions`, `cookie-button` | the bare banner's rows of buttons; every button |
| `accept`, `refuse`, `customize`, `save`, `close` | `cookie-accept`, ... | each button of the bare banner, beside `button` |
| `details`, `list` | `cookie-details`, `cookie-categories` | the bare detailed section; its list |
| `row`, `label`, `toggle`, `required`, `description`, `entries`, `entry`, `features` | `cookie-category`, `cookie-label`, `cookie-toggle`, `cookie-required`, `cookie-description`, `cookie-entries`, `cookie-entry`, `cookie-features` | the parts of the default row (`entry` on each item of the entries, in any row) |
| `open` | `is-open` | the banner while it shows (and a detailed section kept outside it while it shows) |
| `pending` | `is-pending` | the banner while an answer is wanted |
| `customizing` | `is-customizing` | the banner while the detailed section shows |
| `counting` | `is-counting` | the banner while the countdown runs |
| `tick` | `is-tick` | the seconds' span, set again at each new second (for a pulse); never under `prefers-reduced-motion` |
| `reduced` | `is-reduced` | the banner, when the visitor asks for less motion (read when the banner is made) |

### Texts

`texts` holds every word; a value is a string (written as text) or `{html: '...'}` (written as
HTML). A missing or empty text leaves the site's own words where they are; in the bare banner, a
part without its text is not made.

| Key | Where |
|---|---|
| `label` | the question's `aria-label` (and the detailed section's, failing the two below) |
| `title`, `text` | the bare banner's title and paragraph; any `data-cookie-text="title"` / `"text"` |
| `countdown` | the countdown's sentence, `{count}` where the seconds go |
| `accept`, `refuse`, `customize` | the question's buttons |
| `detailsTitle`, `detailsText` | the detailed section's title and paragraph |
| `detailsLabel` | the detailed section's `aria-label` (else `detailsTitle`, else `label`) |
| `acceptAll`, `refuseAll` | the detailed section's buttons (else `accept`, `refuse`) |
| `save`, `close` | the detailed section's buttons |
| `required` | the mark of a required category, in its row |

Any other key is written where a `data-cookie-text` names it. Configured again after the banner
was made (another language), `texts`, `classes`, `hooks`, `prefix`, `position` or `variables`
make the bare banner again, and refill the site's.

The bare banner, as headless Chrome printed it one second into a 10 s countdown, for two
categories (`necessary`, required, with `PHPSESSID`; `analytics`, with `_pk_*` for `13mo` and
`durations: {'13mo': '13 mois'}`) and the texts `label`, `text`, `countdown`, `accept`, `refuse`,
`customize`, `detailsTitle`, `save`, `close`, `required` (no `title`, `detailsText`,
`acceptAll`, `refuseAll`: those parts are not made):

```html
<div data-cookie-banner="" class="cookie-banner is-pending is-open is-counting">
  <div data-cookie-summary="" class="cookie-summary" role="dialog" aria-label="Les cookies" aria-live="polite">
    <p data-cookie-text="text" class="cookie-text">Le site ne garde que ce qui le fait marcher.</p>
    <p data-cookie-countdown="" class="cookie-countdown">Sans réponse, ce choix est retenu dans <span data-cookie-count="" class="cookie-count is-tick">9</span> s.</p>
    <div class="cookie-actions">
      <button data-cookie-accept="" class="cookie-button cookie-accept" data-cookie-text="accept" type="button">D'accord</button>
      <button data-cookie-refuse="" class="cookie-button cookie-refuse" data-cookie-text="refuse" type="button">Refuser</button>
      <button data-cookie-customize="" class="cookie-button cookie-customize" data-cookie-text="customize" type="button" aria-expanded="false">Personnaliser</button>
    </div>
  </div>
  <div data-cookie-details="" class="cookie-details" hidden="" role="dialog" aria-label="Vos choix" aria-modal="true" tabindex="-1">
    <p data-cookie-text="detailsTitle" class="cookie-title">Vos choix</p>
    <ul data-cookie-categories="" class="cookie-categories">
      <li class="cookie-category" data-cookie-row="necessary">
        <label class="cookie-label">
          <input data-cookie-toggle="necessary" class="cookie-toggle" type="checkbox" role="switch" disabled="">
          <span data-cookie-label="">Le fonctionnement du site</span>
        </label>
        <span data-cookie-required="" class="cookie-required">Toujours actif</span>
        <p data-cookie-description="" class="cookie-description" hidden="" id="data-cookie-description-1"></p>
        <ul data-cookie-entries="" class="cookie-entries">
          <li data-cookie-entry="cookie" class="cookie-entry">
            <span data-cookie-entry-name="">PHPSESSID</span>
            <span data-cookie-entry-duration="session">session</span>
            <span data-cookie-entry-purpose="">Votre session.</span>
          </li>
        </ul>
        <ul data-cookie-features="" class="cookie-features" hidden=""></ul>
      </li>
      <li class="cookie-category" data-cookie-row="analytics">
        <label class="cookie-label">
          <input data-cookie-toggle="analytics" class="cookie-toggle" type="checkbox" role="switch" aria-describedby="data-cookie-description-2">
          <span data-cookie-label="">La mesure d'audience</span>
        </label>
        <span data-cookie-required="" class="cookie-required" hidden="">Toujours actif</span>
        <p data-cookie-description="" class="cookie-description" id="data-cookie-description-2">Un identifiant anonyme.</p>
        <ul data-cookie-entries="" class="cookie-entries">
          <li data-cookie-entry="cookie" class="cookie-entry">
            <span data-cookie-entry-name="">_pk_*</span>
            <span data-cookie-entry-duration="13mo">13 mois</span>
            <span data-cookie-entry-purpose="">Matomo.</span>
          </li>
        </ul>
        <ul data-cookie-features="" class="cookie-features" hidden=""></ul>
      </li>
    </ul>
    <div class="cookie-actions">
      <button data-cookie-accept="" class="cookie-button cookie-accept" data-cookie-text="accept" type="button">D'accord</button>
      <button data-cookie-refuse="" class="cookie-button cookie-refuse" data-cookie-text="refuse" type="button">Refuser</button>
      <button data-cookie-save="" class="cookie-button cookie-save" data-cookie-text="save" type="button">Enregistrer</button>
      <button data-cookie-close="" class="cookie-button cookie-close" data-cookie-text="close" type="button">Fermer</button>
    </div>
  </div>
</div>
```

(Indented here for reading; the module writes no whitespace between the elements.)

A default row: `li.cookie-category[data-cookie-row]` holding a `label` (an
`input[type=checkbox][data-cookie-toggle]` and a `span[data-cookie-label]`), a
`span[data-cookie-required]`, a `p[data-cookie-description]`, a `ul[data-cookie-entries]` and a
`ul[data-cookie-features]`; empty parts are `hidden`.

### The stylesheet

`src/css/cookie.scss` is an optional, minimal stylesheet (where the banner
sits for each `position`, the switches) drawn from `--cookie-*` properties;
it is not imported by any entry.

Its selectors are the default attributes (`[data-cookie-banner]`, ...): a site with another
`prefix` writes its own. The banner is `position: fixed`, in the bottom right corner by default;
`data-cookie-position` moves it: a word starting with `top` to the top, ending with `left` to the
left, ending with `center` (and `top`, `bottom`) centred across, `center` in the middle of the
screen. Everything `hidden` inside it is `display: none`; nothing moves under
`prefers-reduced-motion` or `.is-reduced`.

| Property | Default | |
|---|---|---|
| `--cookie-z-index` | `1000` | |
| `--cookie-gap` | `1rem` | the distance to the screen's edges |
| `--cookie-width` | `24rem` | at most the screen's width less two gaps |
| `--cookie-padding` | `1rem` | |
| `--cookie-ink`, `--cookie-bg` | `inherit`, `Canvas` | the text and the ground |
| `--cookie-border`, `--cookie-radius`, `--cookie-shadow` | `1px solid currentColor`, `0`, `none` | |
| `--cookie-font` | `inherit` | the `font` shorthand |
| `--cookie-transition` | `opacity .2s` | |
| `--cookie-row-gap` | `.75rem` | between two categories |
| `--cookie-accent` | `auto` | the switches' `accent-color` |
| `--cookie-small` | `.85em` | the lists of entries and features |
| `--cookie-separator` | `" - "` | between the name, the duration and the purpose of an entry |

The `variables` option sets such properties on the banner itself.

### Where it floats

The position, by order of precedence (1.6):

1. while the button `follow` names floats (its `position` is `fixed`), next to it - see below;
2. the `position` option, or `Cookie.defaults.position` set once for every banner of the site;
3. the banner's own `data-cookie-position`, as written in the site's HTML;
4. none: the stylesheet's corner, bottom right - what every site had before 1.6, so a site that
   names nothing sees no change.

```js
Cookie.defaults.position = 'top-right';               // the site's default, before Cookie.ready()
Cookie.ready({ position: 'bottom-center', gutter: 24 });   // or for this configuration
```

```html
<div data-cookie-banner data-cookie-position="bottom-left">…</div>   <!-- or on the element -->
```

The six corners and edges are `bottom-left`, `bottom-center`, `bottom-right`, `top-left`,
`top-center` and `top-right`; `center` is the middle of the screen. `gutter` is the room kept from
the screen's edges (`--cookie-gap`).

**Following the cookie button.** A site whose cookie button floats in a corner (as omnibase/consent's
circle does) names it in `follow`. While it floats (it, or an element around it, is `position: fixed`), the banner opens in the corner the button is in -
left, centre or right by thirds of the width, top or bottom by halves of the height - just past the
button and aligned with it: `data-cookie-position` says the corner, `data-cookie-following` is set,
and `--cookie-follow-block` (the distance from the top or bottom edge, past the button) and
`--cookie-follow-inline` (from the left or right edge) hold the distances, measured at each opening and
when the window is resized; css/cookie.scss uses them. A button in the flow of the page (not fixed) is
not followed: the position above applies.

```js
Cookie.ready({ follow: '.cookie-button', position: 'bottom-left' });
```

A site with another `prefix` gets the same attributes under it (`data-consent-position`,
`data-consent-following`): omnibase/consent, which passes its `consent.position`, is written exactly
as before.

### The countdown

None by default: under the GDPR a silence is not a consent. A site that wants
one says so:

```js
countdown: { duration: '10s', action: 'default' }     // or countdown: '10s' - the action is then "default"
```

| `action` | When the time is up |
| --- | --- |
| `default` | each category takes its `default` (what omnibase/consent does today: the site's own on, the rest off) |
| `accept` | every category on |
| `refuse` | every category off, but the required ones |
| `none` | nothing: the countdown ends, the banner stays and waits |

It runs only while the question can be read: it waits while the page is
hidden (another tab), while the banner is not on screen (a parent folded
away, `display: none`, `hidden`, `visibility: hidden`, transparent) and on a
page that shows no banner. It goes on across the pages the navigation swaps
in, and stops for good once the visitor opens the detailed section or
answers. `countdown: false`, `0` or
nothing: no countdown. `dismiss` gives a click outside the banner the same
choice of four (`none` by default).

A click on what is not the page's - a developer's toolbar, an overlay a
browser extension puts in the page - is no click outside: `ignore` names
those elements (`[data-cookie-ignore]` by default; a selector, an element, or
a list of them), and a click inside one neither answers by `dismiss` nor
counts as leaving the question. `Cookie.ignored(element)` says whether an
element is one of them, for a site's own script that closes something on a
click elsewhere.

```js
ignore: ['[data-cookie-ignore]', '.sf-toolbar', '[id^="sfwdt"]']   // the Symfony debug toolbar too
```

A category covered by a privacy signal the site honours is never turned on by
a countdown or a click outside.

### Asking again

The visitor is asked again when `version` is not the one they answered, when
a category that is not on demand has no answer (a new one), or when the answer
is older than `record.lifetime`. With a new version or an expired answer, the
old answers no longer count: the categories are back to their `default` -
with `legacy` too: the `localStorage` `cookie/<KEY>` the library keeps in
step are erased with the answer they copied, never read to bring it back.
`Cookie.forget()` erases the answer. A banner the visitor closed without
answering (`data-cookie-close`, `Cookie.close()`) is not put again at each page
the navigation swaps in: it comes back at the next page loaded, or when there
is something new to ask.

### Privacy signals

```js
signals: { gpc: true, dnt: false }      // or a list of categories: {gpc: ['analytics', 'ads']}
```

Off by default. When the site asks for it and the browser sends the signal
(`navigator.globalPrivacyControl`, `navigator.doNotTrack`), the categories it
covers (`true`: every one that is not required) are off without asking; if
that leaves nothing to ask, the banner does not show and the refusal is kept
(`source: 'signal'`). The visitor can still open the detailed section and
decide otherwise: an explicit choice wins.

### Accessibility

The banner is a labelled dialog, announced politely when it shows, and does
not take the focus. The detailed section is a modal dialog: the focus goes
into it, <kbd>Tab</kbd> stays inside, <kbd>Escape</kbd> closes it, and the
focus goes back to what opened it. A switch is a checkbox with
`role="switch"`, operated with <kbd>Space</kbd>, described by its
category's description. With `prefers-reduced-motion`, the count does not
pulse (`classes.tick` is not set) and the root has `classes.reduced`.

## Options (`Cookie.defaults`)

| Option | Default | Meaning |
| --- | --- | --- |
| `debug` | `false` | the console says what is declared, refused, erased |
| `version` | `null` | of the categories; a change asks again |
| `categories` | `{}` | see [Categories](#categories) |
| `storage` | `[]` | entries with their `category`, see [What is stored](#what-is-stored) |
| `undeclared` | `'deny'` | an entry read or written through the library without a declaration: `deny` or `allow` |
| `record` | `{store: 'cookie', name: 'cookie-consent', lifetime: '180d'}` | where the answer is kept, and for how long. `store`: `cookie`, `local`, or `{read(), write(text), clear()}`. A cookie also takes `path`, `domain`, `sameSite`, `secure`, by default those of `cookie` |
| `cookie` | `{path: '/', domain: null, sameSite: 'Lax', secure: 'auto'}` | the attributes of every cookie the library writes; `secure: 'auto'` is `Secure` on https |
| `legacy` | `true` | keep `localStorage` `cookie/<KEY>` in step, as `@glitchr/cookie` kept its consents, and take the answers found there for a visitor the library has no record of yet - a migration, once: `localStorage` `<record.name>.seen` says this browser has had a record, and from then on a record that is gone or no longer counts is a question to ask again |
| `countdown` | `false` | `{duration, action}`, see [The countdown](#the-countdown) |
| `dismiss` | `'none'` | what a click outside the banner answers: `none`, `default`, `accept`, `refuse` |
| `ignore` | `'[data-cookie-ignore]'` | the elements whose clicks are not on the page (a developer's toolbar): a selector, an element or a list; never a click outside. `false`: none |
| `signals` | `{gpc: false, dnt: false}` | see [Privacy signals](#privacy-signals) |
| `autoOpen` | `true` | show the banner by itself while an answer is wanted |
| `reopen` | `'details'` | what `data-cookie-open` and `Cookie.open()` show once answered: `details` or `banner` |
| `position` | `null` | where the banner floats, written in `data-cookie-position`: `bottom-left`, `bottom-center`, `bottom-right`, `top-left`, `top-center`, `top-right`, `center` (or any word of the site's stylesheet); `null` keeps the banner's own attribute, else the stylesheet's corner (bottom right) - see [Where it floats](#where-it-floats) |
| `gutter` | `null` | its distance to the screen's edges: px (a number) or a length, written as `--cookie-gap` on the banner; `null` leaves the stylesheet's (`1rem`) |
| `follow` | `null` | the cookie button the banner opens next to while that button floats (`position: fixed`, itself or an element around it): an element, a selector, or a function returning one |
| `container` | `null` | where a banner the library builds is put (a selector or an element); the end of `<body>` |
| `template` | `null` | the banner's HTML: a selector, an element, a string of HTML, a function |
| `root` | `null` | which element of the page is the banner, when it has several places for it: an element, a selector, a function (asked again at each opening). See [Several places in a page](#several-places-in-a-page) |
| `bare` | `'auto'` | the bare default banner: `'auto'` for a site that has no banner of its own, `true` wherever a page has none, `false` never |
| `config` | `null` | a selector of the page's configuration blocks, besides `data-cookie-config` and the prefix's own |
| `prefix` | `'data-cookie'` | the prefix of every attribute above |
| `hooks` | `{}` | an attribute's full name, by part: `{open: 'data-consent-open'}` |
| `classes` | see the code | the class of each part of the default banner and of each state: `root`, `summary`, `text`, `actions`, `button`, `details`, `list`, `row`, `open`, `pending`, `customizing`, `counting`, `tick`, `reduced`... |
| `variables` | `{}` | CSS custom properties set on the banner: `{'--cookie-accent': '#24447c'}` |
| `texts` | `{}` | every word: a string, or `{html: '...'}` |
| `durations` | `{}` | the site's words for the durations declared: `{'30d': '30 jours'}`, or a function `(duration, entry, seconds)` |
| `observe` | `false` | watch the page for inert elements added later |
| `groups` | `[]` | `@glitchr/cookie`'s list of groups (`Cookie.addGroup()`); every category's key, upper-cased, is added to it |

How the options add up: `Cookie.ready(options)` and `Cookie.configure(options)` may be called
any number of times. `record`, `cookie`, `signals`, `hooks`, `classes`, `variables`, `texts` and
`durations` are merged key by key with what was given before (and with the defaults when read);
any other option replaces the one before. `categories` and `storage` are not kept as options:
each call declares them, adding to what is declared. An option set to `undefined` is ignored.
`Cookie.options` holds what was configured, `Cookie.defaults` the defaults.

Types: `version` any value (compared as a string); `undeclared` `'deny'` or `'allow'`; `legacy`,
`autoOpen`, `observe`, `debug` booleans; `dismiss` `'none'`, `'default'`, `'accept'` or
`'refuse'`; `reopen` `'details'` or `'banner'`; `bare` `'auto'`, `true` or `false`; `container`,
`root`, `template` an element, a selector, (`template`) a string of HTML starting with `<`, or a
function called with `Cookie` returning one; `config`, `prefix` strings; `hooks`, `classes`,
`variables`, `texts` objects; `durations` an object or a function.

### Nested options

`record`:

| Key | Type | Default | Effect |
|---|---|---|---|
| `store` | `'cookie'`, `'local'`, or `{read(), write(text), clear()}` | `'cookie'` | where the answer is kept: a cookie, `localStorage`, or the site's own store (`read()` returns the text written, or nothing) |
| `name` | string | `'cookie-consent'` | the cookie's or the `localStorage` key's name; also the stem of `<name>.seen` |
| `lifetime` | duration | `'180d'` | how long an answer counts; the record cookie's lifetime too. `null`: forever (the cookie for the session) |
| `path`, `domain`, `sameSite`, `secure` | as in `cookie` | those of `cookie` | the record cookie's attributes |

The record is JSON: `{"v": version, "t": seconds since 1970, "c": {"KEY": 1 or 0}, "s": source}`,
the keys upper-cased. A record that cannot be read as such is no record.

`cookie` (every cookie the library writes, the record's and those of `Cookie.cookies.set()`):

| Key | Type | Default | Effect |
|---|---|---|---|
| `path` | string | `'/'` | |
| `domain` | string or `null` | `null` | none: the host only |
| `sameSite` | `'Lax'`, `'Strict'`, `'None'` or empty | `'Lax'` | written as `SameSite=...` when not empty |
| `secure` | `true`, `false` or `'auto'` | `'auto'` | `Secure` always, never, or on https only |

`countdown`: `false`, `0` or `null` (none); a duration (`'10s'`, `10`) with the action
`default`; or `{duration, action}`, `action` one of `default` (when not given), `accept`,
`refuse`, `none`.

`signals`: `{gpc, dnt}`, each `false` (not honoured), `true` (covers every category that is not
required) or a list of category keys.

`hooks`: `{<hook>: '<attribute>'}` for any hook of the table in [The interface](#the-interface).

## Methods

```js
Cookie.ready(options)            // configure and start; may be called again, the options add up
Cookie.category(key[, def])      Cookie.categories()      Cookie.storage(entry | list)
Cookie.state(key)                Cookie.granted(key)      Cookie.pending()      Cookie.answered()
Cookie.accept()                  Cookie.refuse()          Cookie.save({key: bool})
Cookie.grant(key | keys)         Cookie.revoke(key | keys)                      Cookie.forget()
Cookie.use(category, [options], onGrant, onRevoke)        Cookie.unuse(category, onGrant)
Cookie.cookies / Cookie.local / Cookie.session            // .get(name) .set(name, value[, options]) .remove(name)
Cookie.open([view])              Cookie.close()           Cookie.banner()       Cookie.scan([root])
Cookie.mount(target)             // the live banner put there: another [data-cookie-banner]'s place, or any element
Cookie.onConsent(fn)             Cookie.signals()         Cookie.reduced()
Cookie.ignored(element)          // in an element the ignore option names: not a click on the page
Cookie.destroy()                 // as loaded: no category, no declaration, no banner (the answer kept stays)
```

| Method | Returns | Effect |
|---|---|---|
| `ready(options)` | `Cookie` | `configure(options)`, makes the banner again when its words or looks changed, dispatches `cookie:ready`, starts (signals, inert elements, the banner while an answer is wanted), `refresh()` |
| `configure(options)` | `Cookie` | the options added up, the categories and the storage declared; nothing is shown |
| `category(key, definition)` | the category's snapshot, or `null` (no key) | declares it, or adds to it (`label`, `description`, `default` - or omnibase/consent's `implicit` -, `required`, `onDemand`, `storage`, `features`, `erase`), then starts again when ready |
| `category(key)` | `{key, label, description, default, required, onDemand, storage, features, state, granted}` or `null` | a snapshot taken now: changing it declares nothing |
| `categories()` | snapshots | the listed categories, in the order declared (an on-demand one only once used) |
| `storage(entry \| list)` | `Cookie` | declares entries |
| `state(key)` | `true`, `false`, `null` | the answer that counts (`true` for a required category); `null` with none, or for a category not declared |
| `granted(key)` | boolean | the answer, else the default (off under an honoured signal); `false` for a category not declared |
| `pending()` | boolean | a category that is not required nor on demand has no answer that counts |
| `answered()` | boolean | a record of this version, younger than `record.lifetime` |
| `accept()`, `refuse()` | `Cookie` | every listed category on, or off but the required ones (`source: 'accept'`, `'refuse'`) |
| `save(map)` | `Cookie` | keeps `{key: bool}` (`source: 'api'`); without a map, the switches of the detailed section as set (`source: 'save'`) |
| `grant(keys)`, `revoke(keys)` | `Cookie` | those categories on or off (a key or a list; unknown keys are skipped); without keys, as `accept()` / `refuse()` but with `source: 'api'` |
| `forget()` | `Cookie` | erases the record (and `cookie/<KEY>` with `legacy`); every category is back to its default, and what a category now off declares is erased; tells what changed (`cookie:consent` with `source: 'api'`) and asks again |
| `use(key, options, onGrant, onRevoke)` | boolean: granted now | see [Features](#features); `options` may be left out |
| `unuse(key, onGrant, onRevoke)` | `Cookie` | takes those functions back |
| `scan(root)` | `Cookie` | wakes or puts to sleep the inert elements under `root` (the document by default) |
| `open(view, opener)` | `Cookie` | shows `banner` or `details` (the `reopen` option by default; `details` falls back to `banner` when the banner has no detailed section); `opener` gets the focus back at the closing. Nothing without a declared category |
| `close()` | `Cookie` | hides the banner; while an answer is wanted, it is not shown again by itself until the next page loaded |
| `banner()` | element or `null` | the live banner |
| `mount(target)` | element or `null` | see [Several places in a page](#several-places-in-a-page) |
| `onConsent(fn)` | `Cookie` | `fn(detail, event)` at each `cookie:consent` |
| `signals()` | `{gpc, dnt}` | what the browser sends, whatever the site honours |
| `reduced()` | boolean | `prefers-reduced-motion: reduce` |
| `ignored(element)` | boolean | inside an element the `ignore` option names |
| `seconds(value)` | number or `null` | a duration in seconds, see [What is stored](#what-is-stored) |
| `destroy()` | `Cookie` | stops the countdown and the observer, removes a banner the library put in the page (hides the site's), unbinds the clicks and keys, forgets every option, category, entry and feature; the record stays where it is kept |

`Cookie.cookies`, `Cookie.local` and `Cookie.session` are described in
[What is stored](#what-is-stored).

## From @glitchr/cookie

`package.json`: `"@glitchr/cookie"` gives way to `"@glitchr/flowjs"`; the import
`'@glitchr/cookie'` becomes `'@glitchr/flowjs/cookie'` (or nothing, with the
whole library). jQuery is no longer needed.

Everything 1.0.53 had is there, with the same meaning:

| | |
| --- | --- |
| `Cookie.ready(options)`, `Cookie.configure(options)`, `Cookie.options`, `getOption`, `setOption`, `addOption`, `removeOption` | as before; `ready()` without categories shows nothing |
| `Cookie.set(group, name, value, expires, reloadIfNotSet, path)` | writes the cookie `GROUP/NAME` (`SameSite=Strict; Secure`) unless the group is refused |
| `Cookie.get(group, name)`, `Cookie.delete(group, path)` | as before |
| `Cookie.checkConsent(group)`, `Cookie.setConsent(consent, group)`, `Cookie.hasConsents(group)`, `Cookie.getConsents()` | `localStorage` `cookie/<GROUP>`, as before |
| `Cookie.declare(group)`, `Cookie.addGroup(group)`, `Cookie.refresh()` | as before |
| `Cookie.onConfirm(fn)`, `Cookie.onDeny(fn)`, `Cookie.onCheck(fn)` | the events are native ones on `window` (`cookie:confirm`...); jQuery's `$(window).on()` hears them as before |
| `Cookie.reset(el)`, `Cookie.onLoad(el)` | as before, when jQuery is there |

A **group** whose name is a category's key is that category: `Cookie.set()`
writes when the category is granted (a category with `default: false` waits
for a yes, where a bare group was written until refused), `Cookie.get()`
returns `null` when it is refused, `checkConsent()` gives its state and
`setConsent()` answers for it. A group that is no category behaves exactly as
in 1.0.53.

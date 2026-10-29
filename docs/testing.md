---
title: Testing
order: 80
---

# Testing

## Running the tests

```sh
JQUERY=path/to/jquery.js npm test                      # tests/*.html in a headless Chrome
JQUERY=path/to/jquery.js npm test ajaxer.html          # one page
JQUERY=path/to/jquery.js CPU=4 node tests/run.mjs perf/scroll.html   # the measurements
```

`tests/run.mjs` needs Node 22 or later (its own WebSocket) and Chrome
(`CHROME=...` to name another; `TIMEOUT` in ms per page, 15000 by default). It
serves the repository over HTTP on a free port of 127.0.0.1 - `tests/site.mjs`
answers under `/site/` as a small site would, for the navigation to browse -
drives the browser over the DevTools protocol, in real time, and opens each
page, which writes its verdict in `#result`. Any console error or uncaught
exception a page did not say it expects (`Harness.expect`) fails it.
`tests/perf/scroll.html` measures what a scroll costs (script time, style and
box reads per frame, listeners) and is run by name only. See
[CHANGELOG.md](../CHANGELOG.md) for what each version changed.

| Variable | Default | Effect |
|---|---|---|
| `JQUERY` | required | the path of a `jquery.js` (any project's): served to the pages at `/tests/jquery.js`. Without it the runner stops with its usage line |
| `CHROME` | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | the browser to drive (started `--headless=new`, a fresh profile, a 1280 x 900 window) |
| `TIMEOUT` | `15000` | ms a page has to replace "pending" in `#result` |
| `CPU` | none | a processor that many times slower (`4`: about a phone's), applied to each page through the DevTools protocol - for the measurements |

Arguments name pages (relative to `tests/`); none runs every `tests/*.html`. A page passes when
every line of its verdict starts with `ok`; the runner prints `PASS <page>` or `FAIL <page>` with
the lines, and exits non-zero when one failed.

### In a container

Where Chrome is not installed, an image that has Node 22 and a Chrome (the `puppeteer` image, for
instance) runs the suite; Chrome there needs `--no-sandbox`, which a two-line wrapper gives:

```sh
printf '#!/bin/sh\nexec /path/to/chrome --no-sandbox "$@"\n' > chrome.sh && chmod +x chrome.sh
docker run --rm -v "$PWD":/repo:ro -v /path/to/dir-with-chrome.sh-and-jquery:/scratch:ro \
    -e CHROME=/scratch/chrome.sh -e JQUERY=/scratch/jquery.js -w /repo \
    --entrypoint node ghcr.io/puppeteer/puppeteer:24.10.0 tests/run.mjs
```

The repository can be mounted read-only: the runner writes nothing in it (the profile goes to the
system's temporary folder).

## The pages

`tests/harness.js` is loaded first by every page: it collects the verdict lines, turns uncaught
errors and unhandled rejections into failures (unless `Harness.expect(/text/)` says one is
expected), counts the native listeners added by target and type (so a page can say how many a
module costs), and gives the waits a scroll test needs.

| Page | What it checks |
|---|---|
| `ajaxer.html` | a channel sends through `$.ajax` and calls back with the JSON; the loader and the `ajaxer-success` / `ajaxer-error` classes; throttle, debounce, loader timings, `query_limit`, `abort()` |
| `ajaxer-channels.html` | a channel without a url sends nothing; without a target, `Ajaxer.send()` sends and calls back once, and `.call(element)` marks that element; `retry_limit` counts the tries after a failure (500: retried, 404: not), a retry is in the channel's list; a value set without a name is every channel's default (`url`, `target`, `loader_container`, `query_limit`); `ready(list)` stores no list |
| `cohabitation.html` | the navigation and the stops together: a scroll the navigation makes rests where it was put, the reader's own still settles; the listeners after a swap |
| `cookie.html` | Cookie without its banner: what @glitchr/cookie 1.0.53 did, under the same names; categories, states, defaults, storage |
| `cookie-banner.html` | the banner: shown on a first visit, labelled, accept and refuse, the detailed section, the switches |
| `cookie-countdown.html` | the countdown and its actions (`default`, `accept`, `refuse`, `none`) |
| `cookie-navigation.html` | the cookie module across the navigation's swaps; a configuration handed over as JSON |
| `cookie-places.html` | a page with several places for the banner; `Cookie.mount()` |
| `navigation.html` | a link swaps the block in place, with its title, address, history entry and events; the classes of `<html>`, the head, a canvas; anchors |
| `navigation-back.html` | Back to a long page that is not whole yet when its position is given back |
| `navigation-nest.html` | the nest: a panel over the page, its own history, closing it |
| `navigation-status.html` | answers under 422, 404, 500...: shown in place, no rescue |
| `no-jquery.html` | the core, the stops and the sortable on a page without jQuery; the others say so when loaded |
| `replace-canvases.html` | `Transparent.replaceCanvases()` keeps the page's canvases across a swap |
| `scroll-callback.html` | a scroll of the core's always ends and calls back once: arrived, interrupted, replaced, refused |
| `sortable.html` | a drag below the others reorders and tells `onChange` once; the keyboard with a handle; a press that does not move is a click |
| `sticky.html` | the address follows the headline read (`highlight`); a block fades in; `Sticky.scrollTo` is a script's scroll |
| `sticky-effects.html` | every class the module reads, initialised with every option on, the page scrolled through without an error |
| `sticky-magnets.html` | the magnets under a wheel, held |
| `sticky-magnets-interruptible.html` | `scrollsnap_hold: false`: the reader's gesture stops the way |
| `sticky-magnet-keys.html` | `scrollsnap_keys`: the arrows from magnet to magnet, down the page and along a row |
| `stops.html` | a rest glides on to the stop it was heading for; a nudge settles back; keys; a tall stop read a screen at a time |
| `stops-ends.html` | `ends` (1.4), and `shortEnd` (1.5.2, 1.5.3) |
| `stops-screens.html` | `screens` (1.5) |
| `stops-row-keys.html` | a row `data-sticky-axis="x"`: the arrows sideways, where they are left to the browser |
| `stops-ways.html` | `up: false`, `down: false`, `data-sticky-up` / `-down` |
| `stops-lag.html` | a scroll position told late, as iOS Safari tells it (1.5.4): one glide, all the way |
| `perf/scroll.html` | not part of the suite: what a scroll costs on a page of forty sections |

## Testing a page that uses Flow

- The modules announce what they do with DOM events (`transparent:load`, `sticky:stop`,
  `sticky:progress`, the cookie events): a site's test waits for them rather than for a delay.
- A scroll a script makes is not the reader's: `Flow.scripted(window)` and `Flow.userScroll()` say
  which, and the stops never settle after a script's scroll. A test that means to act as the
  reader dispatches a `wheel` (or a key) before scrolling.
- `Transparent`'s cache and the stops' kept measurements live in the page: open a fresh page per
  test, as `tests/run.mjs` does (one tab, one load per page).

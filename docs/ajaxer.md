---
title: Ajaxer
order: 50
---

# Ajaxer

`src/js/ajaxer.js` - named AJAX channels over jQuery's `$.ajax`. Global `Ajaxer`
(version 1.0.56 of `@glitchr/ajaxer`, whose options and methods are unchanged).
Needs jQuery and the core (`src/js/core.js`, loaded first), which provides the
durations (`"250ms"`, `"1s"`) and `$.fn.serializeObject`.

```js
import '@glitchr/flowjs/ajaxer';   // the module, with its stylesheet

Ajaxer.setUrl('search', '/search');
Ajaxer.setMethod('search', 'GET');
Ajaxer.setTarget('search', '#results');      // gets the ajaxer-* classes and the loader
Ajaxer.setThrottle('search', 400);          // milliseconds, see below

Ajaxer.send('search', { q: 'miso' },
    function (data) { /* success */ },
    function (data) { /* error: an answer that is not an object */ },
    function ()     { /* complete */ });
```

A channel is a name. `Ajaxer.send(name, data, success, error, complete)` sends
for that channel (`Ajaxer.xhr` is the same function); the callbacks are called
with the target as `this`. A channel without a target takes the caller for one when there is a
caller to mark: `Ajaxer.send.call(element, name, ...)` marks that element. Called as
`Ajaxer.send(...)` without a target, nothing is marked and no loader is shown; the request goes
all the same and the callbacks are called once, `this` an empty jQuery object.

## Loading

| Entry | Loads |
|---|---|
| `import '@glitchr/flowjs/ajaxer'` | `src/js/core.js`, `src/js/ajaxer.js` and `src/css/ajaxer.scss` (a bundler with Sass) |
| `import '@glitchr/flowjs'` | every module, this one included |
| `<script src="src/js/ajaxer.js">` | after jQuery and `src/js/core.js` |

The script throws `ajaxer.js: load core.js first` without the core and `ajaxer.js: jQuery is
needed` without jQuery. It sets `window.Ajaxer` and `Flow.ajaxer` (the same object), and exports
it to CommonJS.

At the window's `load`, `Ajaxer.ready()` runs by itself (no list, no options); at
`beforeunload`, `Ajaxer.clear()`.

## Per-channel settings

Each has a setter taking the channel's name; a value set without a name
(`Ajaxer.set(key, value)`, `Ajaxer.configure({...})`, `Ajaxer.ready(list, options)`)
is the default for every channel.

| Setter | Key | Default | Meaning |
| --- | --- | --- | --- |
| `setUrl(name, url)` | `url` | none | where to send; without it nothing is sent and the console says `No target URL provided.` |
| `setMethod(name, type)` | `method` | `"POST"` | HTTP method |
| `setOutput(name, dataType)` | `output` | `"json"` | jQuery's `dataType` |
| `setTarget(name, el)` | `target` | the caller (`this`), when it is an element or a jQuery object; else none | the element marked while the call is out |
| `setLoaderContainer(name, el)` | `loader_container` | the target | where the `.ajaxer-loader` is put |
| `setThrottle(name, d)` | `throttle` | `1000` | a send within this duration of the last is dropped; `0` for none |
| `setDebounce(name, d)` | `debounce` | `0` | wait this long after the last call |
| `setLoaderDebounce(name, d)` | `loader_debounce` | `1500` | the loader appears only after this long |
| `setRetryLimit(name, n)` | `retry_limit` | `1` | tries after a failure (no answer, or an answer of 500 or more); `0` for none |
| `setQueryLimit(name, n)` | `query_limit` | none | requests in flight at most |
| `cancelable(name, bool)` | `cancelable` | `false` | at the limit, abort the oldest (true) or refuse the new one |
| `setLoaderThrottle(name, d)` | `loader_throttle` | none | once shown, the loader stays at least that long |

A setter stores the value under `key[name]` in `Ajaxer.settings` (`Ajaxer.setUrl('search', '/s')`
is `Ajaxer.set('url[search]', '/s')`); `send()` reads `key[name]` first, then the key alone - for
every key: `Ajaxer.set('url', '/api')` is the url of every channel that has none of its own. The
setters return nothing (`undefined`): they do not chain. `Ajaxer.cancelable(name)` without its
second argument sets `true`. `Ajaxer.getTarget(name)` reads a channel's target back.

| Key | Read by `send()` as | Type |
|---|---|---|
| `url` | `url[name]`, else `url`; neither (or an empty string): nothing is sent | string |
| `method` | `method[name]`, else `method` | string (`GET`, `POST`, ...) |
| `output` | `output[name]`, else `output` | jQuery `dataType`: `json`, `html`, `text`, ... |
| `target` | `target[name]`, else `target`, else the caller (`this` of the call, when it is an element or a jQuery object) | element, selector or jQuery object |
| `loader_container` | `loader_container[name]`, else `loader_container`, else the target | element, selector or jQuery object |
| `throttle` | `throttle[name]`, else `throttle` | duration |
| `debounce` | `debounce[name]`, else `debounce` | duration |
| `loader_debounce` | `loader_debounce[name]`, else `loader_debounce` | duration |
| `loader_throttle` | `loader_throttle[name]`, else `loader_throttle` | duration |
| `retry_limit` | `retry_limit[name]`, else `retry_limit` | number |
| `query_limit` | `query_limit[name]`, else `query_limit` (read with `parseInt`; not a number: no limit) | number |
| `cancelable` | `cancelable[name]`, else `cancelable` | boolean |




A duration (`throttle`, `debounce`, `loader_debounce`) is a number of
milliseconds, or a string with its unit, and is worth what it says: `400` and
`"400"` are 400 ms, `"250ms"` is 250 ms, `"1s"` is one second, `"1s, 250ms"` the
longest of the two. `0` (or anything unreadable) is off. `Ajaxer.parseTime(v)`
returns the value in milliseconds. (Up to 1.0.0 the value went through the
core's `Flow.parseDuration`, in seconds, and was then taken for milliseconds:
`"250ms"` switched the throttle off and `"1s"` made it 1 ms. Plain numbers, the
only form that worked, mean what they did.)

`loader_debounce` is how long a call must be out before the loader shows;
`loader_throttle` (a duration as the others; none by default) is how long the
loader stays once it is shown, so that an answer arriving right after it
appeared does not make it blink. Without it the loader goes the moment the
answer is in. (Up to 1.0.2 the value was stored and nothing read it.)

### Throttle, debounce, limit

The order a send goes through:

1. **Throttle** (leading edge, per channel name): the first send runs and opens a window of
   `throttle`; a send within the window is dropped - no request, no callback. A send whose
   throttle is off (`0`) runs and closes any window left open, so a call site that asked for no
   throttle is never swallowed by another one's window on the same channel.
2. **Debounce** (trailing edge, per channel name): with a `debounce`, the send waits that long
   and a newer send of the channel replaces it; only the last one goes, with its own data and
   callbacks. Off (`0`, the default), it goes at once.
3. **Limit**: with a `query_limit`, when that many requests of the channel are in flight, a
   channel that is not `cancelable` refuses the newcomer (no request, no callback); a
   `cancelable` one aborts the oldest ones until the newcomer fits.

The default throttle is 1000 ms: two sends of one channel within a second go once. A channel
that sends on each keystroke sets `setThrottle(name, 0)` and a `debounce`.

### Retries

`retry_limit` is the number of tries after a failure: `1`, the default, sends a failed request
once more, `3` up to three times more, `0` never. A failure is retried when there was no answer
at all (the network) or an answer of 500 or more; an answer under 500 (404, 422...) says what is
wrong with the request and is not retried, nor is an aborted request or one jQuery could not read
(`parsererror`). A retry is the same request (its data and callbacks), sent at once and put in the
channel's list of requests in flight as the first was, so `query_limit` counts it and `abort()`
stops it. The failed tries call nothing: `complete` is called once, at the end of the last try, and
the loader and the target show the last try's failure. (Up to 1.6.0 a request was retried only
when it was not the first of its channel in flight, and the number was the tries in all: a request
sent alone was never retried.)


## States

On the target: `ajaxer-call` while the call is out, then `ajaxer-success` or
`ajaxer-error`. The loader (`.ajaxer-loader`, with an `.ajaxer-status` text) is
created in the container on the first send, shown after the loader debounce,
hidden on success; on failure it shows the status (`404 Error: ...`, or
`Unexpected error`) and a click or touch on it retries.

In detail:

| When | The target | The loader |
|---|---|---|
| a send goes out | every class starting with `ajaxer-` removed, then `ajaxer-call` | created if the container holds no `.ajaxer-loader` (a `div.ajaxer-loader` with a `span.ajaxer-status`, appended to the container) |
| `loader_debounce` later, still out | | `ajaxer-call` (shown) |
| an answer that is an object | `ajaxer-success`; `success` called | `ajaxer-call` removed (at once, or once `loader_throttle` is up), `ajaxer-success`, `ajaxer-error` removed |
| an answer that is not an object (a string, a number) | `ajaxer-error`; `error` called | the answer written in `.ajaxer-status` as HTML, `ajaxer-call` and `ajaxer-error` |
| an HTTP failure (status 400 or more) | `ajaxer-error` | `.ajaxer-status` reads `<status> Error`, followed by `: ` and the answer's `response` field (or the whole JSON answer) when there is one; `ajaxer-call` and `ajaxer-error` |
| no answer at all (network) | `ajaxer-error` | `Unexpected error` |
| an aborted request, or an answer jQuery cannot read as `output` says (`parsererror`) | nothing | nothing |
| in every case, at the end | `ajaxer-call` removed; `complete` called | |

A click or a touch on the loader after a failure clears its status, removes `ajaxer-error` and
sends the same request again (its callbacks included); the listener is added at each failure.

The loader is looked for anywhere inside the container (`.find('.ajaxer-loader')`): two channels
whose containers nest share the inner loader. The stylesheet centres a shown loader in its
container (`position: absolute`, `top: 50%`, `left: 50%`): the container needs a position
(`position: relative`). A shown loader without `ajaxer-error` turns a spinner; `.ajaxer-status`
is hidden while empty.

### The callbacks

| Callback | Called | Arguments | `this` |
|---|---|---|---|
| `success` | an answer that is an object (JSON object or array) | `(data, textStatus, jqXHR)` | the target, as a jQuery object |
| `error` | an answer that is **not** an object | `(data, textStatus, jqXHR)` | the target, as a jQuery object |
| `complete` | at the end of every request that went out, failed or not | `(jqXHR, textStatus)` | the target, as a jQuery object |

An HTTP failure calls `complete` only: the `error` callback is for a successful request whose
answer is not an object. `success`, `error` and `complete` are called once per element of the
target (a selector matching three elements calls them three times), each time with the whole
jQuery object as `this`.

`send()` returns nothing: the jqXHR of a channel's requests are in its list (see
`register()` below).

## Other methods

`Ajaxer.ready(list, options)` (fires `Ajaxer:ready` on the window; also on window
load), `get`, `set`, `add`, `remove`, `configure`, `abort(name, n)`, `abortAll()`,
`register(name, xhr)`, `unregister(xhr)`, `clear()` (settings back to the defaults,
requests aborted; done on `beforeunload`), `debounce(name, fn, timeout)`,
`throttle(name, fn, timeout)`, `isJson(str)`, `isDict(v)`.

| Method | Returns | Effect |
|---|---|---|
| `ready(list = {}, options = {})` | `Ajaxer` | `options.debug` switches the console messages on or off; `configure(options)`; dispatches `Ajaxer:ready` on `window`. `list` is not read (kept for the calls written `ready(list, options)`; up to 1.6.0 a non-empty array was stored as the `list` key, which nothing read) |
| `configure(options)` | `Ajaxer` | copies every own key of `options` whose value is not `undefined` into `Ajaxer.settings` |
| `get(key)` | the value, or `null` | `Ajaxer.settings[key]` |
| `set(key, value)` | `Ajaxer` | `Ajaxer.settings[key] = value` |
| `add(key, value)` | `Ajaxer` | adds `value` to the array under `key` (created if missing), once |
| `remove(key, value)` | the array, or `null` | removes `value` from the array under `key` |
| `send(name, data = {}, success, error, complete)`, `xhr(...)` | `undefined` | sends for the channel: see above. `data` goes to `$.ajax` as it is (an object, a string; `$('form').serializeObject()` from the core) |
| `abort(name, n = -1)` | `undefined` | aborts the oldest `n` requests of the channel in flight; all of them when `n` is negative |
| `abortAll()` | `undefined` | aborts every channel's requests |
| `register(name, xhr)` | `undefined` | adds a jqXHR to a channel's list of requests in flight (what `query_limit` and `abort()` count); `send()` does it for its own |
| `unregister(xhr)` | `undefined` | takes a jqXHR out of every list; `send()` does it at the answer |
| `clear()` | `undefined` | `Ajaxer.settings` back to the defaults object (see Notes), and `abortAll()` |
| `debounce(name, fn, timeout = null)` | a function | `fn` debounced under the channel's name: `timeout`, else the channel's `debounce`, else `debounce` |
| `throttle(name, fn, timeout = null)` | a function | `fn` throttled under the channel's name: `timeout`, else the channel's `throttle`, else `throttle` |
| `parseTime(value)` | milliseconds | see the durations above |
| `isJson(str)` | boolean | `JSON.parse(str)` succeeds |
| `isDict(v)` | boolean | an object, not `null`, not an array, not a `Date` |
| `onLoad()` | `undefined` | `ready()`: what the window's `load` calls |
| `getTarget(name)` | the target, or `null` | |


`Ajaxer.version` is `'1.0.56'`. `Ajaxer.settings` holds the defaults and every key set.

### Events

| Event | Target | When |
|---|---|---|
| `Ajaxer:ready` | `window` (a plain `Event`) | at each `Ajaxer.ready()`, so at the window's `load` too |

The module listens to the window's `load` (to call `ready()`) and `beforeunload` (to call
`clear()`), through jQuery.

## A search field

```html
<form id="search"><input name="q"></form>
<div id="results" style="position: relative; min-height: 6rem"></div>
```

```js
Ajaxer.setUrl('search', '/search');
Ajaxer.setMethod('search', 'GET');
Ajaxer.setTarget('search', '#results');
Ajaxer.setThrottle('search', 0);           // every keystroke may go...
Ajaxer.setDebounce('search', '250ms');     // ...but only the last one after a pause
Ajaxer.setQueryLimit('search', 1);
Ajaxer.cancelable('search');               // a newer search aborts the one in flight
Ajaxer.setLoaderDebounce('search', '300ms');
Ajaxer.setLoaderThrottle('search', '400ms');

$('#search input').on('input', function () {
    Ajaxer.send('search', $('#search').serializeObject(), function (data) {
        this.html(data.html);              // this: $('#results')
    });
});
```

## Notes

The module shares with the core the durations and `$.fn.serializeObject`, which
it used to define itself. It listens to no scroll: the infinite-scroll case in
its comments is a caller's, which calls `Ajaxer.send` from a scroll handler
(`Flow.onScroll` is there for it). `Ajaxer.settings` is the object of defaults
itself, not a copy: `clear()` assigns it again without copying, so settings set
before survive it (kept as in 1.0.56).

The defaults object holds `method: "POST"`, `output: "json"`, `cancelable: false`,
`retry_limit: 1`, `throttle: 1000`, `debounce: 0`, `loader_debounce: 1500`; `loader_throttle`,
`url`, `target`, `loader_container` and `query_limit` have no default (each can be given one
with `Ajaxer.set(key, value)` or `configure()`).

// Ajaxer - named AJAX channels over jQuery's $.ajax: a channel has its url,
// method, output and target set once (Ajaxer.setUrl('search', '/search'), ...),
// then Ajaxer.send('search', data, success, error, complete) sends, throttled
// and debounced per channel, with a loader (.ajaxer-loader, after a delay) in
// the target, the "ajaxer-call" / "ajaxer-success" / "ajaxer-error" classes on
// it, a retry on failure and a limit of requests in flight (the oldest aborted,
// or the new one refused, as `cancelable` says). What it shares with the other
// modules - the durations ("250ms"), $.fn.serializeObject - is the core's.
/**
 * @file Ajaxer, named AJAX channels: a name with its address, method, throttle, debounce, loader and retries, sent with one call.
 */
(function (root, factory) {

    var core = root.Flow && root.Flow.core === true ? root.Flow : (typeof require === 'function' ? require('./core.js') : null);
    if (!core) throw new Error('ajaxer.js: load core.js first');

    var api = factory(root, core, core.jquery());
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.Ajaxer = api;
    core.ajaxer = api;

})(typeof window !== 'undefined' ? window : this, function (window, Flow, $) {

    if (!$) throw new Error('ajaxer.js: jQuery is needed');
    var document = window.document;

    const Ajaxer = window.Ajaxer = {};
          Ajaxer.version = '1.0.56';

    const defaultAjaxer  = {
        method:"POST",
        output: "json",
        cancelable: false,
        retry_limit:1,
        throttle:1000,
        debounce:0,
        loader_debounce:1500,
    };

    Ajaxer.settings = defaultAjaxer;

    let debug = false;
    let ready = false;

    Ajaxer.clear = function() {

        Ajaxer.settings = defaultAjaxer;
        Ajaxer.abortAll();
    }

    // A duration in milliseconds. A number is milliseconds as it stands; a string with a
    // unit is what it says ("250ms", "1s", or several, "1s, 250ms": the longest); a string
    // without one ("250") is milliseconds too. Anything unreadable is 0 (off).
    Ajaxer.parseTime = function (value) {

        if (typeof value === "number") return isFinite(value) ? value : 0;
        if (value === undefined || value === null) return 0;

        const list = String(value).trim().split(/\s*,\s*/).map(function (t) {
            if (/ms$/.test(t)) return parseFloat(t);
            if (/s$/.test(t)) return 1000 * parseFloat(t);
            return parseFloat(t);
        });
        const longest = Math.max.apply(Math, list);
        return isFinite(longest) ? longest : 0;
    };

    // The first parameter is kept for the calls written ready(list, options); it is not read (up to
    // 1.6.0 a non-empty array was stored under settings.list, which nothing read).
    Ajaxer.ready = function (list = {}, options = {}) {

        if(options && "debug" in options)
            debug = options["debug"];

        Ajaxer.configure(options);

        ready = true;

        if (debug) console.debug("Ajaxer is ready.");
        dispatchEvent(new Event('Ajaxer:ready'));

        return this;
    };

    Ajaxer.get = function(key) {

        if(key in Ajaxer.settings)
            return Ajaxer.settings[key];

        return null;
    };

    Ajaxer.set = function(key, value) {

        Ajaxer.settings[key] = value;
        return this;
    };

    Ajaxer.add = function(key, value) {

        if(! (key in Ajaxer.settings))
            Ajaxer.settings[key] = [];

        if (Ajaxer.settings[key].indexOf(value) === -1)
            Ajaxer.settings[key].push(value);

        return this;
    };

    Ajaxer.remove = function(key, value) {

        if(key in Ajaxer.settings) {

            Ajaxer.settings[key] = Ajaxer.settings[key].filter(function(setting) {
                return value !== setting;
            });

            return Ajaxer.settings[key];
        }

        return null;
    };

    Ajaxer.configure = function (options) {

        let key, value;
        for (key in options) {
            value = options[key];
            if (value !== undefined && options.hasOwnProperty(key)) Ajaxer.settings[key] = value;
        }

        if (debug) console.debug("Ajaxer configuration: ", Ajaxer.settings);

        return this;
    };

    Ajaxer.onLoad = function ()
    {
        Ajaxer.ready();
    }

    Ajaxer.setMethod = function(name, type)
    {
        Ajaxer.set("method["+name+"]", type);
    }

    Ajaxer.setUrl = function(name, url)
    {
        Ajaxer.set("url["+name+"]", url);
    }

    Ajaxer.setOutput = function(name, dataType)
    {
        Ajaxer.set("output["+name+"]", dataType);
    }

    Ajaxer.getTarget = function(name)
    {
        return Ajaxer.get("target["+name+"]");
    }

    Ajaxer.setTarget = function(name, el)
    {
        Ajaxer.set("target["+name+"]", el);
    }

    Ajaxer.cancelable = function(name, cancelable = true)
    {
        Ajaxer.set("cancelable["+name+"]", cancelable);
    }

    Ajaxer.setDebounce = function(name, debounce)
    {
        Ajaxer.set("debounce["+name+"]", debounce)
    }
    Ajaxer.setLoaderDebounce = function(name, debounce)
    {
        Ajaxer.set("loader_debounce["+name+"]", debounce)
    }

    Ajaxer.setThrottle = function(name, throttle)
    {
        Ajaxer.set("throttle["+name+"]", throttle)
    }
    Ajaxer.setLoaderThrottle = function(name, throttle)
    {
        Ajaxer.set("loader_throttle["+name+"]", throttle)
    }

    Ajaxer.setLoaderContainer = function(name, el)
    {
        Ajaxer.set("loader_container["+name+"]", el);
    }

    Ajaxer.setRetryLimit = function(name, retryLimit)
    {
        Ajaxer.set("retry_limit["+name+"]", retryLimit)
    }

    Ajaxer.setQueryLimit = function(name, queryLimit)
    {
        Ajaxer.set("query_limit["+name+"]", queryLimit);
    }

    const debounceTimer = {};
    Ajaxer.debounce = function (name, func, timeout = null){

        if( ! (name in debounceTimer) )
            debounceTimer[name] = undefined;

        return (...args) => {

            const wait = Ajaxer.parseTime(timeout ?? Ajaxer.get("debounce["+name+"]") ?? Ajaxer.get("debounce"));
            if(wait < 1) func.apply(this, args)
            else {

                if(typeof debounceTimer[name] !== "undefined") clearTimeout(debounceTimer[name]);
                debounceTimer[name] = setTimeout(() => { func.apply(this, args); }, wait);
            }
        };
    }

    const throttleTimer = {};
    Ajaxer.throttle = function (name, func, timeout = null){

        if( ! (name in throttleTimer) )
            throttleTimer[name] = undefined;

        return (...args) => {

            // Resolve the throttle BEFORE consulting the open window.
            //
            // The window is keyed by channel name, and one channel is routinely shared
            // by call sites that want different throttles - e.g. a "searchbar" channel
            // driven by an unthrottled keystroke handler, a 400ms infinite-scroll
            // handler, and an initial page load on the global default. Checking the
            // window first meant whoever armed it silently swallowed the next call from
            // any other call site, including one that had just asked, via
            // setThrottle(name, 0), for no throttling at all. That call was dropped
            // outright: no request, no error, the caller none the wiser.
            //
            // Resolved into a local rather than reassigning the closed-over `timeout`,
            // so a wrapper that is retained and invoked more than once keeps reading
            // current settings instead of freezing the first value it ever saw.
            const wait = Ajaxer.parseTime(timeout ?? Ajaxer.get("throttle["+name+"]") ?? Ajaxer.get("throttle"));

            // Throttling explicitly off for this call: run it, and clear any window a
            // previous throttled call left standing so it cannot outlive its purpose.
            if (wait < 1) {

                if (typeof throttleTimer[name] !== "undefined") clearTimeout(throttleTimer[name]);
                throttleTimer[name] = undefined;

                func.apply(this, args);
                return;
            }

            if (typeof throttleTimer[name] !== "undefined") return;

            func.apply(this, args);
            throttleTimer[name] = setTimeout(() => { throttleTimer[name] = undefined; }, wait);
        };
    }

    const queryList = {};

    Ajaxer.abortAll = function()
    {
        Object.keys(queryList).forEach((name) => {
            Ajaxer.abort(name);
        });
    }

    Ajaxer.abort = function (name, nKill = -1)
    {
        if(!(name in queryList))
            queryList[name] = [];

        let iKill = 0;
        while (queryList[name].length > 0 && (iKill++ < nKill || nKill < 0))
        {
            const xhr = queryList[name].shift(); // @TODO: implement mutex with unregister
                  xhr.abort();
        }
    }

    Ajaxer.register = function(name, xhr)
    {
        if(!(name in queryList))
            queryList[name] = [];

        queryList[name].push(xhr);
    }

    Ajaxer.unregister = function(xhr)
    {
        Object.entries(queryList).forEach(([_name, xhrList]) => {

            const index = xhrList.indexOf(xhr);
            if(index > -1) xhrList.splice(index, 1);
        });
    }

    Ajaxer.isJson = function(str)
    {
        try { JSON.parse(str); }
        catch (e) { return false; }

        return true;
    }

    Ajaxer.isDict = function(v) {
        return typeof v === 'object' && v !== null && !(v instanceof Array) && !(v instanceof Date);
    }

    // A channel's value: its own (key[name]), else the one set without a name, the default of
    // every channel; null when neither is set.
    const setting = function (key, name) {

        const own = Ajaxer.get(key + "[" + name + "]");
        return own !== null && own !== undefined ? own : Ajaxer.get(key);
    };

    // The caller of send(), when it is something to mark: an element, or a jQuery object
    // (Ajaxer.send.call(element, ...)). Called as Ajaxer.send(...), `this` is Ajaxer: no caller.
    const caller = function (that) {

        if (!that || that === Ajaxer || that === window) return null;
        if (that instanceof $ || that.nodeType === 1 || that.nodeType === 9) return that;
        return null;
    };

    // A failure worth trying again: no answer at all (the network), or the server's (500 or more).
    // An answer under 500 says what is wrong with the request: sent again, it gets the same.
    const retryable = function (xhr, textStatus) {

        if (textStatus === "abort" || textStatus === "parsererror") return false;
        return xhr.status === 0 || xhr.status >= 500;
    };

    Ajaxer.send = Ajaxer.xhr = function(name, data = {}, success = function() {}, error = function() {}, complete = function() {})
    {
        if( typeof name !== "string" )
            console.error("Unexpected ajax request name received.");

        success = typeof success === "function" ? success : function() {};
        error = typeof error === "function" ? error : function() {};
        complete = typeof complete === "function" ? complete : function() {};

        return Ajaxer.throttle(name, () => Ajaxer.debounce(name, () => function() {

            const url = setting("url", name);
            if (url === null || url === undefined || url === "") console.error("No target URL provided.");
            else {

                // Without a target and without a caller to mark, nothing is marked and no loader
                // shown: the callbacks are called once, `this` an empty jQuery object.
                const targetSetting = setting("target", name) || caller(this);
                const target = targetSetting ? $(targetSetting) : $();
                const loaderContainer = setting("loader_container", name) || targetSetting;
                const call = function (fn, args) {

                    if (target.length === 0) fn.call(target, ...args);
                    else target.each(function () { fn.call(target, ...args); });
                };

                let loader = loaderContainer ? $(loaderContainer).find(" .ajaxer-loader") : $();
                if (loader.length === 0 && loaderContainer && $(loaderContainer).length) {

                    loader = $(document.createElement("div"));
                    loader.addClass("ajaxer-loader");
                    loader.append("<span class='ajaxer-status'></span>")

                    $(loaderContainer).append(loader);
                    loader = $(loaderContainer).find(" .ajaxer-loader");
                }

                // no container: a loader of its own, never put in the page
                loader = loader[0] || $("<div class='ajaxer-loader'><span class='ajaxer-status'></span></div>")[0];
                target.removeClass(function (index, className) {
                    return (className.match(/(^|\s)ajaxer-\S+/g) || []).join(' ');
                });

                if (!(name in queryList))
                    queryList[name] = [];

                const queryLimit = parseInt(setting("query_limit", name));
                if (queryList[name].length >= queryLimit && !isNaN(queryLimit)) {

                    const cancelable = Ajaxer.get("cancelable["+name+"]") ?? Ajaxer.get("cancelable");
                    if (!cancelable) return;

                    Ajaxer.abort(name, queryList[name].length - queryLimit + 1);
                }

                $(target).addClass("ajaxer-call");
                const loaderDebounceTime = Ajaxer.parseTime(Ajaxer.get("loader_debounce["+name+"]") ?? Ajaxer.get("loader_debounce"));

                // loader_throttle: once shown, the loader stays at least that long (0, the default: it
                // goes the moment the answer is in) - an answer arriving right after the loader_debounce
                // made it blink. The setter stored the value from the start and nothing read it.
                const loaderThrottleTime = Ajaxer.parseTime(Ajaxer.get("loader_throttle["+name+"]") ?? Ajaxer.get("loader_throttle"));
                let loaderShownAt = null;
                const showLoader = function () {
                    clearTimeout(loader.ajaxerHide);
                    loaderShownAt = Date.now();
                    $(loader).addClass("ajaxer-call");
                };
                const hideLoader = function () {
                    const left = loaderShownAt === null ? 0 : loaderThrottleTime - (Date.now() - loaderShownAt);
                    clearTimeout(loader.ajaxerHide);
                    if (left > 0) loader.ajaxerHide = setTimeout(() => $(loader).removeClass("ajaxer-call"), left);
                    else $(loader).removeClass("ajaxer-call");
                };
                let loaderTimeout = setTimeout(showLoader, loaderDebounceTime);

                // The request in flight: the first, then each retry, registered in its turn.
                let response = null;
                const resend = function (settings) {

                    Ajaxer.unregister(response);
                    response = $.ajax(settings);
                    Ajaxer.register(name, response);
                };

                response = $.ajax({
                    url: url,
                    type: Ajaxer.get("method[" + name + "]") ?? Ajaxer.get("method"),
                    dataType: Ajaxer.get("output[" + name + "]") ?? Ajaxer.get("output"),
                    data: data,
                    tryCount : 0,
                    retryLimit : parseInt(Ajaxer.get("retry_limit[" + name + "]") ?? Ajaxer.get("retry_limit")) || 0,
                    success: function (...args) {

                        const status = args[0];
                        if(typeof status !== 'object' ) {

                            $(loader).find(".ajaxer-status").html(status);

                            $(loader).addClass("ajaxer-call");
                            $(loader).addClass("ajaxer-error");
                            target.addClass("ajaxer-error");
                            call(error, args);

                        } else {

                            hideLoader();
                            $(loader).addClass("ajaxer-success");
                            $(loader).removeClass("ajaxer-error");
                            target.addClass("ajaxer-success");
                            call(success, args);
                        }

                        Ajaxer.unregister(response);
                    },

                    error: function (...args) {

                        const xhr = args[0];
                        const textStatus = args[1];

                        // retry_limit: the tries after a failure. A retry is the same request sent
                        // again, in the channel's list as the first was; its failed try is not
                        // complete: complete is called once, at the end of the last one.
                        if (retryable(xhr, textStatus) && this.tryCount < this.retryLimit) {

                            // the flag after the copy: the retry's own settings are made from these
                            this.tryCount++;
                            resend(this);
                            this.retrying = true;
                            return;
                        }

                        clearTimeout(loaderTimeout);

                        let ret = undefined;
                        if(xhr.responseJSON !== undefined) {
                            ret = Ajaxer.isDict(xhr.responseJSON) && "response" in xhr.responseJSON ? xhr.responseJSON["response"] : xhr.responseJSON;
                        }

                        if (xhr.status >= 400) ret = xhr.status + " Error" + (ret ? ': ' + ret : "");
		                else if (!ret && xhr.statusText === "error") ret = "Unexpected error";

                        if(ret) $(loader).addClass("ajaxer-call");
                        $(loader).find(".ajaxer-status").html(ret);
                        $(loader).one("click touchstart", function () {

                            $(loader).addClass("ajaxer-call");
                            $(loader).find(".ajaxer-status").html("");
                            $(loader).removeClass("ajaxer-error");
                            this.tryCount = 0;
                            resend(this);

                        }.bind(this));

                        if(ret) {

                            $(loader).addClass("ajaxer-error");
                            target.addClass("ajaxer-error");
                        }

                        Ajaxer.unregister(response);
                    },

                    complete: function (...args) {

                        if (this.retrying) {

                            this.retrying = false;
                            return;
                        }

                        clearTimeout(loaderTimeout);
                        target.removeClass("ajaxer-call");
                        call(complete, args);
                    }
                });

                Ajaxer.register(name, response);
            }

        }.bind(this)())())();
    }

    $(window).on("load", function() { Ajaxer.onLoad(); });
    $(window).on("beforeunload", function() { Ajaxer.clear(); });

    return Ajaxer;
});

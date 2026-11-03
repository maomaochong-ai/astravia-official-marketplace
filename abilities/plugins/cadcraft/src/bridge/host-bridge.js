/*
 * Craft host bridge — the only script we add to the upstream page.
 *
 * Rule zero: look at the shape first, and let anything we do not recognise go
 * straight through to the browser. If upstream changes how it opens or saves,
 * this script must degrade to the native behaviour, never corrupt bytes.
 *
 * It runs in two containers and must behave differently in each:
 *   docked     (host activity tab, `window.parent !== window`) -> take over the
 *              two seams and move bytes over postMessage to the host.
 *   standalone (host browser panel, system browser)            -> do nothing.
 *
 * Seams (ADR 0002):
 *   open  - rfd's wasm backend builds `<input type=file>` and calls click();
 *   save  - the web shell builds `<a download href="blob:…">` and clicks it.
 *
 * The same file is shipped by every craft plugin: it knows nothing about a
 * particular app, only about the shape of those two seams and of the loading
 * element (`<id>_loading`) upstream removes once the editor is up.
 *
 * ADR: docs/adr/photocraft/0002-bytes-move-through-the-host.md
 */
(function () {
  "use strict";

  var parentWindow = window.parent;
  var docked = parentWindow && parentWindow !== window;
  if (!docked) return;

  var seq = 0;
  var waiting = new Map();
  var staged = null;
  var nativeInputClick = HTMLInputElement.prototype.click;
  var nativeAnchorClick = HTMLAnchorElement.prototype.click;
  var FALLBACK_MS = 60000;
  var CAPTURE_NAME = "canvas.png";

  // ------------------------------------------------------------- pause gate
  //
  // An inactive activity tab is hidden with `display: none` but stays mounted, so
  // this document keeps running and upstream keeps drawing a canvas nobody can see
  // — one of these per craft plugin, all at 60 fps, in the renderer that also draws
  // the host UI. Chrome will not throttle a same-origin-scripted page for us.
  //
  // The app's own loop is the only thing asking for frames, so holding its request
  // is exactly "stop drawing": nothing is dropped, the next frame just is not
  // scheduled until the tab is visible again. Native ids stay untouched and ours are
  // negative, so no cancel can ever reach the wrong callback.
  var paused = false;
  var heldFrames = new Map();
  var heldSeq = 0;
  var nativeRaf = window.requestAnimationFrame.bind(window);
  var nativeCancelRaf = window.cancelAnimationFrame.bind(window);

  window.requestAnimationFrame = function (callback) {
    if (!paused) return nativeRaf(callback);
    var id = -(++heldSeq);
    heldFrames.set(id, callback);
    return id;
  };

  window.cancelAnimationFrame = function (id) {
    if (heldFrames.delete(id)) return undefined;
    return nativeCancelRaf(id);
  };

  function pause() {
    paused = true;
  }

  function resume() {
    if (!paused) return;
    paused = false;
    var callbacks = [];
    heldFrames.forEach(function (callback) {
      callbacks.push(callback);
    });
    heldFrames.clear();
    for (var i = 0; i < callbacks.length; i++) nativeRaf(callbacks[i]);
  }

  function post(message, transfer) {
    try {
      parentWindow.postMessage(message, "*", transfer || []);
    } catch (error) {
      /* a dead parent is not our problem; upstream keeps working */
    }
  }

  function reply(id, payload, transfer) {
    var message = { type: "craft:reply", id: id };
    if (payload) for (var key in payload) message[key] = payload[key];
    post(message, transfer);
  }

  function describe(input) {
    return {
      accept: input.accept || "",
      multiple: !!input.multiple,
    };
  }

  function deliver(input, payload) {
    var bytes = payload.bytes;
    var file;
    try {
      file = new File([bytes], payload.name || "document", {
        type: payload.mime || "application/octet-stream",
      });
    } catch (error) {
      file = new Blob([bytes], { type: payload.mime || "application/octet-stream" });
      try {
        Object.defineProperty(file, "name", { value: payload.name || "document" });
      } catch (ignored) {
        /* rfd reads input.files, which we set below */
      }
    }
    var data = new DataTransfer();
    data.items.add(file);
    input.files = data.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function cancel(input) {
    input.dispatchEvent(new Event("cancel", { bubbles: true }));
  }

  /** `accept` is a comma list of extensions and MIME types; empty means anything. */
  function accepts(input, name, mime) {
    var accept = (input.accept || "").trim();
    if (!accept) return true;
    var ext = (name || "").slice(((name || "").lastIndexOf(".") >>> 0) + 1).toLowerCase();
    var parts = accept.split(",");
    for (var i = 0; i < parts.length; i++) {
      var token = parts[i].trim().toLowerCase();
      if (!token) continue;
      if (token === "." + ext) return true;
      if (token.slice(-2) === "/*" && mime && mime.toLowerCase().indexOf(token.slice(0, -1)) === 0) return true;
      if (mime && token === mime.toLowerCase()) return true;
    }
    return false;
  }

  // ------------------------------------------------------------- open seam

  HTMLInputElement.prototype.click = function () {
    var input = this;
    if (!input || input.type !== "file") return nativeInputClick.apply(input, arguments);

    // A file the host staged (agent tool, or a selection handed over earlier) is
    // handed straight to the app: the user already said which file is meant.
    if (staged && accepts(input, staged.name, staged.mime)) {
      var chosen = staged;
      staged = null;
      deliver(input, chosen);
      return undefined;
    }

    var id = "open-" + ++seq;
    waiting.set(id, input);
    post({ type: "craft:pickOpen", id: id, accept: input.accept || "", multiple: !!input.multiple });

    // If the host never answers (tab hidden, plugin reloading), fall back to the
    // browser's own picker instead of leaving the editor stuck forever.
    setTimeout(function () {
      if (waiting.delete(id)) nativeInputClick.call(input);
    }, FALLBACK_MS);
    return undefined;
  };

  // ------------------------------------------------------------- save seam

  HTMLAnchorElement.prototype.click = function () {
    var anchor = this;
    var args = arguments;
    var href = anchor && anchor.getAttribute ? anchor.getAttribute("href") || "" : "";
    var isDownload = !!anchor && anchor.hasAttribute && anchor.hasAttribute("download");
    if (!anchor || !isDownload || href.slice(0, 5) !== "blob:") {
      return nativeAnchorClick.apply(anchor, args);
    }

    var id = "save-" + ++seq;
    var name = anchor.getAttribute("download") || "export";
    fetch(href)
      .then(function (response) {
        return response.arrayBuffer();
      })
      .then(function (bytes) {
        post(
          {
            type: "craft:save",
            id: id,
            name: name,
            mime: anchor.getAttribute("type") || "",
            bytes: bytes,
          },
          [bytes],
        );
      })
      .catch(function (error) {
        post({ type: "craft:error", id: id, message: String((error && error.message) || error) });
        nativeAnchorClick.apply(anchor, args);
      });

    // Never let the browser start its own download for a blob we are handling.
    return undefined;
  };

  // ------------------------------------------------------------- messages

  window.addEventListener("message", function (event) {
    if (event.source !== parentWindow) return;
    var data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === "craft:open") {
      var input = waiting.get(data.id);
      if (!input) return;
      waiting.delete(data.id);
      if (data.bytes) deliver(input, data);
      else cancel(input);
      return;
    }

    // The host has no single file selected: leave the choice to the browser.
    if (data.type === "craft:fallback") {
      var fallback = waiting.get(data.id);
      if (!fallback) return;
      waiting.delete(data.id);
      nativeInputClick.call(fallback);
      return;
    }

    if (data.type === "craft:cancel") {
      var target = waiting.get(data.id);
      if (!target) return;
      waiting.delete(data.id);
      cancel(target);
      return;
    }

    // Stage bytes for the next file the app asks for (host agent tool).
    if (data.type === "craft:stage") {
      if (!data.bytes) {
        staged = null;
        reply(data.id, { ok: true, staged: null });
        return;
      }
      staged = { name: data.name || "document", mime: data.mime || "", bytes: data.bytes };
      reply(data.id, { ok: true, staged: staged.name });
      return;
    }

    if (data.type === "craft:inspect") {
      var canvas = canvasNode();
      reply(data.id, {
        ok: true,
        href: location.href,
        secure: !!window.isSecureContext,
        ready: loaderText() === null,
        canvas: canvas ? { width: canvas.width, height: canvas.height } : null,
        staged: staged ? staged.name : null,
      });
      return;
    }

    if (data.type === "craft:pause") {
      pause();
      reply(data.id, { ok: true, paused: true });
      return;
    }

    if (data.type === "craft:resume") {
      resume();
      reply(data.id, { ok: true, paused: false });
      return;
    }

    if (data.type === "craft:pointer") {
      pointer(data);
      return;
    }

    if (data.type === "craft:key") {
      keys(data);
      return;
    }

    if (data.type === "craft:capture") {
      capture(data);
      return;
    }
  });

  // ------------------------------------------------------- driving the editor
  //
  // The page is a canvas: there is no DOM to click, only coordinates and keys the
  // app's own event listeners understand. Both helpers dispatch what a real
  // pointer or keyboard would, on the canvas, after focusing it — upstream reads
  // `offsetX/offsetY` and `event.key`, it does not care that the event is synthetic.
  // Nothing here is app-specific, and nothing claims success: the only proof that a
  // gesture landed is the next capture.

  function pointer(data) {
    var canvas = canvasNode();
    if (!canvas) {
      reply(data.id, { ok: false, error: "no-canvas" });
      return;
    }
    resume(); // a hidden editor would queue the event into a frame that never runs
    var box = canvas.getBoundingClientRect();
    if (!box.width || !box.height) {
      reply(data.id, { ok: false, error: "canvas-not-laid-out" });
      return;
    }
    // Fractions of the canvas, not pixels: the agent reads the size from inspect and
    // should not have to care whether the panel is 900 or 2400 px wide.
    var fx = typeof data.x === "number" ? data.x : 0.5;
    var fy = typeof data.y === "number" ? data.y : 0.5;
    var clientX = box.left + Math.min(1, Math.max(0, fx)) * box.width;
    var clientY = box.top + Math.min(1, Math.max(0, fy)) * box.height;
    var button = typeof data.button === "number" ? data.button : 0;

    try {
      canvas.focus();
    } catch (error) {
      /* focus is best-effort */
    }

    var base = {
      clientX: clientX,
      clientY: clientY,
      screenX: clientX,
      screenY: clientY,
      bubbles: true,
      cancelable: true,
      button: button,
      buttons: 1,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    };

    function fire(type) {
      var init = {};
      for (var key in base) init[key] = base[key];
      var event;
      try {
        event = new PointerEvent(type, init);
      } catch (error) {
        event = new MouseEvent(type, init);
      }
      canvas.dispatchEvent(event);
    }

    fire("pointerdown");
    fire("mousedown");
    if (data.double) {
      fire("pointerup");
      fire("mouseup");
      fire("click");
      fire("pointerdown");
      fire("mousedown");
    }
    fire("pointerup");
    fire("mouseup");
    fire("click");
    reply(data.id, { ok: true, at: { x: fx, y: fy } });
  }

  function keys(data) {
    var canvas = canvasNode();
    if (!canvas) {
      reply(data.id, { ok: false, error: "no-canvas" });
      return;
    }
    resume();
    var text = typeof data.text === "string" ? data.text : "";
    var key = typeof data.key === "string" ? data.key : "";
    try {
      canvas.focus();
    } catch (error) {
      /* focus is best-effort */
    }

    // Modifier chords arrive as "ctrl+s"; plain keys as "Enter" or a single letter.
    var parts = key ? key.split("+") : [];
    var name = parts.length > 1 ? parts[parts.length - 1] : key;
    var modifiers = parts.length > 1 ? parts.slice(0, -1) : [];

    function keyEvent(type, value, withModifiers) {
      var init = {
        key: value,
        bubbles: true,
        cancelable: true,
        ctrlKey: withModifiers.indexOf("ctrl") >= 0,
        shiftKey: withModifiers.indexOf("shift") >= 0,
        altKey: withModifiers.indexOf("alt") >= 0,
        metaKey: withModifiers.indexOf("meta") >= 0,
      };
      canvas.dispatchEvent(new KeyboardEvent(type, init));
    }

    for (var i = 0; i < text.length; i++) {
      var ch = text.charAt(i);
      keyEvent("keydown", ch, []);
      keyEvent("keypress", ch, []);
      keyEvent("keyup", ch, []);
    }

    if (name) {
      for (var m = 0; m < modifiers.length; m++) keyEvent("keydown", modifiers[m], []);
      keyEvent("keydown", name, modifiers);
      keyEvent("keyup", name, modifiers);
      for (var u = modifiers.length - 1; u >= 0; u--) keyEvent("keyup", modifiers[u], []);
    }

    reply(data.id, { ok: true, typed: text.length, key: name || null });
  }


  function canvasNode() {
    var canvas = document.querySelector("canvas");
    return canvas && canvas.width > 0 ? canvas : null;
  }

  /** PNG of whatever the app is showing. Tainted canvases fail loudly, not silently. */
  function capture(data) {
    var canvas = canvasNode();
    if (!canvas) {
      reply(data.id, { ok: false, error: "no-canvas" });
      return;
    }
    var url;
    try {
      url = canvas.toDataURL("image/png");
    } catch (error) {
      reply(data.id, { ok: false, error: String((error && error.message) || "capture-failed") });
      return;
    }
    var comma = url.indexOf(",");
    if (url.slice(0, 5) !== "data:" || comma < 0) {
      reply(data.id, { ok: false, error: "capture-empty" });
      return;
    }
    var binary = atob(url.slice(comma + 1));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    reply(
      data.id,
      { ok: true, name: data.name || CAPTURE_NAME, mime: "image/png", bytes: bytes.buffer },
      [bytes.buffer],
    );
  }

  // ------------------------------------------------------------- boot watch

  // "ready" must mean "the editor started", not "this script ran". Every web shell
  // here removes its `#<app>_loading` element on success and rewrites it with a
  // failure sentence otherwise, so that element is the only signal available; a
  // shell without one is judged by its first non-empty canvas.
  var BOOT_MS = 60000;

  function loaderText() {
    var el = document.querySelector('[id$="_loading"]');
    if (el) return el.textContent || "";
    // No loading element at all: a drawn canvas means it made it, a visible
    // "stalled" panel means it did not.
    var stalled = document.querySelector('[id$="_stalled"]');
    if (stalled && !stalled.hidden) return stalled.textContent || "failed to start";
    return canvasNode() ? null : "";
  }

  function announceBoot(backend) {
    var started = Date.now();
    var done = false;
    var timer = setInterval(function () {
      if (done) return clearInterval(timer);
      var text = loaderText();
      if (text === null) {
        done = true;
        clearInterval(timer);
        post({ type: "craft:ready", backend: backend, href: location.href, secure: !!window.isSecureContext });
        return;
      }
      var failed = /failed to start|failed to load|device lost/i.test(text);
      var waited = Date.now() - started > BOOT_MS;
      if (failed || waited) {
        done = true;
        clearInterval(timer);
        post({
          type: "craft:error",
          backend: backend,
          message: text || (failed ? "failed to start" : "boot-timeout"),
        });
      }
    }, 200);
  }

  function backend() {
    if (!navigator.gpu) return Promise.resolve("cpu-or-gl");
    var timeout = new Promise(function (resolve) {
      setTimeout(function () {
        resolve("gpu-unknown");
      }, 2500);
    });
    var probe = navigator.gpu
      .requestAdapter()
      .then(function (adapter) {
        return adapter ? "gpu" : "cpu-or-gl";
      })
      .catch(function () {
        return "cpu-or-gl";
      });
    return Promise.race([probe, timeout]);
  }

  backend().then(announceBoot);

  window.addEventListener("error", function (event) {
    post({ type: "craft:error", message: String((event && event.message) || "script-error") });
  });
  window.addEventListener("unhandledrejection", function (event) {
    post({ type: "craft:error", message: String((event && event.reason) || "unhandled-rejection") });
  });
})();

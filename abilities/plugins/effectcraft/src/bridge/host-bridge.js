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

  // Two reasons can stop the loop, and they end independently: the host hid the tab
  // (`craft:pause`), or the whole window is minimised / behind another window, which
  // only `visibilitychange` knows about. Either one is enough; both clearing resumes.
  var hostPaused = false;
  var hiddenPaused = false;

  function applyPaused() {
    var want = hostPaused || hiddenPaused;
    if (want === paused) return;
    if (want) {
      paused = true;
      return;
    }
    paused = false;
    var callbacks = [];
    heldFrames.forEach(function (callback) {
      callbacks.push(callback);
    });
    heldFrames.clear();
    for (var i = 0; i < callbacks.length; i++) nativeRaf(callbacks[i]);
  }

  function pause() {
    hostPaused = true;
    applyPaused();
  }

  function resume() {
    hostPaused = false;
    applyPaused();
  }

  // An occluded or minimised window keeps this document alive but paints nothing the
  // user can see; upstream has no idea, so the loop stops here until it is visible.
  // `document` is not a browser document in the harness, so the listener is optional.
  if (typeof document.addEventListener === "function") {
    document.addEventListener("visibilitychange", function () {
      hiddenPaused = document.visibilityState === "hidden";
      applyPaused();
    });
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

    if (data.type === "craft:act") {
      void act(data);
      return;
    }

    if (data.type === "craft:wait") {
      void waitMessage(data);
      return;
    }

    if (data.type === "craft:pointer") {
      void pointer(data);
      return;
    }

    if (data.type === "craft:key") {
      void keys(data);
      return;
    }

    if (data.type === "craft:capture") {
      void capture(data);
      return;
    }

    if (data.type === "craft:probe") {
      void probeMessage(data);
      return;
    }
  });

  // ------------------------------------------------------- driving the editor
  //
  // The page is a canvas: there is no DOM to click, only coordinates and keys the
  // app's own event listeners understand. Everything below dispatches what a real
  // pointer or keyboard would, on the canvas, after focusing it — upstream reads
  // `offsetX/offsetY` and `event.key`, it does not care that the event is synthetic.
  //
  // One operation is not one event. A press released in the same tick reads as a tap
  // to a toolbar and as nothing at all to a slider, and a drag that jumps from A to B
  // without the moves in between is not a drag. So a click here is down → a pause →
  // up → click, a drag interpolates its path, and every step ends on a drawn frame
  // before the next one starts. That pacing is what makes the work visible to the
  // person looking at the panel: the pointer travels, the tool opens, the value lands.
  //
  // Nothing here is app-specific, and nothing claims success: the only proof that a
  // step landed is the next capture.

  var HUD_ID = "astravia-craft-hud";
  var hudTimer = 0;

  function hudNode() {
    var node = document.getElementById(HUD_ID);
    if (node) return node;
    node = document.createElement("div");
    node.id = HUD_ID;
    node.setAttribute("aria-live", "polite");
    node.style.cssText =
      "position:fixed;left:12px;top:12px;z-index:2147483647;" +
      "max-width:min(62vw,460px);padding:6px 11px;border-radius:999px;" +
      "font:500 12px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;" +
      "color:#f4f4f5;background:rgba(20,20,22,.86);border:1px solid rgba(255,255,255,.14);" +
      "box-shadow:0 8px 24px rgba(0,0,0,.34);pointer-events:none;opacity:0;" +
      "transition:opacity .16s ease;white-space:nowrap;overflow:hidden;" +
      "text-overflow:ellipsis;backdrop-filter:blur(6px)";
    document.body.appendChild(node);
    return node;
  }

  /** The line a person reads while the agent works: which step of how many, doing what. */
  function hud(text, sticky) {
    var node = hudNode();
    node.textContent = text || "";
    node.style.opacity = text ? "1" : "0";
    if (hudTimer) clearTimeout(hudTimer);
    if (!sticky) {
      hudTimer = setTimeout(function () {
        node.style.opacity = "0";
      }, 1600);
    }
  }

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  /** Two native frames: the app has drawn the result of what we just dispatched. */
  function frames(count) {
    var left = Math.max(1, count || 2);
    return new Promise(function (resolve) {
      (function tick() {
        if (left-- <= 0) return resolve();
        nativeRaf(function () {
          nativeRaf(tick);
        });
      })();
    });
  }

  function canvasNode() {
    var canvas = document.querySelector("canvas");
    return canvas && canvas.width > 0 ? canvas : null;
  }

  function focusCanvas(canvas) {
    try {
      canvas.focus();
    } catch (error) {
      /* focus is best-effort */
    }
  }

  /** Fractions of the canvas, not pixels: the panel may be 900 or 2400 px wide. */
  function pointAt(canvas, fx, fy) {
    var box = canvas.getBoundingClientRect();
    var x = box.left + Math.min(1, Math.max(0, Number(fx) || 0)) * box.width;
    var y = box.top + Math.min(1, Math.max(0, Number(fy) || 0)) * box.height;
    return { x: x, y: y, width: box.width, height: box.height };
  }

  function fire(canvas, type, point, button, buttons) {
    var init = {
      clientX: point.x,
      clientY: point.y,
      screenX: point.x,
      screenY: point.y,
      bubbles: true,
      cancelable: true,
      button: button || 0,
      buttons: buttons || 0,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
    };
    var event;
    try {
      event = new PointerEvent(type, init);
    } catch (error) {
      event = new MouseEvent(type, init);
    }
    canvas.dispatchEvent(event);
  }

  function fireWheel(canvas, point, dx, dy) {
    var init = {
      clientX: point.x,
      clientY: point.y,
      deltaX: dx || 0,
      deltaY: dy || 0,
      deltaMode: 0,
      bubbles: true,
      cancelable: true,
    };
    canvas.dispatchEvent(new WheelEvent("wheel", init));
  }

  async function clickAt(canvas, fx, fy, options) {
    var opts = options || {};
    var point = pointAt(canvas, fx, fy);
    if (!point.width || !point.height) throw new Error("canvas-not-laid-out");
    focusCanvas(canvas);
    var button = typeof opts.button === "number" ? opts.button : 0;
    fire(canvas, "pointermove", point, button, 0);
    await frames(1);
    fire(canvas, "pointerdown", point, button, 1);
    fire(canvas, "mousedown", point, button, 1);
    await sleep(typeof opts.holdMs === "number" ? opts.holdMs : 45);
    fire(canvas, "pointerup", point, button, 0);
    fire(canvas, "mouseup", point, button, 0);
    fire(canvas, "click", point, button, 0);
    if (opts.double) {
      await sleep(45);
      fire(canvas, "pointerdown", point, button, 1);
      fire(canvas, "mousedown", point, button, 1);
      await sleep(35);
      fire(canvas, "pointerup", point, button, 0);
      fire(canvas, "mouseup", point, button, 0);
      fire(canvas, "click", point, button, 0);
      fire(canvas, "dblclick", point, button, 0);
    }
    await frames(2);
    return { x: fx, y: fy };
  }

  async function dragPath(canvas, from, to, count) {
    var start = pointAt(canvas, from.x, from.y);
    var end = pointAt(canvas, to.x, to.y);
    if (!start.width || !start.height) throw new Error("canvas-not-laid-out");
    focusCanvas(canvas);
    var moves = Math.min(24, Math.max(3, count || 8));
    fire(canvas, "pointermove", start, 0, 0);
    fire(canvas, "pointerdown", start, 0, 1);
    fire(canvas, "mousedown", start, 0, 1);
    await frames(1);
    for (var i = 1; i <= moves; i++) {
      var t = i / moves;
      var point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t,
      };
      fire(canvas, "pointermove", point, 0, 1);
      fire(canvas, "mousemove", point, 0, 1);
      await frames(1);
    }
    fire(canvas, "pointerup", end, 0, 0);
    fire(canvas, "mouseup", end, 0, 0);
    fire(canvas, "click", end, 0, 0);
    await frames(2);
    return { from: from, to: to, moves: moves };
  }

  async function typeText(canvas, text) {
    focusCanvas(canvas);
    var value = typeof text === "string" ? text : "";
    for (var i = 0; i < value.length; i++) {
      var ch = value.charAt(i);
      var init = { key: ch, bubbles: true, cancelable: true };
      canvas.dispatchEvent(new KeyboardEvent("keydown", init));
      canvas.dispatchEvent(new KeyboardEvent("keypress", init));
      canvas.dispatchEvent(new KeyboardEvent("keyup", init));
      if (i % 4 === 3) await frames(1);
    }
    await frames(1);
    return value.length;
  }

  async function pressCombo(canvas, key) {
    focusCanvas(canvas);
    // Modifier chords arrive as "ctrl+s"; plain keys as "Enter" or a single letter.
    var parts = typeof key === "string" && key ? key.split("+") : [];
    var name = parts.length > 1 ? parts[parts.length - 1] : key;
    var modifiers = parts.length > 1 ? parts.slice(0, -1) : [];
    function emit(type, value, withModifiers) {
      canvas.dispatchEvent(
        new KeyboardEvent(type, {
          key: value,
          bubbles: true,
          cancelable: true,
          ctrlKey: withModifiers.indexOf("ctrl") >= 0,
          shiftKey: withModifiers.indexOf("shift") >= 0,
          altKey: withModifiers.indexOf("alt") >= 0,
          metaKey: withModifiers.indexOf("meta") >= 0,
        }),
      );
    }
    if (name) {
      for (var m = 0; m < modifiers.length; m++) emit("keydown", modifiers[m], []);
      emit("keydown", name, modifiers);
      await sleep(30);
      emit("keyup", name, modifiers);
      for (var u = modifiers.length - 1; u >= 0; u--) emit("keyup", modifiers[u], []);
    }
    await frames(2);
    return name || null;
  }

  /** The app's own boot signal: the shell removes `#<app>_loading` once it is up. */
  function loaderGone() {
    return loaderText() === null;
  }

  async function waitReady(timeoutMs) {
    var deadline = Date.now() + (typeof timeoutMs === "number" ? timeoutMs : 60000);
    while (Date.now() < deadline) {
      if (loaderGone()) {
        await frames(2);
        return true;
      }
      await sleep(120);
    }
    throw new Error("wait-ready-timeout");
  }

  /**
   * PNG of whatever the app is showing, optionally one region of it, optionally
   * enlarged. The enlargement is what makes a toolbar readable to a model: 8× zoom
   * on the top strip turns 16-px icons into something a screenshot can be understood
   * from, and it is cheaper than shipping a 4K full frame.
   */
  function pngBytes(canvas, region, scale) {
    var factor = typeof scale === "number" && scale > 0 ? Math.min(4, scale) : 1;
    var source = canvas;
    if (region && typeof region === "object") {
      var width = canvas.width;
      var height = canvas.height;
      var rx = Math.min(1, Math.max(0, Number(region.x) || 0));
      var ry = Math.min(1, Math.max(0, Number(region.y) || 0));
      var rw = Math.min(1 - rx, Math.max(0.02, Number(region.w) || 1));
      var rh = Math.min(1 - ry, Math.max(0.02, Number(region.h) || 1));
      var sx = Math.round(rx * width);
      var sy = Math.round(ry * height);
      var sw = Math.max(1, Math.round(rw * width));
      var sh = Math.max(1, Math.round(rh * height));
      var out = document.createElement("canvas");
      out.width = Math.min(4096, Math.round(sw * factor));
      out.height = Math.min(4096, Math.round(sh * factor));
      var context = out.getContext("2d");
      if (!context) throw new Error("capture-no-2d-context");
      context.imageSmoothingEnabled = factor > 1;
      context.drawImage(canvas, sx, sy, sw, sh, 0, 0, out.width, out.height);
      source = out;
    } else if (factor !== 1) {
      var scaled = document.createElement("canvas");
      scaled.width = Math.min(4096, Math.round(canvas.width * factor));
      scaled.height = Math.min(4096, Math.round(canvas.height * factor));
      var scaledContext = scaled.getContext("2d");
      if (!scaledContext) throw new Error("capture-no-2d-context");
      scaledContext.imageSmoothingEnabled = factor > 1;
      scaledContext.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, scaled.width, scaled.height);
      source = scaled;
    }
    var url = source.toDataURL("image/png");
    var comma = url.indexOf(",");
    if (url.slice(0, 5) !== "data:" || comma < 0) throw new Error("capture-empty");
    var binary = atob(url.slice(comma + 1));
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes: bytes, width: source.width, height: source.height };
  }

  // ------------------------------------------------------------- text probe
  //
  // A plugin tool cannot hand a PNG to the model: the host turns every tool result
  // into text. So the page describes itself in text instead — a coarse map of the
  // canvas, one letter per cell, plus the mean colour of whatever region was asked
  // for. That is enough to tell a photo from an empty canvas, an open tool rail from
  // a closed one, and a background that turned blue from one that did not, which is
  // exactly the feedback a blind automation loop needs.

  var MAP_COLUMNS = 32;
  var MAP_ROWS = 18;

  /** One letter per bucket: hue letter, lowercase when dark. */
  function classify(r, g, b) {
    var max = Math.max(r, g, b) / 255;
    var min = Math.min(r, g, b) / 255;
    var v = max;
    var s = max === 0 ? 0 : (max - min) / max;
    if (v < 0.14) return "K";
    if (s < 0.12) return v > 0.84 ? "W" : v > 0.45 ? "w" : "k";
    var d = max - min;
    var h;
    if (max === r / 255) h = ((g - b) / 255 / d + 6) % 6;
    else if (max === g / 255) h = (b - r) / 255 / d + 2;
    else h = (r - g) / 255 / d + 4;
    h *= 60;
    var letter;
    if (h < 16 || h >= 345) letter = "R";
    else if (h < 45) letter = "O";
    else if (h < 70) letter = "Y";
    else if (h < 165) letter = "G";
    else if (h < 200) letter = "C";
    else if (h < 265) letter = "B";
    else if (h < 320) letter = "P";
    else letter = "M";
    return v > 0.5 ? letter : letter.toLowerCase();
  }

  function probeRegion(canvas, region) {
    var rx = region ? Math.min(1, Math.max(0, Number(region.x) || 0)) : 0;
    var ry = region ? Math.min(1, Math.max(0, Number(region.y) || 0)) : 0;
    var rw = region ? Math.min(1 - rx, Math.max(0.02, Number(region.w) || 1)) : 1;
    var rh = region ? Math.min(1 - ry, Math.max(0.02, Number(region.h) || 1)) : 1;
    return {
      x: Math.round(rx * canvas.width),
      y: Math.round(ry * canvas.height),
      w: Math.max(1, Math.round(rw * canvas.width)),
      h: Math.max(1, Math.round(rh * canvas.height)),
    };
  }

  /**
   * Text map + colour statistics for one region of the canvas. `cells` is read
   * row by row; `mean` is the average colour, which is what turns "make the
   * background blue" into something with a before and an after.
   */
  function probe(canvas, region, columns, rows) {
    var cols = Math.min(64, Math.max(4, Math.round(columns || MAP_COLUMNS)));
    var height = Math.min(36, Math.max(2, Math.round(rows || MAP_ROWS)));
    var box = probeRegion(canvas, region);
    var scratch = document.createElement("canvas");
    scratch.width = cols;
    scratch.height = height;
    var context = scratch.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("probe-no-2d-context");
    context.drawImage(canvas, box.x, box.y, box.w, box.h, 0, 0, cols, height);
    var data = context.getImageData(0, 0, cols, height).data;
    var lines = [];
    var totalR = 0;
    var totalG = 0;
    var totalB = 0;
    var count = 0;
    var darkest = 255;
    var lightest = 0;
    for (var y = 0; y < height; y++) {
      var line = "";
      for (var x = 0; x < cols; x++) {
        var offset = (y * cols + x) * 4;
        var r = data[offset];
        var g = data[offset + 1];
        var b = data[offset + 2];
        totalR += r;
        totalG += g;
        totalB += b;
        count += 1;
        var luma = (r * 299 + g * 587 + b * 114) / 1000;
        if (luma < darkest) darkest = luma;
        if (luma > lightest) lightest = luma;
        line += classify(r, g, b);
      }
      lines.push(line);
    }
    var hex = function (value) {
      var text = Math.round(value).toString(16);
      return text.length < 2 ? "0" + text : text;
    };
    return {
      region: box,
      cols: cols,
      rows: height,
      cells: lines.join("\n"),
      mean: "#" + hex(totalR / count) + hex(totalG / count) + hex(totalB / count),
      meanRgb: [Math.round(totalR / count), Math.round(totalG / count), Math.round(totalB / count)],
      contrast: Math.round((lightest - darkest) / 255 * 100) / 100,
      width: canvas.width,
      height: canvas.height,
    };
  }

  async function probeMessage(data) {
    var canvas = canvasNode();
    if (!canvas) {
      reply(data.id, { ok: false, error: "no-canvas" });
      return;
    }
    try {
      // One drawn frame first: a read straight after a step could catch the old one.
      await frames(1);
      var result = probe(canvas, data.region, data.columns, data.rows);
      reply(data.id, { ok: true, probe: result });
    } catch (error) {
      reply(data.id, { ok: false, error: String((error && error.message) || error) });
    }
  }

  // ----------------------------------------------------------------- batches
  //
  // One tool call, one ordered list of steps, executed here where the app is. The
  // alternative — a round trip per click — is what made automation feel blind: the
  // agent could not pace a press, could not drag, and paid a second of latency
  // between two events a hand does 40 ms apart.

  async function act(data) {
    var steps = Array.isArray(data.steps) ? data.steps : [];
    var hudStrings = data.hud && typeof data.hud === "object" ? data.hud : {};
    var prefix = String(hudStrings.prefix || "Automating");
    var doneText = String(hudStrings.done || "Done");
    var stopOnError = data.stopOnError !== false;
    var canvas = canvasNode();
    if (!canvas) {
      reply(data.id, { ok: false, error: "no-canvas" });
      return;
    }
    if (!steps.length) {
      reply(data.id, { ok: false, error: "no-steps" });
      return;
    }
    resume(); // a hidden editor queues frames that never run
    var started = Date.now();
    var results = [];
    var captures = [];
    for (var index = 0; index < steps.length; index++) {
      var step = steps[index] && typeof steps[index] === "object" ? steps[index] : {};
      var op = String(step.op || step.type || "");
      var label = String(step.label || op);
      hud(prefix + " " + (index + 1) + "/" + steps.length + " · " + label, true);
      post({ type: "craft:progress", id: data.id, index: index, total: steps.length, label: label });
      try {
        var outcome = null;
        if (op === "click") {
          outcome = await clickAt(canvas, step.x, step.y, step);
        } else if (op === "move") {
          focusCanvas(canvas);
          fire(canvas, "pointermove", pointAt(canvas, step.x, step.y), 0, 0);
          await frames(1);
          outcome = { x: step.x, y: step.y };
        } else if (op === "drag") {
          outcome = await dragPath(canvas, step.from || {}, step.to || {}, step.moves);
        } else if (op === "scroll") {
          focusCanvas(canvas);
          fireWheel(canvas, pointAt(canvas, step.x, step.y), step.dx, step.dy);
          await frames(2);
          outcome = { dx: step.dx || 0, dy: step.dy || 0 };
        } else if (op === "type") {
          outcome = { typed: await typeText(canvas, step.text) };
        } else if (op === "key") {
          outcome = { key: await pressCombo(canvas, step.key) };
        } else if (op === "wait") {
          await sleep(typeof step.ms === "number" ? step.ms : 300);
          outcome = { ms: typeof step.ms === "number" ? step.ms : 300 };
        } else if (op === "ready") {
          await waitReady(step.timeoutMs);
          outcome = { ready: true };
        } else if (op === "capture") {
          await frames(2);
          var shot = pngBytes(canvas, step.region, step.scale);
          var shotName = String(step.name || "step-" + (index + 1) + ".png");
          captures.push({
            index: index,
            name: shotName,
            width: shot.width,
            height: shot.height,
            bytes: shot.bytes.buffer,
          });
          outcome = { name: shotName, width: shot.width, height: shot.height };
        } else if (op === "label") {
          outcome = { label: label };
        } else {
          throw new Error("unknown-step:" + op);
        }
        results.push({ index: index, op: op, label: label, ok: true, outcome: outcome });
      } catch (error) {
        results.push({
          index: index,
          op: op,
          label: label,
          ok: false,
          error: String((error && error.message) || error),
        });
        if (stopOnError) {
          for (var rest = index + 1; rest < steps.length; rest++) {
            results.push({ index: rest, op: String((steps[rest] || {}).op || ""), label: String((steps[rest] || {}).label || ""), ok: false, error: "skipped" });
          }
          break;
        }
      }
    }
    hud(doneText, false);
    var transfer = [];
    for (var c = 0; c < captures.length; c++) transfer.push(captures[c].bytes);
    reply(
      data.id,
      {
        ok: results.every(function (item) { return item.ok; }),
        steps: results,
        captures: captures,
        elapsedMs: Date.now() - started,
      },
      transfer,
    );
  }

  async function waitMessage(data) {
    try {
      if (data.ready) await waitReady(data.timeoutMs);
      else await sleep(typeof data.ms === "number" ? data.ms : 300);
      var canvas = canvasNode();
      reply(data.id, { ok: true, ready: loaderGone(), canvas: canvas ? { width: canvas.width, height: canvas.height } : null });
    } catch (error) {
      reply(data.id, { ok: false, error: String((error && error.message) || error) });
    }
  }

  // ------------------------------------------------- compatibility gestures

  async function pointer(data) {
    var canvas = canvasNode();
    if (!canvas) {
      reply(data.id, { ok: false, error: "no-canvas" });
      return;
    }
    resume();
    try {
      await clickAt(canvas, typeof data.x === "number" ? data.x : 0.5, typeof data.y === "number" ? data.y : 0.5, {
        double: data.double === true,
        button: typeof data.button === "number" ? data.button : 0,
      });
      reply(data.id, { ok: true, at: { x: data.x, y: data.y } });
    } catch (error) {
      reply(data.id, { ok: false, error: String((error && error.message) || error) });
    }
  }

  async function keys(data) {
    var canvas = canvasNode();
    if (!canvas) {
      reply(data.id, { ok: false, error: "no-canvas" });
      return;
    }
    resume();
    try {
      var typed = await typeText(canvas, data.text);
      var pressed = data.key ? await pressCombo(canvas, data.key) : null;
      reply(data.id, { ok: true, typed: typed, key: pressed });
    } catch (error) {
      reply(data.id, { ok: false, error: String((error && error.message) || error) });
    }
  }

  async function capture(data) {
    var canvas = canvasNode();
    if (!canvas) {
      reply(data.id, { ok: false, error: "no-canvas" });
      return;
    }
    try {
      if (data.region || data.scale) await frames(2);
      var shot = pngBytes(canvas, data.region, data.scale);
      reply(
        data.id,
        {
          ok: true,
          name: data.name || CAPTURE_NAME,
          mime: "image/png",
          width: shot.width,
          height: shot.height,
          bytes: shot.bytes.buffer,
        },
        [shot.bytes.buffer],
      );
    } catch (error) {
      reply(data.id, { ok: false, error: String((error && error.message) || error) });
    }
  }

  // ------------------------------------------------------------- boot watch

  // "ready" must mean "the editor started", not "this script ran". Every web shell
  // here removes its `#<app>_loading` element on success and rewrites it with a
  // failure sentence otherwise, so that element is the only signal available; a
  // shell without one is judged by its first non-empty canvas.
  // Sixty seconds was the old ceiling, and it was wrong: a cold start of a 15–40 MB wasm
  // build legitimately takes longer, and calling that "failed" walked the tab down the
  // WebGPU → WebGL2 → software ladder and ended on "did not start" — three reloads and
  // several minutes of nothing, for a boot that was merely slow. Report slow as slow and
  // keep watching; only a real failure sentence, or five minutes, ends the watch.
  var SLOW_MS = 25000;
  var BOOT_LIMIT_MS = 300000;

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
    var slowSent = false;
    var done = false;
    var timer = setInterval(function () {
      if (done) return clearInterval(timer);
      // A paused document makes no progress and has no one watching it; four posts a
      // second to a hidden parent is pure battery. The clock is read on the next tick.
      if (paused) return undefined;
      var text = loaderText();
      if (text === null) {
        done = true;
        clearInterval(timer);
        post({ type: "craft:ready", backend: backend, href: location.href, secure: !!window.isSecureContext });
        return;
      }
      var waitedMs = Date.now() - started;
      var failed = /failed to start|failed to load|device lost/i.test(text);
      // Heartbeat: upstream's own loading line is the only live signal the page gives us.
      post({ type: "craft:boot", loader: text, slow: slowSent, waitedMs: waitedMs });
      if (failed) {
        done = true;
        clearInterval(timer);
        post({ type: "craft:error", backend: backend, message: text || "failed to start" });
        return;
      }
      if (!slowSent && waitedMs > SLOW_MS) slowSent = true;
      if (waitedMs > BOOT_LIMIT_MS) {
        done = true;
        clearInterval(timer);
        post({ type: "craft:error", backend: backend, message: "boot-timeout" });
      }
    }, 250);
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

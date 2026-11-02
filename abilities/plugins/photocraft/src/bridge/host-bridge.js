/*
 * Photocraft host bridge — the only script we add to the upstream page.
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
 *   save  - `web.rs::download()` builds `<a download href="blob:…">` and clicks it.
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
  var nativeInputClick = HTMLInputElement.prototype.click;
  var nativeAnchorClick = HTMLAnchorElement.prototype.click;
  var FALLBACK_MS = 60000;

  function post(message, transfer) {
    try {
      parentWindow.postMessage(message, "*", transfer || []);
    } catch (error) {
      /* a dead parent is not our problem; upstream keeps working */
    }
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

  // ------------------------------------------------------------- open seam

  HTMLInputElement.prototype.click = function () {
    var input = this;
    if (!input || input.type !== "file") return nativeInputClick.apply(input, arguments);

    var id = "open-" + ++seq;
    waiting.set(id, input);
    post({ type: "pc:pickOpen", id: id, accept: input.accept || "", multiple: !!input.multiple });

    // If the host never answers (tab hidden, plugin reloading), fall back to the
    // browser's own picker instead of leaving the editor stuck forever.
    setTimeout(function () {
      if (waiting.delete(id)) nativeInputClick.call(input);
    }, FALLBACK_MS);
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
    var name = anchor.getAttribute("download") || "photocraft-export";
    fetch(href)
      .then(function (response) {
        return response.arrayBuffer();
      })
      .then(function (bytes) {
        post(
          {
            type: "pc:save",
            id: id,
            name: name,
            mime: anchor.getAttribute("type") || "",
            bytes: bytes,
          },
          [bytes],
        );
      })
      .catch(function (error) {
        post({ type: "pc:error", id: id, message: String((error && error.message) || error) });
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

    if (data.type === "pc:open") {
      var input = waiting.get(data.id);
      if (!input) return;
      waiting.delete(data.id);
      if (data.bytes) deliver(input, data);
      else cancel(input);
      return;
    }

    // The host has no single file selected: leave the choice to the browser.
    if (data.type === "pc:fallback") {
      var fallback = waiting.get(data.id);
      if (!fallback) return;
      waiting.delete(data.id);
      nativeInputClick.call(fallback);
      return;
    }

    if (data.type === "pc:cancel") {
      var target = waiting.get(data.id);
      if (!target) return;
      waiting.delete(data.id);
      cancel(target);
    }
  });

  // ------------------------------------------------------------- boot watch

  // "ready" must mean "the editor started", not "this script ran". Upstream
  // removes `#photocraft_loading` on success and rewrites it with a failure
  // sentence otherwise (`web.rs`), so that element is the only signal available.
  var BOOT_MS = 30000;

  function loaderText() {
    var el = document.getElementById("photocraft_loading");
    return el ? (el.textContent || "") : null;
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
        post({ type: "pc:ready", backend: backend, href: location.href, secure: !!window.isSecureContext });
        return;
      }
      var failed = /failed to start/i.test(text);
      var waited = Date.now() - started > BOOT_MS;
      if (failed || waited) {
        done = true;
        clearInterval(timer);
        post({
          type: "pc:error",
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
    post({ type: "pc:error", message: String((event && event.message) || "script-error") });
  });
  window.addEventListener("unhandledrejection", function (event) {
    post({ type: "pc:error", message: String((event && event.reason) || "unhandled-rejection") });
  });
})();

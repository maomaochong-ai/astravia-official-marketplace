#!/usr/bin/env node
// Embed probe for the Photocraft tab (see docs/adr/photocraft/0001..0006).
//
// Stages a self-contained page under $HOME, serves a report sink on loopback, and prints
// PASS/FAIL once the page reports. It answers the four questions the ADRs leave open:
//
//   1. is `astravia-file://` a secure context (WebGPU / wasm / clipboard prerequisites)
//   2. does WebGPU / WebGL2 actually come up inside that frame
//   3. do the two DOM seams still exist (rfd `<input type=file>`, `<a download>`)
//   4. how big can a single postMessage payload get before structured clone chokes
//
// Usage:
//   node probe-embed.mjs                 # stage into ~/photocraft-embed-probe and wait
//   node probe-embed.mjs --dir <path>    # stage somewhere else
//   node probe-embed.mjs --port 7731     # fix the report port
//   node probe-embed.mjs --wasm <f>      # also stream-compile a real .wasm (19.7 MB payload)
//   node probe-embed.mjs --timeout 600   # seconds to wait for the page (default 300)
//
// Nothing is installed, nothing is downloaded, no network egress beyond loopback.

import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const TINY_WASM = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
// Sizes probed through structured clone; 64 MiB is the documented worst case for a PSD.
const POST_SIZES = [1, 8, 32, 64];

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
}
const has = (name) => process.argv.includes(`--${name}`);

const dir = resolve(arg("dir", join(homedir(), "photocraft-embed-probe")));
const port = Number(arg("port", 0));
const timeoutSec = Number(arg("timeout", 300));
const wasmPath = arg("wasm", null);

const page = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>photocraft embed probe</title>
<style>
  body{margin:0;padding:2rem;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;background:#111;color:#ddd}
  h1{font-size:15px;margin:0 0 1rem}
  li{margin:.15rem 0} .ok{color:#5dd39e} .no{color:#ef6b6b} .skip{color:#888}
  canvas{width:180px;height:48px;border:1px solid #333;border-radius:4px}
</style></head><body>
<h1>photocraft embed probe</h1>
<ul id="out"></ul><canvas id="probe_canvas" width="180" height="48"></canvas>
<script src="./probe.js"></script>
</body></html>`;

const probe = String.raw`
const SIZES = __SIZES__;
const SINK = "__SINK__";
const rows = [];
const out = document.getElementById("out");
function report(name, ok, detail) {
  rows.push({ name, ok, detail: String(detail ?? "") });
  const li = document.createElement("li");
  li.className = ok === true ? "ok" : ok === false ? "no" : "skip";
  li.textContent = (ok === true ? "PASS " : ok === false ? "FAIL " : "SKIP ") + name + (detail ? "  " + detail : "");
  out.appendChild(li);
}
const send = (body) =>
  fetch(SINK + "/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .catch(() => fetch(SINK + "/report?beacon=1", { method: "POST", body: JSON.stringify(body) }).catch(() => {}));

addEventListener("error", (e) => send({ name: "window.onerror", ok: false, detail: e.message }));
addEventListener("unhandledrejection", (e) => send({ name: "unhandledrejection", ok: false, detail: String(e.reason) }));

// --- question 1: context -------------------------------------------------------------
report("secure context", isSecureContext, location.protocol + "  crossOriginIsolated=" + crossOriginIsolated);
report("origin", null, "location.origin=" + (location.origin === "null" ? "null (opaque)" : location.origin));
report("sandboxed", null, "frames.length=" + frames.length + "  top==self=" + (top === self));

// --- question 2: wasm + gpu ----------------------------------------------------------
(async () => {
  const t0 = performance.now();
  try {
    const bytes = await (await fetch("./probe.wasm")).arrayBuffer();
    const mod = await WebAssembly.instantiate(bytes, {});
    report("wasm bytes", mod.instance instanceof WebAssembly.Instance, bytes.byteLength + " B in " + (performance.now() - t0).toFixed(1) + " ms");
  } catch (e) { report("wasm bytes", false, e.message); }

  try {
    const t1 = performance.now();
    const mod = await WebAssembly.compileStreaming(fetch("./probe.wasm"));
    report("wasm compileStreaming", mod instanceof WebAssembly.Module, (performance.now() - t1).toFixed(1) + " ms  (needs application/wasm + MIME faith)");
  } catch (e) { report("wasm compileStreaming", false, e.message); }

  const big = document.documentElement.dataset.bigwasm;
  if (big) {
    try {
      const t2 = performance.now();
      const res = await fetch("./big.wasm");
      const total = res.headers.get("content-length");
      await res.arrayBuffer();
      report("payload fetch", true, (total ?? "?") + " B in " + (performance.now() - t2).toFixed(0) + " ms");
    } catch (e) { report("payload fetch", false, e.message); }
  }

  let backend = "none";
  if (navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (adapter) {
        const info = adapter.info || {};
        backend = "gpu";
        report("webgpu", true, [info.vendor, info.architecture, info.device, info.description].filter(Boolean).join(" ") || "adapter ok");
      } else report("webgpu", false, "navigator.gpu present, requestAdapter() returned null");
    } catch (e) { report("webgpu", false, e.message); }
  } else report("webgpu", false, "navigator.gpu undefined");

  const c = document.getElementById("probe_canvas");
  const gl2 = c.getContext("webgl2");
  if (gl2) { const d = gl2.getParameter(gl2.VERSION); report("webgl2", true, d); if (backend === "none") backend = "gl"; }
  else report("webgl2", false, "no WebGL2RenderingContext");

  report("backend verdict", backend !== "none", backend === "gpu" ? "use default URL" : backend === "gl" ? "use ?webgl" : "use ?cpu (software)");

  // --- question 3: seams -------------------------------------------------------------
  // 3a. rfd's wasm backend builds <input type=file> and resolves on change with input.files.
  try {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/png";
    const nativeClick = HTMLInputElement.prototype.click;
    let intercepted = 0;
    HTMLInputElement.prototype.click = function () {
      if (this.type === "file") { intercepted++; return; }
      return nativeClick.apply(this, arguments);
    };
    input.click();
    HTMLInputElement.prototype.click = nativeClick;
    report("seam: input.click", intercepted === 1, "intercepted=" + intercepted);

    const got = await new Promise((res) => {
      input.addEventListener("change", () => res(input.files && input.files[0]));
      const dt = new DataTransfer();
      dt.items.add(new File([new Uint8Array([1, 2, 3, 4])], "probe-open.png", { type: "image/png" }));
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      setTimeout(() => res(null), 1500);
    });
    report("seam: input.files", !!got && got.name === "probe-open.png", got ? got.name + " " + got.size + " B" : "change never resolved");
  } catch (e) { report("seam: input.files", false, e.message); }

  // 3b. web.rs download() = blob URL + <a download> + click().
  try {
    const blob = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 9, 9, 9])], { type: "image/png" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "probe-export.png";
    const nativeAnchorClick = HTMLAnchorElement.prototype.click;
    let caught = null;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download && this.href.startsWith("blob:")) {
        caught = { name: this.download, href: this.href };
        return;
      }
      return nativeAnchorClick.apply(this, arguments);
    };
    a.click();
    HTMLAnchorElement.prototype.click = nativeAnchorClick;
    if (!caught) report("seam: anchor.click", false, "not intercepted");
    else {
      const buf = await (await fetch(caught.href)).arrayBuffer();
      report("seam: anchor.click", buf.byteLength === 7, caught.name + " " + buf.byteLength + " B recovered");
    }
    URL.revokeObjectURL(url);
  } catch (e) { report("seam: anchor.click", false, e.message); }

  // --- a11y tree (ADR 0003 §5) -------------------------------------------------------
  const ak = document.querySelectorAll("[data-accesskit-id], [class*=accesskit], [id^=accesskit]");
  report("accesskit nodes", ak.length > 0 ? true : null, ak.length + " node(s)" + (ak.length ? "  <- a11y state may be readable" : "  <- no tree, ADR 0003 stands"));

  // --- question 4: postMessage / loopback ceilings -----------------------------------
  for (const mb of SIZES) {
    const buf = new Uint8Array(mb * 1024 * 1024);
    buf[0] = 7; buf[buf.length - 1] = 9;
    const t = performance.now();
    const ok = await new Promise((res) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = (e) => res(e.data.byteLength === buf.byteLength && new Uint8Array(e.data)[0] === 7);
      try { ch.port2.postMessage(buf.buffer, [buf.buffer]); } catch (err) { res("throw: " + err.message); }
      setTimeout(() => res(false), 20000);
    });
    const ms = performance.now() - t;
    report("postMessage " + mb + " MB", ok === true, typeof ok === "string" ? ok : ms.toFixed(0) + " ms");
  }
  for (const mb of [1, 8, 32]) {
    const body = new Uint8Array(mb * 1024 * 1024);
    const t = performance.now();
    try {
      await fetch(SINK + "/sink?size=" + mb + "MB", { method: "POST", body });
      report("loopback POST " + mb + " MB", true, (performance.now() - t).toFixed(0) + " ms");
    } catch (e) { report("loopback POST " + mb + " MB", false, e.message); }
  }

  await send({ done: true, rows, href: location.href, ua: navigator.userAgent });
})();
`;

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".wasm": "application/wasm", ".json": "application/json" };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, "http://127.0.0.1");
  res.setHeader("access-control-allow-origin", "*");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  if (url.pathname === "/report") {
    let body = "";
    req.on("data", (c) => (body += c));
    req.on("end", () => {
      res.writeHead(204).end();
      let msg;
      try { msg = JSON.parse(body); } catch { return; }
      if (msg.done) finish(msg);
      else console.log(`  ${msg.ok === true ? "PASS" : msg.ok === false ? "FAIL" : "SKIP"}  ${msg.name}${msg.detail ? "  " + msg.detail : ""}`);
    });
    return;
  }
  if (url.pathname === "/sink") { req.resume(); req.on("end", () => res.writeHead(204).end()); return; }

  // Static files from the staged dir, so the http:// entry point exercises the same probe.
  const rel = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const target = resolve(dir, "." + rel);
  if (target !== dir && !target.startsWith(dir + "/")) { res.writeHead(403).end(); return; }
  try {
    const bytes = await readFile(target);
    res.writeHead(200, {
      "content-type": MIME[target.slice(target.lastIndexOf("."))] ?? "application/octet-stream",
      "content-length": bytes.length,
    });
    res.end(bytes);
  } catch {
    res.writeHead(404).end();
  }
});

let finished = false;
function finish(msg) {
  if (finished) return;
  finished = true;
  const rows = msg.rows || [];
  const width = Math.max(...rows.map((r) => r.name.length), 10);
  console.log("\n=== embed probe report ===");
  for (const r of rows) {
    const tag = r.ok === true ? "PASS" : r.ok === false ? "FAIL" : "SKIP";
    console.log(`${tag}  ${r.name.padEnd(width)}  ${r.detail}`);
  }
  const fails = rows.filter((r) => r.ok === false);
  console.log(`\n${rows.length - fails.length}/${rows.length} passed` + (fails.length ? `, ${fails.length} failed` : ""));
  console.log("\nFill these ADR fields from the table above:");
  console.log("  0001 §5.1  webgpu / webgl2 / backend verdict  -> 是否需要在 Tab Shell 显示 GL/CPU 徽标");
  console.log("  0002 §5.1  seam: input.files                  -> rfd 注入是否成立（false 则 Bridge 只能 Downgrade）");
  console.log("  0002 §5.2  seam: anchor.click                 -> 保存是否可拦截");
  console.log("  0002 §5.3  postMessage N MB / loopback POST   -> Save 的字节上限与 Downgrade 阈值");
  console.log("  0003 §5    accesskit nodes                    -> 是否已有 a11y 树可读");
  server.close(() => process.exit(fails.length ? 1 : 0));
}

server.listen(port, "127.0.0.1", async () => {
  // The sink URL must be absolute: under astravia-file:// a relative /report would resolve
  // against the custom scheme, not loopback.
  const actual = server.address().port;
  const sink = `http://127.0.0.1:${actual}`;

  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "index.html"), wasmPath ? page.replace('<html lang="en">', '<html lang="en" data-bigwasm="1">') : page);
  await writeFile(
    join(dir, "probe.js"),
    probe.replace("__SIZES__", JSON.stringify(POST_SIZES)).replace("__SINK__", sink),
  );
  await writeFile(join(dir, "probe.wasm"), TINY_WASM);
  if (wasmPath) {
    const bytes = await readFile(resolve(wasmPath));
    await copyFile(resolve(wasmPath), join(dir, "big.wasm"));
    console.log(`real wasm: ${bytes.byteLength} B  sha256=${createHash("sha256").update(bytes).digest("hex")}`);
  }

  console.log(`staged: ${dir}`);
  console.log(`report sink: ${sink}/report\n`);
  console.log("Open it in the host, two ways:");
  console.log(`  A. scheme-agnostic (no astravia-file://):  http://127.0.0.1:${actual}/index.html`);
  console.log(`     -> open in the host's browser tab. Tests wasm/gpu/seams, NOT the custom protocol.`);
  console.log(`  B. the real thing:                        astravia-file://local${dir}/index.html`);
  console.log(`     -> needs an iframe inside the host. Paste-ready regardless of plugin state:`);
  console.log(`        <iframe src="astravia-file://local${dir}/index.html"`);
  console.log(`          sandbox="allow-scripts allow-same-origin allow-downloads allow-popups"`);
  console.log(`          style="width:100%;height:100%;border:0" />`);
  console.log(`     Put it in any plugin tab, or scaffold one:  npx @astravia-org/plugin-cli init --id photocraft-probe --name "Embed Probe" abilities/plugins/photocraft-probe`);
  console.log(`\nwaiting up to ${timeoutSec}s for the page to report...`);

  setTimeout(() => {
    if (finished) return;
    console.log(`\nno report after ${timeoutSec}s. If the page showed nothing, the frame never loaded:`);
    console.log(`  - is the path under your home directory? (astravia-file:// only serves homedir + project roots)`);
    console.log(`  - does the protocol serve .wasm as application/wasm? (compileStreaming would then fail)`);
    console.log(`  - does ${sink}/report answer? (curl it: a 404 is fine, a refused connection is not)`);
    server.close(() => process.exit(2));
  }, timeoutSec * 1000);
});

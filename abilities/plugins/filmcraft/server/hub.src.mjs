/**
 * Craft hub — the single origin all three entry points open, for one ArtCraft app.
 *
 * It serves one thing: the upstream `<app>-web-<version>.zip`, as a static site, on
 * loopback. It has no write endpoints, never touches the workspace and never unpacks
 * to disk (the archive is indexed in memory and inflated per file).
 *
 * ADR: docs/adr/photocraft/0007-one-loopback-hub-three-entries.md
 *
 * This is the SOURCE file and is identical in every craft plugin. `server/hub.mjs`
 * next to it is generated from this by scripts/build-hub.mjs, which fills the two
 * `@inject:` markers below from payload/manifest.json + src/bridge/host-bridge.js.
 */
import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import http from "node:http";
import https from "node:https";
import path from "node:path";
import { inflateRawSync } from "node:zlib";

// Filled by scripts/build-hub.mjs from payload/manifest.json.
const PIN = /* @inject:pin */ null;
// Filled by scripts/build-hub.mjs from src/bridge/host-bridge.js.
const HOST_BRIDGE_JS = /* @inject:bridge */ "";

const APP = (PIN && PIN.app) || {};
const APP_ID = APP.id || "craft";
const APP_NAME = APP.name || "Craft";
const TAG = "[" + APP_ID + "-hub] ";
const SIZE_LABEL = APP.sizeLabel || "";

const PORT = Number(process.env.ASTRAVIA_SERVICE_PORT ?? 0);
const DATA_DIR = process.env.ASTRAVIA_SERVICE_DATA_DIR ?? "";
const BRIDGE_NAME = "host-bridge.js";
const SCRIPT_TAG = '<script src="./' + BRIDGE_NAME + '"></script>';
/**
 * Preset preferences before the app module runs (ADR 0011): a web build that never
 * reads navigator.languages keeps "auto" = English forever. Only seeds an empty
 * store, so a language picked later in Preferences is never overwritten.
 */
const LANGUAGE_SEED_NAME = APP.seedKey || "";
const LANGUAGE_SEED_SCRIPT = LANGUAGE_SEED_NAME
  ? "<script>/* craft-language-seed */try{var k=" +
    JSON.stringify(LANGUAGE_SEED_NAME) +
    ";if(!window.localStorage.getItem(k))window.localStorage.setItem(k," +
    JSON.stringify(APP.seedValue || "") +
    ")}catch(e){}</script>"
  : "";
const SEED_MARK = "craft-language-seed";
const MAX_REDIRECTS = 6;
const READY_TIMEOUT_MS = 60_000;
/** How long a failed payload waits before the network is walked again. */
const NETWORK_RETRY_MS = 60_000;
const ENV_URL = (APP.envPrefix || "CRAFT") + "_PAYLOAD_URL";
const ENV_ZIP = (APP.envPrefix || "CRAFT") + "_PAYLOAD_ZIP";

const CACHED_NAME = PIN ? "payload-" + PIN.sha256.slice(0, 12) + ".zip" : "payload.zip";
const DROP_NAME = PIN && PIN.localFile ? PIN.localFile : "payload.zip";
const CONFIG_NAME = "payload.json";

const MIME = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".webmanifest", "application/manifest+json"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".otf", "font/otf"],
  [".ttf", "font/ttf"],
  [".txt", "text/plain; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
]);

/**
 * @type {{phase: string, received: number, total: number, error: string | null, injectMiss: boolean,
 *   entries: number, sums: string, source: string | null, attempts: Array<{id: string, error: string}>}}
 */
const state = {
  phase: "starting",
  received: 0,
  total: PIN?.size ?? 0,
  error: null,
  injectMiss: false,
  entries: 0,
  sums: "unknown",
  source: null,
  attempts: [],
};

/** @type {Map<string, {name: string, method: number, compSize: number, size: number, dataOffset: number}> | null} */
let index = null;
/** @type {Buffer | null} */
let archive = null;
const inflated = new Map();

function fail(phase, message) {
  state.phase = phase;
  state.error = message;
  process.stderr.write(TAG + phase + ": " + message + "\n");
}

// ---------------------------------------------------------------- archive

function parseArchive(buf) {
  let eocd = -1;
  const floor = Math.max(0, buf.length - 22 - 0xffff);
  for (let i = buf.length - 22; i >= floor; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("zip-eocd-missing");

  const count = buf.readUInt16LE(eocd + 10);
  const cdSize = buf.readUInt32LE(eocd + 12);
  const cdStart = buf.readUInt32LE(eocd + 16);
  if (cdSize <= 0 || cdStart + cdSize > buf.length) throw new Error("zip-cd-out-of-range");

  const raw = [];
  let p = cdStart;
  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error("zip-cd-corrupt");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const size = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const externalAttrs = buf.readUInt32LE(p + 38);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    p += 46 + nameLen + extraLen + commentLen;

    if (name.endsWith("/")) continue;
    // A zip we serve must not be able to name anything outside itself.
    if (name.startsWith("/") || name.includes("\\") || name.split("/").includes("..")) {
      throw new Error("zip-entry-unsafe:" + name);
    }
    // 0xA000 in the high 16 bits of external attributes is S_IFLNK.
    if (((externalAttrs >>> 16) & 0xf000) === 0xa000) throw new Error("zip-entry-symlink:" + name);
    if (method !== 0 && method !== 8) throw new Error("zip-entry-method:" + method + ":" + name);
    if (buf.readUInt32LE(localOffset) !== 0x04034b50) throw new Error("zip-local-corrupt:" + name);
    const localNameLen = buf.readUInt16LE(localOffset + 26);
    const localExtraLen = buf.readUInt16LE(localOffset + 28);
    const dataOffset = localOffset + 30 + localNameLen + localExtraLen;
    if (dataOffset + compSize > buf.length) throw new Error("zip-entry-out-of-range:" + name);
    raw.push({ name, method, compSize, size, dataOffset });
  }

  // Upstream ships `<app>-web-<version>/…`; strip a single shared top folder
  // so the site is served at the origin root.
  const first = raw.map((e) => e.name.split("/"));
  const shared = first.length > 0 && first.every((parts) => parts.length > 1 && parts[0] === first[0][0]);
  const prefix = shared ? first[0][0] + "/" : "";
  const map = new Map();
  for (const entry of raw) {
    const name = prefix && entry.name.startsWith(prefix) ? entry.name.slice(prefix.length) : entry.name;
    map.set(name, { ...entry, name });
  }
  if (!map.has("index.html")) throw new Error("zip-missing-index");
  return map;
}

function entryBytes(entry) {
  const cached = inflated.get(entry.name);
  if (cached) return cached;
  const slice = archive.subarray(entry.dataOffset, entry.dataOffset + entry.compSize);
  const bytes = entry.method === 0 ? Buffer.from(slice) : inflateRawSync(slice);
  if (entry.size && bytes.length !== entry.size) throw new Error("zip-entry-size:" + entry.name);
  inflated.set(entry.name, bytes);
  return bytes;
}

// ---------------------------------------------------------------- download

function request(url, headers = {}, redirects = 0) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const client = target.protocol === "http:" ? http : https;
    const req = client.get(
      target,
      { headers: { "user-agent": "astravia-" + APP_ID + "-hub", "accept-encoding": "identity", ...headers } },
      (res) => {
        const status = res.statusCode ?? 0;
        if (status >= 300 && status < 400 && res.headers.location) {
          res.resume();
          if (redirects >= MAX_REDIRECTS) return reject(new Error("too-many-redirects"));
          const next = new URL(res.headers.location, target).toString();
          return resolve(request(next, headers, redirects + 1));
        }
        resolve({ status, headers: res.headers, stream: res });
      },
    );
    req.setTimeout(READY_TIMEOUT_MS, () => req.destroy(new Error("request-timeout")));
    req.on("error", reject);
  });
}

async function readAll(url, limitBytes, headers) {
  const res = await request(url, headers);
  if (res.status !== 200) {
    res.stream.resume();
    throw new Error("http-" + res.status);
  }
  const chunks = [];
  let total = 0;
  for await (const chunk of res.stream) {
    total += chunk.length;
    if (total > limitBytes) {
      res.stream.destroy();
      throw new Error("response-too-large");
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function fileSize(p) {
  try {
    return (await stat(p)).size;
  } catch {
    return 0;
  }
}

/**
 * Fetch one source to a `.part` file, resuming whatever is already there.
 * On disk (not in memory) so a blocked network survives a service restart.
 */
async function downloadSource(source, zipPath) {
  const partPath = zipPath + ".part";
  let have = await fileSize(partPath);
  const headers = have > 0 ? { range: "bytes=" + have + "-" } : {};
  const res = await request(source.url, headers);
  if (res.status === 416) {
    await rm(partPath, { force: true });
    throw new Error("range-not-satisfiable");
  }
  if (res.status !== 200 && res.status !== 206) {
    res.stream.resume();
    throw new Error("http-" + res.status);
  }
  if (res.status === 200) have = 0; // server ignored the range: start over
  const length = Number(res.headers["content-length"] ?? 0);
  state.total = have + length || PIN.size || 0;
  state.received = have;

  const handle = await open(partPath, have > 0 ? "a" : "w");
  try {
    for await (const chunk of res.stream) {
      await handle.write(chunk);
      state.received += chunk.length;
    }
  } finally {
    await handle.close();
  }
  await rename(partPath, zipPath);
}

/**
 * User-editable wiring, read once at boot. Under the host this file is the only
 * configurable surface: the service process gets a whitelisted environment, so a
 * parent-shell `export` never reaches it (ADR 0007 D1b, ADR 0008 D2-4).
 */
const config = { localFile: null, sources: [], error: null };

function configPath() {
  return DATA_DIR ? path.join(DATA_DIR, CONFIG_NAME) : "";
}

/** Write an explanatory skeleton on first boot; never overwrite a user's edits. */
async function ensureConfigFile() {
  if (!DATA_DIR) return;
  const template = {
    _readme:
      "Optional. localFile: absolute path of " +
      DROP_NAME +
      ", or a name inside this directory. " +
      "sources: extra mirrors tried before the built-in ones. Every byte is checked against the pinned sha256.",
    localFile: "",
    sources: [],
  };
  try {
    const handle = await open(configPath(), "wx");
    try {
      await handle.writeFile(JSON.stringify(template, null, 2) + "\n", "utf8");
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (!error || error.code !== "EEXIST") config.error = "config-write:" + String((error && error.message) || error);
  }
}

async function loadConfig() {
  if (!DATA_DIR) return;
  let raw;
  try {
    raw = await readFile(configPath(), "utf8");
  } catch (error) {
    if (!error || error.code !== "ENOENT") config.error = "config-read:" + String((error && error.message) || error);
    return;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    config.error = "config-json:" + String((error && error.message) || error);
    return;
  }
  if (typeof parsed.localFile === "string" && parsed.localFile.trim()) config.localFile = parsed.localFile.trim();
  for (const source of Array.isArray(parsed.sources) ? parsed.sources : []) {
    const url = typeof source?.url === "string" ? source.url : "";
    if (!/^https?:\/\//i.test(url)) {
      config.error = "config-source-invalid:" + String((source && source.id) || url);
      continue;
    }
    config.sources.push({ id: typeof source.id === "string" && source.id ? source.id : "config", url });
  }
}

/** Config sources first, then the env override, then the ordered list in the pin (ADR 0008 D1). */
function payloadSources() {
  const list = [...config.sources];
  const override = process.env[ENV_URL];
  if (override) list.push({ id: "env:" + ENV_URL, url: override });
  for (const source of PIN?.sources ?? []) list.push(source);
  return list;
}

/**
 * Places an archive can already be, most specific first. Nothing here is
 * trusted — sha256 decides, the file name only suggests (ADR 0008 D2).
 */
function localCandidates() {
  const names = [CACHED_NAME, DROP_NAME, "payload.zip"];
  const dirs = DATA_DIR ? [DATA_DIR, path.dirname(DATA_DIR)] : [];
  const list = [];
  const override = process.env[ENV_ZIP];
  if (config.localFile) {
    list.push(path.isAbsolute(config.localFile) ? config.localFile : path.join(DATA_DIR, config.localFile));
  }
  if (override) list.push(override);
  for (const dir of dirs) for (const name of names) list.push(path.join(dir, name));
  return list;
}

/**
 * Walk `sources[]` in order until one answers with the pinned bytes.
 * A mirror is not trusted, only tolerated: it is dropped the moment its bytes
 * disagree with the sha256 (ADR 0008 D3).
 */
async function downloadAny(zipPath) {
  const sources = payloadSources();
  state.phase = "downloading";
  for (const source of sources) {
    try {
      await downloadSource(source, zipPath);
      return;
    } catch (error) {
      const message = String((error && error.message) || error);
      state.attempts.push({ id: source.id || "source", error: message });
      process.stderr.write(TAG + "source " + (source.id || "?") + " failed: " + message + "\n");
      await rm(zipPath + ".part", { force: true }).catch(() => undefined);
    }
  }
  throw new Error("payload-no-source");
}

async function verifySums() {
  let text;
  try {
    text = (await readAll(PIN.sumsUrl, 1 << 20)).toString("utf8");
  } catch (error) {
    // The pin is authoritative; the upstream manifest is a cross-check.
    state.sums = "unreachable";
    process.stderr.write(TAG + "sums unreachable: " + String(error && error.message) + "\n");
    return;
  }
  const name = PIN.localFile || (PIN.sources?.[0]?.url ?? "").split("/").pop() || "";
  const line = text.split("\n").find((row) => row.trim().endsWith(name));
  if (!line) throw new Error("sums-missing-entry:" + name);
  const published = line.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
  if (published !== PIN.sha256.toLowerCase()) throw new Error("sums-mismatch:" + published);
  state.sums = "match";
}

/** Serve already-verified bytes; the checksum has already been answered. */
function adopt(bytes) {
  archive = bytes;
  index = parseArchive(bytes);
  state.entries = index.size;
  state.received = bytes.length;
  state.total = bytes.length;
  state.error = null;
  state.phase = "ready";
  process.stderr.write(TAG + "payload ready, " + index.size + " entries from " + state.source + "\n");

  // Already-verified bytes are servable; the upstream manifest is only a
  // cross-check, so it must never gate readiness on a cached archive.
  if (state.sums === "unknown") {
    void verifySums().catch((error) => {
      state.sums = "mismatch";
      process.stderr.write(TAG + "sums mismatch: " + String(error && error.message) + "\n");
    });
  }
}

/**
 * Decide where the bytes come from: anything already on this machine first,
 * then the ordered network sources (ADR 0008 D2). `allowNetwork: false` is the
 * cheap re-check a retrying waiting page asks for.
 */
async function ensurePayload(allowNetwork) {
  if (!PIN) throw new Error("payload-pin-missing");
  if (!DATA_DIR) throw new Error("service-data-dir-missing");
  await mkdir(DATA_DIR, { recursive: true });

  const cachedPath = path.join(DATA_DIR, CACHED_NAME);
  const want = PIN.sha256.toLowerCase();
  state.attempts = [];

  for (const candidate of localCandidates()) {
    if ((await fileSize(candidate)) <= 0) continue;
    state.phase = "checking";
    const bytes = await readFile(candidate);
    if (sha256(bytes) !== want) {
      state.attempts.push({ id: "local:" + candidate, error: "sha256-mismatch" });
      process.stderr.write(TAG + "local payload rejected: " + candidate + "\n");
      continue;
    }
    state.source = candidate === cachedPath ? "cache" : "local";
    adopt(bytes);
    return;
  }

  if (!allowNetwork) throw new Error("payload-not-on-disk");

  // Nothing usable on disk: whatever a previous run left is stale by definition,
  // and a resume must not append to bytes we already rejected.
  await rm(cachedPath, { force: true });
  await rm(cachedPath + ".part", { force: true });

  await verifySums();
  await downloadAny(cachedPath);
  state.phase = "checking";
  const bytes = await readFile(cachedPath);
  if (sha256(bytes) !== want) {
    await rm(cachedPath, { force: true });
    throw new Error("payload-unverified");
  }
  state.source = "download";
  adopt(bytes);
}

let loading = null;
let lastNetworkAt = 0;

/** One payload loader per process; the waiting page may ask again every second. */
function scheduleEnsure(allowNetwork) {
  if (loading || index) return;
  loading = true;
  if (allowNetwork) lastNetworkAt = Date.now();
  ensurePayload(allowNetwork)
    .catch((error) => fail("failed", String((error && error.message) || error)))
    .finally(() => {
      loading = null;
    });
}

function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

// ---------------------------------------------------------------- http

function send(res, status, type, body, extra = {}) {
  res.writeHead(status, {
    "content-type": type,
    "content-length": String(body.length),
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    ...extra,
  });
  if (res.req?.method === "HEAD") res.end();
  else res.end(body);
}

function waitingPage() {
  const failed = state.phase === "failed";
  const label = failed
    ? APP_NAME + " 的编辑器文件没有就绪。 / The editor payload is not ready."
    : "正在准备 " +
      APP_NAME +
      (SIZE_LABEL ? "（首次约 " + SIZE_LABEL + "）" : "") +
      "。 / Preparing " +
      APP_NAME +
      (SIZE_LABEL ? " (" + SIZE_LABEL + ", first run only)" : "") +
      ".";

  const error = state.error ? "<p><code>" + escapeHtml(state.error) + "</code></p>" : "";
  const attempts = state.attempts.length
    ? "<ul>" +
      state.attempts
        .map((a) => "<li><code>" + escapeHtml(a.id) + "</code> — " + escapeHtml(a.error) + "</li>")
        .join("") +
      "</ul>"
    : "";
  // The drop path is the offline escape hatch, so it is printed verbatim and
  // in full: nothing else in this page asks the reader to guess (ADR 0008 D4).
  const drop = failed && DATA_DIR
    ? "<p>离线安装 / Offline: 把上游 zip 放到 / put the upstream zip at<br><code>" +
      escapeHtml(path.join(DATA_DIR, DROP_NAME)) +
      "</code></p>"
    : "";
  // The config file is the manual-runnable escape hatch for names and mirrors.
  const configHint = DATA_DIR
    ? "<p>配置 / Config（可指定本地 zip 路径与额外镜像）:<br><code>" +
      escapeHtml(configPath()) +
      (config.error ? "</code><br><code>" + escapeHtml(config.error) : "") +
      "</code></p>"
    : "";

  return Buffer.from(
    "<!doctype html><meta charset=utf-8><meta http-equiv=refresh content=1>" +
      "<title>" +
      escapeHtml(APP_NAME) +
      "</title><style>body{font:14px/1.6 system-ui;background:#141414;color:#e8e8e8;" +
      "display:grid;place-items:center;min-height:100vh;margin:0;padding:24px;box-sizing:border-box}" +
      "div{max-width:720px}code{color:#ff9f9f;word-break:break-all}ul{padding-left:18px}" +
      "li{margin:2px 0}</style>" +
      "<div><p>" +
      label +
      "</p>" +
      error +
      attempts +
      drop +
      configHint +
      "<p>Phase: " +
      escapeHtml(state.phase) +
      " · /api/state</p>" +
      "</div>",
    "utf8",
  );
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

function resolveEntry(rawPath) {
  if (!index) return null;
  let name = rawPath.split("?")[0].split("#")[0];
  try {
    name = decodeURIComponent(name);
  } catch {
    return null;
  }
  name = name.replace(/^\/+/, "");
  if (name === "") name = "index.html";
  if (name.split("/").includes("..")) return null;
  const direct = index.get(name);
  if (direct) return direct;
  // Upstream packaging puts the app glue in app/ but its wasm-bindgen snippet at the
  // site root, so the glue's `./snippets/...` import would 404 (ADR 0010 D3). Serve
  // the same bytes under the path the glue asks for.
  if (name.startsWith("app/snippets/")) return index.get(name.slice("app/".length)) ?? null;
  return null;
}

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (req.method !== "GET" && req.method !== "HEAD") {
    return send(res, 405, "text/plain; charset=utf-8", Buffer.from("read-only\n"), { allow: "GET, HEAD" });
  }

  if (url === "/health") {
    return send(res, 200, "application/json; charset=utf-8", Buffer.from(JSON.stringify({ ok: true })));
  }
  if (url.startsWith("/api/state")) {
    const body = {
      app: APP_ID,
      phase: state.phase,
      version: PIN?.version ?? null,
      sha256: PIN?.sha256 ?? null,
      received: state.received,
      total: state.total,
      error: state.error,
      injectMiss: state.injectMiss,
      entries: state.entries,
      sums: state.sums,
      source: state.source,
      sources: payloadSources().map((source) => source.id),
      attempts: state.attempts,
      dataDir: DATA_DIR || null,
      localFile: DROP_NAME,
      config: configPath() || null,
      configError: config.error,
    };
    return send(res, 200, "application/json; charset=utf-8", Buffer.from(JSON.stringify(body)));
  }
  if (url === "/" + BRIDGE_NAME) {
    return send(res, 200, MIME.get(".js"), Buffer.from(HOST_BRIDGE_JS, "utf8"));
  }

  if (!index) {
    // A drop-in that appeared after boot is picked up here, so the reader never
    // has to restart anything (ADR 0008 D4). Network attempts stay throttled.
    scheduleEnsure(Date.now() - lastNetworkAt > NETWORK_RETRY_MS);
    if (url === "/" || url === "/index.html") return send(res, 503, MIME.get(".html"), waitingPage());
    return send(res, 503, "text/plain; charset=utf-8", Buffer.from("payload-not-ready:" + state.phase + "\n"));
  }

  const entry = resolveEntry(url);
  if (!entry) return send(res, 404, "text/plain; charset=utf-8", Buffer.from("not-found\n"));

  let body;
  try {
    body = entryBytes(entry);
  } catch (error) {
    fail("broken", String(error && error.message));
    return send(res, 500, "text/plain; charset=utf-8", Buffer.from("payload-broken\n"));
  }

  if (entry.name === "index.html") {
    // The only place upstream bytes are rewritten (ADR 0005 D3): a preference seed in
    // <head>, before the app module runs, and the host bridge before </body>.
    const html = body.toString("utf8");
    if (html.includes(SCRIPT_TAG) && (!SEED_MARK || html.includes(SEED_MARK))) {
      return send(res, 200, MIME.get(".html"), body);
    }
    const headOpen = html.indexOf("<head");
    const headAt = headOpen < 0 ? -1 : html.indexOf(">", headOpen) + 1;
    const bodyEnd = html.lastIndexOf("</body>");
    state.injectMiss = headAt <= 0 || bodyEnd < 0;
    if (state.injectMiss) return send(res, 200, MIME.get(".html"), body);
    let patched = html;
    if (LANGUAGE_SEED_SCRIPT && !patched.includes(SEED_MARK)) {
      patched = patched.slice(0, headAt) + LANGUAGE_SEED_SCRIPT + patched.slice(headAt);
    }
    const at = patched.lastIndexOf("</body>");
    if (!patched.includes(SCRIPT_TAG)) patched = patched.slice(0, at) + SCRIPT_TAG + "\n" + patched.slice(at);
    return send(res, 200, MIME.get(".html"), Buffer.from(patched, "utf8"));
  }

  const type = MIME.get(path.extname(entry.name).toLowerCase()) ?? "application/octet-stream";
  return send(res, 200, type, body);
});

// ---------------------------------------------------------------- boot

server.on("error", (error) => {
  fail("failed", "listen:" + String(error && error.message));
  process.exitCode = 1;
});

server.listen(PORT, "127.0.0.1", async () => {
  const address = server.address();
  const actual = typeof address === "object" && address ? address.port : PORT;
  state.phase = "loading";
  process.stdout.write(TAG + "listening on http://127.0.0.1:" + actual + "\n");
  await ensureConfigFile();
  await loadConfig();
  if (config.error) process.stderr.write(TAG + "config: " + config.error + "\n");
  scheduleEnsure(true);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
  });
}

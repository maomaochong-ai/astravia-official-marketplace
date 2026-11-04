/**
 * The frame document: upstream's own web build, read out of this package.
 *
 * The host serves package files over `astravia-plugin://`, but that protocol has no
 * HTML content type, so a frame cannot *navigate* to `index.html` — Chromium would
 * download it. The tab fetches the file as text and runs it as `srcdoc` instead,
 * with three injections that make the document behave like a page on a real origin:
 *
 *  1. `<base href>` — relative `./app.js` / `./app.wasm` resolve into the package;
 *  2. `history.replaceState` — `about:srcdoc` carries no URL, so upstream's own
 *     `new URL("…_bg.wasm", location.href)` and its `?webgl` retry would break.
 *     This runs before any upstream script and gives the document a real URL;
 *  3. the seeds and the host bridge, in the same order the loopback hub used.
 *
 * Nothing here downloads anything: the bytes were built into the package by CI from
 * the upstream sources (docs/adr/photocraft/0001-the-tab-runs-upstreams-web-build.md).
 */
import bridgeSource from "../../../bridge/host-bridge.js?raw";
import { APP } from "../../../app.config.ts";
import type { Downgrade } from "../../../domain/link-protocol.ts";

const SEED_MARK = "craft-language-seed";

/** `navigator.languages` replaced before the app module runs, for builds with Chinese glyphs. */
const LOCALE_SEED_JS =
  'var t=["zh-CN","zh-Hans","zh","en-US"];var d=function(o,k,v){try{' +
  "Object.defineProperty(o,k,{configurable:true,get:function(){return v}})}catch(e){}};" +
  'd(navigator,"language",t[0]);d(navigator,"languages",t);';

/** Fill-only preference seed: a language the user picks later is never overwritten. */
function preferencesSeed(): string {
  if (!APP.seedKey || !APP.seedValue) return "";
  return (
    "var k=" +
    JSON.stringify(APP.seedKey) +
    ";if(!window.localStorage.getItem(k))window.localStorage.setItem(k," +
    JSON.stringify(APP.seedValue) +
    ");"
  );
}

function seedScript(uiLang: "zh" | "en"): string {
  const body: string[] = [];
  const prefs = preferencesSeed();
  if (prefs) body.push(prefs);
  if (APP.locale && uiLang === "zh") body.push(LOCALE_SEED_JS);
  if (body.length === 0) return "";
  return "<script>/* " + SEED_MARK + " */try{" + body.join("") + "}catch(e){}</script>";
}

/**
 * Package root, as the host serves it: `astravia-plugin://<id>/versions/<version>/`.
 * `import.meta.url` is the plugin's own bundle; the resource timeline covers a host
 * that rewrites module URLs. Neither is a host protocol invented here — the host
 * decides the shape, this only stops after its version segment.
 */
function packageRoot(): string | null {
  const seen: string[] = [];
  try {
    seen.push(import.meta.url);
  } catch {
    // not a module-capable environment; the timeline below still answers
  }
  try {
    for (const entry of performance.getEntriesByType("resource")) seen.push(entry.name);
  } catch {
    // performance is always available in Electron; ignore a hardened realm
  }
  for (const candidate of seen) {
    const match = /^(.*\/versions\/[^/]+\/)/.exec(candidate || "");
    if (match) return match[1];
  }
  return null;
}

/** Absolute base for the site, with a trailing slash. */
export function siteRoot(): string {
  const override = (globalThis as { __ASTRAVIA_CRAFT_SITE__?: unknown }).__ASTRAVIA_CRAFT_SITE__;
  if (typeof override === "string" && override) {
    return override.endsWith("/") ? override : `${override}/`;
  }
  const root = packageRoot();
  if (!root) throw new Error("plugin-site-root-unknown");
  return new URL(`${APP.site}/`, root).href;
}

/**
 * Query for the document URL. `webgl` / `cpu` are upstream's own rungs down the
 * rendering ladder; `nosw` keeps a build that registers a service worker from
 * trying to cache a scheme Chromium will not register one for; `hl` is ours.
 */
function documentQuery(mode: Downgrade, uiLang: "zh" | "en"): string {
  const parts: string[] = ["nosw"];
  if (mode !== "auto") parts.push(mode);
  parts.push(`hl=${uiLang}`);
  return `?${parts.join("&")}`;
}

function insertAfterHead(html: string, addition: string): string {
  const open = html.indexOf("<head");
  const at = open < 0 ? -1 : html.indexOf(">", open) + 1;
  if (at <= 0) return addition + html;
  return html.slice(0, at) + addition + html.slice(at);
}

function insertBeforeBodyEnd(html: string, addition: string): string {
  const at = html.lastIndexOf("</body>");
  if (at < 0) return html + addition;
  return html.slice(0, at) + addition + html.slice(at);
}

export interface SiteDocumentRequest {
  mode: Downgrade;
  uiLang: "zh" | "en";
}

/**
 * Upstream `index.html` with the base, the URL, the seeds and the bridge in place.
 * Throws when the package carries no site — the tab then says so instead of showing
 * an empty frame.
 */
export async function buildSiteDocument(request: SiteDocumentRequest): Promise<string> {
  const root = siteRoot();
  const response = await fetch(new URL("index.html", root), { cache: "no-cache" });
  if (!response.ok) throw new Error(`site-index-${response.status}`);
  const html = await response.text();

  const url = new URL(root);
  url.search = documentQuery(request.mode, request.uiLang);

  const head = [
    `<base href="${root}">`,
    `<script>(function(){try{history.replaceState(null,"",${JSON.stringify(url.href)})}catch(e){}})()</script>`,
    seedScript(request.uiLang),
  ].join("");

  // A `</script>` inside the bridge would end the inline tag early; there is none,
  // and this keeps that true if the bridge ever grows one.
  const bridge = `<script>${bridgeSource.replace(/<\/script/gi, "<\\/script")}</script>`;

  return insertBeforeBodyEnd(insertAfterHead(html, head), `\n${bridge}\n`);
}

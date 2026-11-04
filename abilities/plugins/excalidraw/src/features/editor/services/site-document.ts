/**
 * The frame document: upstream's own web build, read out of this package.
 *
 * The host serves package files over `astravia-plugin://`, but that protocol has no
 * HTML content type, so a frame cannot *navigate* to `index.html` — Chromium would
 * download it. The tab fetches the file as text and runs it as `srcdoc` instead,
 * with four injections that make the document behave like a page on a real origin:
 *
 *  1. `<base href>` — relative `./assets/index-*.js` / `./fonts/…` resolve into the
 *     package;
 *  2. `history.replaceState` — `about:srcdoc` carries no URL, so upstream's own
 *     `new URL("…", location.href)` and anything that reads `location.search` would
 *     break. This runs before any upstream script and gives the document a real URL;
 *  3. the embed seed — upstream's self-embedding guard, which would otherwise refuse
 *     this frame (see the comment on `EMBED_SEED_JS`);
 *  4. the language seed and the host bridge, last, so upstream's first paint already
 *     sees the interface language and the host's message port.
 *
 * Nothing here downloads anything at runtime: the bytes in the package are the site
 * the build recipe produced from a pinned upstream commit (see
 * docs/adr/excalidraw/0001-the-tab-runs-upstreams-web-build.md).
 */
import bridgeSource from "../../../bridge/host-bridge.js?raw";
import { APP } from "../../../app.config.ts";

const SEED_MARK = "excalidraw-language-seed";
const EMBED_MARK = "excalidraw-embed-seed";

/**
 * Upstream treats a frame whose referrer shares the document's origin as recursive
 * self-embedding and renders "I'm not a pretzel!" instead of the canvas
 * (`excalidraw-app/App.tsx`). Under the host both `about:srcdoc` and
 * `astravia-plugin://…` have the opaque origin `null`, so the two compare equal and
 * a legitimate single-level embed is refused. Emptying `referrer` makes upstream's
 * `new URL(referrer)` throw, which is the branch it already treats as "not
 * self-embedded". Evidence: docs/adr/excalidraw/0001-the-tab-runs-upstreams-web-build.md.
 */
const EMBED_SEED_JS =
  'try{Object.defineProperty(document,"referrer",{configurable:true,get:function(){return ""}})}catch(e){}';

/** `navigator.languages` replaced before the app module runs, for builds with Chinese glyphs. */
const LOCALE_SEED_JS =
  'var t=["zh-CN","zh-Hans","zh","en-US"];var d=function(o,k,v){try{' +
  "Object.defineProperty(o,k,{configurable:true,get:function(){return v}})}catch(e){}};" +
  'd(navigator,"language",t[0]);d(navigator,"languages",t);';

function embedSeedScript(): string {
  return "<script>/* " + EMBED_MARK + " */" + EMBED_SEED_JS + "</script>";
}

function seedScript(uiLang: "zh" | "en"): string {
  if (uiLang !== "zh") return "";
  return "<script>/* " + SEED_MARK + " */try{" + LOCALE_SEED_JS + "}catch(e){}</script>";
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
  const override = (globalThis as { __ASTRAVIA_EXCALIDRAW_SITE__?: unknown }).__ASTRAVIA_EXCALIDRAW_SITE__;
  if (typeof override === "string" && override) {
    return override.endsWith("/") ? override : `${override}/`;
  }
  const root = packageRoot();
  if (!root) throw new Error("plugin-site-root-unknown");
  return new URL(`${APP.site}/`, root).href;
}

/**
 * Query for the document URL. Excalidraw detects its language with
 * `i18next-browser-languagedetector`, whose lookup order starts with the `lng`
 * query parameter — so the document's own URL is the authoritative switch, and it
 * holds even when the host locale and the OS locale disagree.
 */
export function documentQuery(uiLang: "zh" | "en"): string {
  return `?lng=${uiLang === "zh" ? "zh-CN" : "en"}`;
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
  uiLang: "zh" | "en";
}

/**
 * Upstream `index.html` with the base, the URL, the seeds and the bridge in place.
 * Every injection lands ahead of upstream's module script, so the first paint
 * already sees the language, the emptied referrer and the bridge.
 * Throws when the package carries no site — the tab then says so instead of showing
 * an empty frame.
 */
export async function buildSiteDocument(request: SiteDocumentRequest): Promise<string> {
  const root = siteRoot();
  const response = await fetch(new URL("index.html", root), { cache: "no-cache" });
  if (!response.ok) throw new Error(`site-index-${response.status}`);
  const html = await response.text();

  const url = new URL(root);
  url.search = documentQuery(request.uiLang);

  const head = [
    `<base href="${root}">`,
    `<script>(function(){try{history.replaceState(null,"",${JSON.stringify(url.href)})}catch(e){}})()</script>`,
    embedSeedScript(),
    seedScript(request.uiLang),
  ].join("");

  // A `</script>` inside the bridge would end the inline tag early; there is none,
  // and this keeps that true if the bridge ever grows one.
  const bridge = `<script>${bridgeSource.replace(/<\/script/gi, "<\\/script")}</script>`;

  return insertBeforeBodyEnd(insertAfterHead(html, head), `\n${bridge}\n`);
}

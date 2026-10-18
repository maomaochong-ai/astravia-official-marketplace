# Firecrawl for Astravia

Turns a URL into Markdown inside Astravia, and shows the crawl as a spider that walks the page
structure while it works. No API key and no Firecrawl server: fetching, JavaScript rendering,
PDF text extraction, main-content extraction, `robots.txt` handling and the breadth-first crawl
all run in the plugin, over the host's network and browser permissions.

## What the plugin ships

| Extension point | What it does |
| --- | --- |
| Activity tab `crawl.console` | Spider panel (page anatomy or link topology) plus Console / Pages / Elements tabs. Idle until a run starts; shows every admitted page, every refusal and why, and every media URL found. |
| `ui.slot.input-action` "Firecrawl" | Toggle below the input bar. On: attaches the console at full width and injects crawl instructions into the next prompt. Off: detaches it. |
| Agent tools `firecrawl_scrape` / `firecrawl_crawl` / `firecrawl_map` / `firecrawl_search` / `firecrawl_extract` | Single page, bounded same-site crawl, URL inventory, web search, schema-shaped extraction. |
| Output format `media` | Every image / video / audio URL in the page markup, with HLS/DASH playlists marked. |
| Skill `firecrawl` (`agent/skills/firecrawl/`) | Tells the Agent when to pick which tool and how to report limits and `robots.txt` refusals honestly. |

The tab and the tools share one run store, so a crawl the Agent starts animates in the panel
instead of happening invisibly. The console target follows what you type in the chat: paste a URL
into a message and the panel adopts it before any tool call arrives.

## How a page is fetched

`render: "auto"` (default) reads the static HTML first and only escalates to the browser session
when the document looks client-rendered, when the extracted text is shorter than 320 characters,
or when a screenshot is requested. `render: "static"` never opens a browser; `render: "browser"`
always does and prefers the rendered text.

- **PDF** is parsed as a document (text layer, page count) rather than refused.
- **`text/markdown`** is passed through unchanged.
- **Other binaries** are refused with a reason the Agent can report, instead of an empty page.
- **Media URLs** are enumerated from `img`, `video`, `audio`, `source` and the `og:video*` /
  `og:audio` meta tags, resolved against the page URL and de-duplicated.

## Capability map against upstream Firecrawl

Implemented in-plugin: scrape with Markdown / HTML / raw HTML / links / screenshot / media,
spec-shaped JSON extraction, crawl with depth + limit + scope + include/exclude + sitemap seeding
+ robots, sitemap discovery, `map` with search, web search, JS rendering through the host browser
session, PDF text, prompt-injection warnings.

Implemented in a reduced form:

- **Browser rendering** returns text, a screenshot and an accessibility snapshot. The plugin API
  has no `evaluate` / `outerHTML`, so the *post-render* HTML tree is not available: element
  anatomy for browser-rendered pages is derived from text, not from the DOM.
- **Search** uses DuckDuckGo's HTML endpoint by default (no key required) instead of a paid
  provider.

Not implemented, by design or by platform boundary — see [Limits](#limits).

## Limits

These are real boundaries of this plugin. The Agent is told to report them instead of guessing.

- **No DRM circumvention, no decryption, no decryption of encrypted media segments.** Pages behind
  Widevine/PlayReady/FairPlay or an encrypted HLS/DASH manifest are read as far as their public
  text goes. The plugin does not break content protection, and it does not stitch encrypted
  segments together. This is a legal boundary, not a technical TODO.
- **Media is enumerated, not downloaded.** For a player the plugin lists the file URL or the
  playlist URL and its segments. `blob:` Media Source streams are reported as protected streams:
  they only exist inside the playing page and are not a file. Video/audio bytes are never fetched.
- **Encrypted or obfuscated content will simply be missing** from the Markdown. If a page refuses
  to render without a login, a paywall cookie or a captcha, the crawl reports the thin or blocked
  result — it does not attempt to defeat the gate.
- No proxy/stealth configuration, no `maxAge` cache reuse, no webhook delivery, no batch scrape
  endpoint, no change tracking, no branding/product/menu extraction, no mobile viewport emulation.
- Scanned PDFs have no OCR: a page image yields no text.
- `robots.txt` is enforced. `ignoreRobotsTxt` exists for pages you own; the plugin never invents a
  bypass.

## Behaviour worth knowing

- **Depth is link hops from the start URL**, not URL path segments. `maxDepth: 0` reads only the start page.
- **`limit` caps fetched pages**, and the crawl stops at it; refusals are reported, not silently dropped.
- **Scope** comes from the start URL: a directory URL covers its subtree; a document URL widens to
  its parent directory; anything else covers itself and its children.
- **Sequential admission** — external host, backwards crawl, depth, exclude, include, social media,
  file type, `robots.txt`, duplicate — so the first matching rule is the reported reason.
- **`robots.txt` is read by default.** Refusals are never bypassed.
- **Sitemap seeding** runs before hop 1 when a sitemap is declared and `maxDepth >= 1`.
- **Prompt-injection scan** matches known instruction-override phrasing and reports it as a warning.
  It never rewrites the page.

## Development

```bash
npm install
npm run check        # tsc --noEmit
npm test             # vitest, happy-dom
npm run build        # local preflight; dist/ and release/ are not committed
```

`npm install` needs the `@astravia-org/*` dev dependencies resolvable; the marketplace build
temporarily points them at the local host checkout.

Source layout follows [docs/plugin-project-structure.md](../../../docs/plugin-project-structure.md):

```
src/domain/            URL, denial, scrape pipeline, PDF, element profiling, crawl rules (pure, unit-tested)
src/features/          console UI: store, hooks, components
src/runtime/           plugin context singleton, host HTTP client, conversation watcher
src/tools/             agent tool registrations
src/index.tsx          activation: tab, tools, input action, dispose
agent/skills/          the Agent Skill
locales/               UI strings (en, zh)
```

Upstream attribution and third-party licences: [NOTICE.md](NOTICE.md).

## 中文

[README.zh.md](README.zh.md) — 说明这份插件做什么、行为边界与开发命令。

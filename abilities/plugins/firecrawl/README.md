# Firecrawl for Astravia

Turns a URL into Markdown inside Astravia, and shows the crawl as a spider that walks the page
structure while it works. Two engines answer the same tools:

- **Local engine** — fetching, JavaScript rendering, PDF/DOCX/XLSX text, main-content extraction,
  `robots.txt` handling and the breadth-first crawl all run in the plugin, over the host's network
  and browser permissions. No key, no server.
- **Firecrawl API engine** — the same tool calls are sent to the [Firecrawl v2 API](https://docs.firecrawl.dev),
  either api.firecrawl.dev or a self-hosted instance, so OCR, stealth proxying, hosted job queues and
  scheduled monitors come from upstream instead of being reimplemented here.

`engine: "auto"` (default) uses the API when an endpoint or key is configured and the local engine
otherwise. Every tool also takes a per-call `engine` argument, so a single call can override the
setting. Tool names, arguments and answer shapes stay identical across engines.

## What the plugin ships

| Extension point | What it does |
| --- | --- |
| Activity tab `crawl.console` | Engine bar (mode, endpoint, API key), spider panel (page anatomy or link topology) plus Console / Pages / Elements tabs. Idle until a run starts; shows every admitted page, every refusal and why, and every media URL found. |
| `ui.slot.input-action` "Firecrawl" | Toggle below the input bar. On: attaches the console at full width and injects crawl instructions into the next prompt. Off: detaches it. |
| `firecrawl_scrape` | One page → Markdown, with `html` / `rawHtml` / `links` / `screenshot` / `media` / `images` / `json` / `summary` / `extract` / `answer` / `highlights` / `attributes` / `rawBase64` / `changeTracking` formats. |
| `firecrawl_batch_scrape` | A known URL list. On the API engine this is a real job: `wait: false` returns an id for `firecrawl_job_status`. |
| `firecrawl_crawl` | Bounded same-site crawl with depth, scope, include/exclude, sitemap modes, `prompt`, `webhookUrl`, `maxAge` and `scrapeOptions`. |
| `firecrawl_map` | URL inventory from sitemaps plus page links, up to 5000 entries. |
| `firecrawl_search` | Web search with categories, sources, domain filters and a recency window. |
| `firecrawl_extract` | Schema-shaped extraction across one or more URLs. |
| `firecrawl_parse` | A document → Markdown: PDF, DOCX, XLSX and their macro variants, from a URL or a local path. |
| `firecrawl_video` | Download an unencrypted video/audio stream: HLS playlist, DASH manifest or direct media file, discovered from a page when needed. |
| `firecrawl_job_status` | Inspect, wait for or cancel an upstream crawl/batch job. |
| `firecrawl_monitor` | Create, list, update, run, inspect and delete scheduled monitors (`scrape` / `crawl` / `search` targets with a cron or interval schedule). API engine only. |
| Skill `firecrawl` (`agent/skills/firecrawl/`) | Tells the Agent when to pick which tool and how to report limits and `robots.txt` refusals honestly. |

The tab and the tools share one run store, so a crawl the Agent starts animates in the panel
instead of happening invisibly. The console target follows what you type in the chat: paste a URL
into a message and the panel adopts it before any tool call arrives.

## Configuring the API engine

Open the crawler console and use the engine bar:

- **Mode** — `auto` (API when configured), `API`, `local`.
- **Endpoint** — empty means `https://api.firecrawl.dev`; a self-hosted instance is
  `http://localhost:3002` and needs no key.
- **API key** — written to the host credential vault, never to a settings file, a log, or a tool
  argument. Clearing the field keeps the stored key; emptying the vault entry removes it.

Without an endpoint and without a key the plugin stays entirely local, which is why the API is an
enhancement rather than a requirement.

## How a page is fetched

`render: "auto"` (default) reads the static HTML first and only escalates to the browser session
when the document looks client-rendered, when the extracted text is shorter than 320 characters,
or when a screenshot is requested. `render: "static"` never opens a browser; `render: "browser"`
always does and prefers the rendered text.

- **PDF** is parsed as a document (text layer, page count) rather than refused.
- **DOCX / XLSX** are read through a hand-written OOXML reader: headings, list items, bold runs and
  tables become Markdown; each worksheet becomes its own section.
- **`text/markdown`** is passed through unchanged.
- **Other binaries** are refused with a reason the Agent can report, instead of an empty page.
- **Media URLs** are enumerated from `img`, `video`, `audio`, `source` and the `og:video*` /
  `og:audio` meta tags, resolved against the page URL and de-duplicated.
- **Custom headers** are sent by the HTTP fetch. The host browser API cannot set request headers, so
  a browser-rendered page is loaded from that fetched snapshot through a `data:` URL with a `<base>`
  pointing at the original address — cookies and header-gated subresources do not replay.

## Capability map against upstream Firecrawl

Implemented in-plugin: scrape with Markdown / HTML / raw HTML / links / screenshot / media / images /
raw base64 / `attributes`, spec-shaped JSON extraction, crawl with depth + limit + scope +
include/exclude + sitemap modes (`include` / `only` / `skip`) + robots, a crawl-wide `prompt` answered
over the collected pages, a `webhookUrl` that receives the summary as JSON, sitemap discovery, `map`
with search, web search with categories, JS rendering through the host browser session (optionally
with a persistent logged-in profile), PDF/DOCX/XLSX text, `maxAge` cache reuse with `changeTracking`
on scrape, batch and crawl, custom request headers, prompt-injection warnings, HLS/DASH segment
download, and the Firecrawl API as a full second engine.

Delegated to the API engine rather than reimplemented: OCR, stealth/anti-bot proxying, hosted job
queues with `firecrawl_job_status`, and scheduled monitors.

Implemented in a reduced form:

- **Browser rendering** returns text, a screenshot and an accessibility snapshot. The plugin API has
  no `evaluate` / `outerHTML`, so the *post-render* HTML tree is not available: element anatomy for
  browser-rendered pages is derived from text, not from the DOM.
- **DASH** supports `SegmentTemplate` manifests with `$Number$` (plus `$RepresentationID$` /
  `$Bandwidth$` and `SegmentTimeline`). Manifests that address segments some other way are reported
  as unsupported instead of silently producing a broken file.
- **Search** uses DuckDuckGo's HTML endpoint by default (no key required) instead of a paid provider.

## Limits

These are real boundaries of this plugin. The Agent is told to report them instead of guessing.

- **No DRM circumvention, no decryption, no stitching of encrypted media segments.** Pages behind
  Widevine/PlayReady/FairPlay, or an HLS `#EXT-X-KEY` with `METHOD=AES-128`/`SAMPLE-AES`, or an MPD
  with `ContentProtection`, are read as far as their public text goes. `firecrawl_video` reports the
  protection and stops; it does not try to defeat it. This is a legal boundary, not a technical TODO.
  Unencrypted HLS/DASH segments *are* downloaded and concatenated.
- **`blob:` Media Source streams** only exist inside the playing page and are reported as protected
  streams. There is no file to fetch.
- **Encrypted or obfuscated content will simply be missing** from the Markdown. If a page refuses to
  render without a login, a paywall cookie or a captcha, the crawl reports the thin or blocked result
  — it does not attempt to defeat the gate.
- **No local scheduler and no local job queue.** The plugin API gives a plugin no way to register a
  background task, so `firecrawl_monitor` and the async job queue are the API engine's; locally,
  `batch_scrape` still reads its URLs inside one call and there is nothing to poll.
- **The `maxAge` cache needs `storage.read` / `storage.write`.** Without those permissions every
  fetch is live and `changeTracking` reports "new" each time.
- Scanned PDFs have no OCR locally: a page image yields no text. That is what the API engine adds.
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
- **Sitemap seeding** runs before hop 1 when a sitemap is declared. `sitemap: "only"` uses the
  sitemap as the whole frontier and never expands links; `"skip"` ignores it.
- **Prompt-injection scan** matches known instruction-override phrasing and reports it as a warning.
  It never rewrites the page.
- **Request headers are redacted** before they reach a console snapshot or a webhook payload.

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
src/domain/backend/     Firecrawl v2 REST client and its types
src/domain/             URL, denial, scrape pipeline, PDF, OOXML, media streams, element profiling, crawl rules
src/features/           console UI: store, hooks, components
src/runtime/            plugin context singleton, host HTTP client, upstream gate (settings + vault), conversation watcher
src/tools/              agent tool registrations, local and upstream implementations
src/index.tsx           activation: tab, tools, input action, dispose
agent/skills/           the Agent Skill
locales/                UI strings (en, zh)
```

Upstream attribution and third-party licences: [NOTICE.md](NOTICE.md).

## 中文

[README.zh.md](README.zh.md) — 说明这份插件做什么、行为边界与开发命令。

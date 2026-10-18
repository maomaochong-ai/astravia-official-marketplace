# Firecrawl Connector for Astravia

Reads pages inside Astravia and shows the crawl as a spider that walks the page structure while it
works. A page normally arrives as Markdown, and the same call can also return HTML, links, screenshots,
images, video and audio URLs, a summary or schema-shaped JSON — the output is whatever format you asked
for, not prose by default. Every request is executed by [Firecrawl](https://docs.firecrawl.dev); this
plugin ships no scraper of its own.

```text
agent tool  ──►  request body  ──►  Firecrawl API v2  ──►  Markdown / JSON / job status
console     ──►  POST /v2/crawl ──►  GET /v2/crawl/{id}  ──►  spider web + pages
```

## Three ways to reach Firecrawl

Firecrawl exposes more than one integration surface, and Astravia has a host mechanism for each. This
plugin uses the one that actually moves data:

| Mode | What it is | Why it is / is not the runtime here |
| --- | --- | --- |
| **REST API v2** | `https://api.firecrawl.dev` (or a self-hosted instance) called over HTTPS with an API key | **Chosen.** The host performs the request (`ctx.network.request`), so there is no CORS, no extra process, and the key stays in the credential vault. It covers the full surface: scrape, parse, map, crawl, batch, search, extract, monitors. |
| **MCP server** | `https://mcp.firecrawl.dev/v2/mcp`, `/v2/mcp-oauth` (sign in), or keyless | **Not embedded.** The OAuth variant needs no secret, so it could be declared — but it would duplicate every tool as `mcp_plugin-firecrawl-*`, route calls around the console and run store, and move sign-in into the host's MCP settings where this plugin cannot see or revoke it. Connect it directly in an MCP client if you prefer that surface. |
| **CLI** | `npx -y firecrawl-cli@latest …`, or the ~30–43 MB standalone binary the host could install through `providers.cli` | **Not wrapped.** The CLI is a second client for the same endpoints: identical capability, plus a process spawn and a download per run. Use it in a terminal; the full reasoning is in [docs/adr/0001-firecrawl-integration-mode.md](docs/adr/0001-firecrawl-integration-mode.md), with the upstream facts in [docs/search/official-surfaces.md](docs/search/official-surfaces.md). |

So "which engine" is no longer a setting: there is exactly one path, and the key only changes your
rate limit and credit balance.

## Connecting an account

Keyless works, but Firecrawl answers only Search, Scrape and Parse that way, at a lower rate limit.
The ability page carries the account card, so the whole hand-off stays inside Astravia:

1. Click **Open firecrawl.dev** — the browser lands on the official API-key page; sign in and create a key.
2. Paste it into the card and click **Verify and save**.
3. The plugin calls `GET /v2/team/credit-usage` with the candidate key first. Only a key the upstream
   accepts is written to the host vault; a rejected key is reported verbatim and the previous
   credential stays in place.
4. The card then shows plan credits, remaining credits and the renewal date. **Disconnect** deletes the
   secret and returns to the keyless tier.

The console's connection bar reaches the same page through **Authorize** and additionally accepts a
self-hosted endpoint.


## What the plugin ships

| Extension point | What it does |
| --- | --- |
| Activity tab `crawl.console` | Connection bar (endpoint, API key), output-format picker, spider panel (page anatomy or link topology) plus Artifacts / Pages / Links / Media / Issues / Console / Chat / History tabs. Idle until a run starts; shows every admitted page, every refused page and its upstream error, and every media URL found. Every captured page is also shelved by type (Markdown, links, images, media, JSON, parsed documents), and the last runs stay on disk so their products can be reopened. |
| `ui.slot.tool-call` on `firecrawl_crawl` | The agent's crawl becomes a card in the transcript: live page counts while it runs, the tool's own result afterwards, and one click to the console anchored on the same conversation. |
| `ui.slot.input-action` "Firecrawl" | Toggle below the input bar. On: attaches the console at full width and injects crawl instructions into the next prompt. Off: detaches it. |
| `firecrawl_scrape` | One page → the formats you ask for: `markdown`, `html`, `rawHtml`, `links`, `screenshot` (optionally full page), `images`, `summary`, `json`, `audio`, `video`, `media`, `branding`, `product`, `menu`, `attributes`, `changeTracking`, `rawBase64`, plus `question` / `highlights`. |
| `firecrawl_batch_scrape` | A known URL list, as a real upstream job. `wait: false` returns an id for `firecrawl_job_status`. |
| `firecrawl_crawl` | Bounded crawl with `limit`, `maxDepth`, scope, include/exclude, sitemap mode, `prompt`, `webhookUrl`, `maxAge` and `scrapeOptions`. |
| `firecrawl_map` | URL inventory from sitemaps plus page links, up to 5000 entries. |
| `firecrawl_search` | Web search with sources, categories, domain filters and a recency window. |
| `firecrawl_extract` | Schema-shaped extraction across one or more URLs. |
| `firecrawl_parse` | A **local** document → Markdown: PDF, DOCX, XLSX, PPTX and friends, uploaded to `/v2/parse` (≤20 MB). URLs go through `firecrawl_scrape`. |
| `firecrawl_video` | Media URLs for a page, including HLS/DASH manifests, from `scrape` with the `video` / `audio` formats. Returns the signed URL; nothing is transcoded locally. |
| `firecrawl_interact` | A stateful browser session in Firecrawl's sandbox: `create` returns an id, `execute` runs Node / Python / Bash against the live page, `stop` closes it. The code never runs locally and is not echoed to the console. |
| `firecrawl_agent` | Cross-page research bounded by `maxCredits`: `prompt` plus an optional `schema`, polling `GET /v2/agent/{id}` until the run completes or hits the budget (reported as partial). |
| `firecrawl_index_search` | One tool, three corpora: `developer` (docs, issues, pull requests, readmes), `gov`, and `research` (papers, single-paper reads, citation walking). |
| `firecrawl_job_status` | Inspect, wait for or cancel a crawl/batch job. |
| `firecrawl_monitor` | Create, list, update, run, inspect and delete scheduled monitors (`scrape` / `crawl` / `search` targets with a cron or interval schedule). |
| `firecrawl_interact` | A stateful browser session inside Firecrawl's sandbox: open it once, then run code, click and read across calls, and close it. Nothing executes on this machine. |
| `firecrawl_agent` | Firecrawl's browsing agent: one plain-language question, one structured answer, with the pages chosen upstream. Bounded by `maxCredits`; long runs return a job id instead of charging twice. |
| `firecrawl_index_search` | Search curated corpora instead of the open web: `developer` (docs, issues, PRs, readmes, agent skills), `gov`, and `research` (papers, citations). |
| Skill `firecrawl` (`agent/skills/firecrawl/`) | Tells the Agent when to pick which tool and how to report limits and upstream errors honestly. |

The tab and the tools share one run store, so a crawl the Agent starts animates in the panel
instead of happening invisibly. The console target follows what you type in the chat: paste a URL
into a message and the panel adopts it before any tool call arrives. The exchange is two-way: the
agent starts crawls that light up the panel, and **Ask the agent** on any artifact sends its excerpt
back into the same conversation.

## Keyless, and what a key adds

The hosted API accepts requests with no key at a lower rate limit, so the plugin is usable straight
after install. Adding a key in the connection bar raises throughput and spends your credits.

- **Endpoint** — empty means `https://api.firecrawl.dev`; a self-hosted instance is
  `http://localhost:3002`.
- **API key** — written to the host credential vault, never to a settings file, a log, or a tool
  argument. Clearing the field keeps the stored key; emptying the vault entry removes it.
- **Rate limits and credits** are reported verbatim: `429` becomes "rate limit reached", `402`
  becomes "insufficient credits", `401`/`403` becomes "the API rejected this key".

## How a page is fetched

`scrape` sends `formats`, `onlyMainContent`, `waitFor`, `timeout`, action sequences, `proxy`,
`parsers`, `location` and `maxAge` upstream. Firecrawl does the fetching, the JavaScript rendering
and the Markdown conversion, so what arrives here is already the final document.

- **PDF / DOCX / XLSX / PPTX** go through `/v2/parse` as a multipart upload (max 20 MB per file),
  or through `scrape` when they are already published at a URL.
- **`rawBase64`** must be the only requested format; the plugin collapses the list instead of letting
  the API reject the call.
- **`audio` / `video`** come back as signed URLs that expire after about an hour. `firecrawl_video`
  reports them; it never streams, joins segments or decrypts.
- **`attributes`** takes selectors like `["a@href", "h2", ".price@data-price"]` and returns one entry
  per selector.
- **Custom headers** are forwarded to upstream, which is what makes header-gated pages work.

## Limits

These are real boundaries. The Agent is told to report them instead of guessing.

- **No local fallback.** If the API is unreachable, the tools fail with the transport reason
  (`timed-out`, `host-not-allowed`, `response-too-large`); they do not scrape the page themselves.
- **No DRM circumvention.** Protected streams are reported as protected. The plugin has no code to
  decrypt segments, and the API does not return decrypted media.
- **Login walls, paywalls and captchas are not defeated.** The crawl reports the thin or blocked
  result; `proxy` is upstream's residential routing, not a bypass this plugin builds.
- **No local scheduler.** `firecrawl_monitor` and async jobs live upstream; the plugin only calls
  them.
- **No local cache.** `maxAge` and `changeTracking` are upstream features — the plugin sends the
  parameter, it does not keep a copy of the page.
- **`robots.txt`** is enforced by default. `ignoreRobotsTxt` exists for pages you own.

## Behaviour worth knowing

- **Depth (`maxDepth`) is link hops from the start URL**, not URL path segments. `0` reads only the
  start page. The console shows the same field as `maxDiscoveryDepth`, which is the API's name.
- **`limit` caps fetched pages.** When a run stops at the limit, the console says so rather than
  implying the site has only those pages.
- **The console submits the same `POST /v2/crawl` body the agent tool does**, so a crawl started by
  hand and one started by the Agent behave identically.
- **Pages are paged by upstream.** The store drains `next` up to 20 pages per tick, so very large
  crawls show the first slice immediately and keep filling in.
- **Denied and failed pages come from `/v2/crawl/{id}/errors`**, classified by upstream's message —
  a robots refusal is shown as `deny`, everything else as `fail`.

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

```text
src/domain/firecrawl/   types, transport contract, REST client, crawl options, document shaping
src/features/           console UI: store, hooks, components
src/runtime/            plugin context singleton, host transport, connection config (settings + vault), conversation watcher
src/tools/              agent tool registrations and the argument→body translation
src/index.tsx           activation: tab, tools, input action, dispose
agent/skills/           the Agent Skill
locales/                UI strings (en, zh)
```

Upstream attribution and licence: [NOTICE.md](NOTICE.md).

## 中文

[README.zh.md](README.zh.md) — 说明这份插件做什么、行为边界与开发命令。

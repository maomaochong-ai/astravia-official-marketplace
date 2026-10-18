---
name: firecrawl
description: Read the web through the Firecrawl API: pages as Markdown plus HTML, links, screenshots, images, video/audio URLs, summaries or schema-shaped JSON. Use firecrawl_scrape for one page, firecrawl_batch_scrape for a known URL list, firecrawl_map to list a site's URLs, firecrawl_crawl for several pages depth-limited, firecrawl_search to find pages, firecrawl_extract to shape data out of URLs, firecrawl_parse for PDF/DOCX/XLSX/PPTX, firecrawl_video for a page's media URLs, firecrawl_interact to drive a stateful browser session, firecrawl_agent to research a question across pages, firecrawl_index_search for the developer/gov/research corpora, and firecrawl_job_status / firecrawl_monitor for upstream jobs and scheduled monitors. Prefer it over guessing or over raw HTTP when the user needs page content, docs pages, changelogs, a site's structure, media sources, or a document read as text.
metadata:
  version: "5"
---

# Firecrawl Connector

Turn pages into material the model can read — prose, links, media URLs, images or
structured records — and be explicit about what failed. Fetching a page is
evidence; summarizing it is inference.

Every call runs through the Firecrawl API (api.firecrawl.dev, a self-hosted instance, or the
keyless tier of the hosted one). This plugin has no scraper of its own, so there is no engine to
choose: do not offer a "local" mode, and do not ask for a `render` option.

## Pick one tool

| The user wants | Tool |
| --- | --- |
| the content of one page | `firecrawl_scrape` |
| several URLs you already have | `firecrawl_batch_scrape` |
| "what pages exist / which docs pages are there" | `firecrawl_map` |
| several pages from one site, or "crawl the docs" | `firecrawl_crawl` |
| "find pages about X" without a URL | `firecrawl_search` |
| structured fields out of one or more pages | `firecrawl_extract` |
| a PDF / DOCX / XLSX as Markdown | `firecrawl_parse` |
| the video or audio URLs on a page | `firecrawl_video` |
| a page that needs a login, a modal dismissed, or repeated clicks | `firecrawl_interact` |
| an answer assembled from several unknown pages | `firecrawl_agent` |
| "what do the issues/docs/this paper say" | `firecrawl_index_search` |
| the state of a crawl/batch job started with `wait: false` | `firecrawl_job_status` |
| a page watched on a schedule | `firecrawl_monitor` |

`firecrawl_map` returns URLs only — it never fetches content. Do not map a site
and then claim you read its pages.

## Calls that work

- Start from the exact URL the user gave. Do not guess a homepage.
- Keep defaults unless the user asked for more: 25 pages, `maxDepth` 2, sitemap on,
  main-content extraction on.
- `maxDepth` counts link hops below the start URL. `0` means the start page only.
- Raise `limit`, not `maxDepth`, when the user wants more pages of the same kind.
- Add `includePaths` / `excludePaths` (regular expressions on the pathname) when
  the user names a section, e.g. `["^/docs/"]`.
- Set `ignoreRobotsTxt` only when the user explicitly asks to bypass robots.txt,
  and say so in the answer.
- A crawl returns Markdown per page plus the counts of refused and failed pages.
  Read `/v2/crawl/{id}/errors` through the console view or `firecrawl_job_status`
  when the user expected a page that did not arrive.
- `maxAge` reuses upstream's cached copy (milliseconds) on `scrape`, `batch_scrape`
  and `crawl`; `changeTracking` reports the diff against it. Both are server-side.

### Rendering and scripting

JavaScript rendering is upstream's job — a page that draws after load still comes
back as Markdown. When a page needs a little interaction first, `scrape` accepts
`waitFor` (milliseconds) and an `actions` sequence (click, write, press, scroll,
wait, screenshot, scrape, executeJavascript, pdf). Prefer `waitFor` over guessing a
timeout; keep `actions` short and specific.

When the interaction has to survive across steps — sign in, then page through a
table — use `firecrawl_interact` instead: `action: "create"` returns a session id,
`action: "execute"` runs Node/Python/Bash inside Firecrawl's sandbox against the
live page, `action: "stop"` closes it. The code never runs locally, the session is
billed while it lives, and anything typed into the page leaves the conversation for
Firecrawl's sandbox: say that before handling a credential.

### Formats

`formats` picks the outputs: `markdown` (default), `html`, `rawHtml`, `rawBase64`,
`links`, `images`, `screenshot`, `screenshot@fullPage`, `json`, `summary`,
`audio`, `video`, `media`, `attributes`, `changeTracking`, `branding`, `product`,
`menu`. Only `markdown` is prose: the rest are structured records, URLs, images or
media, and a page whose content is a video comes back as a media URL rather than
text. Questions and highlights are not format entries — pass the `question` or
`highlights` parameter and the plugin attaches the payload for you.

- `attributes` takes selectors like `["a@href", "h2", ".price@data-price"]` and
  returns one entry per selector with the deduplicated values. Use it instead of
  HTML when the user wants "every link", "all headings" or one repeated field.
- `media` is shorthand for `video` + `audio`. Use it when the user asks "where is
  the video" or "what images does this page use".
- `rawBase64` must be the only requested format; mixing it with others makes the
  plugin collapse the list to `rawBase64` alone.

### Documents and media

`firecrawl_parse` reads a `.pdf`, `.docx`, `.xlsx`, `.pptx` (URL or local path) as
Markdown with a page/sheet count. Scanned PDFs work because OCR runs upstream — if
the text still comes back empty, say the pages are images instead of guessing.

`firecrawl_video` returns the media URLs Firecrawl found on the page, including
HLS/DASH manifests, plus the page text. The URLs are signed and expire after about
an hour: quote them, or tell the user to download promptly. Nothing is transcoded,
so do not promise an MP4 when only a manifest exists, and do not offer to
stitch or decrypt protected streams.

### Jobs and monitors

`firecrawl_crawl` and `firecrawl_batch_scrape` accept `wait: false` and return a
job id. Poll it with `firecrawl_job_status` rather than re-running the job;
`cancel: true` stops it. `firecrawl_monitor` creates a scheduled
scrape/crawl/search with a cron or interval schedule — it runs upstream, so it
keeps running after the conversation ends.

### Agent runs

`firecrawl_agent` is the only tool that answers without a URL: give it a `prompt`
and optionally a `schema` and it browses several pages itself. It is the right
call for "compare these three vendors' free plans", not for "read this page".
`maxCredits` bounds the spend; a run that reaches it comes back partial, which is
not the same as a failure — report the partial answer and say it stopped at the
budget. `wait: false` returns a job id; re-call the tool with `jobId` to collect
the result without paying for a second run.

### Curated indexes

`firecrawl_index_search` searches three corpora instead of the open web: with
`index: "developer"` for docs, issues, pull requests and readmes (scope with
`types`, `repos`, `sources` or `skillsOnly`), `index: "gov"` for public-sector
sites, and `index: "research"` for papers — where `paperId` reads one paper,
`similarTo` plus `intent` walks citations, and a plain `query` searches. Use it
when the user names one of those corpora; use `firecrawl_search` otherwise.

## Output rules

- Cite each page by URL; never merge two pages into one claim.
- If the API reports a page outside the requested scope or blocked by robots, say
  which limit applied rather than implying the site has only those pages.
- `ROBOTS` refusals are a site's stated preference: report them, do not work
  around them silently.
- An API `402` means the account is out of credits; `401`/`403` means the key is
  wrong; `429` means the rate limit was hit. Report which one it was, and say the
  keyless tier has a lower limit — do not retry blindly.
- A `timed-out` or `host-not-allowed` failure is a network boundary, not an empty
  page. Say so.

## Not this tool

- **Breaking content protection.** DRM (Widevine/PlayReady/FairPlay), encrypted
  HLS/DASH manifests, login walls, paywalls and captchas are out of scope. Do not
  offer to decrypt segments or stitch encrypted media: report that the content is
  protected and hand back what the public page does expose.
- **Configuring credentials.** The API key is entered on the ability page's
  account card or in the console's connection bar, never in a tool argument. Never
  ask the user to paste a key into a prompt.
- **Running a CLI or an MCP server.** The plugin wraps neither: it calls the REST
  API directly and does not embed Firecrawl's MCP server. If the user wants those
  surfaces, point them at `firecrawl-cli` or `https://mcp.firecrawl.dev/v2/mcp` in
  their own tool.
- A URL list the user already has, with no link-following wanted: use
  `firecrawl_batch_scrape` (up to 200 URLs) rather than a crawl.
- **Building a bypass.** Upstream's `proxy` takes `basic`, `enhanced` or `auto`;
  none of them is a tool for defeating a block the user hit on purpose. If a page
  refuses the fetch, report the refusal.

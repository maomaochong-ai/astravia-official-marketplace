# NOTICE

This plugin is an independent Astravia integration inspired by the open-source
[Firecrawl](https://github.com/firecrawl/firecrawl) project (`firecrawl/firecrawl`).
It is not affiliated with, endorsed by, or published by Firecrawl / Mendable.

## Relationship to upstream

No upstream source file is copied into this package. What is derived:

- the public decision surface users already know from Firecrawl — `scrape` / `crawl` / `map`,
  `limit`, `maxDepth`, `includePaths`, `excludePaths`, `allowExternalLinks`, `allowSubdomains`,
  `allowBackwardCrawling`, `ignoreRobotsTxt`, `onlyMainContent` — with the same field names so prompts
  and documentation transfer;
- the shape of the per-link refusal accounting (a stable code per rule) and the honesty rule that a
  crawl reports what it skipped instead of silently truncating.

The local half of this plugin is an in-process implementation written for it: no Fire Engine, no
queues, no Redis. It does include JavaScript rendering through the host browser, PDF/DOCX/XLSX text
extraction, HLS/DASH segment download and model-assisted extraction, all built on this plugin's own
code.

The other half does not reimplement upstream at all: it speaks the Firecrawl v2 REST API
(`/v2/scrape`, `/v2/batch/scrape`, `/v2/crawl`, `/v2/map`, `/v2/search`, `/v2/extract`,
`/v2/monitor`, …) and presents the responses through the same tools. Endpoint paths and request
field names follow the public API contract so an api.firecrawl.dev key or a self-hosted instance
work unchanged. Nothing from the upstream repository is vendored here.

Firecrawl's own source is AGPL-3.0; this plugin is distributed under the licence declared in
`ability.json` (`AGPL-3.0`) so the attribution obligation is honoured either way. If you
redistribute a modified build, keep this notice.

## Bundled third-party libraries

| Package | Version | Licence |
| --- | --- | --- |
| `@mozilla/readability` | 0.6.0 | Apache-2.0 |
| `turndown` | 7.2.4 | MIT |
| `turndown-plugin-gfm` | 1.0.2 | MIT |
| `robots-parser` | 3.0.1 | MIT |

The Firecrawl logo in `assets/icon.png` is the upstream project mark, used to identify the
integration. It remains the property of its owner.

## Trademarks

"Firecrawl" is used descriptively to identify the upstream project this plugin interoperates
with. No trademark licence is granted.

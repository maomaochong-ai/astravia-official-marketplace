# NOTICE

This plugin is an independent Astravia integration for the
[Firecrawl](https://github.com/firecrawl/firecrawl) project (`firecrawl/firecrawl`).
It is not affiliated with, endorsed by, or published by Firecrawl / Mendable.

## Relationship to upstream

No upstream source file is copied into this package, and no scraping engine is
reimplemented here. The plugin is a client for the Firecrawl v2 REST API:
`/v2/scrape`, `/v2/parse`, `/v2/batch/scrape`, `/v2/crawl`, `/v2/crawl/{id}/errors`,
`/v2/map`, `/v2/search`, `/v2/extract` and `/v2/monitor`. Endpoint paths and request
field names follow the public API contract, so an api.firecrawl.dev key or a
self-hosted instance works unchanged. Everything the page needs — fetching,
JavaScript rendering, Markdown conversion, OCR, proxying, job queues, monitors —
happens upstream.

What this package does own is the presentation layer: the activity-tab console, the
crawl run store that turns a job's status into the spider view, and the tool
schemas that translate an agent's arguments into request bodies. It also preserves
the decision surface users already know from Firecrawl — `limit`, `maxDepth`,
`includePaths`, `excludePaths`, `allowExternalLinks`, `allowSubdomains`,
`ignoreRobotsTxt`, `onlyMainContent`, `formats` — with the same field names so
prompts and documentation transfer.

Firecrawl's own source is AGPL-3.0; this plugin is distributed under the licence
declared in `ability.json` (`AGPL-3.0`) so the attribution obligation is honoured.
If you redistribute a modified build, keep this notice.

## Bundled third-party libraries

None. The plugin ships no runtime dependencies: HTTP goes through the host's
`ctx.network.request`, so there is no `readability`, `turndown`, `pdfjs` or
`robots-parser` in this package.

The Firecrawl logo in `assets/icon.png` is the upstream project mark, used to
identify the integration. It remains the property of its owner.

## Trademarks

"Firecrawl" is used descriptively to identify the upstream project this plugin
interoperates with. No trademark licence is granted.

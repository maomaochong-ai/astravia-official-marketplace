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

The implementation here is a smaller in-process port: no Fire Engine, no queues, no Redis, no
JavaScript rendering, no LLM extraction. Firecrawl's own code is AGPL-3.0; this plugin is
distributed under the licence declared in `ability.json` (`AGPL-3.0`) so that the attribution
obligation is honoured either way. If you redistribute a modified build, keep this notice.

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

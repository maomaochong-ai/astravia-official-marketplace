# Firecrawl for Astravia

Turns a URL into Markdown inside Astravia, and shows the crawl as a spider web you can watch.
No API key and no Firecrawl server: fetching, main-content extraction, `robots.txt` handling
and the breadth-first crawl all run in the plugin, over the host's network permission.

## What the plugin ships

| Extension point | What it does |
| --- | --- |
| Activity tab `crawl.console` | Animated spider panel plus a console stream. Idle until a run starts; shows every admitted page, every refusal and why. |
| `ui.slot.input-action` "Firecrawl" | Toggle below the input bar. On: attaches the console at full width and injects crawl instructions into the next prompt. Off: detaches it. |
| Agent tools `firecrawl_scrape` / `firecrawl_crawl` / `firecrawl_map` | Single page to Markdown, bounded same-site crawl, URL inventory. |
| Skill `firecrawl` (`agent/skills/firecrawl/`) | Tells the Agent when to pick which tool and how to report limits and `robots.txt` refusals honestly. |

The tab and the tools share one run store, so a crawl the Agent starts animates in the panel
instead of happening invisibly.

## Behaviour worth knowing

- **Depth is link hops from the start URL**, not URL path segments. `maxDepth: 0` reads only the start page.
- **`limit` caps fetched pages**, and the crawl stops at it; refusals are reported, not silently dropped.
- **Scope** comes from the start URL: a directory URL covers its subtree; a document URL widens to
  its parent directory; anything else covers itself and its children.
- **Sequential admission** — external host, backwards crawl, depth, exclude, include, social media,
  file type, `robots.txt`, duplicate — so the first matching rule is the reported reason.
- **`robots.txt` is read by default.** `ignoreRobotsTxt` exists for pages the user owns; refusals are
  never bypassed.
- **Sitemap seeding** runs before hop 1 when a sitemap is declared and `maxDepth >= 1`.
- **Static HTML only.** Pages that need JavaScript or a login come back thin; content type `text/markdown`
  is passed through, and binaries are refused with a reason instead of an empty page.
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
src/domain/            URL, denial, scrape pipeline, crawl rules (pure, unit-tested)
src/features/          console UI: store, hooks, components
src/runtime/           plugin context singleton, host HTTP client
src/tools/             agent tool registrations
src/index.tsx          activation: tab, tools, input action, dispose
agent/skills/          the Agent Skill
locales/               UI strings (en, zh)
```

Upstream attribution and third-party licences: [NOTICE.md](NOTICE.md).

## 中文

[README.zh.md](README.zh.md) — 说明这份插件做什么、行为边界与开发命令。

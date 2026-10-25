# Qiushi Illustrated Guide

Companion plugin for the **Qiushi Methodology** skill (`qiushi-skill`). It opens that
package's illustrated introduction page inside Astravia.

## What it adds

| Surface | Where | What it does |
| --- | --- | --- |
| Ability detail slot | Qiushi Methodology detail page, and this plugin's own page | A card whose button opens the illustrated page |
| Workspace view | Sidebar entry「Qiushi Illustrated Guide」 | Renders the page at full width |

Registers `ui.slot.ability-detail` twice (one registration per `abilityId`:
`qiushi-skill` and `qiushi-guide`) plus one `ui.slot.workspace-view`.

## Where the page comes from

`src/assets/preview-page.html` is a copy of
`abilities/skills/qiushi-skill/assets/preview/index.html`, bundled into the plugin at
build time. Copying is what lets the view work without knowing where the skill was
installed, on any platform, offline.

The page is rendered through `iframe[srcdoc]` with `sandbox="allow-scripts"` — its
`body` / `:root` rules must not reach the host document, and `allow-scripts` without
`allow-same-origin` keeps the frame on a unique origin while its scroll-reveal
animation still runs.

Refresh the copy after changing the skill's page:

```bash
npm run sync:preview
```

`tests/qiushi-guide.test.mjs` in the marketplace root fails while the two files differ.

## Development

```bash
npm install
npm run check   # tsc --noEmit
npm test        # vitest (jsdom)
npm run build   # vite build; dist/ is not committed
```

`@astravia-org/*` dependencies point at `../../../.tooling/open-astravia` so local
builds use the same SDK as the host; CI resolves them from the pinned tooling commit.

# Provenance

This plugin is an original Astravia implementation built against the product
described by [LogoCreator](https://github.com/Nutlope/logocreator) (an open-source
AI logo generator by Nutlope / Together AI). It is not a fork and shares no source
files with that repository.

## What came from upstream

- **The product idea and feature set.** Logos from a short brief, several
  structures and eight styles, variations per run, a brand kit with variants,
  palette and a style guide, on-device history with favourites.
- **The colour-contrast helpers' contract** (WCAG relative luminance and contrast
  ratio) — standard formulas, reimplemented here with tests.

The plugin icon **is** upstream's own mark: `assets/icon.svg` is `app/icon.svg` from the
upstream repository, copied verbatim at the plugin owner's instruction. The same file
feeds `plugin.json#icon`, the ability card and the activity-tab icon (the tab reads
`ctx.plugin.iconUrl`, so there is exactly one icon in the whole plugin).

## What is written here

Everything else. The vector engine (`src/domain/engine/`: the stroke alphabet, the
motif library, the style recipes, the SVG composer), the palette planner, the brand
kit and printable guide, the history store, the studio UI, and the agent tools are
new code written for this plugin.

The upstream app generates logos with a hosted image model and has no local drawing
engine at all; that engine is the reason this plugin works with no key and no
network. Conversely, the AI path here is optional and runs on whatever image
providers the user already connected in Astravia.

## Artwork in this package

| File | Origin | Notes |
| --- | --- | --- |
| `assets/icon.svg` | Upstream `app/icon.svg`, copied verbatim | 32×32 viewBox, indigo rounded tile with two white panes and a spark; the plugin's only icon |
| `agent/agents/logo-master.webp` | Derived from the same file | 512×512 WebP, ~37 KB — the same framing and pixel size the reference avatar uses |

The agent avatar is still derived from the owner-supplied mascot, so the assistant and the
plugin are visually distinct: the tab and the ability card show upstream's mark, the
avatar shows the character the owner chose for the agent.

`src/test/artwork.test.ts` asserts the icon exists, is an SVG, stays inside the host's size
ceiling and keeps a square viewBox.

No licence is asserted for the upstream repository's content: it does not currently ship a
`LICENSE` file. The mark is used here because the same owner maintains both projects; if
that stops being true, replace `assets/icon.svg` with an original mark before publishing.


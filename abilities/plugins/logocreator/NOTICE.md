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

Upstream's own logo is **not** shipped here. `assets/icon.png` is the mark the
plugin owner supplied for this ability (see below), so the plugin is identifiable
as itself rather than as the upstream product.

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
| `assets/icon.png` | Supplied by the plugin owner (`portrait/caterpillar-portrait-hoodie-01.jpg`) | 512×512 full square, opaque; lanczos downscale of the 1024 master; the plugin's only icon |
| `agent/agents/logo-master.webp` | Derived from the same file | 512×512 WebP, ~37 KB — the same framing and pixel size the reference avatar uses |

Both are the same mark, so the ability card, the sidebar entry and the agent avatar
never disagree about what this plugin looks like. Both are **unmasked squares**: the
host draws its own rounded container, so baking a squircle into the file would
round the corners twice. Replacing one means replacing both —
`src/test/artwork.test.ts` asserts each file exists, is a supported format, stays
inside the host's size ceiling and is square.

No licence is asserted for the upstream repository's content: it does not currently
ship a `LICENSE` file, so nothing of its own is reproduced here.

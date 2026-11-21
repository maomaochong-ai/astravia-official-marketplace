# Provenance

This plugin is an original Astravia implementation built against the product
described by [LogoCreator](https://github.com/Nutlope/logocreator) (an open-source
AI logo generator by Nutlope / Together AI). It is not a fork and shares no source
files with that repository.

## What came from upstream

- **The product idea and feature set.** Logos from a short brief, several
  structures and eight styles, variations per run, a brand kit with variants,
  palette and a style guide, on-device history with favourites.
- **`assets/icon.svg`** — the upstream application's brand mark
  (`app/icon.svg` at the pinned upstream revision), used unmodified so the ability
  is recognisable as the same product rather than an invented look-alike.
- **The colour-contrast helpers' contract** (WCAG relative luminance and contrast
  ratio) — standard formulas, reimplemented here with tests.

## What is written here

Everything else. The vector engine (`src/domain/engine/`: the stroke alphabet, the
motif library, the style recipes, the SVG composer), the palette planner, the brand
kit and printable guide, the history store, the studio UI, and the agent tools are
new code written for this plugin.

The upstream app generates logos with FLUX on Together AI and has no local drawing
engine at all; that engine is the reason this plugin works with no key and no
network. Conversely, the AI path here is optional and calls the same public
Together image endpoint the upstream app uses.

## Licensing note

The upstream repository does not currently ship a `LICENSE` file, so no licence is
asserted for its content in this plugin's marketplace metadata. If upstream adds a
licence later, this file should be updated to match, and `assets/icon.svg` reviewed
against it.

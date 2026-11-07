# Icon provenance

- File: `assets/icon.svg`
- Source: <https://www.aihero.dev/favicon.svg> — the mark AI Hero (Matt Pocock's own site) declares
  as its icon
- Retrieved: 2026-11-07 UTC
- Upstream SHA-256: `cc705ae72b1ad3ab284d1dfc9f68300267b5d7cfccc16da22007687eaaff06e3` (911 bytes,
  280 × 280)

## What was changed

Two edits, no tracing or redrawing:

1. The upstream `<style>` block was removed. It painted the path `#000` on light color schemes and
   `#FFF` on dark ones; inside a marketplace card that follows the host theme the result was either
   invisible or a flat black blob, so the fill is now a fixed color.
2. `fill` is `#2048F8`, the blue from aihero.dev's own `og:image` (dominant cluster `#2048F8`,
   hue peak 225°).

Paths, `fill-rule` and the clip path are upstream's, verbatim.

The mark identifies the author whose engineering workflows this package adapts. Matt Pocock / AI
Hero retains rights in it; the marketplace repository's MIT license does not grant independent
rights to this mark.

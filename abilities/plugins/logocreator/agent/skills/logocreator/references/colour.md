# Colour

`resolvePalette(spec)` in color-plan.ts is the only source of colour truth. Read this when the user asks for a specific colour, or when the auto result needs explaining.

## What `auto` actually does

1. **Subject anchor.** `subjectFor()` finds the subject word, and `SUBJECT_HUES` maps it to a hue:

   `cup 24 · flame 16 · paw 30 · creature 34 · spark 48 · sun 42 · book 10 · heart 350 · leaf 142 · cross 186 · droplet 190 · wave 198 · wing 200 · compass 206 · house 208 · mountain 212 · aperture 214 · gear 214 · shield 218 · pillar 222 · hex 226 · link 232 · moon 236 · orbit 250 · knot 268 · note 286`

2. **Jitter** of ±23° from `hashSeed(brandName + intent)` — so two coffee brands are both warm but not identical.
3. **Saturation and lightness by style:** luxury 34 / 42, retro 62, minimal 58, everything else 70; lightness lifts to 62 on a dark surface.
4. **No anchor** (abstract, or an unrecognised subject) → hue from the brand-name hash, 0–360.

Consequences worth saying out loud: a teahouse with `intent: "a wave mark"` comes out **cyan**, because the subject outranks the industry. If the colour looks wrong for the sector, fix the `intent` wording first.

## Contrast floors the engine already enforces

| Pair | Floor | Where |
| --- | --- | --- |
| `ink` on surface | **8:1** | `ensureContrast(…, fill, 8)` |
| `muted` on surface (taglines) | **4.2:1** | `ensureContrast(…, fill, 4.2)` |
| user-pinned primary on surface | **2.6:1** light / **2.2:1** dark | `primaryFor()` |
| user-pinned primary vs an existing colour when extracting | 1.06 | `extractPalette()` de-dup |

So a pinned hex that would vanish into the surface is **adjusted toward contrast**, not silently kept. If the user needs their exact hex (brand compliance), say that the engine raised it and hand them the adjusted value.

## Monochrome

`monochrome: true` collapses the mark to one ink (`ensureContrast(black|white, fill, 7)`) and derives secondary/accent by mixing toward the surface. It is the correct answer for: stamps, embossing, single-colour print, laser engraving, anything the user will describe as "one colour". It is **not** a greyscale filter — there is no luminance copy of the colour mark.

## Pulling a palette out of an existing image

`extractPalette()` runs on the client (`readImagePixels` → `extractPalette`):

- pixels are skipped at `alpha < 160`, `saturation < 18%`, `lightness < 8%` or `> 94%` — a logo photographed on paper returns the paper otherwise;
- hue is binned at 12° and the most populated bin wins;
- up to **three** colours are returned, each at least 1.06 contrast from the previous one;
- an image with no saturated colour returns **empty** — that is a real answer ("this artwork is grey"), not an error to retry.

Limits: max 5 MB, accepts PNG / JPEG / WebP / SVG. For an SVG source the pixels come from a rasterised copy, so gradients quantise — fine for choosing a primary, not fine for reproducing a gradient exactly.

## Rules

- **Do not invent a hex for a brand that has none.** `auto` is calibrated; a hand-picked purple is not.
- **Do not claim WCAG conformance** beyond the floors above — they cover text-on-surface, not large-text/UI-component thresholds or non-text contrast.
- **One primary per mark.** The palette has exactly one; a two-colour brand needs `secondary` used as structure, not a second primary.

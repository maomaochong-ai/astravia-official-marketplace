# Anti-patterns

Failures observed while building and rendering this engine. Each one is a rule you can check before delivering, with the mechanism that causes it.

## Composition

1. **A construction grid behind a finished mark.** `geometric` once drew a 7-line grid ornament. In a rendered sheet it read as an unfinished blueprint, and it survived into exports. Removed; `geometric` now earns its character from sharp corners and uppercase tracking only. *Rule: if an ornament would be embarrassing printed on a van, it is not an ornament.*

2. **Texture where the layout already fills the canvas.** `retro`'s halftone dot row was drawn at y≈462, which sits under an `emblem` badge and looked like a printing fault. It is now skipped for `emblem` and `icon`. *Rule: full-bleed layouts get no decorative rule.*

3. **Knockout strokes on a transparent export.** `paper`-role veins and midribs are white by design. On a `transparent` surface placed onto white they disappear, so a leaf loses its structure. Not a bug — but the kit must ship the `on-dark` variant next to it, and the reply must not claim the transparent PNG "shows the veins".

4. **Emblem + wide pictogram.** The mark is placed at 244 units inside a 196-radius ring. `wave`, `wing` and `link` collide with the ring; `leaf`, `cup`, `shield`, `spark` do not. *Rule: check the subject's aspect before choosing `emblem`.*

5. **Letter-spacing drift on centred type.** SVG adds the trailing letter-space after the last glyph, which drags a `text-anchor="middle"` run left by half a space. `textBlock()` compensates with `+spacing/2`. Any new text run must do the same, or `luxury` (+0.16 tracking) visibly off-centres.

## Type

6. **Names that outgrow the lockup.** Nothing clips; the type shrinks. A 30-character name at `icon-name` ends up at ~18 px in a 512 canvas — technically inside the canvas, unreadable in the product. Prefer `icon` + the name set by the page.

7. **Two-line wordmarks eating the tagline.** `balanceLines()` splits on spaces at >16 characters. With a tagline, the bottom 20% of the canvas gets crowded. If both matter, drop the tagline.

8. **A monogram of one lonely letter.** Single-word names of 5+ characters take first + last (`Auric` → `AC`); shorter stay single. Do not force two letters from a 4-character name — the pair reads as initials of two words.

## Colour

9. **A pinned hex that vanishes.** The engine raises it to 2.6:1 rather than shipping an invisible mark. If the user needs the literal value, hand them both numbers instead of quietly changing their brand.

10. **Auto colour fighting the sector.** The subject outranks the industry: `intent: "a wave mark"` gives cyan even for a coffee brand. Fix the wording, not the palette.

11. **Gradient at favicon size.** The favicon is 32 px; a gradient tile loses its transition. Ship the `mono` variant for small sizes and say why.

## Process

12. **Re-rolling instead of editing.** Change one field and re-render. Re-running with a new seed to "fix" a colour throws away the composition the user already approved.

13. **Claiming more than the engine drew.** No AI raster is a vector. No `emblem` name longer than 26 characters is intact. No transparent export carries white knockout strokes. State the approximation in one line rather than letting the user discover it in print.

14. **Overwriting an existing brand directory.** `logocreator_design` writes into `logos/<slug>/`; a second run must not clobber a lockup the user already accepted. Use a new `directory` or ask.

# Style fit

Eight styles, each a row in `STYLE_RECIPES` (style-recipes.ts). The numbers below are that table — quote them when explaining a choice instead of describing a mood.

| `style` | stroke | corner | weight / tracking | extras |
| --- | --- | --- | --- | --- |
| `minimal` | 8 | 0.5 | 600 / −0.02 | none |
| `geometric` | 6 | 0.05 | 700 / +0.02, uppercase | sharp corners |
| `gradient` | 7 | 0.35 | 600 / −0.01 | gradient across primary→secondary |
| `mascot` | 5 | 0.85 | 700 / 0 | ring ornament |
| `hand-drawn` | 6 | 0.7 | 500 / +0.01 | displacement wobble 2.4, paper grain |
| `luxury` | 4 | 0.15 | 400 / +0.16, uppercase, serif | double ring, gold-leaning secondary |
| `retro` | 7 | 0.3 | 700 / +0.04, uppercase, serif | rays ornament, halftone rule |
| `3d` | 8 | 0.6 | 800 / 0 | gradient + 9-unit extrusion |

## Sector → style

| Sector in the brief | First choice | Why | Second choice |
| --- | --- | --- | --- |
| software, data, security, developer tools | `geometric` | hard corners read as engineered | `minimal` |
| fintech, insurance, consulting | `minimal` or `luxury` | thin ink + wide tracking signals restraint | `geometric` |
| coffee, bakery, restaurant, craft goods | `hand-drawn` or `retro` | imperfection is the claim | `emblem` + `retro` |
| brewery, bar, law firm, heritage | `emblem` + `luxury`/`retro` | the badge is conventional and expected | `monogram` |
| fashion, beauty, jewellery, private client | `luxury` | fine stroke at large size; wide tracking | `minimal` mono |
| games, apps for children, sports teams | `mascot` or `3d` | character and volume carry personality | `gradient` |
| music, creative studio, events | `gradient` or `abstract` | colour is the message | `3d` |
| eco, wellness, food-adjacent nature | `minimal` | the subject (leaf, droplet) does the work | `hand-drawn` |

## Conflicts to call out (not to silently resolve)

- **`3d` + `luxury`.** Extrusion (9 units) and 4-unit hairlines cancel each other; one reads plastic, the other reads paper. Pick a side and say so.
- **`gradient` below favicon size.** A 32 px gradient tile loses the transition and just looks muddy. For anything that will appear at 16–32 px, offer the `mono` variant from the kit as the small-size mark.
- **`hand-drawn` + `geometric` conventions.** A wobble filter over perfectly regular geometry looks like a printing fault. Choose `hand-drawn` pictograms (leaf, cup, creature) with it.
- **`retro` on a modern SaaS brief.** It works, but only deliberately; the uppercase serif at +0.04 tracking will read as "established 1974". Confirm the user wants that.
- **`mascot` with an abstract subject.** The ring ornament frames a character well and a geometric construction poorly — pair `mascot` with a pictogram, or switch to `gradient`.

## Fitting the style to the surface

- Light surface (`#FFFFFF`): every style except `gradient` on pastel primaries, where the mark washes out. Raise `primary` contrast instead of switching surface.
- Dark surface (`#121210`): `luxury` and `minimal` need the lighter auto palette (the engine already lifts lightness for dark); `retro`'s warm serif on near-black reads well and is the one place warm browns survive.
- Transparent export: `paper`-role knockout strokes become white by design, so any motif with internal veins loses them on white placement. Ship the `on-dark` variant alongside.

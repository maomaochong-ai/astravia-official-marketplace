# Deliverables

What the kit contains, what each file is for, and which export answers which request. Read this before telling a user what they will receive.

## The kit (from `logocreator_brand_kit`, or the panel's brand-kit dialog)

| File | Format | Use it for |
| --- | --- | --- |
| `logo.svg` | SVG, transparent | the default vector everywhere |
| `logo-mark.svg` | SVG, transparent, mark alone at 84% | favicon source, avatar, merch patch |
| `logo-on-light.svg` | SVG composed on white | documents, invoices, light UI |
| `logo-on-dark.svg` | SVG composed on `#121210` **with the dark palette** | dark UI, photography, signage |
| `logo-transparent.svg` | SVG, no background | placing yourself in a layout tool |
| `logo-mono.svg` | SVG, one ink | stamps, embossing, one-colour print |
| `logo-512.png` / `logo-1024.png` / `logo-2048.png` | PNG, transparent | slide decks, social, print at moderate size |
| `logo-on-light.png` / `logo-on-dark.png` | PNG, 1024 | quick paste where SVG is refused |
| `favicon-32.png` / `favicon-64.png` | PNG of the **mark alone** | browser tabs |
| `apple-touch-icon-180.png` | PNG, on-light | iOS home screen |
| `brand-colors.css` | `--brand-{primary,secondary,accent,ink,muted}` | wiring the brand into a site |
| `brand-colors.json` | hex + RGB + role | design tools, scripts |
| `brand-guide.html` | 5-page A4 print sheet | open → Print → Save as PDF |
| `brand-board.svg` / `brand-board.png` | 1600×1000 board | a single image to send someone |
| `README.txt` | plain text | whoever opens the zip first |

The four variants are **composed, not tinted**: `logo-on-dark.svg` re-renders with a palette resolved for a dark surface, so knockout shapes are dark rather than white. Do not describe them as "the same logo on four backgrounds".

## Which request maps to which file

| The user says | Give them | Do not give them |
| --- | --- | --- |
| "a logo for my site" | `logo.svg` + `brand-colors.css` | a PNG (SVG is smaller and sharper) |
| "app icon" | `logo-mark.svg` + `apple-touch-icon-180.png` | the full lockup |
| "favicon" | `favicon-32.png` / `favicon-64.png` | a downscaled lockup |
| "print it on a mug / signage" | SVG only, and check the `mono` variant if single-colour | any PNG above 2048 |
| "business card / letterhead" | `logo-on-light.svg` + the guide | the transparent variant alone |
| "brand guidelines" | `brand-guide.html` (print to PDF) | a description of the guidelines |
| "what colours are we using" | the five hexes from `palette` in the tool result | a guess from the screenshot |

## The raster limit

`logocreator_design` and `logocreator_brand_kit` are vector-only. The AI path (`generateMarksWithHost`, which spends the host's own image providers) returns a bitmap: it stores one PNG blob, has no SVG, no variants, no guide, and cannot be rebuilt at a larger size. When a user plans to print, emboss or embroider, the AI result is the wrong deliverable — say that before they fall in love with it.

## Where files land

- Tools write into `<cwd>/logos/<slug>/` (`-brand-kit` suffix for the kit). Slug is the brand name lowercased with runs of non-alphanumerics replaced by `-`.
- Panel exports go through `fs.saveAs`, i.e. the **user's** save dialog. The tool result reports the chosen path; a `null` means the user cancelled, not a failure.
- `brand_kit` sets `pngSkipped: true` when the host has no canvas. The vector and text files are still written; tell the user to press the panel's PNG button rather than claiming the kit is complete.

## Before you report

1. The file list you claim must match the tool result's `files` array. If it says 21 files, do not say "the full kit" while listing three.
2. Name the resolved `subject` — it is how the user learns the brief was read as a leaf and not a flame.
3. Quote the palette hexes, not "a warm green".
4. If anything was approximated (CJK monogram, truncated arc text, raised contrast), put it in one sentence at the end.

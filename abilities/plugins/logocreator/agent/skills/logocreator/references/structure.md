# Choosing the structure

Read this before `logocreator_design`, when the user has not already named a type.

Six types. The choice is driven by **where the mark will live** and **what the name can carry** — not by what looks impressive in a 512 px preview.

| `type` | Draws | Right when | Wrong when |
| --- | --- | --- | --- |
| `icon` | mark only, centred at 74% | app icon, avatar, favicon, merch patch | you also need the name read somewhere near it |
| `icon-name` | mark at 56% above the wordmark | the default: storefront, deck cover, invoice header | a square slot (icon) or a single-line header |
| `wordmark` | type only, with a 124-unit rule | the name *is* the brand (Paperline, Vellum) | the name is generic ("Studio") or very long |
| `monogram` | initials from the stroke alphabet | 2-letter marks, seals, favicons for long names | a one-letter brand, or a name whose initials read badly (S.S., A.A.) |
| `emblem` | badge ring, name on the top arc | hospitality, law, breweries, heritage, "EST." | names over ~26 characters, or a UI where a circle wastes space |
| `abstract` | geometric construction | tech, finance, sound, anything without an object | the brief does name an object — pick that pictogram instead |

## Constraints the engine actually enforces

`planWordmark()` (compose.ts) fits the name into 80% of the canvas and **shrinks the type** to fit; it does not clip. Consequences:

- Names over ~16 characters with spaces are split onto **two lines** (`balanceLines()`), which pushes the tagline down. That is fine — but a 3-word name plus a tagline starts to crowd the bottom 20% of the canvas.
- 30+ characters at `icon-name` gets small enough that the wordmark stops being readable at 32 px. Switch to `icon` and set the name in the page instead.
- `wordmark` uses a 96 px base size against a 78%-width budget, so short names look confident and long ones look squeezed. Below ~7 characters, `wordmark` usually wants a `monogram` or `icon` companion.

`emblem`:
- the top arc truncates at 26 characters, the bottom tagline at 30;
- the mark is placed at 244 units inside a 196-unit radius ring — a wide horizontal pictogram (wing, wave) will collide with the ring where a compact one (leaf, cup, shield) will not;
- long names on an arc are hard to read; if the name is over 18 characters, prefer `icon-name`.

`monogram`:
- `initialsOf()` takes the first letter of up to two words ("Fern & Field" → FF, "Northpeak Systems" → NS); a single word of 5+ characters takes first + last ("Auric" → AC); shorter stays single ("Moss" → M);
- the alphabet covers **A–Z and 0–9 only**; a CJK initial falls back to one set character (`cjkInitialSvg`), which is intended behaviour, not a failure;
- letters are drawn at 78% of the style's stroke weight, so `luxury` (stroke 4) gives a very fine monogram — check it at favicon size before shipping.

## Defaults worth keeping

- **No structure named → `icon-name`.** It is the only type that survives being pasted almost anywhere.
- **Square slot → `icon`.** Never crop a lockup into a favicon after the fact; the engine already composes the mark alone at 84%.
- **Badge-shaped request ("badge", "seal", "crest", "stamp") → `emblem`.** The word in the brief is the signal.

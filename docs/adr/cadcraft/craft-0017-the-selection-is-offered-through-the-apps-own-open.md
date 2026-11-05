# 0017 — The selection is offered through the app's own Open, and nothing claims success it did not measure

Status: accepted
Date: 2026-11-05

## Context

0016 removed the plugin's own Recent list and left opening to "the host and the Agent's
`stage` + `act` tools". That answer was incomplete in one everyday case: a user selects an
image in the Explorer, opens the panel, and gets an empty editor. Nothing in the tab ever
offered the selected file, so the panel was the only place in the product where the current
selection did not travel with the user.

The obvious repair — stage the bytes and press the app's open shortcut — rests on an
assumption that turned out to be false. Upstream has **no** keyboard binding for File ›
Open: the only `Modifiers::COMMAND` chord in `crates/ui-egui` is `Key::N` in
`new_layer_button_tests.rs`, and the menu bar assigns mnemonics (`N/O/R/C/A/S/V`) rather
than chords (`crates/ui-egui/src/menus/menu_keys.rs`). egui also folds ⌘ and Ctrl into the
same `Modifiers::COMMAND`, so the `ctrl+o` the old tool sent was wrong on a Mac and useless
everywhere.

Two more things were measured rather than assumed:

- a frame handle exists before the page is listening, so a `post` fired on activation is
  silently dropped; the old code reported `frame-gone` for what was really "not yet";
- upstream does read dropped files (`crates/ui-egui/src/app/frame.rs` `raw.dropped_files`,
  `file_open.rs::open_dropped_file`), which needs no menu, no binding and no focus.

## Decision

**Opening is a ladder, and every rung is verified by the canvas.**

1. `drop` — a synthetic `dragenter`/`dragover`/`drop` carrying a real `DataTransfer`.
2. the platform's open chord — `meta+o` on a Mac, `ctrl+o` elsewhere, then the other one.
3. `alt+f`, then `o` — the menu bar's own mnemonic path.

The last two rungs work because the bytes are already staged: when the app opens its own
file dialog (`rfd` on the web click a hidden `<input type="file">`), the bridge answers
that click with the staged file, so the dialog never appears and the app receives exactly
the document the user selected.

Each rung is followed by `craft:probe` and compared with a baseline taken before staging, so
`opened` is true only when the canvas measurably changed. The result always carries
`attempts`, and a ladder that reaches the end leaves the bytes staged: the app's own
File › Open then opens the right file, and the tool says so instead of guessing.

**The selection is offered once, when the tab wakes.** A selection that changes while the
panel is visible is just a selection; pushing it into whichever editor happens to be open
would replace the document the user is working on. So: on the first `ready` of a wake-up,
if exactly one file is selected and it is not already the bound document, its bytes are
staged and the ladder runs. Failure leaves a notice pointing at the app's own Open, not an
error dialog.

**Delivery is retried, gestures are not.** `askCraftFrame` retries only the requests that
can be repeated without consequence (`craft:inspect`, `craft:stage`, `craft:unstage`,
`craft:probe`, `craft:capture`); `craft:act` and `craft:key` fire once, because sending a
click twice is a different request.

**A stage expires.** The bridge holds staged bytes for two minutes and `craft:unstage`
clears them; a leftover stage would otherwise be consumed by an unrelated later Open.

## Consequences

- The tool descriptions changed with the behaviour: `open_editor` no longer says it leaves
  the selection alone, and `open_document` no longer promises that a changed canvas means a
  loaded file. `opened`, `step` and `attempts` are reported as measured.
- `describeDelta` and `readCanvas` live in `services/open-document.ts` and are shared with
  `craft-tools`, so there is one definition of "the canvas changed", not two.
- No per-app extension table was added. Fifteen reliable format lists could not be derived
  from the upstream sources without guessing, and a wrong list would silently refuse to open
  the file the user asked for. The ladder simply offers whatever the user selected.
- What remains unverified is whether a real WASM egui build consumes any of the three rungs;
  the ladder reports what happened instead of asserting it, and the fallback is the app's
  own Open with the bytes already waiting.

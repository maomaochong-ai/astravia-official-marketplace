# 0022 — A document outlives its tab

- **Status:** Accepted
- **Date:** 2026-11-06
- **Context:** craft 系列 0.0.20 → 0.0.21
- **Related:** [0017](craft-0017-the-selection-is-offered-through-the-apps-own-open.md) — how a document gets in

## The situation

Two complaints that looked unrelated, and were not:

1. **The artifact vanished.** An Agent opened a file, the panel showed it, the user closed the tab to
   do something else, and came back to an empty canvas with no way back except opening the Explorer
   and dragging the file in again. The file had never moved — the *frame* had been destroyed, and
   the wasm app's state died with it. The only thing missing was the path.
2. **The text looked broken.** Chinese characters arrive as boxes or as Japanese glyph variants;
   users reasonably read that as a corrupt file, and a model that also reads it as corruption will
   keep rewriting the bytes, which changes nothing and burns the turn.

## The decision

- **Remember the path, in the project.** `.craft/last-document.json` (an existing directory, an
  existing permission) holds `{ path, name, mime, at }`. It is written whenever a document is
  actually opened — by the tool *and* by the host selection path — and only when the canvas
  reported `opened: true`. A staged-but-unopened file is not the document on screen.
- **Restore once, quietly.** After `phase === "ready"` and `awake`, if nothing is bound yet and the
  host is not currently offering a selection, the panel reads the memory and opens that file through
  the same three-rung `openDocument` path. Success is a single notice line ("Reopened {name}"), not
  a dialog and not a new tab.
- **Never over a fresh instruction.** A file selected in the Explorer wins; the memory is a
  fallback, not an override. `.craft/last-document.json` older than seven days is ignored — a stale
  memory of last week's work is noise.
- **Say what the glyphs are.** `_open_document` now returns a `glyphs` note on success, and the
  skill states the fact plainly: the web build bakes Latin plus one Japanese face into the wasm, so
  CJK-only forms have no glyph to draw. The bytes are correct; rewriting them is not a fix.

## What this does not do

- **It does not fix the glyphs, and it cannot.** The font atlas is compiled into upstream's wasm;
  adding a CJK face means rebuilding it with an excluded family, which upstream's own asset policy
  forbids — and this repository ships upstream's build unmodified (ADR 0011). The honest answer is
  "this is how the web build renders", not a patch.
- **It does not restore unsaved edits.** Only the path comes back; whatever was on the canvas and not
  written to a file is gone. Said differently: it restores the document, not the session.
- **It does not track moves or renames.** If the file is renamed in the Explorer, the memory points at
  a path that no longer exists; the restore then silently does nothing.
- **One document only.** No history, no recent list — the host owns that concept (ADR 0014).
- **The write is best-effort.** A failed memory write is swallowed: a lost memory is not a failed
  open.

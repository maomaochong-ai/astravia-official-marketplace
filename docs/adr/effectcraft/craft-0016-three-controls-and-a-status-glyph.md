# 0016 — Three controls, one status glyph, and no Recent list

Status: accepted
Date: 2026-11-05
Supersedes the UI entry of 0014

## Context

0014 established that a craft app cannot read an absolute path: upstream's Recent list
hands the path to `std::fs`, and the browser build answers `files are opened through the
browser on the web`. This plugin therefore kept its own list — a stored array of workspace
paths, a dropdown in the status bar, and an open path that staged bytes and pressed the
app's own `Ctrl+O`. That worked, and it was one more thing to load, write and explain in
every tab.

Two things changed the answer.

First, the host already owns navigation. Files the user wants to reopen live in the
workspace tree, the explorer, and the conversation; a per-tab list of eight paths is a
second, narrower copy of something the user can already see. The bar around the frame
exists to say whether the engine is up and to offer the two controls the frame cannot
offer itself — not to become a file switcher.

Second, the fifteen plugins have to look like one product. Every control in that row is a
place where fifteen copies can drift. The Recent dropdown was the only one that opened a
menu, remembered state and loaded from storage at mount, so it was both the heaviest and
the least necessary.

## Decision

The status bar carries exactly three controls:

1. **Readiness** — a non-interactive glyph in a `role="status"` span: a check when ready,
   a clock while preparing, an exclamation when failed. The backend the page reports rides
   in its tooltip, so the row keeps the same width in every state and the palette stays
   three tones (emerald / amber / rose) on the frame's own `#0b0d10`.
2. **Full screen.**
3. **Reload.**

Everything else is gone: the Recent menu, its component, its storage reads and writes, the
strings that described it, the two-line `setSavedAt`/`setNotice` pair the save path had
accumulated, and the `storage.read` / `storage.write` permissions the list existed for.
Opening a file is the host's job and the Agent's `stage` + `act` tools' job; the tab opens
what it is given.

The boot cover loses its motion for the same reason: a spinning arc and a pulsing shimmer
competing with a bar that legitimately stalls at 90 % reads as two clocks. One 3 px track,
one flat accent fill, five ticks a second, and the phase text carries the state — identical
in all fifteen apps.

## Consequences

- 0014's *reasoning* still holds and its document is unchanged: the app cannot read the
  path, so the plugin must not pretend to. What changes is the conclusion — the right
  response is to stop offering the list, not to rebuild it.
- `recent-files-menu.tsx` is deleted in all fifteen plugins, and `craft-parity` keeps them
  honest: the shared shell is compared file by file, so a plugin that reintroduces a
  one-off control fails the test.
- The first save of a document no longer records anything beyond its binding. A user who
  wants to reopen the file uses the workspace, which is where the path came from.
- The tab no longer reads plugin storage at mount, which removes a synchronous-looking IO
  from the path that fifteen plugins walk when a workspace is opened.

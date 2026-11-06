# 0021 — The canvas is clicked, not covered

- **Status:** Accepted
- **Date:** 2026-11-06
- **Context:** craft 系列 0.0.20 → 0.0.21
- **Supersedes:** [0018](craft-0018-the-header-became-a-corner.md) — the corner dock is gone

## The situation

ADR 0018 replaced a full-width header with a small floating dock, and left it visible whenever the
pointer was near. That traded one occlusion for another:

- The dock sat exactly where upstream draws its own history and zoom controls, so on most screens it
  hid a control to offer four.
- `pointer-events: none` was tried and rejected: in Chromium it also disables `:hover`, so the dock
  could be seen or clicked, never both.
- Worse, "hand this page to the AI" was the only granularity: the whole canvas, or nothing. A user
  pointing at one column of a slide had no way to say *which* part they meant.

## The decision

**Nothing floats over the canvas any more.** `editor-dock.tsx` is deleted; every control it carried
moved into a right-click menu that exists only while it is open.

- **The page forwards the right-click.** Pointer and `contextmenu` events inside a cross-document
  iframe do not bubble to the parent, so a listener on the shell cannot see them. `host-bridge.js`
  — which already lives inside the frame — listens in the capture phase, maps the point to
  fractions of the canvas, and posts `craft:contextmenu`. The shell answers with
  `frame-menu.tsx`. The measured cost of a right-click is zero pixels when it is not open.
- **`Shift` + right-click is handed back upstream.** The bridge returns early when `shiftKey` is
  set, so the app's own context menu still exists for anyone who wants it.
- **Choosing an area is a real gesture.** `region-marquee.tsx` covers the frame with a
  crosshair layer; the drag rectangle is normalised and clamped to the canvas, `Esc` cancels, and a
  drag smaller than 2 % of either axis is treated as a click, not an area. The result goes through
  `captureRegion` — the same `craft:capture` path that already accepted fractional `region`
  coordinates — and lands in `.craft/shots/` with a one-line lead in the message box.
- **The status strip stops being a log.** `activity-strip.tsx` used to keep a note for 20 s after the
  work finished. It is now visible only while something is running
  (`visible = progress !== null || queued`), so the bottom-left corner is empty when the editor is
  idle. The same history still reaches the Agent as a prompt attachment, at zero pixel cost.

## What this does not do

- **Element-level selection is impossible.** The editor is a single wasm surface; there is no DOM
  element per shape to hand over. The smallest unit is a rectangle. Anything finer needs an API
  from upstream, and upstream has none.
- **The app's own context menu is one keystroke away, not on the plain right button.** That is a real
  behaviour change and it is written into the skill so the model does not promise otherwise.
- **The strip no longer leaves a trace.** A run that finished is invisible; do not describe it as
  "logged in the corner".
- **Nothing here is verified in a live host.** Whether `craft:contextmenu` arrives, whether the
  marquee reliably intercepts pointer events above the frame, and whether the menu lands off-screen
  on a small panel are all unobserved outside unit tests.

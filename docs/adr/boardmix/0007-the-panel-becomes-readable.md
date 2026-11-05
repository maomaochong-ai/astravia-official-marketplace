# 0007 — The panel becomes readable, and the reply stays honest

- **Status:** Accepted
- **Date:** 2026-11-06
- **Supersedes:** part of [0002](0002-the-panel-is-a-webview-not-a-canvas.md) — the sentence
  "the agent cannot read, click or export the canvas" is no longer the whole truth
- **Context:** `boardmix` 0.0.2 → 0.0.3

## The situation

This plugin was built around a `<webview>` pointing at boardmix.cn, and the agent's reach stopped at
the address bar: `boardmix_open`, `boardmix_goto`, `boardmix_new`, `boardmix_ai`,
`boardmix_tab_status`, `boardmix_open_in_browser`, `boardmix_automate`. Every tool moved the page;
none touched it. So the guide and the skills said, correctly at the time, that the agent could not
read the canvas, could not click, and must not describe a board it had never seen.

That was a choice about which primitives to call, not a property of the embed. A Electron
`<webview>` exposes three methods this plugin never used: `executeJavaScript`, `capturePage` and
`sendInputEvent`. The host runs with `webviewTag: true` and no `will-attach-webview` interceptor, so
they are present on the element.

## The decision

Use them, through one handle, with the gaps named instead of papered over.

1. **`read`** runs a **fixed** script (`PAGE_OUTLINE_SCRIPT`) inside the guest document and returns
   an outline: address, title, `login`, viewport, scroll, page text, and up to 120 controls with the
   **centre point of each** in viewport CSS pixels. The model never supplies JavaScript — a tool that
   executed model-authored code in a page holding the user's session would be a different product.
2. **`shot`** calls `capturePage()` and writes the PNG into the project, then hands the same path to
   `ui.previewFile` so the person sees it too.
3. **`input`** translates a small step vocabulary (`click`, `move`, `type`, `key`, `scroll`, `wait`)
   into `sendInputEvent` calls. `eventsFor` is a pure function: a click is always
   `mouseMove → mouseDown → mouseUp`, a double click is two pairs, `type` is one `char` per code
   point, a modified `key` sends no `char` so ⌘K stays a shortcut.
4. **Coords are the same coordinates.** The outline reports element centres in the guest's viewport
   space, which is what `sendInputEvent` consumes. No scale factor, no offset, no DPI arithmetic —
   which is exactly why the model is told to take `x,y` from `boardmix_read` rather than guess.

### All three, or none

`primitivesOf(element)` returns a handle only when all three methods exist; `missingPrimitives`
names the ones that do not. When the set is incomplete every surface tool answers
`{"ok":false,"reason":"primitive-unavailable","gaps":[…]}` instead of half-working. A read that
works and a click that silently does nothing is worse than a clear "this host cannot do it yet",
because the model will report success.

### What the boundary still is

The canvas is pixels. Boardmix renders boards into a surface where a sticky note is not a DOM node —
`boardmix_read` proves this by returning zero controls on a board screen whose toolbar is fully
outlined. So:

- **read** describes the *page*: menus, dialogs, tabs, inputs, buttons.
- **shot** is how the model sees the *drawing*, and it must say so — "the screenshot shows three
  sticky notes", not "the canvas contains three sticky notes".
- **clicking a shape** is possible but a guess about pixels; UI targets are the trustworthy ones.

The guide, the four sibling skills and the tool descriptions were rewritten to say exactly this.
The old sentence was removed everywhere it appeared, because a stale "I cannot see it" in a skill is
just as misleading as a fresh "I saw it".

## Costs

- Two new permissions: `fs.read` (to hand a path to the previewer) and `fs.write` (to write the
  PNG). Users see a permission diff on upgrade.
- Three new tools in a plugin that already had seven. The surface is genuinely three verbs —
  look, capture, act — and merging them would hide which one failed.
- Screenshots accumulate in `.boardmix/shots/`, capped at four.
- `setPromptAttachment` gets a picture's path, not a picture.

## What this does not do

- **It does not read boards as data.** No node tree, no text extraction, no "list the shapes".
- **It does not guarantee a click landed.** The events are synthesised at the guest's input layer;
  a page that ignores them looks identical to a page that acted. Hence `boardmix_act` always
  reports its steps and tells the caller to read or capture afterwards.
- **It does not survive a login wall.** `read` reports `login: true`; signing in stays the user's.
- **It was not verified against the live host in this environment.** No runtime where the webview
  guest was attached was available, so the three primitives are capability-checked at mount and the
  refusal path is the tested one.

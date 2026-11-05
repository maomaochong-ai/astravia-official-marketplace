# 0018 — The header became a corner, and the batch became readable

Status: accepted
Date: 2026-11-05
Supersedes 0016

## Context

0016 gave the tab a bar with exactly three controls: readiness, full screen, reload. Three
is a small number, and it was still the wrong shape. The bar was 28 px of permanent height
above a canvas whose whole point is to show a document, and two of its three controls were
duplicates: full screen is `F11`/`⇧⌘F` everywhere, reload is what the browser menu already
does to a frame.

The readiness glyph was the interesting case. It said "ready" after the page had drawn its
first frame — but by then the boot cover is gone and the canvas is visibly *there*. A state
indicator whose only remaining job is to agree with the thing you are looking at is
decoration, and decoration that fifteen plugins must keep identical is a liability.

The same row was carrying two things that did matter: the name of the document in the frame,
and the last thing that went wrong ("waiting for you to pick a file in File › Open"). Deleting
the bar without an answer for those would have made the tab quieter and less informative at
the same time.

Separately, the Agent could drive the editor but the user could not see it driving. `act`
returns a JSON document — forty lines of step indices, labels and hex colours — and the host
prints it as text in the transcript. The one thing a person wants from a batch, "what did it
just do, and did it work", was the one thing the interface did not say.

## Decision

**The bar is gone in all fifteen plugins.** `editor-status-bar.tsx` is deleted. The two
actions it held move into a corner overlay, `editor-dock.tsx`: bottom-right of the canvas
area, `opacity-45` at rest, `opacity-100` on hover or keyboard focus. Not hidden-until-hover —
an invisible button is a button nobody finds — and not always-solid, which would be the bar
again in a different corner.

They are also bound as shortcuts, in a `surface` scope: `mod+shift+r` reloads,
`mod+shift+f` toggles full screen. The scope is registered once and gated by
`enabled: () => everActive.current ? tab.active : true`, re-evaluated on every keydown, so a
mounted-but-hidden tab cannot answer for the editor that is actually on screen. `mod+shift`
rather than `F11`/`F5`, which are media keys on macOS and are already claimed elsewhere.

**What the bar was saying now goes two ways, neither of which costs height.**

- *Into the prompt.* The tab holds a sticky prompt attachment
  (`astravia.craft.editor-state`, version 1) whose `context` carries the app id, the bound
  document's name and workspace path, the phase, the backend the page reported, and the last
  six entries of its activity log. The host delivers that as a hidden
  `<plugin_prompt_contexts>` record — data, explicitly not instructions — so "make this
  banner match the one on the left" has an answer without the user explaining which file is
  open.
- *Into the transcript and the corner.* A batch's result is rendered by a tool-call slot
  (`toolName: <id>_act`) as a step timeline: one row per step with the label the Agent wrote,
  a tick or a cross, the measured canvas change, and the elapsed time.

**The page keeps its own log.** The bridge gained `note(kind, detail, ok)`: forty entries in a
ring, pushed to the host as `craft:note` the moment they happen, and readable on demand with
`craft:activity` (idempotent, so the request layer may retry it). Entries are
`{ at, kind, detail, ok }` — a **kind**, never a sentence, because the frame has no locale;
the tab composes the words. The kinds are `open`, `stage`, `drop`, `step`, `done`, `key`,
`type`, `notice`. `editor_status` reads the same log, so the Agent's picture of the tab comes
from the page rather than from inference.

`ActivityStrip` draws the tail of that log in the bottom-left corner: the running step plus
the last three entries, gone after six seconds. A `notice` is the exception — it is an
instruction, not an event, so it stays until the page does something else.

Three permissions are added to match: `ui.slot.input-action` (which also gates
`setPromptAttachment`), `ui.slot.tool-call`, and `ui.shortcuts.register`.

## What this does not do

**There is no per-tab context menu.** The request was to move reload and full screen into the
right-click menu of each plugin tab. The host does not offer that to plugins: there is no
permission for it in `permissions.ts`, `PluginActivityTabContribution` has no menu extension
point, and `ActivityTabContextMenu.tsx` renders a fixed list of five close-and-reveal items.
Two workarounds were considered and rejected:

- a global overlay slot capturing `contextmenu` would produce *two* menus (the host's own
  still opens, and a plugin cannot dismiss it), and
- forwarding `contextmenu` out of the frame would swallow the app's own right-click menu —
  which is upstream's menu, the thing this plugin exists to preserve.

So the entry point is the corner dock plus the two shortcuts, and this document says so
rather than implying a menu exists.

There is no sixth tool. `craft-tools.ts` argues for five per app; a user-facing reload is a
button and a keystroke, and an Agent that needs the tab fresh can call `open_editor` again.

## Consequences

- Fifteen plugins lose a file and gain two components; `craft-parity` keeps the shell
  byte-identical across them, and the bridge test now covers the log (push order, the raw
  subject, `limit`, and the empty case).
- The activity log lives in the page, which means it dies with a reload. That is correct: it
  describes a page that no longer exists. `reload()` clears the host-side copy for the same
  reason.
- The tool-call slot **replaces** the host's default rendering, so `ActTimeline` falls back
  to the raw result text for pending, empty, malformed and error shapes. A slot that swallows
  a result is worse than a slot that prints JSON.
- `setPromptAttachment` runs on every change of document, phase, backend or log, and clears
  itself on unmount. A sticky attachment outliving its tab would leave a chip in the input
  bar pointing at nothing.
- The strip is deliberately not a notification system: it shows three entries for six
  seconds. Anything that must be true later belongs in the attachment, which the Agent reads
  and the transcript keeps.

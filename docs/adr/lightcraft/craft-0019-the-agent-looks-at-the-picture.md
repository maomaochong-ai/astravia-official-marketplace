# craft-0019 — The agent looks at the picture

- **Status:** Accepted
- **Date:** 2026-11-06
- **Supersedes:** nothing (extends [craft-0018](craft-0018-the-header-became-a-corner.md))
- **Applies to:** all fifteen craft plugins

## The situation

A tool result reaches the model as text. `probe` was built around that constraint and it is a
good tool for it: a letter map plus a mean colour tells an empty frame from a photograph and a
blue background from a grey one, in a few hundred bytes. Asked "is the header aligned", "is the
type too tight", "why does this gradient band", it has nothing to say. Those judgements live in
the pixels, and pixels do not survive a JSON string.

The editing loop had the same hole from the other side. The user watched a canvas while the model
described it from a 32×18 grid of letters. Whatever the model concluded, the person could only
check it by looking at the same canvas and guessing what the model had seen.

## The decision

Two captures, one file, two audiences.

1. **`craft:capture`** already existed in the page bridge: the canvas is rasterised and handed
   back as bytes. The tool writes those bytes to `<cwd>/.craft/shots/` — inside the open project,
   where `ctx.fs` is allowed to write and where a person would expect a screenshot to land.
2. The path comes back in the tool result as `shot`. The model reads that file with its own file
   tools, at full resolution, and answers from the actual image.
3. The same path is handed to `ui.previewFile`, which opens it in the host's **own** previewer.
   The person sees exactly what the model is looking at, inside Astravia, without opening a
   file manager.

Neither half is a new mechanism. The capture is upstream's rasteriser doing what it always did;
the previewer is the host's file viewer. What is new is that the two are pointed at the same PNG
in the same turn, so "the agent says the layer is misaligned" and "the layer looks misaligned"
stop being two separate claims that nobody reconciles.

### Why not a card under the message

The SDK has `registerCardRenderer`, and the presets use it — a card can hold an image and ride a
message. It is unavailable here: per `ui.d.ts`, *"plugin tools cannot emit `details.cards`, so the
message card system (registerCardRenderer) does not serve them; the tool-call slot does."* A
plugin's own tool has no card channel. `registerToolCallSlot` is the supported route, and it is
already carrying the run timeline; a thumbnail inside a tool row is not where a 1400×900 canvas
belongs.

`previewFile` is the other supported route and it is better than a thumbnail: the host's previewer
is full-window, handles zoom and pan, offers "show in Finder", and takes a group of files so a
before/after pair can be stepped through with arrows.

### Why the preview is best-effort

```ts
const ui = ctx.ui as { previewFile?: … };
if (typeof ui.previewFile !== "function") return false;
try { ui.previewFile({ path, name, mimeType: "image/png" }); return true; }
catch { return false; }
```

Three things can make this not happen and none of them is the model's problem: an older host that
predates `previewFile`, a path the host declines to read, and a user who already has the previewer
closed. A working tool that fails because a courtesy call threw would be worse than no courtesy
call. The result therefore carries `previewed: true|false`, and the tool description says the user
sees the editor — not that they *always* will.

`previewFile` with a local `path` requires `fs.read`, which every craft plugin already declares for
`craft-tools`' workspace reads. No new permission, so no new consent prompt for something as small
as "show the screenshot".

### Why the shots are rotated

`KEEP = 6`, newest first, deleted from the same directory. A debugging aid that quietly fills a
repository with a hundred PNGs is worse than no aid; six is enough to compare "before I clicked"
with "after I clicked" and to look back one step. The directory is `.craft/shots/`, project-local,
and therefore already ignored by anything sensible.

## Costs

- Each `probe`/`act` call now writes one PNG of roughly 100–800 KB. With `KEEP = 6` the ceiling is
  a few megabytes, and the writes are sequential with the capture, not extra round trips.
- A capture takes long enough to notice on a large canvas (the timeout is 30 s, and it is a
  rasterisation, not a screenshot of the window). The text probe still resolves first and stays
  the cheap reading; a caller that wants only the map passes `shot: false`.
- The previewer opening on every call is a visible side effect. `preview: false` turns it off;
  the default is on because the whole point is that the person sees what the model sees.

## What this does not do

- **It does not let the model drive the canvas.** Capture is read-only. Clicking still goes through
  `act`, which sends synthesised events into the page; a capture never became one.
- **It does not make the canvas queryable.** There is no layer tree, no text extraction, no
  "list the objects". The model reads a picture and reasons about it, with everything that implies
  about being wrong.
- **It does not put the image in the transcript.** Tool results are text; the picture arrives as a
  path to read plus a previewer window. A plugin cannot post an image into the conversation.
- **It does not survive a GPU-less capture.** If the rasteriser returns a blank frame the PNG is
  blank and the model will say the canvas is blank, because from where it stands it is.

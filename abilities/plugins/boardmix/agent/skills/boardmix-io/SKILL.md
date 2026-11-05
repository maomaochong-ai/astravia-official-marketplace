---
name: boardmix-io
description: "Move files in and out of Boardmix: import PPT/PDF/images/Mermaid/PureRef, export PNG/JPG/PDF/PPT, and set expectations about watermarks, export tiers and size limits before the user hits them. Use when the user wants to bring a deck or PDF into a board, export a version for someone, asks why an export carries a watermark, or an import failed or stalled. Do NOT use for creating the content that goes into the file (that is boardmix-canvas), for downloading files on the user's behalf (the plugin cannot), or for promising a watermark-free or complete-format export."
---

# Import and export

Both directions are menu actions in the page. Your value is **removing the three failures that are
guaranteed if nobody mentions them first**:

1. **Too large** — a single PPT/PDF upload is capped at **50 MB**. Over that: compress, convert to
   images, or split.
2. **No quota** — free accounts get 3 editable files and 150 elements per file. An import consumes a
   file slot.
3. **Watermarked export** — free accounts export **standard definition with a watermark**. HD / UHD /
   paginated export is a whiteboard membership feature.

Say all three before the action, not after the preview appears.

## The one rule

**Confirm the account tier before promising an export.** "给客户一版干净的 PDF" has a different answer
on a free account, and the user needs that answer now, not at the export dialog.

## Export tiers

| Account | Export |
| --- | --- |
| Free | Standard definition, with watermark |
| Whiteboard membership (¥199/year) | HD / UHD / paginated export, no file or element limit, 50 GB space |

Formats available in the export menu: PNG, JPG, PDF, PPT. Anything else is not an export format — do
not offer SVG, Figma or editable Office files.

## Import matrix

| Coming in | Watch for |
| --- | --- |
| PPT / PDF | ≤ 50 MB. Many pages means a slow import — do not reload mid-import |
| Images | Large images slow the canvas; over 150 elements the free tier refuses more |
| Mermaid (`.mmd`) | The host can import and convert to a flowchart — this is the official landing channel for agent output |
| PureRef | Supported in recent versions, for reference boards |
| Markdown / plain text | Paste into the canvas or a card; no import needed |

## Two recurring questions

**"Blank canvas / only frames"** — Boardmix's own advice is to contact support with the file key, and
the file key is the identifier in the browser address bar. Tell the user to copy it from there; do not
send them hunting.

**"The imported deck opens empty"** — usually a long import still running, or a source file that
exceeded the cap and was truncated. Check the file size first, then retry the import once.

## Where the controls are

Import and export live in the help centre's 导入导出 group. Positions shift between versions — give
the group name, not a coordinate.

## Done

- the tier is confirmed and the watermark consequence is stated in one line;
- the size and quota limits relevant to this file are named;
- the panel group for the action is given;
- nothing claims a file was downloaded, uploaded, or produced.

## Do not do

- Do not promise a watermark-free export or a complete format list; only what the current page offers.
- Do not download, move or rewrite the user's files on their behalf.
- Do not say "导一版高清的给你" before knowing the tier.

## References (read on demand)

Resolve against `$SKILL_DIR`.

| File | Read it when |
| --- | --- |
| `references/format-matrix.md` | Choosing an export format for a purpose, or triaging a failed import |

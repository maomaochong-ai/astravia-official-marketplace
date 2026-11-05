# Format matrix

Which format for which purpose, and what to do when an import does not land.

## Choosing an export format

| The user needs | Format | Why |
| --- | --- | --- |
| A picture to drop into chat or a doc | PNG | Transparent-friendly, sharp text |
| A picture for print or a photo tool | JPG | Smaller, no alpha — same content as PNG otherwise |
| Something a client opens without an account | PDF | Paginated export keeps a big canvas readable |
| Something the client will edit in Office | PPT | Only worth it if the source is already slide-shaped; a whole canvas flattened into a deck loses meaning |
| A backup they can re-import | No export does this | Say so. Boardmix is the source of truth; a file is a snapshot |

Boardmix's own copy of the board is the only lossless copy. Any export is a one-way snapshot — worth
one sentence whenever the user says "导出备份".

## Import triage

| Symptom | First check | Then |
| --- | --- | --- |
| Import does nothing | File size ≤ 50 MB | Compress or split, retry once |
| Progress stalls at a percentage | Page count of the source | Wait; do not reload mid-import. A reload restarts it |
| Imported deck opens blank | File size, then page count | Retry once. Still blank → 导入导出 group, or support with the file key |
| Only some slides arrived | Source has non-standard slide sizes or embedded objects | Convert to PDF first, import that |
| Canvas slows after import | Image count and element count | Free tier stops at 150 elements; large images should be downscaled before import |
| "You have reached your limit" | 3 editable files on the free tier | Archive or upgrade. This is not a plugin error |

## Mermaid as the import channel

The `.mmd` route is the only one where an agent-produced artefact lands **editable** rather than as a
picture:

1. Write the Mermaid into a `.mmd` file in the working directory (or hand it in the reply).
2. The user imports it and the host converts it to a flowchart.
3. Editing afterwards happens on the canvas, by the user.

Two rules that make the difference between a clean import and a parse error: quote CJK node text that
contains `()`, `/`, `:`; keep node text short.

## Watermark reality check

| Asked | Honest answer on the free tier |
| --- | --- |
| "Export this for a client" | It will carry a watermark. Say it now |
| "Remove the watermark" | Not possible from the plugin. Whiteboard membership removes it |
| "Export in HD" | Free tier exports standard definition |
| "Export each page separately" | Paginated export is a membership feature |

Deliver the bad news before the click. After the click it reads as an excuse.

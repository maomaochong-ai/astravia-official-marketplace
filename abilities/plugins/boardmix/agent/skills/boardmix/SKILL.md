---
name: boardmix
description: "Drive the real Boardmix whiteboard (boardmix.cn) that this plugin opens in a side panel: get it open, signed in, and on the right screen, then hand the last click to the user. Use when the user mentions Boardmix, 白板, 看板, 思维导图, 流程图, 在线协作画布, asks to open or return to a board, wants the panel moved to a specific Boardmix screen, or reports the panel stuck on login or blank. Do NOT use for drawing the diagram inside the user's own project, for Excalidraw or any other canvas app, or for reading what is on a board — this agent cannot see canvas contents and must not describe them."
---

# Boardmix

Boardmix is a web product running on Boardmix's servers. This plugin is the shell around it: one tab
that can authenticate and navigate. **You can change the address; you cannot touch the canvas.**
Every drawing, share, import and export action belongs to the user's click.

Read this file as the routing layer. Four sibling skills carry the domain work; each is a separate
`invoke_skill` target and none of them repeats what is here.

## The one rule

Before answering anything about Boardmix, ask which of three things the user wants:

1. **See something on a board** — you cannot. Route them to 博思 AI inside the page, or ask them to
   paste the text. Never guess at canvas contents.
2. **Do something on a board** — your deliverable is `产物 + 精确到面板的操作路径`, never "已完成".
3. **Get somewhere in Boardmix** — that is what the six tools are for, and it is the only thing
   they do.

## The six tools

| Tool | Call it when | Read back |
| --- | --- | --- |
| `boardmix_open` | Every Boardmix task starts here. Also "open Boardmix", "that board from yesterday" | `open`, `phase`, `seedLevel`, `url`, `next` |
| `boardmix_goto` | The user pasted a link, or you know the screen | `ok` or a `reason`, plus `url` / `phase` |
| `boardmix_new` | They want a new board; sends the page to the create entry | always `needsUserAction: true` |
| `boardmix_ai` | They want AI to generate something; `kind` is `ppt` / `flowchart` / `chat` | always `needsUserAction: true` |
| `boardmix_tab_status` | You only want to know the state — opens nothing | `open`, `url`, `phase` |
| `boardmix_open_in_browser` | The shell cannot render it and the user should keep working | `ok`, plus the address as text |

`needsUserAction: true` is not a failure. It is the hand-off point: the page is where it needs to be
and the next move is a human click. Say so in one sentence and stop pushing.

## Workflow

**Any task, in this order:**

1. `boardmix_open`. Do not `boardmix_goto` before it — open is what establishes the tab.
2. Read `phase`. `login` means the page is still Boardmix's own login page: tell the user to sign in
   in the panel, and stop. Do not retry, do not fill anything in, do not ask for credentials.
3. Route the task to one sibling skill (table below) and follow it.
4. Navigate only when the destination is known. `boardmix_goto` an invented path does nothing
   useful — the app is a single-page shell and answers almost any `/app/...` address with a page.
5. Close with three things: what you produced, the exact panel path (group names, not coordinates),
   and the one action the user has to take.

**Failure ladder** — do not invent a fourth move:

1. Look at `seedLevel`: 1 is the last address that worked, 2 is `/app/`, 3 is the site root.
2. Call `boardmix_open` once more; the ladder steps down on its own.
3. Still nothing → `boardmix_open_in_browser`. That is the escape hatch *and* the signal that this
   path is closed.

Same move twice with the same result means change technique, not retry.

## Which sibling skill

| The user wants | Invoke |
| --- | --- |
| To put something on the canvas: stickies, mind map, flowchart, doc & card, table, shapes, pen, connectors | `boardmix-canvas` |
| Other people: share link, permissions, comments, voting, presentation mode, breakout groups | `boardmix-collaboration` |
| Boardmix's own AI: PPT, flowchart, doc, image, writing, SWOT, agent, canvas retrieval | `boardmix-ai` |
| Files in and out: import PPT/PDF/Mermaid, export PNG/JPG/PDF/PPT | `boardmix-io` |
| Just the page: open it, sign in, blank screen, wrong screen | stay here |

## Done

A Boardmix task is done when all four are true — nothing in the system will remind you:

- the tab is open and `phase` is what you claimed it is;
- the address in `url` is the screen you told the user about;
- the artefact (Mermaid / Markdown / outline / table) exists **in the reply or in the working
  directory**, not as a promise;
- the reply names the action the user must take, in Boardmix's own words for that panel group.

What is *not* done, however confident the wording: "已为你创建", "已生成", "已帮你画好", a description
of a canvas you never saw, a share link nobody produced, a watermark-free export nobody has the tier
for.

## What you cannot do — say it plainly

- **List the user's boards.** No public list endpoint. Send them to `/app/recent-file`, which has a
  search box, and let them pick.
- **Read a board.** Not by link, not by name. Boardmix's own AI can, inside the page.
- **Click.** Share, export, comment, vote, present, break out — you stop at "here is the path".
- **Hold credentials.** No cookies, no代登录, no verification codes, ever.

## References (read on demand)

Resolve against `$SKILL_DIR`. Do not read them all up front.

| File | Read it when |
| --- | --- |
| `references/tool-envelope.md` | You need the exact field set, the seed ladder, or what a `reason` value means |
| `references/page-map.md` | Choosing a destination, or the page is not where you expected |

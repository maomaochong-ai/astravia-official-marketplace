---
name: boardmix
description: "Drive the real Boardmix whiteboard (boardmix.cn) that this plugin opens in a side panel: get it open, signed in and on the right screen, then read the page, click and type through it with real input, and capture a screenshot so you can look at what is drawn. Use when the user mentions Boardmix, 白板, 看板, 思维导图, 流程图, 在线协作画布, asks to open or return to a board, wants the panel moved to a specific Boardmix screen, reports the panel stuck on login or blank, or wants something clicked, filled in or shared inside the panel. Do NOT use for drawing the diagram inside the user's own project, or for Excalidraw or any other canvas app. Canvas shapes are pixels: read and describe them only from a boardmix_shot screenshot, never as data you parsed."
---

# Boardmix

Boardmix is a web product running on Boardmix's servers. This plugin is the shell around it: one tab
that can authenticate, navigate, read the page, click through it and capture what it shows.
**One boundary survives: the canvas is pixels.** `boardmix_read` returns the controls on screen —
buttons, links, tabs, inputs — with the point to click each one. Drawings, sticky notes and diagram
shapes are inside a rendering surface: no DOM node names them, so the only way to see them is
`boardmix_shot` and then reading the PNG.

Read this file as the routing layer. Four sibling skills carry the domain work; each is a separate
`invoke_skill` target and none of them repeats what is here.

## The one rule

Before answering anything about Boardmix, ask which of three things the user wants:

1. **See something on a board** — capture it (`boardmix_shot`) and read the PNG, or route them to 博思 AI
   inside the page when the question is "what does this board mean". Never describe a canvas you did
   not look at.
2. **Do something on a board** — read the page first (`boardmix_read`), then act on it
   (`boardmix_act` — real mouse and keyboard). Your deliverable is still `产物 + 精确到面板的操作路径`
   plus what you actually confirmed afterwards; never "已完成" without a second look.
3. **Get somewhere in Boardmix** — open, goto, new, ai, status, browser. Navigation only moves the
   page; it never changes its contents.

## The nine tools

## The six tools

| Tool | Call it when | Read back |
| --- | --- | --- |
| `boardmix_open` | Every Boardmix task starts here. Also "open Boardmix", "that board from yesterday" | `open`, `phase`, `seedLevel`, `url`, `next` |
| `boardmix_goto` | The user pasted a link, or you know the screen | `ok` or a `reason`, plus `url` / `phase` |
| `boardmix_new` | They want a new board; sends the page to the create entry | always `needsUserAction: true` |
| `boardmix_ai` | They want AI to generate something; `kind` is `ppt` / `flowchart` / `chat` | always `needsUserAction: true` |
| `boardmix_tab_status` | You only want to know the state — opens nothing | `open`, `url`, `phase` |
| `boardmix_open_in_browser` | The shell cannot render it and the user should keep working | `ok`, plus the address as text |
| `boardmix_read` | Before any click. Also "what is on screen right now" / "is it still on the login page" | `url`, `title`, `login`, `size`, `items[{label,x,y}]`, `text` |
| `boardmix_act` | Clicking a point `boardmix_read` printed, typing into a field, pressing a key, scrolling | `steps[{index,label,ok}]`, `stoppedAt`, plus the page's `url` afterwards |
| `boardmix_shot` | You need to see what is **drawn** — a diagram, sticky wall, deck canvas | `path` inside `.boardmix/shots/`, then read that PNG |

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
5. When the task needs a click you can reach (`boardmix_read` printed the point), do it with
   `boardmix_act` instead of handing it back — then read or capture again to confirm it landed.
6. Close with three things: what you produced, what you confirmed on screen, and the one action that
   is left for the user (if any).

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

A Boardmix task is done when all five are true — nothing in the system will remind you:

- the tab is open and `phase` is what you claimed it is;
- the address in `url` is the screen you told the user about;
- anything you clicked was confirmed afterwards: `boardmix_read` again, or a `boardmix_shot` you
  actually read — never "应该已经打开了";
- the artefact (Mermaid / Markdown / outline / table) exists **in the reply or in the working
  directory**, not as a promise;
- the reply names the action the user must take, in Boardmix's own words for that panel group.

What is *not* done, however confident the wording: "已为你创建", "已生成", "已帮你画好", a description
of a canvas you never saw, a share link nobody produced, a watermark-free export nobody has the tier
for.

## What you cannot do — say it plainly

- **List the user's boards.** No public list endpoint. Send them to `/app/recent-file`, which has a
  search box, and let them pick.
- **Read a board's shapes.** `boardmix_read` sees the page's controls, not the drawing surface. A
  mind map, a sticky wall and a diagram are pixels: capture with `boardmix_shot` and look at the PNG.
  Boardmix's own AI can read a board from inside the page — that is the other route.
- **Click a shape on the canvas.** Real input reaches the page (`boardmix_act`), but a shape has no
  point to aim at until you looked at a screenshot, and even then it is a guess about pixels. UI
  buttons, menus, dialogs and forms are the trustworthy targets.
- **Hold credentials.** No cookies, no代登录, no verification codes, ever.

## References (read on demand)

Resolve against `$SKILL_DIR`. Do not read them all up front.

| File | Read it when |
| --- | --- |
| `references/tool-envelope.md` | You need the exact field set, the seed ladder, or what a `reason` value means |
| `references/page-map.md` | Choosing a destination, or the page is not where you expected |

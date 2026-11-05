---
name: boardmix-canvas
description: "Put structure on a Boardmix canvas: mind maps, flowcharts, swimlanes, architecture diagrams, sticky walls, doc cards, tables. Deliver Mermaid or Markdown the canvas can absorb, plus the exact panel path to place it, then confirm with a boardmix_shot you actually looked at. Use when the user wants to turn notes into a diagram, draw a process or architecture, brainstorm on stickies, or build an outline into a mind map. Do NOT use for generating the artifact with Boardmix's own AI (that is boardmix-ai), or for drawing inside the user's own repository. Canvas shapes are pixels: see them through a screenshot, never as parsed structure."
---

# Canvas work

You own the **structure**. The user owns the **stroke** — not one shape on that canvas was placed by
you, and saying otherwise is the fastest way to lose their trust.

The hand-off works because two real channels exist: the host can import a `.mmd` file and convert it
to a flowchart, and a Boardmix canvas accepts pasted Markdown. Both are user actions, both are one
click, and both need a deliverable from you first.

## The one rule

**Produce the artefact before describing the plan.** A reply that explains how you would draw
something, without the Mermaid source in it, is worth nothing to the user.

Corollary: three questions maximum, then deliver. Type of diagram, the boundary nodes (where it
starts and ends, who is in it), and whether it must stay editable.

## Four asks, four artefacts

| The ask | Deliver | How the user lands it |
| --- | --- | --- |
| Process, swimlane, architecture | Mermaid `flowchart` | Import the `.mmd`, or paste it where the canvas takes Mermaid |
| Mind map, topic radiating outward | Mermaid `mindmap`, or an indented Markdown outline | Import, or paste top-level branches as stickies |
| Brainstorm, affinity wall | Markdown bullet list, one bullet per sticky | Paste onto the canvas |
| Doc page, spec, meeting note | Markdown with a heading per card | Create the card, then paste |

Set the stage with `boardmix_new` (create entry) or `boardmix_goto` (an existing board link the user
gave you). Neither one draws anything.

## Element budget — say it before they hit it

- Free accounts: **3 editable files**, **150 elements per file**.
- Aim for **≤ 60 elements** in anything you hand over. A diagram that eats half the free budget is a
  diagram the user cannot extend.
- Above that, say it in one line before delivering: "这张图会超过免费额度的一半，继续加需要白板会员。"

## Panel paths, not coordinates

| What they need | Help-centre group |
| --- | --- |
| Mind map, flowchart, shapes, stickies, doc & card, pen | 创作工具 |
| Asset library, templates, embeds | 资源与素材 |
| Canvas basics, canvas mode | 画布设置 |
| Comments, voting, presentation, breakout groups | 协作与交流 |

Names of groups survive redesigns; coordinates do not. Give the group, then what to look for inside
it.

## Done

- the Mermaid / Markdown source is in the reply or in a file in the working directory;
- element count is stated, and it is under the account's limit;
- the landing step names the panel group and what the user does there;
- nothing in the reply claims the canvas now holds it.

## Do not do

- Do not guess what is already on the board. "接着上次那张图" means capture it (`boardmix_shot`) and
  look at the PNG, or ask them to describe it — a canvas is pixels, not structure you can parse.
- Do not write `已帮你画好了`, `已生成图表`, or a description of a canvas you never observed.
- Do not omit the element budget to sound more capable. The user hits that wall half an hour later
  and remembers who did not mention it.
- Do not produce an image, a screenshot or base64 as the "deliverable". Those do not land on a
  canvas and cannot be edited.

## References (read on demand)

Resolve against `$SKILL_DIR`. Do not read it up front.

| File | Read it when |
| --- | --- |
| `references/diagram-recipes.md` | Writing the actual Mermaid — layout choice, branch labels, CJK node names, element counting |

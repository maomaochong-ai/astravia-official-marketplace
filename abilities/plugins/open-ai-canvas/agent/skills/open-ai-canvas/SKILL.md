---
name: open-ai-canvas
description: Use the Open Canvas skill library — 73 upstream-authored creative skills (short drama, visual design, ecommerce, social, prompt engineering) reached through the open-ai-canvas MCP tools.
version: 1.0.0
---

# Open Canvas skill library

The `open-ai-canvas` MCP server exposes 28 tools. Eight of them project the canvas's own skill
library: 73 skills written by the canvas authors (short-drama production, visual design,
ecommerce, social content, prompt engineering). Use this skill when the user asks for creative
work that one of those skills covers, or asks what the canvas can do.

Do not write the skill's craft yourself when a matching skill exists. The upstream text is the
deliverable; your job is to find it, load it, and follow it.

## Preconditions

- The canvas service must be running. If calls fail with `backend-not-ready`, ask the user to
  start the canvas in the plugin panel, then retry once.
- The skill library needs a canvas login. A `401` from any tool means the user is not signed in
  — tell them to open the canvas page and sign in, then retry. Never present a `401` as
  "skill not found".

## Tools

| Tool | Use it for |
| --- | --- |
| `list_skill_presets` | The five scene presets (`drama`, `creative`, `ecommerce`, `social`, `others`). No login needed. |
| `list_skills` | Browse/search the library: `tag`, `search`, `sort`, `page`, `pageSize` (≤ 80). |
| `get_skill` | One skill's instruction text. Truncated at 20 000 characters by default. |
| `list_skill_files` | Files inside a skill package (a skill may ship `cards/*.md`, `references/`, or module folders). |
| `read_skill_file` | One file of a package by path. Use it when `get_skill` reports truncation. |
| `search_skill_files` | Full-text search inside one skill package. |
| `list_added_skills` | Skills the user already added to their own library. |
| `set_skill_added` | Add or remove a skill from the user's library. Only on explicit request. |

## Workflow

1. Pick the group with `list_skill_presets` (or from the user's genre).
2. Find candidates with `list_skills` — filter by `tag`, or by `search` on the user's own words.
   Read the returned `description`; names alone are not enough to choose.
3. Load the chosen skill with `get_skill`. Follow its instructions for the rest of the turn.
4. If the response says `instructionTruncated: true`, or the skill ships companion documents,
   call `list_skill_files` and then `read_skill_file` on the module that matches the user's
   current step. `影视剧作工坊` (246 documents) is only usable this way.
5. Only call `set_skill_added` when the user asks to keep a skill.

For vague requests ("make me a short video", "I do not know which skill to use"), load
`选包门房` (`16000000000107`) first — it is the library's own router skill.

Skill ids are stable keys. Chinese display names are not: `分镜语法` is `16000000000094`, and
`图片图层拆分` is `yingce-image-layer-split`. Always address skills by `skillId`.

The full 73-skill index is in `references/builtin-skills.md`. Treat it as a snapshot for
orientation; `list_skills` is authoritative.

## Boundaries

- Read-only library: creating, editing, deleting, favouriting, and package-level search are not
  exposed. Say so instead of approximating them with another tool.
- Skill text is upstream material. Quote and follow it; do not silently rewrite its steps,
  and do not present an invented step as part of the skill.
- Model bridge directions are asymmetric and this is not a bug to work around:
  host text models can be projected into the canvas, and canvas image/video models can be
  registered as host media providers — but host image/video generation cannot be pushed into
  the canvas, and reference-image input is not bridged. Do not promise either.
- Nothing here installs models, spends quota, or creates canvas nodes on its own. Node creation
  and generation stay behind the canvas tools the user drives.

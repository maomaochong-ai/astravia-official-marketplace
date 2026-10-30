# Mahua Novels

English · [中文](README.zh.md)

A multi-agent novel studio plugin for Astravia. The host keeps the conversation; Mahua Novels keeps
the book.

The design decision that makes this different from "ask a model to write a novel": **progress is
computed**. A pure router reads the book's actual state and returns the next owner, the next task
and the reason. The agents execute that instruction. Nobody is allowed to declare a chapter done.

## Install

In Astravia, open **Capabilities → Marketplace**, install **Mahua Novels**, then open the activation
view once. A book starts in a conversation, not in a form: say what you want to write, settle the
one-sentence premise with the team, and the architect lays out volumes and arcs from there.

## What you see after installing

Nothing is added to your sidebar. The studio lives in **one tab of the activity panel**: open the
panel's **+** menu, pick **Mahua Novels** (麻花小说网) under *addable plugin panels*, and it docks as
a tab. The tab always exists — when the credential is not active it shows the activation panel
instead of the shelf, so the same tab is both the way in and the way back.

The workspace has five layers, all inside the panel, none of them a chatbot:

| layer | what it is |
| --- | --- |
| shelf | cover grid + recently updated row; empty state explains what this is and how to start |
| library | the catalogue as a text ledger: one row per book (title, phase, genre, committed/target, words, last update, progress bar), filter by genre / status / length, sort by recency / chapters / title, nine rows per page. Columns drop out as the panel narrows — the title and the row click never do |
| book | header with title, phase, the routed next step; current-arc tick strip, the instruction card, recent checkpoints on the left; contents, the ledger link and the four-member roster on the right |
| reader | chapter toolbar (back, chapter, word count, serif/sans, contents menu), a 672px prose column, the seven-dimension review panel on wide panels, previous/next chapter and five text sizes in the bottom bar |
| ledger | the foreshadowing ledger: open / overdue / unresolved counts, one line per thread, findings, the append-only decision log and the consistency check |

On the book page, **Keep reading** only turns the page: it opens the reader at the chapter the router
named and has no side effect. The step that belongs in chat is a separate button, **Continue in
chat** — it is the only place on that page that sends a prompt. Both live in the page header; **Copy
manuscript** sits next to the roster at the bottom of the contents column, because a tab has no host
header to put it in.

Every cover is a real default cover, not a placeholder: six public-domain ink-wash landscapes
(Cleveland Museum of Art, CC0) ship inside the bundle as base64 bitmaps. Each book picks one plus
an ink density from its id, so the same book always looks the same and two books never look alike.
The plate is rendered in grayscale and multiplied into the host `accent` colour, so a cover only
ever uses the theme's own accent — no second colour, no network request.

## The team

The plugin registers one team, **Mahua Writing Team** (麻花写作团队), with four members:

| role | owns | must not |
| --- | --- | --- |
| Architect | brief, volumes, arcs, one-line chapter outlines | decide whether a chapter passes review |
| Writer | chapter prose, revisions against must-fix items | commit, renumber, touch a committed chapter |
| Editor | seven-dimension score, must-fix list, pass/block verdict | rewrite the chapter, adjust the pass line |
| Arbiter | premise conflicts, deadlocks, author overrides — with a recorded ruling | plan, write, or invent a fourth scenario |

The fifth actor is the engine: committing, arc closing, finalizing. Those steps need no model.

The team also ships two skills — `novel-craft` (scene, hook, dialogue, foreshadowing, prose hygiene)
and `longform-continuity` (rolling plans, consistency, summaries, per-character process). They load
on demand from `agent/skills/`; the routing prompt decides which one a task needs.

There is no chat box inside the view. The studio shows where the book stands and what the next step
is; the writing happens in the host's own conversation, because that is where the agents, streaming
and tool calls already live (ADR 0008).

## How a chapter moves

`mahua_next_instruction` is computed from stored state, not from the last thing anyone said. Two
layers are stored: the book's **phase** and each chapter's **status**.

| phase | entered by | leaves when |
| --- | --- | --- |
| `briefing` | `mahua_create_book` | the brief is accepted |
| `planning` | `mahua_accept_brief` | a volume with its arcs exists |
| `drafting` | the start button on the book page (`mahua_start_drafting`) | a review blocks the chapter → `revising`; a commit reaches the target or closes an arc |
| `revising` | a review that scored below the pass line or carried must-fix items | the chapter is committed |
| `arc_close` | the last chapter of an arc was committed | the arc summary is stored and `mahua_close_arc` runs |
| `completed` | the committed count reached the target | only `mahua_reopen_book` reopens it |

A chapter itself is `planned → drafting → reviewed → committed`, with `blocked` as the landing place
for a verdict that must not commit.

One chapter is nine calls, in this order: `mahua_context` → `mahua_read_chapter` (the previous
chapter) → `mahua_plan_chapter` → `mahua_save_chapter` → `mahua_check_consistency` +
`mahua_check_rules` + `mahua_flag_thread` → `mahua_save_review` → `mahua_commit_chapter`.

The pass line is a contract, not a mood: 72 on a weighted seven-dimension score **and** an empty
must-fix list. Below that the chapter is `blocked` and `mahua_commit_chapter` refuses it. Prose
existing is never the same as a chapter being committed, and only `committedCount` moves.

While the phase is still `planning` and the outlines already cover the target, the router answers
`null`. That is the book waiting for its author, not an error: starting the first chapter is a human
decision.

## What the context pack carries

`mahua_context` is the one call an agent makes before reading anything else. It returns a fact pack
in a fixed order, and that order is the reading order:

| part | why it is there |
| --- | --- |
| `phase`, `foundation` | the promise the book has already made — premise, ending, taboo |
| `cast` | the name whitelist the consistency check actually enforces |
| `arc` | the current arc's goal: what this chapter has to move |
| `previous` | the previous committed chapter's closing line — continuity of tone |
| `openThreads` | planted, unpaid, and the chapter each one promised to pay off in |
| `relatedChapters` | at most six earlier chapters worth re-reading, each with a reason |
| `summaries` | arc and volume summaries, for chapters that sit on a boundary |
| `openFeedback`, `styleSample` | unresolved outline objections, and the voice reference |

Only `relatedChapters` and `summaries` may be skipped for a given chapter. A missing thread, closing
line or arc goal is a factual error waiting to happen.

Upstream compresses long conversations in four stages because it owns the session. This plugin does
not own the session — the host does — so it ships the fact pack in the right order and leaves
compaction to the host.

## Rolling plan and the ledger

A volume holds 2–4 arcs and an arc 3–8 chapters; only the near arcs carry chapter outlines, and
`mahua_expand_next_arc` appends the next one when the plan runs out. Where the book is heading is
`foundation.ending` plus each volume's `goal` and `hook`. Upstream keeps that in an object it calls
the compass and rewrites it at every volume boundary; here it is three fields only the architect
writes.

Foreshadowing is a ledger, not a note. `mahua_flag_thread` records what was planted, in which
chapter, and by which chapter it must pay off, at one of three weights. `mahua_close_thread` is the
only way a thread is settled, and it is a separate write on purpose: a payoff that happens silently
inside a chapter edit is a bookkeeping lie. `mahua_check_threads` reports overdue plants and the
open rate — no threshold is baked into the domain layer.

## Tool surface

36 tools, all prefixed `mahua_`. Read tools never ask for a credential; the 24 write tools always do,
and the gate is judged once, in the service layer.

| group | tools |
| --- | --- |
| read | `list_books`, `book_status`, `next_instruction`, `read_chapter`, `audit_foundation`, `premise_structure`, `check_consistency`, `check_rules`, `check_threads`, `style_stats`, `context`, `reference` |
| foundation & planning | `accept_brief`, `save_foundation`, `set_user_rules`, `save_plan`, `save_outline`, `revise_outline`, `plan_chapter`, `expand_next_arc`, `flag_outline_feedback`, `resolve_outline_feedback` |
| drafting | `create_book`, `start_drafting`, `save_chapter`, `edit_chapter`, `save_arc_summary`, `save_volume_summary` |
| foreshadowing | `flag_thread`, `close_thread` (the ledger's two write entry points) |
| judgement | `save_review`, `commit_chapter`, `close_arc`, `finalize`, `reopen_book`, `arbitrate` |

Every tool returns facts only — the next step comes from `mahua_next_instruction`, never from the
last write.

## Where the data lives

Plugin storage, one directory per concern:

```
books/index.json        the catalogue the library page reads (no file IO per card)
books/<id>/book.json    the book itself: foundation, volumes, arcs, chapters, summaries, progress
books/<id>/chapters/N.md
books/<id>/reviews/N.json
threads/<id>.json       the foreshadowing ledger — planted chapter, promised payoff, weight, status
decisions/<id>.jsonl    arbitration and feedback rulings, append-only
entitlement.json        the activated credential
```

One advance is one commit: prose, chapter status and the index land together, so there is never a
"text written but status stale" state. The ledger is written in the same commit as the book, which is
why a thread cannot drift behind the manuscript it belongs to.

## Where the prompts live

Four text channels with four different lifetimes. Conflating them is the quickest way to break this
plugin, so they are kept apart:

| file | manifest channel | loaded by | when |
| --- | --- | --- | --- |
| `agent/prompts/routing.md` | `agent.systemPrompt.promptPaths` | every session | always on, for every project — hence the 12 KB budget guard |
| `agent/agents/*.md` | `agents[].systemPromptPath` | that one agent | whenever the agent is active, in or out of the team |
| `agent/prompts/team-workflow.md` | `teams[].workflowPath` | the team | inside the team only |
| `agent/prompts/briefs/*.md` | `teams[].members[].instructionsPath` | that one member | inside the team only |

`agent/agents/writer.md` and `agent/prompts/briefs/writer.md` are not duplicates. The first is the
writer's system prompt — voice, method, what it may never do. The second exists only inside this
team: which tool to call in which order, what a handoff line looks like, how to escalate. The editor
is split the same way.

`agent/skills/**` is a fifth channel (`skillPaths`), loaded on demand when a task needs it.
`agent/styles/*.md` and `agent/voice.md` are not prompts at all: `scripts/build-reference-library.mjs`
compiles them, together with the skill references, into `src/reference/library.generated.ts`, which is
what `mahua_reference` returns. `agent/references/ATTRIBUTION.md` is loaded by nothing — it is
provenance, and it also carries the mapping from upstream's prompts to these files.

## Develop

```bash
npm install
npm run references # regenerate src/reference/library.generated.ts from agent/
npm run check      # tsc --noEmit
npm test           # vitest: router, state machine, entitlement, service, library, threads, guards
npm run build      # dist/ + release/mahua-writing-team-0.4.6.astraviapkg
npm run validate   # parse plugin.json with the host's own manifest parser
```

The `@astravia-org/*` SDK packages are not on the public registry. `package.json` declares version
ranges; the lockfile resolves them to the local checkout under `.tooling/` on this machine, and
`scripts/marketplace.mjs` rewrites them for the duration of a build. Never edit either by hand.

## Credential

`nw1.<base64url(claims)>.<base64url(ed25519 sig)>`, verified offline against the keys in
`src/entitlement/trusted-keys.ts`. The community credential ships with the plugin so the studio works
out of the box. The gate protects this plugin's own write tools; it is not licence enforcement, and
the activation page says so in as many words.

The activation page also states which credential is in force. If the one you pasted is expired or
malformed, it shows the rejection reason and says that the bundled community credential is being used
instead, rather than reporting a plain "active"; **Remove my credential** drops yours and falls back
explicitly.

## What this plugin deliberately does not do

The upstream CLI and this plugin share a design, not a feature list. These have no counterpart here,
and claiming otherwise would be the more damaging choice:

| upstream | here |
| --- | --- |
| `/import` a finished novel (a four-prompt pipeline) | nothing — a book starts from a brief, and no tool has an ingest path |
| `/sync` re-adopting hand-edited chapters with a model that rebuilds summaries and facts | `mahua_edit_chapter` replaces or appends one fragment of an **uncommitted** chapter and re-derives the rule-based chapter facts; a committed chapter is refused |
| `/simulate` an imitation profile built from a corpus of files | `mahua_create_book` takes one prose sample as `styleSample` and every context pack carries it; there is no corpus analysis and no profile file |
| `/diag` a diagnostic report | `mahua_style_stats`, `mahua_check_consistency` and `mahua_check_threads` return facts; nothing writes a report |
| per-role model and provider configuration | the host owns the model — the manifest gives the four agents no `model` field, and the plugin never sees a key |
| `curl … install.sh` | the marketplace package is the distribution |
| export to other formats | the manuscript is Markdown in plugin storage; there is no exporter |

## Licence and provenance

MIT. The craft library under `agent/` is ported from [ainovel-cli](https://github.com/voocel/ainovel-cli)
(Apache-2.0) and adapted from novel-master (MIT); see `agent/references/ATTRIBUTION.md` for the
file-by-file split and the changes made. The architecture is documented decision by decision in
`../../docs/adr/ainove-cli/`.

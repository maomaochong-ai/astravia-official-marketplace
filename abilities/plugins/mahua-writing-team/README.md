# Mahua Novels

English · [中文](README.zh.md)

A multi-agent novel studio plugin for Astravia. The host keeps the conversation; Mahua Novels keeps
the book.

The design decision that makes this different from "ask a model to write a novel": **progress is
computed**. A pure router reads the book's actual state and returns the next owner, the next task
and the reason. The agents execute that instruction. Nobody is allowed to declare a chapter done.

## What you see after installing

The sidebar gains one entry, **Mahua Novels** (麻花小说网). It is hidden until a credential is
active — the activation view is the mirror image of it, so exactly one of the two is visible.

The workspace has four layers, all inside the panel, none of them a chatbot:

| layer | what it is |
| --- | --- |
| shelf | cover grid + recently updated row; empty state explains what this is and how to start |
| library | the catalogue: horizontal cards with cover, genre, phase, chapter count, word count, premise, last update; filter by genre / status / length, sort by recency / chapters / title, nine cards per page |
| book | cover, phase, the four-member roster, the routed next step, table of contents |
| reader | full-width prose, previous/next chapter, five text sizes |

Every cover is a real default cover, not a placeholder: an inline SVG whose motif and tint are
derived from the book id, so the same book always looks the same and two books never look alike.
No bitmap, no network request, no hard-coded colour.

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

## Develop

```bash
npm install
npm run references # regenerate src/reference/library.generated.ts from agent/
npm run check      # tsc --noEmit
npm test           # vitest: router, state machine, entitlement, service, library, threads, guards
npm run build      # dist/ + release/mahua-writing-team-0.2.0.astraviapkg
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

## Licence and provenance

MIT. The craft library under `agent/` is ported from [ainovel-cli](https://github.com/)
(Apache-2.0) and adapted from novel-master (MIT); see `agent/references/ATTRIBUTION.md` for the
file-by-file split and the changes made. The architecture is documented decision by decision in
`../../docs/adr/ainove-cli/`.

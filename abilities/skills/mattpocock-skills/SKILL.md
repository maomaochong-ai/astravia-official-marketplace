---
name: mattpocock-skills
description: Matt Pocock's composable engineering workflow skills, consolidated from github.com/mattpocock/skills. Covers test-driven development, code review, bug diagnosis, domain modeling, specs and tickets, issue triage, PR writing, prototyping, research, retrospectives, grilling/planning interviews, conversation handoffs, teaching, writing for agents, git guardrails, pre-commit setup and more. Use for any real-engineering workflow task, or when the user asks for one of the named skills (tdd, code-review, to-spec, to-tickets, triage, grill-me, handoff, etc.).
version: 1.0.1
references:
  - engineering
  - productivity
  - misc
  - in-progress
  - deprecated
---

# Matt Pocock Engineering Skills

This is a consolidated package of Matt Pocock's agent skills ("Skills For Real Engineers", https://github.com/mattpocock/skills). They are small, easy to adapt and composable — designed for real engineering, not vibe coding. They work with any model.

## How to use this skill

1. Match the user's request to a module in the catalog below (module names and file layout mirror the upstream repository exactly).
2. Read the module's `SKILL.md` at `references/<category>/<module>/SKILL.md` **in full before acting**. Any sibling files next to it (`AGENTS.md`-style supplements, format docs, `scripts/`, `agents/openai.yaml`) are part of that module — load the ones the module tells you to.
3. Compose modules when a task spans several (e.g. `to-spec` → `implement-spec`, `codebase-design` vocabulary inside `improve-codebase-architecture`). Do not skip a module's stated preconditions.
4. Modules marked "user-invoked" upstream carry `disable-model-invocation: true`: they are typically triggered by the user asking for them by name (e.g. "/to-spec", "grill me"). Trigger them on explicit requests, not silently.

## Activation in the host

Every module below is a real `SKILL.md` with its upstream frontmatter (`name`, `description`). The host discovers them by scanning the installed package, so each module shows up as its own entry in the skill panel and answers to its upstream name as a slash command (`/tdd`, `/code-review`, `/to-spec`, `/grill-me`, …). This package's own entry (`/mattpocock-skills`) is the router you are reading; when a conversation arrives through the package entry instead of a module command, follow the catalog and load the module file directly.

## Module catalog

### Engineering (`references/engineering/`)

Core software-engineering loops. Run `setup-matt-pocock-skills` once before first use of the tracker-based skills.

| Module | Purpose |
|--------|---------|
| `ask-matt` | Router: asks which skill or flow fits the situation. |
| `code-review` | Review changes since a fixed point along two axes: Standards and Spec, in parallel sub-agents. |
| `codebase-design` | Shared vocabulary for designing deep modules (seams, testability, AI-navigability). |
| `diagnosing-bugs` | Diagnosis loop for hard bugs and performance regressions. |
| `domain-modeling` | Build and sharpen a project's domain model (GLOSSARY.md, ADRs). |
| `grill-with-docs` | Relentless interview to sharpen a plan, creating ADRs and glossary as it goes. |
| `implement-spec` | Implement the result of to-spec / to-tickets in code. |
| `implement` | Implement a piece of work based on a spec or set of tickets. |
| `improve-codebase-architecture` | Scan a codebase for deepening opportunities, present an HTML report, grill through the pick. |
| `pr` | Write a PR body. |
| `prototype` | Throwaway prototype to answer a design question (state model, logic, UI shape). |
| `research` | Investigate against high-trust primary sources; capture findings as a Markdown file. |
| `retro` | Conduct a retrospective on a coding session. |
| `setup-matt-pocock-skills` | One-time setup: issue tracker, triage labels, domain doc layout. |
| `tdd` | Test-driven development: red-green-refactor, integration tests. |
| `to-spec` | Turn the current conversation into a spec, published to the issue tracker. |
| `to-tickets` | Break a plan/spec/conversation into tracer-bullet tickets with blocking edges. |
| `triage` | Move issues and external PRs through a triage state machine; write agent-ready briefs. |
| `wayfinder` | Plan a huge chunk of work as a shared map of decision tickets, resolved one at a time. |
| `wizard` | Generate an interactive bash wizard for human-only steps (credentials, dashboards, cutover). |

### Productivity (`references/productivity/`)

Conversation-shaping helpers.

| Module | Purpose |
|--------|---------|
| `grill-me` | Relentless interview to sharpen a plan or design. |
| `grilling` | Grill the user about a plan, decision or idea; stress-test thinking. |
| `handoff` | Compact the current conversation into a handoff document for another agent. |
| `teach` | Teach the user a new skill or concept within this workspace. |
| `to-questionnaire` | Turn an unanswerable decision into a questionnaire for someone else. |
| `wait-what` | Stop and re-pitch a message that did not land. |
| `writing-for-agents` | Writing documents for agents: skills, AGENTS.md, CLAUDE.md. |

### Misc (`references/misc/`)

Standalone utilities.

| Module | Purpose |
|--------|---------|
| `git-guardrails-claude-code` | Claude Code hooks that block dangerous git commands before they execute. |
| `migrate-to-shoehorn` | Migrate test files from `as` type assertions to @total-typescript/shoehorn. |
| `scaffold-exercises` | Scaffold exercise directories (sections, problems, solutions, explainers). |
| `setup-pre-commit` | Husky pre-commit hooks with lint-staged, type checking and tests. |

### In progress (`references/in-progress/`)

Shipped but still evolving upstream; treat as slightly rougher than the categories above.

| Module | Purpose |
|--------|---------|
| `chief-of-staff` | Pursue a long-running goal in one session by coordinating subagents. |
| `claude-handoff` | Hand the conversation to a fresh background agent that continues the work. |
| `loop-me` | Grill about specs for workflows the user wants to build. |
| `setup-ts-deep-modules` | Wire dependency-cruiser into a TypeScript repo for deep-module structure. |
| `software-factory` | Shared language for designing a software factory (tasks, services, runners, trackers). |
| `writing-beats` | Writing, exploit: assemble raw material into a journey of beats. |
| `writing-fragments` | Writing, explore: mine raw fragments, no structure yet. |
| `writing-shape` | Writing, exploit: shape raw material into an article, paragraph by paragraph. |

### Deprecated (`references/deprecated/`)

Upstream keeps an empty bucket: retired skills are deleted, and the removing changeset names their replacement. Retained here for layout parity; nothing to load.

## Provenance

Module files are byte-identical to upstream `mattpocock/skills` (MIT). See `upstream.json` and `NOTICE.md` for revision and attribution. When upstream and a module disagree with the user's repo conventions, the user's repo wins.

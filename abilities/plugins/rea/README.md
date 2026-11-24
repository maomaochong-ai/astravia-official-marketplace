# REA plugin for Astravia

This plugin wires the official [REA](https://rea.tools/) toolset into Astravia. The
Agent gains a structured workflow for reverse engineering shipped software —
native binaries, JavaScript / Electron apps, managed (.NET / JVM) code, firmware
and website traffic — and gets back Evidence records for every claim.

REA itself is a TypeScript / Node.js project; the desktop only needs an `npx`
entry point. The plugin declares the CLI in `plugin.json` so the desktop can
probe and install it on demand.

## What the plugin ships

- `plugin.json` — declares `providers.cli: rea-agents`, the
  `agent.skills.control` permission and two `agent.skillPaths` entries:
  `reverse-engineer-anything/` (how to drive REA) and `rea-investigation/`
  (how to keep a case).
- `agent/skills/reverse-engineer-anything/` — a verbatim copy of REA's upstream
  Agent Skill, including all `references/*.md` workflows. This guides the Agent
  on when to call REA, how to read Evidence, and how to recover from a missing
  provider.
- `agent/skills/rea-investigation/` + `agent/agents/rea-investigator.md` — the
  evidence-led investigation workflow and the `@rea` investigator persona that
  runs it.
- `src/index.tsx` — registers **two** UI slots that work together:
  1. `ui.slot.activity-tab` "rea.workflow" — a 7-section reverse-engineering
     workflow panel (provider status bar, 6 target types routing, stage strip,
     per-stage diagram, controls, case board). Theme follows the host via
     `@theme inline` CSS variables in `src/style.css`.
  2. `ui.slot.input-action` "rea.openTab" — a toggle button below the AI input
     bar. Turning it on attaches the tab, opens it at full width, and uses
     `decoratePrompt` to inject REA workflow instructions into the next outgoing
     prompt. Turning it off detaches the tab.
  No interactive setup flow is required; the upstream CLI is pulled on first
  use by the host's `cliProviders` runtime.
- `src/features/case-board/` — the durable object a transcript cannot hold: a
  case with graded evidence (`confirmed` / `inferred` / `unknown`), open
  questions, and a Markdown report. Storage is one JSON file per case plus an
  index under the plugin's private storage; writes go through `case_*` tools and
  a `PostToolUse` hook that turns every REA tool call into evidence, so the board
  fills itself while the investigation runs.
- `src/tools/case-*.ts` — four Agent tools: `case_open`, `case_record`,
  `case_status`, `case_report` (report or implementation spec).
- `src/features/case-board/services/investigate-command.ts` — the file-tree
  context menu ("Investigate with REA") for binaries, packages, model files and
  macOS bundles.
- `locales/{en,zh}.json` — bilingual names, descriptions, status labels, route
  names, report labels and decorate-prompt instructions.

## CLI probing

`providers.cli` uses `npx` as the entry point so the desktop does not need a
global install. The probe command is:

```bash
npx -y rea-agents@latest --version
```

`install` reuses the same command: `npx` writes the package into its cache,
and the desktop records `phase: "ready"` once the probe exits 0. No side
effects beyond a cached npm install.

## Bringing your own engine

REA does not install Ghidra, IDA, JADX, Binwalk, or Unblob. Native and
firmware tasks need Ghidra on `PATH`; JavaScript / Electron work needs no
extra engine. The Agent can run `npx -y rea-agents doctor --json` to print
the provider status before starting a session.

## Updating the upstream Skill

The Skill is a snapshot of the upstream `reverse-engineer-anything` skill.
When bumping the plugin version, run the following from this directory:

```bash
rm -rf agent/skills/reverse-engineer-anything
cp -r /path/to/rea/.agents/skills/reverse-engineer-anything agent/skills/
```

Then bump the `version` field in `plugin.json`, `ability.json`, and the
matching entry in `.astravia/marketplace.source.json` before running
`node scripts/marketplace.mjs check` from the repository root.

## See also

- [REA project site](https://rea.tools/)
- [REA on GitHub](https://github.com/morluto/rea)
- [Guides and workflows](https://rea.tools/guides/)

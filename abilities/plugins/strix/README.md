# Strix

The Strix pentest screen, in a Astravia tab: the launch column you know from
`strix`, and the scan view behind it — running on the model you already configured
in Astravia, not on a second API key.

This plugin is a first-party integration over
[usestrix/strix](https://github.com/usestrix/strix). It reproduces the terminal
interface of the CLI and keeps Strix's sandbox and tradecraft. **There is one AI and it
lives in the host conversation**: the plugin serves 26 `strix_*` tools over MCP, so the
host agent plans and executes, and this tab renders that run. No second model call, no
second transcript, no extra credential.

## What the plugin contributes

| Surface | Behaviour |
|---|---|
| Activity tab `strix.console` | `initiallyVisible: false` — nothing appears under the conversation until you open it. From there it is the CLI: launch column → trace + sidebar. |
| Input action `strix.activate` | One click opens the tab; while active, every prompt carries Strix's method (`decoratePrompt`). |
| Input | Everything typed in the panel goes to the host conversation (`sendPrompt`, or `createSession` first when there is none). A failed delivery is reported, never simulated. |
| Output | The host turn rendered from two witnesses: conversation events (which tool, streamed answer text) and the bridge's own feed (command, exit code, duration, output tail). Both rules live in `src/domain/conversation-projection.ts`. |
| Tools | 26 of them, described once in `src/agent/strix-tools.ts` and served over MCP and `/api/tool`: the sandbox (`strix_environment`, `strix_sandbox_start`, `strix_exec`, `strix_sandbox_status`, `strix_sandbox_stop`), the browser and proxy, skills, findings and the report (Markdown or SARIF), and the working artefacts (`strix_note_*`, `strix_todo_*`, `strix_coverage_*`, `strix_threat_model`). |
| Host binding | `useActiveConversation()` (`agent.session.read`): the panel reports **the conversation's model**, the conversation's folder is the sandbox workspace, and the host agent's `strix_*` calls appear in the trace. Switch model in the chat and the panel follows. |
| Skills | The nine upstream consumer skills ship in `agent/skills/` but are declared `hidden`: the capability page, slash menu and skill picker show **Strix** — name and icon — not nine lookalikes. The agent still loads them. |

## The screen

Two phases, traced from upstream's Go TUI:

| Upstream | Here |
|---|---|
| `setup.go:setupBody` — wordmark, tagline, composer with the model line inside, feedback log, `enter launch scan / ctrl+c quit / vX` | `features/scan-console/components/launch-screen.tsx` |
| `view.go:mainView` — bordered trace, status row, composer, sidebar boxes | `features/scan-console/components/scan-screen.tsx` |
| `render/registry.go` — `→ Using tool <name>`, arguments, status glyph | `features/scan-console/components/trace-block.tsx` |
| `todos` / `notes` / `coverage` panels | `features/scan-console/components/artefact-panels.tsx` |
| `render/styles.go` — the report palette | the `--sx-*` variables in `src/style.css` |

The one line that differs is the model chip: upstream prints `STRIX_LLM`, this
prints the model Astravia gave the plugin (`● glm-5.3 · openrouter/z-ai`).

Styling is deliberately fixed to the terminal's surface — black, monospace, Strix's
green — instead of host theme tokens, because a themed card no longer looks like the
tool. Only `astra-strix-*` classes are defined.

## What is aligned with upstream, and what is not

Aligned with upstream in 0.7.0: the screen, and the tool surface the host agent actually drives —
including kept shell sessions (`exec_command(background/tty)` + `write_stdin`), `patch`, `view_image`,
`think` and `scope`. See ADR `strix-0006` for the item-by-item table.
Markdown or SARIF, notes, todos, coverage, threat model), and honest coverage in the
report.

Not aligned, on purpose:

- **The agent loop and its model.** Upstream runs its own Python agent with its own key;
  here the host conversation is the loop, using the same tools over MCP. That is the one
  deliberate divergence the whole plugin is built around (ADR `strix-0003`).
- **Multi-agent orchestration.** Upstream's `create_agent` / `send_message_to_agent` /
  `wait_for_agents` / `view_agent_graph` need a side that can run a sub-loop. Without a
  plugin-side model there is nothing to run it; use the host's own subagents instead, which
  share this sandbox and ledger. A `spawn` tool here would promise orchestration that does
  not exist.
- **An operator-in-the-loop question tool.** The host already asks the user and already
  has a question panel; a second one in this tab would be a second place to answer.

- **Caido proxy tools** (`list_requests`, `view_request`, `repeat_request`, `sitemap`).
  Caido runs in the container; the agent drives it over `strix_exec`, but the
  structured proxy API is not wrapped. Upstream's proxy tools assume it owns the Caido
  client; here that client would be a second implementation of container state.
- **`web_search`.** Upstream needs an Exa/Perplexity key of its own; those keys stay
  out of a plugin whose whole premise is "no second credential".
- **Python exploit runtime / `apply_patch` / `view_image`.** The container has them
  and `strix_exec` reaches them; dedicated wrappers would add nothing the agent cannot
  already do with one command.
- **`strix view`.** The run viewer is a local web app in the CLI; here the tab *is* the
  view, and `/api/state` already carries everything it renders.

If you need one of the missing four, say which: the proxy wrapper is the only one
that is real work rather than a synonym for `strix_exec`.

## Architecture

```text
src/index.tsx                 registration only (tab + input action)
src/runtime.ts                strix-bridge lifecycle via ctx.services
src/agent/                    the MCP tool catalogue (schemas, one line of copy each)
src/domain/bridge-client.ts   HTTP + SSE client
src/domain/conversation-projection.ts  host events + service events -> one trace
src/domain/engagement.ts      whether the capsule is on (survives tab remounts)
src/domain/assessment-presence.ts      "is an assessment already open"
src/domain/host-sync.ts       model label / workspace name (read-only)
src/domain/bridge-payloads.ts response narrowing for every artefact
src/domain/launch-request.ts  prompt -> targets vs instruction (setup.go parity)
src/domain/model-label.ts     provider/model split and default-model choice
src/features/scan-console/    the two screens, the state machine
src/features/findings/        findings list
src/service/                  the same service, authored in TypeScript
  main.ts                     MCP tool surface + /api/* + /api/tool
  sandbox.ts                  container lifecycle and command execution
  docker.ts                   docker CLI plumbing (run/exec/rm/pull)
  skills.ts                   reads Strix's skill library from the installed engine
  findings.ts                 findings ledger, Markdown report, SARIF handoff
  notes.ts                    assessment notes (create/list/get/update/delete)
  todo.ts                     the plan, sorted the way the panel shows it
  coverage.ts                 covered surfaces + the threat model
  sarif.ts                    SARIF 2.1.0 for CI
  paths.ts                    one data-directory resolver (env, else ~/.astravia)
dist/service/main.mjs         bundled output of src/service (generated at build, shipped)
agent/skills/                 nine upstream consumer skills, copied verbatim
```

Everything the plugin compiles is TypeScript. `dist/service/main.mjs` is a build
artifact: `npm run build` runs Vite first (which empties `dist/`) and then bundles
`src/service/*.ts` with esbuild into `dist/`, which is gitignored.

### What is reused, and what is not

* **Reused:** Strix's sandbox **image** (nmap, nuclei, ffuf, sqlmap, Caido,
  agent-browser, trivy, gitleaks, trufflehog …), its **skill library** read as
  Markdown from the installed `strix-agent` package, and its **interface** — layout,
  wording, glyphs, palette.
 * **Not used:** Strix's Python agent loop and its model configuration. The loop is the
   host conversation, which already has the `strix_*` tools; the plugin owns the container
   and the evidence, not the reasoning.

### Why the service declares its artifact

The host's installer accepts a service runtime only when the payload set matches
`plugin.json#providers.services[].runtime.platforms[<tag>].artifacts` one-for-one
with verified SHA-256, and it refuses to start a runtime it did not install.
`src/runtime.ts` reads the artifact list back out of the packaged `plugin.json`,
fetches each file over `astravia-plugin://<id>/versions/<version>/…`, installs, then
starts. After changing the service, re-stamp the digest: `npm run stamp-service`.

## Prerequisites

| Need | Why | Check |
|---|---|---|
| Docker (recommended) | every Strix tool runs inside its sandbox image; without a daemon the plugin falls back to this machine's toolchain and says so | `docker info` |
| A model on the conversation | the host agent does the reasoning; with no model the launch column says so and Enter does nothing | the composer's model chip |

`strix-agent` is **optional**: when it is installed in any Python or uv tool venv the
service reads the engine's full skill library, otherwise it serves the 13 tool manuals
shipped under `agent/skills/strix/tooling/`. Nothing in the manifest requires the CLI —
that used to be a `providers.cli` entry, and the host drops *every* agent contribution
(skills and MCP servers both) while a declared CLI provider is not ready, which made the
capsule appear over a session that had no `strix_*` tools at all.

No API key is needed here: inference happens in the host, on the model you already
selected.

## Build and check

```bash
cd abilities/plugins/strix
npm install
npm run typecheck       # tsc --noEmit
npm test
npm run build:service   # bundle src/service -> dist/service/main.mjs
npm run stamp-service   # rewrite the artifact digest after a service change
npm run build           # Vite first (empties dist), then the service bundle
npm run check:service   # host-node service: health, /mcp, /api/state, /api/tool
npm run check           # typecheck + tests + service smoke
```

Repository-level checks:

```bash
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build
node --test tests/*.test.mjs
```

## Release note

`docs/plugin-project-structure.md:52` lists `release/` as a committed archive
directory. This plugin follows the repository's `.gitignore` and
`scripts/stage-plugin-release.py` instead: `dist/` and `release/` stay out of Git and
CI publishes the immutable `.astraviapkg`.

## Attribution

Strix is Apache-2.0, © usestrix. The icon in `assets/icon.png` is the upstream mark
from `docs/logo/strix.png`.

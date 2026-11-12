# Strix

The Strix pentest screen, in a Astravia tab: the launch column you know from
`strix`, and the scan view behind it — running on the model you already configured
in Astravia, not on a second API key.

This plugin is a first-party integration over
[usestrix/strix](https://github.com/usestrix/strix). It reproduces the terminal
interface of the CLI and keeps Strix's sandbox and tradecraft; the model comes from
`ctx.ai`, so a scan needs no extra credential and writes no second transcript.

## What the plugin contributes

| Surface | Behaviour |
|---|---|
| Activity tab `strix.console` | `initiallyVisible: false` — nothing appears under the conversation until you open it. From there it is the CLI: launch column → trace + sidebar. |
| Input action `strix.activate` | One click opens the tab; while active, every prompt carries Strix's method (`decoratePrompt`). |
| Agent loop | `src/agent/strix-agent.ts`: `ctx.ai.chat()` in a loop over the bridge's tools, with the transcript kept here. Stop aborts before the next model call. |
| Host binding | `useActiveConversation()` (`agent.session.read`): the tab runs on **the conversation's model**, mounts **the conversation's folder** as the sandbox workspace, and mirrors the host agent's own `strix_*` tool calls into the trace. Switch model in the chat and the panel follows. |
| MCP tools | `strix_environment`, `strix_sandbox_start`, `strix_exec`, `strix_sandbox_status`, `strix_sandbox_stop`, `strix_list_skills`, `strix_load_skills`, `strix_file_finding`, `strix_list_findings`, `strix_report` — the host agent can still drive the same sandbox over MCP. |
| Skills | The nine upstream consumer skills ship in `agent/skills/` but are declared `hidden`: the capability page, slash menu and skill picker show **Strix** — name and icon — not nine lookalikes. The agent still loads them. |

## The screen

Two phases, traced from upstream's Go TUI:

| Upstream | Here |
|---|---|
| `setup.go:setupBody` — wordmark, tagline, composer with the model line inside, feedback log, `enter launch scan / ctrl+c quit / vX` | `features/scan-console/components/launch-screen.tsx` |
| `view.go:mainView` — bordered trace, status row, composer, sidebar boxes | `features/scan-console/components/scan-screen.tsx` |
| `render/registry.go` — `→ Using tool <name>`, arguments, status glyph | `features/scan-console/components/trace-block.tsx` |
| `render/styles.go` — the report palette | the `--sx-*` variables in `src/style.css` |

The one line that differs is the model chip: upstream prints `STRIX_LLM`, this
prints the model Astravia gave the plugin (`● glm-5.3 · openrouter/z-ai`).

Styling is deliberately fixed to the terminal's surface — black, monospace, Strix's
green — instead of host theme tokens, because a themed card no longer looks like the
tool. Only `astra-strix-*` classes are defined.

## Architecture

```text
src/index.tsx                 registration only (tab + input action)
src/runtime.ts                strix-bridge lifecycle via ctx.services
src/agent/                    the loop, its tools, its system prompt
src/domain/bridge-client.ts   HTTP + SSE client
src/domain/launch-request.ts  prompt -> targets vs instruction (setup.go parity)
src/domain/model-label.ts     provider/model split and default-model choice
src/features/scan-console/    the two screens, the state machine
src/features/findings/        findings list
src/service/                  the same service, authored in TypeScript
  main.ts                     MCP tool surface + /api/* + /api/tool
  sandbox.ts                  container lifecycle and command execution
  docker.ts                   docker CLI plumbing (run/exec/rm/pull)
  skills.ts                   reads Strix's skill library from the installed engine
  findings.ts                 findings ledger and Markdown report
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
* **Not used:** Strix's Python agent loop and its model configuration. The loop runs
  here on `ctx.ai`; tools reach the container through the plugin's own service.

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
| Docker | every Strix tool runs inside its sandbox image | `docker info` |
| A default model in Astravia | the loop runs on `ctx.ai`; without one the launch screen says so and Enter does nothing | Settings → model |
| `strix-agent` on some Python in `PATH` | the skill library lives inside it; the plugin reads the Markdown, it does not run the engine | `python -c "import strix"` |

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

# Strix

Strix's security toolkit inside Astravia: a full penetration-testing sandbox plus
Strix's own skill library, driven by the conversation you already have.

This plugin is a first-party integration over
[usestrix/strix](https://github.com/usestrix/strix). It does not ship an agent and
does not ask for a model: the host application already runs an agent on the model
the user configured, so the plugin contributes what that agent lacks — Strix's
container and Strix's tradecraft — and stays out of the model business.

## What the plugin contributes

| Surface | Behaviour |
|---|---|
| Activity tab `strix.console` | `initiallyVisible: false` — nothing appears under the conversation until you open it. Trace on the left, sandbox / targets / findings on the right. |
| Input action `strix.activate` | One click opens the tab; while active, every prompt carries Strix's method (`decoratePrompt`). The button inherits the plugin's own icon and label. |
| MCP tools | `strix_environment`, `strix_sandbox_start`, `strix_exec`, `strix_sandbox_status`, `strix_sandbox_stop`, `strix_list_skills`, `strix_load_skills`, `strix_file_finding`, `strix_list_findings`, `strix_report`. |
| Skills | The nine upstream consumer skills ship in `agent/skills/` but are declared `hidden`: the capability page, slash menu and skill picker show **Strix** — name and icon — not nine lookalikes. The agent still loads them. |

## Architecture

```text
src/index.tsx                 registration only (tab + input action)
src/runtime.ts                strix-bridge lifecycle via ctx.services
src/domain/bridge-client.ts   HTTP + SSE client, read-only
src/features/scan-console/    the console: trace, session, targets, composer
src/features/findings/        findings list
src/service/                  the same service, authored in TypeScript
  main.ts                     MCP tool surface + /api/*
  sandbox.ts                  container lifecycle and command execution
  docker.ts                   docker CLI plumbing (run/exec/rm/pull)
  skills.ts                   reads Strix's skill library from the installed engine
  findings.ts                 findings ledger and Markdown report
dist/service/main.mjs         bundled output of src/service (generated at build, shipped)
agent/skills/                 nine upstream consumer skills, copied verbatim
```

Everything the plugin compiles is TypeScript. `dist/service/main.mjs` is a build
artifact: `npm run build` runs Vite first (which empties `dist/`) and then bundles
`src/service/*.ts` with esbuild into `dist/`, which is gitignored. The packager
ships `dist/`; the sources stay in `src/`. There is no `service/` directory in the
source tree - generated code lives with the rest of the build output.

### Where Strix's engine is reused, and where it is not

* **Reused:** Strix's sandbox **image** (all of its tooling — nmap, nuclei, ffuf,
  sqlmap, Caido, agent-browser, trivy, gitleaks, trufflehog …) and its **skill
  library**, read as Markdown from the installed `strix-agent` package. Upgrade the
  engine and both improve; nothing here rewrites a pack.
* **Not used:** `run_strix_scan` and its agent loop. The host already has an agent,
  a conversation and tool dispatch, and running Strix's in parallel would need a
  second model credential and produce two competing transcripts.

### Why the service declares its artifact

The host's installer accepts a service runtime only when the payload set matches
`plugin.json#providers.services[].runtime.platforms[<tag>].artifacts` one-for-one
with verified SHA-256 (`plugin-service-runtime-installer.ts`), and it refuses to
start a runtime it did not install. `src/runtime.ts` therefore reads the artifact
list back out of the packaged `plugin.json`, fetches each file over
`astravia-plugin://<id>/versions/<version>/…`, installs, then starts. After
changing the service, re-stamp the digest: `npm run stamp-service`.

## Prerequisites

| Need | Why | Check |
|---|---|---|
| Docker | every Strix tool runs inside its sandbox image | `docker info` |
| `strix-agent` on some Python in `PATH` | the skill library lives inside it; the plugin reads the Markdown, it does not run the engine | `python -c "import strix"` |

No model credential is needed here: inference happens in the host, on the model you
already selected in Astravia.

## Build and check

```bash
cd abilities/plugins/strix
npm install
npm run typecheck       # tsc --noEmit
npm test
npm run build:service   # bundle src/service -> dist/service/main.mjs
npm run stamp-service   # rewrite the artifact digest after a service change
npm run build           # Vite first (empties dist), then the service bundle
npm run check:service   # host-node service: health, /mcp, /api/state
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
`scripts/stage-plugin-release.py` instead: `dist/` and `release/` stay out of Git
and CI publishes the immutable `.astraviapkg`. See `AGENTS.md:259`.

## Attribution

Strix is Apache-2.0, © usestrix. The icon in `assets/icon.png` is the upstream mark
from `docs/logo/strix.png`.

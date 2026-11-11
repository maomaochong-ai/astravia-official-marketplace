# Strix

Strix's security toolkit inside Astravia: a full penetration-testing sandbox plus
Strix's own 78-skill knowledge library, driven by the conversation you already
have.

This plugin is a first-party integration over
[usestrix/strix](https://github.com/usestrix/strix). It does not reimplement a scan
and it does not ship a second agent: the host application already runs an agent
with the user's configured model, so the plugin contributes what that agent
lacks — Strix's sandbox and Strix's skills — and stays out of the model business
entirely.

## What the plugin contributes

| Surface | Behaviour |
|---|---|
| Activity tab `strix.console` | `initiallyVisible: false` — nothing appears under the conversation until you open it. Mirrors the upstream TUI: trace on the left, sandbox/targets/findings boxes on the right. |
| Input action `strix.activate` | One click opens the tab and marks the next prompt as a Strix task (`decoratePrompt`). |
| MCP tools | `strix_environment`, `strix_sandbox_start`, `strix_exec`, `strix_sandbox_status`, `strix_sandbox_stop`, `strix_list_skills`, `strix_load_skills`, `strix_file_finding`, `strix_list_findings`, `strix_report`. |
| Skills | The nine upstream consumer skills ship in `agent/skills/` but are declared `hidden`: the capability page, slash menu and skill picker show **Strix**, not nine lookalikes. The agent still loads them. |

## Architecture

```text
src/index.tsx                 registration only (tab + input action)
src/runtime.ts                strix-bridge lifecycle via ctx.services
src/domain/bridge-client.ts   HTTP + SSE client, read-only
src/features/scan-console/    the console: trace, session box, composer
src/features/findings/        findings list
service/main.mjs              host-node service: MCP tool surface + /api/*
service/bridge/tools.py       Strix sandbox (create_or_reuse + session.exec) and skills
service/bridge/findings.py    findings ledger and Markdown report
agent/skills/                 9 upstream consumer skills, copied verbatim
```

### Where Strix's engine is reused, and where it is not

* **Reused:** `strix.runtime.session_manager.create_or_reuse` for the container,
  `session.exec` for commands, `strix.skills.get_available_skills` /
  `load_skills` for the knowledge packs. These are the same entry points Strix's
  own runner and `load_skill` tool use, so the sandbox image, bind mounts and
  skill rendering are upstream's, not ours.
* **Not used:** `run_strix_scan` and its agent loop. The host already has an agent
  loop with a model, a conversation and tool dispatch; running Strix's in parallel
  would mean a second model credential and two competing transcripts.

### Why the service declares every file

The host's installer accepts a service runtime only when the payload set matches
`plugin.json#providers.services[].runtime.platforms[<tag>].artifacts` one-for-one
with verified SHA-256 (`plugin-service-runtime-installer.ts`), and it refuses to
start a runtime it did not install. So `src/runtime.ts` reads the artifact list
back out of the packaged `plugin.json`, fetches each file over
`astravia-plugin://<id>/versions/<version>/…`, installs, then starts. After
editing anything under `service/`, re-stamp the digests: `npm run stamp-service`.

## Prerequisites

| Need | Why | Check |
|---|---|---|
| Python ≥ 3.12 with `strix-agent` | the bridge imports the engine | `python -c "import strix"` |
| Docker | every Strix tool runs inside its sandbox | `docker info` |

No model credential is needed here: inference happens in the host, on the model
you already selected in Astravia.

## Build and check

```bash
cd abilities/plugins/strix
npm install
npm test
npm run stamp-service   # after editing service/
npm run build
npm run check:service   # host-node service: health, /mcp, /api/state
npm run check:bridge    # Python bridge protocol over stdin/stdout
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

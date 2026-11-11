# Strix

Security testing inside Astravia: a team of autonomous agents probes code, APIs and running applications, then reports exploitable findings with proof and remediation.

This plugin is a thin integration over [usestrix/strix](https://github.com/usestrix/strix). It does not reimplement scanning: the engine, its sandbox and its 78 internal skills are used exactly as upstream ships them.

## What the plugin adds

| Surface | Behaviour |
|---|---|
| Activity tab `strix.console` | Registered with `initiallyVisible: false` — nothing appears under the conversation until you open it. |
| Input action `strix.activate` | One click opens the tab and puts `/penetration-testing-with-strix ` in the composer. |
| Slash commands / skill picker | The nine upstream consumer skills in `agent/skills/` are declared via `agent.skillPaths`, so `/penetration-testing-with-strix` and friends work as soon as the plugin is enabled. |
| Agent tools over MCP | `strix_probe_environment`, `strix_start_scan`, `strix_cancel_scan`, `strix_list_runs`, `strix_get_findings`, `strix_get_report`. |

## Architecture

```text
src/index.tsx                 registration only (tab + input action)
src/runtime.ts                strix-bridge lifecycle via ctx.services
src/domain/bridge-client.ts   HTTP + SSE client for the bridge
src/features/scan-console/    launch form, live timeline, panel
src/features/findings/        severity summary, finding list and card
service/main.mjs              host-node service: HTTP API + MCP endpoint
service/bridge/*.py           Python half: imports strix, drives scans
agent/skills/                 9 upstream consumer skills, copied verbatim
```

The split exists because the host only ships `host-node` and `managed-binary` runtimes. Packaging a Python interpreter into a per-platform binary would mean shipping and checksumming a ~100 MB artifact per OS; instead the Node service starts `python -m bridge` and relays JSON lines. Upstream changes therefore land in `service/bridge/scan.py`, never in the manifest or the UI.

### How the service gets installed

The host never unpacks a plugin's service itself: `PluginServiceRuntimeInstaller.resolve()` refuses to start a runtime that `install()` did not write, and `install()` accepts only a payload set matching `plugin.json#providers.services[].runtime.platforms[<tag>].artifacts` one-for-one with verified SHA-256. So `src/runtime.ts` reads the declared artifact list back out of the packaged `plugin.json`, fetches each file over `astravia-plugin://<id>/versions/<version>/…`, installs, then starts.

That is why every shipped service file is declared, not just the entry: declaring only `service/main.mjs` would install a runtime whose Python half is missing. After touching anything under `service/`, re-stamp the digests:`npm run stamp-service`.

The service answers `/api/health/ready` with 200 as soon as its HTTP server listens and reports the Python side in the body. The host treats a non-2xx health probe as a broken process and restarts it; a missing interpreter is something the panel explains and the user fixes, not a crash loop.

### Why scanning hangs off `run_strix_scan`

Upstream has no server mode, no local HTTP API and no JSON event stream (`--json` exists only on `strix cloud`). Its library entry point takes an `event_sink`, which is the only supported way to observe a scan live. The bridge calls that entry point and projects events through upstream's own `TuiLiveView`, so the timeline shows what Strix believes happened rather than a second guess at the SDK objects.

## Which model a scan runs on

The scan runs on **the model you already use in Astravia**. Nothing here asks for a second credential:

1. On activation the plugin reads `ctx.ai.listModels()` and hands the list to the Strix bridge service.
2. The bridge serves an OpenAI-compatible endpoint on loopback (`/v1/chat/completions`, bearer-token guarded).
3. `ctx.ai.chat()` answers those requests inside the host, so the model name and the provider key stay in Astravia.
4. Each scan is started with `STRIX_LLM=openai/<host model>`, `LLM_API_BASE=<that endpoint>` and `STRIX_API_TYPE=chat_completions`, applied just before Strix reads its settings.

The relay is started by plugin activation, not by the panel, so closing the tab does not cut inference off mid-scan. Strix's own `~/.strix/cli-config.json` only matters when no host model exists (a headless `strix` CLI run, for instance).

## Prerequisites

| Need | Why | Check |
|---|---|---|
| Python ≥ 3.12 with `strix-agent` | the bridge imports the engine | `python -c "import strix"` |
| Docker | Strix runs every tool inside its sandbox; without it, only `view`, `auth`, `cloud` work | `docker info` |
| `STRIX_LLM` + `LLM_API_KEY` | the scan needs its own model credential | `~/.strix/cli-config.json` |

Install the engine with `uv tool install strix-agent`. Set the model in `~/.strix/cli-config.json`:

```json
{ "env": { "STRIX_LLM": "anthropic/claude-sonnet-4-5", "LLM_API_KEY": "sk-..." } }
```

The plugin never reads the host's model credentials: Strix's provider naming is its own, and a wrong-but-present key produces a scan that authenticates nowhere.

Point the bridge at a specific interpreter with `STRIX_PYTHON` when the default `python` is not the one that has `strix-agent`.

## Build and check

```bash
cd abilities/plugins/strix
npm install
npm run test
npm run stamp-service  # rewrite the 7 service digests after editing service/
npm run build
npm run check:service  # host-node service: health, /mcp, /api/state
npm run check:bridge   # Python bridge protocol over stdin/stdout
```

Repository-level checks:

```bash
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build
node --test tests/*.test.mjs
```

## Release note

`docs/plugin-project-structure.md:52` lists `release/` as a committed archive directory. This plugin follows the repository's `.gitignore` and `scripts/stage-plugin-release.py` instead: `dist/` and `release/` stay out of Git and CI publishes the immutable `.astraviapkg`. See `AGENTS.md:259`.

## Attribution

Strix is Apache-2.0, © usestrix. The icon in `assets/icon.png` is the upstream mark from `docs/logo/strix.png`.

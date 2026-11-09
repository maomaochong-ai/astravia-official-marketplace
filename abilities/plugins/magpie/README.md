# Magpie Gateway

Connects the [magpie](https://usemagpie.ai) gateway running on this computer to Astravia. magpie puts one local OpenAI-compatible endpoint in front of every provider you already pay for; this plugin reads that endpoint's catalog and, when you ask it to, publishes those models into Astravia's own model picker.

## What it does

- Asks magpie to identify itself: `GET /api/hello` returns `{ "name": "magpie", "version": … }`, so another Ollama-compatible service on the same port is not mistaken for it.
- Reads `GET /v1/models` and shows provider, context window, image input and reasoning support per model.
- Writes the catalog into the host model registry as an `openai-completions` provider on your click. Never automatically.
- Registers two read-only Agent tools: `magpie_status` and `magpie_models`.
- Opens magpie's own page (`127.0.0.1:3430`) for provider setup.
- Installs the official command-line build when it is missing, and starts the gateway, from a button in the panel: it reads the release feed, checks the SHA-256 the feed publishes, installs to `~/.local/bin/magpie` and runs `magpie serve` as a child process of the plugin.

## What it does not do

- It does not ship a binary inside the package. magpie is a Go program; the five platform builds are 15–25 MB each and the package limit is 50 MB. The panel downloads the official build at your click instead, and verifies it against the checksum in `https://usemagpie.ai/api/latest` before installing.
- It does not install a system service. `magpie serve` runs as a child of the plugin and stops when Astravia quits; there is no launchd unit, no `sudo`, no change to `PATH` and nothing written outside `~/.local/bin` and the plugin's own storage. For a gateway that survives a reboot, run `magpie daemon install` in a terminal once.
- It does not run `sh` unless you allowed it. The first time the button is used, Astravia asks you to allow the `sh` command for this plugin; if you decline, the panel says so instead of failing silently.
- It does not hold your provider keys. They stay in magpie's configuration (`~/.config/magpie`); the plugin only stores the gateway address and the gateway key in its own private storage.
- It does not proxy requests. Astravia talks to the gateway directly once the provider is published.
- It does not work when magpie is not running. The panel says which of "refused", "timed out", "not magpie" and "HTTP error" happened.

## Install

Two ways, both from this computer:

1. **From the panel** — open the Magpie Gateway view and press **安装并启动**. The plugin fetches the release feed, verifies the checksum, installs `~/.local/bin/magpie` and starts the gateway.
2. **By hand** — run the official installer:

```bash
curl -fsSL https://usemagpie.ai/install.sh | sh
magpie serve          # or launch the app; default gateway 127.0.0.1:3425
```

Either way, add at least one provider inside magpie before publishing: an empty catalog is refused rather than written as an empty provider.

A gateway started by the plugin is a child process, so it does not survive an Astravia quit. To keep one running across logins, use magpie's own service: `magpie daemon install`.

## Endpoints used

| Purpose | Request |
| --- | --- |
| Identity | `GET {baseUrl}/api/hello` → `{ "name": "magpie", "version": "…" }` |
| Liveness fallback | `GET {baseUrl}/api/version` → `{ "version": "…" }` |
| Release feed | `GET https://usemagpie.ai/api/latest` → per-platform `url`, `size`, `sha256` |
| Catalog | `GET {baseUrl}/v1/models` → `{ "object": "list", "data": [ … ] }` |
| Published base URL | `{baseUrl}/v1` |
| magpie page | `127.0.0.1:3430` when the gateway is on the default port |

`baseUrl` defaults to `http://127.0.0.1:3425`. Requests go through `ctx.network` (main process), so no renderer CORS applies; `plugin.json` declares `network.allowedHosts` for `127.0.0.1`, `localhost` and `usemagpie.ai`, and the host matches hostnames only, never ports.

The install and start actions go through `ctx.command`: `plugin.json` declares the single bare command name `sh`, and every action is a fixed script passed to `sh -c` — the only interpolated values are the release URL (must start with `https://github.com/yetone/magpie-releases/releases/download/`) and a 64-character lowercase hex checksum from the feed.

## Development

```bash
npm install
npm run check     # tsc --noEmit
npx vitest run    # pure modules + controller
npm run build     # writes release/magpie-<version>.astraviapkg
```

Version bumps follow the repository rule: any change to `src/`, `plugin.json`, `package.json`, `locales/`, `assets/` or `scripts/` requires a new version, because CI compares runtime content against the published sha.

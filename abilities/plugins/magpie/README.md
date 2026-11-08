# Magpie Gateway

Connects the [magpie](https://usemagpie.ai) gateway running on this computer to Astravia. magpie puts one local OpenAI-compatible endpoint in front of every provider you already pay for; this plugin reads that endpoint's catalog and, when you ask it to, publishes those models into Astravia's own model picker.

## What it does

- Probes `GET /api/version` to prove the gateway is up — and that it really is magpie, not something else listening on the port.
- Reads `GET /v1/models` and shows provider, context window, image input and reasoning support per model.
- Writes the catalog into the host model registry as an `openai-completions` provider on your click. Never automatically.
- Registers two read-only Agent tools: `magpie_status` and `magpie_models`.
- Opens magpie's own page (`127.0.0.1:3430`) for provider setup.

## What it does not do

- It does not install, start or stop magpie, and it ships no binary. magpie is a Go program you install yourself; the five platform builds are 15–25 MB each and the package limit is 50 MB, so bundling it is not an option.
- It does not hold your provider keys. They stay in magpie's configuration (`~/.config/magpie`); the plugin only stores the gateway address and the gateway key in its own private storage.
- It does not proxy requests. Astravia talks to the gateway directly once the provider is published.
- It does not work when magpie is not running. The panel says which of "refused", "timed out", "not magpie" and "HTTP error" happened.

## Install

```bash
curl -fsSL https://usemagpie.ai/install.sh | sh
magpie serve          # or launch the app; default gateway 127.0.0.1:3425
```

Add at least one provider inside magpie before publishing: an empty catalog is refused rather than written as an empty provider.

## Endpoints used

| Purpose | Request |
| --- | --- |
| Liveness + identity | `GET {baseUrl}/api/version` → `{ "version": "…" }` |
| Catalog | `GET {baseUrl}/v1/models` → `{ "object": "list", "data": [ … ] }` |
| Published base URL | `{baseUrl}/v1` |
| magpie page | `127.0.0.1:3430` when the gateway is on the default port |

`baseUrl` defaults to `http://127.0.0.1:3425`. Requests go through `ctx.network` (main process), so no renderer CORS applies; `plugin.json` declares `network.allowedHosts` for `127.0.0.1` and `localhost`, and the host matches hostnames only, never ports.

## Development

```bash
npm install
npm run check     # tsc --noEmit
npx vitest run    # pure modules + controller
npm run build     # writes release/magpie-<version>.astraviapkg
```

Version bumps follow the repository rule: any change to `src/`, `plugin.json`, `package.json`, `locales/`, `assets/` or `scripts/` requires a new version, because CI compares runtime content against the published sha.

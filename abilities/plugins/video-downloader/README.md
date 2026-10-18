# Video Downloader plugin

Downloads video, audio and image renditions from the sites supported by
[`iawia002/lux`](https://github.com/iawia002/lux). The panel is deliberately small: one link
field, a rendition list with real file sizes, and a queue. Everything runs locally.

## Runtime shape

The plugin is a `host-node` managed service plus one pinned binary:

```text
<runtime>/
  service/                  # host-node entry: service/dist/main.js
  bin/lux                   # upstream lux v0.24.1 release asset
```

`plugin.json` declares two artifacts per platform: the service zip (built here) and the
upstream lux archive. Neither carries a `url`; the renderer downloads both in
`src/runtime.ts`, verifies the declared SHA-256 with WebCrypto, and hands the payloads to
`ctx.services.install`. Digests for the service zip live in `plugin.json` and
`runtime-lock.json`; lux digests come from the upstream `lux_0.24.1_checksums.txt` release
asset. Nothing resolves `latest`.

`service/src/lux/lux-binary.ts` locates the executable: `bin/lux` first, then a bounded
recursive search over the installed runtime payload (ZIP archives lose the executable bit,
so it re-applies `0o755` before trusting `--version`), then `PATH`.

## Service surface

The service is a small `node:http` server built with `tsc` only — no runtime dependencies.

| Route | Purpose |
| --- | --- |
| `GET /health` | Host readiness probe; reports engine capabilities and the download folder |
| `GET\|POST /api/v1/capabilities` | Read or re-probe lux / ffmpeg |
| `POST /api/v1/probe` | Resolve a URL into items and renditions (`lux -j`) |
| `GET\|POST /api/v1/tasks` | List or enqueue downloads |
| `GET\|DELETE /api/v1/tasks/:id` | Inspect or drop one task |
| `POST /api/v1/tasks/:id/{cancel,reveal,retry}` | Task actions |
| `GET\|PUT /api/v1/settings` | Download folder, concurrency, cookie, threading, partial files |
| `POST /mcp` | Hand-written JSON-RPC for the Agent (`video_probe`, `video_download`, `video_tasks`, `video_cancel`, `video_supported_sites`) |

Downloads run through `lux` with `-s` (no ANSI progress bar) inside a per-task working
directory that is also the process `cwd`, which keeps lux's relative merge manifests
contained. Progress is sampled from bytes on disk rather than parsed from the terminal.

### ffmpeg

`lux` merges every multi-part rendition through ffmpeg: `MergeToMP4` for plain MP4 and
`MergeFilesWithSameExtension` (one `-i` per part, stream copy) for muxed DASH/fMP4 payloads.
Only single-part streams avoid it. So `needsFfmpeg` is `partCount > 1`, ffmpeg is treated as
an optional host dependency, and a task that needs it while ffmpeg is missing is rejected
with `412 ffmpeg_required` instead of failing halfway through.

## Presentation

`assets/` holds the icon and the ability detail blocks (`ability.json` → `assets/detail.json`,
`assets/detail.zh.json`). They live there rather than at the package root because the published
archive ships `assets/` but not a root `detail.json`, so a root path would only work in the
storefront. The panel itself is described in `docs/panel-design.md`.

## Build

```bash
npm install
npm run check          # tsc for the panel and the service
npm test               # panel + service suites
npm run build          # panel bundle (dist/)
npm run package:service  # deterministic service zip in release/, prints its sha256
```

After changing anything under `service/`, rebuild the zip, update the digest in both
`plugin.json` and `runtime-lock.json`, and bump the plugin version. The zip pins entry
order, timestamps and compression level so CI reproduces the same bytes.

`dist/` and `release/` are not committed; the marketplace CI builds and publishes them.

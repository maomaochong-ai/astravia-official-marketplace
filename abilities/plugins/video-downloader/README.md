# Video Downloader plugin

Downloads video, audio and image renditions from the sites supported by
[`yt-dlp`](https://github.com/yt-dlp/yt-dlp). The panel is deliberately small: one link field, a
rendition list with real file sizes, and a queue. Everything runs locally.

The field accepts arbitrary share text, not only a bare URL: `src/domain/target-url.ts` pulls
the first link out of a message such as `7.97 复制打开抖音，看看【…】 https://v.douyin.com/abc/ eBT:/`, adds
`https://` to schemeless short links (`b23.tv/BV1xx`), and the field is rewritten with the exact
URL that is about to be resolved.

A `403` from a site is reported as `site_blocked`, not as a missing login: sites that sign their
own API requests (douyin, for example) reject any headless client regardless of cookies, so the
panel says what happened instead of asking for a cookie that cannot help. `auth_required` is
reserved for `401` and explicit login prompts, where the site cookie in settings is the fix.

The same panel is exposed through three host surfaces, all registered in `src/index.tsx`:
the sidebar workspace view (`downloader`), the conversation activity tab (`downloads`, on the
tab bar from the start and also in the "+" picker), and the composer chip (`open-downloads`)
that opens the tab for the current conversation.

## Runtime shape

The plugin is a `host-node` managed service. It ships one artifact per platform:

```text
<runtime>/
  service/                  # host-node entry: service/dist/main.js
```

`plugin.json` declares that artifact for each platform; it carries no `url`, so the renderer
downloads it in `src/runtime.ts`, verifies the declared SHA-256 with WebCrypto, and hands the
payload to `ctx.services.install`. The digest lives in both `plugin.json` and
`runtime-lock.json`, and the host refuses to install the runtime while its previous process is
still running — so the installer stops the service first, then installs, then starts it.

Nothing else is packaged. `yt-dlp` and `ffmpeg` are fetched by the service at run time and are
never part of the plugin archive.

## Engine provisioning

There is exactly one engine. The service starts fetching `yt-dlp` as soon as it boots
(`main.ts` → `context.provisionEngine()`), verifies the pinned SHA-256 from
`service/src/ytdlp/ytdlp-release.ts`, and keeps it under `<dataRoot>/bin`. A request that arrives
before the download finishes is not blocked: `POST /api/v1/probe` answers
`engine_preparing`, the panel waits for the transfer with a percentage, and only then re-probes.
`POST /api/v1/tasks` answers `503 engine_preparing` for the same reason.

ffmpeg is fetched on the same terms but only when a rendition actually needs merging
(`startFfmpegInstall()` on the `412 ffmpeg_required` path), because most single-file renditions
never touch it. Neither tool is ever installed by hand: the panel shows progress and a retry on
failure, not an install button.

## Service surface

The service is a small `node:http` server built with `tsc` only — no runtime dependencies.

| Route | Purpose |
| --- | --- |
| `GET /health` | Host readiness probe; reports engine capabilities and the download folder |
| `GET\|POST /api/v1/capabilities` | Read or re-probe yt-dlp / ffmpeg |
| `POST /api/v1/probe` | Resolve a URL into items and renditions |
| `GET\|POST /api/v1/tasks` | List or enqueue downloads |
| `GET\|DELETE /api/v1/tasks/:id` | Inspect or drop one task |
| `POST /api/v1/tasks/:id/{cancel,reveal,retry}` | Task actions |
| `GET\|PUT /api/v1/settings` | Download folder, concurrency, cookie, threading, partial files |
| `GET\|POST /api/v1/{ytdlp,ffmpeg}` | Read provisioning progress, or start it |
| `POST /mcp` | Hand-written JSON-RPC for the Agent (`video_probe`, `video_download`, `video_tasks`, `video_cancel`, `video_engine_status`, `video_supported_sites`) |

Downloads run through the engine inside a per-task working directory that is also the process
`cwd`. Progress is sampled from bytes on disk rather than parsed from the terminal.

A rendition is one `-f` selector: video-only streams carry `<id>+bestaudio/best`, which is why
`needsFfmpeg` is `hasVideo && !hasAudio`. A task that needs a merge while ffmpeg is missing is
rejected up front with `412 ffmpeg_required` instead of failing halfway through; the download is
started again once the tool is ready.

### ffmpeg

ffmpeg is not shipped in the plugin package (18–29 MB per platform, GPL).
`tools/ffmpeg-release.ts` pins one `eugeneware/ffmpeg-static` release asset per platform with its
SHA-256, and lists a byte-identical npmmirror copy as the fallback source because GitHub is slow
or unreachable on some networks. `tools/ffmpeg-installer.ts` tries each source in order, downloads
into `<dataRoot>/bin/ffmpeg(.exe)`, verifies the digest, gunzips and renames atomically.
`spawn` prepends that directory to `PATH`, so the engine finds it without relying on the host's
`PATH`. `GET /api/v1/ffmpeg` reports progress and `POST /api/v1/ffmpeg` starts the download.

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

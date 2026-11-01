# Video Downloader plugin

Downloads video, audio and image renditions from the sites supported by
[`yt-dlp`](https://github.com/yt-dlp/yt-dlp). The panel is deliberately small: one link field, a
rendition list with real file sizes, and a queue. Everything runs locally.

The field accepts arbitrary share text, not only a bare URL: `src/domain/target-url.ts` pulls
the first link out of a message such as `7.97 复制打开抖音，看看【…】 https://v.douyin.com/abc/ eBT:/`, adds
`https://` to schemeless short links (`b23.tv/BV1xx`), and the field is rewritten with the exact
URL that is about to be resolved.

A `403` from a site is reported as `site_blocked`. Sites that sign their own API requests
(douyin, for example) reject an anonymous client no matter what, so the panel says what happened
instead of asking for a cookie that cannot help — but a real browser session does get through,
which is what the `cookieBrowser` setting is for. `auth_required` is reserved for `401` and
explicit login prompts.

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

`plugin.json` declares that artifact for each platform. The bytes ship inside the plugin
package itself: `npm run build` zips the compiled service into a deterministic archive and
inlines it as base64 in a lazily loaded chunk (`scripts/service-payload-plugin.mjs`), and
`src/runtime.ts` hands that string to `ctx.services.install` after checking it against the
digest the manifest declares. Nothing is downloaded and no second release has to exist. The host
refuses to install the runtime while its previous process is still running — so the installer
stops the service first, then installs, then starts it.

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

## Egress and sessions

`proxyMode` decides who sees the proxy. `auto` (default) keeps mainland platforms on the
machine's own route and sends everything else through `proxy`, because a licensed mainland
service refuses a foreign exit while a foreign platform is unreachable without one — a single
global switch fixes one audience by breaking the other. `always` and `off` cover the manual case.
The mainland list is a suffix table (`service/src/network/domestic-hosts.ts`), not a site table:
media arrives from hosts such as `*.bilivideo.com` that no extractor names in advance.

Sessions have three sources, checked in order: the pasted `cookie` (written to a per-request
jar), `cookieBrowser` (`--cookies-from-browser`, the only way to get a real signed-in session),
and — only when neither is set — an anonymous `ttwid` registered with ByteDance for
ixigua/douyin. That last one is the only anonymous cookie with a measured effect: without it
ixigua answers `Cookies (not necessarily logged in) are needed`, with it the page loads.

`service/src/media/site-capabilities.ts` is the single machine-readable platform table; `site-catalog.ts` is derived from it and nothing else enumerates sites. Every entry claiming an extractor was checked against `yt-dlp --list-extractors` for the pinned engine version, so the table cannot advertise a platform the engine does not handle. A host the table does not support fails fast with `site_unsupported` (or `site_upstream_broken` / `site_offline` when the table carries a reason) instead of spending the 25 s probe timeout to report the same thing. A link whose path ends in a media extension (`.mp4`, `.m3u8`, …) skips the table entirely: the engine's generic extractor saves it as a file.

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
| `GET\|PUT /api/v1/settings` | Download folder, concurrency, cookie, cookie browser, proxy and proxy mode, threading, partial files |
| `GET\|POST /api/v1/{ytdlp,ffmpeg}` | Read provisioning progress, or start it |
| `GET /api/v1/sites` | Platform coverage: `{ groups: [{ key, sites }], unsupported: [{ label, reason }] }` |
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

## Adapters

An Adapter is user-imported JSON: metadata (`name`, `version`, `match`, `description`, `grant`)
plus one extraction body. The plugin ships **no site scripts** — the Adapters tab starts empty and
`ADAPTER_TEMPLATE` is the only built-in text, a generic `og:video` read. Design and the rejected
alternatives (a full userscript runtime) are in
[ADR 0001](../../../docs/adr/video-downloader/0001-userscript-adapter-layer.md).

An Adapter never downloads. It runs in `ctx.capture.offscreen` against the page the user points it
at and returns one playable address, which then travels the ordinary engine path:

| Piece | Value |
| --- | --- |
| `MediaItem.extractionPath` | `"adapter"` — the item records which layer produced it |
| `MediaFormat.directUrl` | the resolved address; the engine fetches this instead of the page URL |
| `MediaFormat.headers` | `referer` / `user-agent` / `origin` / `cookie` / `accept` / `x-requested-with` only, re-validated by `asHeaders` in the router |
| `streamId` | `"adapter"` — a marker, not a format selector, so `engineArguments` omits `-f` |

The engine gains one flag for this path: every accepted header becomes `--add-header name: value`.
`authorization` is deliberately not on the list, because the value would be visible in `ps`.

`ctx.capture` is optional. Without it the Adapters tab and the `action.runAdapter` remedy are not
rendered, and the panel reports `adapter.unavailable` instead of pretending the feature exists.

### Known unknowns

ADR 0001 §5 records three assumptions the Adapter layer rests on. None of them is proven by this
repository's tests, because they are properties of the host's offscreen window, not of this code:

| Assumption | How to settle it |
| --- | --- |
| The offscreen window shares the user's browser session, so a logged-in page resolves | Import the template adapter, open a page that requires a session, and run it. A `directUrl` means shared state; a login wall means it is not. |
| The target site does not reject an offscreen user agent or headless fingerprint | Same run, on a site that serves anonymous traffic: a fetch error is the rejection, a resolved address is not. |
| The playable address is readable from the DOM or a page global | Same run: the template reads `og:video` / `<video src>`. A hit confirms readability for that page, not for every page. |

If the first two both fail, adapters only work on pages that never gate content, and the value
estimate in ADR 0001 §8 has to be revised downward — the honest failure the panel already shows
(`adapter.lastRunFailed`) is the signal, not a bug to patch around.

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
npm run build          # panel bundle + embedded service runtime (dist/)
npm run package:service  # prints the service archive digest and its per-platform match state
```

After changing anything under `service/`, bump the plugin version and rebuild: `npm run build`
recompiles the service, packs it, and rewrites the `plugin.json` digests from the bytes it just
produced, so a stale declaration cannot ship. The archive pins entry order, timestamps and
compression level so CI reproduces the same bytes.

`dist/` and `release/` are not committed; the marketplace CI builds and publishes them.

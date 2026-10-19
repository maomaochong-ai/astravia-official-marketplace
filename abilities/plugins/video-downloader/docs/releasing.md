# Releasing a new version

The publish pipeline builds and publishes one thing: the plugin package
(`video-downloader-<version>.astraviapkg`) on the append-only `plugin-video-downloader`
release. It does **not** publish the service bundle.

`plugin.json` declares the service artifact with `sha256` / `archive` / `destination`
only — no `url` — because the panel downloads the bytes itself and hands them to
`ctx.services.install`. That URL lives in `runtime-lock.json`, and nothing in CI
creates it. Skip it and the plugin installs fine, then fails to start with a 404.

So each version needs two releases, and the service one has to exist first — a version whose
lock points at a missing asset installs fine and then fails to start with a 404:

1. Bump the version, run `npm run package:service`, and record the digest. Point the matching
   `runtime-lock.json` entry and the six `plugin.json` artifacts at it.
2. Create the release tagged `video-downloader-<version>` and attach
   `release/video-downloader-service-<version>.zip`.
3. Push `main`. CI validates, uploads, and advances the gh-pages index for
   `plugin-video-downloader`.

Then confirm the runtime lock is actually downloadable and byte-identical:

```bash
curl -sIL "https://github.com/maomaochong-ai/astravia-official-marketplace/releases/download/video-downloader-<version>/video-downloader-service-<version>.zip" | head -1
shasum -a 256 release/video-downloader-service-<version>.zip   # must match runtime-lock.json
```

Newly created assets can answer 404 for a few seconds before the CDN catches up; retry
before treating it as a mistake.

The download engine and ffmpeg are not part of the release at all: the service fetches them
from their upstream GitHub releases at run time. `upstream.json` records the pinned versions,
and `service/src/ytdlp/ytdlp-release.ts` / `service/src/tools/ffmpeg-release.ts` carry the
per-platform digests that are verified before a binary is executed. Do not resolve "latest" —
bump a pin deliberately and only after measuring the new assets.

Package bytes are immutable per version: the publish step refuses to overwrite an
existing `.astraviapkg` whose digest changed. Any source change that lands inside the
archive (including `README.md`) therefore requires a version bump.

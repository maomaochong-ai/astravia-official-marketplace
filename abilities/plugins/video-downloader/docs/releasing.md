# Releasing a new version

The publish pipeline builds and publishes one thing: the plugin package
(`video-downloader-<version>.astraviapkg`) on the append-only `plugin-video-downloader`
release. It does **not** publish the service bundle.

`plugin.json` declares the service artifact with `sha256` / `archive` / `destination`
only — no `url` — because the panel downloads the bytes itself and hands them to
`ctx.services.install`. That URL lives in `runtime-lock.json`, and nothing in CI
creates it. Skip it and the plugin installs fine, then fails to start with a 404.

So each version needs two releases:

1. Push `main`. CI validates, uploads, and advances the gh-pages index for
   `plugin-video-downloader`.
2. Run `npm run package:service`, then attach `release/video-downloader-service-<version>.zip`
   to a release tagged `video-downloader-<version>`, and point the matching
   `runtime-lock.json` entry at it.

Then confirm the runtime lock is actually downloadable and byte-identical:

```bash
curl -sIL "https://github.com/maomaochong-ai/astravia-official-marketplace/releases/download/video-downloader-<version>/video-downloader-service-<version>.zip" | head -1
shasum -a 256 release/video-downloader-service-<version>.zip   # must match runtime-lock.json
```

Newly created assets can answer 404 for a few seconds before the CDN catches up; retry
before treating it as a mistake.

The lux binary is a separate upstream release (`iawia002/lux`), pinned in the same lock
file by version and sha256. Do not resolve "latest" — bump the pin deliberately, and only
after checking the checksums file for the six platforms.

Package bytes are immutable per version: the publish step refuses to overwrite an
existing `.astraviapkg` whose digest changed. Any source change that lands inside the
archive (including `README.md`) therefore requires a version bump.

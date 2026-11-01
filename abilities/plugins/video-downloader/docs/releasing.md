# Releasing a new version

The publish pipeline builds and publishes exactly one thing: the plugin package
(`video-downloader-<version>.astraviapkg`) on the append-only `plugin-video-downloader`
release. There is no second artefact and no extra release.

The service runtime travels inside that package. `npm run build` compiles `service/`, packs it
into the same deterministic zip defined below, and inlines the archive as base64 into a lazily
loaded chunk; `src/runtime.ts` feeds those bytes straight to `ctx.services.install`. So a fresh
install never touches the network for the runtime, and a version cannot go out with a runtime
that was never uploaded.

```bash
npm install
npm run check          # tsc for the panel and the service
npm test               # panel + service suites
npm run build          # dist/ + release/video-downloader-<version>.astraviapkg
```

`npm run build` also rewrites the six `plugin.json` `sha256` declarations from the payload it
just produced, so the declared digest is never a hand-maintained number. If you want to see the
digest on its own:

```bash
npm run package:service            # prints size, digest, and the per-platform match state
node scripts/package-service.mjs --update   # only the digest rewrite, no bundling
```

The zip pins entry order, timestamps and compression level (`scripts/package-service.mjs`), so
the same tree produces the same bytes on any machine and the digest stays stable across rebuilds.
`service/dist` is never written into the plugin tree: the compiler output goes to a temporary
directory that is zipped and discarded.

Then push `main`. CI validates, uploads the package, and advances the gh-pages index for
`plugin-video-downloader`.

The download engine and ffmpeg are not part of the release at all: the service fetches them
from their upstream GitHub releases at run time. `upstream.json` records the pinned versions,
and `service/src/ytdlp/ytdlp-release.ts` / `service/src/tools/ffmpeg-release.ts` carry the
per-platform digests that are verified before a binary is executed. Do not resolve "latest" —
bump a pin deliberately and only after measuring the new assets.

Package bytes are immutable per version: the publish step refuses to overwrite an
existing `.astraviapkg` whose digest changed. Any source change that lands inside the
archive (including `README.md`) therefore requires a version bump.

Older releases of this plugin shipped the runtime as a separate `video-downloader-service-<v>.zip`
attachment referenced by a `runtime-lock.json`. Those files are gone: versions up to 2.3.0 still
resolve through that path if anyone reinstalls them, but nothing builds or publishes it any more.

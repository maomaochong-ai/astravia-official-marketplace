# Working in this plugin

This directory is one plugin project. `plugin.json` is the contract: the panel renderer, the
managed service and the Agent MCP endpoint are all declared there, and the marketplace CLI
acts on the nearest `plugin.json`.

Detail blocks live in `assets/` and `ability.json` points at `assets/detail.json`. The published
package carries `dist/`, `locales/`, `assets/`, `service/` and a few root files, but not a root
`detail.json`, so a root path would show up in the store and be missing once installed.

## Map

```text
src/index.tsx                      assembly only: slots + activation
src/runtime.ts                     install/start the managed runtime, verify digests
src/runtime-contract.ts            the SDK surface this plugin relies on
src/plugin-ids.ts                  service / slot ids in one place
src/style.css                      Tailwind entry; the only place theme tokens are mapped
src/domain/                        pure logic: media shape, byte/ETA formatting, task state, site labels
src/services/downloader-api.ts     typed wrapper over the service HTTP API
src/features/downloader/           the workspace view: URL entry, preview, queue
src/features/settings/             the inline settings panel
src/features/connection/           the ability-detail status slot
src/shared/components/             presentational primitives used by more than one feature
service/src/                       the managed service (http, lux, media, tasks, mcp)
assets/                            icons plus the detail blocks that ship inside the package
docs/panel-design.md               why the panel looks the way it does, and the research behind it
src/test/                          panel-side pure logic suites
```

Rules that this project follows:

- `index.tsx` assembles, it does not implement. No `ui.tsx` / `utils.ts` catch-alls.
- Components that React renders live under a `components/` directory; one exported component
  per file, named after the file.
- Panel styling uses host tokens (`bg-card`, `text-muted-foreground`, `border-border`, …).
  Never hardcode a colour; the plugin CSS is scoped to `[data-astravia-plugin-root]`.
- `registerWorkspaceView` wants an Iconify **class string**, and the class has to be generated
  by this plugin's own CSS (`@plugin "@iconify/tailwind4"` plus `@iconify-json/solar`). A
  missing icon set fails silently with an empty nav glyph.
- Errors reach the user through `ctx.ui.notify({ message, error })`; the panel additionally
  keeps an inline message where the action happened.

## Service rules

- No runtime dependencies. `tsc` output is the shipped artifact, so the zip stays small.
- Every path the service writes must be relative to `ASTRAVIA_SERVICE_DATA_DIR`; the working
  directory of a download is per-task and removed when the task settles.
- `needsFfmpeg` means "this rendition cannot be produced without ffmpeg" — today that is
  `partCount > 1`, because lux merges multi-part streams through ffmpeg in both branches.
- Agent tool descriptions stay English and factual; user-facing copy stays in `locales/`.

## Verify

```bash
npm run check
npm test
npm run build
npm run package:service   # prints the digest to paste into plugin.json + runtime-lock.json
```

Version bumps: content changes to the service or panel require a plugin version bump and a
rebuilt service digest. Display-only changes (README, detail blocks) do not.

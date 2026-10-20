# Hanshuang Pojia

Static triage for Android packages, iOS apps, native binaries and archives — entirely inside Astravia, with no external toolchain and no execution of the sample.

The plugin answers one question: *what is this file, and what should a reviewer look at first?*

## What it analyses

| Input | Detection | Facts collected |
| --- | --- | --- |
| `.apk` | `AndroidManifest.xml` + `classes*.dex` | manifest model, permissions, components, signature schemes, dex strings |
| `.aab` | `BundleConfig.pb` or `base/manifest/…` | manifest model, dex list, native libraries per ABI |
| `.ipa` | `Payload/*.app/` | Mach-O header of the main binary, slices, entitlements-relevant flags |
| `.jar` | `META-INF/MANIFEST.MF` | archive layout, embedded executables |
| `.zip` | end-of-central-directory | entry count, compression ratio, unsafe or duplicate names |
| ELF / PE / Mach-O | magic bytes | arch, entry point, sections, hardening flags, imports |
| `.dex` | `dex\n` | string/type/method counts, string table sample |
| anything else | — | entropy profile and string sample |

Report shape (`schemaVersion: 1`): `target`, `risk` (score + A–E grade + drivers), `summary`, `findings`, `facts`, `sections`, `limits`.

## Rule catalog

37 rules across five categories — `manifest`, `code`, `native`, `package`, `format`. Each rule has a stable id, a severity, a weight and English advice:

- `src/domain/audit/rules.ts` — registry and weights (`critical` 45, `high` 22, `medium` 10, `low` 4, `info` 0, capped at 100)
- `locales/en.json`, `locales/zh.json` — `rule.<id>.title` for the panel; a test asserts the registry and both catalogs stay in sync

The domain layer only ever emits `ruleId` + evidence. Titles used by the agent path come from the registry; the UI resolves `rule.<id>.title` through the plugin catalog.

## Agent tools

Registered from `src/tools/register-tools.ts`, one file per tool:

| Tool | Purpose |
| --- | --- |
| `triage_binary` | full triage, returns bounded markdown (summary ≈ 4.5k chars, full ≈ 24k) |
| `scan_binary_strings` | filtered printable-string extraction with file offsets |
| `explain_triage_finding` | rule reference: severity, category, why it matters |
| `export_triage_report` | full triage handed to the save dialog as markdown or JSON |

All four declare `scope_use` explicitly (fail-closed) and only touch the workspace through the host `fs` API. Samples are read with `fs.readBinaryFile`, capped at the host's own 32 MiB binary-read ceiling. Bigger or out-of-project samples are handed to the chat agent, which runs with the app's file access.

## Permissions

| Permission | Why |
| --- | --- |
| `ui.slot.activity-tab` | the workbench panel |
| `agent.tools.register`, `agent.toolHandler.execute` | the four tools |
| `agent.session.write` | tool results in the conversation |
| `fs.read` | listing the workspace and reading samples |
| `fs.write` | `fs.saveAs` for exported reports (the user picks the path) |

## Layout

```text
src/
├── index.tsx                        # assembly only: bridge, tab, tools, cleanup
├── runtime-contract.ts              # the PluginContext handle the tab reads
├── domain/                          # no React, no host APIs
│   ├── bytes.ts digest.ts entropy.ts strings.ts base64.ts
│   ├── sample-path.ts               # path resolution + project-boundary check
│   ├── sample-scope.ts              # engine-readability: project scope + 32 MiB ceiling
│   ├── archive/   zip.ts axml.ts archive-facts.ts
│   ├── android/   manifest-model.ts dex.ts audit.ts
│   ├── native/    types.ts elf.ts pe.ts macho.ts audit.ts
│   ├── audit/     rules.ts findings.ts secrets.ts
│   ├── report/    report.ts
│   └── triage.ts                    # entry point: detect → parse → audit → report
├── tools/                           # one Agent tool per file
├── features/triage-workbench/       # components/ + hooks/
├── shared/components/               # severity chip
└── test/                            # fixtures and tests
```

`src/domain/` has no dependency on `@astravia-org/plugin-sdk` — it can be exercised in plain Node.

## Development

```bash
cd abilities/plugins/frostbreak
npm install
npm run check     # tsc --noEmit
npm run test      # vitest (domain fixtures + panel wiring)
npm run build     # vite build → dist/
```

In this repository the SDK resolves through the dev tooling (`../../../.tooling/open-astravia/packages/plugins/plugin-sdk`), which is why `package-lock.json` records `link: true` entries. A full marketplace build regenerates it:

```bash
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build
node --test tests/*.test.mjs
```

## Limits worth knowing

- Android signature digests are read from the v1 files and the APK Signing Block, **not** cryptographically verified.
- Packed/encrypted code is reported, never unpacked; `native.packed` is a heuristic (entropy + import count, or a `UPX!` marker).
- DEX string scan is capped at 6 dex files and 24 MiB; string extraction stops at 400 results per call in triage and 500 in the standalone tool.
- Mach-O fat binaries analyse the first slice; IPA lookup tries at most three `Payload/*.app/*` candidates for the main binary.
- Nothing is executed, patched, resigned or repacked. The plugin is read-only by design.

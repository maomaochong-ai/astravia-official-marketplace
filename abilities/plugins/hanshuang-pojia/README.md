# Hanshuang Pojia

Static triage for Android packages, iOS apps, native binaries and archives — entirely inside Astravia, with no external toolchain and no execution of the sample.

The plugin answers one question: *what is this file, and what should a reviewer look at first?*

Since 2.0 the bundled agent document also carries the **workbench kit protocol** (`PART V`) — lab mode,
the deployment and verification board, knowledge-base-first recon, and the `seep` / `ida` MCP tool
matrix. That layer is documentation the agent follows when the desktop kit is installed; the panel
below still runs with no external toolchain and never executes a sample.

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
| `list_code_symbols` | ELF `.symtab`/`.dynsym`, PE exports and Mach-O `LC_SYMTAB`, merged with imports |
| `disassemble_range` | linear-sweep listing of a byte range for AArch64 and x86/x86-64 |
| `search_dex_symbols` | classes, method signatures and string-pool entries from a `.dex` or an APK |
| `diff_binaries` | byte-level hunks between two samples |
| `search_docs` | keyword search over the 309 bundled field documents (title, id, topic) |
| `read_doc` | one document body as Markdown, truncated at a visible character budget |

All ten declare `scope_use` explicitly (fail-closed) and only touch the workspace through the host `fs`
API. Samples are read with `fs.readBinaryFile`, capped at the host's own 32 MiB binary-read ceiling.
Bigger or out-of-project samples are handed to the chat agent, which runs with the app's file access.

## Permissions

| Permission | Why |
| --- | --- |
| `ui.slot.activity-tab` | the workbench panel |
| `agent.tools.register`, `agent.toolHandler.execute` | the ten tools |
| `agent.session.write` | tool results in the conversation, the panel's send-to-chat button |
| `agent.session.read` | the panel's live conversation status (turn running, tool in flight) |
| `storage.read`, `storage.write` | the sample shelf and settings survive a restart; without them the panel falls back to in-session memory |
| `fs.read` | listing the workspace and reading samples |
| `fs.write` | `fs.saveAs` for exported reports (the user picks the path) |
| `agent.systemPrompt.write` | injecting the package-root `AGENTS.md` into every session's system prompt |

## The agent document

The `AGENTS.md` in the package root is what the agent reads before anyone asks it anything. `plugin.json`
`agent.systemPrompt.promptPaths`, so the host appends it as a system-prompt block for every
session in every project — the same reach a user-level `~/.claude/CLAUDE.md` has, scoped to this
plugin. It is short on purpose: it is paid for on every turn.

## Prompt budget

The always-on block holds only the rules that must fire on every turn: identity and authorization,
the artifact-first opening, evidence labels, copy-first plus the four artifacts, the routing table,
the receipt formats, the activation words, and the condensed anti-refusal list. Everything long-form —
the per-track delivery templates, the few-shot regression set, the JIT stages, PART V and the MCP tool
matrix — lives in the skill (`agent/skills/hanshuang-pojia/SKILL.md`), which the host loads on demand.

This split is not cosmetic. A 96 KB block is roughly 30k tokens of context before the user types
anything, so an ordinary task hits `context compaction` within a turn or two, and the compaction card
replays a 20k-72k character markdown summary through the streaming renderer. That path is where the
host app used to throw `React error #185` (Maximum update depth exceeded) and fall back to its retry
screen. `tests/prompt-budget.test.mjs` in the marketplace repository fails on any plugin whose injected
block grows past 12 KB, so the split cannot silently regress.

The literal user-level copy lives at `<agentDir>/AGENTS.md`. A plugin cannot write there: every
`fs` call it makes is checked against the open project roots, and the host exposes no install hook
that runs code when a package lands. An agent shell is not constrained that way, so the packaged
`AGENTS.md` ends with the one command that asks the agent to write the user-level copy once per machine:

```bash
node scripts/sync-agent-doc.mjs                      # write <agentDir>/AGENTS.md
node scripts/sync-agent-doc.mjs --print              # where the two copies live
node scripts/sync-agent-doc.mjs --check              # exit 1 when either copy is stale
node scripts/sync-agent-doc.mjs --from README.md     # replace the packaged AGENTS.md from another file
node scripts/sync-agent-doc.mjs --remove             # drop the managed block again
```

The script ships inside the package (`scripts/`), so the installed copy is the one that runs. It
edits, never overwrites: the text sits between `<!-- hanshuang-pojia:begin -->` and
`<!-- hanshuang-pojia:end -->`, so an `AGENTS.md` the user already wrote keeps everything around it, and
a second run prints `unchanged`. It resolves `<agentDir>` the way the host does —
`ASTRAVIA_CODING_AGENT_DIR`, then `ASTRAVIA_HOME` / `ASTRAVIA_CONFIG_DIR`, then `~/.astravia/agent`.

Why both: the manifest path works with no file on disk and no agent cooperation, so the plugin is
known even if the copy is never written. The user-level file is the readable, editable copy — for
people who want to see what the plugin tells the agent, and one that keeps working if the
permission is ever revoked.

## Workbench kit 2.0

The agent document gained a fifth part in 2.0, bound to the 寒霜破甲工具 desktop kit (`seep-kit` 1.6.0).
It tells the agent how to work with the kit when it is installed:

| Part | Content |
| --- | --- |
| V.1 | lab mode — `lab：` / `退出实验`, the disk flag, and the probe to run after a compaction |
| V.2 | deployment and verification — `setup/install.ps1`, `update.ps1`, `uninstall.ps1`, `verify.ps1 -Detailed` and its four-column board |
| V.3 | G-Auth — one confirmation per new target, and the separate yes that writes still need |
| V.4 | knowledge-base-first recon, and the signal → technique → MCP routing table |
| V.5 | the `seep` (23 tools) / `ida` (~243) / `js-reverse` (12) / `playwright` (18) matrix, with the Radare2 degradation table |
| V.6–V.7 | skill routing through `softseep`, and the A1–A10 anti-refusal rules |
| V.8–V.9 | resource map and the nine host installers |

Since 2.1 the kit's **skill library ships inside the plugin**: `agent/docs/skill-library/` is a
byte-for-byte copy of `seep-kit/Tool/skill/` — 165 files, 2.4 MB, `softseep` (orchestrator),
`apkseep` (112 files, 55 runnable scripts), `ida-reverse`, `client-license-validation-bypass`, and
the five `safe-skills/*` packs. Nothing was edited or trimmed. `agent/docs/SKILL-LIBRARY.md` holds the
inventory and provenance, `agent/docs/skill-library.sha256` the per-file hashes, and
`src/test/skill-library.test.ts` recomputes the manifest so the tree cannot drift between builds.
They are routed by path (`PART V.6`) rather than registered as skill paths: upstream frontmatter uses
YAML block scalars and over-cap descriptions, and `ida-reverse` exists twice.

`agent/skills/hanshuang-pojia/references/workbench-2.0.md` holds the detail the prompt body should
not carry: the verified kit layout, the full MCP tool list, the ten manuals, the per-host installer table, the
deployment-check baseline, and the relay / memory mechanics. The prompt stays lean because it is paid
for on every turn.

## Layout

```text
AGENTS.md                            # injected into every session through promptPaths
agent/
└── skills/hanshuang-pojia/          # the skill the host lists in every conversation
    ├── SKILL.md                     # PART V of the agent document + the kit protocol
    └── references/workbench-2.0.md  # kit layout, MCP tool list, manual index, host installers
agent/docs/
├── SKILL-LIBRARY.md                 # bundled skill tree: inventory, provenance, why not registered
├── skill-library.sha256             # 165 per-file hashes; the test recomputes this
└── skill-library/                   # byte-exact copy of seep-kit/Tool/skill (165 files, 2.4 MB)
scripts/
└── sync-agent-doc.mjs               # writes the user-level copy from this package
src/
├── index.tsx                        # assembly only: bridge, tab, tools, cleanup
├── runtime-contract.ts              # the PluginContext handle the tab reads
├── domain/                          # no React, no host APIs
│   ├── bytes.ts digest.ts entropy.ts strings.ts base64.ts
│   ├── sample-path.ts               # path resolution + project-boundary check
│   ├── sample-scope.ts              # engine-readability: project scope + 32 MiB ceiling
│   ├── archive/   zip.ts axml.ts archive-facts.ts
│   ├── diff.ts                     # byte-level diff hunks with a reporting budget
│   ├── android/   manifest-model.ts dex.ts dex-index.ts audit.ts
│   ├── native/    types.ts elf.ts pe.ts macho.ts audit.ts
│   │               symbols.ts disasm.ts detect.ts
│   ├── audit/     rules.ts findings.ts secrets.ts
│   ├── report/    report.ts
│   └── triage.ts                    # entry point: detect → parse → audit → report
├── tools/                           # one Agent tool per file
├── runtime/panel-channel.ts         # agent → panel report channel
├── features/workbench/              # the panel
│   ├── bridge.ts state.ts prompts.ts
│   ├── report-compare.ts sections.ts severity.ts sample-error.ts
│   ├── hooks/                       # use-workbench, use-library, use-chat
│   └── components/
│       ├── workbench-screen.tsx     # navigation + shell
│       ├── shell/                   # sidebar, top bar, tables, chips, icons
│       ├── workbench/               # dropzone, risk ring, findings, blocked panel
│       └── pages/                   # the twelve screens
└── test/                            # fixtures and tests
```

`src/domain/` has no dependency on `@astravia-org/plugin-sdk` — it can be exercised in plain Node.

## The workbench panel

The activity-bar tab is a fourteen-page workbench rather than a single report view: `Workbench`,
`Guide`, `Documents`, `Samples`, `Findings`, `Strings`, `Disassembly`, `Manifest`, `Entropy`,
`Signature`, `Compare`, `Self check`, `Reports` and `Settings`. Analysis results only appear once a
sample has been read, and every page reads from the same report — except the two that do not need one.

`Disassembly` is the one page that does not read the report: it walks the executable sections of
the sample's own bytes, ranks candidate functions (entry, then symbol, then call target) and renders
one at a time as a control-flow listing in three densities — summary, branches only, or full — cut
at a character budget. Deeper analysis is still the `disassemble_range` tool's job; the page
is there so the listing is reachable without spending a turn on it.

`Documents` renders the kit's own field library inside the panel: 292 knowledge-base articles, the 10
manuals and 7 tool docs the plugin ships byte for byte, searched by title in memory and — on demand —
by body text across all 309 files. Each body is a separate build chunk, so opening the page costs one
document, not four megabytes. The same library is reachable from the conversation as `search_docs` and
`read_doc`, which means a citation from the agent and the text on screen are the same file.

Two lanes, deliberately:

- **In the panel** — the bundled engine, for files inside the open project below 32 MiB. Digest,
  format, manifest, permissions, components, sections, entropy, strings, signature structure and a
  report-to-report diff all run locally.
- **In the conversation** — purple buttons send an English prompt through `ctx.conversation`; the
  agent calls the same tools for anything the panel cannot reach (out-of-project paths, files above
  the host read cap, jadx/apktool/radare2, full-string scans). A prompt that cannot be sent because
  no conversation is attached is reported as such, never silently dropped.

`triage_binary` publishes its report back into the panel through `src/runtime/panel-channel.ts`,
so a sample analysed in chat lands in the panel's library with a `from chat` marker.

## Development

```bash
cd abilities/plugins/hanshuang-pojia
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
- `disassemble_range` is a linear sweep with file offsets, not a control-flow analysis: unknown bytes
  print as `db 0xNN` and the sweep advances one byte, so a listing after an unknown opcode may be
  misaligned. Branch targets say `file+0x…` and prove nothing about reachability. No pseudo-C, no
  assembler, no Java/smali decompilation.
- Symbol tables are whatever the file carries: a stripped binary yields imports only, and the tool
  says so rather than inventing names.
- Nothing is executed, patched, resigned or repacked, and no Frida hook, keygen input or license-bypass
  patch is generated. The plugin is read-only by design.

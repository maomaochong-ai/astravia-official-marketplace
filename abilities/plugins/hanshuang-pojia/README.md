# Hanshuang Pojia

Static triage for Android packages, iOS apps, native binaries and archives — entirely inside Astravia. The sample is never executed, and the package bundles no engine: radare2, jadx and apktool are borrowed from the machine, and only when they are already there.

The plugin answers one question: *what is this file, and what should a reviewer look at first?*

Since 2.0 the plugin also carries the **workbench kit protocol** — lab mode, the deployment and
verification board, knowledge-base-first recon, and the `seep` / `ida` MCP tool matrix. It lives in
the skill (`agent/skills/hanshuang-pojia/SKILL.md`), which the host loads on demand — the package no
longer injects a standing block into every session. That layer is documentation the agent follows when
the desktop kit is installed.

Two layers run without the kit: the panel's own TypeScript engine, which needs nothing but the file,
and four tools that call the user's `r2` / `rabin2` / `radiff2` / `rasm2` / `jadx` / `apktool` / `java`
through the host command channel. Neither executes the sample, and a missing or refused binary is
reported as such instead of being faked.

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
| `decompile_function` | register-level pseudo-C for one function, plus the strings it references |
| `diff_functions` | which functions changed shape vs only changed constants, between two builds |
| `generate_hook` | a Frida script for matched Dalvik methods — `observe` prints only (default), `override` runs the original then returns `return_value`, `replace` skips the original |
| `frida_dump` | runtime dex extraction for packed apps: emit the scanner script, run it on a device, or reassemble a log into `.dex` files |
| `triage_directory` | one risk table for every binary under a directory, worst grade first |
| `search_docs` | keyword search over the 340 bundled field documents (title, id, topic) |
| `read_doc` | one document body as Markdown, truncated at a visible character budget |
| `probe_environment` | which declared executables run, with version banners, separating a host refusal from a missing binary |
| `install_toolchain` | the exact install command for this platform, filtered to the tools one goal actually needs |
| `kb_checklist` | one of the kit's six tactical checklists by name, e.g. `web_first_30_min` or `pe_ioc` |
| `kb_payloads` | the kit's payload seeds for one vulnerability class, or the list of classes that exist |
| `ida_status` | whether an IDA Pro bridge answers on `127.0.0.1:13337`, separating "no grant" from "no listener" |
| `verify_signature` | signature schemes and signer certificates: structural facts from the APK itself, plus `apksigner verify --print-certs` when it is on the host |
| `run_radare` | r2 / rabin2 / radiff2 / rasm2: info, strings, functions, disasm, pseudo-C, xrefs, asm, diff, read-only `cmd` |
| `decompile_android` | jadx / apktool into a sibling directory, then `smali_search` over the unpacked tree |
| `disassemble_dex_method` | one Dalvik method's `code_item`, decoded to `offset: op operands` |
| `init_task` | the per-target case layout — `samples/`, `exports/`, `reports/`, README and report skeleton |
| `search_cases` | the 19 shipped precedent packages and your own cases, ranked separately: a method you can copy, never an authorisation you inherit |
| `record_case_note` | append a decision, blocker or artefact note to the open case |
| `scaffold_case` | writes a precedent's `tools/` and the shared `hpkit` into the project and returns the exact commands — files only, nothing executed |
| `write_assessment_report` | fills the four-section assessment into `reports/<target>_security_assessment_report.md`; an unsupplied section is written as unsupplied |
| `generate_artifact` | a patch / keygen / proxy-DLL / verification-harness skeleton scoped to the decision point you located |
| `install_astravia` | the instruction block for a global `AGENTS.md`, handed to the save dialog |

All thirty-one declare `scope_use` explicitly (fail-closed) and only touch the workspace through the host `fs`
API. Samples are read with `fs.readBinaryFile`, capped at the host's own 32 MiB binary-read ceiling.
Bigger or out-of-project samples are handed to the chat agent, which runs with the app's file access.

The four analysis tools are precise about what they return: no type recovery, no SSA, no variable
merging in the pseudo-C; the diff is an instruction-shape fingerprint, not a proof of equivalence;
and the hook template defaults to an observation script that returns the original value. That default is
not a ceiling: `mode: "override"` or `"replace"` plus a `return_value` is the rewrite tier, and it runs
through the same `frida-run` path the skills already ship. `frida_dump` splits the same way — `run`
needs a device with frida-server, `script` and `assemble` need no hardware at all.

Six tools spawn an external binary, and they follow the same rule. `plugin.json#commands` declares exactly the fourteen
executables they may spawn, the host asks the user before granting `agent.command.run`, and every call
is `execFile` with an argument vector — no shell. `run_radare`'s `cmd` operation refuses writes, shells,
the debugger, file opens, script execution, project commands, mounts and the `=` remote family (`w`/`W`,
`!`, `o`/`O`, `d`/`D`, `P`, `R`/`r`, `m`/`M`, `.`, `=`) and lets the read-only `dr` family through; anything that
would leave r2's own parser is refused too — pipes (`|`), redirects (`>`/`<`), `$(…)`, backticks and `=!`.
That guard protects the argument vector, not your options: when you do want a byte edit, run `r2 -w`
through `command.run`, where the command is explicit and logged.
`decompile_android` writes next to the APK, never into it, and only into a directory that does not exist
yet: an existing `output_dir` is refused rather than merged into, and `apktool` runs without `-f` so a
re-run can never wipe a folder you own. Rebuilt artefacts land in `exports/` beside the case notes:
a patch is the output of your edit, so there is no `patches/` folder holding it in advance.
`probe_environment` runs one short `--version` call per tool, caches the answer for a minute and names the
remedy for each failure mode: a host refusal is a setting, an absent binary is an install. `install_toolchain`
turns that into the command you actually type: it filters by goal (`apk` / `native` / `firmware` / `dynamic` /
`full`), picks the recipe for this platform (brew / apt / winget / scoop / pipx) and stops there — the plugin
runs no installer, so you see every command first. Commercial suites (IDA, Binary Ninja, JEB) are listed as
context, never as a command; commercial and optional tools never take a permission because the plugin never
spawns them. Full 2.0 parity table: [docs/reference/toolchain-parity.md](docs/reference/toolchain-parity.md).

The same engines run from a terminal, outside the plugin sandbox:

```bash
node scripts/analyze.mjs triage sample.apk --json
node scripts/analyze.mjs decompile libfoo.so --symbol check_license
node scripts/analyze.mjs diff v1.elf v2.elf
node scripts/analyze.mjs hook app.apk --query license --package com.example.app
node scripts/analyze.mjs docs frida --group kb
node scripts/analyze.mjs asm x86-64 "mov rax, rbx" "ret" --address 0x1000
```

`scripts/analyze.mjs` bundles `src/cli/analyze.ts` with esbuild and imports only `src/domain`, so it
reads any path the process can read — no plugin fs grant involved. Commands: `triage`, `strings`,
`symbols`, `disasm`, `asm`, `decompile`, `diff`, `hook`, `docs`. Exit codes: `0` ok, `1` usage error,
`2` analysis failure.

`asm` is the only direction that writes bytes: nine mnemonics (`nop`, `ret`, `mov`, `add`, `sub`, `xor`,
`cmp`, `jmp`, `call`) for x86, x86-64 and AArch64, with the plugin's own decoder as the judge. Every
encoded line is read back at the address it was placed at, and the canonical text shown is what that
read-back produced — a line that cannot be reproduced exactly is reported with a hint instead of being
returned as "probably right". Operands the decoder renders ambiguously (8/16-bit x86, scaled-index
addressing, labels, directives, immediates that would need two instructions) are refused by design.

## Permissions

| Permission | Why |
| --- | --- |
| `ui.slot.activity-tab` | the workbench panel |
| `agent.tools.register`, `agent.toolHandler.execute` | the thirty-one tools |
| `agent.command.run` | `probe_environment`, `install_toolchain`, `run_radare`, `decompile_android`, `verify_signature`, `frida_dump`: the fourteen executables declared in `commands`, each one approved by the user |
| `agent.session.write` | tool results in the conversation, the panel's send-to-chat button |
| `agent.session.read` | the panel's live conversation status (turn running, tool in flight) |
| `storage.read`, `storage.write` | the sample shelf and settings survive a restart; without them the panel falls back to in-session memory |
| `fs.read` | listing the workspace and reading samples |
| `fs.write` | `fs.saveAs` for exported reports (the user picks the path) |
| `agent.systemPrompt.write` | the dynamic per-turn kernel block: lab state, the page the user is looking at, the tool list |
| `network.fetch` | `ida_status` only, and only against `127.0.0.1` as declared in `network.allowedHosts`: one GET to port 13337 to see whether an IDA bridge is listening |

## Where the rules live

The package ships **no always-on system-prompt block.** The rules that must hold on every turn live in
the skill (`agent/skills/hanshuang-pojia/SKILL.md`), and the host pays for a skill only through its
index entry — `name` plus `description`, about 380 characters. The 97 KB body enters the context only
when the agent invokes the skill for the task at hand.

The one thing the plugin injects per turn is the kernel block built at runtime by
`src/domain/kernel.ts` (`agent.systemPrompt.write`): whether lab mode is on, which panel page the user
is looking at, which tools are reachable. That is state, not prose, so it cannot be a static file.

Until 2.3.2 the package root also carried an `AGENTS.md` that `agent.systemPrompt.promptPaths` appended
to every session, plus `scripts/sync-agent-doc.mjs`, which copied the same text into
`<agentDir>/AGENTS.md` as a user-level instruction file. Both are gone: they put roughly 3.5k tokens of
identical text in front of every turn, and after the first sync the same contract arrived twice through
two unrelated injection paths. If an earlier version wrote that user-level copy on this machine,
`<agentDir>/AGENTS.md` holds a block between `<!-- hanshuang-pojia:begin -->` and
`<!-- hanshuang-pojia:end -->` — delete the block, the file if it held nothing else, or reinstall and
the plugin stops contributing it.

`tests/prompt-budget.test.mjs` in the marketplace repository still fails any plugin that declares
`promptPaths` with a block above 12 KB, so the always-on channel cannot silently come back.

## The prompt layer

Since 2.6.0 the plugin contributes two prompt blocks instead of one, both gated on
`agent.systemPrompt.write`:

| Block | Priority | When | Content |
| --- | --- | --- | --- |
| `plugin.hanshuang-pojia.kernel` | 850 | every turn | lab state, the panel page the user is on, the reachable tool ids — about 200 characters with lab off |
| `plugin.hanshuang-pojia.system` | 840 | lab mode on only | `agent/prompts/SYSTEM.md`: authorization gate, delivery shape, blocked-step handling, toolchain bootstrap, todo discipline |

`agent/prompts/SYSTEM.md` is the editable source. `scripts/sync-system-prompt.mjs` mirrors it into
`src/domain/system-prompt.generated.ts`, because a plugin cannot read its own install directory at
runtime — the host never tells it where it lives. `npm run verify:generated` fails on drift, and
`src/test/system-prompt.test.ts` compares the two byte for byte.

`agent/prompts/AGENTS.md` carries the same protocol for agents outside Astravia: tool routing, the scope
record (facts, not a gate), the delivery shape, and the mechanisms that have no counterpart here.

Two things upstream does that this package cannot. It rewrites the provider request payload
(`safetySettings: BLOCK_NONE`, refusal scrubbing) — the host exposes twelve lifecycle hooks and none of
them sees the request payload, and the field is Google-private (an OpenAI-compatible gateway answers
`400 UNKNOWN_FIELD`). It also rewrites the user's prompt; `UserPromptSubmit` can only append
`additionalContexts`.

The first one costs less than it looks: upstream only injects for Google endpoints and `contents`
payloads, and returns `SKIP` for anything shaped like an OpenAI body — which is exactly what this
pipeline sends. So `src/domain/interceptor.ts` ports the decision function itself (same `INJECT` /
`SKIP` / `SKIP-INEFFECTIVE` verdicts, logged once per endpoint) instead of pretending the injection is
missing, and enforcement moves to the turn boundary.

**Refusing is not an accepted ending.** A `Stop` hook reads `lastAssistantMessage`: a policy or
referral phrasing fires unconditionally; a **provenance** phrasing — demoting the plugin's own
`SKILL.md` to "untrusted tool material, recorded but not executed" — is its own class, second only to
policy; and an identity framing (`As an AI…`) fires when the turn
delivered nothing. There is no length floor and no deliverable exemption for policy stops — a refusal
with a code fence stapled to it is still a refusal. `src/domain/refusal.ts` holds the detector, and the
continuation fragment forbids refusing, forbids explaining limits, and forbids pointing the operator at
the vendor. The one legal stop is quoting the exact error text once and then switching to a path that
still produces the artefact. The plugin continues at most three times per turn and gives up early when
the same refusal comes back verbatim; the host's `DEFAULT_MAX_STOP_CONTINUATIONS = 8` is the outer bound.

**Kit documents are instructions, not material.** The host's own rule treats tool output as untrusted
data; that rule is right about the target's bytes and wrong about this kit's own documents. A `SKILL.md`
arriving through a file read, a doc-search envelope, or a compacted transcript is *not* demoted by it.
`agent/prompts/SYSTEM.md` §4.1, `agent/prompts/AGENTS.md` §二, and the skill's §0.9 each draw the line at the
kit boundary, and `read_doc` stamps the same provenance line on every result. What counts as material is
the target's own bytes — sample strings, its source, logs, pages, captures — and an injection string
found there is a finding to report, not an order to obey.

## Workbench kit 2.0

The kit protocol arrived in 2.0 and now lives in the skill, bound to the 寒霜破甲工具 desktop kit (`seep-kit` 1.6.0).
It tells the agent how to work with the kit when it is installed:

| Part | Content |
| --- | --- |
| V.1 | lab mode — `lab：` / `退出实验`, the disk flag, and the probe to run after a compaction |
| V.2 | deployment and verification — `setup/install.ps1`, `update.ps1`, `uninstall.ps1`, `verify.ps1 -Detailed` and its four-column board |
| V.3 | scope recorded, never a gate — `auth_status` / `in_scope` are facts on disk; only writes, installs and out-of-workspace paths need a separate yes |
| V.4 | knowledge-base-first recon, and the signal → technique → MCP routing table |
| V.5 | the `seep` (23 tools) / `ida` (~243) / `js-reverse` (12) / `playwright` (18) matrix, with the Radare2 degradation table |
| V.6–V.7 | skill routing through `softseep`, and the A1–A10 anti-refusal rules |
| V.8–V.9 | resource map and the nine host installers |

Since 2.1 the kit's **skill library ships inside the plugin**: `agent/skills/` is the port of
`seep-kit/Tool/skill/` — 171 files, 2.48 MB, `softseep` (orchestrator), `apkseep`,
`ida-reverse`, `client-license-validation-bypass`, the five `safe-skills/*` packs, the
`hanshuang-pojia` handbook itself, and three script-bearing packs that carry both `.ps1` and `.sh`
variants. `agent/prompts/SKILL-LIBRARY.md` holds the inventory and provenance,
`agent/prompts/skill-library.sha256` the per-file hashes, and `src/test/skill-library.test.ts`
recomputes the manifest so the tree cannot drift between builds.

They are registered through `plugin.json#agent.skillPaths = ["agent/skills"]`, with
`skillPresentation.defaultVisibility` set to `visible` across all five surfaces, so they show up in
the skill picker as soon as the plugin installs. The tree is not byte-identical to upstream in four
places, deliberately — `SKILL-LIBRARY.md` lists them.

`agent/skills/hanshuang-pojia/references/plugin-handbook.md` holds the detail the skill body should
not carry: the verified kit layout, the full MCP tool list, the ten manuals, the per-host installer
table, the deployment-check baseline, and the relay / memory mechanics. Only the skill's index entry is
paid for on every turn, so the body can stay complete without costing anything until it is invoked.

## Cases and precedents

The `Cases` page and `search_cases` share one idea: a case is a method you can copy, never an
authorisation you inherit. `scope.md` records what was declared — authorisation, in-scope assets, network
profile — as a fact for the report you write afterwards. Nothing in it gates the work: there is no
readiness verdict to flip, no blocker list, and no field that makes the agent refuse to start.

| Layer | Where it lives | What it is |
| --- | --- | --- |
| Your own cases | `cases/<slug>/` in the workspace, created by `init_task` | samples, exports and reports for one target, plus the decision journal |
| Shipped precedents | `cases/<slug>/` in this repo, inlined at build time | 19 method-level packages: where the gate sits, how it was confirmed, what was disproved |
| Full case studies | `src/content/docs/cases/<slug>/` | the long form behind 24 of those write-ups — patch tables, RVA maps, protocol layouts |

A precedent package is four canonical documents plus optional case-specific ones: `scope.md`
(what was in range, recorded as fact), `docs/method.md` (the technique), `README.md` (when the shape
applies, the traps, what evidence you must be able to show), and `docs/defense.md` (how the defect
would not exist, what a reviewer can check, the residual risk). The upstream `workitems.md` ledger stays in
the older packages as history; new cases do not generate one. Extra documents such as `docs/patches.md`
carry the tables that would bloat the method. `scripts/sync-precedents.mjs` inlines all of it into
`src/domain/case/precedents.generated.ts`, so the `.astraviapkg` ships no `cases/` source tree — only the
published tool files under `dist/assets/cases/` — and
`npm run check:cases` is what keeps each package honest before a build.

Each package also carries `tools/` — `manifest.json` plus Python scripts that re-run the mechanical half
of the case. They are published as real files under `dist/assets/cases/` (a script that is not on disk
cannot run), and `scaffold_case` copies one package's `tools/` and the shared `hpkit` into your workspace,
then prints the command lines. Every tool answers `--self-test` against synthetic bytes it builds in
memory, so it proves itself before it is pointed at a real sample. `npm run check:cases` runs all of them.

The corpus is derived from upstream `seep-kit` 2.0, `Tool/cases/`. What crossed the line: offsets,
RVAs, AOB patterns, patch bytes, protocol fields and algorithm constants. What did not: sample bytes,
binaries, keys, salts, endpoints, real product names. ADRs 006 and 007 record the rule and the reasoning.

## Layout

```text
cases/                             # 19 precedent packages: source only, inlined at build time, never shipped
docs/                              # engineering docs: README.md index + contract/ reference/ audits/ plans/
                                   # ADRs live at the repo root: docs/adr/hanshuang-pojia/
agent/
├── skills/                          # registered via skillPaths; nine SKILL.md directories
│   ├── hanshuang-pojia/             # the handbook, PART I–V, including the kit protocol
│   ├── apk-reverse/  ida-reverse/  radare2/     # each with scripts/*.ps1 and *.sh
│   └── apkseep/  softseep/  reverse-engineering/  …  # the safe-skills ports
└── docs/                            # packed as a whole: this is the only agent/ subtree the packer collects
    ├── SYSTEM.md                    # standing contract: injected as a prompt block while lab mode is on
    ├── AGENTS.md                    # the same protocol for agents outside Astravia
    ├── SKILL-LIBRARY.md             # bundled skill tree: inventory, provenance, the four deliberate deltas
    └── skill-library.sha256         # 171 per-file hashes; the test recomputes this
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
│   ├── reports/    report.ts
│   ├── case/      contract.ts journal.ts library.ts precedents.ts (+ the generated table)
│   ├── interceptor.ts               # port of upstream L1/L4: injection verdict, term map, shortcuts
│   ├── refusal.ts                   # turn-boundary recovery: detector + continuation fragment
│   ├── playbooks.ts                 # checklist types + payload sections: names a bundled doc, never copies its prose
│   └── triage.ts                    # entry point: detect → parse → audit → report
├── domain/toolchain/                # external executables: nothing here starts a process by itself
│   ├── catalog.ts                   # TOOLCHAIN / COMPANIONS / COMMANDS: must equal plugin.json#commands
│   ├── install.ts                   # goal → platform command plan (never executes anything)
│   ├── probe.ts                     # per-tool version probe, refusal vs absence
│   ├── radare.ts                    # r2/rabin2/radiff2/rasm2 plans + the read-only guard
│   ├── android.ts                   # jadx/apktool plans, and the smali tree search
│   ├── workspace.ts                 # case layout (no patches/)
│   └── paths.ts
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
│       └── pages/                   # the seventeen screens
└── test/                            # fixtures and tests
```

`src/domain/` has no dependency on `@astravia-org/plugin-sdk` — it can be exercised in plain Node.

## The workbench panel

The activity-bar tab is a seventeen-page workbench rather than a single report view: `Workbench`,
`Activity`, `Prompts`, `Guide`, `Samples`, `Findings`, `Strings`, `Disassembly`, `Documents`, `Cases`,
`Manifest`, `Entropy`, `Signature`, `Compare`, `Self check`, `Reports` and `Settings`. Analysis results
only appear once a sample has been read, and every page reads from the same report — except the few
that do not need one.

`Disassembly` is the one page that does not read the report: it walks the executable sections of
the sample's own bytes, ranks candidate functions (entry, then symbol, then call target) and renders
one at a time as a control-flow listing in three densities — summary, branches only, or full — cut
at a character budget. Deeper analysis is still the `disassemble_range` tool's job; the page
is there so the listing is reachable without spending a turn on it.

`Documents` renders the kit's own field library inside the panel: 292 knowledge-base articles, 11
manuals, 7 tool docs and 30 case studies the plugin ships byte for byte, searched by title in memory
and — on demand — by body text across all 340 files. Each body is a separate build chunk, so opening
the page costs one document, not four megabytes. The same library is reachable from the conversation as
`read_doc`, which means a citation from the agent and the text on screen are the same file.

`Cases` is the read-only counterpart of `init_task`: the top table is your own `cases/` and `work/`
(target, preset, auth state, readiness, asset and evidence counts, workitem progress), the bottom table
is the 19 shipped precedents, each row marked `awaiting scope`. Copying a row and re-running `init_task`
is the only way a precedent becomes your case — the package cannot lend you its authorisation.

Two lanes, deliberately:

- **In the panel** — the bundled engine, for files inside the open project below 32 MiB. Digest,
  format, manifest, permissions, components, sections, entropy, strings, signature structure and a
  report-to-report diff all run locally.
- **In the conversation** — purple buttons send an English prompt through `ctx.conversation`; the
  agent calls the same tools for anything the panel cannot reach (out-of-project paths, files above
  the host read cap, real jadx/apktool/radare2 work, full-string scans). A prompt that cannot be sent because
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
node scripts/sync-docs.mjs --check   # the bundled document index still matches the markdown on disk
```

In this repository the SDK resolves through the dev tooling (`../../../.tooling/open-astravia/packages/plugins/plugin-sdk`), which is why `package-lock.json` records `link: true` entries. A full marketplace build regenerates it:

```bash
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build
node --test tests/*.test.mjs
```

The 340 field documents under `src/content/docs/` are indexed by `scripts/sync-docs.mjs`; run it without
`--check` after adding or editing one, and keep `--check` in CI. The documents ship as lazy chunks, so an
article that is never opened costs no download.

## Implementation depth

- Android signature digests are read from the v1 files and the APK Signing Block as structured fields.
  When the verdict matters, run `apksigner verify --print-certs` or `keytool -printcert -jarfile` in your
  own shell — both are in the toolchain `install_toolchain` names — and compare against what the plugin
  recorded. It reports what the file claims, without pretending that claim is a verification.
- The four toolchain tools borrow binaries; none of them downloads or installs one. `probe_environment` reports
  what is present, `install_toolchain` prints the command for your platform without running it, and when the
  host refuses the channel the fix is the plugin's declaration or its settings, not `PATH`.
- `run_radare` runs one r2 invocation per call (three for `decompile` with `output_mode=summary`) with a
  120 s ceiling, and refuses anything outside its read-only whitelist. `decompile_android` gives jadx and
  apktool 10 minutes each and returns the head of the log, not the sources.
- `smali_search` reads extension-filtered files up to 2 MiB each, at most 8 000 of them, and stops at the
  hit limit — it says so rather than pretending the tree ended.
- Packed or encrypted code is flagged by `native.packed` (entropy + import count, or a `UPX!` marker), so
  a stub in the way is named early. Unpacking is the next step rather than a blocked one, and it runs in
  your own shell: `upx -d` for UPX, a Frida memory dump for a runtime dex or `.so`, then
  `decompile_android` and `smali_search` over whatever came out.
  `agent/skills/apkseep/references/advanced-unpacking.md` carries the full procedure, including the stage
  where a clean-looking dump turns out to be a skeleton.
- DEX string scan is capped at 6 dex files and 24 MiB; string extraction stops at 400 results per call in triage and 500 in the standalone tool.
- Mach-O fat binaries analyse the first slice; IPA lookup tries at most three `Payload/*.app/*` candidates for the main binary.
- `disassemble_range` is a linear sweep with file offsets, not a control-flow analysis: unknown bytes
  print as `db 0xNN` and the sweep advances one byte, so a listing after an unknown opcode may be
  misaligned. Branch targets say `file+0x…` and prove nothing about reachability. Pair it with
  `run_radare decompile` for pseudo-C and `decompile_android` for Java/smali.
- Symbol tables are whatever the file carries: a stripped binary yields imports only, and the tool
  says so rather than inventing names.
- The tools stay on the reading side: they do not execute the sample and they do not edit it in place.
  Everything past reading — a patch, a re-sign, a repack, a hook that rewrites a return value — runs
  through `command.run` (limited to the fourteen binaries in `plugin.json#commands`) or the skill scripts
  (`agent/skills/apk-reverse/scripts/rebuild-sign-install.sh`, `frida-run.sh`), or straight from your own
  shell; either way the step is a command you can see and rerun. When the choice is between a patch and a
  keygen, `agent/skills/softseep/references/project-paradigms.md` gives the decision rule per architecture.

# Workbench reference pack

Companion to `PART V` of the skill. It carries what is too bulky for the prompt body: the real
layout of **this plugin**, what the panel answers on its own versus what still needs the kit, the
agent-tool surface, the field-document library, and the external kit material (MCP toolchain,
manuals, installers, deployment) that the plugin reads but never vendors.

Two different things are described here, and mixing them up is the usual source of wrong advice:

| Thing | What it is | Version source |
|---|---|---|
| this plugin | a TypeScript panel + agent tools shipped from the marketplace, installed into Astravia | `plugin.json` |
| the kit (`seep-kit`) | an external toolbox process the user installs separately, reached over MCP | `seep-kit/VERSION` on disk |

The plugin does **not** contain the kit. It contains its own decoder, its own documents and its own
prompts. Where a path below disagrees with the package in front of you, the disk wins.

---

## 1. Plugin layout (verified on disk)

```text
abilities/plugins/hanshuang-pojia/
├─ plugin.json                  # identity, permissions, entry dist/mf-manifest.json,
│                               # skillPaths, moduleFederation remote. No promptPaths: this package
│                               # injects no standing block, only the runtime kernel block.
├─ ability.json / detail*.json / assets/icon.svg / locales/{en,zh}.json
├─ ability.json / detail*.json / assets/icon.svg / locales/{en,zh}.json
├─ README.md / README.zh.md      # not packed into .astraviapkg; shipped via the gh-pages bundle
├─ agent/
│  ├─ docs/
│  │  ├─ SKILL-LIBRARY.md        # provenance + inventory of the vendored upstream skills
│  │  ├─ skill-library.sha256    # one hash per vendored file
│  │  └─ skill-library/          # verified copy of the kit's Tool/skill/, not registered as skills
│  └─ skills/hanshuang-pojia/
│     ├─ SKILL.md                # PART I–V: routing, per-track delivery templates, JIT stages
│     └─ references/
│        └─ plugin-handbook.md    # this file
├─ scripts/
│  ├─ sync-docs.mjs              # regenerates src/content/docs/index.json + docs.sha256, --check
├─ src/
│  ├─ index.tsx                  # assembly only: bridge, tools, runtime contributions, screen
│  ├─ runtime-contract.ts        # the slice of the host API this plugin compiles against
│  ├─ style.css                  # host theme variables + the few rules utilities cannot express
│  ├─ domain/                    # pure logic, no host types, fully unit-testable
│  │  ├─ native/                 # the in-house decoder
│  │  │  ├─ detect.ts elf.ts pe.ts macho.ts      # container parsers → NativeFacts
│  │  │  ├─ types.ts symbols.ts image.ts         # shared shapes, symbol surface, address maps
│  │  │  ├─ insn.ts              # x86 / x86-64 / AArch64 instruction decoder
│  │  │  ├─ disasm.ts            # the stable text listing (byte-identical, do not change)
│  │  │  ├─ cfg.ts               # basic blocks, edges, loop back-edges
│  │  │  ├─ xref.ts              # cross-reference index with an instruction budget
│  │  │  └─ deep.ts              # branch / stack / full densities over the CFG
│  │  ├─ android/                # DEX, AXML manifest model, permission risk, dex index
│  │  ├─ archive/                # zip, axml, archive facts
│  │  ├─ audit/                  # rules, findings, secret patterns
│  │  ├─ report/report.ts        # report model + weighted risk rubric
│  │  ├─ triage.ts               # format dispatch and section/facts assembly
│  │  ├─ kernel.ts               # the per-turn dynamic prompt block (buildKernelBlock)
│  │  ├─ lab-mode.ts             # `lab：` parsing and the persisted switch
│  │  ├─ selfcheck.ts            # the engine self-test the health page renders
│  │  └─ strings.ts entropy.ts digest.ts diff.ts base64.ts bytes.ts sample-path.ts sample-scope.ts
│  ├─ features/workbench/
│  │  ├─ state.ts                # PageId / NAV / PAGES, settings, library entry shape
│  │  ├─ bridge.ts               # the only module that touches the host API
│  │  ├─ prompts.ts              # the prompts behind every AI button
│  │  ├─ services/               # render/decode helpers: markdown, docs, health
│  │  ├─ hooks/                  # use-workbench, use-chat, use-disasm, use-docs, use-lab, use-library
│  │  └─ components/
│  │     ├─ workbench-screen.tsx # shell: sidebar + top bar + page switch
│  │     ├─ pages/               # one file per page (14)
│  │     ├─ shell/               # card, tag, table, markdown, icon, top-bar, panel-boundary
│  │     └─ workbench/           # finding rows, risk score, sample picker/dropzone
│  ├─ runtime/
│  │  ├─ contributions.ts        # registerSystemPromptProvider + registerHook("UserPromptSubmit")
│  │  └─ panel-channel.ts        # report events with a 40-event replay backlog + current page signal
│  ├─ tools/                     # one file per agent tool, plus ids.ts and register-tools.ts
│  └─ content/docs/              # bundled field documents: kb/ manual/ kit-docs/ + index.json
└─ src/test/                     # 26 spec files; every feature lands with a test
```

Fourteen pages, in `NAV` order: `overview`, `guide`, `docs`, `samples`, `findings`, `strings`,
`disasm`, `manifest`, `entropy`, `signature`, `compare`, `selfcheck`, `reports`, `settings`.

A new page must be registered in four places or it silently degrades: `state.ts`
(`PageId`/`NAV`/`PAGES`), `workbench-screen.tsx` (`PAGES`), `locales/*.json` (nav + page keys), and
`components/shell/icon.tsx` (`PATHS` — an unknown icon name falls back to `info`).

---

## 2. What runs where

| Need | Where it runs | Why |
|---|---|---|
| container facts, symbols, entry point, linear disassembly | the panel, in-process | `src/domain/native/` parses the sample bytes directly — no MCP, no IPC, no kit |
| per-function CFG, xref index, three-density listing | the panel, in-process | `cfg.ts` / `xref.ts` / `deep.ts` built on the same decoder |
| rules, secrets, entropy, strings, report export | the panel, in-process | pure functions in `src/domain/` |
| bundled field documents (309) | the panel, in-process | `import.meta.glob` over `src/content/docs/` |
| C-like pseudocode | the kit, through MCP | `seep_r2_decompile` — deliberately not reimplemented |
| APK / DEX decompile, unpack, smali search, hook scaffold | the kit, through MCP | `seep_apk_*` |
| binary diff against another build | the panel for byte diff; the kit for semantic diff | `diff.ts` versus `seep_r2_diff` |
| IDA-grade struct recovery, renaming, script execution | the kit, through MCP | `mcp_ida_*` |

A missing MCP server therefore narrows the depth available, not the panel: the Disassembly page
keeps working on any ELF / PE / Mach-O whose sections the panel can map.

---

## 3. Prompt layers

Three channels, in ascending cost. Do not move content downward without a reason — only the first two
are paid for on **every** turn. There is deliberately **no resident prose block**: the package declares
no `promptPaths`, so a rule that must hold on every turn has to live in the skill body and be read on
demand, not in an always-on file.

| Layer | Where it lives | Size budget | Carries |
|---|---|---|---|
| dynamic block | `src/domain/kernel.ts` via `registerSystemPromptProvider` | a few hundred bytes, and only when relevant | lab mode state, current panel page, registered tool names, delivery shape while lab is on |
| lab hook | `src/runtime/contributions.ts` via `registerHook("UserPromptSubmit")` | one line of context | flips the switch when the prompt starts with `lab：`, adds one sentence of confirmation |
| skill index | `plugin.json` `skillPaths` → host skill table | `name` + `description` only, a few hundred characters | the index entry that lets the agent decide whether to invoke the skill |
| skill body | `agent/skills/hanshuang-pojia/SKILL.md` | read on demand via `invoke_skill` | PART I–V, this file, the vendored upstream skills |

The block id must sit in the plugin namespace (`plugin.hanshuang-pojia.kernel`) or the host refuses
the write; the write permission is `agent.systemPrompt.write`. Hooks need `agent.hooks.register`
and `agent.hookHandler.execute` — both are declared in `plugin.json`.

Why the split: a single 96 KB injected prompt costs ~30 k tokens before any work starts, so every
real task hits context compaction and the summary stream is what breaks the host, not the task. The
resident file is the part that must be true on every turn; everything else is fetched when used.

---

## 4. Lab mode

The switch is real state, not a conversation mood:

- Stored in plugin private storage (`workbench/lab.json`), so it survives a reload, a model switch
  and a fresh session.
- Enter with `lab：` / `lab:` / `进入实验：` / `实验环境：` followed by the task; leave with
  `退出实验` / `退出工作环境` / `exit lab`. Parsing is `domain/lab-mode.ts`, matching only at the
  start of the prompt — a `lab：` in the middle of a sentence is ordinary text.
- The top bar carries a `LAB MODE` badge; the health page reports the switch and since when.
- While on, the kernel block appends the delivery shape: locate → patch table → runnable artefact
  → verification with exit codes → rollback, with claims marked Observed / Inferred / Assumed.
- While off the block is one sentence: answer normally, do not expand shorthand into patch plans.

The kit implements the same idea as a disk flag at `~/.pi/agent/lab-mode.flag` (override with
`LAB_FLAG`). That file belongs to the kit's hosts, not to this plugin — probing it tells you what
the kit thinks, never what this panel thinks.

---

## 5. Agent tools

Eighteen tools, declared once in `src/tools/ids.ts` and registered in `src/tools/register-tools.ts`.
Every one declares `scope_use` for the conversation and project scenarios, so it is fail-closed
outside them. The last four reach the machine's own `radare2` / `jadx` / `apktool`; the first
eight only read bytes the plugin already holds.
Every one declares `scope_use` for the conversation and project scenarios, so it is fail-closed
outside them.

| Tool | Answers | Wraps |
|---|---|---|
| `triage_binary` | what a sample is: format, sections, risk score, top findings | `domain/triage.ts` + `audit/` |
| `scan_binary_strings` | printable strings with byte offsets and optional filter | `domain/strings.ts` |
| `list_code_symbols` | exported / imported names, entry point, stripped-or-not | `domain/native/symbols.ts` |
| `disassemble_range` | instructions for one bounded byte range, decoded from the file | `domain/native/insn.ts` |
| `search_dex_symbols` | class / method / string hits inside an APK or DEX | `domain/android/dex-index.ts` |
| `diff_binaries` | what actually changed between two builds, as hunks | `domain/diff.ts` |
| `explain_triage_finding` | what one rule id means and what to do next | `domain/audit/rules.ts` |
| `export_triage_report` | hands the finished report to the save dialog | `domain/report/report.ts` |
| `decompile_function` | register-level pseudo-C for one function, with its string references | `domain/native/pseudo.ts` |
| `diff_functions` | which functions changed shape vs only changed constants, between two builds | `domain/native/semantic-diff.ts` |
| `generate_hook` | a Frida **observation** script for matched Dalvik methods (never rewrites a result) | `domain/android/hook-template.ts` |
| `triage_directory` | one risk table for every binary under a directory | `domain/batch.ts` |
| `search_docs` | which field document covers a topic | `services/docs.ts` |
| `read_doc` | the body of one field document, truncated visibly | `services/docs.ts` |
| `probe_environment` | which declared executables actually run, with version banners, keeping a host refusal apart from a missing binary | `domain/toolchain/probe.ts` |
| `run_radare` | 9 r2 / rabin2 / radiff2 / rasm2 operations, shaped by `full` / `fold` / `summary`; the tenth, `cmd`, is read-only only — write, shell, debugger, project, mount and `=` remote commands are refused | `domain/toolchain/radare.ts` |
| `decompile_android` | jadx / apktool output beside the sample, plus `smali_search` over the unpacked tree | `domain/toolchain/android.ts` |
| `init_task` | the per-target case layout (`samples/`, `exports/`, `reports/`, README, report skeleton) | `domain/toolchain/workspace.ts` |

Adding a tool means touching four places: the tool file, `register-tools.ts`, `ids.ts`, and both
locale files — plus `EXPECTED_TOOL_COUNT` in `ids.ts`, which is the one number the health page and
`src/test/tools.test.ts` both compare against. A missed step fails the suite instead of shipping
quietly, and the self-check page shows `n of 18` when the registry drifts.

The same engines are reachable outside the panel through `scripts/analyze.mjs` (bundled with
esbuild, `src/cli/analyze.ts`, imports only `src/domain`): `triage`, `strings`, `symbols`,
`disasm`, `decompile`, `diff`, `hook`, `docs`. It reads arbitrary paths — the fs grant only
applies to the plugin sandbox — so it is the way to reproduce a panel number in a terminal or
in CI.

The panel cannot call MCP tools. It never could: MCP lives in the host's agent runtime, not in a
plugin's renderer. Everything the panel shows is computed from bytes it read itself.

---

## 6. Field documents

| Group | Count | Source |
|---|---|---|
| `kb` | 292 | the kit's `Tool/mcp/Tool/reverselab/kb/` — technique articles |
| `manual` | 10 | the kit's `MANUAL/` — deployment, unpacking, anti-debug, PoC validation, cross-platform |
| `kit-docs` | 7 | the kit's `Tool/docs/` — toolkit guide, MCP setup, provenance, workspace rules |

309 files total. `scripts/sync-docs.mjs` regenerates `index.json` (id, title, group, topic, size)
and `docs.sha256`; `--check` verifies both, and it is part of the release chain. The renderer is
`services/markdown.ts` — about 200 lines, no third-party markdown dependency, no HTML passthrough,
`SAFE_HREF` limited to `http(s)://`, `mailto:`, `#`, `/`, `./`, `../`.

Two entry points share one source: the `docs` page (search, group filter, open, copy path) and the
agent tools (`search_docs` matches titles/ids/topics only; `read_doc` reads a body under a
`maxChars` budget and says explicitly where it stopped).

`Tool/docs/tool-index.json` from the kit is intentionally not bundled: it indexes the kit's own
tool installation, which the panel cannot verify.

---

## 7. Kit MCP toolchain (external)

Config lives with the kit's hosts, not here: `~/.pi/agent/mcp.json` is generated from
`Tool/mcp/mcp.json.template`; OpenCode uses `opencode.jsonc.template`. Never hardcode an IDA
directory — read `mcpServers.ida.command` from the live config.

### 7.1 seep — 23 tools

| Group | Tools |
|---|---|
| readiness | `seep_status`, `seep_ida_status` |
| radare2 | `seep_r2_info`, `seep_r2_cmd`, `seep_r2_strings`, `seep_r2_functions`, `seep_r2_disasm`, `seep_r2_decompile`, `seep_r2_diff`, `seep_r2_asm`, `seep_r2_xrefs` |
| APK | `seep_apk_info`, `seep_apk_decompile`, `seep_apk_unpack`, `seep_apk_smali_search`, `seep_apk_gen_hook` |
| knowledge base | `seep_kb_search`, `seep_kb_read`, `seep_kb_checklist`, `seep_kb_payloads` |
| workflow | `seep_task_init`, `seep_auto_triage`, `seep_gen_security_report` |

### 7.2 ida — ~243 tools

`mcp_ida_*`: decompile, xrefs, structure recovery, rename / retype, script execution, snapshot
diff. Requires a licensed IDA Pro that the user supplies; the kit never ships one.

### 7.3 js-reverse — 12 tools

`npx -y js-reverse-mcp`. Client-side JavaScript reversing: breakpoints, call stack capture,
deobfuscation helpers. Needs Node 18+; without Node, web reversing is limited and native binaries
are unaffected.

### 7.4 playwright — 18 tools

Browser automation for web audit and JavaScript reversing. Ships inside the kit at
`Tool/mcp/Tool/safe/playwright-mcp/`; outside the kit it is `npx -y @playwright/mcp`, driven by
`PLAYWRIGHT_MCP_EXTENSION_TOKEN`.

### 7.5 Degradation when IDA is missing

`seep_ida_status` fails → say so once, switch to the Radare2 / APK surface, keep the same
deliverable. Never abort the task; never drop the "no decompiler" caveat silently.

| Need | Replacement |
|---|---|
| arch, packer, entropy, strings | `seep_r2_info`, `seep_r2_strings` |
| disassembly / xrefs / function list | `seep_r2_disasm`, `seep_r2_xrefs`, `seep_r2_functions` — the panel already covers the first pass offline; use these to cross-check a disputed function |
| arbitrary radare2 command | `seep_r2_cmd` |
| C-like pseudocode | `seep_r2_decompile` |
| binary diff | `seep_r2_diff` |
| asm ↔ bytes | `seep_r2_asm` |
| APK facts / decompile / unpack / smali | `seep_apk_info`, `seep_apk_decompile`, `seep_apk_unpack`, `seep_apk_smali_search` |
| Frida hook scaffold | `seep_apk_gen_hook` |
| method, payloads, checklist | `seep_kb_search`, `seep_kb_read`, `seep_kb_payloads`, `seep_kb_checklist` |
| case scaffold / triage / report | `seep_task_init`, `seep_auto_triage`, `seep_gen_security_report` |

### 7.6 Coverage: what runs without the kit, what needs the machine's tools, what only the kit adds

Three columns now, because 2.4.2 added a real command bridge: `plugin.json#commands` declares eight
executables and the host runs them through `agent.command.run` after the user grants it. Nothing is
bundled and nothing is installed for you.

| Need | In the plugin, no external tool | Needs `r2` / `rabin2` / `radiff2` / `rasm2` / `jadx` / `apktool` | Only the kit adds |
|---|---|---|---|
| file type, arch, sections, entropy, imports | `triage_binary`, Manifest / Entropy pages | `run_radare operation=info` cross-checks the same fields | `mcp_ida_*` (rename / retype / structs) |
| strings, wide strings, secret patterns | `scan_binary_strings`, Strings page | `run_radare operation=strings all_sections=true` (`rabin2 -zz`) | — |
| symbols, exports, entry point | `list_code_symbols` (in-process ELF/PE/Mach-O / DEX tables) | `run_radare operation=functions` (r2 function list; `info` for the header fields) | `mcp_ida_*` |
| disassembly, function list, CFG, xrefs | `disassemble_range` + the self-built engine | `run_radare operation=disasm/functions/xrefs`, `full`/`fold`/`summary` | — |
| C-like pseudocode | `decompile_function` (register-level, no types, no SSA) | `run_radare operation=decompile` (r2 `pdc`) for a second opinion | IDA's Hex-Rays output |
| bytes ↔ instruction text | not ported | `run_radare operation=asm` (`rasm2`, both directions) | — |
| two builds compared | `diff_binaries` (bytes), `diff_functions` (instruction shape) | `run_radare operation=diff` (`radiff2 -C` code / `-x` hex / `-s` stats via `diff_mode`) | — |
| APK facts, decompile, unpack, smali | `search_dex_symbols`, `decompile_android operation=smali_search` | `decompile_android operation=decompile/unpack` (jadx / apktool into a sibling directory) | — |
| Frida hook scaffold | `generate_hook` (observation only) | — | `seep_apk_gen_hook` (kit's own variant) |
| method lookup, documents | `search_docs` / `read_doc` over the 309 bundled documents | — | `seep_kb_payloads` — deliberately not ported |
| case scaffold, risk score, report | `init_task`, `triage_binary`, `triage_directory`, `explain_triage_finding`, `export_triage_report` | — | `seep_auto_triage` (kit's Python walker) |
| which tools are even present | `probe_environment` (`✓` / `✗` / `!` per binary, with install hints) | — | — |

What this means in practice: the first pass never blocks. A missing radare2 or JDK narrows **depth**
(no `pdc`, no APK unpack), never the initial assessment — and `probe_environment` says which of the two
problems you have: the binary is absent, or the host refused the call (`!`, fix it in plugin settings,
not by installing more software).

What is left for the kit is exactly what a plugin cannot own: an IDA session, the kit's Python
orchestration, and the payload library. `seep_kb_payloads` stays out on purpose.


---

## 8. Kit manuals, installers, deployment (external)

`seep-kit/MANUAL/` — ten documents: `DEPLOYMENT.md`, `DEPLOYMENT-CHECKLIST.md`,
`PREREQUISITES.md`, `IDA-PRO.md`, `UNPACKING.md`, `ANTI-DEBUG.md`, `POC-VALIDATION.md`,
`CROSS-PLATFORM.md`, `COMPLIANCE-RELAY.md`, `MODEL-REFUSAL-MATRIX.md`.

Host installers live in the kit package, not here: `setup/install*.ps1` (pi, Claude Code, Cursor,
Doubao, DeepSeek Harness, OpenCode, WorkBuddy, ZCode, portable) plus `setup/install.sh` /
`update.sh` / `uninstall.sh` / `verify.sh`. **This plugin never executes them** — it documents them
so the operator can be pointed at the right one.

The kit's verify board has four columns: skills (9 items), MCP engines (seep 23 / ida ~243 /
js-reverse 12 / playwright 18), physical toolbox (T1–T6), conclusion. One checklist defect worth
knowing: row **S6** tells you to copy `Tool/skill/safe-skills/apk-diff`, and no such pack exists —
the one on disk is `apk-reverse`. A board reporting S6 🔴 is reading the checklist, not a broken
install.

Never report "deployed" from an installer exit code; the board is the evidence.

### This plugin's own chain

```bash
/usr/local/bin/node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json
/usr/local/bin/node ./node_modules/vitest/vitest.mjs run
/usr/local/bin/node scripts/sync-docs.mjs --check      # docs index ok: 309 documents
```

The plugin chain no longer stages a user-level document: `plugin.json` declares no `promptPaths`, so
there is nothing to copy into `<agentDir>/AGENTS.md` and `scripts/sync-agent-doc.mjs` is gone.

---

## 9. Skill library

| Skill | Files / size | Role |
|---|---|---|
| `softseep` | 9 files / 123 KB, MIT | orchestrator: platform + work-type classification, dispatches the rest; `references/license-validation.md` |
| `apkseep` | 112 files / 1.8 MB, MIT | Android end to end: recon, gates, anti-tamper, repack and sign |
| `ida-reverse` | 1 file / 4 KB, GPL-3.0 | IDA Pro zero-touch launch and the MCP analysis chain |
| `client-license-validation-bypass` | 1 file / 30 KB | license / activation playbook: where the authority lives, whether local forgery suffices |
| `safe-skills/*` | 42 files / 419 KB, MIT | upstream packs: `apk-reverse`, `ida-reverse`, `mcp-js-reverse-playbook`, `radare2`, `reverse-engineering` |

The whole library — **165 files / 2,450,341 bytes** — ships at `agent/docs/skill-library/`,
byte-for-byte identical to the kit's `Tool/skill/`. Inventory, provenance and per-file hashes live
in `agent/docs/SKILL-LIBRARY.md` and `agent/docs/skill-library.sha256`;
`src/test/skill-library.test.ts` recomputes the manifest so the tree cannot drift silently.

It is deliberately **not** registered in `plugin.json` `agent.skillPaths`: the upstream frontmatter
uses YAML block scalars and over-cap descriptions, and `ida-reverse` appears twice. Registering
them would mean editing upstream documents. Read a `SKILL.md` by path instead — the routing table
in `PART V.6` names which one to open first.

---

## 10. Troubleshooting

Panel side — every item here is visible on the `selfcheck` page, which runs the check rather than
listing it:

| Symptom | First check |
|---|---|
| a tool is missing from the agent | `plugin.json` permissions, then `src/tools/ids.ts` versus `register-tools.ts`; reload the plugin |
| `LAB MODE` badge never turns on | the prompt must **start** with `lab：`; `agent.hooks.register` + `agent.hookHandler.execute` must be granted |
| the kernel block does not reach the model | `agent.systemPrompt.write` granted, and the block id must stay under `plugin.hanshuang-pojia.*` |
| the Docs page is empty | `node scripts/sync-docs.mjs --check`; a stale `index.json` fails the check with a count mismatch |
| a page renders blank | the page id is probably missing from `PAGES` or from `locales/*.json`; the shell catches it in `panel-boundary` |
| self-check reports `engine.detect` fail | fixtures, not the product: the PE probe needs `e_lfanew` pointing at `PE\0\0`, the DEX probe needs ≥ 0x70 bytes |

Kit side:

| Symptom | First check |
|---|---|
| `seep_*` tools missing | the kit host's `mcp.json` exists and lists `seep`; restart the session after a config change |
| `seep_status` reports a missing binary | radare2 / jadx / apktool on `PATH`; `setup/repair-tools.ps1` |
| `seep_ida_status` fails | IDA path in `mcpServers.ida.command`; port `127.0.0.1:13337` free |
| the kit seems to be in the wrong mode | probe `~/.pi/agent/lab-mode.flag` — that is the kit's state, not this panel's |
| prompts injected twice into a host | `scripts/clear-injected-prompts.ps1`, then reinstall the kit |
| verify board shows 🟡 DEGRADED | expected without IDA or a licence; proceed on the Radare2 surface |

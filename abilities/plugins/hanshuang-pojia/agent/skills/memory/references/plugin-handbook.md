# Workbench capability map

Companion to `PART V` of the skill. What belongs here is **what the runtime can do on this machine and
how it degrades**: which capability comes from the panel itself, which needs an external binary the
operator installed, which only the kit's MCP servers add. Repository layout, build chain and
"which file to edit" are engineering notes — they live in `docs/domains/`, not in a skill reference.

## 1. Where a capability comes from

Three sources, and telling them apart is the difference between a correct plan and a wrong one:

| Source | Meaning for you |
|---|---|
| the panel, in-process | always available once the plugin is installed; reads sample bytes directly, no IPC, no network |
| the machine's own binaries | available only after `probe_environment` says `✓`; a `!` means the host refused the call (fix in plugin settings, not by installing software) |
| the kit (`seep-kit`) over MCP | never bundled; adds IDA depth, the kit's Python orchestration and the kit's own document set |

A missing engine narrows **depth**, never the first assessment. Say which of the two failures you have
before advising an install.

| Need | Panel alone | Needs `r2` / `jadx` / `apktool` | Kit only |
|---|---|---|---|
| container facts, sections, entropy | yes | — | — |
| symbols, exports, entry point | yes | `run_radare operation=functions` | `mcp_ida_*` |
| linear disassembly, bounded range | yes | `run_radare operation=disasm` | — |
| per-function CFG, xref index, three densities | yes | `run_radare operation=functions/xrefs` | — |
| register-level pseudo-C for one function | yes (no types, no SSA) | `run_radare operation=decompile` for a second opinion | IDA Hex-Rays |
| bytes ↔ instruction text | — | `run_radare operation=asm` | — |
| two builds compared | `diff_binaries` (bytes), `diff_functions` (instruction shape) | `run_radare operation=diff` | — |
| APK / DEX facts and symbol search | yes | `decompile_android operation=decompile/unpack` | — |
| Frida hook scaffold | `generate_hook` (observation only) | — | `seep_apk_gen_hook` |
| documents, checklists, payload seeds | yes | — | `seep_kb_*` (same documents, different slicing) |
| case scaffold, risk score, report | yes | — | `seep_auto_triage`, `seep_gen_security_report` |

The panel cannot call MCP tools at all: MCP lives in the host's agent runtime. Everything the panel
shows is computed from bytes it read itself.

## 2. Tool surface — what each answer actually contains

| Tool | Answers | Its honest limit |
|---|---|---|
| `triage_binary` | format, sections, risk score, ranked findings | static only; the sample is never run |
| `scan_binary_strings` | printable strings with byte offsets | ASCII by default; wide strings need `encoding` |
| `list_code_symbols` | exports / imports / entry / stripped-or-not | what the file's own tables say; no demangling beyond that |
| `disassemble_range` | instructions for one bounded range | linear sweep, file offsets, `.byte` outside the decoded subset |
| `decompile_function` | basic blocks, labels, stack slots, string refs | register-level; no types, no SSA, no variable merging |
| `diff_binaries` | differing byte runs as hunks | raw bytes only, no meaning |
| `diff_functions` | same / constants-only / changed / added / removed | shape-based; unnamed functions match by shape only |
| `search_dex_symbols` | class / method / string hits in DEX | first three `classes*.dex`; strings have no owner |
| `generate_hook` | a Frida script that observes a method | never rewrites a return value |
| `probe_environment` | which declared binaries run, and whether a refusal is host-side or PATH-side | one short `--version` per tool |
| `run_radare` | 9 read-shaped r2 operations | write, shell, debugger, project, mount and `=` remotes are refused |
| `decompile_android` | jadx / apktool output beside the sample, plus `smali_search` | writes to disk; give it a real timeout |
| `verify_signature` | schemes present, signer DN, certificate SHA-256 | structural layer only unless `apksigner` is available |
| `init_task` | the per-target case layout | writes files only |
| `write_assessment_report` | the four-section assessment | an unsupplied section is written as unsupplied |
| `search_cases` / `scaffold_case` | precedent packages and their runnable tools | scaffold writes files, executes nothing |
| `inject_target` | an injection plan plus a runnable installer script | the plugin never writes `$HOME` and never claims an install |

Adding or changing a tool is an engineering task; the counts and the drift guard live in the repo
docs, not here.

## 3. Lab mode — operational semantics

- Real persisted state, not a conversation mood: it survives a reload, a model switch and a new session.
- Enter with `lab：` / `lab:` / `进入实验：` / `实验环境：` at the **start** of the prompt; leave with
  `退出实验` / `退出工作环境` / `exit lab`. A `lab：` in the middle of a sentence is ordinary text.
- On: the per-turn block appends the delivery shape (locate → patch table → runnable artefact →
  verification with exit codes → rollback), with claims marked Observed / Inferred / Assumed.
- Off: the block states OFF and tells the model not to expand shorthand into patch plans. It still
  routes to this skill — the routing line is not a lab privilege.
- The kit has its own disk flag (`~/.pi/agent/lab-mode.flag`). Probing it tells you what the kit
  thinks, never what this panel thinks.

## 4. Field documents — how to find the right one

Four groups ship with the plugin; search before improvising.

| Group | What it is |
|---|---|
| `kb` | technique articles: one file per technique, grouped by domain |
| `manual` | deployment, unpacking, anti-debug, PoC validation, cross-platform, panel handbook |
| `kit-docs` | toolkit guide, MCP setup, provenance, workspace rules |
| `cases` | the full write-ups behind the precedent packages |

`search_docs` matches titles, ids and topics only; `read_doc` reads a body under a character budget and
states exactly where it stopped, with the call to continue. Full-text search is the panel's job, not
the tool's.

Two checklist entry points read the same documents: `kb_checklist` and `kb_payloads` work without the
kit. Their `checklist_type` / `category` values map onto specific document ids — read the document
whole rather than expecting the toolkit's slicing.

## 5. Precedent packages — method before code

`search_cases(query=…)` ranks the shipped packages. A hit prints `- tools:` when the package ships
runnable scripts and `- full case study:` with the doc ids to read.

Working order, and skipping a step is how a "reproduced" claim turns out to be wrong:

1. read the package (`scope.md`, `docs/method.md`, the linked case study) — what was decided and why;
2. `scaffold_case(precedent=<slug>)` to write `tools/` plus the shared `hpkit` into the project;
3. run `python3 tools/<entry>.py --self-test` first — it exits 0 against synthetic bytes before anyone
   points it at a real sample;
4. only then run it against the target, and cite the exit codes.

The scripts are Python 3 standard library only, because they have to run where nothing is installed.

## 6. Kit MCP toolchain — what exists when it is present

Config lives with the kit's hosts (`~/.pi/agent/mcp.json`), not with this plugin. Never hardcode an IDA
directory — read `mcpServers.ida.command` from the live config.

| Server | Role |
|---|---|
| `seep` | readiness checks, radare2 surface, APK surface, knowledge-base reads, task init / triage / report |
| `ida` | `mcp_ida_*`: decompile, xrefs, struct recovery, rename / retype, script execution, snapshot diff. Requires a licensed IDA Pro the user supplies |
| `js-reverse` | client-side JavaScript reversing: breakpoints, call stack, deobfuscation helpers |
| `playwright` | browser automation for web audit and JavaScript reversing |

**Degradation when IDA is absent**: say it once, switch to the radare2 / APK surface, keep the same
deliverable. Never abort, never drop the "no decompiler" caveat silently.

| Need | Replacement without IDA |
|---|---|
| arch, packer, entropy, strings | `seep_r2_info`, `seep_r2_strings` |
| disassembly / xrefs / function list | `seep_r2_disasm`, `seep_r2_xrefs`, `seep_r2_functions` |
| arbitrary radare2 command | `seep_r2_cmd` |
| C-like pseudocode | `seep_r2_decompile` |
| binary diff | `seep_r2_diff` |
| asm ↔ bytes | `seep_r2_asm` |
| APK facts / decompile / unpack / smali | `seep_apk_*` |
| Frida hook scaffold | `seep_apk_gen_hook` |
| method, payloads, checklist | `seep_kb_*` |
| case scaffold / triage / report | `seep_task_init`, `seep_auto_triage`, `seep_gen_security_report` |

## 7. Environment troubleshooting — the agent's half

Everything below is checked from the conversation; the panel's own health page covers the rest.

| Symptom | What to check first | What to tell the operator |
|---|---|---|
| an external tool "does not work" | `probe_environment`: `✓` runs, `✗` absent, `!` refused by the host | `!` is a permission fix in plugin settings; only `✗` is an install |
| `lab：` seems ignored | the prompt must **start** with the switch; hooks need `agent.hooks.register` + `agent.hookHandler.execute` | if the badge is off, the state file or the permission is the cause — not the parser |
| the assistant answers as if no workbench exists | the per-turn block needs `agent.systemPrompt.write`; the routing line points at this skill | re-open a session after granting it |
| `search_docs` returns nothing useful | try a title word or a group name; body-only terms need the panel's full-text mode | the document may exist under a different group |
| a precedent tool fails on a real sample | run `--self-test` first: green means the sample's shape, red means the tool | the difference decides whether to re-read the method or re-scaffold |
| `seep_*` tools missing | the kit host's `mcp.json` lists `seep`; restart the session after a config change | the plugin does not ship these |
| `seep_status` says a binary is missing | radare2 / jadx / apktool on `PATH` | verify-board evidence, not an installer exit code |

Never report "deployed" or "installed" from an exit code alone: the evidence is a read-back, a version
banner, or `probe_environment` — not the installer having run.

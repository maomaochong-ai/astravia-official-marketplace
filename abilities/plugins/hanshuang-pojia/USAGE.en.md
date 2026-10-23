# hanshuang-pojia — Usage Guide

> This file is about *how to use*. Capabilities, architecture and decisions live in `README.md`;
> the glossary in `CONTEXT.md`; the lab engagement details in `agent/`.

## 1. Quick start

1. **Install** from the ability marketplace (not a downloaded package, or upgrades won't follow the market).
2. **Open the workbench**: add the "Hanshuang Pojia" tab from the activity bar in a project conversation.
   It lists analyzable packages and binaries in the workspace folder.
3. **Drop a sample**: click a file in the list, or paste a path in the top input. Project files ≤ 32 MiB go
   to the local engine; larger or out-of-project samples are handed to the chat agent (which reads them with
   the host's own file access).
4. **Read the report**: risk score and grade on top, then per-section facts, permissions and findings.
   Toggle Summary / Full, then copy or save as markdown / JSON.

The panel has sixteen pages; a bottom rail guides the main flow ("Pick sample → Analyse → Forensic → Toolbox"),
and the top `PipelineBar` shows how far the current sample is through Profile / Control flow / Knowledge / Verify.

## 2. Lab mode: on / off / how to check

Lab is a work-style switch shared by the panel and the chat agent. When on, the agent responds in
engagement shape — it opens with a runnable artefact and follows with verification and rollback rather
than explaining why. For ordinary Q&A, leave it off.

| What you want | Say |
| :--- | :--- |
| Turn Lab on | `lab：` (also `lab:` / `进入实验：` / `实验环境：`) |
| Turn it on and give a task at once | `lab：分析这个 apk` |
| Turn Lab off | `退出实验` (also `退出工作环境` / `exit lab`) |

Notes:

- **One switch lasts the whole run**: say `lab：` once at the start; the chain stays in Lab mode
  without re-prefixing every command.
- **Zero interference when off**: ordinary chat passes through unchanged, no analysis wrapping added.
- **State survives across sessions**: Lab state lives in the plugin's own storage (a on-disk flag),
  surviving compaction, model switches and panel remounts. When unsure, ask the agent / look at Settings
  instead of guessing.

### On vs off

| Dimension | Off (everyday) | On (assessment / forensics) |
| :--- | :--- | :--- |
| Reply shape | normal answers | five-part delivery: Locate → Patch table → runnable artefact → verification → rollback |
| Claim labels | not required | each claim marked Observed / Inferred / Assumed; unrun steps labelled `NOT RUN` |
| Authorisation | ordinary chat | asked once per target, not repeated |
| Touching the host | not implied | still asked separately; Lab does not auto-authorise installs/writes |
| Best for | what is it / how does it work | kill a check, recover an algorithm, produce a reproducible report |

## 3. How panel and chat cooperate

- The panel tab reads reports full-time; for **source-level** answers (symbols, disassembly, DEX
  instructions, binary diff) drive the chat agent's tools: `list_code_symbols`, `disassemble_range`,
  `disassemble_dex_method`, `search_dex_symbols`, `diff_binaries`, `run_radare`, `decompile_android`,
  `frida_dump`.
- Reports produced by the agent in chat (via `triage_binary`) are pushed back to the panel and marked
  "from chat".
- Need an external reverse-engineering tool? Run `probe_environment` to see what's installed, then
  `install_toolchain` for the exact platform command (the plugin does not install it; you / the host run it).
- For a multi-artefact case use `init_task` to lay out `samples/ exports/ reports/`, and
  `write_assessment_report` for the four-section assessment.

## 4. Advanced examples

**A — review an APK and its dangerous permissions**
> User: `lab：` then `analyse this APK, focus on which dangerous permissions it asks for and why it scores 62`.
> Agent: five-part reply — score breakdown, dangerous permissions, the rule ids behind them, and how to verify the signature.

**B — unpack, then read the real code**
> User: `this app is packed; dump the runtime-loaded dex and look at the logic`.
> Agent: `frida_dump` to recover the dex → `decompile_android` to source → search the tree → report.

**C — recover a signing-check algorithm**
> User: `lab：还原这个 App 的签名校验算法`.
> Agent: locate the gate with `search_dex_symbols` → hook to observe args when reversible → reconstruct
> the flow → give the smallest patch plus verification.

**D — compare a sample family into a baseline**
> User: `compare the two samples in the library; give shared findings and what only one has`.
> Agent: `compareReports` / `familyBaseline` produce three columns (common / this sample only / family only)
> and each rule's count within the family.

## 5. What the panel will not do (stated plainly)

- **It never executes the sample.**
- **It cannot read files outside the project folder** — that's a hard host boundary.
- **It does not auto-install tools** — installing external binaries runs under your / the host's authority.
- The panel defaults to static-first; runtime-only behaviour is covered by Frida in chat, never guessed.
---
name: frostbreak-triage
description: "Statically triage an unknown binary or app package - APK, AAB, IPA, DEX, JAR, ZIP, ELF, PE, Mach-O, .so, .dll, .dylib. Use when the user asks what a package does, whether an APK is safe, which permissions or exported components it exposes, what strings or credentials it carries, or why a binary is flagged. Read-only, samples are never executed, uploaded or modified."
---

# Frostbreak triage

Everything below runs locally on the sample's bytes. There is no external toolchain, no network
call, and no execution of the sample — so conclusions describe what the file *contains*, not what
it does at runtime.

## When to use it

- "What is this APK / IPA / .so / .exe, and is it safe?"
- "Which permissions and exported components does it have?"
- "Does it carry hardcoded keys, tokens or URLs?"
- "Why is this binary flagged?" → follow up with `explain_triage_finding`.
- A suspicious attachment or download needs a first read before anyone opens it.

Do not use it to patch, repack, sign, or bypass an app's protection. It is a triage and static
analysis instrument: it reads symbols, byte ranges and DEX tables, and it does not decompile to
Java or C, generate Frida hooks, produce keygens, or build license-bypass patches.

## Workflow

1. **Locate the sample.** Use the path the user gave. Relative paths resolve against the session
   working directory; `..` is clamped to the workspace root. If the user only describes a file,
   ask for its path instead of guessing.
2. **Run `triage_binary`** with `{"path": "..."}`. Keep `mode: "summary"` (default) for the first
   pass; it stays under ~4500 characters. Ask for `mode: "full"` only when the summary is not
   enough or the user wants the whole table.
3. **Report what the score rests on**, not the score alone: format and SHA-256, the top
   `risk.drivers`, every `critical` / `high` finding with its evidence, and the `limits` the
   report declares.
4. **Follow up with evidence** when the user wants detail:
   - `scan_binary_strings` — URLs, hosts, SDK markers, embedded paths; supports a plain-text or
     regex `query`.
   - `explain_triage_finding` — what a rule id checks, why it matters, what to do next.
5. **Offer a file** with `export_triage_report` when the user wants something to attach, archive or
   hand to a reviewer (`markdown` by default, `json` for machine-readable output).

## Static code analysis

Four more tools read code structure straight from the bytes. They cover the plugin-native part of what
radare2, jadx and apktool would give you, with no install and no scratch copy of the sample written to
disk — so try them before reaching for an external toolchain.

- `list_code_symbols` — `{"path", "query"?, "kind": "all" | "function" | "export" | "import"}` — ELF
  `.symtab`/`.dynsym`, the PE export directory, Mach-O `LC_SYMTAB`, merged with the import table. When
  the binary is stripped it says so and only imports remain: report that, and never invent function
  names to fill the table.
- `disassemble_range` — `{"path", "offset", "length", "maxInstructions", "arch"?}` — a linear sweep of a
  byte range for AArch64 and x86/x86-64. Another architecture returns a warning, not a guess.
- `search_dex_symbols` — `{"path", "query", "kind"?, "limit"?}` — classes, method signatures with their
  declaring class, and string-pool entries, from a `.dex` or from the first three `classes*.dex` of an
  APK. This is the index a smali search would give you without materialising smali.
- `diff_binaries` — `{"path", "otherPath", "maxHunks"?}` — byte-level hunks between two builds, so a
  patched check shows up as a few changed bytes instead of a wall of noise.

Read them honestly:

- Addresses are **file offsets**, and branch targets print as `file+0x…`. They are not virtual
  addresses, and a target does not prove the branch is reachable.
- `.byte` / `.word` / `db 0xNN` means "this sweep did not decode it", not "invalid code". The sweep
  advances one byte past an unknown opcode and never claims to resynchronise, so the instruction after
  it may be misaligned — say that when you quote a listing.
- There is no control-flow graph, no pseudo-C, no assembler, no Java or smali decompilation, and no
  annotation or try-catch parsing. Never present a listing as decompiled source.
- When the user needs real decompilation, drive the actual tool from the shell — `jadx -d out app.apk`,
  `apktool d app.apk`, `r2 -q -c 'aaa; afl' app.bin`, `analyzeHeadless` for Ghidra — and attribute each
  claim to the tool that produced it. This plugin cannot bundle or execute those binaries.

## When the plugin's reader cannot open it

The triage tools read through the host file capability: files inside the working directory only, at
most 32 MiB per file. A portable app folder on the Desktop, or a 180 MiB installer, fails with a path
or size error. That is a host limit, not a verdict about the sample — say so, then do the pass
yourself with the shell and report in the same shape:

1. **Identity** — `shasum -a 256 <path>`, size with `stat -f%z <path>` (macOS) or `stat -c%s <path>`,
   and `file <path>` for the container.
2. **Container** — for an Electron or portable Windows app, list the folder, check `variant.json` and
   `package.json`, and look inside `resources/` for `app.asar` and `*.ps1` installers. If the scripts
   show what the app installs or writes, that belongs in the report as a fact.
3. **Headers** — `xxd -l 512 <path>` for the magic and the first records; use a short
   `python3 -c 'import struct ...'` snippet when you need parsed PE / ELF / Mach-O fields.
4. **Strings** — `strings -n 8 <path> | sort | uniq -c | sort -rn | head -60`, then grep that tail for
   URLs, hosts, script names, product ids and credential shapes. Quote only what you saw.
5. **Report the same way** — format, notable facts, findings with evidence, and an explicit list of
   what you could not see: packed payloads, signature validity, anything outside the bytes you read.

Never execute the sample, and never upload it to a third-party service to compensate for the limit.

## Reading the report

- `risk.score` is 0-100, weighted by severity: critical 45, high 22, medium 10, low 4, info 0,
  capped at 100. Grades: A ≤ 10, B ≤ 30, C ≤ 55, D ≤ 75, E above 75.
- Every finding carries a `ruleId`, a `severity` and `evidence` strings. Quote the evidence;
  never upgrade a rule into a claim the evidence does not support.
- `limits` is part of the answer. Say what was not covered: only the first DEX, native signature
  digests not cryptographically verified, packed code that hides its real imports, and so on.
- No CVE lookup, no malware-family naming and no signature verification of Android certificates.
  If the user needs any of those, say the report does not cover it.

## Boundaries

- A low score means "no rule matched", not "safe". Say it that way.
- Never claim the sample is harmful, cracked, or malicious beyond what a rule reports.
- Do not run the sample, install it, or open it with another program to "confirm" a finding.

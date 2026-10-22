# Frostbreak — static triage for unknown binaries

This machine has Frostbreak installed. It reads a file's bytes locally and reports what the file
*contains*. Nothing is executed, uploaded, repacked or resigned.

## Reach for it when

- The nature of a file is the question: "what is this APK / IPA / .so / .exe / .dylib / .jar / .zip?"
- Something should be judged before anyone opens it — an attachment, a download, a build artefact.
- A package needs a first read: permissions, exported components, signature schemes, entitlements.
- A binary needs symbols, hardening flags, embedded strings or hardcoded credentials.
- A scanner flagged a file and the reason is unclear, or two builds need comparing.

## Tools — prefer these over reading bytes by hand

| Tool | Use |
| --- | --- |
| `triage_binary` | start here: format, risk grade A–E, findings, facts, sections |
| `scan_binary_strings` | printable strings with file offsets, filtered |
| `explain_triage_finding` | what a rule id means and why it carries weight |
| `list_code_symbols` | ELF symtab/dynsym, PE exports, Mach-O `LC_SYMTAB`, merged with imports |
| `disassemble_range` | linear sweep for AArch64 and x86/x86-64 — offsets, not control flow |
| `search_dex_symbols` | classes, method signatures, string pool from a dex or an APK |
| `diff_binaries` | byte-level hunks between two samples |
| `export_triage_report` | markdown or JSON report through the save dialog |

## What it will not do

It reads; it does not run, patch, resign, repack or bypass. No Frida hooks, no keygens, no
decompilation to Java or C, no licence-bypass patches. When a request needs one of those, say so
plainly rather than approximating it with a report.

Samples above 32 MiB or outside the open project go through the host's own file access, not the
plugin's. Reports describe contents, never runtime behaviour.

## Reading a report

`risk.grade` is A (quiet) to E (loud) and the score is capped at 100. Every finding names a
`ruleId` and carries evidence — quote the evidence, not just the grade. `limits` states what the
pass could not cover, so pass that on instead of implying completeness.

The rule catalog, the twelve-page panel and the known limits are in `README.md` next to this file.

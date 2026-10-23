# Bundled skill library (kit 3.0)

The workbench kit's skill tree ships inside this plugin at `agent/skills/`, one directory per
skill, each with its own `SKILL.md`. `plugin.json` declares the single path `agent/skills`, so
every directory with a `SKILL.md` below it is registered with the host automatically — adding a
skill no longer requires touching the manifest.

| Fact | Value |
|---|---|
| Source | `hanshuang-pojia-2.0/resources/seep-kit/Tool/skill/` (kit `VERSION` 1.6.0) |
| Files | 171 |
| Bytes | 2,481,035 |
| Manifest SHA-256 | `a0b03be3040fdd72fc1f05e55f7ad409f3a9787c1a1590ca0e944a9a262e6560` for `agent/docs/skill-library.sha256` (171 per-file hashes) |
| Per-file hashes | `agent/docs/skill-library.sha256` — verify with `cd agent/skills && shasum -a 256 -c ../docs/skill-library.sha256` (171/171 OK) |
| Regression guard | `src/test/skill-library.test.ts` recomputes the manifest and fails on any count, byte or hash drift |

Relative to the upstream tree the following is **not** byte-identical, by design:

* The obsolete top-level `ida-reverse/` (99 lines, the first draft) was removed. `safe-skills/ida-reverse`
  supersedes it: same zero-touch launch flow, plus `scripts/`, the踩坑 log and the full tool list.
* `safe-skills/apk-reverse`, `ida-reverse`, `mcp-js-reverse-playbook`, `radare2`, `reverse-engineering`
  were flattened from `safe-skills/<pack>` to `<pack>` so each skill sits directly under `agent/skills/`.
* Seven POSIX shell scripts were added next to their PowerShell twins (see **Cross-platform scripts**):
  `apk-reverse/scripts/{decode,frida-run,manifest-summary,rebuild-sign-install}.sh`,
  `radare2/scripts/recon.sh`, `ida-reverse/scripts/{start,open}.sh`.
* Three `SKILL.md` files gained a short cross-platform section pointing at the `.sh` variants.

## Inventory

| Directory | Files | Bytes | Role |
|---|---|---|---|
| `apkseep/` | 112 | 1,859,678 | Android end to end: recon, G1–G4 gates, anti-tamper / anti-hook, repack and sign. Carries `scripts/` (55 files: Python tools, Frida probes, smali helpers), `references/`, `evals/`, `evidence/` |
| `softseep/` | 9 | 126,212 | orchestrator: platform + work-type classification (九型范式库) and dispatch; `references/` holds the Windows six-step SOP, patching dictionary, license-validation handbook |
| `client-license-validation-bypass/` | 1 | 31,178 | desktop license / activation / card-key playbook across native, .NET·Mono, Electron·Node, JVM, frozen Python·Go·Rust |
| `apk-reverse/` | 12 | 54,078 | Android reverse pack from upstream `safe-skills`; four `.ps1` + four `.sh` helpers |
| `ida-reverse/` | 5 | 35,675 | IDA Pro zero-touch launch and the MCP analysis chain; `start` / `open` in both script flavours |
| `radare2/` | 4 | 14,469 | radare2 / rabin2 workflow notes and the standard recon script |
| `mcp-js-reverse-playbook/` | 13 | 7,876 | JavaScript / Electron reverse playbook |
| `reverse-engineering/` | 15 | 351,869 | general reverse-engineering technique pack |
| `hanshuang-pojia/` | 2 | 129,061 | the plugin's own skill: kernel rule, tool table, doc routing |

Per-directory totals are for orientation only; the authoritative list is
`agent/docs/skill-library.sha256` (one hash per file, 171 lines).

Licenses stay as the upstream files declare them: MIT for `apkseep`, `softseep` and the five
`safe-skills` packs, GPL-3.0 for `ida-reverse`.

## Registration and visibility

`plugin.json` uses one path, `agent/skills`, and the host registers every `SKILL.md` below it
(`resource-patterns.ts` matches on the file name). Visibility is explicit, because the host hides
plugin-provided skills by default (`isSkillVisibleOnSurface`: `pluginProvided ? "hidden" : "visible"`):

```json
"skillPresentation": {
  "defaultVisibility": "visible",
  "surfaces": { "skillPicker": "visible", "commandPalette": "visible", "abilityCatalog": "visible", "agentConfiguration": "visible", "pluginDetail": "visible" },
  "skills": { "apkseep": { "displayName": "%skill.apkseep.name%", "displayDescription": "%skill.apkseep.description%" }, ... }
}
```

Registration takes effect on `activate()`, which re-runs after install or upgrade, so no restart is
needed. `agent.skills.control` is already in the plugin's permission list.

## Cross-platform scripts

Every high-frequency flow exists twice: PowerShell for Windows, POSIX shell for macOS and Linux.
Both variants print the same `key=value` summary, so the agent parses one shape on every platform.

| Purpose | Windows | macOS / Linux | Output contract |
|---|---|---|---|
| Decode APK (jadx + apktool) | `apk-reverse/scripts/decode.ps1` | `decode.sh` | `task_root=`, `package=`, `java_files=`, `smali_dirs=`, `so_files=`, `xml_files=`, `*_exit_code=` |
| Frida device / process / inject | `frida-run.ps1` | `frida-run.sh` | `id<TAB>type<TAB>name`, `pid<TAB>name`, or a live frida session |
| Rebuild, align, sign, install | `rebuild-sign-install.ps1` | `rebuild-sign-install.sh` | `unsigned_apk=`, `aligned_apk=`, `signed_apk=`, `keystore=`, `install_device=` |
| Manifest summary | `manifest-summary.ps1` | `manifest-summary.sh` | `package=`, `permission_count=`, `permission=`, `activity=…\texported\tenabled`, `main_activity=` |
| radare2 reconnaissance | `radare2/scripts/recon.ps1` | `recon.sh` | sectioned `=== 基本信息 ===` … plus `目标文件:` |
| Start IDA MCP server | `ida-reverse/scripts/start.ps1` | `start.sh` | `OK:<tool count>` / `ERR:idalib-mcp_not_found` / `ERR:IDADIR_not_found` / `ERR:timeout` |
| Open binary in IDA | `open.ps1` | `open.sh` | `OK:<file>:<session>[ (temp copy)]` / `INFO:opening:<n>/<timeout>s` / `ERR:…` |

The shell variants add two behaviours the PowerShell ones get from .NET:

* `start.sh` also sets `DYLD_FALLBACK_LIBRARY_PATH` on macOS so IDA's bundled runtime resolves.
* `open.sh` treats `/System`, `/usr/lib`, `/usr/bin`, `/bin`, `/sbin` targets as "copy to `$TMPDIR/nx-ida`
  first", which is the macOS/Linux equivalent of the Windows `System32` special case, and it fails fast
  with `ERR:bridge_unreachable` instead of idling for the full timeout when the bridge is down.

## How to load a skill

From the plugin root, read the `SKILL.md` first, then only the `references/` file the task needs:

```
agent/skills/softseep/SKILL.md          → routing table into references/*
agent/skills/apkseep/SKILL.md           → G1–G4 gates; scripts/ are runnable as-is
agent/skills/ida-reverse/SKILL.md       → IDA Pro launch + MCP chain
agent/skills/client-license-validation-bypass/SKILL.md
agent/skills/<pack>/SKILL.md            → apk-reverse, radare2, mcp-js-reverse-playbook, reverse-engineering
```

`apkseep/scripts/*.py` are ordinary Python 3 scripts (16 KB–72 KB each: `repack.py`,
`vmp_diff_harness.py`, `so_constpatch.py`, `capabilities.py`, …). They expect the usual Android
tooling on `PATH` (`jadx`, `apktool`, `adb`) and the `seep` MCP tools when a step needs radare2.

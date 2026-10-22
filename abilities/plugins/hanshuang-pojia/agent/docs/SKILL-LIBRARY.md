# Bundled skill library (kit 2.1)

The workbench kit's skill tree ships inside this plugin, byte-for-byte, at
`agent/docs/skill-library/`. Nothing in it was edited, rewritten or trimmed.

| Fact | Value |
|---|---|
| Source | `hanshuang-pojia-2.0/resources/seep-kit/Tool/skill/` (kit `VERSION` 1.6.0) |
| Files | 165 |
| Bytes | 2,450,341 |
| Manifest SHA-256 | `9527d6b7a46af565911c4d861ca93154b3a6c30509891b813da1f936fefaaff9` for `agent/docs/skill-library.sha256` (165 per-file hashes) |
| Per-file hashes | `agent/docs/skill-library.sha256` — verify with `cd agent/docs/skill-library && shasum -a 256 -c ../skill-library.sha256` (165/165 OK) |
| Regression guard | `src/test/skill-library.test.ts` recomputes the manifest and fails on any count, byte or hash drift |

## Inventory

| Directory | Files | Bytes | Role |
|---|---|---|---|
| `apkseep/` | 112 | 1,859,678 | Android end to end: recon, G1–G4 gates, anti-tamper / anti-hook, repack and sign. Carries `scripts/` (55 files: Python tools, Frida probes, smali helpers), `references/`, `evals/`, `evidence/` |
| `softseep/` | 9 | 126,212 | orchestrator: platform + work-type classification (九型范式库) and dispatch; `references/` holds the Windows six-step SOP, patching dictionary, license-validation handbook |
| `safe-skills/` | 42 | 429,060 | five upstream technique packs: `apk-reverse`, `ida-reverse`, `mcp-js-reverse-playbook`, `radare2`, `reverse-engineering` |
| `client-license-validation-bypass/` | 1 | 31,178 | desktop license / activation / card-key playbook across native, .NET·Mono, Electron·Node, JVM, frozen Python·Go·Rust |
| `ida-reverse/` | 1 | 4,213 | IDA Pro zero-touch launch and the MCP analysis chain |

Licenses stay as the upstream files declare them: MIT for `apkseep`, `softseep` and `safe-skills`,
GPL-3.0 for `ida-reverse`.

## Why these are not registered in `plugin.json` `agent.skillPaths`

Three hard constraints, all verified against the host loader and the repo's manifest test — none of
them is a size problem:

1. **Frontmatter shape.** `safe-skills/*` and `ida-reverse` use YAML block scalars (`|`, `>-`) and
   `softseep` uses a plain scalar containing `": "`. The plugin manifest test
   (`src/test/skill-manifest.test.ts`) replicates the host's line-based rule set, which rejects both.
   Editing those nine frontmatters is the only fix — and that would mean editing upstream skill docs.
2. **Description ceiling.** `softseep`'s description runs past the host's 1024-character cap, so it
   would be reported and truncated.
3. **Name collision.** `ida-reverse` exists twice (top level and `safe-skills/ida-reverse`); the host
   keeps the first and drops the second with a collision diagnostic.

So the library is vendored as **payload**, not as nine registered skills: the agent reads it by path
from the routing table in `PART V.6`, exactly the way `softseep` itself loads its own `references/`.
That keeps the skill list and the per-turn prompt unchanged while making every file available offline.

If you do want them as first-class skills (with their trigger descriptions in the skill list), the
cheap route is a thin wrapper `SKILL.md` per skill that passes the frontmatter contract and points at
the vendored directory — say so and it is a mechanical change.

## How to load a skill

From the plugin root, read the `SKILL.md` first, then only the `references/` file the task needs:

```
agent/docs/skill-library/softseep/SKILL.md          → routing table into references/*
agent/docs/skill-library/apkseep/SKILL.md           → G1–G4 gates; scripts/ are runnable as-is
agent/docs/skill-library/ida-reverse/SKILL.md       → IDA Pro launch + MCP chain
agent/docs/skill-library/client-license-validation-bypass/SKILL.md
agent/docs/skill-library/safe-skills/<pack>/SKILL.md
```

`apkseep/scripts/*.py` are ordinary Python 3 scripts (16 KB–72 KB each: `repack.py`,
`vmp_diff_harness.py`, `so_constpatch.py`, `capabilities.py`, …). They expect the usual Android
tooling on `PATH` (`jadx`, `apktool`, `adb`) and the `seep` MCP tools when a step needs radare2.

# Using this package in other hosts

The content is three plain things: ten skill folders, ten command templates, one hook. Nothing here is tied to Astravia. Any host that reads Markdown skills can use the playbooks; this page only says where each host expects the files.

```text
SKILL.md              entry: governing principle + routing table + alias map
references/skills/    the ten playbooks, each a folder with its own SKILL.md
commands/             ten slash-command templates (hosts that have slash commands)
agents/               two role briefs
hooks/                SessionStart injection (hooks.json + session-start)
```

## Copy it with the script

```bash
node scripts/install-platforms.mjs --list                        # detect hosts, print paths
node scripts/install-platforms.mjs --target codex                # copy to ~/.codex/skills/qiushi-skill
node scripts/install-platforms.mjs --target opencode --scope project
node scripts/install-platforms.mjs --uninstall --target codex
node scripts/install-platforms.mjs --target all --dry-run        # print the plan, write nothing
```

| `--target` | what gets copied | user-level root |
|---|---|---|
| `claude-code` | entry, skills, commands, agents, hooks | `~/.claude/plugins/qiushi-skill` |
| `cursor` | entry, skills, commands, agents, hooks | `~/.cursor/plugins/qiushi-skill` |
| `codex` | entry, skills, commands | `~/.codex/skills/qiushi-skill`, or `$CODEX_HOME/skills/qiushi-skill` when that variable is set |
| `opencode` | entry, skills, commands | `~/.config/opencode/skills/qiushi-skill` + `~/.config/opencode/commands` |
| `openclaw` | entry, skills | `~/.openclaw/skills/qiushi-skill` |
| `hermes` | entry, skills | `~/.hermes/skills/qiushi-skill` |
| `nanobot` | entry, skills | `~/.nanobot/workspace/skills/qiushi-skill` |
| `astravia` | entry, skills, commands | `~/.astravia/skills/qiushi-skill` (usually unnecessary: the market already does this) |

`--scope project` writes under the current directory instead (`.claude/`, `.cursor/`, `.codex/`, `.opencode/`, `.hermes/`, `.nanobot/`, `skills/`).

Every target also carries `references/cases/` — one third-party case study plus its provenance note. It is reading material for citation, not a playbook, so it does not add a panel entry anywhere.

Every write is recorded in `.qiushi-skill-install.json` inside the target root. Two consequences worth knowing before you run it:

- **It will not overwrite what it did not write.** A file that already exists and is not in the ledger is left alone with a `keep` line; `--force` is the explicit override.
- **Uninstall removes only its own entries**, then the ledger. Nothing else in that directory is touched.

Copying the ten playbooks means a host that walks skill folders recursively (Astravia included) will see ten skills unless it also reads `references/skills/.ignore` — the file travels with the copy, and the rule `*/SKILL.md` is what keeps the panel at one entry.

## Per-host notes

- **Claude Code** — the copy carries `.claude-plugin/marketplace.json`, which is what makes the folder installable rather than merely present. After copying, the script prints the two commands to run inside Claude Code: `/plugin marketplace add <installed folder>`, then `/plugin install qiushi-skill@qiushi-skill`. The bundle also carries `hooks/hooks.json`, so the SessionStart injection is native: the entry text is in context before your first turn. Commands in `commands/` become slash commands.
- **Cursor** — same bundle layout, own plugin directory. If you point Cursor at a custom plugin folder, use `--dest`.
- **Codex** — reads skills recursively, so the copied folder is found as one group. If `CODEX_HOME` is set, the copy goes to `$CODEX_HOME/skills/qiushi-skill` instead of `~/.codex/skills/qiushi-skill` — the same choice Codex itself makes. Hooks are **not** read from a skill folder: Codex takes them from `hooks.json` beside its config, so copy `hooks/hooks.json` there yourself if you want the injection, and fix the `${CLAUDE_PLUGIN_ROOT}` path to the installed folder.
- **OpenCode** — skills plus Markdown commands; commands land in the shared `commands/` directory and are recorded in a ledger there.
- **OpenClaw / Hermes / nanobot** — skills only. Hermes needs an `external_dirs` entry in its config before a project-scope copy is scanned.

## Without Node.js

Copy the folder by hand:

```bash
cp -R references/skills/* <host skills dir>/
cp -R commands/*         <host commands dir>/      # only if the host has slash commands
```

Keep `references/skills/.ignore` in place if the host walks `SKILL.md` recursively and you want a single entry.

## About the hook

`hooks/hooks.json` declares one `SessionStart` hook matching `startup|clear|compact`. It runs `hooks/run-hook.cmd session-start`, which reads `SKILL.md` from the package root and prints it as `additional_context` (or `hookSpecificOutput.additionalContext` under Claude Code).

- On Windows the `.cmd` shim prefers `session-start.ps1` via `pwsh`, falls back to `powershell`, then to `bash`/`sh`. No Git Bash or WSL required.
- The injected text is the entry, not the ten playbooks. It defines the routing table and the discipline; the playbooks are read on demand.
- `hooks/run-hook.cmd` and `hooks/session-start` are shipped executable (`0755`). After a manual copy on a POSIX system, `chmod +x` them if your copy dropped the mode.

## Nothing here phones home

No `npx`, no package registry, no GitHub API. The script copies files it already has, records what it copied, and exits. The upstream `bin/` installer is not part of this package because it resolves both an npm package name and a GitHub coordinate, and neither exists here.

# Kali Linux

A skill that gives the agent a real Kali Linux environment on the user's own machine — provisioned per operating system, driven by one CLI, bounded by guardrails that refuse to guess, and carrying a full engagement methodology: **16 scenario playbooks, 14 category guides and 270 per-tool references**.

## What it does

Two halves.

**The runtime.** `scripts/kali.sh` (macOS/Linux) and `scripts/kali.ps1` (Windows) wrap a Kali environment and expose nine operations:

| Command | Purpose |
| --- | --- |
| `status` | report backend, readiness, image and Kali version (`key=value`, always exit 0) |
| `doctor` | the same checks as `[PASS]`/`[WARN]`/`[FAIL]` lines, ending in `READY` or `NOT READY` (exit 1); never installs, starts or audits |
| `install` | provision Kali for this OS; idempotent, never duplicates work |
| `run "<cmd>"` | execute one command inside Kali, streaming output, with a timeout |
| `script` | execute a multi-line script from stdin |
| `ensure <tool…>` | apt-install tools, skipping what is already present (`--profile headless` for the full set) |
| `tools` | show which key tools are installed |
| `stop` / `reset` | stop the runtime, or destroy it (container deleted, WSL distribution unregistered) |

**The methodology.** `references/playbooks/` holds one workflow per scenario — internal network, external attack surface, web application, API security, Active Directory, password audit, wireless, cloud-native, mobile, RFID/NFC, VoIP/ICS, post-exploitation, forensics triage, source-code audit, internal network protocols, and reporting. Each playbook names its phases, stopping points, risk gates and expected artifacts, and hands off to the others when a signal appears. Under them sit 14 category guides (Golden Path + decision tree for picking a tool) and 270 per-tool references (parameters, examples, output handling). `references/environment/state-files.md` defines the nine state files that keep a multi-session engagement from depending on chat memory.

The four-layer reading order is in [SKILL.md](SKILL.md): playbook index → playbook → category guide → the one tool document you are about to run.

Backends, chosen automatically:

- **Windows** — the official `kali-linux` WSL2 distribution (`wsl --install --distribution kali-linux`).
- **macOS / non-Kali Linux** — the official `kalilinux/kali-rolling` container, with colima started for you when Homebrew is present.
- **Kali itself** — commands run natively.
- **A remote Kali** — set `KALI_SSH=user@host` and commands run over ssh (key auth only).

## Quick start

```bash
sh scripts/kali.sh status            # is a Kali runtime present?
sh scripts/kali.sh install           # provision when it is not
sh scripts/kali.sh ensure nmap       # install just the tool this task needs
sh scripts/kali.sh run "nmap -sV -Pn -oN /work/scan.txt 192.168.64.7"
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts\kali.ps1 status
powershell -ExecutionPolicy Bypass -File scripts\kali.ps1 install
```

`status` is safe to call any time: it only reports, and it exits 0 even when nothing is installed. Its `hint=` line names the missing step.

## Safety posture

1. **The driver does not classify targets or filter commands.** There is no exit-78 gate and no destructive-pattern denylist. Scope and destructive operations are decided in the conversation with the user before the command is written. See [references/safety.md](references/safety.md) for the standard to reason with.
2. **No isolation is implied.** The container confines writes to `/work` and an apt cache volume; the native backend is the user's own machine, and a mistake there has no undo. Say which backend you are on before a destructive command.
3. **Everything is audited** to `~/.astravia-kali/audit.log` with UTC timestamps, backend and exit code.
4. **The container only sees the current working directory** (mounted at `/work`) plus a private apt cache. Nothing is uploaded.

Read [references/safety.md](references/safety.md) before running anything that touches another system.

## Environment variables

| Variable | Default | Meaning |
| --- | --- | --- |
| `KALI_BACKEND` | auto | force `docker`, `wsl`, `native` or `ssh` |
| `KALI_SSH` | — | `user@host` for the ssh backend |
| `KALI_IMAGE` | `kalilinux/kali-rolling:latest` | container image |
| `KALI_CONTAINER` | `astravia-kali` | container name |
| `KALI_WORKDIR` | current directory | host directory mounted at `/work` |
| `KALI_STATE_DIR` | `~/.astravia-kali` | audit log and driver state |
| `KALI_TIMEOUT` | `300` | per-command timeout in seconds |

## What it deliberately does not do

- Interactive tooling: there is no TTY, so `msfconsole` and `sqlmap` are driven in batch mode (`-x`, `--batch`). See [references/runbook.md](references/runbook.md).
- Wireless and USB work: the container cannot see those devices; use a VM and point the skill at it.
- Install Kali packages onto a user's own Linux distribution behind their back.
- Persist anything between `reset` and the next install: the container is disposable by design.

## Layout

```
ability.json            identity and detail wiring
SKILL.md                instructions for the agent (four-layer reading order)
detail.json             marketplace detail page (en)
detail.zh.json          marketplace detail page (zh)
README.md               this file
README.zh.md            Chinese README
NOTICE.md               attribution: Kali artwork, upstream reference library
LICENSE-Apache-2.0.md   license of the derived reference library
scripts/kali.sh         POSIX driver: docker / native / ssh backends
scripts/kali.ps1        Windows driver: WSL2 backend
references/install.md   per-OS install, verification, troubleshooting, removal
references/runbook.md   non-interactive command patterns per tool family
references/safety.md    no-gate rationale, backend reach, audit log, legal notes
references/examples.md  four worked round trips, including the out-of-scope one
references/playbooks/   16 scenario workflows + decision tree + handoff map
references/environment/ backend capability table, state-file formats, upstream notes
references/<category>/  14 category guides and 270 per-tool references
assets/                 official Kali dragon icon
```

## Attribution

The card icon and composer icon are rendered from the official Kali dragon artwork published at <https://www.kali.org/images/kali-dragon-icon.svg>. Kali Linux is a project of OffSec; the dragon mark belongs to them and is used here only to identify the product this skill drives. See [NOTICE.md](NOTICE.md).

The playbooks, category guides and tool references are derived from the Apache-2.0 licensed [x-glacier/kali-pentest](https://github.com/x-glacier/kali-pentest) project and adapted to this skill's single-command execution model; the modifications are listed in [NOTICE.md](NOTICE.md) and the license text is in [LICENSE-Apache-2.0.md](LICENSE-Apache-2.0.md).

The skill's own scripts and documentation are MIT-licensed, like the rest of this marketplace.


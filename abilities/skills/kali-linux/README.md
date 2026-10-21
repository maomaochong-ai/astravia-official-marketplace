# Kali Linux

A skill that gives the agent a real Kali Linux environment on the user's own machine — provisioned per operating system, driven by one CLI, and bounded by guardrails that refuse to guess.

## What it does

`scripts/kali.sh` (macOS/Linux) and `scripts/kali.ps1` (Windows) wrap a Kali runtime and expose six operations:

| Command | Purpose |
| --- | --- |
| `status` | report backend, readiness, image and Kali version (`key=value`, always exit 0) |
| `install` | provision Kali for this OS; idempotent, never duplicates work |
| `run "<cmd>"` | execute one command inside Kali, streaming output, with a timeout |
| `script` | execute a multi-line script from stdin |
| `ensure <tool…>` | apt-install tools, skipping what is already present (`--profile headless` for the full set) |
| `tools` | show which key tools are installed |
| `stop` / `reset` | stop the container, or delete it |

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

## Guardrails

1. **Targets outside private ranges need an explicit authorization.** IPv4 literals that are not loopback / RFC1918 / link-local, and IPv6 addresses outside `fc00::/7`, are refused with exit code 78 until the user states they are authorized and the command carries `KALI_AUTHORIZED_HOSTS=<host>`.
2. **Destructive patterns are refused** — `rm -rf /`, `mkfs`, `dd of=/dev/…`, fork bombs, `wipefs`, `fdisk /dev/…`, `shutdown`/`reboot`, `curl … | sh` — unless `KALI_ALLOW_DESTRUCTIVE=1` is set deliberately.
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
| `KALI_AUTHORIZED_HOSTS` | — | space-separated hosts the user authorized |
| `KALI_TARGET_AUTH` | `0` | `1` disables the target check for one command |
| `KALI_ALLOW_DESTRUCTIVE` | `0` | `1` disables the destructive denylist |

## What it deliberately does not do

- Interactive tooling: there is no TTY, so `msfconsole` and `sqlmap` are driven in batch mode (`-x`, `--batch`). See [references/runbook.md](references/runbook.md).
- Wireless and USB work: the container cannot see those devices; use a VM and point the skill at it.
- Install Kali packages onto a user's own Linux distribution behind their back.
- Persist anything between `reset` and the next install: the container is disposable by design.

## Layout

```
ability.json          identity and detail wiring
SKILL.md              instructions for the agent
detail.json           marketplace detail page (en)
detail.zh.json        marketplace detail page (zh)
README.md             this file
README.zh.md          Chinese README
scripts/kali.sh       POSIX driver: docker / native / ssh backends
scripts/kali.ps1      Windows driver: WSL2 backend
references/install.md per-OS install, verification, troubleshooting, removal
references/runbook.md non-interactive command patterns per tool family
references/safety.md  authorization model, denylist, audit log, legal notes
assets/               official Kali dragon icon
```

## Attribution

The card icon and composer icon are rendered from the official Kali dragon artwork published at <https://www.kali.org/images/kali-dragon-icon.svg>. Kali Linux is a project of OffSec; the dragon mark belongs to them and is used here only to identify the product this skill drives. See [NOTICE.md](NOTICE.md).

The skill's own scripts and documentation are MIT-licensed, like the rest of this marketplace.

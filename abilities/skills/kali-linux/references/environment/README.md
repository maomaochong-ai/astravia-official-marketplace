# Execution Environments

This directory was inherited from the upstream `kali-pentest` skill, where the agent had to assemble a Kali environment by hand (`ssh`, `docker run`, `docker exec`). **In this skill that work is already done** — `scripts/kali.sh` detects the backend, provisions it, wraps every command, enforces the guardrails and writes the audit log. `install` and `doctor` are the entry points, and `references/install.md` covers what gets installed per platform.

Read the documents here for the *constraints* of each backend, not for setup commands. Where an upstream document says `docker exec astravia-kali <cmd>` or `ssh user@host "<cmd>"`, the command in this skill is:

```bash
sh "$SKILL/scripts/kali.sh" run "<cmd>"
```

## Documents

- `state-files.md` — state directory naming, summary file formats, and raw output conventions. **Read this one.** It is the part of the upstream design this skill keeps verbatim.
- `server-mode.md` / `local-mode.md` / `docker-mode.md` / `docker-mode-persistent-container.md` / `docker-mode-networking.md` — upstream notes on manual SSH and Docker practice: raw-socket behaviour, Docker Desktop limitations, reachability and routing problems, metapackages and wordlists. Still useful when a tool misbehaves for network reasons. The setup steps in them are superseded by `scripts/kali.sh`.

## Backend Capability Comparison

| Capability | Linux (native Kali) | SSH to a Kali box | Docker / WSL2 |
|-----------|--------------------|-------------------|----------------|
| Raw sockets | Yes | Yes | Limited (needs `--privileged` or `NET_RAW`) |
| GPU cracking | Depends on host | Yes | Requires GPU passthrough setup |
| Wireless adapters | Depends on host | Yes | Not supported (Docker Desktop / WSL2) |
| System services | Yes (systemd) | Yes | Manual process management |
| Same-LAN visibility | Yes | Yes | Requires `--network host` |
| Database backends | Yes | Yes | Must install and start manually |
| Portability | Tied to host | Tied to host/VM | Highly portable across hosts |
| Isolation | Host-level | VM-level | Container-level |

## Selection Rule

`kali.sh` picks a backend, and `status` tells you which one you got. Do not fight it: if the work needs raw sockets, wireless hardware, GPU cracking, system services or a database backend and `status` reports `backend=docker`, say what is missing and let the user decide whether to point the skill at a Kali host (`KALI_BACKEND=ssh` + `KALI_SSH`) instead of running a tool that cannot work there.

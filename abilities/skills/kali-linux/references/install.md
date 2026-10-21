# Install and troubleshooting

`scripts/kali.sh install` (or `scripts/kali.ps1 install` on Windows) is the only installer. It is idempotent: it detects what is already present and only does the missing steps. This page explains what each step touches, so you can tell the user exactly what they are agreeing to.

## What gets installed, per platform

| Platform | Backend | What the installer creates | Rough download |
| --- | --- | --- | --- |
| Windows 10 2004+ / 11 | `wsl` | the official `kali-linux` WSL2 distribution, registered through `wsl --install --distribution kali-linux` | 300–500 MB |
| macOS (Apple silicon or Intel) | `docker` | Docker CLI + colima through Homebrew when missing, then the image `kalilinux/kali-rolling:latest` | 50 MB image, ~1 GB once colima's VM exists |
| Linux that is not Kali | `docker` | nothing automatic — the installer refuses and asks for Docker to be installed by the user | 50 MB image |
| Linux that is Kali | `native` | nothing; the host already is Kali | — |
| any host, `KALI_SSH=user@host` | `ssh` | nothing; the remote host is used as-is | — |

The rolling image ships **without** the tool metapackage. Tools are installed per task with `kali.sh ensure …`; the full headless set (`ensure --profile headless`) is about 1.5 GB on top.

## Windows (WSL2)

```powershell
# once, in an elevated PowerShell
wsl --install --distribution kali-linux --no-launch
wsl -d kali-linux -u root -- sh -c "apt-get update -qq"

# afterwards, unprivileged
powershell -ExecutionPolicy Bypass -File scripts\kali.ps1 status
powershell -ExecutionPolicy Bypass -File scripts\kali.ps1 ensure nmap
powershell -ExecutionPolicy Bypass -File scripts\kali.ps1 run "nmap -sV 192.168.64.7"
```

`scripts/kali.ps1 install` performs the same steps and stops with the exact commands to run if the session is not elevated. Registering a WSL distribution is a machine-wide change, which is why it needs elevation.

Common failures:

- `WSL 2 requires an update to its kernel component` → install the kernel update package from Microsoft, or run `wsl --update`.
- `0x80370102` / "virtual machine could not be started" → virtualization is disabled in firmware; the user must enable VT-x/AMD-V.
- `The term 'wsl.exe' is not recognized` → WSL optional feature is off: `dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart` then reboot.
- Distribution registers but `status` says `ready=false` → the first launch was never initialized; run `wsl -d kali-linux -u root -- true` once.
- DNS works on Windows but not inside Kali → known WSL networking issue; `wsl --shutdown` and retry, and check `/etc/resolv.conf`.

## macOS

```bash
sh scripts/kali.sh install     # brew install docker colima, colima start, docker pull
sh scripts/kali.sh status
sh scripts/kali.sh run "cat /etc/os-release"
```

The installer prefers colima because it needs no GUI licence prompt. If the user already runs Docker Desktop, the daemon check passes and colima is never touched. Homebrew is required for the automatic path; without it the installer stops and asks for Docker Desktop instead — it will not download a disk image behind the user's back.

Things that behave differently from a native install:

- The container has its own network namespace. `127.0.0.1` inside Kali is the container, **not** the Mac. Reach host services through `host.docker.internal` (add `--add-host` is unnecessary; Docker Desktop and colima both resolve it).
- Raw sockets are limited: `nmap` needs `-sT` for TCP connect scans in some configurations; `-sS` may require `--cap-add=NET_RAW` on the container.
- Wireless interfaces and USB devices are not visible. Use a VM for those.
- Only the current working directory is mounted, at `/work`.

## Linux

On Kali itself the driver runs commands directly (`backend=native`). On any other distribution it uses the container backend and expects Docker to be installed already; installing system packages with `sudo` is deliberately left to the user. For Debian/Ubuntu:

```bash
sudo apt update && sudo apt install -y docker.io
sudo usermod -aG docker "$USER"    # then log out and back in
```

## Verify the install

```bash
sh scripts/kali.sh status                       # ready=true and a kali_version line
sh scripts/kali.sh run "cat /etc/os-release"    # PRETTY_NAME should mention Kali
sh scripts/kali.sh ensure nmap
sh scripts/kali.sh run "nmap --version | head -1"
```

If `status` reports `ready=false`, the `hint=` line names the exact missing step. That line is the first thing to quote when asking the user for help.

## Removing it

```bash
sh scripts/kali.sh reset                 # docker: delete the container, keep the audit log and /work
docker rmi kalilinux/kali-rolling:latest # optional: drop the image (~1 GB with layers)
```

```powershell
wsl --unregister kali-linux              # Windows: destroys the distribution and everything in it
```

`stop` is the soft option — it keeps the container, the tools the user waited for, and the apt cache, so the next `run` is instant. Never `reset` or `unregister` without an explicit request; it throws that work away.

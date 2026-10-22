---
name: kali-linux
version: 0.0.3
description: >-
  Use when the user wants Kali Linux tooling running on their own machine — port and service scans, web application testing, password auditing against a lab they own, packet analysis, forensics, or CTF work — or asks to "use Kali" locally. Provisions a per-OS Kali runtime on demand (Windows: the kali-linux WSL2 distribution; macOS and Linux: the official kalilinux/kali-rolling container) and drives it through scripts/kali.sh, or scripts/kali.ps1 on Windows. Every target outside a private address range needs an explicit authorization from the user first.
metadata:
  astravia:
    presentation:
      icon: assets/icon.png
---

# kali-linux

This skill gives the agent a real Kali Linux environment on this machine and a single CLI to run commands in it. The Kali install is the environment; the skill only supplies detection, provisioning, the command wrapper and the guardrails.

Skill directory below is written as `$SKILL` — the directory this `SKILL.md` lives in.

## Step 1 — Find out what already exists

```bash
sh "$SKILL/scripts/kali.sh" status
```

Windows (PowerShell):

```powershell
powershell -ExecutionPolicy Bypass -File "$SKILL\scripts\kali.ps1" status
```

`status` prints `key=value` lines and always exits 0. Read `ready` first:

- `ready=true` → a Kali runtime already answers. Go to step 3.
- `ready=false` → read `backend` and `hint`, then go to step 2.

When you need a verdict instead of a state dump — anything is failing and you want to know *which* piece — run `doctor` with the same interpreter substitution:

```bash
sh "$SKILL/scripts/kali.sh" doctor
```

It prints one `[PASS]`/`[WARN]`/`[FAIL]` line per check (backend, CLI, daemon or distribution, image, workdir, Kali version, tool coverage, audit log) and ends in `READY` or `NOT READY`, exiting 1 on any `FAIL`. Unlike `status` it never creates or starts anything and writes no audit records, so it is safe to run first.

`backend` is one of `docker` (container), `wsl` (Windows distribution), `native` (this machine *is* Kali), `ssh` (a Kali box the user pointed you at), or `none`.

## Step 2 — Install it when it is missing

```bash
sh "$SKILL/scripts/kali.sh" install
```

This is idempotent and per-OS: on Windows it registers the official `kali-linux` WSL2 distribution; on macOS and Linux it makes sure the Docker CLI exists, starts a container runtime (colima when the user has Homebrew, otherwise it tells you to open Docker Desktop), and pulls `kalilinux/kali-rolling`. Nothing is installed twice.

What it can and cannot do silently:

- macOS: installing the Docker CLI and colima goes through **Homebrew** and downloads a small VM — tell the user before you start it, it takes a few minutes.
- Windows: registering a WSL distribution needs **one elevated PowerShell session**; if the script reports it is not elevated, ask the user to run the printed command in an Administrator window, then re-run `status`.
- Linux that is not Kali: it uses the container path too. Installing Kali packages onto the user's own distro is **not** something this skill does behind their back.

Then re-run `status` until `ready=true`. Read `references/install.md` if a step fails or the user asks what will be installed.

## Step 3 — Run the work

```bash
sh "$SKILL/scripts/kali.sh" run "nmap -sV -Pn 192.168.64.7"
```

- `run` executes through `bash -lc` inside Kali, with the current directory mounted at `/work`, and streams stdout/stderr back. Exit code is Kali's exit code.
- For multi-line work use `script` and feed it on stdin:

```bash
sh "$SKILL/scripts/kali.sh" script <<'EOF'
nmap -sV -oN /work/scan.txt 192.168.64.7
nikto -h http://192.168.64.7:8080 -o /work/nikto.txt
EOF
```

- The rolling image ships **without** the tool metapackage. Install tools as the task needs them:

```bash
sh "$SKILL/scripts/kali.sh" ensure nmap sqlmap gobuster
```

`ensure` maps friendly names to apt packages and skips what is already installed. For the full headless toolset (about 1.5 GB) run `ensure --profile headless` and warn the user about the size and the time.

- Interactive tools must be driven in batch form: `msfconsole -q -x "<commands>; exit"`, `sqlmap --batch`, `john --wordlist=... --format=...`. There is no TTY to type into.
- Long jobs: write output to `/work/<file>` and read the file afterwards. The default per-command timeout is 300 s (`KALI_TIMEOUT` overrides it); raise it deliberately for scans, don't retry blindly.

## Step 4 — Guardrails are not optional

Read `references/safety.md` before the first destructive-sounding request. The short version:

1. **Authorization.** Only point tools at hosts the user owns or is contracted to test. Private ranges (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `fc00::/7`, `*.local`, `localhost`) pass automatically. Anything else is blocked until the user spells out the authorization and you pass it through `KALI_AUTHORIZED_HOSTS=<host>` for that command. **Never** set that variable on your own initiative to get past the check.
2. **Destructive patterns.** `rm -rf /`, `mkfs`, `dd of=/dev/…`, fork bombs, `shutdown`/`reboot`, and piping a download into a shell are refused unless `KALI_ALLOW_DESTRUCTIVE=1` is set deliberately. Do not set it to work around a failure.
3. **Audit.** Every command is appended to `~/.astravia-kali/audit.log` with a timestamp. If the user asks what you ran, read that file — do not reconstruct it from memory.
4. **Scope creep.** Do not pivot from a lab target into a production network because a service looked interesting. Ask.

## Step 5 — Leaving things tidy

`stop` keeps the container and its apt cache, and stops the process. `reset` deletes the container (the audit log and `/work` data stay). Only `stop` when the user says the session is over; never `reset` without being asked — it throws away every tool the user waited for. On Windows `reset` runs `wsl --unregister`, so the distribution and every tool inside it are gone; the audit log lives on the host and survives.

## When something goes wrong

- `ready=false`, `backend=none` after `install` → read `references/install.md`; usually a Docker daemon that was never started, or a Windows session that is not elevated.
- `docker: command not found` on macOS → Homebrew did not run; ask the user to install Homebrew or Docker Desktop.
- Tool missing after `ensure` → the package name differs per suite; check `apt-cache search` through `run` instead of guessing, then record the mapping you used.
- Scan produces nothing → confirm the target is reachable from *inside* Kali (`run "ip route"`), not just from the host; the container sees its own network namespace.
- Wireless/USB tooling → unavailable in the container backend by design. Say so instead of faking it.
## Working with the other skills

Kali finds and demonstrates; the sibling skills are what turn the findings into something the user can hand over. Reach for them by name instead of reinventing their job inside this skill:

- **Reports.** `docx` builds the Word deliverable, `pdf` reads and renders PDFs (scope documents, vendor advisories, the report you just exported), `xlsx` keeps the host and finding inventory in a spreadsheet. Do not hand-roll a .docx or a PDF inside Kali.
- **Web application testing.** `ego-browser` drives a real browser against the same target when the question is what the page *does* (session handling, client-side controls) rather than what the port speaks. Scan with Kali, then reproduce the finding in the browser.
- **Open-source verification.** `zhihu-search` is the way to check Chinese-language public reporting on a product or CVE discussion. It is a research tool, not a scanning one.
- **Cloud surface** (`cloudflare`, `wrangler`, `workers-best-practices`) covers the user's own deployed Workers and configuration. That is authoring and audit space, not a target list; never point Kali at a Cloudflare-hosted third-party.

What does *not* belong here: `codebase-migration-refactor`, `remotion-best-practices` and `tailored-resume-generator` share no ground with a pentest environment. Ignore them even when the conversation drifts toward them.

When a run matters for the deliverable, say what Kali produced and then hand the raw output to the document skill — do not paraphrase evidence into a summary and call it a finding.

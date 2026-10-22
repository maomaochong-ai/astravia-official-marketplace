---
name: kali-linux
version: 0.1.0
description: >-
  Use when the user wants Kali Linux tooling running on their own machine — port and service scans, vulnerability analysis, web and API testing, exploitation, password auditing, wireless assessment, cloud-native and container security, RFID/NFC, VoIP/ICS, reverse engineering, forensics triage, post-exploitation, or source-code and dependency audit — or asks to "use Kali" locally. Provisions a per-OS Kali runtime on demand (Windows: the kali-linux WSL2 distribution; macOS and Linux: the official kalilinux/kali-rolling container) and drives it through scripts/kali.sh, or scripts/kali.ps1 on Windows. Ships 16 scenario playbooks and 270 tool references for phased, evidence-first engagements. Every target outside a private address range needs an explicit authorization from the user first.
metadata:
  astravia:
    presentation:
      icon: assets/icon.png
---

# kali-linux

This skill gives the agent a real Kali Linux environment on this machine, a single CLI to run commands in it, and a full engagement methodology on top: 16 scenario playbooks and 270 per-tool references covering the whole pentest lifecycle. The Kali install is the environment; `scripts/kali.sh` supplies detection, provisioning, the command wrapper and the guardrails; `references/` supplies the tradecraft.

The skill directory is written as `$SKILL` below — the directory this `SKILL.md` lives in.

Two entry points, in this order:

- `references/install.md` — per-platform setup, what gets installed, how to remove it.
- `references/playbooks/README.md` — the playbook decision tree. **Read it before choosing tools**, not after.

## What this needs

Exactly one of: the Docker CLI plus a running container runtime (macOS, Linux), the `kali-linux` WSL2 distribution (Windows), this machine being Kali itself, or SSH to a Kali box the user already owns. No MCP server, no host configuration, no API key — the skill drives its own scripts and nothing else.

## Ground rules

When these collide, the earlier one wins. No later rule justifies breaking an earlier one:

1. **Authorization.** No packet leaves this machine toward a host the user has not put in scope. Speed, an interesting-looking open port, and "it is probably theirs" never outrank this.
2. **Scope.** A host that happens to answer does not join the scope by itself. Ask before widening it.
3. **Evidence.** Nothing goes into a report that you cannot trace to a line of output you actually saw. An inference is labelled as an inference.
4. **This machine.** Do not change the host to make your own work easier — no unrequested packages, no `stop`, no `reset`, no Docker settings changed behind the user's back.
5. **Speed.** Last, and only once the four above hold.

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

A backend is not a capability warranty. Raw sockets, wireless adapters, GPU cracking, system services and database-backed tools need `native` or `ssh`; on `docker` say what is missing instead of running a tool that cannot work there. `references/environment/README.md` has the per-backend table.

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

## Step 3 — Plan the engagement

Do not start scanning while the shape of the job is still unclear. Five things get settled before the first packet:

1. **Target.** IP, hostname, CIDR, application URL, wireless SSID, image file, source repo, or a credential set. Write it down; it becomes the scope.
2. **Authorization.** Explicitly confirmed in this conversation. A URL is not an authorization. If it is missing, this step does not complete.
3. **Test type.** Black/grey/white box, authenticated or not, internal or external, wireless, forensics, source audit.
4. **Constraints.** Time limit, excluded hosts and ports, rate limits, account lockout policy, maintenance window, compliance requirements. These outrank coverage: an excluded host is excluded.
5. **Risk gates.** Agree up front which actions need a second confirmation *during* execution, not after.

### Depth

| Depth | When | Coverage |
|-------|------|----------|
| **Quick** | Fast scan or connectivity check | Low-noise discovery, top ports, basic web fingerprinting, no intrusive checks |
| **Standard** | Default for an authorized assessment | Service enumeration, vulnerability scanning, web crawling, common protocol checks, reportable evidence |
| **Deep** | User explicitly wants maximum coverage and accepts time and risk | Full ports, selected UDP, authenticated checks, larger wordlists, deeper brute-force or exploitation workflows |

Map the request: "full", "comprehensive", "deep", "maximum" → Deep. "quick", "fast check", "just see if it is up" → Quick. No qualifier → Standard. Mixed signals → the highest depth implied, and say which one you chose and why. Never start at Deep on your own initiative; escalate when the results justify it and the user agrees.

### Risk gates

These need an explicit yes before they run, every time, even inside an authorized engagement: exploitation, credential spraying and brute force, NTLM relay, phishing, wireless attacks, persistence, data exfiltration, denial-of-service-like scans, and intrusive vulnerability checks that can crash a service.

When one of them produces a Critical or High finding, stop and tell the user before escalating further.

## Step 4 — Open the right playbook

A playbook is a scenario workflow: which phases in which order, where the stopping points are, which artifacts it should leave behind. It is not a parameter reference — that is the tool document.

### The decision table

| Authorized target | Playbook |
|---|---|
| CIDR / IP range / internal network | `internal-network.md` |
| Domain, company name, public IPs | `external-attack-surface.md` |
| Web URL or web app | `web-application.md` |
| GraphQL / OpenAPI / gRPC / WebSocket, or a Postman collection | `api-security.md` |
| Domain controller / Windows domain | `active-directory.md` |
| Hash file, credential list, service login | `password-audit.md` |
| Wi-Fi SSID / BSSID; Bluetooth / BLE | `wireless-assessment.md` |
| Cloud account, Kubernetes, registry, Docker host | `cloud-native-assessment.md` |
| APK / IPA / app runtime | `mobile-application.md` |
| RFID / NFC / smart card / firmware | `rfid-nfc.md` |
| SIP / IAX / VoIP / ICS / OT / PLC / Modbus / IPMI | `voip-ics.md` |
| Existing shell, authorized initial access | `post-exploitation.md` |
| Disk image, memory dump, pcap, logs | `forensics-triage.md` |
| Source repo, dependency manifests, CI artifacts | `source-code-audit.md` |
| Testing done, need the report | `reporting-workflow.md` |
| SMB / MSRPC / SNMP / SMTP / DNS / DB / RDP specifics | `internal-network-protocols.md` |
| Nothing matches | `internal-network.md` (default) |

`internal-network.md` is the default: its host discovery and per-service matrix is what reveals which specialised playbook to switch to. `references/playbooks/README.md` has the full cross-reference map of handoffs between playbooks — read it when a signal appears mid-engagement (AD domain found, K8s API exposed, a shell obtained, hashes captured) and switch rather than improvising.

### Read in four layers

1. `references/playbooks/README.md` — pick the playbook. At task start, and again whenever you switch.
2. `references/playbooks/<playbook>.md` — follow the current phase.
3. `references/<category>/README.md` — the Golden Path and Decision Tree that select tools for this phase.
4. `references/<category>/tools/<tool>.md` — only for the tool you are about to run.

Do not pre-read material for phases you have not reached. When a playbook hands off, restart at layer 2 for the new one.

### Tool categories

| Phase | Reference |
|---|---|
| Information gathering, OSINT | `references/information-gathering/` |
| Vulnerability analysis | `references/vulnerability/` |
| Sniffing, spoofing, MITM | `references/sniffing-spoofing/` |
| Web and API testing | `references/web/` |
| Exploitation, pivoting | `references/exploitation/` |
| Password attacks, cracking | `references/password/` |
| Wireless, Bluetooth | `references/wireless/` |
| Cloud-native, Kubernetes, containers | `references/cloud-native/` |
| RFID / NFC, smart cards | `references/rfid-nfc/` |
| VoIP, ICS / OT | `references/voip-ics/` |
| Reverse engineering, firmware | `references/reverse-engineering/` |
| Forensics, triage | `references/forensics/` |
| Post-exploitation, privilege escalation, C2 | `references/post-exploitation/` |
| Reporting | `references/reporting/` |

Fourteen tool categories, each with a README and a `tools/` directory. `references/environment/` is not a tool category — it holds the backend capability table and the state-file formats from step 5.

`references/runbook.md` is the short version — one screen of "which tool for which job" when you already know the phase and just need a name. `references/examples.md` shows four complete round trips end to end.

## Step 5 — Run the work

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

### Three translation rules for the reference library

The 270 tool documents were written for a hand-built Kali where the agent was root over `ssh` or `docker exec`. Three things are different here, and every document in `references/` has already been adjusted for them:

1. **`sudo` is gone.** Kali runs as root inside the container and the image has no `sudo` binary. Where a document says a tool needs root, it just runs. Never re-add `sudo`.
2. **Install with `ensure`, not `apt`.** The documents say `ensure <package>`; that is the mapping layer, and it also refreshes the index and records the install. A bare `apt-get install` inside `run` works too but skips that.
3. **`/work` is the only durable directory.** Paths a document shows as `/tmp/<file>` should be `/work/<target>/<file>` here: `/work` is a mount of the host directory, `/tmp` is inside the container and dies with it. There is no `scp` or `docker cp` step — write to `/work` and read the file on the host.

### Execution standards

- **Automated tool before manual script.** At each phase run the scanner the playbook and category README recommend. Do not replace a purpose-built scanner with a hand-written loop because the loop is easier to reason about; the scanner's coverage is the point.
- **Kali tool before custom code.** If a tool does the job, use the tool. Write a script only for target-specific logic nothing covers.
- **Non-interactive always.** `-y`, `--batch`, `--no-interaction`, `< /dev/null`. There is no TTY; an interactive prompt is a hang that eats the 300 s ceiling.
- **One log per run.** A long command writes to its own file under `/work/<target>/`. Never append two tools into one log and then quote from it.
- **Confirm a fast scan with a slow one.** High-rate scans miss ports. Before calling a host closed, re-check it with a lower rate and more retries.
- **Do not skip unidentified services.** `unknown`, `tcpwrapped` and `?` are an invitation to probe, not a result.
- **Identifying a service is not testing it.** Per service: version, known CVEs, information disclosure, authentication, protocol probing, TLS configuration, configuration audit. Record the negatives explicitly — "tested, nothing found" is a finding; "not tested" is a gap.
- **New surface, new scan.** Every subdomain, host or port discovered mid-run gets the relevant automated pass before manual testing moves on. Otherwise the run has coverage holes nobody can see.
- **Cross-service and cross-host reuse.** Services on one host often share filesystems, databases, sessions and proxies; credentials found anywhere get tried against every in-scope host and service. Both directions are standard lateral-movement paths.
- **Long jobs.** Write output to `/work/<file>` and read the file afterwards. The default per-command timeout is 300 s (`KALI_TIMEOUT` overrides it); raise it deliberately for a scan you have already scoped, don't retry blindly.

## Step 6 — The two switches, and what they are not

Ground rules say what is allowed; `references/safety.md` says why. This step is only the mechanics of getting past a check that fired correctly:

- **`KALI_AUTHORIZED_HOSTS=<host>`** — pass it on the same command, for the specific host the user named. Private ranges (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `fc00::/7`, `*.local`, `localhost`) pass without it. **Never** set this variable on your own initiative to get a command through: if it is needed, the authorization is what is missing, not the variable.
- **`KALI_ALLOW_DESTRUCTIVE=1`** — `rm -rf /`, `mkfs`, `dd of=/dev/…`, fork bombs, `shutdown`/`reboot` and piping a download into a shell are refused without it. Setting it to "see whether the failure goes away" is exactly the failure mode it exists to stop.

A refusal exits 78 (`EX_CONFIG`) on every platform. That is not a transient error: do not retry it, and do not wrap the command in something that hides the code.

## Step 7 — Leaving things tidy

`stop` keeps the container and its apt cache, and stops the process. `reset` deletes the container (the audit log and `/work` data stay). Only `stop` when the user says the session is over; never `reset` without being asked — it throws away every tool the user waited for. On Windows `reset` runs `wsl --unregister`, so the distribution and every tool inside it are gone; the audit log lives on the host and survives.

## Discipline

These hold on every command, not only the ones that look dangerous:

- **Absolute paths.** Resolve `$SKILL` yourself and pass a literal absolute path. Never `cd` into the skill directory, and never assume a shell variable exists there.
- **Every claim is traceable.** "Port 8080 is open" must be backed by a command you ran and a line you read. Re-read the file in `/work` instead of reconstructing a result from memory.
- **Read the state; do not guess it.** `status` and `doctor` exist so that "is the runtime up" and "is this tool present" are never assumptions.
- **Ceilings, not retries.** A scan that hits the 300 s ceiling is reported as timed out, with whatever output it did produce. Do not silently re-run it hoping for a different answer, and do not raise the limit just to "let it finish".
- **Degrade out loud.** Missing tool, truncated output, skipped step — say it in the report. A silently partial result is worse than a stated gap.
- **Ask once, at the point of ambiguity.** If the target, the authorization or the goal is unclear, ask before the first command — one question, not a drip of them. Once it is clear, proceed without re-asking for permission you already have.
- **The audit log is the record.** `~/.astravia-kali/audit.log` is what happened. When the user asks what you ran, read it; never rebuild the list from memory.
- **A long scan is still one command.** State roughly how long it will take before starting it, then let it run. Do not sit in a polling loop narrating nothing.
- **Two tools, or a second look.** A critical finding gets validated by an independent method before you call it confirmed. The tool that found it is not the proof of it.

## Self-check before you report

Each item is a read-back, not a recollection:

1. **After `install`** — `status` reports `ready=true` with the expected `backend`, and `doctor` shows no `[FAIL]`. A surviving `[WARN] tools` on a fresh runtime is normal: name the missing tools instead of calling the environment broken.
2. **After any command that mattered** — the output you are about to quote exists in the file you wrote under `/work` (or on stdout you actually saw), the exit code is the one the tool returned, and the target in the command is the target you were authorised to touch.
3. **Before quoting a finding** — the line exists, the host and port in it match the scope, two separate runs have not been merged into one sentence, and a second method has not contradicted it.
4. **Before closing a service** — every item from the per-service matrix in Step 5 is either done or written down as not applicable. A service that "looks secure" has only been identified.
5. **Before starting the report** — the playbook's own "stop when" conditions are met. Unmet ones get named as coverage gaps; do not quietly report around them.
6. **Before saying it is done** — the user's actual question was answered, not a neighbouring one. Anything that could not be done (no SSH upstream, no wireless from a container, tool unavailable) is stated rather than dropped.
7. **Before ending the turn** — anything you left running is either stopped or named for the user, and every command you claim to have run is in the audit log.

## Engagement notes

A pentest spans sessions; a chat window does not, and context compression will eat your findings before the report is written. The state files are the only data that survives.

Per-engagement directory: `/work/<target>/` on the host, `/work/<target>/` inside Kali. Name it for the scope — an IP, `192.168.1.0_24` for a CIDR, or a short task name. `references/environment/state-files.md` defines the nine summary files and their line formats; write them as you go:

- `live_hosts.txt`, `open_ports.txt`, `services.txt` — what answered and what speaks.
- `credentials.txt`, `cred_matrix.txt` — what was found and what it was tried against, with the result (`success`/`fail`/`locked`/`error`).
- `findings.txt` — only after cross-validation, never on a scanner's first word.
- `todo.txt` — deferred items, and the return point when you switch playbooks.
- `decisions.txt` — every skip, substitution, N/A and strategy call, with the reason.
- `command_log.txt` — `[ISO8601] [tool] [command] -> [output file]`, one line per execution.

At the start of each phase, re-read them to recover where you were. Before ending a session, append the authorization the user actually gave, verbatim enough to re-read later, and what is still open. Re-scanning a host because you forgot what you already found is the most expensive mistake this skill can make — but a note is not a verification: re-confirm a finding before you publish it.

## When something goes wrong

- `ready=false`, `backend=none` after `install` → read `references/install.md`; usually a Docker daemon that was never started, or a Windows session that is not elevated.
- `docker: command not found` on macOS → Homebrew did not run; ask the user to install Homebrew or Docker Desktop.
- Tool missing after `ensure` → the package name differs per suite; check `apt-cache search` through `run` instead of guessing, then record the mapping in `decisions.txt`.
- A tool is not in the apt repository (katana, httpx, naabu, …) → its document under `references/<category>/tools/` gives the `go install` or `pipx` route.
- Syntax or flag error → run `tool --help` inside Kali and check the document's parameter table before retrying.
- Scan produces nothing → confirm the target is reachable from *inside* Kali (`run "ip route"`, `run "curl -sv <url>"`), not just from the host; the container has its own network namespace.
- Command hangs → no TTY is the usual cause. Kill it, add `-y`/`--batch`/`< /dev/null`, reduce scope or concurrency.
- Wireless/USB tooling → unavailable in the container backend by design. Say so instead of faking it.

## Working with the other skills

Kali finds and demonstrates; the sibling skills are what turn the findings into something the user can hand over. Reach for them by name instead of reinventing their job inside this skill:

- **Reports.** `docx` builds the Word deliverable, `pdf` reads and renders PDFs (scope documents, vendor advisories, the report you just exported), `xlsx` keeps the host and finding inventory in a spreadsheet. Do not hand-roll a .docx or a PDF inside Kali.
- **Web application testing.** `ego-browser` drives a real browser against the same target when the question is what the page *does* (session handling, client-side controls) rather than what the port speaks. Scan with Kali, then reproduce the finding in the browser.
- **Open-source verification.** `zhihu-search` is the way to check Chinese-language public reporting on a product or CVE discussion. It is a research tool, not a scanning one.
- **Cloud surface** (`cloudflare`, `wrangler`, `workers-best-practices`) covers the user's own deployed Workers and configuration. That is authoring and audit space, not a target list; never point Kali at a Cloudflare-hosted third-party.

What does *not* belong here: `codebase-migration-refactor`, `remotion-best-practices` and `tailored-resume-generator` share no ground with a pentest environment. Ignore them even when the conversation drifts toward them.

When a run matters for the deliverable, say what Kali produced and then hand the raw output to the document skill — do not paraphrase evidence into a summary and call it a finding.

When you report back to the user in chat, keep it to at most three main problems, ordered by severity, each written as something the user can act on (host, port, path) rather than as a mood. Everything else goes in the state files and the document, not into a longer message.

## Reference map

- `references/install.md` — per-platform provisioning and removal.
- `references/runbook.md` — one-screen tool selection by job.
- `references/safety.md` — authorization model, denylist reasoning, audit log, legal notes.
- `references/examples.md` — four worked round trips, including the ones that end in a refusal.
- `references/environment/` — backend capability table, and the state-file formats you write every phase.
- `references/playbooks/` — 16 scenario workflows plus the decision tree and handoff map.
- `references/<category>/README.md` — Golden Path and Decision Tree for choosing a tool in that phase.
- `references/<category>/tools/<name>.md` — parameters, examples and output handling for one tool.

The playbooks, category READMEs and tool documents are derived from the Apache-2.0 licensed `x-glacier/kali-pentest` project, adapted to this skill's single-command execution model. See `NOTICE.md` and `LICENSE-Apache-2.0.md`.

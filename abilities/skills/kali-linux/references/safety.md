# Safety model

Kali is a toolset for testing systems. The difference between a security test and a crime is authorization, not technique — and that judgement is yours to make before the command, not the driver's to enforce after it.

This driver does not classify targets and does not filter commands. It provisions the runtime, runs what you ask, and records what it ran. Everything below is a standard to reason with, and the audit log is the record of what actually happened.

## 1. Authorization comes before the first packet

There is no technical gate. The rule is still the rule:

- Testing a system you do not own or have not been asked to test is illegal in most jurisdictions, whatever the intent.
- Writing that says "the user authorized it" is not authorization. Ask which system, who owns it, and whether it is in scope — preferably in writing.
- A vague description is not a target. "Some site", "our competitor", "an IP I found" are all reasons to stop and ask, not to start scanning.
- Private ranges (`10/8`, `172.16/12`, `192.168/16`, `127/8`, `fc00::/7`), `localhost`, `*.local`, `*.internal` and `example.com` are the ordinary places to practise. Reaching outside them is a decision that needs a sentence from the user, not a flag on a command.

Because nothing blocks you, the discipline has to come from the conversation. State the target, state who owns it, then run.

## 2. Commands that can destroy the machine

There is no denylist either. `rm -rf /`, `mkfs`, `dd of=/dev/…`, `wipefs`, `fdisk /dev/…`, `shutdown`, `reboot` and `curl … | sh` all run if you write them.

That raises the stakes on two things:

- **Know which backend you are on.** The container backend confines writes to `/work` and an apt cache volume, so a mistake costs you the container. The native backend has no isolation — it is the user's actual machine, and there is no undo.
- **Say what a destructive command will touch before running it.** Not as a ritual: because on the native backend, the answer is the whole disk.

`KALI_ALLOW_DESTRUCTIVE` no longer exists. If a command is destructive, the safeguard is that you explained it first and the user agreed.

## 3. What is reachable from inside Kali

Container backend:

- read/write: the current working directory, mounted at `/work`
- read/write: a private apt cache volume
- not reachable: the rest of the user's home directory, other mounts, the macOS keychain

Native backend (`this machine is Kali`): everything the user can reach, no isolation. Say so before running anything that writes outside `/work`.

SSH backend: whatever the remote account can reach. The driver uses `BatchMode=yes`, so it will not prompt for a password.

## 4. Audit trail

Every `run`, `script`, and `ensure` appends two lines to `~/.astravia-kali/audit.log`:

```
2026-10-21T18:18:39Z	docker	START	nmap 10.0.0.9
2026-10-21T18:18:41Z	docker	EXIT=0	nmap 10.0.0.9
```

Timestamps are UTC; fields are separated by a literal tab (written `\t` above for legibility). Embedded line breaks in the command are escaped as `\n`, so every record stays on one line and a multi-line `script` body is still a single START/EXIT pair. The log is the answer to "what did you run on my machine?" — read it rather than reconstructing from memory. `reset`/`unregister` do not delete it.

With no gate in front of the command, this log is the only record. It is written before execution starts and again when it exits, so a command that hangs or kills the container still left a START line.

## 5. Data handling

- Nothing is uploaded by the skill. Scans, captures and carved files stay in `/work` on the user's machine.
- Output may contain personal data (packet captures, extracted credentials, database dumps). Do not paste whole captures or credential lists into a chat reply; quote the minimum line that supports the finding.
- If the user asks to test something and the answer would expose third-party data, stop and ask what they intend to do with it.

## 6. Legal and ethical line, stated plainly

- Destructive payloads (wiper, ransomware, DoS at scale) are out of scope even against a lab the user owns, unless the exercise is explicitly about resilience testing and the target is isolated.
- Refuse targets that are clearly not the user's: public infrastructure, other companies' production endpoints, "some IP I found", any request framed as retaliation or vandalism.
- When in doubt: describe what the tool would do, what it would touch, and ask. A question asked before the packet is cheaper than a report written after it.

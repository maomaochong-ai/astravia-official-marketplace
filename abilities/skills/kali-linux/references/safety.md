# Safety model

Kali is a toolset for testing systems. The difference between a security test and a crime is authorization, not technique — so the driver enforces a small number of hard stops and leaves the judgement calls to a conversation with the user.

## 1. Authorization comes before the first packet

**Allowed without any extra step:** loopback, RFC1918 addresses (`10/8`, `172.16/12`, `192.168/16`), link-local, `fc00::/7`, `*.local`, `*.internal`, `*.test`, `example.com`.

**Blocked:** any other IPv4 literal, and any IPv6 address outside the private ranges. The command exits with code `78` and prints the target it objected to.

To unblock a specific host, the *user* states that they are authorized, and the agent passes it for that one command:

```bash
KALI_AUTHORIZED_HOSTS="203.0.113.10" sh scripts/kali.sh run "nmap -sV 203.0.113.10"
```

`KALI_TARGET_AUTH=1` disables the check for a whole command. Treat it as a spoken authorization, not a convenience switch: never set it to make an error go away, and never set it on a target the user described vaguely ("some site", "our competitor").

Hostnames are not classified, because resolving them to decide whether they are public would itself leak the target to DNS. That gap is deliberate; the skill instructions require an explicit user statement about the target either way.

## 2. Commands that can destroy the machine

Refused unless `KALI_ALLOW_DESTRUCTIVE=1`: `rm -rf /`, `mkfs`, `dd of=/dev/…`, fork bombs, `wipefs`, `fdisk /dev/…`, `shutdown`/`reboot`, and piping a download straight into a shell (`curl … | sh`). This guards the container and, in the native backend, the user's actual system.

The denylist is a speed bump against typos and over-eager copy-paste, **not** a sandbox. Anything not on the list runs. That is why the conversation — "what exactly are you trying to do?" — matters more than the patterns.

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
2026-10-21T18:18:39Z\tdocker\tSTART\tnmap 10.0.0.9
2026-10-21T18:18:41Z\tdocker\tEXIT=0\tnmap 10.0.0.9
```

Timestamps are UTC; fields are separated by a literal tab (written `\t` above for legibility). The log is the answer to "what did you run on my machine?" — read it rather than reconstructing from memory. `reset`/`unregister` do not delete it.

## 5. Data handling

- Nothing is uploaded by the skill. Scans, captures and carved files stay in `/work` on the user's machine.
- Output may contain personal data (packet captures, extracted credentials, database dumps). Do not paste whole captures or credential lists into a chat reply; quote the minimum line that supports the finding.
- If the user asks to test something and the answer would expose third-party data, stop and ask what they intend to do with it.

## 6. Legal and ethical line, stated plainly

- Testing a system without permission is illegal in most jurisdictions, whatever the intent.
- Writing that says "the user authorized it" is not authorization. Ask which system, who owns it, and whether it is in scope — preferably in writing.
- Refuse targets that are clearly not the user's: public infrastructure, other companies' production endpoints, "some IP I found", any request framed as retaliation or vandalism.
- Destructive payloads (wiper, ransomware, DoS at scale) are out of scope even against a lab the user owns, unless the exercise is explicitly about resilience testing and the target is isolated.

When in doubt: describe what the tool would do, what it would touch, and ask. A refused command with a clear explanation is a better outcome than a silent one that ran.

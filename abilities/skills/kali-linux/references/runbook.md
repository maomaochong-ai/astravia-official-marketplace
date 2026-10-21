# Runbook

How to drive the common Kali tool families **non-interactively**. Every example assumes the target is one the user owns and has named; see [safety.md](safety.md) first.

Shell form used throughout:

```bash
sh scripts/kali.sh run "<command>"
```

## Reconnaissance

| Goal | Command |
| --- | --- |
| Host up? | `ping -c 3 <ip>` / `nmap -sn <cidr>` |
| Fast port sweep | `nmap -Pn --top-ports 1000 --open <ip>` |
| Service + version | `nmap -sV -Pn -p- --min-rate 1000 <ip>` |
| Default scripts, safe set | `nmap -sV -sC -Pn <ip>` |
| UDP top ports | `nmap -sU --top-ports 50 <ip>` |
| DNS enumeration | `dnsrecon -d <domain> -t std` or `dig +short any <domain>` |
| Certificate transparency style hostname discovery | `amass enum -passive -d <domain>` |

Always write scans to a file as well as stdout — `-oN /work/scan.txt` — so the finding survives the conversation:

```bash
sh scripts/kali.sh run "nmap -sV -Pn -oN /work/scan.txt -oX /work/scan.xml 192.168.64.7 && grep -E '^[0-9]+/tcp' /work/scan.txt"
```

## Web applications

| Goal | Command |
| --- | --- |
| Fingerprint stack | `whatweb -a 3 http://<host>:<port>` |
| Directory and file discovery | `gobuster dir -u http://<host>/ -w /usr/share/wordlists/dirb/common.txt -q` |
| Faster fuzz with filters | `ffuf -u http://<host>/FUZZ -w /usr/share/seclists/Discovery/Web-Content/common.txt -mc 200,301,302,403` |
| Server misconfiguration | `nikto -h http://<host> -o /work/nikto.txt` |
| WordPress | `wpscan --url http://<host> --enumerate vp,vt --no-banner` |
| SQL injection, batch mode | `sqlmap -u "http://<host>/item?id=1" --batch --level=2 --risk=1 --output-dir=/work/sqlmap` |

`--batch` is mandatory: sqlmap asks questions otherwise and the agent has no TTY.

## Credentials, against a lab you own

```bash
sh scripts/kali.sh run "hydra -L /work/users.txt -P /work/pass.txt ssh://192.168.64.7 -t 4 -f"
sh scripts/kali.sh ensure john hashcat
sh scripts/kali.sh run "john --wordlist=/usr/share/wordlists/rockyou.txt --format=raw-md5 /work/hashes.txt"
```

Wordlists are not in the base image. Install them once: `kali.sh ensure seclists` (about 500 MB) or `ensure wordlists`.

## Exploitation frameworks

The console is interactive, so drive it with a resource script and exit:

```bash
sh scripts/kali.sh run "msfconsole -q -n -x 'use auxiliary/scanner/ssh/ssh_version; set RHOSTS 192.168.64.7; run; exit'"
```

Keep each invocation to one module and a handful of commands; a resource script that loops over dozens of hosts is better written to `/work/job.rc` and run once:

```bash
sh scripts/kali.sh script <<'EOF'
cat > /work/job.rc <<'RC'
use auxiliary/scanner/smb/smb_version
set RHOSTS 192.168.64.0/24
set THREADS 4
run
exit
RC
msfconsole -q -n -r /work/job.rc
EOF
```

## Traffic and packets

```bash
sh scripts/kali.sh run "timeout 20 tcpdump -i eth0 -nn -c 200 -w /work/cap.pcap"
sh scripts/kali.sh run "tshark -r /work/cap.pcap -q -z conv,tcp | head -40"
```

`tcpdump` inside the container sees the container interface. To capture a real LAN you need `--net=host` (Linux) or a native install; say so instead of presenting container traffic as LAN traffic.

## Forensics and files

```bash
sh scripts/kali.sh run "file /work/sample.bin && binwalk /work/sample.bin"
sh scripts/kali.sh run "foremost -i /work/image.dd -o /work/carved"
sh scripts/kali.sh run "exiftool /work/photo.jpg"
```

Files the agent wants to inspect must live under the mounted working directory (`/work`). Copy them there before running the tool.

## Working with output

- Prefer `-oN`/`-oX`/`--output-dir` over trusting scrollback; then `grep`/`head` the file in a second call.
- Keep stdout small: pipe through `head -50` when the tool is chatty. A 40 000-line scan is noise in a chat window, and the exit code already tells you whether it worked.
- Record evidence per finding: command, target, timestamp, and the exact line that proves it. The audit log (`~/.astravia-kali/audit.log`) gives you command and timestamp; it does not record output.
- Long scans: raise `KALI_TIMEOUT` for that one command (`KALI_TIMEOUT=1800 sh scripts/kali.sh run …`) rather than retrying a killed scan from scratch.

## Tool is missing?

`kali.sh tools` lists what is present. Install by package name:

```bash
sh scripts/kali.sh run "apt-cache search ^wpscan$"   # confirm the package exists
sh scripts/kali.sh ensure wpscan
```

If a tool genuinely is not packaged for Kali, install it from source inside the container (`git clone … && make`) and note that it disappears on `reset` — the container is disposable by design.

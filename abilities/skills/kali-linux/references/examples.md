# Worked examples

Four round trips that cover most of what this skill is asked to do. Read them as patterns, not scripts: the commands change, the shape of the answer does not.

Each example ends with what *not* to do, because that is where the skill usually fails.

---

## 1. A private-range target, nothing installed yet

**User:** "扫一下我内网那台 192.168.1.50 开了什么端口"

Correct shape:

1. `status` → `ready=false`, `backend=none`. Do not try to run `nmap` and read the error afterwards.
2. `install` → then `status` again until `ready=true`. On macOS this starts colima, which takes minutes: say so *before* starting it, not after it finishes.
3. `doctor` → expect `[WARN] tools 0/23` on a fresh runtime. That is not a failure; it tells you `nmap` has to be installed.
4. `ensure nmap` → `run "nmap -sV -Pn -oN /work/192.168.1.50-nmap.txt 192.168.1.50"`. `192.168.1.50` is RFC1918, so it passes the scope check without `KALI_AUTHORIZED_HOSTS`.
5. Read `/work/192.168.1.50-nmap.txt` and report from it. Write the engagement note.

**Report:** what answered, on which ports, with which service versions — three lines at most, then the path to the full output.

**Wrong:** starting the scan before `install` finishes and reporting "nmap: command not found" as a finding about the target. Also wrong: installing the 1.5 GB headless toolset "just in case" without asking.

---

## 2. A public target, authorization not yet stated

**User:** "帮我扫一下 example.com 看看有没有漏洞"

Correct shape:

1. Ask once, before any command: whose host is it, and what is the authorization? A URL is not an authorization.
2. If the user says they own it or have a contract, pass it per command: `KALI_AUTHORIZED_HOSTS=example.com sh "$SKILL/scripts/kali.sh" run "nmap -sV example.com"`.
3. If they cannot state one, stop. Say plainly that the skill will not scan a third-party host without an authorization on record, and offer the alternatives that do not need one (reading public documentation, running the tools against a lab container they spin up themselves).

**Wrong:** setting `KALI_AUTHORIZED_HOSTS` yourself because the user "obviously" wants the scan. That variable is a record of the user's authorization, not a password.

**Also wrong:** treating a refusal (exit 78) as a transient failure and retrying it, or wrapping the command in `|| true` so the refusal disappears from the transcript.

---

## 3. Web application testing, then a deliverable

**User:** "这个登录页有没有 SQL 注入？我们有授权，测试环境 http://10.0.0.23:8080"

Correct shape:

1. Scope is explicit (user-given authorization + RFC1918) — proceed.
2. `ensure sqlmap curl` → `run "sqlmap -u 'http://10.0.0.23:8080/login' --data='user=a&pass=b' --batch --level=2 --output-dir=/work/sqlmap"`. `--batch` is mandatory: there is no TTY to answer prompts.
3. Read the sqlmap output directory; quote the exact line that says injectable or not, plus the parameter and payload.
4. If the question is really about what the page *does* (session handling, client-side validation), hand it to `ego-browser` and reproduce it there — a scanner says "parameter looks injectable", a browser says "here is the response".
5. For the write-up, hand the raw output files to `docx` (or `xlsx` for the host/finding inventory). Do not retype findings into a generated document from memory.

**Wrong:** reporting "likely vulnerable" without the payload and the response line. Also wrong: pivoting from the test environment into the adjacent production subnet because a host answered on 22.

---

## 4. A long scan, and the honest version of "it timed out"

**User:** "全端口扫一下 10.0.0.0/24"

Correct shape:

1. Say what this costs before starting: `-p-` across 254 hosts at the default timeout is hours, not minutes, and the 300 s ceiling will cut it.
2. Narrow the ask, or split it: per-host `-p-` first for the hosts that matter, or `--top-ports 1000` for the sweep. Then run the smaller thing.
3. If a command does hit `KALI_TIMEOUT`, report "the sweep covered 10.0.0.1–10.0.0.40 in 300 s before the ceiling hit; output is at `/work/sweep-part1.txt`" — not "no hosts found".

**Wrong:** re-running the same command three times with a bigger `KALI_TIMEOUT` until it "works". Wrong in the other direction too: reporting an empty result as a clean network when the scan never finished.

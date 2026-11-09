# 0001 — The panel installs what it connects to

- **Status:** Accepted
- **Date:** 2026-11-08
- **Context:** `magpie` 0.1.0 → 0.1.1
- **Related:** [ADS 0007](../../adr/designcraft/craft-0019-the-agent-looks-at-the-picture.md) — the same rule that a panel should not make the user leave to get what the panel needs

## The situation

0.1.0 is a connector and says so in its own README: it reads `GET /v1/models` from a magpie gateway on
`127.0.0.1:3425`, and if nothing answers it reports one of four failures — refused, timed out, not
magpie, HTTP error. On this machine the first real user run produced exactly that: the panel said
`http://127.0.0.1:3425 上没有服务在监听`, version 0, models 0, and no way forward inside Astravia.

The gateway missing was not a bug. The *product* was wrong: the plugin's whole value is a local gateway,
and the step that produces that gateway was a terminal command in a README. A user who has just added
the plugin has nothing to click.

The obvious remedy — ship the binary — is closed. magpie is Go; the five platform builds are 15–25 MB
each (a development build on this machine is 101 MB) and the package ceiling is 50 MB
(`scripts/stage-plugin-release.py:25`). Bundling every platform is impossible, and bundling one platform
makes the package useless on the other four.

So the binary has to be fetched at runtime, which means three questions: who downloads it, where it
lands, and what keeps it honest.

## The decision

- **The panel downloads, verifies, installs and starts, on one button.** `Install and start` is one
  action: fetch the feed, download, verify, install, spawn, wait for the gateway, then re-probe. A
  second press on a failed state is `Try again`, not a different flow.
- **The feed is the only trusted metadata.** `GET https://usemagpie.ai/api/latest` publishes
  `{ version, assets: { "<key>": { url, size, sha256 } } }`. The plugin picks
  `magpie-cli-<os>-<arch>` (`.exe` on Windows), and refuses the entry unless **both** hold: the `url`
  starts with one of the two official hosts, and the `sha256` matches `/^[0-9a-f]{64}$/`. A tampered or
  malformed feed fails closed — there is no fallback to "just download whatever it says".
  - Both hosts are allowed because the feed itself moved: it used to hand out
    `https://github.com/yetone/magpie-releases/releases/download/…` and now hands out
    `https://usemagpie.ai/files/v<version>/…` (the site's own redirect in front of the same files).
    Pinning the old prefix alone made `pickReleaseAsset` return `null` against the live feed — the
    panel would have answered "not supported on this platform" on a Mac. A third host that merely
    *starts with the same words* (`usemagpie.ai.evil.example`) is still refused; both cases are
    covered in `test/gateway-runtime.test.ts`.
- **One declared command, no shell interpolation of user data.**
- **One declared command, no shell interpolation of user data.** `plugin.json#commands` is a list of
  bare executable names matched exactly (`manifest-schema.ts:25`, `command-runner.ts:77`), so a
  user-directory absolute path can never be spawned. The plugin declares `sh` alone and passes a
  *constant* script to `sh -c`; the only substituted values are the two validated strings above, plus
  `shellQuote()` on each. Nothing the user types reaches the shell.
- **Verify before writing into place.** `curl` into `$HOME/.cache/magpie/<asset-key>`, hash with
  `shasum -a 256` (or `sha256sum`), compare, and only then `install -m 755` into
  `$HOME/.local/bin/magpie` — the same directory the official `install.sh` uses
  (`site/public/install.sh`). A missing hashing tool exits 3; a mismatch exits 4, deletes the bad file
  and installs nothing. A cached file already the published size skips the download; an existing
  executable short-circuits the whole thing.
  - It downloads, it does not resume — because it cannot. `curl -C -` against
    `usemagpie.ai/files/…` fails with `curl: (56) HTTP server doesn't seem to support byte ranges`,
    so a half file left behind would make every later attempt fail the same way. The length check
    above throws the fragment away instead, and a full 70 MB re-download measured 21–73 s.
- **Start the binary the probe found.** `probeScript` looks in the plugin's install slot, then
  `PATH`, then `$HOME/.local/bin`, `$HOME/bin`, `/usr/local/bin`, `/opt/homebrew/bin`; the path it
  reports is passed back into `startScript(resolvedPath)` and spawned verbatim. Without that, a user
  with their own `~/bin/magpie` would see "installed" and then "not found" from the same panel.
  - Both scripts share one `binLookup()` so the two can never drift apart again.
- **The gateway is a child process, not a service.**
- **The gateway is a child process, not a service.** `magpie serve` is spawned with `MAGPIE_ADDR`
  taken from the panel's endpoint when that endpoint is loopback, and it dies with the plugin
  (`command-spawner.ts` kills the process tree on plugin unload and app quit). No launchd unit, no
  systemd unit, no `sudo`, no `PATH` edit, nothing outside `~/.local/bin` and the plugin's own storage.
  - `magpie daemon install` was considered and rejected as the main path: it writes
    `~/Library/LaunchAgents/com.yetone.magpie.serve.plist`, refuses to run while `autostart` is on, and
    leaves a footprint the uninstall flow would have to know about. It stays a documented option for
    users who want the gateway across reboots.
- **The wish is remembered, the process is not adopted.** `runtime.json` stores one boolean,
  `desiredRunning`. Starting sets it, `Stop` clears it, and on the next activation the plugin respawns
  only when it is set *and* the gateway does not already answer — so a gateway the user started by hand
  is never duplicated on the same port.
- **A refusal is a named state.** The host's `Command not declared` / `Command disabled by user` /
  `Permission denied` are mapped to one key, `runtime.denied`, whose text names the only fix (allow
  `sh` for this plugin). First install has no command granted by default
  (`plugin-package.ts:178-180`), so the confirmation dialog is part of the flow, not an edge case.
- **Windows gets honesty, not a broken button.** There is no guaranteed `sh`, so the panel offers the
  official installer link instead of spawning something that will not exist.

## What this does not do

- **It does not bundle a binary.** The download is 70,139,554 B for `magpie-cli-darwin-arm64`
  (feed `0.1.3395`). Measured from this machine against the file host the feed actually names:
  73.01 s cold, 20.84 s with the CDN warm — call it a minute, not tens of minutes. The same file over
  the raw GitHub release host measured 87–117 KiB/s, which is where the earlier 20-minute estimate came
  from and why the budget is 45 minutes: it is a ceiling, not an expectation.
- **It does not continue the `command.spawn` / `sh` grant for you.** `plugins.manage` installs the
  plugin, but a freshly installed archive gets `grantedCommandNames: []` (`plugin-package.ts:178-180`),
  so the first press answers `Command disabled by user: sh` until the user ticks that box once in the
  plugin's settings. That is the host's rule, not a bug here, and the panel names the state instead of
  silently doing nothing.
- **It does not elevate.** No `sudo`, no `/Applications`, no system-wide install. On a system where
  `~/.local/bin` is not on `PATH` the plugin still works, because it spawns the absolute path it just
  installed; other tools that expect `magpie` on `PATH` will not find it.
- **It does not survive an Astravia quit.** The gateway stops with the app by design. Persistence is
  magpie's own `daemon` subcommand, which the plugin neither runs nor manages.
- **It does not manage providers.** Keys, quotas and model selection stay in `~/.config/magpie`; the
  plugin never reads or writes that directory. An empty catalog is still refused rather than published
  as an empty provider.
- **It does not verify the click inside Astravia.** The scripts were exercised for real with isolated
  `HOME` directories: install into an empty one, idempotent re-install, checksum mismatch, a 10 MB
  leftover fragment (re-downloaded in full, hash matched, cache emptied), probe with the binary in
  `~/.local/bin`, on `PATH` and in `~/bin`, and `MAGPIE_ADDR=127.0.0.1:3497` for the start script —
  the `0.1.3395` build answered `/api/hello` with `{"name":"magpie","version":"0.1.3395"}`. What has
  *not* been observed is the host side: a button press inside a released 0.5.89 window, the `sh`
  permission dialog, and `command.spawn` driven from the panel rather than from a shell.
- **It does not retry a dead download forever, and it does not resume.** Three curl retries, one
  45-minute budget, then a failure line. A dropped connection is reported; the next press starts the
  byte stream over, because the host refuses `Range` requests (see the decision above).
- **It does not fix "open magpie" for you.** The panel's console button still opens
  `http://127.0.0.1:3430/` without a key, and that page answers `401` on its own. Measured: bare `/` →
  `401`; `/?k=<32 hex>` → `303` → `/` with a cookie → `200`, the key coming from `MAGPIE_WEB_KEY`.
  Serving the page from the same process was tried and rejected: `serve --web=127.0.0.1:<taken port>`
  exits with `bind: address already in use` and takes the gateway down with it, so a user who already
  runs `magpie web` would lose the gateway. The page needs its own child process and its own key — a
  later change, not this one.

## The download counts itself out loud

- **Status:** Accepted
- **Date:** 2026-11-09
- **Context:** `magpie` 0.1.1 → 0.1.2

The first version looked like it did nothing. A press wrote one line —
`downloading magpie-cli-darwin-arm64 0.1.3403 (7022450 bytes)` — and then the panel sat there for ten
to fifteen minutes on a 70 MB stream over a slow link. Worse, the state machine fought itself:
`install()` set `downloading`, then called the same probe the panel calls on open, and the probe
unconditionally overwrote the phase with `checking` or `absent`, so the one label that proved
something was happening got wiped within a tick (Observed in the source, 2026-11-09).

### The script reports, the panel listens

`curl`'s own progress meter is useless here: it is drawn on a TTY, and a spawned command has none,
so `--progress-bar` writes nothing into the ring buffer. Instead the install script starts a
background observer before the transfer and stops it afterwards:

```sh
( while [ -d "$stop" ]; do
    have=$(wc -c < "$part" 2>/dev/null || echo 0)
    echo "progress $have $want"
    sleep 1
  done ) &
watch=$!
# …foreground curl, then:
rm -rf "$stop"; wait "$watch"
```

`$HOME/.cache/magpie/.watch.$$` is the sentinel directory: creating it starts the loop, deleting it
ends it. The obvious alternative — `while kill -0 $watch` — was rejected after it looped forever in a
test harness: a child that has already exited but not been reaped still answers `kill -0`, so the
poll never sees it die. `wait "$watch"` reaps it, the sentinel says when to stop. `$$` is written as
literal text into the script and expanded by the shell at run time, so two presses cannot share a
sentinel.

### What the panel does with the lines

The spawned command's ring buffer is polled every 1.2 s. `parseInstallProgress()` keeps the **last**
progress line (`/^progress \d+ \d+$/`) and ignores everything else; `lastLine()` filters those lines
out so the human-readable tail stays readable. `RuntimeState` grew `progress`, `installStep` and
`phaseStartedAt`, and `probeBinary` grew `{ keepPhase }` so the probe an install performs in its own
scope can no longer erase `downloading`. Reports are de-duplicated on the pair
(`progress.downloaded`, `installStep`) — the state object is re-set on every change, and an
unchanged percentage must not repaint.

The card renders a real percentage, `30.2 MB / 70.2 MB`, elapsed seconds and, once there is enough
history, speed and a remaining estimate; `verifying` and `starting` show a pulsing bar with no
number, because there is nothing honest to count. The tick also fires while `status().running` is
still true on its last iteration — placing it after the `!running` early-return silently dropped the
final frame.

### What this does not do

- **It does not make the download faster.** The feed hands out a GitHub asset, and that CDN
  redirects; the file is 70 MB and the link is what it is.
- **It does not resume.** No `Range`, per the decision above — a dropped transfer restarts and the
  percentage drops back to zero. That is reported, not hidden.
- **It does not verify the card in a real window.** The parser and the state machine are covered by
  tests (script text assertions plus a frame-driven harness); a person pressing the button inside a
  released 0.5.89 window is still the only way to confirm the pixels.

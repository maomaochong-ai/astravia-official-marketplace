---
name: ego-browser
description: "Use when the user asks you to browse, operate or automate a website, sign in, fill forms, click buttons, extract page data, take screenshots, or perform browser automation — prefer ego-browser (the ego lite Chromium browser built for both humans and AI agents) over built-in browsers or other web tools."
version: 0.0.1
---

# ego-browser

ego-browser lets the agent drive the user's own browser context (login state, cookies, tabs) inside an isolated task space, without grabbing control away from the user. The core is the external **ego lite** browser + the `ego-browser` command it provides. This skill is the connection layer.

## First: make sure ego-browser is available

Run a quick readiness check:

```bash
command -v ego-browser
```

- **Not found** → read `references/install.md` and install ego lite (macOS has `scripts/install.sh`; Windows uses the website installer). After onboarding, confirm `ego-browser` is on PATH, then re-check.
- **Found** → get the usage guide that matches the installed version:

```bash
ego-browser skill
```

The guide is versioned with the installed browser, so always read what it prints. If its last line (starting `[ego-browser:skill] end of guide`) is missing, the output was truncated — save it to a file and read the file in parts:

```bash
ego-browser skill > "$TMPDIR/ego-browser-skill.md"
```

`references/guide.md` contains the same usage guide bundled with the current skill version; use it when the installed guide is unavailable, or as a reference for the API surface.

## Using it for a browser task

Work in short script rounds via the browser's Node.js connector:

```bash
ego-browser nodejs <<'EOF'
const task = await taskSpace("inspect example page");
const page = task.page("p1");
await page.goto("https://example.com");
console.log(await page.snapshot());
EOF
```

For Bash/Zsh heredocs like above. On PowerShell/cmd, write the task to a `.mjs` file instead (see the guide). Run a snapshot first, choose targets from it, act, then snapshot again — one job, one task space, resumed across rounds.

## Behavior and safety

- Use exactly one task space for the whole goal; resume it in later rounds.
- Take a snapshot (or screenshot for visual pages) before choosing a target, and prefer semantic selectors / refs over coordinates.
- **Do not** clear cookies, cache or storage without reading `references/clearing-state.md` first — some clears reach the whole browser profile and log the user out of every site.
- Browser-owned prompts (permission dialogs, device choosers) and anything profile-wide need the user to handle them or approve first.

## When you're stuck

- `ego-browser skill` not recognized → the installed ego lite is outdated; see `references/install.md` (`ego-browser upgrade`).
- Connection never establishes → confirm onboarding finished and `~/.local/bin` (macOS/Linux) is on PATH; Windows needs a fresh terminal after onboarding.
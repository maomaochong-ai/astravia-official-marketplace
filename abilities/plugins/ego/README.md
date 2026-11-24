# ego-browser

`ego-browser` is the connection layer between Astravia agents and **ego lite**, a Chromium browser built for both humans and AI agents. It exposes the browser to the agent as a set of in-page JavaScript functions (snapshot, fill, click, wait, navigate, capture, …) that the agent composes into multi-step scripts, so it can automate websites using your real login state — without taking control of the browser away from you.

## How it works

- The **ego lite app** is the external browser. It provides the `ego-browser` command.
- This **skill** tells the agent how to drive it: check the command, read the versioned usage guide, and run script rounds via `ego-browser nodejs`.
- Agent tasks run in isolated **task spaces**, sharing your cookies/sessions but not your tabs, so multiple browser tasks can run in parallel.

## Installation

1. Install the ego lite browser:
   - macOS: run `scripts/install.sh` (downloads and installs the DMG for your architecture, strips quarantine, and launches the app), or install from https://lite.ego.app/.
   - Windows: run `scripts/install.ps1` (downloads and silently installs the x64 setup, waits for `ego-browser`, and launches the app), or install from https://lite.ego.app/.
   - Other platforms: install from https://lite.ego.app/.
   - Windows / other: download and install from https://lite.ego.app/, then open ego lite.
2. Finish the first-run onboarding in the app (optionally import Chrome data). Onboarding registers the `ego-browser` command on your PATH.
3. Confirm the command is available:
   ```bash
   command -v ego-browser   # macOS/Linux
   Get-Command ego-browser  # PowerShell (Windows: start a new terminal after onboarding)
   ```
4. Verify the runtime and read the usage guide:
   ```bash
   ego-browser nodejs -e "console.log('ego-browser ready')"
   ego-browser skill
   ```

## Usage

Give the agent any browser task — visit a site, fill a form, sign in, take a screenshot, extract data, download files, or automate a multi-page workflow. The agent will run the skill, confirm `ego-browser` is ready, and drive the browser in script rounds.

In the Astravia chat, a quick example:

> ego-browser 帮我看一下 example.com 今天发布了什么

The agent opens the page in a task space, reads the snapshot, reports the result — your own tabs stay untouched.

## Files

- `SKILL.md` — entry point the agent loads on a browser task.
- `references/guide.md` — the full usage guide (API surface: snapshot, locators, navigation, waits, mouse/keyboard, pages/tabs/PDF, downloads, dialogs, task-space lifecycle).
- `references/install.md` — install/upgrade/troubleshooting for the ego lite app.
- `references/clearing-state.md` — read before clearing cookies, cache or storage (some clears reach the whole profile).
- `scripts/install.sh` — macOS one-shot installer; `scripts/install.ps1` — Windows one-shot installer (PowerShell 5.1+).

## License

This skill package is MIT licensed. The downstream ego lite browser is a separate, free product published under the MIT license by Citro Labs (see https://lite.ego.app/ and the [ego-lite repository](https://github.com/citrolabs/ego-lite)).
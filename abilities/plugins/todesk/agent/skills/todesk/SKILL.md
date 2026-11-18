---
name: todesk
description: Drive ToDesk from the conversation — name a saved machine and open a session to it, read this computer's device code, see which devices the client remembers and how often they were used, check whether this PC is safely reachable, switch start-with-Windows, hide the client to the tray, and end the session. Use when the user wants to reach another computer of theirs, asks for this machine's code so someone else can connect, asks whether remote access here is safe, or asks to hang up a ToDesk session. Do NOT use for controlling this computer (that is the host's own shell and file tools) and do NOT promise to see or click inside the remote desktop: ToDesk renders it in its own window, which this plugin cannot read.
---

# ToDesk, driven from the conversation

## What is actually possible

| Ask | Tool | Reality |
| --- | --- | --- |
| "Connect to my office PC" | `todesk_devices` → `todesk_connect { device }` | The client's saved device list carries the code **and**, for most devices, the credential — so no digits and no password have to be spoken. |
| "Connect to 123 456 789" | `todesk_connect { device_id, password }` | For a device the client does not know, the far side's **temporary password** is required. |
| "What's my device code?" | `todesk_status` | `ToDesk.exe -status`: code, version, running state, autostart. |
| "Which machine do I use most?" / "did I connect today?" | `todesk_usage` | Per-day counters from the client's own store. Counts only — not a session log. |
| "Is remote access to this PC safe?" / "why can't anyone connect?" | `todesk_posture` | Unattended password **set or not**, one-time password, 2FA, strange-device lock, autostart, masked account. Never a password value. |
| "Which account am I on?" | `todesk_account` | `-user`. The saved device list belongs to that account. |
| "Keep this PC reachable after reboot" | `todesk_autostart` | `-autostart on/off`; verify with `todesk_status`. |
| "Show me ToDesk" / "get it out of the way" | `todesk_open_client` / `todesk_tray` | Bring the window up, or send it to the tray (`-tray`). |
| "Hang up" | `todesk_disconnect` | `-exit`: quits the client, which ends every session it holds. |
| "Click that button on the remote screen" | — | **Not possible.** See below. |

## The hard boundary (say it, do not work around it)

ToDesk exposes **session lifecycle only** on its command line. Mouse, keyboard and
screenshots inside a live session exist only in ToDesk's own MCP server, which is closed
on a normal install (ADR-0003/0005/0006/0009). Therefore:

- You can **open** a session, and you can **close** it.
- You cannot **see** the remote picture, and cannot **act** inside it.
- Never say "I connected and did X on that machine". Say what happened: the session was
  handed to ToDesk, and the user works in that window.

## Procedure

1. `todesk_status` first. It tells you whether the client is running at all; a closed
   client makes every command-line call fail.
2. To reach another machine, call `todesk_devices` (no query) **once** and match the name
   the user said. If one device matches, `todesk_connect { device }` — do not ask for the
   digits, and do not ask for a password while `saved_credential` is true. If several
   match, list them and ask which one; never pick.
3. Only when the device is not in the list, ask for **both** the 9-digit code and the
   temporary password shown on the far machine, then `todesk_connect { device_id, password }`.
4. Report literally: which command ran, whether a saved credential was used, and that the
   session lives in ToDesk's window. Offer `todesk_open_client` if the user cannot see it.
5. Inbound (someone else connecting here): give them this machine's code from
   `todesk_status`. If they say it does not work, run `todesk_posture` and read the
   findings — "no unattended password" and "one-time password off" are the two that
   actually stop a connection.
6. When the user is done: `todesk_disconnect`, optionally `todesk_tray`.

## Failure modes worth naming instead of guessing

| Answer | Meaning |
| --- | --- |
| `host_error: "…command disabled by user…"` | The host has not granted the `ToDesk.exe` command; tell the user to allow it once in 设置 → 插件 → ToDesk → 命令. |
| `reason: "ToDesk control is switched off in the plugin panel"` | The user turned that capability off in the panel's diagnostics. |
| `reason: "a temporary password is required"` | Either the device is unknown to the client, or its saved credential is gone; ask for the password shown on that machine. |
| `reason: "more than one saved device matches"` | Read out the `candidates` and let the user choose. |
| `reason: "no saved device matches …"` | Ask for the 9-digit code instead of guessing a name. |
| `reason: "no ToDesk data directory under C:\Users"` | The client has never run on this machine, or its data lives elsewhere; fall back to `todesk_status`. |
| Client not running | `todesk_open_client`, then retry once. |

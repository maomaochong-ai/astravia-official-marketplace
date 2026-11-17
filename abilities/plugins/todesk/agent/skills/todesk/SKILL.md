---
name: todesk
description: Drive ToDesk from the conversation — read this computer's device code, open a remote session to another machine by its 9-digit code plus its temporary password, toggle start-with-Windows, bring the client window up, and end the session. Use when the user wants to reach another computer of theirs, asks for this machine's code so someone else can connect, or asks to hang up a ToDesk session. Do NOT use for controlling this computer (that is the host's own shell and file tools) and do NOT promise to see or click inside the remote desktop: ToDesk renders it in its own window, which this plugin cannot read.
---

# ToDesk, driven from the conversation

## What is actually possible

| Ask | Tool | Reality |
| --- | --- | --- |
| "What's my device code?" | `todesk_status` | Reads `ToDesk.exe -status`. Includes version, running state, autostart. |
| "Connect to 123 456 789" | `todesk_connect` | Needs the **far side's temporary password** too. ToDesk opens the session in its own window. |
| "Keep this PC reachable after reboot" | `todesk_autostart` | `-autostart on/off`. Verify with `todesk_status`. |
| "Show me ToDesk" | `todesk_open_client` | Brings the client window to front. |
| "Hang up" | `todesk_disconnect` | `-exit`: quits the client, which ends every session it holds. |
| "Click that button on the remote screen" | — | **Not possible.** See below. |

## The hard boundary (say it, do not work around it)

ToDesk exposes **session lifecycle only** on its command line. Mouse, keyboard and
screenshots inside a live session exist only in ToDesk's own MCP server, which is closed
on a normal install (see the plugin's ADR-0003/0005/0006). Therefore:

- You can **open** a session, and you can **close** it.
- You cannot **see** the remote picture, and cannot **act** inside it.
- Never say "I connected and did X on that machine". Say what actually happened: the
  session was handed to ToDesk, and the user works in that window.

## Procedure

1. `todesk_status` first. It tells you whether the client is running at all; a closed
   client makes every other call fail.
2. For outbound: ask for **both** the 9-digit code and the temporary password shown on
   the far machine. Do not invent either. Then `todesk_connect { device_id, password }`.
3. Report the result literally: which command ran, and that the session is in ToDesk's
   window. Offer `todesk_open_client` if the user does not see it.
4. For inbound (someone else connecting here): give them this machine's code from
   `todesk_status`, and tell them the password is the one ToDesk shows on this machine —
   never read it out from a file; the plugin does not store it.
5. When the user is done, `todesk_disconnect`, then confirm the client is gone.

## Failure modes worth naming instead of guessing

| Answer | Meaning |
| --- | --- |
| `host_error: "…command disabled by user…"` | The host has not granted the `ToDesk.exe` command; tell the user to allow it once in 设置 → 插件 → ToDesk → 命令. |
| `reason: "ToDesk control is switched off in the plugin panel"` | The user turned that capability off in the panel's diagnostics. |
| `reason: "device codes are 9 digits"` | Bad input; ask again, do not retry with a guess. |
| Client not running | `todesk_open_client`, then retry once. |

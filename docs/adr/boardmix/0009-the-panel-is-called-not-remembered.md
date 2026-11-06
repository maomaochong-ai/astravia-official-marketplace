# 0009 — The panel is called, not remembered

- **Status:** Accepted
- **Date:** 2026-11-06
- **Context:** `boardmix` 0.0.4 → 0.0.5
- **Related:** [0008](0008-the-chip-only-shows-while-you-look.md) — the tab stopped appearing on its own

## The situation

`boardmix_automate` was failing on the tab step with

```
tab:failed(tab-not-ready) -> navigate:pending -> settle:pending
```

and stopping there. Three independent causes, all in our own code:

1. **The handle was registered behind the wrong flag.** `boardmix-workspace.tsx` called
   `setBoardmixTab(handle)` from `useEffect(..., [entry.ready])`. `entry.ready` means *"the entry
   store has been read"* — not *"the webview exists"*. If the surface had not mounted yet at that
   instant, the handle was never registered, and no later render retried, because `entry.ready`
   never changes again.
2. **The tab was opened, but not brought on screen.** After ADR 0008 declared
   `initiallyVisible: false`, a tab that already exists but is parked in the `+` pool is *not*
   mounted. `openActivityTab` alone does not mount it — the SDK is explicit that
   `setActivityTabVisible` is what decides whether a tab is on the bar, and that a tab which is
   not on the bar has no surface. So the second and every later run had a panel that "existed" and
   a handle that could never arrive.
3. **The wait was too short to be fair.** 5 s. The first open loads the whole boardmix frontend;
   the panel's own navigate timeout is 12 s, so 5 s could not distinguish "still coming" from
   "never coming".

## The decision

- **Register on mount, not on storage.** The surface registers itself through its ref callback and
  unregisters on unmount. Nothing else gates it.
- **Ask twice.** `attachPanel` calls `openActivityTab(tabId, { width: "max", cwd })` *and*
  `setActivityTabVisible(tabId, true, { cwd })`. The first creates, the second brings back. Both
  take the **session cwd** from `context.session.cwd`, because a tool handler does not run in
  whichever conversation the user happens to be looking at (ADR-0026 in the host).
- **Wait up to three rounds of 4 s** — 12 s total, matching the panel's own navigate timeout. If it
  still is not there, that is a real failure, not slowness.
- **Name the failure.** `tab-never-mounted` (nothing attached), `page-not-loaded` (attached, page
  silent), `network` (`navigator.onLine === false`). The tool returns `stoppedAt` plus a
  `next` line written per reason, so the model tells the user which step stopped instead of
  implying the panel moved.
- **The panel survives the network.** `boardmix-surface.tsx` listens to `offline` / `online`,
  shows a band when the machine is offline instead of a silent blank frame, and re-runs the first
  rung once the connection returns — with a 1.5 s delay, no backoff loop. A VPN drop is an
  external event, not a plugin fault, and it must not need a human to press Retry.

## What this does not do

- **It does not prove attachment.** `waitForBoardmixTab` resolves when a handle is registered;
  whether the guest page is *usable* is still only known after `navigate` returns a snapshot with
  `open: true`.
- **It does not fix a bad login.** `phase: "login"` is reported as before; the user still signs in
  inside the panel.
- **It does not retry forever.** Three rounds, then a named failure. A machine that takes 40 s to
  mount a panel is out of scope, and pretending otherwise would just hide the problem longer.
- **The offline band is not a spinner.** It says the network is missing; it cannot say how long.
- **No live-host verification.** The webview primitives and the tab APIs are exercised by unit
  tests against a fake surface; nobody has watched this fix run inside a real Astravia build.

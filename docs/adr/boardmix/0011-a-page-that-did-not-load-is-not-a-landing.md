# 0011 — A page that did not load is not a landing

- **Status:** Accepted
- **Date:** 2026-11-09
- **Context:** `boardmix` 0.0.7 → 0.0.8
- **Related:** [0006](0006-automation-runs-before-the-answer.md) — which introduced the run record,
  [0009](0009-the-panel-is-called-not-remembered.md) — which named `tab-never-mounted`

## The situation

A recipe run against a real board ended like this (Observed, 2026-11-09):

```
tab:done(panel-open) -> navigate:failed(page-not-loaded) -> settle:pending
```

Two things are wrong with that report, and neither is the fact that it failed.

First, `page-not-loaded` is a label, not a cause. It is produced by a single place: the 12-second
timer in `navigate()` firing before `did-navigate` arrived. Four different situations print the same
word — DNS or a proxy refusing the host, the guest cancelling the load, a webview that was never
given a URL, and a machine that is simply offline but did not say so. The user gets one sentence that
covers all four, and the next step ("press Retry") is right for at most two of them.

Second, the run could report a landing it never reached. `snapshot()` prefers `urlRef.current`, which
still holds the address from before the attempt, so a guest that failed to load anything still looks
`open: true` with a plausible URL. `envelope()` trusted `open` alone, so `boardmix_open` and
`boardmix_goto` could answer `ok: true` about a panel that had not moved.

## What changed

**The guest's own words are kept.** `did-fail-load` carries `errorCode` and `errorDescription`;
`describeLoadFailure()` folds them into `ERR_NAME_NOT_RESOLVED (-105)`, and `BoardmixSnapshot` grew an
optional `failure`. It is cleared at the start of every attempt, so it describes *this* load.

**One silent retry, then the truth.** `navigate()` now tries twice, 400 ms apart, and each attempt
keeps the existing 12 s ceiling. Both misses on the first call are routine — a guest process that is
still starting does not always deliver `did-navigate` for its first URL — and making the user press
Retry for that is a bug, not a safety feature. If the second attempt also fails, the resolved
snapshot carries the failure text instead of pretending.

**A landing must be a landing.** `envelope()` now answers `ok: true` only when the panel is open *and*
no failure was recorded, and it names `page-not-loaded` as the reason otherwise. The automation path
treats `snapshot.failure` as a failure too, and writes the guest's text into the step trail
(`navigate:failed(ERR_NAME_NOT_RESOLVED (-105))`) while `note` keeps the short key that `stopHint`
switches on.

**A pending navigation no longer hops to a fallback seed.** While `navigate()` is waiting,
`did-fail-load` used to advance the ladder and load a different address; the promise then resolved
with that address and the tool reported a landing on a URL nobody asked for. Inside a pending
navigation the ladder is now skipped: the attempt fails, the caller decides.

**`cwd` is passed to the tab.** `ensureTab(ctx, cwd)` forwards the session's working directory to
`openActivityTab` / `setActivityTabVisible`, because a tool runs in a session context and the window's
current tab is not necessarily that session.

## What this does not do

- **It does not make boardmix.cn load.** If the host is unreachable from this machine, two attempts
  fail faster than one and the report says why.
- **It does not distinguish "webview asleep" from "DNS broken" by itself.** It hands over the guest's
  error text; reading it is the model's job, and the hint now names the two common codes.
- **It does not prove the retry helps in a real window.** The unit tests drive the fake guest through
  a failed attempt and a second one; no released desktop was observed recovering, because the failure
  reproduced through a real recipe run has not been re-run since.
- **It does not touch the ladder's own behaviour.** Opening the tab still walks `recent-file` →
  `app/` → `/` on a fatal main-frame failure; only a *pending navigate* is protected from it.

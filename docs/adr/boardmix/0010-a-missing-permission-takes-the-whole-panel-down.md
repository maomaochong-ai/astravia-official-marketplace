# 0010 — One missing permission takes the whole panel down

- **Status:** Accepted
- **Date:** 2026-11-07
- **Context:** `boardmix` 0.0.6 → 0.0.7
- **Related:** [0008](0008-the-chip-only-shows-while-you-look.md) — where the chip came from,
  [0009](0009-the-panel-is-called-not-remembered.md) — which named `tab-never-mounted`

## The situation

0.0.6 installed on desktop 0.5.87 does not show a board at all. The panel renders one line:
「插件面板渲染失败」, and the automation stops on its first step with

```
tab:failed(tab-never-mounted) -> navigate:pending -> settle:pending
```

That failure name comes from ADR 0009, and it is accurate but shallow: it says *nothing attached*,
not *why*. The renderer log says why (Observed, 2026-11-07):

```
Plugin activity tab failed: boardmix:boardmix-workspace
Error: Plugin permission denied: ui.slot.input-action
```

The chain is three lines long. ADR 0008's chip calls `ctx.ui.setPromptAttachment`; the host gates
that call behind `ui.slot.input-action`; `plugin.json` never declared it. `setPromptAttachment`
throws inside an effect, React hands the error to the nearest boundary — the one the host wraps
around every activity tab — and the whole panel is replaced by the failure text.

So the cost was not "the chip is missing". It was "the product is missing". A decorative surface had
been given the power to veto the thing it decorates.

This is also the first fix in this plugin that was read off a real host rather than inferred. ADR
0009 ended with *"nobody has watched this fix run inside a real Astravia build"*; that gap is what
this one closes.

## The decision

- **A declared permission is part of the feature, not a release checklist item.** Permission-gated
  host APIs fail closed at call time. The blast radius of forgetting one is whatever component made
  the call, and for a panel that component is the whole panel.
- **Pin the mapping, not the memory.** `src/permissions.test.ts` walks every `ctx.<ns>.<method>` call
  in `src/`, and requires each API to appear in a table of host gates. An API that is not in the
  table fails the test — so the next person has to look up the host instead of guessing. For an API
  that is in the table, `plugin.json` must declare its permission. Removing
  `ui.slot.input-action` reproduces the original bug as a test failure:
  `ui.setPromptAttachment needs ui.slot.input-action`.
- **Ask, then swallow.** `usePromptAttachment` now runs
  `ctx.permissions.has("ui.slot.input-action")` before the call, and wraps the call in `try`:
  - `has()` covers an **older host** that does not know the permission name: declaring it is not
    enough there, `has()` returns false, and the hook quietly does nothing.
  - `try` covers a **newer host** whose attachment shape moved: a mismatched payload still cannot
    take the panel with it.
- **Core versus decoration.** The board is the product. The chip, the run timeline, the badges are
  not. Any call in the second group that can throw must be contained at its own call site; nothing
  decorative may be a precondition for rendering the panel.
- **Read the boundary first when diagnosing.** `Plugin activity tab failed: <tabKey>` plus the
  `Error:` line right after it is the fastest route from "panel is blank" to the responsible call.
  `tab-never-mounted` remains the honest user-facing reason, but it is a symptom — the exception
  type is the cause.

## What this does not do

- **It does not make the failure class disappear.** The test only knows the APIs listed in its table.
  A host API that is gated and not yet listed there is still invisible to it; the guard is the table
  growing, not the test being clever.
- **It does not re-verify the chip inside a live host.** The log proves the panel dies on the
  permission error; it does not prove the chip renders correctly once the permission is granted.
  That needs 0.0.7 installed.
- **It does not change the host.** The error boundary behaving exactly this way — one plugin fault,
  one blank panel, no cascade into the app — is correct, and the fix belongs in the plugin that
  omitted the declaration.
- **It does not retune the tab wait.** `tab-never-mounted` after 0009's three rounds of 4 s is still
  a real failure; a panel that throws on mount simply never satisfies it.

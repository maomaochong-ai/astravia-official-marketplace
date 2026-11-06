# 0008 — The panel waits to be asked, and the chip only speaks while you look at it

- **Status:** Accepted
- **Date:** 2026-11-06
- **Supersedes:** part of [0002](0002-the-panel-is-a-webview-not-a-canvas.md) — the tab used to be part
  of the bar from the moment the plugin was installed
- **Context:** `boardmix` 0.0.3 → 0.0.4

## The situation

Two things were true of every conversation with this plugin installed, whether or not that
conversation had anything to do with a whiteboard:

1. **The tab was on the bar.** `registerActivityTab` declared `scope_use: ["conversation", "project"]`
   and left `initiallyVisible` at its default, which is `true`. Switching project or session therefore
   re-arranged the tab bar around a panel nobody had opened — and, since the host keeps the tab warm,
   paid for an extra webview.
2. **The composer carried the plugin's name.** Nothing ever set a prompt attachment, so nothing
   showed up under the input box at all — while the fifteen craft plugins do show one, which made the
   family inconsistent in the direction of "this one is less able than it is".

## The decision

- `initiallyVisible: false`. The tab moves into the panel's `+` list (the host's
  `resolve-activity-tabs.ts` puts plugin tabs with `initiallyVisible: false` into `available`, with
  the plugin name as subtitle). A tool call still opens it, because every navigation tool goes through
  `ctx.ui.openActivityTab(...)`, which attaches and selects the tab. A user who adds it once has it
  for that workspace — `explicitTabVisibility` is persisted per workspace — and not for the next one.
- `retention` stays `warm` (it already was). Pinned would keep a boardmix webview, and its renderer,
  alive for the life of the window.
- **A prompt attachment appears only while this tab is the selected one.** `useActivityTab()` gives
  `active`; the hook sets the attachment when it is true and clears it (`setPromptAttachment(null)`)
  the moment it is false. `lifecycle: "sticky"` is kept so the chip survives several turns while the
  board stays the subject, and stops the moment the user looks elsewhere.
- The payload says what the panel actually knows:

  ```json
  { "panel": "boardmix", "phase": "ready", "landedUrl": "https://boardmix.cn/app/…", "canRead": false }
  ```

  `landedUrl` is the last address the webview itself reported landing on (the surface already called
  `onLanded`, which used to only persist it). `phase` is `loading` until the entry ladder resolves.
  `canRead: false` is a statement to the model: the panel's content is boardmix's own page, and this
  plugin cannot parse the canvas. A chip under the composer is not eyes — reading still means
  `boardmix_read` / `boardmix_shot`, and ADR 0007's limits are unchanged.

## What this does not do

- The chip does not make the canvas legible. Nothing here changes ADR 0007: the outline comes from
  the DOM and the picture is pixels.
- `landedUrl` is a landing report, not a live address. In-page navigation inside boardmix does not
  notify the embed, so after the user clicks around the chip can name the address the panel started
  at. It is labelled as what it is rather than advertised as "the URL".
- Eviction is unchanged and still not interceptable: a `warm` tab can be dropped when more than two
  inactive tabs compete, and the webview is then recreated on the next visit. Boardmix re-fetches its
  own state on load, so this costs a reload rather than unsaved work — which is why `warm` is
  acceptable here in a way it is not self-evidently acceptable for a document editor.
- Not verified in a live host: `useActivityTab().active` flipping the chip on and off, and the
  `+`-list entry. Both follow the same host contracts the craft family relies on, and no local run
  covers them.

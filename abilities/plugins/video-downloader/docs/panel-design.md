# Panel design notes

What the panel looks like, and which part of the research each decision came from.
Evidence quality is stated per source, because part of this research is weaker than
the conclusions built on it.

## Sources

| Source | What we could actually read | Confidence |
| --- | --- | --- |
| cobalt.tools (web app) | Live DOM and copy: one URL field as the entire first screen, an inline paste button inside the field, format pills under it, a compact result card afterwards, no account and no site picker. | High — text-level, the layout claims are read off the markup, not a screenshot. |
| yt-dlp (download engine) | CLI surface: `--dump-single-json` for probing, `-f <selector>` for a specific rendition, `--no-playlist`, `-o` output template, `--cookies`. | High — read from source. |
| Downie, 4K Video Downloader, Seal, Stacher | Product pages and documentation describing behaviour: paste-to-fetch, per-quality list with size and codec, queue with per-item progress, "show in folder" on completion, cookie import for private videos. | Medium — behaviour only. **No pixel-level evidence**: this environment could not capture screenshots (headless Chrome timed out, image input unavailable), so no spacing, colour, or typography was taken from them. |

The medium-confidence row is used only for *what a downloader must show* (quality list
with sizes, per-task progress and speed, a reveal action, cookie paste), never for visual
styling. Visual decisions come from cobalt's structure plus the host's own tokens.

## Layout

One screen, top to bottom, in the order a download actually happens:

1. **URL entry card** — the only input, full width, with a paste action inside the field
   and an analyze button attached. Featured-site monograms sit underneath as a reminder
   of what the engine accepts, not as navigation.
2. **Preview card** — appears only after a successful probe: title, source, duration,
   then one row per rendition with resolution, codec, size and a download action.
   Renditions that need ffmpeg are marked inline instead of failing later.
3. **Queue** — active tasks first, finished ones below, newest first inside each group.
   Each row is one line of state: phase label, progress bar, transferred/total, speed,
   remaining time. Actions are icon buttons (cancel, retry, reveal, remove).
4. **Empty state** — one line of copy and a hint, because an empty panel otherwise reads
   as a broken panel.

Three top-level tabs share one column: **Download** (the flow above), **Adapters**, and
**Settings**. They exist because the three surfaces answer different questions — what am I
saving now, what extra pages can this plugin read, and what is the engine allowed to do —
and 2.4.0's header icons hid two of them behind unlabelled glyphs. The Download tab keeps
the single-column order above; nothing about the primary flow gained a step. Rationale and
the rejected alternatives (a left icon rail, a modal) are in
[ADR 0002](../../../docs/adr/video-downloader/0002-panel-information-architecture.md).

## Why this shape

- **One field, not a site picker.** The engine resolves the site from the URL; asking the user to
  choose a platform first would be a step that can only be wrong. The site catalogue is
  used for labels and monograms after the fact, never as input.
- **Quality before downloading, not after.** Downie-family tools let you pick a rendition
  before the transfer starts. The engine can only honour a specific stream through `-f`, so the
  probe result is shown as the choice, and the queue receives an already-decided stream.
- **Progress is measured, not parsed.** The engine's terminal progress output is unusable
  from a child process. The service instead samples the bytes in the task's own work
  directory, which is why the published percentage can lag by a fraction of a second.
- **ffmpeg is surfaced, never installed by hand.** DASH renditions are split video/audio, so
  most 1080p downloads need a merge. The panel says so per format, the task is rejected up
  front rather than discovered at 95%, and the service fetches ffmpeg while the panel shows
  its progress — the user never sees an install button.

## Colour and theme

The plugin never hard-codes a palette. Every colour comes from the host by way of the
semantic Tailwind layer (`bg-background`, `text-foreground`, `text-muted-foreground`,
`border-border`, `bg-card`), so light and dark themes and any future host re-theme apply
without a plugin release.

This is also why site tiles use a neutral surface with a monogram instead of brand colours:
a brand palette would be a hard-coded colour that ignores the host theme, and the plugin
cannot pass arbitrary classes through the host's CSS variable mapping. A monogram keeps
the list scannable while staying theme-correct.

`assets/icon.svg` is drawn with `fill="currentColor"` and a white glyph on the filled
square, so the host can mask it to the theme foreground where it wants a monochrome icon.

## Preview and coverage (2.3.0)

Two additions follow from the same rule: show the user what they are about to get, and
never promise a platform the engine cannot open.

- **Preview card** gained the engine's cover art (`thumbnail`), a runtime badge over it,
  the uploader name, and a `Best` marker on the rendition the service recommends. When a
  site returns no cover, the monogram stays and the runtime moves into the meta line —
  the information is never dropped, only relocated. This matches what Seal, Stacher and
  Downie all surface before the download starts; the cover is the only part of a video
  page the user can verify at a glance.
- **Coverage panel** (Settings tab, collapsed behind a one-line summary) lists what the pinned
  engine resolves, grouped as international / mainland / film & series / audio / live, and names
  the reason for each platform it cannot handle. The list is served by `GET /api/v1/sites` from
  the same table `probe` enforces, so the panel and the failure message can never disagree. A
  failed fetch hides the section rather than blocking the download path, and a failed probe
  links straight to it.

The panel deliberately lists unsupported platforms. A picker that silently omits them
reads as "we forgot", while a row saying `engine has no extractor` answers the question
the user actually has, and the direct-link hint underneath gives them a way forward.

## Grouping without rules (2.6.0)

Settings rows and results used to be separated by hairline `border-t` dividers. A line answers
"where does this end" but not "what belongs together", and with nine settings a page of rules reads
as one long form. Each cluster is now its own rounded block instead: an outer
`rounded-xl border border-border bg-card p-2` with `space-y-1.5`, and inner groups on
`rounded-lg border border-border/60 bg-background/40`. The same shape carries the coverage panel,
the service status slot, the adapter cards and the download queue (one rounded row per task, no
`divide-y`). Site names are pills (`rounded-full`) because they are labels, not sections.

## Play, then decide (2.6.0)

The preview card used to be a still frame plus a download button. It now opens a real player, and
the download button is no longer the first thing the eye lands on: a player confirms what the file is
before anything is written to disk, which is the same order Stacher and Downie put the user in.
Fullscreen is a button on the player, not a separate route. When a run produced metadata only (the
Channels share page), the player is replaced by an explanation and the download button is disabled —
a dead button with no reason is the one thing the card must never show.

`Replicate` sits next to download and hands the observed facts to the conversation, so the user can
ask for something the panel cannot do (a subtitle track, a different episode) without retyping a
single value.

# Adapter examples

Every file here is a starting point you import into the panel (**Adapters → Import**). Nothing in
this directory ships inside the plugin package; the three adapters that do ship are read-only and are
listed in the panel with a `Built in` badge (`src/domain/builtin-adapters.ts`, decision record:
内置 adapter 取代了最初的自建方案）.

> `iqiyi.example.json` is kept as a template and as the record of the extract point. Its job is done
> by the built-in `iQIYI Player` adapter since 2.6.0, which walks the same `_mvInfo` tree without a
> hand-imported file.

An adapter is one function. It runs inside the target page, receives
`{ url, document, window, fetch }`, and must resolve to `{ directUrl, title?, headers?, … }`.

## iqiyi.example.json

**Status: reads the title and the signed playlist; downloading that playlist fails today.**

What the adapter does reach — measured on `https://www.iqiyi.com/v_1jm50v4hx7c.html`:

- the shell page carries no `data-player-tvid`, so the pinned engine has nothing to start from and
  its second path (`cache.m.iqiyi.com/jp/tmts`) answers `502`;
- `window.playback.msePlayback._mvInfo` still holds the signed `m3u8` the player negotiated, and the
  adapter returns it (title `伟大的长征`, one HLS playlist, `200 OK` on the manifest).

Why the download still fails:

- the manifest's segments live on `data.video.iqiyi.com` and answer `405 {"code":"D2102"}` to every
  non-player client — `curl`, `ffmpeg` (through yt-dlp) and `yt-dlp --hls-prefer-native` all fail
  at the first fragment, with or without the page cookies and with any `Referer`;
- the player does not use those URLs either. It rewrites each segment to
  `*.inter.71edge.com/videos/vts/…?key=…&dis_k=…&dis_t=…&dis_dz=…`, a ticket negotiated per playback
  by the P2P module, so no single static request reproduces a working segment list.

The plugin therefore marks iqiyi `upstream-broken` in the coverage table instead of advertising it.
Keep this file as the extract point for the day the segments become reachable again, or as a template
for a site that genuinely exposes a fetchable playlist. Narrow `meta.match` when you copy it.

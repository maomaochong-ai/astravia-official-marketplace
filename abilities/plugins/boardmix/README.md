# Boardmix plugin

Puts [boardmix](https://boardmix.cn/) — the hosted whiteboard product — inside an Astravia
activity tab, and gives the agent a small set of tools that can move that tab around.

There is no reimplementation here and no bundled copy of the site: the tab holds one Electron
`<webview>` pointed at `https://boardmix.cn`, so the canvas, templates, AI generation, comments
and export are whatever boardmix currently ships. The plugin owns the shell and the routing, not
the product.

```text
src/
  index.tsx                        # definePlugin: tab + tools
  domain/
    boardmix-destinations.ts       # the only place a hostname is written down
    boardmix-entry.ts              # entry state, seed ladder, load-failure rules
  features/boardmix-workspace/
    services/entry-target.ts       # the origin gate every navigation passes through
    services/tab-registry.ts       # the handle the tools talk to
    hooks/use-boardmix-entry.ts    # reads/writes entry/state.json
    components/boardmix-surface.tsx# the only owner of the <webview>
  tools/                           # ctx.agent.registerTool() only
agent/skills/                      # five skills; references/ holds the on-demand detail
agent/agents/boardmix-guide.md     # the persona whose systemPromptPath points here
```

## How the tab decides where to open

`boardmix-destinations.ts` pins the origin (`https://boardmix.cn`) and a handful of destinations
(`/app/`, `/app/recent-file`, `/app/create`, the AI entries, the login prefix). It does not pin a
deep link: boardmix is a SPA and its internal paths move.

`boardmix-entry.ts` builds a three-level ladder — the address the panel last landed on, then the
workspace root, then the site root — and the surface walks down it when a main-frame load fails
with anything other than `0` (success) or `-3` (aborted). Sub-frame failures are ignored: an ad or
an embedded player failing is not a reason to lose the user's page.

The landing address is written back to `entry/state.json` through `ctx.storage`, but only after
`boardmixUrlOf()` has accepted it (https, boardmix host). A redirect to a foreign origin is
therefore never persisted and never becomes the next seed.

Every programmatic navigation — including the agent's — goes through
`resolveEntryTarget()`, which answers `{ ok: true, url }` or
`{ ok: false, reason: "origin-not-allowed" | "invalid-url" }`. The gate is one function, so a new
tool cannot forget it.

## Agent surface

| Tool | What it does |
| --- | --- |
| `boardmix_open` | Opens the tab (or reuses it) and reports the snapshot |
| `boardmix_goto` | Navigates to a destination key or a boardmix URL, through the gate |
| `boardmix_new` | Sends the tab to the blank-board entry |
| `boardmix_ai` | Sends the tab to the AI PPT / flowchart / chat entry |
| `boardmix_tab_status` | Reads the snapshot; never opens the tab |
| `boardmix_open_in_browser` | Hands the current address to the system browser |

Every tool returns the same envelope: `{ ok, open, url, origin, phase, seedLevel, landedAt, next }`,
serialized as JSON. `next` is a sentence the model can act on, not a code. The tools are
deliberately limited to *reaching* a place; reading the canvas, clicking inside boardmix, running
a generation or exporting a file are not exposed, because no supported interface exists for them.
`boardmix_new` and `boardmix_ai` say so with `needsUserAction: true`.

The five skills under `agent/skills/` carry the part that is not a tool call. Only each skill's
`name` and `description` enter the model's context, so the description is what actually routes:
it states the outcome, then `Use when …`, then `Do NOT use for …` and where to go instead. The
body loads on demand and keeps a fixed shape — one rule, a routing table, a workflow, a definition
of done, and what not to say. Details that only matter mid-task (the envelope fields, the page map,
Mermaid recipes, a workshop timeline, prompt templates, the import/export matrix) sit in each
skill's `references/` and are read only when that step is reached.

`agent/agents/boardmix-guide.md` is the persona: it tells the model to work through the `boardmix`
skill, which situations to watch for, and the shape of a closing message. It declares no `roles`,
so it does not take a preset role slot in the host.

## Developing

```bash
cd abilities/plugins/boardmix
npm install          # @astravia-org/* resolve to ../../../../.tooling/open-astravia/packages
npm run check        # tsc --noEmit
npm test             # vitest run
npm run build        # vite build, emits dist/ and release/*.astraviapkg
```

`dist/` and `release/` are build output and are not committed; the marketplace build produces the
signed package in CI.

Tests cover the two places where a mistake is expensive: the entry ladder and origin gate
(`src/domain/boardmix-entry.test.ts`) and the surface's reaction to `dom-ready`, `did-navigate`
and `did-fail-load` (`components/boardmix-surface.test.tsx`, with a stand-in for the Electron
guest).

## Known limits

- Boardmix is a hosted product: the panel needs a network connection, and offline use is not
  possible.
- The plugin does not proxy, cache or mirror boardmix traffic.
- The agent can route the tab, not operate the canvas.
- Free-tier quotas and watermarks are boardmix's, not the plugin's, and are neither included nor
  worked around here.

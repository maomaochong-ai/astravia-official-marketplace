# Boardmix 1.8.5 — how its own AI drives the canvas

Target: `C:\Users\诸葛跃\Downloads\boardmix_win_1.8.5_x64.exe` (124,015,960 bytes, Inno Setup 6.3+ loader).
Analysis date: 2026-11-10. Everything below is either **observed** (read out of the shipped bytes) or
**inferred** (a conclusion drawn from what was observed). Unknowns are listed as unknowns.

## How the package was opened

| Step | Result |
| --- | --- |
| `innoextract 1.9` on the installer | **failed** — `Unexpected setup loader revision: 2`; Inno 6.3+ is newer than this extractor |
| silent install to a temp directory (`/VERYSILENT /DIR=%TEMP%\boardmix-installed`) | worked; wrote nothing outside that folder except the usual uninstall entry |
| `resources/app.asar` → `@electron/asar extract` | 5,609 files: `packages/{main,preload,renderer}` |

The extracted tree lives at `%TEMP%\boardmix-asar` and `%TEMP%\boardmix-installed`; the installer's own
`unins000.exe` removes the install when the analysis is done.

## What the desktop app actually is

`app.asar/packages/main/dist/index.mjs` (1.1 MB, 143 lines) carries **one inline source map** with
`sourcesContent` for 91 TypeScript files. Decoding it recovers the shell's original source, which is why
the claims below can cite real file names instead of minified offsets:

| Recovered file | What it does |
| --- | --- |
| `src/channel/window.main.ts`, `src/channel/view.main.ts` | the Electron window/tab model; the web app runs in a `<webview>` |
| `src/services/offline*.ts` (≈ 60 KB) | offline board cache: resource lists, font cache, plan/diff |
| `src/services/kiwi-service.ts`, `src/database/models/kiwi.ts` | `.kiwi` document blobs, kept in a local Postgres |
| `src/database/*`, `resources/libs/pglite/*` (31 MB of wasm) | PGlite — a full Postgres compiled to wasm, storing files/versions/users/kiwi blobs locally |
| `src/services/file-service.ts`, `src/server/server-api.ts` (41 KB) | local file API + a loopback server for the web app |
| `src/menu/*`, `src/dialog/*`, `src/locales/*` | native menus, updater/offline dialogs, 5 UI languages |

**Conclusion (observed):** the desktop app is a **shell**. It owns windows, the local database, the
offline cache and the file bridge. It contains **no canvas code and no AI code** — `grep` for
`createSticky`, `board`, `tool_call` over the recovered 91 files finds nothing that draws.

So: **the canvas and the AI are the web app**, loaded from `cdnhw.boardmix.cn` into that webview.

## The web app's shape

Fetched read-only for inspection (`%TEMP%\boardmix-web`):

| Asset | Size | Why it matters |
| --- | --- | --- |
| `app/assets/index-Ddp4znH9.js` | 4.76 MB | the SPA: routes, paste menu, Mermaid import, canvas API, event channels |
| `app/assets/i18n-BzFOPgMg.js` | 2.79 MB | five language catalogues — the product's own vocabulary |
| `app/assets/AiAgent-15DyJnpr.js` | 44 KB | the `/agent` route (the AI surface), lazy-loaded |
| `app/assets/vendor-board-DJOJlJiI.js` | 86 KB | board bootstrap |
| `app/assets/markdown-transform-DGQLrror.js` | 62 KB | renders **chat** markdown; it is not a canvas converter |

Routes observed in the router table: `/agent` is the real AI page, and `/ai/chat` plus `/ai/ppt`
**redirect** to it. The panel in this session sits on `/app/` (workspace), which is why the AI entry is a
navigation away rather than a separate app.

## How the canvas is programmable

Inside `index-Ddp4znH9.js` there is one object literal (`xWt`, 7.6 KB) built on a wasm core handle
(`q4`), plus a flat wrapper (`FWt`) that adapts arguments per method. Its method table — read verbatim
from the bundle — is the product's canvas API:

**Create** `createFrame` `createSticky` `createShape` `createText` `createMM` `createTable`
`createConnector` `createIframe`
**Select / order** `getById` `getSelect` `select` `deselect` `bringToFront` `sendToBack` `remove`
**Geometry** `move` `moveTo` `resize` `getWidth/setWidth` `getHeight/setHeight` `getRotation/setRotation`
`getRadius/setRadius` `getPosition` `getTransform` `getParentId` `getChildId`
**View** `getView` `setView` `getZoom` `setZoom` `zoomTo` `converBoardToScreen` `converScreenToBoard`
**Structure** `frameAddItem` `frameRemoveItem` `frameShowContent` `frameTitle` `MMAddSub` `MMLayout`
`isLocked/setLocked` `isVisible` `setFold/getFold` `filterByType` `getShapeTextContent`
**Style** `getStyle` `getFillStyle/setFillStyle` `setFillColor` `setFillOpacity` `setFillType`
`getStrokeStyle/setStrokeStyle` `setStrokeColor` `setStrokeWidth` `setDashArray` `setArrowStart` `setArrowEnd`
`setTextContent` `setTextForeground` `setTextBackground` `setTextBold/Italic/Underline/ThroughLine`
`setTextVAlign/HAlign` `setTextFamily` `setTextPartHeader` `setEffectVisible`

`createSticky` takes `{x, y, width, height, content, style, subType}` and returns
`{id, type, subType, style, props}` — a real object model, not pixels.

**How an outside actor reaches it (observed):** `Xs && Qt.bind("boardOpenApi", xWt)` — the API is bound to
an internal bridge **behind a debug flag**, and the flat wrapper is what the embed routes use. There is no
`window.boardmix*` global in the bundle (0 hits for `window.boardmix`, `__boardmix`, `globalThis.boardmix`).

**Inferred:** the canvas API is a first-party SDK surface for `/embed` and `/sdk` pages, not a page global.
A different origin that merely loads `/app/` (which is what our plugin's panel does) cannot call it.
**Unknown:** whether the `/embed` route would expose it across origins for us to use; not tested, because
it needs an embed token.

## How the AI drives the canvas

Observed in the bundle and its language catalogues:

- The AI page is `/agent`; `/ai/chat` and `/ai/ppt` redirect there.
- AI is billed and gated in the client: channels `GET_AI_SIGN`, `CHECK_AI_IMG`, `AI_GENERATE_IMAGE`,
  `ENABLE_AI_SUMMARY`, `AI_TOOL_CONNECT`, `AI_TOOL_MATT_IMAGE`, `AI_TOOL_FIX_IMAGE`, `AI_IMAGE_COLLECT`,
  `AI_IMAGE_COMPLAINT`, `ENABLE_MULTI_TRANSLATE`. The UI asks the shell for an AI signature
  (`GET_AI_SIGN`) and for the access token (`GET_ACCESS_TOKEN`) before a generation.
- The board talks to its shell through 23 named channels (`kt.*`) — `OPEN_API_EVENT_CALLBACK`,
  `PAGE_PREPARED`, `LOADING_FILE_START/SUCCESS`, `GET_FILE_USERS`, `DOWNLOAD_FILE`, `UPDATE_FILE_COVER`,
  `SHARE_WITH_NODE`, `COPY_EMBED`, … — and 79 inbound handlers (`BUt("name", fn)`), e.g.
  `updateSelectionProperties`, `deleteFrame`, `generateToOtherType`, `openNewPPTFramePanel`,
  `exportToVsdx`, `insertImageIntoImageCollage`.
- Seven float-tool kinds are marked as AI/OpenAPI surfaces: `OPEN_API_TOOL_PREVIEW`,
  `OPEN_API_TOOL_EDIT`, `OPEN_API_MULTIPLE_FLOAT_TOOL`, `OPEN_API_SINGLE_FLOAT_TOOL`,
  `OPEN_API_INJECT_UI`, `OPEN_API_CREATE`, `OPEN_API_UPDATE`, `OPEN_API_CLASSIFY`, `OPEN_API_ERROR`,
  `OPEN_API_CREATE_NATIVE_ELEMENT`, plus `AI_GENERATE_IMAGE` and `AI_TOOL_CONNECT`.

**Inferred (the important one):** the AI's canvas edits are produced **server-side from the user's
prompt** and applied through the same core (`q4`) that `xWt` wraps — the client ships the *insertion*
vocabulary (`createSticky`…`createMM`) but no prompt→shape planner, and the AI needs a signature from the
shell before it runs. There is no client-side "tool calling" table to call directly.

## What the product can convert, which we can use

The canvas accepts **Mermaid** and turns it into native, editable shapes. Observed strings:

| Key | zh-CN |
| --- | --- |
| `mermaidDiagram` | `Mermaid 绘图` |
| `mermaidDiagramTips` | `支持解析mermaid格式的流程图、时序图、ER图、类图、饼图和象限图。` |
| `flowchartGeneratedSuccess` | `成功生成 {val} 个流程图` |
| `noMermaidContentDetected` | `未检测到支持 Mermaid 的文件内容` |
| `IMPORT_MERMAID` | icon id `import-mermaid` |

The Mermaid library itself is bundled and initialised by the board page (`mermaid.run` /
`querySelector: ".mermaid"`). The paste menu also carries `粘贴为 Markdown`, `思维导图粘贴为带格式文本`,
`思维导图粘贴为纯文本` — text paste has formatting choices, not diagram synthesis.

**Conclusion:** the supported semantic bridge between *us* and the canvas is **Mermaid text handed to the
product's own importer**. The current plugin skill claims "a Boardmix canvas accepts pasted Markdown" —
that claim is **not supported** by the shipped bytes; the verified path is Mermaid.

## What this means for our plugin

1. We cannot call `createSticky` etc. The panel is `/app/`, cross-origin, and the API is not on `window`.
   (ADR `bm-0001`.)
2. We *can* hand the product Mermaid, and the product will create real shapes from it — one verified
   convertor instead of a hundred coordinate clicks. (ADR `bm-0002`.)
3. We *can* drive the product's own AI page (`/agent`), because it is an ordinary page: focus its composer,
   put the prompt in, press send. The AI then edits the canvas itself. Points are the user's. (ADR `bm-0003`.)
4. Canvas content is still pixels to us: the object model lives in a wasm core we cannot read. Shots remain
   the only way to see the board.

## Artefacts kept from this analysis

| Path | Content |
| --- | --- |
| `%TEMP%\boardmix-src\src\**` | the shell's 91 recovered TypeScript sources |
| `%TEMP%\boardmix-web\app\assets\index-*.js` | the shipped SPA bundle |
| `%TEMP%\boardmix-web\canvas-api.txt` | the `xWt` object literal, verbatim |
| `%TEMP%\boardmix-web\sdk-bridge.txt` | the `xWt` + `FWt` + `Qt.bind("boardOpenApi")` region |
| `%TEMP%\boardmix-web\channel-enum.txt` | the float-tool / channel enum excerpt |

## Unknowns worth naming

- Whether `/embed` or `/sdk` exposes the canvas API to a parent frame, and under what token. Untested.
- Whether the `/agent` composer accepts a synthetic `paste` event (our CJK route) or only real input.
- Whether Mermaid import is reachable without the AI (a creation entry, an import dialog, or paste).
  The strings prove the *converter* exists; the *entry point* was not clicked through.

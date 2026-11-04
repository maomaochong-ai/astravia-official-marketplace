# Excalidraw

Sketch diagrams, wireframes and flowcharts on an infinite hand-drawn canvas inside Astravia — the upstream Excalidraw editor, driven from the conversation.

插件把上游 Excalidraw 的 **web 应用**放进活动面板的一个 iframe 里跑：同一份 JavaScript、同一套工具、
同一套素材库，没有分支、没有重写，也没有我们另画的编辑器界面。区别只有一个——站点是我们在打包时
用上游源码构建出来的，因为 Excalidraw 官方不发布 web 包。

## 上游钉在哪儿

| | |
| --- | --- |
| 上游仓库 | https://github.com/excalidraw/excalidraw |
| commit | `dd2f8fc32b92cbf56f4abee6a0cf3b14681b4b55` |
| 应用包 | `excalidraw-app` |
| 许可证 | MIT |
| 构建配方 | `scripts/build-excalidraw-web.mjs`（`recipeVersion: 1`） |
| 站点 | 打包时构建，`web/` 不进 git |

pin 写在 `payload/manifest.json`（`schemaVersion: 5`、`build.kind: "source-build"`）。要跟进上游，就换
`build.commit` 并在本地重跑一次配方——脚本会重新装依赖、构建，然后跑一组断言。

## 站点是怎么来的

`node scripts/build-excalidraw-web.mjs --slug excalidraw` 做这几件事：

1. 按 pin 取那个 commit 的源码（`--source <dir>` 可以复用一份已经装好依赖的树）；
2. 用 `npx -y yarn@1.22.22` 按 `yarn.lock` 装依赖（CI 走 `--frozen-lockfile`）；
3. 生成一份**包装配置** `vite.astravia.config.mts`：import 上游默认配置，摘掉 `vite-plugin-pwa`、
   `vite-plugin-sitemap`、`vite-plugin-checker`，`base: "./"`，sourcemap 关；
4. 跑上游自己的 `vite build`；
5. 后处理 `index.html` 与 CSS：把 `EXCALIDRAW_ASSET_PATH` 从 CDN 改成 `document.baseURI`，
   CDN 的 preload 与 `url()` 改回包内相对路径，删掉 `_headers` / `sw.js` / `manifest.webmanifest` /
   `workbox-*`；
6. 断言：`index.html` 里没有根绝对 `src|href`、没有 `127.0.0.1|localhost`、字体引用 > 0 且
   每个引用的 woff2 都真的在包里（否则手写体会静默回退到 esm.sh）。

上游源码一行不改，编译出来的 JS 一份不动。变的只有页面资源路径与 PWA 注册——所以别对外说
"逐字节原样"。

## 一次打开会经过什么

1. 面板从包里取 `web/index.html` 的**文本**（导航到 `.html` 只会触发下载，不会执行脚本）。
2. 在 `<head>` 后注入 `<base href>`：站点因此能在任意前缀下加载，`EXCALIDRAW_ASSET_PATH` 取
   `document.baseURI` 也才有意义。
3. 紧跟一段 `history.replaceState` 补一个 URL，紧接着把 `document.referrer` 定义成恒为 `""`：
   上游开头有一段自嵌入防护，比对 `referrer` 与 `location.href` 的 origin；`about:srcdoc` 与打包页面的
   origin 都是 `"null"`，不清空就会命中，页面会直接渲染 `I'm not a pretzel!`（见 ADR 0001）。
4. 再按键把语言写进 `?lng=zh-CN|en`（上游 `i18next-browser-languagedetector` 的第一优先级）。
5. 末尾注入 `host-bridge.js`：open / save 走宿主，手势与探测走同一条 `postMessage`。
6. 页面发 `craft:ready` 后面板才允许 `craft:open`，状态条从"准备中"变成"就绪"。

## 目录里有什么

| 路径 | 是什么 |
| --- | --- |
| `src/app.config.ts` | 唯一按应用变化的源文件：id、名称、站点目录、语言种子、上游仓库 |
| `src/features/**` | 标签页、状态条、会话、Agent 工具 |
| `src/bridge/host-bridge.js` | 页面里的桥：文件、手势、文字地图 |
| `payload/manifest.json` | 构建期来源声明（不进包） |
| `agent/skills/excalidraw/SKILL.md` | 交给 Agent 的作业说明 |
| `web/` | 构建产物，gitignore |

决策记录在 [`docs/adr/excalidraw/`](../../../docs/adr/excalidraw/README.md)。

## 本地跑

```bash
cd abilities/plugins/excalidraw
npm install
npm run check                                   # tsc --noEmit
node ../../scripts/build-excalidraw-web.mjs --slug excalidraw   # 构建站点到 web/
npm run build                                   # dist/ 本地预检
```

`npm run build` 产出的 `release/*.astraviapkg` 不含 `web/`——正式包由市场打包器
（`scripts/stage-plugin-release.py`）生成，它会把 `web/` 一起带上。

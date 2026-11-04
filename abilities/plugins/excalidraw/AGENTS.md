# excalidraw 插件工作须知

这个目录是**手写源码**，不是产物。宿主侧代码（`src/**`、`src/bridge/host-bridge.js`）从 craft 家族
那一套外壳起步，但这里是**独立一支**：不参与 `tests/craft-parity.test.mjs` 的逐字节比对，也不在
`tests/craft-manifest.test.mjs` 的钉子名单里——改这里不会牵动其它插件，同样也不需要跟它们保持一致。
来龙去脉写在 [`docs/adr/excalidraw/0001-the-tab-runs-upstreams-web-build.md`](../../../../docs/adr/excalidraw/0001-the-tab-runs-upstreams-web-build.md)。

编辑器本体**不是我们写的**：`web/` 是上游 `excalidraw/excalidraw` 在 `payload/manifest.json` 钉住的
那个 commit 上、由 `excalidraw-app` 自己构建出来的站点。我们不改它的源码，也不改它编译出来的 JS；
构建脚本只做两件事——用一份包装配置把 PWA/站点地图插件摘掉并把 `base` 设成 `./`，以及把产物里
指向 CDN 的资源路径改回包内。为什么站点走 `srcdoc` 而不是导航进去，见
[`docs/adr/excalidraw/0001-the-tab-runs-upstreams-web-build.md`](../../../../docs/adr/excalidraw/0001-the-tab-runs-upstreams-web-build.md)
与 [`docs/adr/excalidraw/0002-bytes-move-through-the-host.md`](../../../../docs/adr/excalidraw/0002-bytes-move-through-the-host.md)。

## 开工

```bash
cd abilities/plugins/excalidraw
npm install
npm run check      # tsc --noEmit
npm run build      # dist/ 供本地预检，正式 .astraviapkg 由 CI 构建
node scripts/build-excalidraw-web.mjs --slug excalidraw   # 下载上游 commit、构建并 staging web/；--if-missing 跳过已就位的
```

`--source <dir>` 可以指向一份已经装好依赖的上游源码树，省掉重复下载与安装（本地验证时用）。

## 改东西的正确位置

| 想改什么 | 改哪里 |
| --- | --- |
| 标签页、状态条、文件桥、Agent 工具的行为 | `src/features/**`、`src/bridge/**` |
| 帧文档的拼装：`<base>`、`replaceState`、语言种子、bridge 注入 | `src/features/editor/services/site-document.ts` |
| 页面里的 open/save 钩子、暂停闸门、手势注入 | `src/bridge/host-bridge.js` |
| 这个应用的名字、版本、站点目录、语言种子 | `src/app.config.ts`、`plugin.json`、`payload/manifest.json`、`locales/*.json` |
| 技能的说明文字 | `agent/skills/excalidraw/SKILL.md` |
| 站点怎么从源码构建出来 | `scripts/build-excalidraw-web.mjs`（就在本插件目录里） |
| 编辑器界面本身 | 不改；那是上游 `excalidraw-app` 的构建产物 |

改完跑：

```bash
node --test tests/excalidraw-plugin.test.mjs      # 在仓库根
npm run build
```

## 硬约束

- **`web/` 不进 git**：`abilities/plugins/*/web/` 在 .gitignore 里，CI 在打包前从 pin 住的 commit 构建。
  手改会在下一次构建时被覆盖，也不能提交；要换版本就改 pin，别改字节。
- **站点只能是相对路径**：页面要能在任意前缀下加载，`web/index.html` 里不允许 `src="/…"` 这种根绝对
  路径，也不允许残留 CDN 主机名（`scripts/build-excalidraw-web.mjs` 会直接拒绝）。
- **不伪造上游身份**：`payload/manifest.json` 的 `build.upstream` / `build.commit` 必须是真实仓库与
  真实 40 位 commit；`.build.json` 由构建脚本写，不要手编。
- **语言走 `?lng=`**：Excalidraw 自己的 `i18next-browser-languagedetector` 优先读这个查询参数，
  不要改成操作 `localStorage` 或 `navigator.language` 来切界面语言。
- **PWA 用构建期剥离**：`about:srcdoc` + `astravia-plugin://` 下 `navigator.serviceWorker.register` 必然
  失败，所以在包装配置里摘掉 `vite-plugin-pwa`，不要在运行期兜这个错。
- **文件桥只认 `event.source === iframe.contentWindow`**，不要放宽。
- **打开接缝要拦两个 API**：`browser-fs-access` 的 legacy 路径写的是
  `"showPicker" in HTMLInputElement.prototype ? showPicker() : click()`，Chromium 上永远走前者。
  只 hook `click` 时暂存文件永远投不进去（实测 `showPicker` 1 次、`click` 0 次）。
- **投递前判 `accept` 时，“零个有效 token”等于“什么都要”**：上游 `loadFromJSON` 用
  `fileOpen({})`，输入框上的 `accept` 会落成 `","`。把它读成“不匹配”会让应用一遍遍重新要文件。
- **事件发 `.interactive`，读回要合层**：场景画在 `canvas.excalidraw__canvas.static` 上，
  `probe` / `capture` 必须按 DOM 顺序合成所有 `canvas.excalidraw__canvas`，否则画满的页面会读成空白。
- **改了 `src/**`、`plugin.json`、`locales/`、`agent/` 就要抬版本**，否则 CI 的 `--strict` 会红。
- **API 接缝不是可选项**：站点里的 `window.__ASTRAVIA_EXCALIDRAW__` 由配方生成的
  `astravia-excalidraw-api.tsx` 发布，它把 `@excalidraw/excalidraw` 的包根整个 re-export，只包一层
  Provider 取出应用自己创建的 API 对象。没有它，`excalidraw_scene` 只能回 `no-scene-api`，
  Agent 就只能靠拖鼠标画图。配方断言产物里出现这个全局名。
- **场景读写不经过保存路径**：`excalidraw_scene` 的 `export` 把字节交回工具、由「另存为」落盘；
  不要把它改回 `craft:save`，那会把导出的图片绑成文档的保存目标。
  `payload/manifest.json` 是构建期的来源声明，不进包也不触发这条门禁——但改它通常意味着要重发一版站点。

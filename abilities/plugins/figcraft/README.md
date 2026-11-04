# FigCraft

Design interfaces and prototypes inside Astravia — the upstream FigCraft editor, with frames, auto layout, components and variants, variables and click-through prototypes.

插件把上游 FigCraft 的 web 应用放进活动面板的一个 iframe 里跑：同一份 wasm、同一份 JavaScript，
没有分支、没有重新编译，也没有我们另写的编辑器界面。站点由 CI 用上游源码构建、随插件包分发——
不是上游的发版 zip。

## 上游钉在哪个 commit

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/figcraft |
| 构建目标 | `apps/figcraft-web`（上游自己的 web crate） |
| 构建配方 | 上游自己的 `trunk build --release` |
| commit | `35684eaa028e636d264073a666ef11881620fa0e` |
| 上游版本 | `0.15.0` |
| 站点体积 | 由 CI 在打包前构建（`web/` 不进 git） |

`payload/manifest.json` 钉的就是这个 commit：CI 检出它、跑上游自己的 `trunk build --release`，
把产物放进 `abilities/plugins/figcraft/web/`，然后才打包。源码级可复现，比钉一份 zip 的摘要更严，
也让"上游还没发版"不再阻塞跟进。

## 一次打开会经过什么

1. 面板从包里取 `web/index.html` 的**文本**。宿主给 `.html` 的 MIME 是 `application/octet-stream`，
   把 iframe 直接导航过去只会下载文件，不会执行脚本。
2. 在 `<head>` 前注入 `<base href>`——相对路径的 `./app.js` 与 `./*_bg.wasm` 才落在包里。
3. 紧跟一段 `history.replaceState`：`about:srcdoc` 本身没有 URL，而上游用
   `new URL("…_bg.wasm", location.href)` 找 wasm、用 `location.search` 读渲染降级标志。
   垫上之后 `location.href` 就是真实的插件 URL，`location.search` 是 `?nosw&hl=zh` 这样的真参数。
4. 宿主语言是中文、且这个构建允许时，注入界面语言种子。
5. `</body>` 前内联 `host-bridge.js`。
6. 拼好的文档交给 `srcdoc`。没有进程、没有端口、没有首次下载，也没有准备页。

编辑器和面板之间只走 `postMessage`，消息前缀是 `craft:`。

## 界面语言

这个上游构建只有英文界面，画布因此保持英文。硬切中文只会得到英文文案加中文日期与数字格式，那是更隐蔽的错位，所以语言种子留空。
外壳（标签标题、状态条、本页说明）仍是中英双语，跟随 Astravia 语言。
边界与判据见 [`docs/adr/figcraft/craft-0007-chinese-comes-from-the-shell.md`](../../../../docs/adr/figcraft/craft-0007-chinese-comes-from-the-shell.md)。

## 文件怎么进、怎么出

- **进**：在资源管理器选中文件 → 编辑器里按打开 → 插件读文件字节、`postMessage` 给页面。
- **出**：页面里保存/导出 → 页面把 blob 交给 `host-bridge.js` → 面板拿到字节 → 经宿主写回工作区。

浏览器入口（把同一页开在浏览器里）没有这条桥，用的是浏览器自己的选择框和下载。

## 开发

```bash
npm install
npm run check                                            # tsc --noEmit
npm run build                                            # tsc --noEmit && vite build
node ../../scripts/build-craft-web.mjs --slug figcraft        # 重建 web/web/（需要 rust、`wasm32-unknown-unknown` 目标和 trunk）
```

`src/**` 在十五支 craft 插件之间逐字节相同，唯一按应用不同的是 `src/app.config.ts`（还有
`plugin.json`、`payload/manifest.json`、`locales/` 与展示层文件）。这里就是源码：改共享行为要在十五支上
做同样的改动，`tests/craft-parity.test.mjs` 会在漏改时失败。见
[`docs/adr/figcraft/craft-0001`](../../../../docs/adr/figcraft/craft-0001-seven-copies-and-a-parity-test.md)。

`web/` 不要手改：它由 CI 从上游 commit 构建，下一次构建会覆盖。

## 权限

见 `plugin.json` 的 `permissions`：活动面板槽位、文件读写、工作区读取、Agent 工具注册与执行、技能控制。
没有服务权限——站点跑在面板的 iframe 里，不需要常驻进程，也没有回环端口。

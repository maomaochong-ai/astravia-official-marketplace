# PDFCraft

Read and rearrange PDFs inside Astravia — the upstream PDFCraft workbench for merging, splitting, rotating and securing documents, with no account and no telemetry.

插件把上游 PDFCraft 的**官方 web 构建**放进活动面板的一个 iframe 里跑：同一份 wasm、同一份
JavaScript，没有分支、没有重新编译。插件自己只做上游不做的事——把文件供给进去、把面板和编辑器
连起来、把这些能力交给 Agent。

## 上游钉在哪个版本

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/pdfcraft |
| 发布的 web 包 | `pdfcraft-web-0.17.0.zip` |
| 版本 | `0.17.0` |
| 大小 | 17,417,347 B（17 MB） |
| sha256 | `393420ab35e25afc174cb6d1791098bb714099aca91cf6598b4553e57c48a835` |

这些数字来自实际下载的发布包，不是从 README 抄的；`payload/manifest.json` 里的 `sha256`
是唯一信任锚，下载来的包对不上就拒绝使用（ADR 0008）。

## 一次打开会经过什么

1. 插件起一个只监听 `127.0.0.1` 的服务（`server/hub.mjs`，由 `hub.src.mjs` 生成）。
2. 服务从 0.17.0 的发布包里取 web 构建；已缓存且 sha256 对得上就直接用，否则下载一次。
3. 下载期间标签页显示的是准备进度（应用名、一句说明、真实百分比），不是错误页；失败才展开诊断。
4. 标签页的 iframe 指向这个服务；服务把 `index.html` 原样送出，只额外注入两个脚本：
   语言预设（只有这个构建能画中文时才注入）和 `host-bridge.js`。
5. 编辑器和面板之间只走 `postMessage`，消息前缀是 `craft:`。

## 界面语言

这个上游 web 构建没有内嵌中文字形（`unzip -l` 里只有 `OFL-noto-sans-cjk-sc.txt` 这类许可证
文本），强行切中文只会得到一屏空方框，所以界面保持英文。要支持中文需要上游把 CJK 字体加进
`theme::install` 并重编 wasm，那会产出 60–90 MB 的制品，超出 25 MB 包体上限。详见
`docs/adr/craft/0003`。


## 文件怎么进、怎么出

- **进**：在资源管理器选中文件 → 编辑器里按打开 → 插件读文件字节、`postMessage` 给页面。
- **出**：页面里保存/导出 → 页面把 blob 交给 `host-bridge.js` → 面板拿到字节 → 经宿主写回工作区。

浏览器入口（把同一页开在浏览器里）没有这条桥，用的是浏览器自己的选择框和下载。

## 开发

```bash
npm install
npm run check    # tsc --noEmit + build-hub --check
npm run build    # 重建 server/hub.mjs 并打包
```

`src/` 与 `server/` 是 `tools/craft/stem/` 的逐字节副本，唯一按应用不同的是
`src/app.config.ts`。改共享代码要改 stem，再跑 `node tools/craft/generate.mjs pdfcraft`；
直接改这里的副本会在下次生成时被覆盖。

## 权限

见 `plugin.json` 的 `permissions`：活动面板槽位、浏览器打开、外部打开、文件读写、
工作区读取、Agent 工具注册与执行、技能控制。服务不需要额外权限——它只监听回环地址，
文件读写都由渲染侧经宿主完成。

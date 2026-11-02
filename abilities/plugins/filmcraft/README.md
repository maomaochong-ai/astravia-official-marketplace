# FilmCraft

Cut video on a real timeline inside Astravia — the upstream FilmCraft non-linear editor with colour, sound and a WebGL fallback for machines without WebGPU.

插件把上游 FilmCraft 的**官方 web 构建**放进活动面板的一个 iframe 里跑：同一份 wasm、同一份
JavaScript，没有分支、没有重新编译。插件自己只做上游不做的事——把文件供给进去、把面板和编辑器
连起来、把这些能力交给 Agent。

## 上游钉在哪个版本

| | |
| --- | --- |
| 上游仓库 | https://github.com/storytold/filmcraft |
| 发布的 web 包 | `filmcraft-web-0.16.0.zip` |
| 版本 | `0.16.0` |
| 大小 | 15,097,399 B（15 MB） |
| sha256 | `79da0f879f86f4520c1721d8296dfa61220c33eb0e39bf8e58fd883388800431` |

这些数字来自实际下载的发布包，不是从 README 抄的；`payload/manifest.json` 里的 `sha256`
是唯一信任锚，下载来的包对不上就拒绝使用（ADR 0008）。

## 一次打开会经过什么

1. 插件起一个只监听 `127.0.0.1` 的服务（`server/hub.mjs`，由 `hub.src.mjs` 生成）。
2. 服务从 `0.16.0` 的发布包里取 web 构建；已缓存且 sha256 对得上就直接用，否则下载一次。
3. 标签页的 iframe 指向这个服务；服务把 `index.html` 原样送出，只额外注入两个脚本：
   语言种子（如果这个应用需要）和 `host-bridge.js`。
4. 编辑器和面板之间只走 `postMessage`，消息前缀是 `craft:`。

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
`src/app.config.ts`。改共享代码要改 stem，再跑 `node tools/craft/generate.mjs filmcraft`；
直接改这里的副本会在下次生成时被覆盖。

## 权限

见 `plugin.json` 的 `permissions`：活动面板槽位、浏览器打开、外部打开、文件读写、
工作区读取、Agent 工具注册与执行、技能控制。服务不需要额外权限——它只监听回环地址，
文件读写都由渲染侧经宿主完成。

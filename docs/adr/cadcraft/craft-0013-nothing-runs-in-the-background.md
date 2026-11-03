# 后台什么都不跑

插件在被打开之前不占任何运行资源：没有服务进程，没有下载，没有定时器，
没有对上游的轮询。十六支插件同时启用，代价是十六个已注册的 UI 插槽，
不是十六个应用。

> **取代**：`craft-0004-inactive-tabs-stop-drawing.md` 的暂停闸门。闸门是为了让
> iframe 里的 wasm 停止申请动画帧；iframe 不在了，闸门也就没有对象了。

## 起点：卡顿是从哪来的

"装上几支 craft 插件、同时开着标签，整个宿主就卡"——这句反馈是可复现的，原因有四层，
全部来自搬运架构：

1. **进程**：每支插件的 `providers.services` 声明一个 `host-node` 运行时，主进程为它起一个
   Node 子进程跑 `server/hub.mjs`。启用八支就是八个进程，十六支就是十六个。
2. **内存**：每个 hub 里有一个解压缓存（`INFLATE_BUDGET` 96 MB）和一棵静态文件表；
   多个 hub 同时在场，常驻内存线性上涨。
3. **渲染**：每个标签是一个独立的 WebAssembly 应用，有自己的绘制循环。标签不在前台时
   循环仍在跑——这正是 `craft:pause` 闸门存在的原因，而闸门需要桥去按时停止它。
4. **启动**：冷启动要下载 13–50 MB 的 zip、校验 sha256、解压、初始化 wasm。
   用户体感是"点了没反应"，于是多点几次，于是更多下载。

插件侧能做的优化在 1–4 之中只有一部分：ETag、LRU 缓存、96 MB 解压上限、
`VisibilityObserver` 驱动的暂停。它们让症状轻一些，但没有改变"每支插件是一个应用"。

## 决定

**把常驻成本降到零。**

- 删掉 `providers.services`，删掉 `server/`。宿主不再为这些插件起进程。
- 删掉 `payload/` 与下载路径。打开标签不再有网络请求。
- 删掉 iframe 与 `host-bridge.js`。没有跨文档消息，没有暂停闸门，没有降级协商。
- 文档存在插件存储里（`document.json`，几十 KB），打开标签是一次读取，不是一次启动。
- 画布只在可见时绘制：`KernelCanvas` 的绘制由 React 的 effect 驱动，
  引擎自己不含 `requestAnimationFrame` 循环。没有变化就没有绘制。
- Agent 的批量执行是唯一的节奏源：每步之间 `await frame()` 一次，
  批量结束就停。没有轮询。

## 这解决不了什么

写清楚，免得下次又把它当成万能药：

- **宿主自己的卡顿**不在这里。插件只为自己那部分负责；宿主进程、主窗口渲染、
  会话列表的开销不在插件侧。
- **画布很大时仍然要画**。一个 1600×900 的页面在 60 Hz 下重绘是正常的绘图成本，
  与"十六个 wasm 应用"不是一个量级，但不是零。
- **打开十六个标签仍然占内存**。每个标签有一张 canvas 和一个文档；这是 UI 的固有成本。

## 证据

- Observed：`plugin.json` 已无 `providers` 键；`plugin.json` 里不再有 sha256
  （`tests/craft-manifest.test.mjs` 已相应改写）。
- Observed：包内容里没有 `server/`、`payload/`；`dist/assets/*.js` 不再内联 hub 源码。
- Observed：`grep -r "host-bridge\|craft:pause\|serviceArtifact" src/` 无命中。
- Inferred：进程数从"最多 16"降到 0；打开标签的首次可见时间从秒级降到一帧级。
  这两个数字来自架构，不是来自本轮在宿主里的实测——**未做 before/after 计时**，
  如实标注。

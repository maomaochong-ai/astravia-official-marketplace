# 引擎是我们自己的

十六支 craft 插件不再分发任何上游 Web 构建。页面由本插件自己的内核绘制与编辑，
`src/features/editor/kernel/` 是唯一引擎。

> **取代**：`0006-payload-pin.md`、`0008-payload-never-depends-on-one-host.md`（photocraft 目录）、
> `craft-0003-first-open-is-a-preparation-not-a-failure.md`、`craft-0008-one-container-per-app.md`。
> 那几篇描述的是"搬运上游产物"的做法，仍然可读，但已不是现行机制。

## 起点：一条被误以为是免费的路径

前几轮的做法是钉住上游 release 里的 `*-web.zip`：`payload/manifest.json` 记 size/sha256，
`server/hub.mjs` 把它下载、校验、起一个 loopback HTTP 服务发出去，活动标签里放一个 `<iframe>`，
`host-bridge.js` 注入进去代替宿主完成打开与保存。这条路径当时有真实理由——上游的编辑器成熟、
逐像素保真、不用我们写绘图代码。

但它把四件事绑在了一起，而其中只有第一件是我们想要的：

1. 用户点开标签，看到一个真实的编辑器；
2. 那个编辑器是一个 13–50 MB 的 WebAssembly 应用，冷启动要下载、解包、初始化；
3. 每支插件在主进程里多一个 Node 进程（`server/hub.mjs`），每个平台一份 sha256 要维护；
4. 上游愿意发布 Web 构建，我们才有东西可钉。

第四条第一次就断了：**artcraft 的十五个 release 全部是 `web: []`**，从来没有产出过
`artcraft-web-*.zip`。这个插件因此一直没能发布——不是我们没写，而是"搬运"这条路对它不存在。
一个必须依赖被搬运方配合的架构，在第十六个应用面前直接失效。

## 决定

**内核是我们自己的代码，它是唯一引擎。**

```text
src/features/editor/kernel/
├─ engine.ts            文档状态、选中、撤销、批量执行
├─ render.ts            画布绘制：页面、形状、参考线、手柄、选框
├─ KernelCanvas.tsx     指针、滚轮、拖放、内联文字编辑
├─ probe.ts             页面 → 字母地图 + 平均色 + 对比度
├─ presets.ts           四种版面（画布 / 表格 / 文档 / 舞台）
└─ Kernel{ToolRail,TopBar,Inspector}.tsx
src/domain/kernel-document.ts
                        唯一的文档模型，纯函数，Node 里可测
```

随之删除：`payload/`、`server/`、`scripts/build-hub.mjs`、`src/bridge/host-bridge.js`、
`src/runtime.ts`，以及 `plugin.json` 的 `providers.services`。

## 为什么这是更好的取舍

| 关注点 | 搬运上游 | 自研内核 |
| --- | --- | --- |
| 冷启动 | 下载 13–50 MB + wasm 初始化 | 一个 React 组件树，约 120 KB JS |
| 常驻成本 | 每支插件一个 Node 进程 | 零进程 |
| 十六支同开 | 十六个 wasm 应用抢 CPU 与内存 | 十六张画布，不活动的不画（见 0013） |
| 新增一支 | 需要上游发布 Web 构建 | 复制目录，写一个 `app.config.ts` |
| 界面语言 | 取决于上游构建是否带语言表 | 由我们的字符串与字体栈决定（见 0012） |
| Agent 能做什么 | 派发合成事件，靠像素寻址 | 直接调用语义操作（`insert` / `set` / `align`） |
| 维护面 | 上游版本 + sha256 + 每平台产物 | 十六份逐字节相同的 `src/` |

代价必须说清楚，不能只写好处：

- **功能面收窄。** 上游的曲线编辑、图层蒙版、滤镜栈不会随包分发。内核 v1 的形状是
  矩形 / 椭圆 / 直线 / 文字 / 图片，加移动、缩放、对齐、层次、撤销。
- **四种版面共用一套模型。** 表格、文档、舞台目前只是参考线与默认尺寸不同，
  不是真正的电子表格引擎或排版引擎。
- **保真度不同。** 打开一份上游工程文件不在能力范围内；能存能读的是本插件自己的 JSON。

## 文档模型

`KernelDocument` 是扁平的、有序的：

```ts
{ schemaVersion: 1, mode, width, height, background, shapes: Shape[] }
```

`shapes` 按 back→front 排列，命中测试自顶向下，这就是"上层盖住下层"的全部实现。
四种版面只差 `mode` 推出的参考线与默认尺寸：表格 1440×900、文档 1000×1414、
舞台 1600×900 深底、画布 1280×800。

模型是纯函数集合（`applyMove` / `applyResize` / `align` / `reorder` / `parse` / `serialize`），
没有 React、没有 canvas、没有 DOM——所以 `node --test` 能直接测它，这也是本轮
把行为测试从"泵帧等回信"改成"调用函数看结果"的前提。

## 证据

- Observed：`payload/`、`server/`、`scripts/`、`src/bridge/`、`src/runtime.ts` 已从设计分支删除；
  `plugin.json` 不再有 `providers`。
- Observed：`npx tsc --noEmit` 通过；`npm run build` 产出 `dist/`，包内无 `server/`。
- Observed：`tests/craft-parity.test.mjs` 现在只比 `src/`（跳过 `app.config.ts`），
  十六支逐字节相同。
- Observed：artcraft 作为第十六支新建，不依赖任何上游制品。
- Inferred：内核的绘制保真度低于上游编辑器的专业功能；这是接受的取舍，不是遗漏。

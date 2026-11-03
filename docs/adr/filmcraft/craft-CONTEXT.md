# craft 家族：共用的词汇

这套插件里同样的东西有好几个名字，先把词对齐，后面的决定才读得懂。

## 拓扑

```text
Astravia 宿主（Electron 主进程 + 渲染进程）
└─ 插件运行时（本插件的 MF 模块）
   ├─ craft-tab.tsx           活动标签：顶栏 + 工具轨 + 画布 + 属性面板 + 状态行
   ├─ use-craft-editor.ts     创建引擎、恢复文档、防抖存盘、导出
   ├─ craft-tools.ts          五个 Agent 工具，全部转向同一个引擎
   └─ kernel/                 自研内核（见 0011）
      ├─ engine.ts            文档状态 / 选中 / 撤销 / 批量执行
      ├─ render.ts            绘制
      ├─ probe.ts             页面 → 文字地图
      └─ presets.ts           四种版面
```

没有第二个进程，没有 `http://127.0.0.1:<port>`，没有 iframe。

## 词

- **内核（kernel）**：`src/features/editor/kernel/` 与 `src/domain/kernel-document.ts`。
  它是唯一引擎。十六支插件的内核逐字节相同。
- **文档（document）**：`KernelDocument`，`{ schemaVersion: 1, mode, width, height,
  background, shapes[] }`。`shapes` 按 back→front 排列。
- **版面（mode）**：`canvas` / `sheet` / `doc` / `stage`。四种版面共用同一模型，
  差别是参考线与默认尺寸（见 `presets.ts`）。
- **形状（shape）**：`rect` / `ellipse` / `line` / `text` / `image`，统一用
  `{id, x, y, w, h, fill, stroke, ...}` 描述。
- **引擎实例（engine）**：`KernelEngine`。每个打开的标签一个，注册在
  `session-registry.ts` 的单槽里，Agent 工具通过 `craftEngine()` 拿到同一个。
- **act**：一次 `steps[]` 批量执行，每步之间 `await frame()` 并推一条进度。见 0009。
- **probe**：把页面压成 `columns × rows` 的字母地图 + 平均色 + 对比度。
  图片进不了工具结果，这是 Agent 唯一能"看见"页面的通道。
- **HUD / 进度**：标签底部那条"自动操作 3/8 · …"，文案由工具的 `strings.acting` 提供。
- **存档**：插件存储里的 `document.json`。导出 PNG / JSON 走用户选择的保存对话框。

## 谁负责什么

| 关注点 | 归属 |
| --- | --- |
| 绘制与编辑 | 内核（本插件自己的代码） |
| 文件进出 | 插件存储（自动存档）与 `ctx.fs.saveAs`（用户选路径） |
| Agent 能不能动手 | 插件：`act` 直接调用语义操作，不靠像素寻址 |
| 界面语言 | `strings.ts`（文案）与 `render.ts` 的 `FONT_STACK`（字形），见 0012 |
| 常驻成本 | 零进程、零下载、无常驻循环，见 0013 |
| 十六支的一致性 | `tests/craft-parity.test.mjs` |

# Agent 驱动的是那一页画布，不是模型

- 状态：已采纳（2026-11-04）
- 相关：[0002](0002-bytes-move-through-the-host.md)、[0009](0009-one-batch-instead-of-one-click.md)

## 问题

"让 Agent 画个流程图"有两种实现：让模型生成 `.excalidraw` JSON 直接写盘，或者让它去操作
真实的编辑器。前者看起来更"干净"，但它要求模型记住上游的 schema 版本、图元坐标、绑定关系、
arrow 的 `points` 相对坐标——错一个字段，用户打开就是空白页，而且没有任何人能看出哪里错了。
后者慢一点，但每一步都能被观测、被纠正，并且**用的是上游自己的行为**。

## 决定

Agent 工具驱动**标签页里那一页真实页面**。分两种手段，按对象选：

- **结构**（图元、节点、连线、文字）走上游自己的命令式 API：`<id>_scene`。
- **界面与像素**（菜单、面板、工具栏、属性面板）走真实事件：`<id>_act`。

| 工具 | 做什么 |
| --- | --- |
| `<id>_open_editor` | 打开标签页，等页面 `craft:ready`，回一份初读（URL、是否就绪、画布尺寸、文字地图） |
| `<id>_editor_status` | 只读：是否打开、是否就绪、URL、画布尺寸、暂存文件、文字地图与平均色 |
| `<id>_scene` | 读 / 写 / 导出场景：`read`、`apply`、`export` |
| `<id>_act` | 一批手势：click / move / drag / scroll / type / key / wait / ready / capture / label |
| `<id>_probe` | 看画布：区域文字地图 + 平均色 + 对比度 |
| `<id>_open_document` | 把一个工作区文件真正交给编辑器打开 |

### 结构为什么不经手势

拖出八个方框意味着八次拖拽、八次命中测试、八次几何误差。编辑器本来就接受元素：
`convertToExcalidrawElements` 把骨架补成完整元素（`packages/element/src/transform.ts:680`），
`updateScene` 把它们交给跟手绘完全相同的更新管线（带 `CaptureUpdateAction.IMMEDIATELY`，撤销栈照常记录）。
所以结构走 API 不是“绕过编辑器”，而是**用它公开的那条路**。

### API 从哪里来，为什么要一个 shim

`ExcalidrawImperativeAPI` 只经 React context 传递（`packages/excalidraw/index.tsx:52` 的
`ExcalidrawAPIProvider`、`:467-480` 的 `ExcalidrawAPIContext`），上游从不把它放到 `window` 上。
构建配方因此把包根别名到一个生成的 shim（`astravia-excalidraw-api.tsx`）：它 `export *` 上游包根，
只包一层 `ExcalidrawAPIProvider`，在 Provider 内部用 `useContext` 取到 api 并发布到
`window.__ASTRAVIA_EXCALIDRAW__`。上游源码一行不改，应用自己创建的 api 对象原样被取到。

导出同一条路：`exportScene`（`packages/excalidraw/scene/export.ts:1354`）拿到的字节回给工具，
由「另存为」落盘——**不进**文档的保存通道，否则一张导出的 PNG 会变成那张图的保存目标。

工具 id 带插件 id 前缀（`excalidraw_act`），因为同时装几个画布类插件时工具名是一个扁平命名空间。

## 两条硬规矩

**1. 只说派发了什么，不说应用做了什么。** 工具结果里的 `ok` 是"这一步的事件被派发了"，
不是"这个形状画出来了"。要判断结果，读回画布（`probe` / 批次前后对比），不要猜。
桥自己也是这么写的：`craft:pointer` 回 `at`，`craft:key` 回 `typed`，没有一处回"上游执行成功"。

**2. 只返回文字。** 插件工具的返回值到模型手里是文本，像素没有用。所以画布**自己描述自己**：
`craft:probe` 把一块区域采样成稀疏字符地图（色相字母、暗色小写）＋平均色＋尺寸，
一个"把背景改成蓝色"的请求，改前改后的 `mean` 是可测量的。

## 为什么坐标是 0..1 的分数

画布尺寸随标签页变化，模型也没有可靠的办法知道当前像素宽高。分数坐标（`x`、`y` ∈ [0,1]）
对任何尺寸都成立，而且和 `probe` 的文字地图（32 列 × 18 行 → `x=(c+0.5)/32`）能直接对上。
桥里再乘回真实宽高。

## 读回的是所有绘制层，不是“那一个 canvas”

Excalidraw 把画面拆在多个 canvas 上：`canvas.excalidraw__canvas.static` 承载场景，
`canvas.excalidraw__canvas.interactive` 只承载选中框、变换手柄和正在画的那个图元，
还有一个没有额外类名的草稿层。所以两件事用到的 canvas 不同：

- 派发指针/键盘事件 → `.interactive`（它才有监听器，其余层是纯画布）；
- `probe` / `capture` → 按 DOM 顺序把所有 `canvas.excalidraw__canvas` 叠到一张
  草图 canvas 上，再采样或编码。

实测：同一份已载入一个黑色矩形的场景，只读 `.interactive` 一层时暗色格数是 0（那层在该场景下
基本透明），叠层后是 60，`mean` 从 `#ffffff` 变为 `#cacaca`。只读一层的话，Agent 会一直
以为画面是空白的。

## 为什么手势走真实事件，结构走公开 API

直接改 Excalidraw 的 store 需要拿到它的模块实例——那是内部 API，`excalidraw-app` 打包后
未必暴露，而且一旦改动就绕过了选择、撤销栈、绑定重算。所以两种手段都不是“直接改状态”：

- 手势派发真实指针/键盘事件，走的是上游自己的处理链，撤销栈、吸附、文本编辑全都在；
- 结构调的是**有文档的**命令式 API（`updateScene` 等），它进的是同一条更新管线，
  `CaptureUpdateAction.IMMEDIATELY` 让这次变更进历史。

## 代价

- 手势慢：一批步骤按帧步进，不是一次同步调用。这是刻意的——看得见的过程才好纠错；也正因为慢，
  结构改动不该走手势。
- 手势依赖画布的命中区域：某些控件（素材库、菜单）需要先点开再用，不能用“直接写入”跳过。
- 结构访问依赖 shim：站点一旦没经过本插件的构建配方，`window.__ASTRAVIA_EXCALIDRAW__` 不存在，
  `<id>_scene` 只能回 `no-scene-api`（配方断言产物里有这个全局名，就是为了不让它静默退化）。
- 比“生成 JSON 直接写盘”仍然更容易观察：每步都有 `probe`/`scene` 可对账，错了能改。

## 不做的事

- 不让模型手写 `.excalidraw` 文件当主要路径：要写就写骨架，交给上游的 transform。
- 不从截图里猜状态；状态来自页面自己回的 `probe` 或 `scene`。
- 不在工具结果里报告没有读回过的结论。

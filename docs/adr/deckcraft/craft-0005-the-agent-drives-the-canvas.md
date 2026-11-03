# Agent 驱动画布：看得见、点得着、但只能靠自己再拍一张

## 起点

原来的五个工具只能**开、看、递文件**。用户说"把这个标题字号调大"，Agent 只能回答"请你在编辑器里调"。
这不算驱动，只算导览。

上游的界面是一张 canvas：没有 DOM 节点可以点，没有一个 `button` 可以 `.click()`。
所有交互都发生在应用自己的事件监听里，读的是 `offsetX/offsetY`、`event.key` 这类字段。

## 决定

三个手势工具，加上原有的观察工具，构成一个闭环：

```
capture_canvas ──► 看这一次的 PNG，想出像素位置
        │
        ├── click(x, y, double?)          分数坐标，0..1
        ├── type(text)                    逐字符 keydown/keypress/keyup
        └── press_key(key)                单个键，或 "ctrl+s" 这样的和弦
        │
        └──► capture_canvas               再拍一张，这是唯一证据
```

实现都在 `host-bridge.js` 内部，做三件事：

1. **找到 canvas**（`canvasNode()`），先 `focus()`（尽力而为，失败不算错），
   再用 `getBoundingClientRect()` 把分数换算成 `clientX/clientY`。
2. **派发形状正确的事件**：`pointerdown` / `mousedown` / `pointerup` / `mouseup` / `click`，
   `pointerId`、`pointerType: "mouse"`、`isPrimary`、`button` 都填上；
   键盘走 `keydown` / `keypress` / `keyup`，带 `ctrl/meta/alt/shift` 修饰位。
3. **只回自己知道的事**：`{ok, at: {x, y}, error?}`、`{ok, typed: n}`、`{ok, key}`。
   没有一条回信声称"应用改了什么"——bridge 不是应用的代言人。

## 坐标是分数，不是像素

Agent 从 `editor_status` 拿到 `canvas` 尺寸，但**不需要**用它换算：`x=0.5, y=0.5` 永远是正中。
这样同一句"点左边那个工具"在 900 px 和 2400 px 的窗口里都成立，也不会因为用户改了窗口大小
让一条方案失效。像素只在 bridge 里出现一次。

## 能力边界（写清楚，因为它会被问到）

| 想做的事 | 能不能 | 说明 |
| --- | --- | --- |
| 点按钮、点工具、点菜单 | 能 | 派发的是按下即抬起，一步完成 |
| 双击 | 能 | `double: true` 派发两轮 |
| 拖拽（拉贝塞尔手柄、拉滑块） | **不能** | 只有按下与抬起，没有中间的移动；要改数值走输入框，或让用户来拖 |
| 键入 ASCII | 能 | 逐字符 `keydown/keypress/keyup` |
| 键入中文 | **不能** | 没有输入法；需要中文就走文件或让用户粘贴 |
| 粘贴 | 不能 | 需要宿主剪贴板权限，工具没有 |
| 滚轮 | 不能 | 未实现；先 `click` 进目标区域，或用键盘翻页 |
| 判断"操作有没有生效" | 能，但只能靠截图 | 手势回信只说明事件发出去了 |

`isTrusted` 不是障碍：这些上游构建读的是事件字段，不检查合成性（Observed：直接在画布上派发
就能被接收，`tests/craft-bridge.test.mjs` 复现了这一路的派发形状；真机确认仍在界面上做）。

## 会坏在哪里

- **一次点偏，后面全偏。** 界面滚动、缩放、切换工具都会让上一张截图里的坐标失效。
  所以规则是"一次操作、一次回看"，最多连点两三次。
- **点两次没反应就是方向错了。** 换方法（菜单 / 键盘 / 问用户），不要同一个坐标试第三次。
- **手势会唤醒暂停的标签。** `pointer()` / `keys()` 开头先 `resume()`，否则事件会被排进一个
  永远不跑的帧（见 0004）。

## 证据

- Observed：`tests/craft-bridge.test.mjs` 覆盖暂停闸门、分数坐标换算到 `clientX/clientY`、
  双击派发顺序、和弦键的修饰位；`npx tsc --noEmit` 通过，各支插件各自打包成功。
- Observed：截图工具保存的是画布位图；它从不写工程文件。
- Inferred：上游对合成事件的接受度在各支之间一致（同一套 egui/winit Web 构建），
  **没有**逐个应用做真机点击验证；验证路径是先 `capture_canvas`，再点一个位置明显的按钮，
  再拍一张对比。
- 相关：工具清单与返回字段见 `src/features/agent/craft-tools.ts` 的头部注释，那里是唯一权威。

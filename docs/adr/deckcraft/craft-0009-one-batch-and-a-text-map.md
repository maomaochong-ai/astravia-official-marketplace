# 一次批量，加一张文字地图

## 起点

0005 定下的是"手势 + 截图"：一次点击一次往返，判据是再拍一张 PNG。这个闭环能跑，但两件事在真机上很别扭：

- **往返太贵。** 从宿主问一次、到页面里派发、再到回信，是一整趟消息流水。用户说"把背景换成渐变蓝色"，
  实际要十几步：选图层、开面板、点色块、拖滑块、点确定。一步一趟往返，Agent 大部分时间在等消息。
- **截图看不见。** 宿主把插件工具结果固定塞进 `content: [{type:"text"}]`
  （Observed：`packages/coding-agent/src/plugins/runtime/tool-runtime.ts` 的 `formatPluginToolResult`），
  图片到不了模型。所谓"再拍一张对比"其实是让用户看，Agent 从来没真正看过。

所以手势需要批量，观察需要一种**能进文本**的形状。

## 决定

### 1. 一个 `act` 承接全部动作

`craft:act` 收一个 `steps[]`，在页面里一次跑完。`op`：`click` / `move` / `drag` / `scroll` / `type` /
`key` / `wait` / `ready` / `capture` / `label`。0 到 40 步。

每步之间按帧节流，而不是排进同一个 tick：`click` 是 move → down → 45 ms → up → click，
`drag` 在起止点之间插 3–24 个 `pointermove`。这有两个作用——用户看得见指针在动，
上游收到的 `pointerdown` / `pointerup` 也真的分属两帧（同一个 tick 里按下即抬起，
很多控件会判成无效手势）。

失败默认停：`stopOnError` 为真时剩余步骤标 `skipped` 并整体 `ok: false`。因为一个点偏之后
后面每一步都在错的位置上，继续跑只会把一次错误放大成十几次。

### 2. 过程要写在画布上

`craft:progress` 每步一条 `{index, total, label}`，插件标签页顶部显示成"自动操作 3/8 · 打开背景色面板"；
页面里同时有一个固定位置的提示条写同样的字。用户因此能看见"它正在做什么"，而不是看一个静止的画面
猜 Agent 是不是卡住了。

注意这里有一个坑（Observed）：`%key%` 形态的文案只由宿主 UI 层解析，**传进 iframe 会原样显示**。
所以 HUD 用的字面文案来自 `editorStrings(locale)`，工具 `label` 才用 `%tool.*%`。

### 3. 观察返回文字地图

`craft:probe` 把画布按 `columns × rows`（默认 32 × 18）采样，每格压成一个字母：

```
K 近黑     W 很亮   w 中亮   k 中暗
R O Y G C B P M      红橙黄绿青蓝紫，小写表示偏暗
```

外加 `mean`（平均色十六进制）、`meanRgb`、`contrast`（格间亮度标准差）、`width` / `height`。
32 × 18 一屏，一个 200 行以内的纯文本摘要——模型读得下，也读得懂"左上角一片白、中间一条蓝"。

`act` 与 `open_document` 在动作前后各探一次，回 `{before, after, change}`，
`change.distance` 是两次 `meanRgb` 的 RGB 欧氏距离（0–441），大于 6 视为"画面确实变了"。
这就把"改成功了吗"从一句推测变成一个数。

## 为什么不做真正的视觉

因为做不到，而不是不想做。要走图片得动宿主（`tool-runtime.ts` 把结果强制转文本），
本轮边界是只改插件侧。文字地图的另一半理由也成立：它便宜、确定、可断言——
`tests/craft-bridge.test.mjs` 能对着一张已知像素的假画布断言 `BBBBBBBB` 和 `#0000ff`，
截图做不到这一点。

诚实地说清楚它看不见什么：字体、字距、细小控件的位置、文字的排布细节。要这些就让用户看屏幕，
或者把 `region` 收窄、把 `columns` / `rows` 开到 64 × 36 再读一次。

## 工具面：五个，不是一个

| 工具 | 为什么还在 |
| --- | --- |
| `open_editor` | 唯一的入口，顺带首次探一次画布 |
| `editor_status` | 只读，不产生副作用；排查"到底开没开" |
| `act` | 全部动作 |
| `probe` | 全部观察；`save: true` 时把画面存成 PNG |
| `open_document` | 暂存 + `Ctrl+O` + 等载入 + 探一次，替代原来两个工具的组合 |

其余（`_click` / `_type` / `_press_key` / `_capture_canvas` / `_open_in_browser`）删掉了。
十五支插件共用一个宿主工具命名空间，每多一个名字都要进 prompt，而它们全是 `act` 的子集。

## 会坏在哪里

- **批量放大错误。** 3–8 步一次是合适的；不确定的地方插一步 `probe` 或 `wait`。
- **`ok: true` 不等于生效。** 它只说事件发出去了。证据是 `change.changed` 或下一次 `probe`。
- **面板切走后上游停帧**（0004），动作仍然发得出去但慢；`act` 超时先把窗口切回来。
- **`distance` 会被无关变化骗到**：光标闪一下、加载动画转一圈都能让它变大。所以它是"变了 / 没变"，
  不是"改对了"。判对错还得看 `cells` 的形状。

## 证据

- Observed：`tests/craft-bridge.test.mjs` 断言了指针的 `move → down → up → click` 顺序、
  批量步骤顺序与 `craft:progress` 条数、HUD 文案、失败步骤后的 `skipped`、
  纯蓝画布探出 `BBBBBBBB` / `#0000ff`、纯深灰探出 `KKKK` 且 `contrast: 0`。
- Observed：`npx tsc --noEmit` 通过；`node --check src/bridge/host-bridge.js` 通过。
- Inferred：真实上游控件接受这套节奏（同一套 Web 构建）；真机确认路径是先用 `probe` 记基线，
  `act` 一步，再读 `change`——一次只验一步，不要一次验十步。
- 相关：`src/features/agent/craft-tools.ts` 的 `STEP_SCHEMA` 是参数权威；
  `src/bridge/host-bridge.js` 的 `act()` / `probe()` 是行为权威。

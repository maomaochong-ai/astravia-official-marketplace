# 0013：活动流的两条正确性约束——一次调用一行、轮次用分组表达

- **状态：** 已接受
- **日期：** 2026-11-20
- **背景：** 活动页反复被报「文字被遮挡」，但每次修的都是可见症状；真正的两个原因一个在 CSS 层叠、一个在数据模型，都不在那次被改的文件里。
- **适用：** `src/style.css`、`src/features/workbench/timeline.ts`、`components/pages/activity.tsx`

## 问题

### 一、一次调用被画成两行

面板同时收两条管道：

| 来源 | 事件 | 提供 |
|---|---|---|
| 宿主方向 | `tool-start` / `tool-end` | 开始时间、耗时、成败 |
| 工具自己 publish | `tool-result` | 摘要、结构化载荷 |

两条管道各自进列表，排序只看时间。20 次调用 → 40 行，读者会读成「跑了两次」；两行之间没有任何可见关联（不共享 id、不缩进、不标注从属）。

### 二、三列 grid 留在了两行结构上

`.fb-terminal .fb-log` 的 `grid-template-columns: 62px 14px minmax(0,1fr)` 是给「时间｜符号｜正文」单行版写的。改成 head/body 两行后，子节点从三个变成两个，grid 没跟着改：

```
第 1 列 62px  ← .fb-log-head（时间 + 状态 + 工具名 + 耗时）被压进 62px
第 2 列 14px  ← .fb-log-body（摘要）被压进 14px，一行一个字
第 3 列 1fr   ← 空着
```

这就是「摘要只剩一列字、看着像被圆角容器裁掉」的机制。此前的补丁只加了 `.fb-log-head` / `.fb-log-body` 两个类，类名检查通过，布局仍然是坏的。

## 决定

### D1 一次调用一行，配不上才分开

`mergeActivity(spans, entries, turns)` 在域层配对，判据三条：

1. 工具名相同；
2. 结果时间落在该调用结束时间 **±5 秒**内；
3. 每个调用只用一次（同名并发时取时间最接近的未配对调用）。

合并行：调用给 `at / status / ms`，结果给 `summary / hints / payload`。
配不上就各占一行，并且**纯结果行不带状态**（`status: null` → 不上色）——没有调用生命周期就没有资格宣称成功。

### D2 轮次用分组标题，不用逐行属性

`timeline.turns` 原本完全没被 UI 使用，只用每行一句「前 N 轮」代替。改成粘性分组标题：`第 N 轮 · M 次调用 · K 失败 · 时长`。逐行文案删掉（`activity.turnNow` / `activity.turnBehind` 一并下线）。

### D3 状态用左侧色条 + 符号，不染工具名

`data-tone="ok"` 曾同时把 `.fb-log-mark` 与 `.fb-log-name` 染成 `--color-risk-low`，一屏工具名全绿，与「风险低」撞色。现在只有失败行的名字变红，其余走正文色。

### D4 布局归 `.fb-log`，终端观感归 `.fb-terminal .fb-log`

一个元素只允许一处声明布局。`.fb-log` 负责块级排布与内边距，`.fb-terminal .fb-log` 只加色条与数字对齐。

### D5 弹窗与直播语义

- 有载荷的结果可点开（`role="dialog"` + Esc + 遮罩）；
- 直播列表 `role="log" aria-live="polite"`；
- 跨天时时间列带 `MM-DD`。

## 不做什么

- **不用 span 的 `toolName + 起始时间` 反推结果的归属并「补」一个 id。** 宿主没给关联键，猜出来的关联一旦错了，用户会把两次调用的摘要读串。
- **不给纯结果行假定成功。** 现有工具失败时抛错而不是推结果，所以失败结果本来就少；少不等于可以默认成功。
- **不改 `payloadHints` 的输出内容**（仍然最多 4 条、仍跳过身份/路径字段），只把 `key` 与 `value` 拆开交给界面层翻译。
- **不做「自动滚动到最新」。** 列表倒序、最新在顶部，滚到顶部本来就能看到新行；引入自动滚动反而会打断正在读旧记录的人。
- **不为活动流做持久化。** 它是本次会话的复核轨迹，落盘属于报告与样本库。

## 验证

已有：

| 用例 | 钉住什么 |
|---|---|
| `src/test/workbench/timeline.test.ts`（`mergeActivity` 5 条） | 配对成功/失败、时间窗、失败状态传递、轮次归属与倒序 |
| `src/test/workbench/timeline.test.ts`（`payloadHints` 3 条） | 结构化输出、上限、空载荷 |
| `src/test/workbench/workbench.test.tsx`（`activity sidebar` 5 条） | 一调用一行、轮次标题、两种空态、清空二次确认、载荷弹窗与 Esc |
| `src/test/workbench/layout-contract.test.ts`（第 6 条） | `.fb-terminal .fb-log` 不得出现 `grid-template-columns` |
| `scripts/check-layout.mjs --strict` | 四类裁切写法 + 三条样式契约 |

待补：

- 真机上「新事件到达时的滚动位置」未量测（D-不做什么 已说明为何不做自动滚动）。
- `role="log"` 在宿主内置面板里的读屏行为未实测，只按 ARIA 规范落属性。

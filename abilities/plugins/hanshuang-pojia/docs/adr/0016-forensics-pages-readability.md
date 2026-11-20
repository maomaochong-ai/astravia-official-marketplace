# 0016：四个取证型侧栏的可读性约束——布局不能靠 flex 属性活,统计卡不能写死

- **状态：** 已接受
- **日期：** 2026-11-20
- **背景：** 样本 / 发现 / 字符串 / 深层反汇编这四页都是「一屏里塞结论 + 清单」的取证视图。四处缺陷不同，根因有两个共性：布局容器的性质与它依赖的属性不匹配；界面自己发明了一个「看起来像计数」的数。
- **适用：** `components/pages/{samples,findings,strings,disasm}.tsx`、`components/workbench/finding-row.tsx`

## 问题

### 一、样本页：在 grid 容器里用 flex 属性

`samples.tsx` 的页根是 `fb-page grid @min-[880px]:grid-cols-[…]`，左栏卡片靠 `fill` 撑高 —— 而 `fill` 展开是 `flex: 1 1 auto; min-height: 0`，**在 grid 容器里不生效**。

后果：左栏高度 = 内容高度 → `SamplePicker` 内部 `flex-1 overflow-y-auto` 的文件列表**没有高度上限** → 文件一多，右栏的「解析范围」「边界」被推到很远；而 `@min-[880px]` 的门槛意味着**大多数面板宽度下是单列**，两张卡基本看不到。

### 二、发现页：同一个事实印两遍，还有一个假计数

| 现象 | 机制 |
|---|---|
| 每条发现既印 `critical` / `high` 原始枚举，又印「严重 / 高危」标签 | `finding-row.tsx` 同时渲染 `finding.severity` 与 `t('severity.*')` |
| 「无发现」是一格统计卡，值域只有 0 与 1 | `<StatTile value={findings.length === 0 ? 1 : 0}>` —— 数字看着是计数，实际是布尔 |
| 「高危」那格把 critical 一起算进来 | `label={t('severity.high')}` 但过滤条件是 `critical \|\| high` |
| 没有报告时的空态没有出口 | `if (!report)` 分支只渲染 `EmptyState`，也不在 `fb-page` 里 |

### 三、字符串页：统计卡写死三类

`<StatTile label={t('stringKind.url')}>`、`path`、`identifier` 三格硬编码。`STRING_KINDS` 有六类：**IPv4 与邮箱恰恰是这类样本最值钱的两类，却永远占不到一格**；而没命中时那格恒为 0，等于常年摆着三个 0。

### 四、反汇编页：把「慢」显示成「没有」

| 现象 | 机制 |
|---|---|
| 索引还在跑时列表说「没有函数匹配这个过滤条件」 | 空态只有一种，不看 `disasm.indexing` |
| 计数 `200/350` 分不清是过滤还是截断 | `rows.length === candidates.length ? n : \`${n}/${total}\`` |
| 偏移不补零 | `0x1f` 与 `0x1f0000` 混排，列宽跳动像不同量级 |
| 过滤框只有 placeholder | 无可访问名 |

## 决定

### D1 容器的性质决定它能用什么属性

`fb-page` 是 flex 列。要在宽屏变横排就用 `flex-row`，不要换成 `grid` —— 一旦换成 `grid`，所有 `fb-fill` / `flex-1` 一起失效，而失效是静默的。

样本页因此改为：`fb-page fb-fill @min-[880px]:flex-row`；左栏卡片窄屏 `min-h-[180px] max-h-[46vh]`、宽屏 `@min-[880px]:w-[260px] max-h-none`；右栏 `fb-scroll overflow-y-auto @min-[880px]:flex-1`。

### D2 一个事实只印一次

严重级别只显示译文标签；原始枚举不进入可见文本（要过滤按筛选 chips，要看 id 看 `ruleId`）。

### D3 界面上不出现「伪装成计数的布尔」

「无发现」是一个结论，用 `Tag` 说，不用 `StatTile`。统计卡的值域必须是真实计数。

### D4 统计卡跟着数据走

字符串页按命中数取前二类显示，其余交给筛选 chips（六类都带计数）。
判据不是「哪几类重要」——那需要人判断；而是「哪几类这次真的有」。

### D5 「在进行」与「没有」是两种空态

索引中给 spinner + 进度文案；索引完成后才说「没有匹配」。
计数文案区分两种被截断的方式：`{{shown}} / {{total}} 已显示`。

### D6 十六进制偏移补齐到 8 位

`padStart(8, "0")`。取证页的地址列是给人纵向比对的，宽度不一致直接毁掉这个用途。

## 不做什么

- **不把四个页面合并成「取证工作台」。** 它们回答的是不同问题（有哪些样本 / 命中了什么 / 哪些字符串 / 哪段控制流），合并只会让人多点两次。
- **不给字符串表加逐行「交给对话」。** 400 行 × 一个按钮既重又吵；要追问时用页面顶部的 AI 动作，它带上下文。
- **不把 `NumberField` 从字符串页移除。** 它确实与设置页重复，但「就地调完立刻重跑」是这一页的主路径；重复的是控件，不是状态（两者都读同一份 `settings`）。
- **不给样本页加虚拟滚动。** 宿主目录列举只给一层，候选量级是几十；真正需要滚动优化的是字符串表，而它已经有 400 行上限。
- **不改 `DataTable`。** 它已经把横向滚动、`max-w-[52ch]`、`fb-wrap` 处理好；本轮的问题都在调用方。

## 验证

已有：

| 用例 | 钉住什么 |
|---|---|
| `src/test/workbench/forensics-pages.test.tsx`（5 条） | 样本左栏有窄屏高度上限与宽屏解除、发现空态有出口、无 0/1 假计数、反汇编无样本时给 unsupported 而非「没有匹配」、计数文案不是裸分数 |
| `panel-ux-regressions.test.ts` → `forensics counters follow the data`（2 条） | 字符串页不再写死 `counts.url/path/identifier`；发现页不再出现 `=== 0 ? 1 : 0` |
| `scripts/check-layout.mjs --strict` | 裁切写法与样式契约 |
| `scripts/report-unused-locale.mjs --strict`（zh + en） | 970 键 0 未用、键集一致 |

待补：

- 真机上「样本页文件很多时的滚动边界」未量测（jsdom 不算布局），当前由 class 契约保证。
- 字符串页的 top-2 统计卡只在有命中时出现，空态下不可见，因此只有源码级契约。

## 关联

- 0012：布局契约（谁滚、谁不缩）——D1 是它在具体页面上的推论
- 0015：状态过 `t()`、图标语义一致——D2 与它同源

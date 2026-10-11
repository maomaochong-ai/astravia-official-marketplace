# 统计/数字/轮播类组件速查

> 涵盖：JStatsSummary / JCountTo / JNumber / JCardScroll / JCardCarousel / JColorBlock / JCurrentTime  
> 按需加载：当用户要添加统计数字、翻牌器、卡片滚动类组件时读本文件

---

## 选型速查（KPI数字区）

```
需要展示多个关键数字？
├── 只要数字+标签，无需对比 → JNumber（isCompare:false）+ JText 配对
├── 需要翻牌动效，整体数字 → JCountTo（options.whole=true）
└── 每位数字分格翻牌 → JCountTo（options.whole=false，默认）

❌ 禁止用 JStatsSummary（同比行无法关闭）
```

---

## JStatsSummary（统计概览，3变体）

**compType** `JStatsSummary` | **index** `'1'`/`'2'`/`'3'`（字符串！）

| 变体 | index | 尺寸 |
|------|-------|------|
| 卡片式 | `'1'` | w=1000 h=180 |
| 背景式 | `'2'` | w=713 h=129 |
| 高亮式 | `'3'` | w=713 h=106 |

**映射机制** 第二类（option内嵌），`option.fieldMap` — dict格式：`{label:"name字段", value:"value字段", unit:"suffix字段"}`  
**chartData** `[{name, value, suffix, compareValue, compareLabel, compareState, ...}]`

**🚨 关键踩坑（实测2026-04-22）**：
- `value` **必须是数字**（如48620），`"48,620"` 含逗号→渲染NaN
- 单位字段是 `suffix`（不是unit），fieldMap为 `"unit":"suffix"`
- `compareState` 用 `"1"`（↑上升）和 `"0"`（↓下降），不是"up"/"down"
- **固定结构**：每个卡片强制渲染 top/middle/bottom 三区，比较区无法隐藏
- **选型禁区**：只展示"数字+标签"时绝对不用此组件

**常用 option 路径**（spec_builder 有 `JStatsSummary` handler，详细字段见 `references/spec-builder.md` §4）：

| 配置 | 路径 | 示例值 |
|------|------|--------|
| 数值字号 | `option.sections.top.value.fontSize` | 34 |
| 数值颜色 | `option.sections.top.value.fontColor` | #d8f1ff |
| 单位字号 | `option.sections.top.value.unit.fontSize` | 18 |
| 标签字号 | `option.sections.bottom.label.fontSize` | 14 |
| 标签颜色 | `option.sections.bottom.label.fontColor` | #9ed3ff |
| 卡片边框颜色 | `option.card.borderColor` | #0f66ff59 |
| 卡片圆角 | `option.card.borderRadius` | 16 |
| 卡片填充类型 | `option.card.fill.type` | none/color/gradient/image |
| 外层间距 | `option.layout.gap` | 16 |

---

## JCountTo（翻牌器）

**尺寸** w=300 h=80  
**chartData** `{value: number}`（注意是dict，不是数组）  
**key option**:
- `options.whole` — `false`（默认）每位数字独立翻牌格；`true` 整体count-up
- `boxWidth/boxHeight` — 单个翻牌格大小
- `fontSize` — 数字字号
- `color` — 数字颜色
- `prefixFontSize/suffixFontSize` — 前后缀字号

---

## JNumber（数值）

**尺寸** w=150 h=50  
**chartData** `{value: number}`，可选 `suffix` 字段作单位  
**key option**: `isCompare:false`（去掉对比行），`option.card.title:''`（去掉卡片标题）  
**用途** 单个静态大数字，干净无装饰

---

## JCardScroll（卡片滚动，3变体）

**compType** `JCardScroll` | **index** `'1'`/`'2'`/`'3'`（字符串！）

| 变体 | index | 尺寸 | 说明 |
|------|-------|------|------|
| 横向 | `'1'` | w=556 h=255 | 横向无缝滚动 |
| 竖向+序号 | `'2'` | w=430 h=530 | 纵向，左侧序号圆 |
| 高亮 | `'3'` | w=538 h=302 | 自动追踪高亮当前项 |

**映射机制** 第二类（option内嵌），`option.contentFieldMapping[].key`  
**动画** requestAnimationFrame无缝横向/纵向滚动  
**⚠️ compType必须是 `JCardScroll`（无后缀）**  
详细配置见 `references/card-scroll-option-config.md`

---

## JCardCarousel（卡片轮播）

**尺寸** w=1000 h=230  
**动画** requestAnimationFrame驱动水平平滑轮播（比JCardScroll更流畅）  
**⚠️ 与JCarousel区别**：JCardCarousel展示数据卡片；JCarousel是图片幻灯片

---

## JColorBlock（颜色块/数字矩阵）

**尺寸** w=100 h=100  
**chartData** `[{value, color, backgroundColor, prefix, suffix}]` 或嵌套二维数组  
**动画** 每块数字有count-up动效  
**key option**: `option.lineNum`（行数），`option.padding`（边距）

---

## JCurrentTime（当前时间）

**尺寸** w=290 h=33（默认 `format:"YYYY-MM-DD hh:mm:ss"` + `showWeek:"show"` + 字号 16）
**无数据输入**，完全由 dayjs 生成，每 1000ms 刷新
**key option**: `format`（dayjs 格式串），`showWeek='show'`（显示星期）

⚠️ 容器 `overflow:hidden` 强制截断，宽度不够会换行/被切。改了 `format` / `fontSize` / `showWeek` 时必须同步评估 w——速查见 `references/spec-builder.md §3.6`。

---

## 踩坑（统计/数字类）

- **🚨 JStatsSummary value必须是数字** 含逗号字符串渲染NaN
- **🚨 JStatsSummary suffix字段** 不是unit，fieldMap写 `"unit":"suffix"`
- **JStatsSummary compareState** 用 `"1"/"0"`，不是 `"up"/"down"`
- **JCardScroll index是字符串** `'1'/'2'/'3'`（JScrollList才用整数0/1/2）
- **JStatsSummary/JCardScroll compType无后缀** `_1/_2/_3` 只是default_configs.json的key
- **JCountTo chartData** 是dict `{value:number}`，不是数组
- **JNumber chartData** 是dict `{value:number}`，可加suffix
- **JCurrentTime** 无需chartData，自动刷新时间
- **🚨 JCurrentTime 宽度截断** 默认完整格式（年月日时分秒+星期）+ 字号 16 时 w 必须 ≥ 290；容器 `overflow:hidden` 不会自动换行，宽度不够直接被切。字号或字符串变长按比例放宽

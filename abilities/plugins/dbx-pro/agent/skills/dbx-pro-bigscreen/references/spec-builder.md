# spec_builder 一站式速查

> **默认生成路径**。AI 写 JSON spec → `py spec_builder.py <API> <TOKEN> spec.json` 一次保存全部组件。
> 本文件是**精简速查**，覆盖 80% 常用场景。
>
> **字段不确定、需深度定制、某变体视觉不清楚时**，三级按需查询：
> - `py spec_builder.py --schema <CompType>` — L1 精简（变体/字段/选型/踩坑/defaults 摘要，~30 行）  
> - `py spec_builder.py --schema <CompType> --full` — L2 完整 defaults JSON dump（深度嵌套 option 结构）  
> - `py spec_builder.py --schema --list` — L3 所有支持 compType 总览  
>
> **禁止直接 Read defaults/*.json**，统一经 `--schema --full` 调取。
> **spec 文件必须写到 `/tmp/`**（如 `/tmp/my_screen.spec.json`），禁止写入 skill 目录，避免污染。

---

## 1. Spec 顶层结构

```json
{
  "page": {"name": "<页面名>", "bg": "bg4", "theme": "dark"},
  "palette": "科技",
  "delete": {"types": ["JPie"], "names": [...], "ids": [...]},
  "components": [
    {"type": "<compType>", "title": "<中文名>", "pos": [x, y, w, h], ...字段}
  ]
}
```

| 字段 | 适用 | 说明 |
|------|------|------|
| `page.bg` | 全部 | `bg1`~`bg10`（默认 `bg4` 深空星空暗蓝） |
| `page.palette` | 全部 | 覆盖文本色板（title/subtitle/label/value/axis/axisLine/gridline/tooltipBg/tooltipTxt） |
| `palette` **(顶层)** | 全部 | 命名图表色板："默认/复古/淡雅/未来/渐变/简洁/商务/柔和/科技/明亮/经典/清新/活力/火红/轻快/灵动"——自动应用到所有图表的 option.color + customColor，省一次 `style_ops.py set-palette` |
| `delete` | **仅 `--page-id` 迭代模式** | `{types, names, ids}` 三者 OR 逻辑，先过滤既有组件再追加新组件；新建模式忽略 |
| `components` | 全部 | 组件列表。新建=全部组件；追加=**仅新增**的组件 |

**每个组件 builder 自动处理**：`background:'#FFFFFF00'` / `borderColor:'#FFFFFF00'` / `chartData JSON.dumps`（JText 除外）/ `option` 合并 defaults。

---

## 2. 布局模板（1920×1080）

### 顶部标题栏（y=0~80）
```json
{"type":"JDragDecoration","pos":[20,20,480,50],"variant":"5"}
{"type":"JDragDecoration","pos":[1420,20,480,50],"variant":"5"}
{"type":"JText","pos":[500,15,920,60],"text":"<标题>","style":"title","letterSpacing":10}
```

### 三列布局（x 起点 10 / 640 / 1270，列宽 620）
左列: `x=10  w=620` | 中列: `x=640  w=620` | 右列: `x=1270 w=620`
主内容区 `y=90~1070`（高 980，等分 2 行 490 / 3 行 325）

### 四列布局（x: 10/490/970/1450，列宽 460）

### 二列布局（x: 10/970，列宽 940）

### 全宽（x=10, w=1900，y 自定）

---

## 3. 色板（bg4 默认）

| 语义 | 色值 | 用途 |
|------|------|------|
| title | `#f0c040` 金 | 主标题 |
| subtitle | `#00d4ff` 青 | 图表标题、小标题、强调 |
| label | `#ffffff` 白 | 一般标签 |
| value | `#d4e8ff` 淡蓝 | 数值文本 |
| axis | `#8ab8d0` | ECharts 轴标签（auto-inject） |
| axisLine | `#1a3a5a` | 轴线 |
| gridline | `#1a3a5a55` | y 轴分割线 |
| tooltipBg | `#0b1e3acc` | tooltip 背景 |
| tooltipTxt | `#e0f0ff` | tooltip 文字 |

**A股涨跌色**：红涨 `#ff4d4f`→`#ffccc7`（深到浅），绿跌 `#52c41a`→`#d9f7be`。
**多色系列**：`["#00d4ff","#f0c040","#7ee8a2","#ff7875","#95de64","#b37feb","#ffa940","#8c8c8c"]`（青/金/绿/红/草绿/紫/橙/灰）

---

## 3.5. 数值型组件 value 范围速查（⚠️ 首次做对率关键）

> 多个单值/仪表类组件的 value 语义不统一，是**最容易翻车**的一处。实测过的规则：

| 组件 | value 范围 | 示例 | 踩坑 |
|------|-----------|------|------|
| **JAntvGauge** | 0-100 数字 | `78` = 78% | ⚠️ 传 `0.78` 会被当 <1% 渲染为 "1" 且指针贴 0（实测） |
| **JColorGauge** | 0-100 数字 | `92` = 92% | segments 阈值是 0-1（与 value 不同量纲） |
| **JLiquid** | 0-100 数字 | `75` = 75% | 水位高度映射 |
| **JRingProgress** | 0-100 数字 | `85` = 85% | — |
| **JGauge** | 0-max（默认 max=100） | `70`, `max=100` | max 可自定义 |
| **JSemiGauge** | `value<0-max>` 或 `data:{total,used}` | `value:75, max:100` | 两种写法二选一 |
| **JCountTo** | 任意数字 | `12345` | 整数动效翻牌，无单位约束 |
| **JNumber** | 任意数字 | `99` | 纯数字展示 |
| **JStatsSummary** | `data[].value` 必须是数字 | `368.5` | **不能含逗号字符串** `"48,620"` → NaN |

**统一记忆口诀**：带百分号的（Gauge/Liquid/RingProgress）→ 0-100 整数/浮点；纯数字的（CountTo/Number）→ 任意；对比卡片（StatsSummary）→ 数字不能是字符串。

spec_builder 已内置保护：`handle_JAntvGauge` 侦测 `0<value<1` 时打印警告并提示正确值。

---

## 3.6. 容器宽度速查（避免被 overflow:hidden 截断）

> 大屏所有组件根容器都带 `overflow:hidden`，宽度不够时**不会自动换行**也**不会拉伸**——文字直接被切。某些自渲染组件（非 ECharts）实测最小宽度严于直觉，写 spec 时 pos[w] 至少给到下表值。

| 组件 | 最小 w（默认显示） | 触发场景 |
|------|------------------|---------|
| **JCurrentTime** | **290**（字号 16 + `format:"YYYY-MM-DD hh:mm:ss"` + `showWeek:"show"`） | 完整年月日时分秒 + 星期。低于 290 会换行/截断 |
| JCurrentTime（无星期） | 220 | `showWeek:"hide"` 时单行年月日时分秒 |
| JCurrentTime（仅时分秒） | 130 | `format:"hh:mm:ss"`、不显示日期星期 |

**通用估算**：JCurrentTime 单行宽度 ≈ `字号 × 字符数 × 0.6 + 30`；字号增大或字符串变长时，按比例放宽 w，禁止依赖默认 280。

spec_builder 默认 `JCurrentTime` 的 w 已置为 290（兼容默认完整格式 + 显示星期）。手写 spec 时如果改了 `format`/`fontSize`/`showWeek`，**必须同步评估 w**。

---

## 3.7. barWidth 计算规则（条目多时必设，否则柱体连片）

> ECharts 默认会把柱体撑满可用空间。条目数 ≥ 6 且容器尺寸有限时，不设 `barWidth` 会导致柱体合并成色块（看不出间距）。

**横向柱（JHorizontalBar）——受 h 约束：**
```
barWidth = floor((h - 52) / 条目数 × 0.55)
```
- `52px` = 标题区 32px + X 轴区 20px
- `0.55` 系数保留约 45% 作条间距

**竖向柱（JBar）——受 w 约束：**
```
barWidth = floor((w - 75) / 条目数 × 0.55)
```
- `75px` = Y 轴标签区 55px + 右边距 20px

**多系列分组（JMultipleBar）——条目数乘以系列数：**
```
barWidth = floor((w - 75) / (条目数 × 系列数) × 0.55)
```
JStackBar 不乘系列数（同类目叠加，不占额外宽度）。

**速查表（常见容器）：**

| 方向 | 容器尺寸 | 条目数 | 推荐 barWidth |
|------|----------|--------|--------------|
| 横向 | h=190 | 8 | **10** |
| 横向 | h=200 | 6 | **13** |
| 横向 | h=300 | 10 | **14** |
| 竖向 | w=600 | 8 | **36** |
| 竖向 | w=600 | 12 | **24** |
| 竖向 | w=620 | 24 | **12** |
| 竖向 | w=900 | 10 | **45** |

`0.55` 偏细时调 `0.6`，偏粗时调 `0.45`。

---

## 4. 内置 handler 组件（22 个，字段速查）

### JText（文字）
```json
{"type":"JText","pos":[x,y,w,h],"text":"...","style":"title|subtitle|label|value"}
```
可选：`fontSize` `color` `fontWeight` `align`（default center）`letterSpacing`
**style 映射**：title(40/金/bold)、subtitle(22/青)、label(14/白)、value(28/淡蓝/bold)

### JDragDecoration（装饰条，12 种变体）
```json
{"type":"JDragDecoration","pos":[...],"variant":"1"..."12"}
```
可选：`color`（default 青） `subColor` `dur`（动画秒数，default 3）

### JDragBorder（边框，13 种变体）
```json
{"type":"JDragBorder","pos":[...],"variant":"1"..."13","color":"#00d4ff"}
```

### JStatsSummary（KPI 统计概览，3 个变体）
```json
{"type":"JStatsSummary","variant":"1"|"2"|"3","pos":[...],
 "data":[
   {"name":"...","value":<数字>,"suffix":"亿元","compareLabel":"日环比","compareValue":"+3.5%","up":true}
 ]}
```
- `value` 必须是数字（不能含逗号字符串 `"48,620"` → NaN）
- `up: true/false` 自动转 `compareState: "1"/"0"`
- `suffix` 也可写 `unit`（同义）
- **⚠️ 高度 `h` 不受控**：组件高度由内部三层（top 标签 / middle 数值 / bottom 对比）内容 + 上下内边距自适应撑起，pos 的 `h` 只是占位不是可视高度。**默认变体内容全显需 180px**（与 defaults 的 `h=180` 对齐）—— 紧邻下方组件的 y 坐标至少预留这段，否则被压盖。若想压缩到更小高度，需手动改 `option.card` / `option.sections` 的 padding 与字号。
- **⚠️ 变体 2/3 背景图（spec_builder 已自动注入默认底图）**：
  - 变体 2（背景模式）的 `option.layout.fill.type` 默认 `"image"`，变体 3（高亮模式）的 `option.card.fill.type` 默认 `"image"`，但 defaults 中 `image.url` 是空字符串——不显式给 url 时会回退到纯色，跟变体 1 视觉差异被抹平
  - **handler 已自动填充平台内置素材 `drag/lib/img/bg01.png`**（相对 API_BASE，无需上传），变体 2 写 layout 层、变体 3 写 card 层
  - 用户覆盖方式（任一即可，优先级从高到低）：
    - spec 顶层简写：`"bgImageUrl": "<URL>"` （推荐）
    - 写完整路径：`"option":{"layout":{"fill":{"image":{"url":"<URL>"}}}}`（变体 2）/ `"option":{"card":{"fill":{"image":{"url":"<URL>"}}}}`（变体 3）
  - 平台 `drag/lib/img/` 下应有 bg01~bgN 系列（与大屏主题背景对应），按需替换文件名
  - 默认 `image.size` 为 `"100% 100%"`（非等比拉伸至容器满幅，不留白边）
  - 想完全关闭底图改纯色/渐变：spec 写 `"option":{"layout":{"fill":{"type":"color"}}}` 或 `"type":"gradient"`，handler 检测到非 image 时不覆盖

### JRingProgress（环形单值进度）
```json
{"type":"JRingProgress","pos":[...],"value":85,"title":"达成率"}
```
可选：`color`（主色） `bgColor`（轨道） `valueColor`（中心数字色） `radius` `innerRadius` `valueFontSize` `fontSize`

### JScrollBoard（DataV 轮播表）
```json
{"type":"JScrollBoard","pos":[...],
 "columns":[{"label":"设备","width":120},...],
 "rows":[["EQ-001","运行","..."],...]}
```
可选：`rowNum`(default 8) `waitTime`(2000) `headerBg`(`#0a2a4a`) `oddRowBg` `evenRowBg` `align` `headShow`(true) `index`(false)

### JScrollRankingBoard（排行榜，DataV 风格，自动降序）
```json
{"type":"JScrollRankingBoard","pos":[...],
 "data":[{"name":"...","value":<数字>},...]}
```
可选：`rowNum`(10) `sort`(true) `color:[...]`(进度条双色) `textColor` `carousel`(`single`|`page`)

⚠️ **rowNum 与滚动联动规则（实测 2026-04-28）**：
- 组件将容器高度等分为 rowNum 行渲染，**data_count > rowNum 才触发轮播滚动**
- rowNum = data_count 时全部数据一次展示完毕 → **永远不滚动**（最常见陷阱）
- **rowNum 推荐公式**：`rowNum = floor(h / 40)`（每行约 40-50px 为视觉舒适区）
  - h=195 → rowNum=4；h=250 → rowNum=6；h=300 → rowNum=7
- **数据条数推荐**：data_count ≥ rowNum + 3，滚动感明显；建议 ≥ rowNum × 1.5

### JColorGauge（多色段仪表盘）
```json
{"type":"JColorGauge","pos":[...],"value":72,"title":"市场情绪",
 "segments":[[0.3,"#ff4d4f"],[0.7,"#faad14"],[1.0,"#52c41a"]]}
```
`segments` 每项 `[占比阈值, 色值]`，不传用默认红/黄/绿。

### JListProgress（列表进度）
```json
{"type":"JListProgress","pos":[...],
 "data":[{"title":"上证指数","current":3156,"target":3200,"label":"+0.82%","date":"实时"}]}
```
可选：`color`（进度条色） `textColor` `fontSize` `barHeight`（default 12） `rowHeight`（default 90）
字段映射：`current→value`、`target→total`、`label→endLabel`（原 schema `value/total/endLabel` 也接受）。

### JFlyLineMap（飞线地图，带城市查表）
```json
{"type":"JFlyLineMap","pos":[...],"title":"资金流向",
 "data":[{"from":"北京","to":"上海","value":85}]}
```
可选：`trailLength`(0.2) `symbolSize`(6) `effectColor`（飞线色，default 金）
`from`/`to` 从 builder 内置 34 城市表查坐标；特殊城市用原 schema `{fromName, fromLng, fromLat, toName, toLng, toLat, value}`。

### JAreaMap / JBubbleMap / JBarMap（区域/散点/柱形 地图）
```json
{"type":"JAreaMap","pos":[...],"title":"...","data":[{"name":"北京","value":199}]}
```
可选 `option` / `commonOption` 传入深度合并。省份名必须精确匹配（禁止自行设计）——大量静态数据见 `references/map-static-data.md`。

### JCountTo（翻牌器 / 数字滚动）
```json
{"type":"JCountTo","pos":[...],"value":12345,"whole":true,"suffix":"元","fontSize":48}
```
`whole: true` 整体 count-up，`false` 分格翻牌。可选 `color` `prefix` `suffix` `fontWeight` `align`。

### JNumber（数值）
```json
{"type":"JNumber","pos":[...],"value":99,"color":"#d4e8ff","fontSize":28,"suffix":"家"}
```
可选 `prefix` `suffix` `fontWeight` `align`。

### JCapsuleChart（胶囊排行）
```json
{"type":"JCapsuleChart","pos":[...],"title":"TOP5",
 "data":[{"name":"A","value":100},{"name":"B","value":80}],
 "colors":["#00d4ff","#f0c040"],"showValue":true,"unit":"万"}
```

### JRankingList（排行榜，value 可为字符串）
```json
{"type":"JRankingList","pos":[...],
 "data":[{"name":"Java","value":"事项数：369"},{"name":"Nodejs","value":"事项数：258"}]}
```
与 JScrollRankingBoard 区别：此组件 value 可为描述性字符串，样式更灵活。

### JSemiGauge（半圆仪表盘）
```json
{"type":"JSemiGauge","pos":[...],"value":75,"max":100,"valueSuffix":"%","titleSuffix":"使用率"}
```
也支持原 schema `data:{total,used}`。

### JGauge（基础仪表盘）
```json
{"type":"JGauge","pos":[...],"title":"CPU","value":70,"max":100}
```

### JAntvGauge（渐变仪表盘，AntV 渲染）
```json
{"type":"JAntvGauge","pos":[...],"title":"完成度","value":0.68,"colorType":"gradient"}
```
可选 `colors`（自定义色段） `valueColor` `valueFontSize` `indicatorColor`。

### JLiquid（水波球）
```json
{"type":"JLiquid","pos":[...],"title":"达成率","value":75,"color":"#00d4ff","liquidType":"circle"}
```
可选 `borderColor` `textColor` `textFontSize`。

---

## 5. ECharts 通用组件（cartesian 有轴，auto-theme）

**已支持**：`JBar` `JStackBar` `JHorizontalBar` `JBackgroundBar` `JDynamicBar` `JMultipleBar` `JNegativeBar` `JPercentBar` `JMixLineBar` `JLine` `JSmoothLine` `JStepLine` `JArea` `JMultipleLine` `DoubleLineBar` `JScatter` `JQuadrant` `JBubble`

```json
{"type":"JBar","pos":[...],"title":"<图表标题>",
 "data":[{"name":"A","value":100,"type":"销量"},...],
 "color":"#00d4ff",
 "gradient":["v","#0064a0","#00d4ff"],   // 可选：方向/起色/终色，v纵 / h横
 "colors":["#00d4ff","#f0c040"],         // 可选：多系列配色
 "barWidth":16,
 "smooth":true,                           // 折线平滑
 "xAxis":{"interval":4,"formatter":"...","rotate":45,"type":"value"},
 "yAxis":{"min":0,"max":100,"formatter":"{value}%","type":"category"}}
```

**chartData 格式**（⚠️ 是否支持多系列由组件 defaults 决定，非笛卡尔组件通用）：

| 类别 | 组件 | chartData 字段 | dataMapping filed |
|------|------|---------------|------------------|
| **多系列**（defaults 有"分组"） | `JStackBar` `JMultipleBar` `JMultipleLine` `JMixLineBar` | `[{name, value, type}]` | `[分组, 维度, 数值]` |
| **仅单系列**（defaults 只 1 个 series） | `JArea` `JLine` `JSmoothLine` `JStepLine` `JBar` `JHorizontalBar` `JBackgroundBar` `JDynamicBar` `JNegativeBar` `JPercentBar` 等 | `[{name, value}]` | `[维度, 数值]` |

> **典型踩坑**：给 `JArea` 传 `[{name,value,type}]` 指望堆叠面积图 —— 前端只有 1 个 series，`type` 被忽略，所有数据按 `name` 聚合错位。
> **要多线/堆叠趋势 → 用 `JMultipleLine`（多折线）或 `JStackBar`（堆叠柱）替代 JArea 多系列**。

**builder 自动注入**：xAxis/yAxis 的 `axisLabel.color/axisLine/splitLine`、`tooltip.backgroundColor/textStyle`、`grid:{top:36,bottom:30,left:55,right:20}`、`legend.textStyle.color`、`title.textStyle.color`。

**单数据项着色**（板块涨跌红绿柱）：chartData 每项直接带 `itemStyle`：
```json
{"name":"有色金属","value":3.8,"itemStyle":{"color":"#ff4d4f"}}
```

**JArea 特别**：不传 `gradient` 自动用 `color` 生成 60%→10% 透明渐变 areaStyle。

---

## 6. ECharts 饼/环/极坐标组件（polar，无 xAxis/yAxis）

**已支持**：`JPie` `JRose` `JRotatePie` `JRing` `JBreakRing` `JActiveRing` `JRadialBar` `JRadar` `JCircleRadar` `JFunnel` `JPyramidFunnel`

```json
{"type":"JRing","pos":[...],"title":"行业分布",
 "data":[{"name":"金融","value":28},...],
 "colors":["#00d4ff","#f0c040","#7ee8a2","#ff7875"]}
```

**自动规避**：builder 强制 `opt.pop('xAxis')` / `opt.pop('yAxis')`，避免饼图被识别为笛卡尔坐标空白渲染。

**JPie vs JRing vs JBreakRing**：
- JPie 等半径不等角度
- JRose 等角度不等半径
- JRing 环形（中空 40~70%）
- JBreakRing **数据差距悬殊时用**（等宽弧不失衡）
- JActiveRing 鼠标悬停该段外扩

---

## 7. Passthrough 模式（未内置 handler 的组件）

**写法**：传 `option` / `chartData` / `commonOption` 原生字段；builder 自动加载 defaults 并合并。

```json
{"type":"JFlyLineMap","pos":[...],
 "data":[{"fromName":"北京","toName":"上海","fromLng":116.4,"fromLat":39.9,"toLng":121.5,"toLat":31.2,"value":85}],
 "option":{"title":{"show":true,"text":"资金流向","textStyle":{"color":"#00d4ff"}}},
 "commonOption":{"effect":{"trailLength":0.2,"symbolSize":6,"color":"#f0c040"}}}
```

### 常用城市经纬度（地图类用）
| 城市 | lng | lat | | 城市 | lng | lat |
|------|-----|-----|---|------|-----|-----|
| 北京 | 116.4074 | 39.9042 | | 上海 | 121.4737 | 31.2304 |
| 深圳 | 114.0579 | 22.5431 | | 广州 | 113.2644 | 23.1291 |
| 杭州 | 120.1551 | 30.2741 | | 成都 | 104.0657 | 30.6586 |
| 武汉 | 114.2734 | 30.5801 | | 西安 | 108.9541 | 34.2658 |
| 重庆 | 106.5049 | 29.5331 | | 天津 | 117.1901 | 39.0851 |
| 南京 | 118.7969 | 32.0603 | | 香港 | 114.1694 | 22.3193 |

### JListProgress（列表进度，passthrough）
```json
{"type":"JListProgress","pos":[...],
 "data":[{"title":"...","total":1000,"value":800,"endLabel":"80%","date":"..."}],
 "option":{
   "body":{"color":"#d4e8ff","fontSize":16},
   "bar":{"background":"#1a3a5a","color":"#00d4ff","height":12,"radius":6},
   "beginInfo":{"color":"#ffffff","fontSize":16,"fontWeight":"bold"},
   "centerTopInfo":{"color":"#f0c040","fontSize":20,"fontWeight":"bold"},
   "endInfo":{"color":"#7ee8a2","fontSize":16},
   "row":{"height":110,"padding":12}
 }}
```

### JGauge / JSemiGauge / JAntvGauge（仪表盘 passthrough）
`data: [{name,value,max}]` → `option: {series: [{...}]}` 定制色、区间。

### JCountTo（翻牌器 passthrough）
`data: [{value}]` → `option: {duration, prefix, suffix, whole, fontColor, fontSize}` （`whole:true` 整体 count-up，`whole:false` 分格翻牌）

### JNumber（数值 passthrough）
`data: [{value}]` → `option.body: {color, fontSize, fontWeight}`

---

## 8. 变体后缀规则

下列组件 `type` 允许带 `_1`/`_2`/`_3` 后缀选 defaults 模板，builder 自动剥离后缀得到真实 compType：
- `JStatsSummary_1/2/3`（或用 `variant: "1"`）
- `JCardScroll_1/2/3`
- `JScrollList_1/2/3`（整数 0/1/2 也行，见组件文档）

### 8.1 变体专属默认 = 不要手写覆盖

各变体的 defaults 已封装好渲染必需的 `option`（`direction`/`scrollDirection`/`showIndex`/`cardStyle.bgHighlightImage`/`cardStyle.backgroundImage` 等）：

| 变体 | 关键默认 |
|------|---------|
| JCardScroll_1（横向） | direction=horizontal, scrollDirection=left, showIndex=false, w=556 h=255 |
| JCardScroll_2（竖向+序号） | direction=**vertical**, scrollDirection=**up**, showIndex=true, w=430 h=**530** |
| JCardScroll_3（高亮） | direction=horizontal, showIndex=true, **bgHighlightImage** + backgroundImage 内置高亮图片，w=538 h=302 |

**写 spec 时只允许指定 `pos[w,h]` / `name` / 颜色字段**，**不要在 `option` 里手写**这些变体默认控制项。原因：

- AI 习惯按 variant_1 默认值套所有变体（导致 variant_2 仍是 horizontal、variant_3 丢 bgHighlightImage 等渲染失败）
- 变体之间的 `direction` / `cardStyle.bgHighlightImage` / `showIndex` 差异是**渲染必需**，覆盖会让组件不滚动或丢图

### 8.2 容器尺寸（w/h）选择

- **横向滚动**（JCardScroll_1/_3）：容器 `w` ≤ 卡片总宽（cardStyle.width × 数据条数 + 间距）才会滚动；过宽则卡片排满后不滚动。建议直接用 variant 默认 w（556 / 538），数据多时再适度加宽
- **竖向滚动**（JCardScroll_2）：容器 `h` 必须 < 卡片总高才滚动。**用 variant 默认 h=530**，不要因布局压短到 200~300（看似省地方实则不滚动）

---

## 9. 最小验证示例

**（a）新建大屏（默认模式）：**
```json
{
  "page": {"name":"demo","bg":"bg4"},
  "palette": "科技",
  "components": [
    {"type":"JText","pos":[500,20,920,50],"text":"demo","style":"title"},
    {"type":"JBar","pos":[10,90,620,400],"title":"销售",
     "data":[{"name":"Q1","value":120},{"name":"Q2","value":200},{"name":"Q3","value":150},{"name":"Q4","value":280}],
     "gradient":["v","#0064a0","#00d4ff"]}
  ]
}
```

```bash
no_proxy=127.0.0.1,localhost py spec_builder.py <API> <TOKEN> demo.spec.json
```

**（b）迭代替换（删+加+改色一把梭，单次 HTTP 往返）：**
```json
{
  "page": {"name":"demo"},
  "palette": "科技",
  "delete": {"types": ["JPie", "JRing", "JAntvGauge"]},
  "components": [
    {"type":"JHorizontalBar","pos":[5,275,475,195],"title":"油品占比",
     "data":[{"name":"95#","value":40},{"name":"92#","value":35}]},
    {"type":"JLiquid","pos":[1440,275,475,195],"title":"完成度","value":78}
  ]
}
```
```bash
no_proxy=127.0.0.1,localhost py spec_builder.py <API> <TOKEN> iter.spec.json --page-id <PAGE_ID>
```
运行流程：query_page → 过滤旧组件（types/names/ids 任一命中）→ 追加新组件 → 应用命名色板 → save_page。**1 次 Python 冷启动 + 2 次 HTTP**，替代"多次 comp_ops delete + spec_builder append + style_ops set-palette"串接（原 3 Python × 6 HTTP）。

---

## 10. 不走 spec_builder 的场景（直接用脚本）

- **数据集绑定**：`dataset_ops.py` / `datasource_ops.py` / `yapi_ops.py` / `files_ops.py` / `proc_ops.py`
- **组件联动/钻取**：`linkage_ops.py`
- **组件外链/JS**：`link_ops.py`
- **页面配置**：`page_ops.py`
- **模板复制**：`template_ops.py copy --replace`
- **SQL + 多图表一次出**：`multi_chart_linkage.py`
- **全 99 组件演示**：`gen_all_comps.py`

这些脚本在 `references/scripts/` 下，每个都是通用 argparse CLI。

---

## 11. spec_builder 能/不能做的边界

**能做**：
- 纯组件布局、static chartData（最常见的大屏生成场景）
- 自动 dark 主题 + 轴样式 + 渐变色 + pie 无 xAxis/yAxis + 透明 bg 等所有踩坑规避
- **迭代替换：`delete` + 追加 + `palette` 一次 save_page**（单脚本打通 comp_ops+spec_builder+style_ops 三环）
- **命名色板内嵌**：顶层 `palette: "科技"` 建完/追加完自动应用，省一次 `style_ops.py set-palette`
- **布局约束预警**：JPie/JRing 在 h<220 打印告警；JStatsSummary h<180 打印告警
- **数值组件 value 防呆**：JAntvGauge 侦测 `0<value<1` 打印告警并给出正确值
- 多页面、复用 spec 通过修改 `page.name` 重新生成

**不能做**（需走脚本）：
- 绑定真实数据集（API/SQL/FILES） → 需要 `comp_ops.py edit --bind` 或 builder 生成后手动 bind
- 组件联动/钻取 → 走 `linkage_ops.py`
- 组件群组 → 走 `group_ops.py`
- 跨大屏复制 → 走 `backup_ops.py clone`

**混合工作流**：先用 builder 建页面布局，再用专项脚本绑数据/联动（两者互不冲突）。

# 表格/列表/排行类组件速查

> 涵盖：JScrollBoard / JScrollTable / JCommonTable / JList / JScrollRankingBoard / JRankingList /  
>         JFlashList / JBubbleRank / JScrollList / JDevHistory / JPivotTable  
> 按需加载：当用户要添加表格、列表、排行榜类组件时读本文件

---

## 选型速查

| 需求 | 组件 |
|------|------|
| DataV风格自动滚动（二维数组） | JScrollBoard |
| 自定义样式表格（奇偶行/可关滚动） | JScrollTable |
| 静态表格 | JCommonTable |
| 普通数据列表 | JList |
| 名次+名称+数值自动排序（DataV风格） | JScrollRankingBoard |
| 排行榜+自定义样式/value可为描述文字 | JRankingList |
| 水平胶囊条形排行 | JCapsuleChart（见comp-group-charts.md） |
| 炫酷圆圈旋转排行（≤4项） | JFlashList |
| 气泡圆圈排行（≤5项） | JBubbleRank |
| 无缝上下滚动列表（单行/多行/带表头） | JScrollList（index:0/1/2） |
| 发展历程时间线 | JDevHistory |
| 透视表/交叉表 | JPivotTable |

---

## JScrollBoard（轮播表/DataV翻滚表格）

**尺寸** w=450 h=300  
**渲染引擎** DataV库，二维数组输入  
**chartData** `[["行1列1","行1列2",...], ["行2列1","行2列2",...], ...]`  
**动画** 行数据自动上下轮播，`hoverPause=true` 悬停暂停

**关键 option**:

| 配置 | 路径 | 示例值 |
|------|------|--------|
| **表头（对象数组！）** | `option.header` | `[{"label":"列名","key":"","width":120}]` |
| 表头显示 | `option.headShow` | `true` |
| 关闭序号列 | `option.index` | `false` |
| 表头背景色 | `option.headerBGC` | `#0a2a4a` |
| 表头高度 | `option.headerHeight` | `36` |
| 奇数行背景 | `option.oddRowBGC` | `#0d2640aa` |
| 偶数行背景 | `option.evenRowBGC` | `#071829aa` |
| 显示行数 | `option.rowNum` | `7` |
| 等待时间 | `option.waitTime` | `2500` |

**🚨 header格式踩坑（实测2026-04-22）**：`option.header:["列1","列2"]` → 表头不显示！  
必须用对象数组 `[{label:"列1", key:"", width:120}, ...]`，列宽在每个对象的`width`字段  
`option.index:false` 关闭自动序号列

---

## JScrollTable（表格/自定义样式）

**尺寸** w=450 h=300  
**chartData** `[{key: value, ...}]`（对象数组）  
**option** `fieldMapping:[{name,key,width}]`（**不是** header，B.5 映射机制）；`scroll: true/false`，`scrollTime`，`lineHeight`  
**特性** 支持 `oddColor/evenColor` 奇偶行配色，`scroll: true/false` 可控（关闭=静态表格）

**🚨 fieldMapping[*].width 是数字（默认 0 = 自动均分）**，写百分比字符串如 `"40%"` 无效会被默认值覆盖；要固定列宽用整数像素（如 `120`）。

**🚨 滚动触发条件**：数据行数 > 可视行数（≈ `h / lineHeight`），数据少了不会滚。要让滚动看上去明显：mock 数据条数 ≥ 可视行数 × 1.5。

**🚨 `option.scrollTime` 前端硬编码为 50（实测 2026-04-27）**：defaults 默认值 50，写 1500/5000 等其它值都会被 Vue 组件忽略；模板里看到的非 50 值（5000/20）也只是 JSON 残留，不实际生效。**节奏不可调**——需要慢滚必须改前端组件。

---

## JCommonTable（通用表格/静态）

**尺寸** w=450 h=300  
**chartData** `[{"field1":"v","field2":"v",...}]`  
**映射机制** 第三类（无 dataMapping）。**列真相源 = `option.columns`**（每项 `{izShow:'Y', dataIndex:'<API字段名>', title:'<列头>'}`），UI 拖入并绑数据集时前端 watcher 按 `fieldOption` 自动填 columns；脚本绑定不走 watcher，**`dataset_ops.py bind/bind-batch` 已自动写 columns**（2026-04-27 修）。手写绑定漏 columns 表格无列。`fieldOption` 只控制设计器字段下拉，与列渲染无关

---

## JList（数据列表）

**尺寸** w=450 h=300  
**dataMapping** `[{filed:'标题'},{filed:'描述'},{filed:'时间'},{filed:'封面'}]`

---

## JScrollRankingBoard（排行榜/DataV风格）

**尺寸** w=450 h=300  
**chartData** `[{name, value, rank}]`，value必须是数字，自动降序排列  
**固定3列**（名次|名称|数值），`sort=true` 自动降序

---

## JRankingList（排行榜/自定义样式）

**尺寸** w=450 h=300  
**特性** `value` 可为字符串描述（如"事项数：369"），样式可配置  
**对比JScrollRankingBoard**：JScrollRankingBoard固定3列DataV风格；此组件样式更灵活

---

## JFlashList（个性排名/炫酷圆圈）

**尺寸** w=450 h=300  
**⚠️ 最多4项**（超出截断），7个同心圆布景硬编码  
**动画** 圆圈持续旋转 + 数据块入场动画 + 每5s自动切换高亮  
**⚠️ option.title是字符串模式**（不是dict），用 `option.titleShow` 控制显隐，禁止将title改为dict（渲染 `[object Object]`）

---

## JBubbleRank（气泡排名）

**尺寸** w=450 h=300  
**⚠️ 最多5项**（超出截断），3D透视圆圈布景（rotateX(-80deg)）  
**动画** 背景圆圈旋转（5s循环）+ 气泡每5s轮流 scale(1.2) 高亮  
**config.size** 必须省略width（不同于普通组件，实测 2026-04-21）

---

## JScrollList（滚动列表，3变体）

**尺寸** w=450 h=300  
**⚠️ index是整数**（0/1/2），不是字符串（JCardScroll才用字符串'1'/'2'/'3'）

| 变体 | index | 说明 |
|------|-------|------|
| 单行 | `0`（整数）| 单行/多列flex布局 |
| 多行+序号 | `1`（整数）| 左侧序号，多字段行 |
| 带表头 | `2`（整数）| 顶部固定表头 |

**映射机制** 第二类（option内嵌字段映射），`option.fieldMapping[].key` 设置字段名  
**动画** 无缝上下滚动，内容高度<容器高度时不触发  
**⚠️ compType 必须是 `JScrollList`（无后缀）**，`JScrollList_1/2/3` 不是有效compType  
详细配置见 `references/scroll-list-option-config.md`

---

## JDevHistory（发展历程）

**尺寸** w=450 h=300 | 时间线组件

---

## JPivotTable（透视表）

**尺寸** w=450 h=300  
**Online表单 isGroup** 需要设为 true | **dataMapping** `[{filed:'分组'},{filed:'维度'},{filed:'数值'}]`

---

## 踩坑（表格/列表类）

- **🚨 JScrollBoard header必须是对象数组** 不是字符串数组，否则表头不显示（实测2026-04-22）
- **JScrollBoard rowNum** 必须在defaults中有此字段，手写option若遗漏rowNum会不显示
- **JScrollList变体后缀** `JScrollList_1/2/3` 只是default_configs.json的key，不是compType
- **JScrollList index类型** 0/1/2是整数，不是字符串（JCardScroll才用字符串'1'/'2'/'3'）
- **JFlashList最多4项** 超出截断，不是报错
- **JBubbleRank最多5项** 超出截断，config.size需省略width
- **JCommonTable** 无 dataMapping；列由 `option.columns[*].dataIndex` 渲染（不是 datasetItemList，不是 fieldOption）。脚本绑数据集必须显式写 columns，UI 拖入时前端 watcher 会代填
- **JScrollList fieldMapping** 字段名在 `option.fieldMapping[].key`，不在 dataMapping
- **🚨 JScrollTable.fieldMapping[*].width** 必须是数字（默认 0=自动均分，固定列宽用整数像素如 `120`）；写百分比字符串如 `"40%"` 会被识别为无效后 fallback 默认值
- **🚨 JScrollTable.scrollTime 硬编码 50** 前端 Vue 组件无视 option 覆盖，写其它值无效（实测 2026-04-27）
- **🚨 JScrollTable / JScrollBoard / JScrollList 滚动触发** 数据行数 ≤ 可视行数（≈`h/lineHeight` 或 `rowNum`）时不会滚动；mock 数据条数建议 ≥ 可视行数 ×1.5。JScrollList 可视行数 = `h / (option.row.height + option.row.marginBottom)`，多列时再除以 `itemsPerRow`。spec_builder 默认 chartData 仅 5-7 条，**默认值不足以触发滚动**，AI 编 mock 必须扩量

# 大屏数据集绑定 · 映射机制速查（唯一真相源）

> **仅在把 API/SQL/文件数据集绑定到组件时读本文**（整屏 spec 生成不需要）。
> 对应 SKILL.md 核心规则 #7。本文是映射机制的唯一文档——SKILL.md / pitfalls.md / spec_builder schema
> 提示里如果跟本文冲突，**以本文为准**。

---

## 0. 核心规律（30 秒读懂）

组件把「数据集字段名」接到「渲染槽位」的位置只分 **2 大类 + 无映射**：

| 类型 | 位置 | 占比 | 代表组件 |
|------|------|------|----------|
| **A · 顶层 dataMapping** | `config.dataMapping[*].{filed, mapping}` | ~72 个（绝大多数图表） | JBar / JLine / JPie / JRing / JRadar / 各种地图 / JOrbitRing / JTabToggle 等 |
| **B · 组件内 option 映射** | `config.option.<某处>` 下 7 种子模式 | 8 个特殊组件 | JStatsSummary / JPermanentCalendar / JCardScroll / JCardCarousel / JScrollList / JScrollTable / JScrollBoard / JListProgress / JSemiGauge |

此外还有约 15 个 **无映射组件**（UI 装饰 / 直读 chartData），最典型就是 **JGaoDeMap**——这类要接 API，必须 API 侧匹配组件原字段名（如 `{name, value}`），不能改映射。

### 🧭 检测算法（照着做 100% 对）

打开 `references/scripts/defaults/<CompType>.json`：

```
1) option 下是否有这些键？按**优先级从上到下**命中第一条为准：
   ├─ fieldMap                      → B.1   JStatsSummary*
   ├─ titleMapping / valueMapping   → B.2   JSemiGauge
   ├─ field.dateField / valueField  → B.3   JPermanentCalendar
   ├─ contentFieldMapping           → B.4   JCardScroll / JCardCarousel
   ├─ fieldMapping                  → B.5   JScrollList / JScrollTable
   ├─ beginFields /
   │  centerTopFields / endFields   → B.6   JListProgress
   └─ header[*].key                 → B.7   JScrollBoard
2) 以上都没有，再看顶层 dataMapping：
   ├─ 非空数组  → A
   └─ 空/不存在 → 无映射（JGaoDeMap 等，见 §4）
```

**一条关键规律**：*只要 option 下出现映射键，就以 option 为准，顶层 dataMapping 可能为空或不存在，这是正常的*。

---

## 1. 类型 A：顶层 dataMapping

```json
{
  "config": {
    "dataType": 2,
    "dataSetId": "<ds_id>",
    "dataSetName": "<ds_name>",
    "dataSetType": "api",          // or "sql"
    "dataSetApi":  "<url>",        // 从数据集 querySql 取
    "dataSetMethod": "get",
    "dataMapping": [
      {"filed": "<中文语义键>", "mapping": "<API字段名>"}
    ]
  }
}
```

### `filed` 取值表（必须照抄 defaults 里的中文语义键，写英文前端不识别）

| filed 组合 | 涉及组件 |
|-----------|---------|
| `[维度, 数值]` | JBar / JLine / JArea / JSmoothLine / JStepLine / JHorizontalBar / JBackgroundBar / JDynamicBar / JPie / JRing / JRose / JRotatePie / JActiveRing / JBreakRing / JCapsuleChart / JFunnel / JPyramidFunnel / JRingProgress / JScrollRankingBoard / JScatter / JWordCloud / JPictorial 等 |
| `[分组, 维度, 数值]` | JStackBar / JMultipleBar / JMultipleLine / JMixLineBar / JNegativeBar / JPercentBar / JBubble / JQuadrant / JRadar / JCircleRadar / JBarGroup3d / JBar3d / DoubleLineBar |
| `[区域, 数值]` | JAreaMap / JBubbleMap / JBarMap / JHeatMap |
| `[名称, 数值]` | JGauge / JAntvGauge / JColorGauge |
| `[数值]`（单项） | JCountTo / JNumber / JLiquid / JTotalProgress / JText |
| `[起点名称, 起点经度, 起点纬度, 终点名称, 终点经度, 终点纬度, 数值]` | JFlyLineMap |
| `[起点名称, …, 数值, 分组]` | JTotalFlyLineMap |
| `[区域, 数值, 分组, 经度, 纬度]` | JTotalBarMap |
| `[男, 女]` | JGender |
| `[前缀, 后缀, 背景色, 数值]` | JColorBlock |
| `[标题, 描述, 时间, 封面]` | JList |
| `[标题, 描述]` | JBubbleRank |
| `[年份, 标题]` | JDevHistory |
| `[标题, id(唯一标识), 图片地址]` | JOrbitRing |
| `[路径]` | JCarousel / JVideoPlay |
| `[文本, 数值]` | JSelectRadio / JTabToggle |
| `[标题, 跳转]` | JRadioButton |
| `[维度, 数值, 颜色]` | JPyramid3D |

> 不确定时：`cat references/scripts/defaults/<CompType>.json | grep -A20 dataMapping`

**缺字段妥协**：组件需 3 个 filed 但 API 只返 2 字段 → 保留 3 项 dataMapping，缺的那项 `mapping: ""` 留空。

---

## 2. 类型 B：组件内 option 映射（7 种子模式）

**统一结构**（所有 B 型）：
- `config.dataType=2`、`dataSetId/dataSetName/dataSetType/dataSetApi/dataSetMethod` 照填
- 顶层 `dataMapping: []` 留空（defaults 也未定义，写了也不生效）
- 改的是 `config.option.<具体位置>`

### 速查表

| 子类 | 位置 | 结构 | 适用组件 |
|------|------|------|---------|
| **B.1** | `option.fieldMap` | dict：`{内部槽位: API字段}` | JStatsSummary（含 _1/_2/_3 变体） |
| **B.2** | `option.titleMapping` + `option.valueMapping` | string × 2 | JSemiGauge |
| **B.3** | `option.field.dateField` + `option.field.valueField` | string × 2 | JPermanentCalendar |
| **B.4** | `option.contentFieldMapping[*].key` | array，逐卡片改 key | JCardScroll / JCardCarousel |
| **B.5** | `option.fieldMapping[*].key` | array，逐列改 key | JScrollList / JScrollTable |
| **B.6** | `option.beginFields[*].key` + `centerTopFields[*].key` + `endFields[*].key` | 三组 array | JListProgress |
| **B.7** | `option.header[*].key` | array，逐列改 key | JScrollBoard |

### B.1 · `option.fieldMap`（JStatsSummary）

```json
"option": {
  "fieldMap": {
    "label":         "<API字段: 卡片标题>",
    "value":         "<API字段: 数值>",
    "unit":          "<API字段: 单位>",
    "compareLabel":  "<API字段: 对比标签>",
    "compareValue":  "<API字段: 对比值>",
    "compareState":  "<API字段: 状态(1/0)>",
    "positiveValue": "1",   // ← 枚举值，不是字段名！
    "negativeValue": "0"
  }
}
```

### B.2 · `option.{titleMapping, valueMapping}`（JSemiGauge）

```json
"option": {
  "titleMapping": "<API字段: 总计>",
  "valueMapping": "<API字段: 已用>"
}
```

> 默认值 `titleMapping:"total"` / `valueMapping:"used"`——绑定自定义 API 时必须改成实际字段名。

### B.3 · `option.field.{dateField, valueField}`（JPermanentCalendar）

```json
"option": {
  "field": {"dateField": "<API字段:日期>", "valueField": "<API字段:数值>"}
}
```

### B.4 · `option.contentFieldMapping[*].key`（JCardScroll / JCardCarousel）

defaults 里 `contentFieldMapping` 是 array，每个元素对应卡片上一个槽位，含 `name`（展示名）和 `key`（要读的 API 字段）。改 key 到 API 实际字段名。

### B.5 · `option.fieldMapping[*].key`（JScrollList / JScrollTable）

同 B.4 结构。每列一项 `{name, key, ...样式}`，改 key。

### B.6 · `option.{beginFields, centerTopFields, endFields}[*].key`（JListProgress）

进度条行分三段（左标题 / 中进度 / 右日期），各是独立 array。对应 key 分别指向 API 字段。

⚠️ **三段 fields 只控制文字标签**——进度条的"百分比 = 分子/分母"由 `option.bar` 下另外两个字段决定，绑定时**必须一并改**，否则进度条不渲染：

```json
"option": {
  "bar": {
    "valueField": "<API字段: 当前进度值（分子）>",   // 默认 "value"
    "total": {
      "field": "<API字段: 总目标值（分母）>",        // 默认 "total"
      "type": "field"                              // "field" 用 API 字段；"fixed" 用下一行 value
    }
  }
}
```

UI 表现：右侧"数据映射"面板里的 **"进度字段"** 对应 `bar.valueField`，**"总数类型→来自字段"** 对应 `bar.total.field`。

实测：只改 begin/centerTop/endFields 的 key 不改 `bar.valueField/total.field` 时，文字标签能渲染但进度条整条消失（因为找不到 value/total 字段算百分比）。

### B.7 · `option.header[*].key`（JScrollBoard）

每列一项 `{label, key, align, width}`，改 key。

---

## 3. 无映射组件（直读 chartData / 用专用入口写图表配置）

| 组件 | 说明 |
|------|------|
| **JGaoDeMap** | 直接读 `{longitude, latitude, title, ...自定义字段}`（注意：旧文档写的 `{name,value:[lng,lat,size]}` 是错误的，实测 useGaode.ts 使用 `data.longitude`/`data.latitude`）。接 API 时 API 必须返回这些字段名，无法映射改名。详见 `gaode-map-option-config.md` §marker/infoWindow 配置 |
| **JCommon**（菜单"通用组件"）| 自由写 ECharts 的入口，配置不在 dataMapping/option，而在 **`config.customOption`（JS 字符串）**——前端 `eval` 拿到 option 对象，必须以 `option = {...}; return option;` 结尾。可写 function 等动态逻辑（如自定义 `tooltip.formatter` 函数）。绑数据集需要数据时，typically 在 customOption 内自取/自填；不走顶层 dataMapping |
| **JCustomEchart**（菜单"自定义组件"）| 自由写 ECharts 的入口，配置在 **`config.definitionOption`（JSON 对象）**——纯静态 JSON，不能含 function。比 JCommon 简单但功能弱（无 JS 逻辑）|
| JForm / JIframe / JImg / JVideoJs / JCurrentTime / JCustomIcon | 容器/装饰，不走数据集 |
| JDragBorder / JDragDecoration / JDragEditor / JPivotTable / JWeatherForecast | 装饰类，不走数据集 |

> **JCommon vs JCustomEchart 对照**：菜单分类不同（"通用组件" vs "自定义组件"），写入字段不同（`customOption` 字符串 vs `definitionOption` 对象），spec_builder 都按 passthrough 处理但不会自动写这两个字段——必须 spec_builder 建好组件壳后用 `bi_utils` 二次 patch 这两个字段。

---

## 4. 排查流程（图表不显示数据）

1. `dataType=2` **且** `dataSetId` 非空 — 否则组件还在用静态 chartData
2. `curl <dataSetApi>` — 确认返回 JSON 数组、字段名正确
3. `POST /drag/onlDragDatasetHead/queryById?id=<ds_id>` — 检查 `datasetItemList` 不为空（见 pitfalls.md「datasetItemList 必须二次回写」）
4. 按 §0 检测算法重判一次机制归属，确认改对位置
5. 类型 A：`filed` 必须是中文语义键，不是英文
6. **JCommonTable**：渲染列真相源是 `option.columns`（每项 `{izShow, dataIndex, title}`），不是 `dataMapping` 也不是 `fieldOption`（fieldOption 只是设计器字段下拉）。`dataset_ops.py bind/bind-batch` 现已自动按数据集字段写入 columns（同时填 fieldOption / paramOption / dataSetIzAgent / 清空 chartData）。手写绑定漏 columns 表格无列；漏 fieldOption 设计器字段下拉空

---

## 5. skill 脚本支持情况

| 脚本/函数 | 支持度 |
|-----------|--------|
| `dataset_ops.py bind --mapping "维度=x,数值=y"` | ✅ 仅类型 A |
| `dataset_ops.py bind --field-map "label=x,value=y"` | ✅ 类型 B.1 |
| `dataset_ops.py bind --header-keys "c1,c2,c3"` | ✅ 类型 B.7 |
| 类型 B.2~B.6 | 🛠 无 CLI 捷径，`comp_ops.py edit` 传 option JSON 或 `bi_utils` 直接改 config |

# BI 模式 — 大屏组件直连 Online 表 / 设计器表单 / Online 报表

> **真相源**：BI 模式（`dataType=4`）的核心字段结构、必查 API、构造模板、必填字段陷阱、运行时数据查询协议——全部在 **`jimubi-dashboard` skill 的 `references/online-design-form-chart-guide.md`**（基于 `packages/dragEngine/otherStyles/DragEngineScreen.vue` 源码分析，1200+ 行）。两个 skill 共用同一套 BI 字段语义，通用知识不在本文重复。
>
> **本文只覆盖 bigscreen 视角的差异点**：触发判定、时间过滤的 `timeCondition` 字段、与 `spec_builder.py` 的关系、复制参考大屏的最快路径。

---

## 一、何时走 BI 模式（vs SQL 数据集）

**触发关键词**：用户说"用 X 表 / cgform / jeecg 表 / Online 报表 / desform 作为数据源"、"图表用某某 Online 表的数据"、"数据从这个表来"。

| 场景 | 推荐路径 |
|------|---------|
| 业务表直接出图（按字段聚合 / 自带字典翻译 / 时间过滤）| **BI 模式** `dataType=4` |
| 用户已写好 SQL（自定义聚合 / 跨库 join / 含 `${param}`）| SQL 数据集 `dataType=2` → `dataset_ops.py` |
| 用户给静态数据 / mock | spec_builder 默认（`dataType=2` + chartData）|

BI 模式 vs SQL 数据集的区别速查：

| 维度 | BI (`dataType=4`) | SQL 数据集 (`dataType=2`) |
|------|------------------|--------------------------|
| 数据源 | 直接绑表（cgform headId / desform code / cgreport id / 聚合表）| 独立的数据集对象 |
| 字段定义 | `nameFields/valueFields/typeFields` 选表字段 | `dataMapping[*].filed` 绑数据集列 |
| 聚合 | 后端按字段类型自动 group/sum/count | SQL 自己写 GROUP BY |
| 字典翻译 | 自动（识别 `dictCode/dictTable`）| 需要 SQL 自己 JOIN |
| 时间过滤 | 内置 `filter.queryRange` 全局 + `conditionFields[*].timeCondition` 字段级 | SQL 里 WHERE 自己写 |
| 联动/钻取 | 同表字段值自动作为 condition | 需要 SQL 数据集声明 `${param}` |

## 二、字段细节 / 构造模板 / 必填陷阱 → 看 dashboard 文档

直接读 `jimubi-dashboard/references/online-design-form-chart-guide.md`，找以下小节：

| 想知道 | dashboard 文档章节 |
|-------|------------------|
| 完整 config 50+ 字段结构 | §四 完整 Config 结构（dataType: 4） |
| nameFields/valueFields 元素字段 | §三 字段结构 |
| Online vs 设计器 vs 聚合表 三分支字段加载差异（计算字段 / 字段权限 / publicFields / customDateType 等） | §九 关键差异对比 |
| 必查 API（cgform/desform 列表+字段、运行时取数）| §七 涉及的全部 API 接口 |
| 完整 Python 构造模板（`make_form_chart_config`）| §八 API 自动创建图表（脚本化方案）|
| 必填字段陷阱（compStyleConfig.summary / filter.conditionFields/customTime / sorts.name / analysis 等缺失症状）| §六 + §八 步骤 3 |
| 运行时数据查询 API（`POST /drag/onlDragDatasetHead/getTotalDataByCompId`）| §五 |
| **图表大类全清单**（`chartConfig` 17 大类 / 60+ 子图）+ 敲敲云剔除规则 | **§十三 图表大类全清单** |
| 字段拖放区规则（`nameFields/valueFields/typeFields` / `onlyValueChart` / `groupChart`）| §13.3 ~ §13.5 |
| 全局时间过滤 `filter.queryRange` 完整 16 枚举 | §11.4 时间过滤配置 |
| **ChartSetModal 三 tab 完整功能矩阵**（用户在 jeecg 弹窗里能配的所有功能） | **§十四** |
| 配置 tab：维度/数值/分组/计算字段/筛选条件 | §14.1 |
| 样式 tab：总计（sum/max/min/average）/ 数据过滤 / 显示单位 / 透视表 / 进度图 / 自定义配色 | §14.2 |
| 分析 tab：数据对比（JNumber）/ 查看原始数据 / 定时刷新 / 钻取 | §14.3 |
| 筛选条件 `condition` 枚举（按字段类型分桶 5 套） | §14.4 |
| 日期 `customDateType` / 地区 `customType` 归组枚举 | §14.5 |
| Online vs design 在 ChartSetModal 中的功能差异综合表 | §14.6 |

字段语义在两个 skill 完全一致——bigscreen 拿 dashboard 那份模板做出来的组件 config 直接 `bi_utils.add_component(PAGE, comp_type, name, x, y, w, h, cfg)` 就能挂到大屏画布。

## 三、时间过滤的 `timeCondition` 字段（bigscreen 实测发现）

dashboard 文档主要讲 `filter.queryRange`（全局粗粒度时间范围）。bigscreen 大屏组件还普遍使用另一套：`filter.conditionFields[*].timeCondition`——**字段级**时间过滤，挂在某个具体日期字段上。

```python
'filter': {
  'conditionMode': 'and',
  'conditionFields': [
    {
      'fieldName': 'sale_date',           # 业务日期字段
      'fieldTxt': '销售日期',
      'fieldType': 'Date',                # 必须是日期类字段
      'widgetType': 'date',
      'condition': '1',                   # 条件类型枚举（见 dashboard qqy-guide.md §查询方式）
      'timeCondition': 'month',           # ← 时间维度，本文重点
      'dictCode': '', 'dictField': '', 'dictTable': '', 'dictText': '',
      'fieldExtendJson': '',
    }
  ],
  'queryField': 'create_time', 'queryRange': 'all', 'customTime': [],
}
```

**`timeCondition` 枚举**（与全局 `queryRange` 共用同一套——`useOnlineDataBiz.ts` 的 `rangeOptions`，产品 UI 时间下拉 **16 个值**）：

| 状态 | 值 |
|---|---|
| ✅ 实测前端有效（参考大屏验证） | `month` |
| 🟡 后端原样保留 + 与产品 UI 时间下拉同名（前端识别推测可用，待按业务实测） | `all` / `custom`（配 `customTime: [begin,end]`） / `today` / `yesterday` / `tomorrow` / `week` / `preWeek` / `nextWeek` / `preMonth` / `nextMonth` / `year` / `preYear` / `nextYear` / `last7days` / `last30days` |

> 完整 `queryRange` 枚举说明详见 dashboard skill `online-design-form-chart-guide.md` §11.4。bigscreen 实测过 `month` 前端识别有效；其余 15 个由源码确认存在于产品下拉，但具体在某 chart.subclass 上是否生效需要在 ChartSetModal 弹窗 → 选日期字段 → 看时间下拉 → query_page 验证保存的字段值。
>
> 历史教训（已修正）：本表早期版本误列了 `quarter / preQuarter`，但源码 `rangeOptions` 没有这两个值，前端不识别——后端虽原样保留也无效。**实测某 timeCondition 值"被原样保存"≠"前端会按预期过滤"**。

`queryRange`（全局）和 `timeCondition`（字段级）可叠加，按 `conditionMode='and'` 取交集。

## 四、复制参考大屏 — 最快路径（bigscreen 实战）

环境里已有配好的 BI 大屏时，**deep copy 现有组件 config 比从 0 拼快**：省掉查字段元数据 / 凑必填字段 / 算 `option` 默认值的全部成本。

```python
import sys, json, copy, uuid
sys.path.insert(0, '<bigscreen skill 目录>/references')
import bi_utils

bi_utils.init_api('<API>', '<TOKEN>')

ref = bi_utils.query_page('<参考大屏ID>')
ref_tpl = ref.get('template', [])
if isinstance(ref_tpl, str): ref_tpl = json.loads(ref_tpl)
ref_comp = next(c for c in ref_tpl if c['component'] == 'JBar')   # 按 component / componentName 挑

new_comp = copy.deepcopy(ref_comp)
new_comp['i'] = str(uuid.uuid4())
new_comp['pageCompId'] = ''                  # 让后端重新生成
new_comp['componentName'] = '<新名称>'
new_comp['x'], new_comp['y'], new_comp['w'], new_comp['h'] = 160, 160, 1600, 800

# 改 BI 模式核心字段 ——
cfg = new_comp['config']
cfg['formId'] = '<新表 headId>'
cfg['tableName'] = '<新表名>'
cfg['formName'] = '<新表中文名>'
cfg['nameFields'] = [<field-obj>...]         # 维度字段对象，结构见 dashboard 文档 §三
cfg['valueFields'] = [<field-obj>...]        # 数值字段对象
cfg['filter']['conditionFields'][0]['fieldName'] = '<日期字段>'
cfg['filter']['conditionFields'][0]['timeCondition'] = 'year'   # 改时间维度

# 挂到目标大屏
TARGET = '<目标大屏ID>'
page = bi_utils.query_page(TARGET)
tpl = page.get('template', [])
if isinstance(tpl, str): tpl = json.loads(tpl)
tpl.insert(0, new_comp)
bi_utils._page_components[TARGET] = tpl
bi_utils.save_page(TARGET)
```

适用前提：参考大屏的图表类型（如 JBar）跟目标一致；同表换字段 / 换日期维度都很快。换图表类型则直接走 dashboard 的 `make_form_chart_config` 模板从 0 构造。

## 五、与 `spec_builder.py` 的关系

`spec_builder` 当前只产 `dataType=2`（chartData + dataMapping）的组件。**BI 模式（`dataType=4`）暂未集成进 spec_builder**——字段差异大（不要 chartData，多出 nameFields/valueFields/filter/compStyleConfig 等），强行合并会让 spec_builder 复杂度暴涨。

当前推荐：BI 模式独立走"§四 复制参考大屏"或"dashboard 文档 §八 `make_form_chart_config` 模板"。

未来若加 spec_builder 分支（如 `"dataSource": "bi-online"`），统一入口会更舒服——但目前两条路径并存可控。

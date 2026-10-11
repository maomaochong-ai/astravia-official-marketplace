# Online表单 / 设计器表单 生成图表技术指南

> 源码分析自 `packages/dragEngine/otherStyles/DragEngineScreen.vue` 及相关文件
> 适用于大屏（bigscreen）和仪表盘（dashboard）

---

## 一、概述

大屏"自定义"分类下有两种特殊组件类型：
- `compType: 'online'` → **Online表单**（基于 cgform）
- `compType: 'design'` → **设计器表单**（基于 desform）

这两类组件不走普通数据集流程，而是直接绑定表单数据，通过配置字段映射生成图表。
其标志性特征：`config.dataType = 4`。

---

## 二、完整流程（前端交互）

```
用户拖拽 online/design 到画布
  ↓
addPageComp() 检测到 ['online','design'].includes(item.compType)
  ↓
formType.value = item.compType        ← 记录是哪种表单类型
onlineRef.value.showModal()           ← 打开 FormSelectModal
  ↓
FormSelectModal：用户选择表单
  online: GET /online/cgform/head/list
  design: GET /desform/api/list/options
  确认后 emit('ok', { label, value, key, tableName, type, appId, appType })
  ↓
selectedOk(formObj) → showChartSetModal(formObj)
  ↓
ChartSetModal.showModal('add', formObj)
  formObj 赋值，调用 loadField() 加载字段
  ↓
loadField()
  online: GET /online/cgform/field/listByHeadId?headId={formObj.key}
  design: GET /desform/api/fields/{formObj.tableName}?subTable=true
  字段映射到 allFields（见下方字段结构）
  ↓
用户拖拽字段 → nameFields / valueFields / typeFields
用户选择图表类型（JBar/JPie/...）
  ↓
handleOk()：构建 saveData.config（见下方 config 结构）
emit('add', saveData)
  ↓
chartAdd(chartConfig)：newItem 加入 componentData
  component = chartConfig.component（如 'JBar'）
  config.dataType = 4
  config.formType = 'online'|'design'
```

---

## 三、字段结构

### Online 表单字段（来自 /online/cgform/field/listByHeadId）

过滤规则：`dbIsKey == 0 && dbIsPersist != 0`（非主键、已持久化）

```js
{
  fieldName: item.dbFieldName,      // DB字段名（API查询key）
  fieldTxt: item.dbFieldTxt,        // 显示名称
  fieldType: item.dbType,           // 'String'|'int'|'double'|'Date'|'Datetime'
  widgetType: item.fieldShowType,   // 控件类型：'text'|'date'|'sel'|'link_table'|...
  dictCode: item.dictField,         // 字典 code（用于翻译）
  dictField: ...,                   // 特殊：sel_user/sel_depart 时等于 dbFieldName
  dictTable: item.dictTable,
  dictText: item.dictText,
  fieldExtendJson: item.fieldExtendJson,
  // switch 控件特有
  switchOptions: ['Y', 'N'],
}
```

始终在 allFields 头部插入 `record_count`（记录数量）字段。

### 设计器表单字段（来自 /desform/api/fields/{code}?subTable=true）

过滤规则（排除以下类型）：
- `file-upload`、`imgupload`
- `options.type == 'dates'|'daterange'|'datetimerange'`

```js
{
  fieldName: item.model,            // 字段 code
  fieldTxt: item.name,              // 显示名称
  fieldType: 'string'|'number'|'date', // 归一化类型
  widgetType: item.type,            // 控件类型
  options: item.options,
  fieldShow: true,                  // false 时被过滤掉
  // 日期字段额外属性
  format: item.options.format,
  customDateType: '3',
  // 省市区级联
  customType: 'china',
}
```

特殊控件映射：
- `link-record`：fieldName = `item.options.titleField`，localField = item.model
- `sub-table-design`：fieldName = `item.children[0].model`，sourceCode = item.model
- 数值类控件（money/integer/number/rate/slider/formula/summary）→ fieldType = 'number'

始终在头部插入 `record_count`，并追加 `publicFields`（create_time 等公共字段）。

---

## 四、完整 Config 结构（dataType: 4）

```js
config: {
  // ===== 核心标记 =====
  dataType: 4,                      // 必须是 4，标识为表单图表
  formType: 'online'|'design',      // 表单类型

  // ===== 表单信息 =====
  formId: string,                   // online: cgform head ID; design: desform code
  formName: string,                 // 表单显示名称
  tableName: string,                // online: 实际表名; design: desform code（同 formId）
  type: undefined|'design'|'aggregation', // online 无此字段，design 为 'design'
  appId: string,                    // 所属应用 ID
  appType: 'current'|'other',       // 当前应用 or 其他应用

  // ===== 字段映射 =====
  nameFields: [                     // 维度字段（X轴/分类）
    { fieldName, fieldTxt, fieldType, widgetType, ... }
  ],
  valueFields: [                    // 数值字段（Y轴/指标）
    { fieldName, fieldTxt, fieldType, widgetType, ... }
  ],
  typeFields: [                     // 分组字段（仅分组图表）
    { fieldName, fieldTxt, fieldType, widgetType, ... }
  ],
  assistYFields: [],                // 辅助Y轴字段（双轴图）
  assistTypeFields: [],
  calcFields: [],                   // 计算字段（设计器表单特有）

  // ===== 时间过滤 =====
  sorts: { name: '' },
  filter: {
    queryField: 'create_time',
    queryRange: 'all',              // 'all'|'today'|'last7days'|'last30days'|...
  },

  // ===== 图表外观 =====
  chart: {
    category: 'Bar',                // 图表大类
    subclass: 'JBar',               // 图表组件名
    isGroup: false,
  },
  compStyleConfig: {},              // 样式配置
  analysis: {},                     // 分析配置
  filterField: [],                  // 筛选条件字段
  option: {},                       // ECharts option（基础）

  // ===== 其他 =====
  size: { height: 500 },
  turnConfig: { url: '' },
  jsConfig: '',
  drillData: [],
  authFieldShowResult: [],
  timeOut: 0,
}
```

---

## 五、运行时数据查询

当图表渲染时检测到 `config.dataType == 4`，调用：

```
POST /drag/onlDragDatasetHead/getTotalDataByCompId
```

请求体：
```js
{
  tableName: config.tableName,
  compName: component,              // 'JBar'|'JPie'|...
  config: {
    type: config.typeFields,
    name: config.nameFields,
    value: config.valueFields,
    assistValue: config.assistYFields,
    assistType: config.assistTypeFields,
    formType: config.formType,      // 'online'|'design'
    isAggregation: config.type === 'aggregation',
  },
  condition: {
    ...queryParams,                 // 时间范围、排序、联动参数等
  },
}
```

---

## 六、通过 API 创建设计器表单图表（正确步骤）

> **重要**：必须按照以下步骤创建，否则会出现以下错误：
> - `Cannot read properties of undefined (reading 'showTotal')` → compStyleConfig.summary 未定义
> - 设计弹窗打不开 → 字段配置不完整

### Step 1：查询设计器表单的字段结构

```python
# 获取表单字段 - 使用表单 code（不是表单 ID）
FORM_CODE = "ce_shi_yi_jian"  # 表单 code
resp = bi_utils._request('GET', f'/desform/api/fields/{FORM_CODE}', params={'subTable': True})
fields = resp.get('result', {}).get('fields', [])
# 解析字段：name 字段用 input 类型，value 字段用 number 类型
```

### Step 2：构建完整的 config（必须包含所有必需字段）

```python
cfg = {
    # ===== 核心标记 =====
    'dataType': 4,                      # 必须是 4
    'formType': 'design',                # 'online' 或 'design'

    # ===== 表单信息 =====
    'formId': FORM_CODE,               # 表单 code
    'formName': '测试意见',            # 表单显示名称
    'tableName': FORM_CODE,            # 表单 code
    'type': 'design',                   # design 表单固定值

    # ===== 字段映射 =====
    'nameFields': [                 # 维度字段
        {'fieldName': 'name', 'fieldTxt': '名称', 'fieldType': 'string', 'widgetType': 'input'}
    ],
    'valueFields': [                # 数值字段
        {'fieldName': 'number_xxx', 'fieldTxt': '数量', 'fieldType': 'number', 'widgetType': 'number'}
    ],
    'typeFields': [],              # 分组字段
    'assistYFields': [],
    'calcFields': [],

    # ===== 时间过滤 =====
    'sorts': {'name': ''},
    'filter': {'queryField': '', 'queryRange': 'all'},

    # ===== 图表配置 =====
    'chart': {
        'category': 'Funnel',       # 图表大类
        'subclass': 'JFunnel',     # 组件名
        'isGroup': False,
    },
    # ===== 样式配置（重要！必须包含 summary）=====
    'compStyleConfig': {
        'summary': {'showTotal': False, 'showY': False, 'decimals': 0}
    },
    'analysis': {},
    'filterField': [],
    'option': {'title': {'text': '漏斗图', 'show': True}},

    # ===== 其他 =====
    'size': {'height': 350},
    'turnConfig': {'url': '', 'type': '_blank'},
    'jsConfig': '',
    'drillData': [],
    'authFieldShowResult': [],
    'timeOut': 0,
}
```

### Step 3：添加组件

> **⚠️ 严禁直接调用 `bi_utils.add_component()` 后立刻 `save_page()`！**
> `add_component` 内部将 `_page_components[page_id]` 初始化为空列表，save_page 会用只含新组件的空列表覆盖整个页面，**导致已有组件全部丢失**（已观测：2026-04-10）。
>
> **正确做法：先 `query_page` 加载已有组件到 `_page_components`，再调 `add_component`。**

```python
# ✅ 正确：先加载已有模板，再添加新组件
page = bi_utils.query_page(PAGE_ID)
bi_utils._page_components[PAGE_ID] = page.get('template', [])  # 关键：加载已有组件
bi_utils.add_component(PAGE_ID, 'JFunnel', '漏斗图-设计器表单', x, y, w, h, cfg)
bi_utils.save_page(PAGE_ID)

# ❌ 错误：直接 add_component + save_page（会清空已有组件）
# comp = bi_utils.add_component(PAGE_ID, 'JFunnel', '漏斗图-设计器表单', x, y, w, h, cfg)
# bi_utils.save_page(PAGE_ID)
```

### 常见错误汇总

| 错误信息 | 原因 | 解决方法 |
|---------|------|--------|
| `Cannot read properties of undefined (reading 'showTotal')` | `compStyleConfig.summary` 未定义 | 添加 `compStyleConfig: {'summary': {'showTotal': False}}` |
| `Cannot read properties of undefined (reading 'forEach')` | 字段配置不完整 | 确保 `nameFields` 和 `valueFields` 已正确设置 |
| 设计弹窗打不开 | config 结构不完整 | 参考 Step 2 的完整 config 结构 |
| 图表不渲染 | fieldName 错误 | 使用正确的字段名（从 `/desform/api/fields/{code}` 获取） |

返回数据后处理：
- `formType == 'design'`：调用 `handleCalcFields` + `handleTranslate`
- `formType == 'online'`：调用 `handleOnlineTranslateDict` + `handleTranslateDate` + `formatTimestamp`

---

## 六、设计模式数据查询（ChartSetModal 预览）

| 模式 | API |
|------|-----|
| JeecgBoot 积木BI设计页面 | `POST /drag/onlDragDatasetHead/getDataForDesign` |
| QQYun 预览 | `POST /drag/onlDragDatasetHead/getTotalData` |
| 渲染/播放模式（通用） | `POST /drag/onlDragDatasetHead/getTotalDataByCompId` |

---

## 七、涉及的全部 API 接口

| 用途 | 方法 | 路径 |
|------|------|------|
| 查询 Online 表单列表 | GET | `/online/cgform/head/list?keyword=&pageNo=1&pageSize=10&copyType=0` |
| 查询 Online 表单字段 | GET | `/online/cgform/field/listByHeadId?headId={id}` |
| 查询设计器表单列表 | GET | `/desform/api/list/options?keywords=&pageNo=1&pageSize=10` |
| 查询设计器表单字段 | GET | `/desform/api/fields/{code}?subTable=true` |
| 查询聚合表列表 | GET | `/drag/onlDragTableRelation/list?aggregationName=&pageSize=10` |
| 查询聚合表字段 | GET | `/drag/onlDragTableRelation/getFields/{code}` |
| 预览数据（积木BI） | POST | `/drag/onlDragDatasetHead/getDataForDesign` |
| 预览数据（QQYun） | POST | `/drag/onlDragDatasetHead/getTotalData` |
| 运行时数据查询 | POST | `/drag/onlDragDatasetHead/getTotalDataByCompId` |

---

## 八、API 自动创建图表（脚本化方案）

通过 API 直接创建 online/design 表单图表，无需前端交互：

### 步骤 1：查询表单信息
```python
# Online 表单
res = get('/online/cgform/head/list', {'keyword': '表单名', 'pageNo': 1, 'pageSize': 10, 'copyType': 0})
form = res['result']['records'][0]
form_id = form['id']
table_name = form['tableName']
form_name = form['tableTxt']

# 设计器表单
res = get('/desform/api/list/options', {'keywords': '表单名', 'pageNo': 1, 'pageSize': 10})
form = res['result'][0]
form_id = form['value']     # desform code
table_name = form['value']  # 同 form_id
form_name = form['label']
```

### 步骤 2：查询字段
```python
# Online 表单字段
res = get('/online/cgform/field/listByHeadId', {'headId': form_id})
fields = [f for f in res['result'] if f['dbIsKey'] == 0 and f['dbIsPersist'] != 0]
# 每个字段: dbFieldName, dbFieldTxt, dbType, fieldShowType, dictField

# 设计器表单字段
res = get(f'/desform/api/fields/{form_id}', {'subTable': 'true'})
fields = res['result']['fields']
# 每个字段: model(code), name(txt), type(widget), options
```

### 步骤 3：构建 config 并添加组件

> **⚠️ 两个必填字段（缺一不可，否则图表无法渲染且编辑弹窗报错）：**
> - `compStyleConfig` 必须包含完整 `summary` 子对象（`useEChartsNew.ts:396` 直接访问 `.summary.showTotal`，无 optional chaining，空 `{}` 会导致 `Cannot read properties of undefined (reading 'showTotal')`）
> - `filter` 必须包含 `conditionFields: []`（`ChartSetModal.initCompConfig` 调用 `dateConditionFormat(config.filter.conditionFields)`，该函数直接 `.forEach`，传 `undefined` 导致 `Cannot read properties of undefined (reading 'forEach')`）

```python
def build_filter_fields(form_type, raw_fields):
    """
    构建 filterField 列表（筛选条件字段）。
    Online 表单：raw_fields 来自 /online/cgform/field/listByHeadId（已过滤 dbIsKey==0 && dbIsPersist!=0）
    设计器表单：raw_fields 来自 /desform/api/fields/{code} 的 fields 列表
    对应 ChartSetModal.vue 中的 criteriaFields.value。
    """
    if form_type == 'online':
        return [
            {
                'fieldName': f['dbFieldName'],
                'fieldTxt': f['dbFieldTxt'],
                'fieldType': f['dbType'],
                'widgetType': f.get('fieldShowType', 'text'),
                'dictField': f.get('dictField', ''),
            }
            for f in raw_fields
        ]
    else:  # design
        result = []
        for f in raw_fields:
            ftype = 'number' if f['type'] in ['money','integer','number','rate','slider','formula','summary'] else 'string'
            if f['type'] == 'date': ftype = 'date'
            result.append({
                'fieldName': f['model'],
                'fieldTxt': f['name'],
                'fieldType': ftype,
                'widgetType': f['type'],
                'dictField': '',
            })
        return result


def make_form_chart_config(form_type, form_id, form_name, table_name,
                            name_fields, value_fields, chart_type='JBar',
                            chart_category='Bar', type_fields=None,
                            filter_fields=None):
    """
    构建 dataType=4 的表单图表配置（经验证可渲染+可编辑的完整结构）
    filter_fields: 通过 build_filter_fields() 构建，不传则默认为空列表
    """
    filter_fields = filter_fields or []

    def field_obj(f):
        """将原始字段转为 nameFields/valueFields 格式"""
        if form_type == 'online':
            return {
                'fieldName': f['dbFieldName'],
                'fieldTxt': f['dbFieldTxt'],
                'fieldType': f['dbType'],
                'widgetType': f.get('fieldShowType', 'text'),
                'dictCode': f.get('dictField', ''),
                'dictField': f.get('dictField', ''),
                'dictTable': f.get('dictTable', ''),
                'dictText': f.get('dictText', ''),
                'fieldExtendJson': f.get('fieldExtendJson', ''),
            }
        else:  # design
            ftype = 'number' if f['type'] in ['money','integer','number','rate','slider','formula','summary'] else 'string'
            if f['type'] == 'date': ftype = 'date'
            return {
                'fieldName': f['model'],
                'fieldTxt': f['name'],
                'fieldType': ftype,
                'widgetType': f['type'],
                'options': f.get('options', {}),
            }

    return {
        # === 核心标记 ===
        'dataType': 4,
        'formType': form_type,
        'formId': form_id,
        'formName': form_name,
        'tableName': table_name,
        'type': 'design' if form_type == 'design' else None,
        'appId': '',
        'appType': 'current',

        # === 字段映射 ===
        'nameFields': [field_obj(f) for f in name_fields],
        'valueFields': [field_obj(f) for f in value_fields],
        'typeFields': [field_obj(f) for f in (type_fields or [])],
        # ⚠️ DoubleLineBar 双轴图：assistYFields 必须与 valueFields 相同，assistTypeFields 与 typeFields 相同
        # 缺少这两个字段会导致辅助 Y 轴无数据；同时必须有 seriesType 字段（即使空 []），缺少则渲染异常
        'assistYFields': [field_obj(f) for f in value_fields] if chart_type == 'DoubleLineBar' else [],
        'assistTypeFields': [field_obj(f) for f in (type_fields or [])] if chart_type == 'DoubleLineBar' else [],
        'calcFields': [],
        **({'seriesType': []} if chart_type == 'DoubleLineBar' else {}),

        # === 排序（type 字段必须存在） ===
        'sorts': {'name': '', 'type': ''},

        # ⚠️ 必须含 conditionFields:[]，否则 dateConditionFormat(undefined) 报 forEach 错误
        # ⚠️ 必须含 customTime:[]，否则 initCompConfig 读取 undefined 报错
        'filter': {
            'queryField': 'create_time',
            'queryRange': 'all',
            'conditionMode': 'AND',
            'conditionFields': [],
            'customTime': [],       # ⚠️ 与手工配置的差异点：手工配置有此字段
        },

        # === 图表类型 ===
        # ⚠️ isGroup 规则（来自实际数据对比）：
        # - 大多数图表（JBar/JLine/JPie/JLiquid/JProgress/JHorizontalBar 等）有 isGroup: false
        # - 少数图表（JGauge/DoubleLineBar 等）无 isGroup 字段
        'chart': {
            'category': chart_category,
            'subclass': chart_type,
            **({'isGroup': False} if chart_type not in {'JGauge', 'JColorGauge', 'JAntvGauge', 'JSemiGauge', 'DoubleLineBar'} else {})
        },

        # ⚠️ 必须含完整 summary 子对象，否则 useEChartsNew.ts:396 报 showTotal 错误
        'compStyleConfig': {
            'summary': {
                'showY': True,
                'showTotal': False,
                'showField': 'all',
                'totalType': 'sum',
                'showName': '总计',
            },
            'showUnit': {
                'numberLevel': '',
                'decimal': None,
                'position': 'suffix',
                'unit': '',
            },
            'assist': {
                'summary': {'showY': True, 'showField': 'all', 'totalType': 'sum', 'showName': '总计'},
                'showUnit': {'numberLevel': '', 'decimal': None, 'position': 'suffix', 'unit': ''},
            },
            'headerFreeze': False,
            'unilineShow': False,
            'izPage': False,
            'columnFreeze': False,
            'lineFreeze': False,
            'showProgressText': True,
            'progress': {'show': True, 'name': '进度'},
            'target': {'show': True, 'name': '目标'},
        },

        # === 分析（字段需完整，否则 initCompConfig 设置 undefined 属性） ===
        'analysis': {
            'isRawData': True,
            'showMode': 1,
            'showData': 1,
            'showFields': [],
            'isCompare': False,
            'compareType': '',
            'trendType': '1',
            'compareValue': None,
            'izTimeOut': False,
            'timeOut': 0,
        },

        # === 筛选条件字段（重要！）===
        # filterField 来源：ChartSetModal.loadField() 中 criteriaFields，即表单所有字段列表
        # Online 表单：从 /online/cgform/field/listByHeadId 获取，格式为：
        #   {fieldName, fieldTxt, fieldType, widgetType, dictField}
        # 设计器表单：类似但字段来源不同
        # 若创建时为空，用户打开 ChartSetModal 重新保存后会自动填充；
        # 但若要创建后即可使用过滤器，应主动填充。
        # ⚠️ 最佳实践：在查询字段时（Step B）同时构建 filterField
        'filterField': filter_fields,  # 传入从 API 查询到的字段列表（见下方 build_filter_fields）
        'actionConfig': {'operateType': 'modal', 'modalName': '', 'url': ''},  # ⚠️ 手工配置有此字段
        'dataNum': '',           # ⚠️ 手工配置有此字段
        # ⚠️ option 字段必须有完整 ECharts 配置，不能为 {} 空对象
        # 地图类组件（JBarMap等）需要 geo/area/visualMap，普通图表需要 yAxis/xAxis/grid 等
        'option': _get_default_chart_option(chart_type),  # ⚠️ 必须有值

        # ⚠️ 地图类组件（JBarMap/JAreaMap/JBubbleMap 等）必须有 commonOption
        # 非地图类组件不需要此字段（_get_chart_common_option 返回 None 时不写入）
        **({'commonOption': _get_chart_common_option(chart_type)} if _get_chart_common_option(chart_type) else {}),
        'size': {'height': 500},
        'turnConfig': {'url': ''},
        'jsConfig': '',
        'drillData': [],
        'authFieldShowResult': [],
        'timeOut': 0,
        'background': '#FFFFFF00',
        'borderColor': '#FFFFFF00',
    }


def _get_default_chart_option(chart_type):
    """获取图表类型的默认 ECharts option 配置"""
    # ⚠️ 地图组件（JBarMap/JAreaMap/JBubbleMap/JFlyLineMap 等）option 结构与普通图表完全不同
    # 地图组件必须有 geo/area/visualMap/graphic，不能有 yAxis/xAxis
    MAP_CHART_TYPES = {'JBarMap', 'JAreaMap', 'JBubbleMap', 'JFlyLineMap', 'JTotalBarMap', 'JTotalFlyLineMap', 'JHeatMap'}
    if chart_type in MAP_CHART_TYPES:
        return {
            'drillDown': False,
            'area': {
                'markerColor': '#DDE330',
                'shadowBlur': 10,
                'markerCount': 5,
                'markerOpacity': 1,
                'name': ['中国'],
                'scatterLabelShow': False,
                'shadowColor': '#DDE330',
                'value': ['china'],
                'markerType': 'effectScatter'
            },
            'geo': {
                'top': 30,
                'aspectScale': 0.96,
                'itemStyle': {
                    'normal': {
                        'shadowOffsetX': 0,
                        'borderColor': '#0692A4',
                        'shadowOffsetY': 0,
                        'areaColor': '#37805B',
                        'shadowBlur': 0,
                        'borderWidth': 1,
                        'shadowColor': '#80d9f8'
                    },
                    'emphasis': {'areaColor': '#fff59c'}
                },
                'zoom': 1,
                'roam': True
            },
            'series ': [],   # ⚠️ 注意：JBarMap 的 series 键名有尾部空格（源码如此）
            'grid': {'bottom': 115, 'show': False},
            'tooltip': {
                'backgroundColor': 'rgba(0,2,89,0.8)',
                'enterable': True,
                'fieldMapping': [],
                'show': False,
                'trigger': 'item',
                'textStyle': {'color': '#fff', 'fontSize': 20}
            },
            'title': {
                'textAlign': 'left', 'left': 10, 'show': True, 'text': '',
                'textStyle': {'fontWeight': 'normal'}
            },
            'graphic': [],
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''},
            'visualMap': {
                'max': 200,
                'show': False,
                'seriesIndex': [0]
            }
        }

    # ⚠️ 重要：option.title.text 必须为空字符串 ""，不要填入组件名！
    # 组件名显示在大屏外层 componentName，title.text 是图表内标题（用户设置后才有值）

    # ---- 仪表盘系列（JGauge / JColorGauge / JAntvGauge）----
    # ⚠️ 仪表盘不使用 yAxis/xAxis，series.type='gauge'，nameFields 必须为空列表
    GAUGE_CHART_TYPES = {'JGauge', 'JColorGauge', 'JAntvGauge'}
    if chart_type in GAUGE_CHART_TYPES:
        return {
            'grid': {'top': 53, 'left': 50, 'containLabel': True},
            'series': [
                {
                    'axisLabel': {'show': True, 'fontSize': 12},
                    'data': [],
                    'splitLine': {'lineStyle': {'color': '#eee', 'width': 4}, 'length': 15},
                    'axisTick': {'lineStyle': {'color': '#eee'}, 'show': True},
                    'progress': {'show': True},
                    'itemStyle': {'color': '#64b5f6'},
                    'detail': {'formatter': '{value}', 'fontSize': 25, 'valueAnimation': True},
                    'type': 'gauge'
                }
            ],
            'tooltip': {'formatter': '{a} <br/>{b} : {c}%'},
            'title': {'textAlign': 'left', 'text': ''},
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''}
        }

    # ---- 水波图（JLiquid）----
    # ⚠️ JLiquid 使用 echarts-liquidfill 插件，option 完全不同，无 yAxis/xAxis/series
    # nameFields 必须为空列表
    if chart_type == 'JLiquid':
        # ⚠️ JLiquid 使用 echarts-liquidfill 插件，option 完全不同，无 yAxis/xAxis/series
        # nameFields 必须为空列表
        return {
            'textFontSize': 30,
            'borderColor': '#1E90FF',
            'color': '#1E90FF',
            'distance': 1,
            'borderWidth': 2,
            'liquidType': 'circle',
            'count': 4,
            'length': 128,
            'title': {'textAlign': 'left', 'show': True, 'text': '', 'textStyle': {'color': '#464646', 'fontWeight': 'normal'}},
            'textColor': '#ffffff',
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''},
            'strokeOpacity': 0
        }

    # ---- 环形进度图（JProgress）----
    # ⚠️ JProgress 使用双柱形叠加模拟进度条，option 结构特殊：
    # - grid 全为 0（紧凑布局）
    # - 2个series（前景色进度条 + 背景灰色轨道）
    # - title.show = False（标题不显示）
    # - 无 xAxis（只有 yAxis）
    if chart_type == 'JProgress':
        return {
            'valueYOffset': 0,
            'yAxis': {'axisLabel': {'show': True}, 'yUnit': ''},
            'grid': {'top': 0, 'left': 0, 'bottom': 0, 'show': False, 'right': 55, 'containLabel': True},
            'series': [
                {
                    'barWidth': 19,
                    'color': '#FF9D00',
                    'itemStyle': {'normal': {'barBorderRadius': 10}},
                    'zlevel': 1,
                    'label': {'formatter': '{c}%', 'color': 'black', 'show': False, 'fontSize': 24, 'position': 'left'},
                    'realtimeSort': True
                },
                {
                    'barWidth': 19,
                    'color': '#9C9CA1',
                    'barGap': '-100%',
                    'itemStyle': {'normal': {'barBorderRadius': 10}},
                    'label': {'formatter': '{c}', 'color': '#ffffff', 'offset': [0, 0], 'show': True, 'fontSize': 18, 'position': 'right', 'valueAnimation': True},
                    'type': 'bar'
                }
            ],
            'tooltip': {'axisPointer': {'label': {'backgroundColor': '#333', 'show': True}, 'type': 'none'}, 'trigger': 'axis', 'confine': True},
            'valueXOffset': 0,
            'title': {'textAlign': 'left', 'show': False, 'text': '', 'textStyle': {}}
        }

    # ---- JRing（基础环形图）----
    # ⚠️ JRing 在 Online/设计器表单模式下，series 必须预填充完整环形配置（含 radius），
    # 不能留空 []——组件不会自动填充 radius，导致渲染为空白或无法识别为环形图。
    # 与普通饼图（JPie 等）不同，JRing 的 series 模板必须由 skill 主动提供。
    if chart_type == 'JRing':
        return {
            'grid': {'top': 50, 'left': 50, 'show': False},
            'series': [{
                'data': [],
                'name': 'Access From',
                'avoidLabelOverlap': False,
                'emphasis': {'label': {'show': True, 'fontSize': 14, 'fontWeight': 'bold'}},
                'label': {'show': False, 'position': 'center'},
                'labelLine': {'show': False},
                'type': 'pie',
                'radius': ['40%', '70%']
            }],
            'tooltip': {'trigger': 'item', 'textStyle': {'color': '#EEF1FA'}},
            'title': {'textAlign': 'left', 'show': True, 'text': '', 'textStyle': {'fontWeight': 'normal'}},
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''}
        }

    # ---- 饼图/环形图系列（JPie / JRose / JActiveRing / JRotatePie）----
    # ⚠️ 饼图不使用 yAxis/xAxis，tooltip trigger='item'，nameFields 用于分类维度
    # ⚠️ JRing 已在上方单独处理，不在此集合中
    PIE_CHART_TYPES = {'JPie', 'JRose', 'JActiveRing', 'JRotatePie', 'JRadialBar', 'JRingProgress'}
    if chart_type in PIE_CHART_TYPES:
        return {
            'series': [],
            'tooltip': {'trigger': 'item', 'textStyle': {'color': '#EEF1FA'}},
            'title': {'textAlign': 'left', 'show': True, 'text': '', 'textStyle': {'fontWeight': 'normal'}},
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''}
        }

    # ---- 雷达图（JRadar / JCircleRadar）----
    RADAR_CHART_TYPES = {'JRadar', 'JCircleRadar'}
    if chart_type in RADAR_CHART_TYPES:
        return {
            'radar': {'indicator': []},
            'series': [{'type': 'radar', 'data': []}],
            'tooltip': {'trigger': 'item', 'textStyle': {'color': '#EEF1FA'}},
            'title': {'textAlign': 'left', 'show': True, 'text': '', 'textStyle': {'fontWeight': 'normal'}},
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''}
        }

    # ---- 水平条形图（JHorizontalBar）----
    # ⚠️ 必须设置 yAxis.type='category', xAxis.type='value' 才能翻转坐标轴
    # 缺少 type 则 ECharts 默认都是 value 轴，导致图表无法正确渲染
    if chart_type == 'JHorizontalBar':
        return {
            'yAxis': {
                'axisLabel': {'color': '#EEF1FA'},
                'lineStyle': {'color': '#EEF1FA'},
                'splitLine': {'lineStyle': {'color': '#8F8D8D'}, 'show': False, 'interval': 2},
                'yUnit': '',
                'type': 'category'   # ⚠️ 必须有
            },
            'xAxis': {
                'axisLabel': {'color': '#EEF1FA'},
                'splitLine': {'lineStyle': {'color': '#8F8D8D'}, 'show': False},
                'type': 'value'      # ⚠️ 必须有
            },
            'grid': {'top': 30, 'left': 0, 'bottom': 18, 'show': False, 'right': 40, 'containLabel': True},
            'series': [{'barWidth': 20, 'data': [], 'itemStyle': {'color': '#64b5f6', 'borderRadius': 0}, 'type': 'bar'}],
            'tooltip': {'axisPointer': {'label': {'backgroundColor': '#333', 'show': True}, 'type': 'shadow'}, 'trigger': 'axis', 'textStyle': {'color': '#EEF1FA'}},
            'title': {'textAlign': 'left', 'show': True, 'text': '', 'textStyle': {'fontWeight': 'normal'}},
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''}
        }

    # ---- 漏斗图（JFunnel / JPyramidFunnel）----
    # ⚠️ 漏斗图绝对不能使用通用 base_option（含 yAxis/xAxis）！
    # 漏斗图无坐标轴，注入 yAxis/xAxis 会导致完全渲染异常。
    # JFunnel: sort='descending'（宽到窄，标准漏斗）；JPyramidFunnel: sort='ascending'（窄到宽，金字塔形）
    # tooltip 必须 trigger='item'（不是 'axis'），formatter='{a} <br/>{b} : {c}%'
    if chart_type in ('JFunnel', 'JPyramidFunnel'):
        return {
            'reversal': False,
            'legend': {'orient': 'horizontal'},
            'grid': {'bottom': 115},
            'series': [{
                'type': 'funnel',
                'left': '10%',
                'right': '10%',
                'bottom': '5%',
                'gap': 2,
                'name': 'Funnel',
                'sort': 'descending' if chart_type == 'JFunnel' else 'ascending',
                'label': {'show': True, 'position': 'inside'},
                'labelLine': {'lineStyle': {'width': 1, 'type': 'solid'}, 'length': 10},
                'itemStyle': {'borderColor': '#fff', 'borderWidth': 1},
                'emphasis': {'label': {'fontSize': 20}}
            }],
            'tooltip': {'formatter': '{a} <br/>{b} : {c}%', 'trigger': 'item', 'textStyle': {'color': '#EEF1FA'}},
            'title': {'textAlign': 'left', 'show': True, 'text': '', 'textStyle': {'fontWeight': 'normal'}},
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''}
        }

    # ---- 普通柱形/折线图系列（默认 base_option）----
    # ⚠️ 关键：base_option 的 series 默认为 []（空列表）
    # 原因：lodash merge 合并空数组时不覆盖目标数组已有项，
    # 各图表组件内部都有自己的 chartOption.series[0] 默认值，
    # 将 type:'bar' 作为通用默认会被 merge 进 JWordCloud 等非柱图组件导致渲染失败。
    # ⚠️ JFunnel/JPyramidFunnel 已在上方单独处理，不再落入此 base_option 分支。
    # ⚠️ option.title.text 必须为空字符串 ""，不要填入组件名！
    base_option = {
        'yAxis': {
            'axisLabel': {'color': '#EEF1FA'},
            'lineStyle': {'color': '#EEF1FA'},
            'splitLine': {'lineStyle': {'color': '#8F8D8D'}, 'show': False, 'interval': 2},
            'yUnit': ''
        },
        'xAxis': {
            'axisLabel': {'color': '#EEF1FA'}
        },
        'grid': {
            'top': 30, 'left': 0, 'bottom': 18, 'show': False, 'right': 40, 'containLabel': True
        },
        'series': [],  # ⚠️ 默认空列表，安全通用；各类型按需填充
        'tooltip': {
            'axisPointer': {'label': {'backgroundColor': '#333', 'show': True}, 'type': 'shadow'},
            'trigger': 'axis',
            'textStyle': {'color': '#EEF1FA'}
        },
        'title': {
            'textAlign': 'left', 'show': True, 'text': '',
            'textStyle': {'fontWeight': 'normal'}
        },
        'card': {
            'rightHref': '', 'size': 'default', 'extra': '', 'title': ''
        }
    }
    # 根据图表类型调整 series（只有明确类型的图表才设置）
    if chart_type == 'JBar':
        # 用户确认的正确 JBar series 模板（来自实际正确渲染的配置）
        base_option['series'] = [{'barWidth': 40, 'data': [], 'itemStyle': {'color': '#64b5f6', 'borderRadius': 0}, 'label': {'position': 'top'}, 'type': 'bar'}]
    elif chart_type in ('JStackBar', 'JMultipleBar', 'JDynamicBar', 'JNegativeBar', 'JPercentBar'):
        base_option['series'] = [{'type': 'bar', 'barWidth': 'auto'}]
    elif chart_type in ('JLine', 'JSmoothLine', 'JStepLine', 'JMultipleLine'):
        base_option['series'] = [{'type': 'line', 'smooth': False}]
    elif chart_type == 'JArea':
        base_option['series'] = [{'type': 'line', 'areaStyle': {}, 'smooth': False}]
    # DoubleLineBar / JFunnel / JPyramidFunnel / JWordCloud / JBubble / JScatter /
    # JMixLineBar / JRankingList / JCapsuleChart / JTotalProgress / JPictorial /
    # JPictorialBar / JBar3d / JBarGroup3d / JQuadrant / JCustomProgress 等
    # → 保留 series:[]，各组件内部自行管理 series 类型
    return base_option


def _get_chart_common_option(chart_type):
    """
    获取地图类图表的 commonOption（普通图表无此字段）
    JBarMap/JAreaMap/JBubbleMap 等地图组件必须包含 commonOption，否则渲染异常。
    """
    MAP_CHART_TYPES = {'JBarMap', 'JAreaMap', 'JBubbleMap', 'JFlyLineMap', 'JTotalBarMap', 'JTotalFlyLineMap', 'JHeatMap'}
    if chart_type in MAP_CHART_TYPES:
        return {
            'barSize': 12,
            'gradientColor': False,
            'breadcrumb': {'drillDown': False, 'textColor': '#ffffff'},
            'areaColor': {'color1': '#132937', 'color2': '#0A0909'},
            'barColor': '#D6F263',
            'barColor2': '#A3DB6B',
            'inRange': {'color': ['#04387b', '#467bc0']}
        }
    return None  # 非地图类图表不需要 commonOption

# 构建 newItem 并 unshift 到 template
import uuid
COMP_W, COMP_H = 600, 450
new_item = {
    'componentName': f'{form_name}-柱形图',
    'component': 'JBar',
    'config': make_form_chart_config(...),
    'i': uuid.uuid4().hex,
    'x': 50, 'y': 100, 'w': COMP_W, 'h': COMP_H,
    'visible': True,
    'orderNum': 100,
    # 顶层字段（与 config 内部同步，防止组件初始不渲染）
    'size': {'width': COMP_W, 'height': COMP_H},
    'chart': {'category': 'Bar', 'subclass': 'JBar'},
    'turnConfig': {'url': ''},
    'linkageConfig': [],
}
# ⚠️ 正确保存方式：必须赋值 _page_components 再调 save_page，不能传 template 参数
bi_utils._page_components[page_id] = template
bi_utils.save_page(page_id)
```

---

## 九、关键差异对比

| 特性 | Online 表单（cgform） | 设计器表单（desform） |
|------|----------------------|-----------------------|
| 表单列表 API | `/online/cgform/head/list` | `/desform/api/list/options` |
| 字段 API | `/online/cgform/field/listByHeadId` | `/desform/api/fields/{code}?subTable=true` |
| tableName | 实际数据库表名 | desform code（= formId） |
| config.type | 无（undefined） | `'design'` |
| 计算字段 | 不支持（`ChartSetModal.vue` 模板 `v-if="formType!=='online'"` 隐藏入口） | 支持 `addCalcField/editCalcField/delCalcField` |
| 字典翻译 | handleOnlineTranslateDict | handleTranslate |
| 日期处理 | handleTranslateDate + formatTimestamp | handleCalcFields |
| 日期归组 | 不设 customDateType | 自动设 `customDateType:'3'`（按月归组） |
| 字段权限 | 不查 | 调 `getFieldAuth(tableName)` 过滤 `authFieldShowResult` |
| 公共字段 | 不附加 | 自动追加 5 个：`create_by/update_by/update_time/create_time/bpm_status` |
| 聚合表 | 不支持 | 支持（`type='aggregation'`，走 `getAggregationFormField`） |
| 字段筛选 | `dbIsKey==0 && dbIsPersist!=0` | 排除 `file-upload/imgupload/dates/daterange/datetimerange` |
| 关联记录 | `link_table` 字段 dictText 切片首项 | `link-record/sub-table-design/link-field` 特殊解析 |
| switch 字段 | 解析 `fieldExtendJson.switchOptions`（默认 `['Y','N']`） | 不处理 |
| 省市区 | 不处理 | `area-linkage` 控件设 `customType:'china'` |
| 虚拟字段 | 头部插 `record_count`（记录数量） | 同上 |

---

## 十、compType 与最终 component 的关系

注意：`compType: 'online'|'design'` 只是触发表单选择弹窗的入口，
最终保存到 componentData 的 `component` 字段是用户在 ChartSetModal 中选择的图表类型（如 `JBar`、`JPie`、`JLine` 等）。

判断一个组件是否是表单图表：检查 `config.dataType == 4`，而非 `component` 字段。

编辑时（双击/右键编辑）：
```js
if (item.config.dataType == 4) {
  chartSetRef.value.showModal('edit', toRaw(item));
}
```

---

## 十一、使用技巧（AI 生成时参考）

### 11.1 何时选 Online 表单 vs 设计器表单

| 场景 | 推荐 |
|------|------|
| 通过 cgform 建的业务表（jeecg_demo 等） | **online** |
| 通过拖拽设计器（desform）建的表单 | **design** |
| 不确定时先调 `/online/cgform/head/list` 搜索，无结果再调 `/desform/api/list/options` | — |

### 11.2 字段角色分配建议

| 字段角色 | 放哪些字段 | 字段类型 |
|---------|-----------|---------|
| `nameFields`（X轴/维度） | 分类字段：部门、性别、状态、省份、产品名 | String/字符型 |
| `valueFields`（Y轴/指标） | 数值字段：金额、数量、评分；或 `record_count` | int/double/number/count |
| `typeFields`（分组/颜色区分） | 仅分组图表才用，选分类字段 | String |

**`record_count` 字段**（始终存在，放在 allFields 头部）：
- `fieldName: 'record_count'`，**`fieldType: 'count'`**（⚠️ 必须是 `'count'`，不能是 `'int'`/`'String'`）
- 用途：统计记录总数（不需要实际字段，后端生成 `COUNT(*)`）
- 最常用的 valueField，适合"统计各分类的数量"场景

> **⚠️ 高频踩坑：**
> 1. 将 `fieldType` 写成 `'int'` 会导致后端生成 `SUM(record_count)` → `SUM(*)` → SQL 语法错误。
> 2. `widgetType` 必须是 `'text'`，**不是** `'count'`（源码 ChartSetModal.vue countField 定义）。
> 3. 必须包含 `groupField: ''`（源码中计数字段含此字段）。
> 正确定义：
> ```python
> {'fieldName': 'record_count', 'fieldTxt': '记录数量', 'fieldType': 'count', 'widgetType': 'text', 'groupField': '', 'dictCode': ''}
> ```

### 11.3 图表类型推荐

| 字段组合 | 推荐图表 | component |
|---------|---------|-----------|
| 1个nameField + 1个valueField（分类统计） | 饼图 | `JPie` |
| 1个nameField + 1个valueField（趋势/对比） | 柱形图 | `JBar` |
| 1个nameField + 多个valueField | 多系列柱形图 | `JMultipleBar` |
| 仅1个valueField（总量） | 数字图 | `JNumber` |
| 仅1个valueField（总量+进度感） | **仪表盘** | `JGauge` |
| 有typeField（分组颜色） | 分组柱形图 | `JMultipleBar` |
| 时间nameField + valueField（趋势） | 折线图 | `JLine` |
| 多nameField + 多valueField（交叉分析） | 透视表 | `JPivotTable` |
| 1个省份/地区nameField + 1个valueField | 柱形地图 | `JBarMap` |

**⚠️ 图表字段要求差异：**

| 图表类型 | nameFields | valueFields | 说明 |
|---------|-----------|-------------|------|
| JGauge / JColorGauge / JAntvGauge | **必须为空 `[]`** | 1个数值 | 仪表盘不使用维度字段 |
| JPie / JRose / JRing | 1个分类字段 | 1个数值 | 饼图用 nameFields 做分片 |
| JBar / JLine | 1个分类字段 | 1个数值 | 标准 X/Y 轴 |
| JBarMap | 1个地区字段（省市名） | 1个数值 | 地图类，nameField 为地名 |

### 11.4 时间过滤配置

如果用户要求"近30天/本月/本年"等时间范围过滤，配置 `filter.queryRange`：

```python
'filter': {
    'queryField': 'create_time',   # 时间字段名（默认 create_time）
    'queryRange': 'last30days',    # 见下方 16 枚举
    'customTime': null,            # queryRange='custom' 时填 [begin, end]
}
```

支持的 queryRange 值（共 **16 个**，源自 `useOnlineDataBiz.ts` 的 `rangeOptions`）：

| 分组 | 值 |
|---|---|
| 通用 | `all`（全部）/ `custom`（自定义，配 `customTime: [begin,end]`）|
| 相对天 | `today` / `yesterday` / `tomorrow` |
| 相对周 | `week`（本周）/ `preWeek`（上周）/ `nextWeek`（下周） |
| 相对月 | `month`（本月）/ `preMonth`（上月）/ `nextMonth`（下月） |
| 相对年 | `year`（本年）/ `preYear`（上年）/ `nextYear`（下年） |
| 滚动天数 | `last7days`（近 7 天）/ `last30days`（近 30 天） |

> **细粒度时间过滤** `filter.conditionFields[*].timeCondition`（按某个具体日期字段过滤，而不是整屏 `queryField`）枚举值与 `queryRange` 同一套——参见 bigscreen `references/bi-mode-online.md` §三。

### 11.5 AI 创建 Online 表单图表的完整交互流程（强制）

> **用户说"使用 Online 表单创建图表"时，必须严格按以下三步执行，禁止自动猜测表单或字段。**

#### Step A：列出表单，询问用户选哪个

```python
# 查询表单列表（写入脚本文件执行，禁止 py -c 内联，因为 != 会被 shell 转义为 \!=）
res = bi_utils._request('GET', '/online/cgform/head/list',
    params={'keyword': '', 'pageNo': 1, 'pageSize': 20, 'copyType': 0})
records = (res.get('result') or {}).get('records') or []
for i, r in enumerate(records):
    print(f'[{i}] {r.get("tableTxt") or r["tableName"]} ({r["tableName"]})')
```

展示给用户：
```
找到以下 Online 表单，请问使用哪个？
  [0] 请假单 (oa_leave)
  [1] 员工信息 (demo)
  ...
```

#### Step B：查询所选表单字段，询问用户用哪些字段

```python
res2 = bi_utils._request('GET', '/online/cgform/field/listByHeadId', params={'headId': form_id})
fields = [f for f in (res2.get('result') or []) if f.get('dbIsKey') == 0 and f.get('dbIsPersist') != 0]
# 格式化展示字段供用户选择
for i, f in enumerate(fields):
    print(f'[{i}] {f["dbFieldName"]} ({f.get("dbFieldTxt","")}) - {f["dbType"]}')
```

展示给用户：
```
请选择字段：
  维度字段（饼图分类）：[4] leave_type(请假类型) / [15] sys_org_name(部门) / ...
  数值字段：record_count(记录数量) / [8] leave_days(请假天数) / ...
```

#### Step C：根据用户选择创建图表（写脚本文件执行）

**⚠️ 执行规范（强制）：**
1. **必须 Write 脚本到文件，禁止 `py -c "..."`** —— 因为 `!=` 在 shell 中被转义为 `\!=` 导致 SyntaxError
2. **无需 `sys.path.insert`** —— `py script.py` 运行时 Python 自动将脚本所在目录加入 `sys.path`，只需确保 `bi_utils.py` 与脚本在同一目录
3. **`cp bi_utils.py` 目标必须用绝对路径** —— `"C:/Users/<用户名>/bi_utils.py"`，不能用 `.`
4. **cp 和 Write 脚本并行** —— 同一轮工具调用，节省一轮

**正确执行模板（2轮）：**
```
轮次1（并行）: cp bi_utils.py "C:/Users/<用户名>/bi_utils.py" && ls 验证  +  Write 脚本文件
轮次2: cd C:/Users/<用户名> && py 脚本.py && echo URL | clip.exe && rm 脚本.py bi_utils.py
```

### 11.6 脚本化创建完整示例（Online 表单 → 饼状图，经验证可用）

```python
import sys, json, uuid
sys.stdout.reconfigure(encoding='utf-8')
import bi_utils

bi_utils.API_BASE = 'http://your-api.com'
bi_utils.TOKEN = 'your-token'
PAGE_ID = 'your-page-id'

# 1. 查询 Online 表单列表
res = bi_utils._request('GET', '/online/cgform/head/list',
    params={'keyword': '', 'pageNo': 1, 'pageSize': 20, 'copyType': 0})
records = (res.get('result') or {}).get('records') or []
form = records[0]   # 或按名称筛选
form_id    = form['id']
table_name = form['tableName']
form_name  = form.get('tableTxt') or form.get('tableName')

# 2. 查询字段（过滤非主键、已持久化）
res2 = bi_utils._request('GET', '/online/cgform/field/listByHeadId',
    params={'headId': form_id})
raw_fields = [f for f in (res2.get('result') or [])
              if f.get('dbIsKey') == 0 and f.get('dbIsPersist') != 0]

# 选分类字段（优先 sex/type/status/dept 等）
cat_fields = [f for f in raw_fields
              if f.get('dbType') == 'String'
              and f.get('fieldShowType') not in ('date','datetime','file','image','umeditor')]
pref_keys = ('sex','type','status','dept','category','grade')
name_field = next(
    (f for k in pref_keys for f in cat_fields if k in f['dbFieldName'].lower()),
    cat_fields[0] if cat_fields else raw_fields[0]
)

def field_obj_online(f):
    return {
        'fieldName': f['dbFieldName'],
        'fieldTxt':  f['dbFieldTxt'],
        'fieldType': f['dbType'],
        'widgetType': f.get('fieldShowType', 'text'),
        'dictCode':  f.get('dictField', ''),
    }

record_count_field = {
    'fieldName': 'record_count', 'fieldTxt': '记录数量',
    'fieldType': 'count', 'widgetType': 'text', 'dictCode': '',
}

# 3. 构建完整 config（必须包含 compStyleConfig.summary 和 filter.conditionFields）
config = {
    'dataType': 4,
    'formType': 'online',
    'formId': form_id,
    'formName': form_name,
    'tableName': table_name,
    'type': None,
    'appId': '', 'appType': 'current',
    'nameFields':  [field_obj_online(name_field)],
    'valueFields': [record_count_field],
    'typeFields': [], 'assistYFields': [], 'assistTypeFields': [], 'calcFields': [],
    'sorts': {'name': '', 'type': ''},
    # ⚠️ conditionFields 必须存在，否则 dateConditionFormat(undefined) 报 forEach 错误
    'filter': {
        'queryField': 'create_time', 'queryRange': 'all',
        'conditionMode': 'AND', 'conditionFields': [],
    },
    'chart': {'category': 'Pie', 'subclass': 'JPie', 'isGroup': False},
    # ⚠️ compStyleConfig.summary 必须完整，否则 useEChartsNew.ts:396 报 showTotal 错误
    'compStyleConfig': {
        'summary': {'showY': True, 'showTotal': False, 'showField': 'all', 'totalType': 'sum', 'showName': '总计'},
        'showUnit': {'numberLevel': '', 'decimal': None, 'position': 'suffix', 'unit': ''},
        'assist': {
            'summary': {'showY': True, 'showField': 'all', 'totalType': 'sum', 'showName': '总计'},
            'showUnit': {'numberLevel': '', 'decimal': None, 'position': 'suffix', 'unit': ''},
        },
        'headerFreeze': False, 'unilineShow': False, 'izPage': False,
        'columnFreeze': False, 'lineFreeze': False, 'showProgressText': True,
        'progress': {'show': True, 'name': '进度'}, 'target': {'show': True, 'name': '目标'},
    },
    'analysis': {
        'isRawData': True, 'showMode': 1, 'showData': 1, 'showFields': [],
        'isCompare': False, 'compareType': '', 'trendType': '1',
        'compareValue': None, 'izTimeOut': False, 'timeOut': 0,
    },
    'filterField': [], 'option': {}, 'size': {'height': 500},
    'turnConfig': {'url': ''}, 'jsConfig': '', 'drillData': [],
    'authFieldShowResult': [], 'timeOut': 0,
    'background': '#FFFFFF00', 'borderColor': '#FFFFFF00',
}

# 4. 读取页面，置顶插入新组件
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template', [])
if isinstance(tmpl, str):
    try: tmpl = json.loads(tmpl)
    except: tmpl = []

COMP_W, COMP_H = 600, 450
new_comp = {
    'componentName': f'{form_name}-饼状图',
    'component': 'JPie',
    'config': config,
    'i': uuid.uuid4().hex,
    'x': 50, 'y': 100, 'w': COMP_W, 'h': COMP_H,
    'visible': True, 'orderNum': 100,
    'size': {'width': COMP_W, 'height': COMP_H},
    'chart': {'category': 'Pie', 'subclass': 'JPie'},
    'turnConfig': {'url': ''}, 'linkageConfig': [],
}
tmpl.insert(0, new_comp)
# ⚠️ 必须赋值 _page_components 再调 save_page（不能给 save_page 传 template 参数）
bi_utils._page_components[PAGE_ID] = tmpl
bi_utils.save_page(PAGE_ID)
print(f'创建成功！组件: {form_name}-饼状图')
```

### 11.7 常见问题与排错

| 问题 | 原因 | 解决 |
|------|------|------|
| 图表无数据 | nameFields/valueFields 为空 | 至少设置1个 valueField |
| 饼图无颜色区分 | 没有设置 nameField | nameField 设置分类字段 |
| 字典值未翻译（显示0/1而非男/女） | online 表单字段缺 dictCode | 检查 field.dictField 是否有值 |
| 设计器表单字段加载失败 | tableName 传的不是 desform code | design 模式的 tableName = formId = desform code |
| 运行时数据为空 | tableName 与表单不对应 | online 用 tableName，design 用 formCode |
| 图表不显示（大屏） | config 中 size.height 太小 | 设为 400~600 |
| **图表渲染报错 `Cannot read properties of undefined (reading 'showTotal')`** | `config.compStyleConfig` 是空对象 `{}`，`useEChartsNew.ts:396` 直接访问 `.summary.showTotal`（无 optional chaining） | `compStyleConfig` 必须包含完整 `summary` 子对象（见上方完整 config 模板） |
| **编辑弹窗报错 `Cannot read properties of undefined (reading 'forEach')`** | `config.filter` 缺少 `conditionFields` 字段，`ChartSetModal.initCompConfig` 调用 `dateConditionFormat(config.filter.conditionFields)`，该函数直接调 `condition.forEach`，传 `undefined` 崩溃 | `filter` 中必须加 `'conditionFields': []` |
| **`option: {}` 空对象导致图表渲染异常** | skill 创建时 `option` 为空对象 `{}`，而手工配置有完整 ECharts 配置（yAxis/xAxis/grid/series/tooltip等），图表组件依赖 `option` 中的结构进行渲染和数据绑定，`{}` 会导致图表无法正常渲染 | `option` 必须传入与图表类型匹配的完整 ECharts 配置，不能为空对象 |
| **`filter.customTime` 缺失** | `initCompConfig` 中读取 `config.filter.customTime`，若缺失则 `customTime && customTime.length > 1` 报空指针 | `filter` 中必须加 `'customTime': []` |
| **`save_page` 报错或覆盖页面** | 调用 `bi_utils.save_page(page_id, template)` 传了 template 参数（该参数不存在） | 必须用 `bi_utils._page_components[page_id] = tmpl` 赋值后再 `bi_utils.save_page(page_id)` |
| **`py -c "..."` 内联脚本 SyntaxError：`\!=`** | shell 把 `!=` 转义为 `\!=`，Python 解析报 `unexpected character after line continuation character` | **禁止用 `py -c`**，必须 Write 脚本到文件再 `py script.py` |
| **`ModuleNotFoundError: No module named 'bi_utils'`** | `bi_utils.py` 与脚本文件不在同一目录，或脚本用 `py -` stdin 方式运行 | 必须先 Write 脚本文件再 `py script.py`；`cp bi_utils.py` 目标必须与脚本文件在同一目录（绝对路径）。无需 `sys.path.insert` |
| **设计器表单弹窗字段为空** | `config.formType` 未设置或值错误，前端调用 `/online/cgform/field/listByHeadId` 而非 `/desform/api/fields/{code}` | 必须设置 `formType: 'design'`（让前端调用设计器表单接口） |
| **设计器表单弹窗字段为空（进阶排查）** | `config.formId`/`tableName` 传了表单 ID（数值）而非表单 code（字符串） | design 模式的 `formId` 和 `tableName` 都必须传**表单 code**（如 `ru_ku_dan_nbc0`），不是表单 ID |
| **弹窗显示了字段，但未绑定到维度/数值栏位** | 缺少 `nameFields` 和 `valueFields` 配置，前端加载字段后用户手动拖拽但未保存 | 必须手动设置 `nameFields`（维度）和 `valueFields`（数值）数组，并保存到组件 config |

---

## 十二、设计器表单绑定字段的完整配置（2026-04-03 更新）

### 12.1 完整 config 结构

```python
cfg = {
    # === 核心标记 ===
    'dataType': 4,                      # 必须是 4
    'formType': 'design',               # 区分 Online/design 的关键字段

    # === 表单信息 ===
    'formId': form_code,                 # 设计器表单 code（如 'ru_ku_dan_nbc0'）
    'formName': form_name,              # 表单显示名称（如 '入库单'）
    'tableName': form_code,              # 同 formId
    'type': 'design',                    # design 表单固定值

    # === 字段映射（关键！没有这些字段，弹窗中字段不会绑定到维度/数值）===
    'nameFields': [                      # 维度字段（X轴/分类）
        {
            'fieldName': 'select_1763351325746_348911',  # 字段 model
            'fieldTxt': '入库类型',           # 显示名称
            'widgetType': 'select',        # 控件类型
        }
    ],
    'valueFields': [                     # 数值字段（Y轴/指标）
        {
            'fieldName': 'record_count', # 记录数量（COUNT）
            'fieldTxt': '记录数量',
            'widgetType': 'text',
            'fieldType': 'count'
        }
    ],
    'typeFields': [],                  # 分组字段（仅多系列图表）
    'assistYFields': [],                # 辅助Y轴

    # === 时间/筛选条件 ===
    'filter': {
        'queryField': '',
        'queryRange': 'all',
        'conditionFields': [],            # 必须有空数组
        'customTime': [],                # ⚠️ 必须有此字段
    },

    # === 图表配置 ===
    'chart': {
        'category': 'Funnel',
        'subclass': 'JFunnel',
    },

    # === 样式配置（必须有 summary！）===
    'compStyleConfig': {
        'summary': {'showTotal': True}
    },

    # === 其他（与手工配置的差异点）===
    'filterField': [],                   # 手工配置有44个字段；初始可为空
    'actionConfig': {'operateType': 'modal', 'modalName': '', 'url': ''},  # ⚠️ 手工配置有此字段
    'dataNum': '',                       # ⚠️ 手工配置有此字段
    'option': {},                        # ⚠️ 必须有完整 ECharts 配置，不能为空
}
```

### 12.2 正确流程（参考 online 表单流程）

1. **创建空组件**: `comp_ops.py add --comp JFunnel`
2. **查询设计器表单字段**: `GET /desform/api/fields/{form_code}?subTable=true`
3. **询问用户选择维度/数值字段**
4. **绑定配置**: 设置 `formType='design'`, `formId`, `tableName`, `type='design'`, `nameFields`, `valueFields`
5. **保存并验证**

### 12.3 前端字段区分（关键区分点）

| 判断条件 | 调用接口 |
|---------|---------|
| `config.formType == 'design'` | `GET /desform/api/fields/{tableName}?subTable=true` |
| `config.formType == 'online'` | `GET /online/cgform/field/listByHeadId?headId={formId}` |

前端弹窗逻辑（ChartSetModal.vue）：
- `type === 'design'` → 调用 `getDesignField(formObj.value.tableName)`
- `type === 'aggregation'` → 调用 `getAggregationFormField(formObj.value.tableName)`

---

## 十三、图表大类全清单（来自 `utils/constant.ts` 的 `chartConfig`）

> **来源**：`packages/utils/constant.ts` 第 466 行 `export const chartConfig = (isLowApp = true) => ...`
> **覆盖范围**：Online 表 / 设计器表 / 聚合表所有数据源都共用同一份图表清单——区别仅在 `loadField` 阶段的字段元数据。

### 13.1 完整 17 大类 / 60+ 子图

| 大类 (`chart.category`) | 显示名 | 子图 (`chart.subclass`) | 备注 |
|---|---|---|---|
| `Bar` | 柱形图 | JBar / JStackBar / JMultipleBar / JNegativeBar / JDynamicBar / JMixLineBar / JCapsuleChart / JPercentBar | 分组图 isGroup=true：JStackBar/JMultipleBar/JNegativeBar/JMixLineBar/JPercentBar |
| `HorizontalBar` | 条形图 | JHorizontalBar / JRankingList / JTotalProgress | JTotalProgress 属"只有数值"图（无 nameFields） |
| `WordCloud` | 文本 | JWordCloud | |
| `Line` | 折线图 | JLine / JArea / JMultipleLine / DoubleLineBar / JStepLine | 分组：JMultipleLine/DoubleLineBar；DoubleLineBar 双轴图 |
| `Progress` | 进度图 | JCustomProgress / JProgress / JLiquid | JLiquid 属"只有数值"图 |
| `Pictorial` | 象形图 | JPictorialBar / JPictorial | |
| `Pie` | 饼状图 | JPie / JRing / JRose / JRotatePie | |
| `Funnel` | 漏斗图 | JFunnel / JPyramidFunnel | |
| `Radar` | 雷达图 | JRadar / JCircleRadar | 分组 isGroup=true |
| `Ring` | 环形图 | JRingProgress / JActiveRing / JRadialBar | |
| `Rectangle` | 矩形图 | JRectangle | |
| `threeD` | 3D 图表 | JBar3d / JBarGroup3d | JBarGroup3d 分组 |
| `Gauge` | 仪表盘 | JColorGauge / JGauge / JAntvGauge | "只有数值"图（必须 nameFields=[]） |
| `Number` | 数值 | JNumber | "只有数值"图 |
| `Scatter` | 散点图 | JScatter / JBubble / JQuadrant | JBubble/JQuadrant 分组 |
| `Table` | 表格 | JPivotTable | 透视表（分组），有专属 pivotTable 配置 |
| `Map` | 地图 | JAreaMap / JBubbleMap / JHeatMap / JBarMap | nameField 必须为地区字段 |

### 13.3 字段拖放区行为（`useChartBiz.ts` watch 逻辑）

| 拖放区 | 触发条件 | 切换图表时清空逻辑 |
|---|---|---|
| `nameFields`（维度） | "只有数值"图除外 | 切到 `DoubleLineBar/JPivotTable/JScatter/JBubble` 时清空 |
| `valueFields`（数值） | 总是必填 | 同上 |
| `typeFields`（分组） | **仅 `selectedChart.isGroup=true`** | 切到非分组图时**自动清空** |
| `assistYFields/assistTypeFields`（辅助 Y 轴） | 仅 `DoubleLineBar` 双轴图 | — |

### 13.4 "只有数值" 图表（`onlyValueChart` computed）

下列图表**必须 `nameFields=[]`**，只用 `valueFields`：

```ts
selectedChart.category in {'Gauge', 'Number'}
  || selectedChart.subclass in {'JTotalProgress', 'JLiquid'}
```

具体清单：JGauge / JColorGauge / JAntvGauge / JNumber / JTotalProgress / JLiquid

### 13.5 分组图清单（`groupChart` 常量，`isGroup=true`）

```js
['JPivotTable','JBubble','JCircleRadar','JRadar','DoubleLineBar',
 'JMultipleLine','JNegativeBar','JMultipleBar','JStackBar','JMixLineBar',
 'JPercentBar','JQuadrant','JBarGroup3d']
```

分组图必须有 `typeFields`（分组字段），否则只渲染单系列。

### 13.6 地图图清单（`mapComponents` 常量）

```js
['JBarMap', 'JBubbleMap', 'JHeatMap', 'JAreaMap']
```

地图图 `option` 结构与普通图差异极大（含 `geo / area / visualMap / graphic`，无 `xAxis/yAxis`），需配套 `commonOption`。详见 §八 `_get_default_chart_option` 的 MAP 分支。

### 13.7 不预览 / 不联动清单（`utils/constant.ts`）

```js
noViewChart = ['JList','JCommonTable','JRadioButton','JQuickNav','JTabs','JCustomButton',
               'JIframe','JDragEditor','JCarousel','JCalendar','JCommon','JText',
               'JFilterQuery','JCurrentTime','JSimpleCard','JForm','JCustomCard',
               'JDragDecoration','JDragBorder']
ignoreLinkComp = ['JCustomButton','JIframe','JDragEditor','JCarousel','JText',
                  'JFilterQuery','JCurrentTime','JSimpleCard','JForm']
noAnalysisComp = ['JTotalProgress']  // 不显示"分析"tab
```

---

## 十四、ChartSetModal 三 tab 完整功能矩阵

> **来源**：`packages/dragEngine/modal/chartset/ChartSetModal.vue` 及子组件 `FieldConfig.vue / CompStyleConfig.vue / CompAnalysis.vue / ConditionQuery.vue / LowDrillConfig.vue / JCalcFieldModal.vue`。
>
> **覆盖范围**：BI 模式（`dataType=4`）下，Online 表 / 设计器表 / 聚合表三种数据源都可通过 ChartSetModal 弹窗配置以下功能。差异仅在「计算字段 / 字段权限 / publicFields 自动追加」三项是 design 独有，其余对 online 完全可用。

### 14.1 配置 tab（FieldConfig.vue）

| 功能 | config 路径 | 操作 / 取值 | 适用图表 |
|-----|-------------|-------------|---------|
| 维度字段 | `nameFields[]` | 拖入；菜单：重命名 + 日期格式化 + 地区分组 | 全部（除"只有数值"图） |
| 数值字段 | `valueFields[]` | 拖入；菜单：重命名 + 去重计数（仅 JNumber+`record_count`） | 全部 |
| 分组字段 | `typeFields[]` | 拖入即可 | 13 种分组图 + JPivotTable |
| 辅助 Y 轴数值 | `assistYFields[]` | 双轴图特有 | DoubleLineBar |
| 辅助 Y 轴分组 | `assistTypeFields[]` | 同上 | DoubleLineBar |
| 目标值 | `option.targetValue[fieldName]` | 数字输入 | JTotalProgress |
| 计算字段 | `calcFields[]` | 拖拽数值字段 + 四则运算 `+ - * / ( )`（不支持函数公式） | **仅 design** |
| 字段重命名 | 字段对象的 `fieldTxt` | 自定义中文名 | 全部 |
| 日期格式化 | 字段对象的 `customDateType` | 见 §14.5 | nameFields/typeFields 中的日期字段 |
| 地区分组 | 字段对象的 `customType` | 见 §14.5 | 省市区控件字段 |
| 去重计数字段 | valueFields 中的 `groupField` | 选某字段做去重计数维度 | 仅 JNumber + `record_count` |
| 筛选条件 | `filter.conditionFields[]` | 拖入字段，配 `condition` + `fieldValue` | 全部 |
| 筛选条件组合 | `filter.conditionMode` | `'and'`（且）/ `'or'`（或） | 全部 |

### 14.2 样式 tab（CompStyleConfig.vue）

#### 14.2.1 总计（非"只有数值"图通用）
```
config.compStyleConfig.summary = {
  showTotal,                    # 开关
  showField,                    # 'all' 或具体字段名
  totalType,                    # ⚠️ 完整 4 个值：'sum' 求和 / 'max' 最大值 / 'min' 最小值 / 'average' 平均值
  showName,                     # 自定义显示名
  showY,                        # 是否显示在 Y 轴（DoubleLineBar 用）
}
config.compStyleConfig.assist.summary = { ... }    # DoubleLineBar 辅助 Y 轴的总计
```

#### 14.2.2 数据过滤（限制显示前 N 项）
- `config.dataFilterNum`（普通图）
- `config.compStyleConfig.showLineCount` / `showColumnCount`（透视表行/列）

#### 14.2.3 显示单位（除 JPivotTable / JWordCloud 都有）
```
config.compStyleConfig.showUnit = {
  numberLevel,                  # '0' 无 / '1' 百分比 / '2' 千分比 / '3' 千 / '4' 万 / '5' 百万
  decimal,                      # 保留小数位（数字）
  position,                     # 'prefix' 前缀 / 'suffix' 后缀
  unit,                         # 单位文本（自由输入）
}
config.compStyleConfig.assist.showUnit = { ... }   # DoubleLineBar 辅助 Y 轴单位
```

JPivotTable 每数值字段独立配单位 → `config.compStyleConfig.unitList[index]`，结构同上。

#### 14.2.4 透视表 JPivotTable 专属

| 配置 | 路径 |
|------|------|
| 行总计开关 | `pivotTable.showLineTotal` |
| 行总计名称 | `pivotTable.lineSummary.name` |
| 行总计每字段 | `pivotTable.lineSummary.controlList[i] = {key, show, totalType, showName}` |
| 行总计位置 | `pivotTable.lineSummary.location`（`'1'` 上方 / `'2'` 下方） |
| 列总计开关 | `pivotTable.showColumnTotal` |
| 列总计每字段 | `pivotTable.columnSummary.controlList[i]` |
| 列总计位置 | `pivotTable.columnSummary.location`（`'1'` 左 / `'2'` 右） |
| 单行显示 | `compStyleConfig.unilineShow` |
| 是否分页 | `compStyleConfig.izPage`（**仅 design**） |
| 表头冻结 | `compStyleConfig.headerFreeze` + `lineFreeze` + `columnFreeze` |

#### 14.2.5 进度图专属

| 图表 | 关键配置 |
|------|---------|
| JCustomProgress | 进度色 `optionModel.progressColor` / 背景色 `backgroundColor` / 高度 `barWidth` / 内边距 `padding` / 标题色字号位置 `titleColor/titleFontSize/titlePosition`(top/middle/bottom) / 数值色字号位置 `valueColor/valueFontSize/valuePosition` |
| JTotalProgress | `compStyleConfig.showProgressText` 开关；`progress.show/name`（显示进度+文本）；`target.show/name`（显示目标+文本）|
| JActiveRing | `optionModel.showOriginValue/lineWidth/radius/activeRadius/textColor/textFontSize/customColor[]` |

#### 14.2.6 自定义配色
`config.option.customColor[]` —— 二维数组每项 `{color}`，按数据顺序循环

#### 14.2.7 图表常规配置（按图表类型不同）
来自 `packages/dragEngine/components/config.ts` 的 `dicOption[chart_type]`，每种图表暴露不同的 prop（颜色/字号/边距/图例位置/网格线/...）。展开折叠面板的 `optionList`，每项 prop 类型可为 `input / color / select / number / slider / areaSelect`。

### 14.3 分析 tab（CompAnalysis.vue）

| 折叠面板 | config 路径 | 配置 | 触发条件 |
|---------|-------------|------|---------|
| 数据对比 | `analysis.isCompare/compareType/trendType` | `compareType` 与昨日/上周/上月/上年相比（按当前 queryRange 自动）；`trendType='1'` 绿升红降 / `'2'` 红升绿降 | **仅 JNumber 且 `queryRange ≠ 'all'`** |
| 查看原始数据 | `analysis.isRawData/showMode/showData/showFields` | `showMode=1` 在图表中分栏展示；`showData=1` 按权限 / `=2` 所有数据；`showFields[]` 选字段子集 | 全部 |
| 定时刷新 | `analysis.izTimeOut/timeOut` | 开关 + 分钟数 | 排除 `noRefreshComp` 清单的图 |
| 钻取设置 | `config.drillData[]` | 数组每项 `{source: 'name'/'type'/'value', target: 字段名}`，多级钻取 | 排除 `noDrillCompForQqy` 清单的图 |

### 14.4 筛选条件 `condition` 枚举（按字段类型分桶，源自 `utils/constant.ts` 的 `conditionOptions`）

筛选区域每条 `conditionFields[i]` 必填 `condition`（条件类型），加 `fieldValue`（单值）/ `beginValue+endValue`（范围）/ `timeCondition`（日期）。

| 字段类型 | 可用 `condition` 值（label / value / 表达式） |
|---------|------------------------------------------|
| **text 字符串** | `1`=是(`=`) / `2`=不是(`!=`) / `4`=包含(`like`) / `5`=开头为(`like_begin`) / `6`=结尾为(`like_end`) / `7`=为空(`is null`) / `8`=不为空(`is not null`) |
| **select 下拉/字典** | `3`=包含(`in`) / `4`=不包含(`not in`) / `7`=为空 / `8`=不为空 |
| **onlineDeptUser 部门/用户** | `1`=是 / `2`=不是 / `3`=包含 / `4`=不包含 / `7`=为空 / `8`=不为空 |
| **number 数值** | `1`==(`=`) / `2`=≠(`!=`) / `3`=>(`>`) / `4`=<(`<`) / `5`=≥(`>=`) / `6`=≤(`<=`) / `9`=在范围内(`between`) / `10`=不在范围内(`not between`) / `7`=为空 / `8`=不为空 |
| **time/date 日期** | `1`=是 / `2`=不是 / `9`=在范围内 / `10`=不在范围内 / `7`=为空 / `8`=不为空 |

> **特殊**：`condition='9'/'10'` 范围条件 → `beginValue + endValue` 替代 `fieldValue`；`condition='7'/'8'` → `fieldValue` 留空。
>
> **日期字段额外用 `timeCondition`**（与全局 `queryRange` 同枚举，参见 §11.4）：`element.timeCondition='month'` 表示"销售日期等于本月"等业务语义，与 `condition` 互补存在。

### 14.5 日期 / 地区归组枚举

**日期归组（`customDateType`）**：

| 值 | 显示格式 |
|----|---------|
| `'1'` | 年(YYYY) |
| `'6'` | 年月(YYYY年M月) |
| `'2'` | 月(YYYY-MM) |
| `'7'` | 月简(M月) |
| `'3'` | 日(YYYY-MM-DD) |
| `'4'` | 时(YYYY-MM-DD hh) |
| `'5'` | 分(YYYY-MM-DD hh:mm) |

> 日字段是否可选 `'3'/'4'/'5'` 取决于源字段控件类型（`type='date'` 仅日，`type='datetime'` 含时分）。

**地区归组（`customType`）**：`'china'` 全国 / `'province'` 省 / `'city'` 市 / `'area'` 区。

### 14.6 Online vs design 在 ChartSetModal 中的功能差异（综合）

| 功能 | online | design |
|------|:------:|:------:|
| 维度/数值/分组 字段拖放 | ✅ | ✅ |
| 字段重命名 | ✅ | ✅ |
| 日期格式化 (customDateType) | ✅ | ✅ |
| 地区分组 (customType) | ✅ | ✅ |
| 去重计数字段（仅 JNumber+record_count） | ✅ | ✅ |
| 总计（sum/max/min/average） | ✅ | ✅ |
| 数据过滤（前 N 项） | ✅ | ✅ |
| 显示单位（数量级/小数/前后缀/单位） | ✅ | ✅ |
| 自定义配色 | ✅ | ✅ |
| 数据对比（仅 JNumber） | ✅ | ✅ |
| 查看原始数据（按权限/所有数据） | ✅ | ✅ |
| 定时刷新 | ✅ | ✅ |
| 钻取设置 | ✅ | ✅ |
| 筛选条件（含 condition / timeCondition / and-or） | ✅ | ✅ |
| 目标值（JTotalProgress） | ✅ | ✅ |
| 透视表 行/列总计 + 表头冻结 + 数据过滤 | ✅ | ✅ |
| **计算字段 (calcFields)** | ❌ | ✅ |
| **字段权限 (authFieldShowResult)** | ❌ | ✅ |
| **publicFields 自动追加（5 个公共字段）** | ❌ | ✅ |
| **透视表 是否分页 (izPage)** | ❌ | ✅ |

**结论**：online 数据源支持 ChartSetModal 几乎全部功能，仅缺 design 表特有的 4 项（计算字段、字段权限、publicFields、透视表分页）。


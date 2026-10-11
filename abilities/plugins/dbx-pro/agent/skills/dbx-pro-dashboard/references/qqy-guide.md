# 敲敲云（QQY）仪表盘详细参考

> 本文档包含 QQY 仪表盘专用配置详情，由 jimubi-dashboard skill 按需加载。

### qqyMenuData 可用组件（QQY 专用）

QQY 仪表盘组件分两类：

**⚠️ 统计图表（30个）—— 以 `chartConfig(isLowApp=true)` 为唯一权威**

> 排除逻辑：整个分类 `Progress/Pictorial/Ring/Rectangle/threeD` 全部排除；单个组件 `JDynamicBar/JMixLineBar/JCapsuleChart/JPercentBar/JStepLine/JRotatePie/JQuadrant` 排除。

| 分类 | 可用组件 compType（共30个） |
|------|--------------------------|
| **柱形图（4）** | JBar, JStackBar, JMultipleBar, JNegativeBar |
| **条形图（3）** | JHorizontalBar, JRankingList, JTotalProgress |
| **折线图（4）** | JLine, JArea, JMultipleLine, DoubleLineBar |
| **文本（1）** | JWordCloud |
| **饼状图（3）** | JPie, JRing, JRose |
| **漏斗图（2）** | JFunnel, JPyramidFunnel |
| **雷达图（2）** | JRadar, JCircleRadar |
| **仪表盘（3）** | JColorGauge, JGauge, JAntvGauge |
| **数值（1）** | JNumber |
| **散点图（2）** | JScatter, JBubble |
| **表格（1）** | JPivotTable |
| **地图（4）** | JAreaMap, JBubbleMap, JHeatMap, JBarMap |

> ❌ **以下组件在 QQY chartConfig 中不存在，禁止添加**：
> JDynamicBar, JMixLineBar, JCapsuleChart, JPercentBar, JBackgroundBar, JStepLine, JSmoothLine, JRotatePie, JQuadrant,
> JCustomProgress, JProgress, JLiquid（Progress分类）, JPictorialBar, JPictorial（Pictorial分类）,
> JRingProgress, JActiveRing, JRadialBar（Ring分类）, JRectangle（Rectangle分类）, JBar3d, JBarGroup3d（threeD分类）,
> JFlyLineMap, JTotalBarMap, JTotalFlyLineMap（不在chartConfig地图分类）,
> JCommonTable, JList（不在chartConfig）, JGrowCard, JSimpleCard, JProjectCard（不在chartConfig）

**UI / 功能组件（非统计图表）—— 仅限 QQY 敲敲云模式**

> ⚠️ **本节仅适用于敲敲云（QQY）低代码应用仪表盘，不影响常规仪表盘配置。**
> 权威来源：前端 `lowAppMenu` 数组（`qqyMenuData.ts`）—— 以下 7 个组件是 QQY 模式菜单中实际存在的非统计图表组件。**在敲敲云仪表盘中，禁止添加此列表以外的功能组件**（常规仪表盘不受此限制，可使用完整的组件列表，见"图表查询与推荐"章节）。

| 组件名称 | compType | 说明 | 数据绑定 |
|---------|---------|------|---------|
| 按钮 | `JCustomButton` | 自定义操作按钮 | 无需表单绑定 |
| 文本 | `JText` | 静态/动态文本展示 | 无需表单绑定 |
| 查询条件 | `JFilterQuery` | 筛选查询面板 | 无需表单绑定 |
| 轮播图 | `JCarousel` | 图片轮播展示 | **需绑定表单**，选择 `imgupload`/`photo`/`image` 类型字段渲染图片（`file-upload` 附件字段不可用） |
| 富文本 | `JDragEditor` | 富文本编辑器 | 无需表单绑定 |
| 嵌入URL | `JIframe` | 内嵌外部网页 | 无需表单绑定 |
| 实时日期 | `JCurrentTime` | 显示当前时间 | 无需表单绑定 |

> ❌ **以下组件不在 QQY lowAppMenu 中，禁止在敲敲云仪表盘中添加**（常规仪表盘可正常使用）：
> JWaitMatter, JDynamicInfo, JQuickNav, JProjectCard, JRadioButton, JTabs, JGrid,
> JImg, JCalendar, JMultiViewCalendar, JArchitecture, JVrHourse, online, design（独立组件）

**🚨 QQY 非统计图表组件 config 规范（验证来源：data.ts + JCarousel.vue 源码）**

> 以下配置为实际可用结构，**禁止使用 dataType:4 + nameFields 等统计图表写法**（非统计组件不走 getTotalData 接口，用 dataType:4 会导致白屏/TypeError）。

**通用 card 结构（所有组件通用）：**

> **🚨 card.title 必须为 `''`（空字符串），禁止设置为组件名称（如"实时日期"/"嵌入URL"）**。QQY 非统计图表组件的标题由 `option.body` 或 `chartData` 内容展示，卡片头设置了 title 会产生双重标题。

```python
CARD = {
    'title': '',       # 🚨 必须空字符串，所有非统计图表组件均如此，无例外
    'extra': '',
    'rightHref': '',   # 🚨 必须是空字符串，禁止改为对象或含 headColor/textStyle
    'size': 'default',
}
```

**JText（文本）：**
```python
{
    'dataType': 1,
    'url': '',
    'timeOut': 0,
    'linkageConfig': [],
    'turnConfig': {'url': ''},   # 🚨 必填，缺少时读 turnConfig.url 报 TypeError
    'chartData': '文本内容',      # 🚨 纯字符串，禁止用 {'value': '...'} dict 格式
    'background': '#FFFFFF', 'borderColor': '#E8E8E8',
    'size': {'width': w*75, 'height': h*11},
    'option': {
        'horseLamp': False, 'speed': 1000,
        'card': {**CARD},
        'body': {
            'text': '文本内容', 'color': '#464646', 'fontWeight': 'bold',
            'marginLeft': 0, 'marginTop': 20, 'letterSpacing': 0,
            'fontSize': 22, 'textAlign': 'center',
        },
    },
}
```

**JCurrentTime（实时日期）：**
```python
{
    'dataType': 1,
    'url': '',
    'timeOut': 0,
    'turnConfig': {'url': ''},   # 🚨 必填
    'chartData': '',
    'background': '#3F7DD4',     # 背景色（原始为蓝色，可自定义）
    'borderColor': '#E8E8E8',
    'size': {'width': w*75, 'height': h*11},
    'option': {
        'showWeek': 'show',      # 🚨 必须是字符串 'show'/'hide'，禁止用布尔 True/False
        'card': {**CARD},        # 🚨 title 必须为空，禁止写 'title': '实时日期'
        'body': {'text': '', 'color': '#FFFFFF', 'fontWeight': 'normal', 'marginLeft': 0, 'marginTop': 13},
    },
}
```

**JFilterQuery（查询条件）：**

> **🚨 QQY 查询条件完整配置流程（6步，必须询问用户，禁止直接执行）**
>
> 1. **关联图表**：调用 `comp_ops.py list` 列出当前仪表盘中**统计类型**图表（排除 noViewChart），询问联动控制哪几个图表
> 2. **添加条件**：询问添加几个查询条件
> 3. **条件显示名**：询问每个条件的显示名称（如"名称"、"日期"）
> 4. **筛选字段**：调用 `GET /desform/api/fields/{tableName}` 查询表单字段（过滤 SKIP_TYPES），展示给用户，询问每个条件关联哪个字段（`fieldList[i]` 对应 `relationChartList[i]`）
> 5. **查询方式**：根据字段 type 展示可用选项，询问用户选择
> 6. **执行**：收集完以上信息后，一次性写入完整 config（conditionFields + filter + relationChartList + chartData + linkageConfig）
>
> **字段类型 → 查询方式对应关系（来自 FilterSetModal.vue）：**
> - `input/textarea` 类型：等于(1) / 包含(2，LIKE，默认) / 开头是(5) / 结尾是(6)
> - `date/time/number/money/int/double/BigDecimal/integer/slider/rate`：等于(1) / 晚于-大于(3) / 早于-小于(4) / 在范围内(2，默认)
> - 其他类型（select/radio等）：等于(1)

**noViewChart 排除列表（不应出现在联动图表候选中）：**
```python
noViewChart = [
    'JFilterQuery','JText','JCustomButton','JCarousel','JDragEditor',
    'JIframe','JCurrentTime','JImg','JCalendar','JMultiViewCalendar',
    'JWaitMatter','JDynamicInfo','JQuickNav','JProjectCard','JRadioButton',
    'JTabs','JGrid','JCustomEchart','online','design'
]
```

**JFilterQuery 完整 config 结构（来自 FilterSetModal.vue resetComp/addFilter + 实操验证）：**
```python
import uuid, json

# 各条件的 fieldList 顺序必须与 relationChartList 顺序一一对应
# ⚠️ 目标图表无需任何修改，联动完全由 JFilterQuery 的 linkageConfig 驱动

# Step 1: 构建单个 conditionField 对象（conditionFields/filter.conditionFields 共用）
def make_condition_field(field_name, field_txt, field_type, widget_type, query_mode='2'):
    # query_mode: '1'=等于 '2'=包含(LIKE) '3'=晚于/大于 '4'=早于/小于 '5'=开头是 '6'=结尾是
    rule_map = {'1': 'EQ', '2': 'LIKE', '3': 'GT', '4': 'LT', '5': 'LLIKE', '6': 'RLIKE'}
    return {
        'fieldName': field_name, 'fieldTxt': field_txt,
        'fieldType': field_type, 'widgetType': widget_type,
        'rule': rule_map.get(query_mode, 'LIKE'),
        'condition': query_mode,
        'val': '', 'fieldValue': '',
        'options': [], 'fieldShow': True, 'customDateType': ''
    }

# Step 2: 构建表单字段 options（过滤不支持类型 + 去除 dataType:null）
SKIP_TYPES = {'file-upload', 'imgupload', 'sub-table-design', 'link-field',
              'auto-number', 'barcode', 'editor', 'capital-money', 'text-compose',
              'formula', 'markdown', 'location', 'summary', 'daterange', 'datetimerange'}
resp = bi_utils._request('GET', f'/desform/api/fields/{form_code}')
raw_fields = (resp.get('result') or {}).get('fields', [])
form_fields = [f for f in raw_fields if f.get('type') not in SKIP_TYPES]
for f in form_fields:                           # 去除 API 返回的 dataType:null（参考JSON无此字段）
    f.get('options', {}).pop('dataType', None)

system_fields = [                               # publicFields（前端 getFormField 自动追加，API需手动补充）
    {'name': '创建人',   'model': 'create_by',   'type': 'select-user', 'options': {}},
    {'name': '修改人',   'model': 'update_by',   'type': 'select-user', 'options': {}},
    {'name': '修改时间', 'model': 'update_time', 'type': 'date',        'options': {}},
    {'name': '创建时间', 'model': 'create_time', 'type': 'date',        'options': {}},
    {'name': '流程状态', 'model': 'bpm_status',  'type': 'select',      'options': {'dictCode': 'bpm_status', 'remote': 'dict'}},
]
all_options = form_fields + system_fields

# Step 3: 构建完整 filter_config
condition_fields = [
    make_condition_field('input_xxx', '订单名称', 'string', 'input', '2'),
    make_condition_field('money_xxx', '金额',     'number', 'money', '1'),
]

chart_data_list = [
    {
        'id': 'query_' + str(uuid.uuid4()),
        'label': '订单名称',    # 条件显示名（用户指定）
        'type': 'input',        # 字段控件类型（影响前端渲染）
        'fieldList': [          # 顺序对应 relationChartList 顺序，同表同字段则写两次
            'input_xxx',        # 图表0（基础柱形图）对应字段 model
            'input_xxx',        # 图表1（基础饼图）对应字段 model
        ],
        'queryMode': '2',       # '1'=等于 '2'=包含(LIKE) '3'=晚于 '4'=早于 '5'=开头是 '6'=结尾是
        'defVal': None, 'beginValue': None, 'endValue': None,
    },
    {
        'id': 'query_' + str(uuid.uuid4()),
        'label': '金额', 'type': 'money',
        'fieldList': ['money_xxx', 'money_xxx'],
        'queryMode': '1',
        'defVal': None, 'beginValue': None, 'endValue': None,
    },
]

filter_config = {
    'dataType': 1,
    'timeOut': 0,
    'isEnableFilterBtn': True,           # ✅ 必须，缺失则无查询按钮
    'isQueryAfterShowData': False,       # ✅ 必须，缺失则查询行为异常
    'conditionFields': condition_fields, # ✅ 必须，缺失则筛选条件不显示
    'filter': {                          # ✅ 必须，缺失则筛选面板报错
        'conditionMode': 'and',
        'conditionFields': condition_fields,  # 与顶层 conditionFields 相同
        'queryField': 'input_xxx',            # 主查询字段名（第一个条件字段）
        'customTime': [],
        'queryRange': 'all',
    },
    'relationChartList': [               # 关联的统计图表列表
        {
            'code': 'ding_dan_biao_gui5',   # tableName（工作表编码，来自图表config.tableName）
            'options': all_options,          # 表单字段 + 系统字段（见上方构建步骤）
            'checked': 1,
            'label': '基础柱形图',           # 图表显示名（componentName）
            'type': 'design',               # 来自图表 config.formType（'design'/'online'）
            'key': '1776425135452',         # 对应图表的 comp.i 值
        },
        {
            'code': 'ding_dan_biao_gui5',
            'options': all_options,         # 同一工作表可复用同一份 options
            'checked': 1,
            'label': '基础饼图',
            'type': 'design',
            'key': '17874487-...',
        },
    ],
    'chartData': json.dumps(chart_data_list, ensure_ascii=False),  # ✅ 必须是 JSON 字符串，不是 list
    'linkageConfig': [                   # ✅ 必须，缺失则查询不触发图表刷新
        {
            'linkageId': '1776425135452',   # 目标图表 comp.i
            'linkageConfig': [{'src': 'input_xxx', 'tgt': 'input_xxx'}],  # src=查询字段model，tgt=图表接收字段
        },
        {
            'linkageId': '17874487-...',
            'linkageConfig': [{'src': 'input_xxx', 'tgt': 'input_xxx'}],
        },
    ],
    'size': {'width': 1800, 'height': 110},  # height=h*11（h=10时为110）
    'background': '#FFFFFF',
    'borderColor': '#E8E8E8',
    'chart': {'subclass': 'JFilterQuery', 'category': 'Common'},
    'option': {
        'title': {'show': True, 'text': '查询条件', 'textStyle': {'color': '#464646', 'fontSize': 14}},
        'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''},
    },
}
```

**关键注意事项：**
- `conditionFields`（顶层）和 `filter.conditionFields` 必须同时存在且内容相同，缺一不可
- `chartData` 必须是 **JSON 字符串**（`json.dumps(list)`），不能是 Python list，否则前端无法解析
- `linkageConfig` 驱动查询联动，**目标图表无需任何修改**（禁止在目标图表上添加 drillData）
- `linkageConfig[].linkageConfig[].src` = JFilterQuery 传出的字段 model；`tgt` = 目标图表接收的字段 model
- `relationChartList[].options` 必须包含表单字段 + publicFields（系统字段），前端筛选面板从此列表渲染可选字段
- `options` 中需过滤不支持类型（见 SKIP_TYPES），且去除 API 返回的 `dataType: null`（与参考JSON保持一致）
- 同一工作表的多个图表，`options` 可复用同一份字段列表
- `chartData[].fieldList[i]` 对应 `relationChartList[i]` 的选中字段 model；同表同字段则写相同值两次
- 获取表单字段：`GET /desform/api/fields/{tableName}`，字段在 `result.fields`

**获取关联图表候选列表的方法（来自源码 handleChartList）：**
```python
# 来自 FilterSetModal.vue handleChartList
label = (cfg.get('option') or {}).get('title', {}).get('text', '') \
     or (cfg.get('option') or {}).get('card', {}).get('title', '') \
     or comp.get('componentName', '')
key   = comp['i']
code  = cfg.get('tableName', '')
type_ = cfg.get('type', '')   # 'design' or 'aggregation'
```

**JCustomButton（按钮）：**

> **🚨 chartData 存储规则**：
> - **简单按钮**（无表单绑定）：`chartData` 可以是 Python 列表（bi_utils 序列化时变为 JSON 数组）
> - **含表单/视图绑定**（operationType='1'/'2'）：`chartData` 必须是 **JSON 字符串**（`json.dumps(btn_list)`）——这是前端保存后的实际存储格式
> - 按钮项结构中 `worksheet` 为**完整对象**（含 label/value/key/type/desformId），不能是简单字符串

```python
import json

# 简单按钮（无绑定，chartData 用列表）
btn_list_simple = [
    {
        'btnId': str(int(time.time()*1000)),
        'title': '示例按钮',
        'icon': 'ant-design:plus-outlined',
        'color': '#1890FF',
        'operationType': '1',   # '1'=创建记录 '2'=打开视图 '3'=自定义页面 '4'=链接 '6'=业务流程
        'worksheet': '', 'view': '', 'defVal': [], 'customPage': '',
        'href': {'url': '', 'isParam': False, 'params': []},   # 🚨 href 必须是对象
        'openMode': '2',
        'bizFlow': '',
        'click': {'type': '1', 'message': {'title': '你确认执行此操作吗？', 'okText': '确认', 'cancelText': '取消'}},
    }
]

# 绑定表单视图的按钮（operationType='2'，chartData 必须用 json.dumps）
btn_list_bound = [
    {
        'btnId': str(int(time.time()*1000)),
        'title': '销售订单',
        'icon': 'ant-design:calendar-twotone',
        'color': '#ED4B82',
        'operationType': '2',   # 打开视图
        'worksheet': {          # 🚨 完整对象（含 desformId），禁止简单字符串
            'label': '表单名称', 'value': 'form_code', 'key': 'form_code',
            'type': 'form', 'desformId': 'desform_id_here',
        },
        'view': 'view_id_here', # 视图ID（GET /desform/api/list/view?desformCode=xxx 获取）
        'defVal': [], 'customPage': '',
        'href': {'url': '', 'isParam': False, 'params': []},
        'openMode': '2',
        'bizFlow': '',
        'appInfo': {'type': 'current'},   # 🚨 绑定按钮必须含此字段
        'desformId': 'desform_id_here',   # 与 worksheet.desformId 一致
        'click': {'type': '1', 'message': {'title': '你确认执行此操作吗？', 'okText': '确认', 'cancelText': '取消'}},
    }
]

config = {
    'dataType': 1,
    'url': '',
    'timeOut': 0,
    'chartData': btn_list_simple,          # 简单按钮用列表
    # 'chartData': json.dumps(btn_list_bound),  # 含绑定时用 json.dumps 字符串
    # 🚨 rowNum 默认与按钮数量相同（如5个按钮填5），确保一行横向显示；btnDirection 对 btnType=button 无效
    'option': {'title': '', 'btnType': 'button', 'btnStyle': 'solid', 'btnWidth': 'custom', 'btnDirection': 'column', 'rowNum': len(btn_list)},
    'background': '#FFFFFF', 'borderColor': '#E8E8E8',
    'size': {'width': w*75, 'height': h*11},
}
```

**JDragEditor（富文本）：**
```python
{
    'dataType': 1,
    'timeOut': 0,
    'chartData': '<p>富文本内容</p>',   # 🚨 HTML 字符串，禁止用 dict 或 json.dumps
    'background': '#FFFFFF', 'borderColor': '#E8E8E8',
    'size': {'width': w*75, 'height': h*11},
}
```

**JCarousel（轮播图）：**

> **🚨 QQY 模式强制交互流程（禁止直接添加静态图片）**：
>
> **Step 1** — 查询应用工作表列表并展示给用户选择：
> ```python
> bi_utils._request('GET', '/desform/api/list/options', params={'appId': APP_ID})
> # 展示：[1] 表单名 (code: xxx)，等待用户选择
> ```
>
> **Step 2** — 并行查询选定工作表的字段 + 视图：
> ```python
> # 字段（取 imgupload/photo/image 类型，跳过 file-upload）
> bi_utils._request('GET', f'/desform/api/fields/{FORM_CODE}', params={'subTable': True})
> # 视图
> bi_utils._request('GET', '/desform/api/list/view', params={'desformCode': FORM_CODE})
> ```
> 展示图片类字段列表和视图列表（无视图则填 `''`）。
>
> **Step 3** — 询问用户三项：
> - 使用哪个图片字段（`imgupload`/`photo`/`image` 类型，`file-upload` 附件不可用）
> - 使用哪个视图（无视图选 `''`）
> - 显示模式：全部显示（`showMode:'all'`）还是每条记录显示首张（`showMode:'single'`）
>
> **Step 4** — 拿到用户确认后写入绑定 config（见下方方式1）
>
> **唯一例外**：用户明确说"用静态图片"或"示例图片"时才可跳过 Step 1-3，直接用方式2。

```python
# 方式1：绑定表单图片字段（QQY 模式默认方式，必须走 Step 1-3 交互）
carousel_config_bound = {
    'dataType': 1,               # 🚨 dataType=1，禁止用 dataType=4
    'url': '', 'timeOut': 0,
    'linkageConfig': [],
    'dataMapping': [{'filed': '路径', 'mapping': ''}],
    # 🚨 QQY 绑定字段（JCarousel.vue queryDesDatList 函数读取）
    'worksheet': {'value': 'desform_code_xxx'},   # 必须是 {value: 表单编码} 对象
    'field': 'imgupload_xxx_xxx',                 # 🚨 imgupload/photo/image 类型字段 model，file-upload 不可用
    'view': 'view_id_or_empty_string',            # 视图ID，无视图时填 ''
    'showMode': 'all',           # 'all'=每条记录所有图片  'single'=每条记录取第一张
    'maxCount': 20,
    'appInfo': {'value': APP_ID},
    'chartData': [],
    'option': {'autoplay': True, 'dots': True, 'dotPosition': 'bottom', 'easing': ''},
    'background': '#FFFFFF', 'borderColor': '#E8E8E8',
    'size': {'width': w*75, 'height': h*11},
}

# 方式2：静态图片（仅当用户明确要求"静态/示例图片"时使用）
carousel_config_static = {
    'dataType': 1,
    'url': '', 'timeOut': 0,
    'linkageConfig': [],
    'dataMapping': [{'filed': '路径', 'mapping': ''}],
    'chartData': [
        {'src': 'https://img.alicdn.com/imgextra/i1/O1CN01YpZoEn1mS8PaFLZg7_!!6000000004952-2-tps-1920-1080.png'},
    ],
    'option': {'autoplay': True, 'dots': True, 'dotPosition': 'bottom', 'easing': ''},
    'background': '#FFFFFF', 'borderColor': '#E8E8E8',
    'size': {'width': w*75, 'height': h*11},
}
```

**JIframe（嵌入URL）：**
```python
{
    'dataType': 1,
    'url': '',
    'timeOut': 0,
    'chartData': 'http://www.jeecg.com',
    'background': '#FFFFFF', 'borderColor': '#E8E8E8',
    'size': {'width': w*75, 'height': h*11},
    'option': {
        'card': {**CARD},        # 🚨 title 必须为空，禁止写 'title': '嵌入URL'
        'body': {
            'url': 'https://help.jeecg.com',   # 🚨 url 在 option.body.url，禁止放在 option.url
        },
    },
}
```

### dataType=4：绑定表单数据（QQY 核心功能）

QQY 模式下图表组件可直接绑定敲敲云设计器表单或 Online 表单数据，**无需创建 SQL 数据集**。后端通过 `POST /drag/onlDragDatasetHead/getTotalData` 接口动态查询，HTTP 头中的 `X-Low-App-ID` 和 `X-Tenant-Id` 用于租户过滤。

**证据**：`DragPaneQqyun.vue` 中：`item?.config?.dataType == 4` 决定是否显示表单数据组件的特殊操作按钮；`useDataSource.ts` 第 387、521 行调用 `getTotalData`。

**组件 config 结构（dataType=4）：**

> **🚨 `compStyleConfig` 和 `analysis` 为必填字段**，缺少时前端 `useEChartsNew.ts` 访问 `.summary.showTotal` / `.showUnit.position` 会抛 TypeError 导致图表白屏。

```python
# QQY dataType=4 完整 config（来自 useChartBiz.ts 第41-83行 + ChartSetModal.vue）
config = {
    'dataType': 4,                    # 4 = 表单数据（QQY 专用）
    'formType': 'design',             # 'design'=设计器表单 | 'online'=Online表单
    'formId': FORM_CODE,
    'formName': FORM_NAME,
    'tableName': FORM_CODE,           # 表单编码（desformCode 或 Online表单 formCode）
    'type': 'design',                 # 与 formType 相同
    'appId': APP_ID,                  # 低代码应用ID（与 X-Low-App-ID 一致）
    'appType': 'current',
    'nameFields': [...],              # 维度字段列表
    'valueFields': [...],             # 指标字段列表（含 record_count）
    'typeFields': [],
    'assistYFields': [], 'assistTypeFields': [], 'calcFields': [],
    'sorts': {'name': '', 'type': ''},    # ✅ type 字段必填
    # ✅ 必填 conditionFields + conditionMode；queryField 建议填 'create_time'
    'filter': {'queryField': 'create_time', 'queryRange': 'all', 'conditionMode': 'and', 'conditionFields': [], 'customTime': []},
    'chart': {'category': 'Bar', 'subclass': 'JBar', 'isGroup': False},
    # isGroup=true 时需同时填 typeFields（分组字段），如 [{'fieldName':'sex','fieldTxt':'性别',...}]
    # ✅ 必填完整字段列表（含 fieldShow:True/options/customDateType），空数组导致筛选面板无字段
    'filterField': [...],   # 所有表单字段，见下方 FILTER_FIELDS 示例
    'dataNum': '',           # ✅ 必填
    'seriesType': [],        # ✅ isGroup=true 时填 [{'series':'1','type':'bar'},{'series':'2','type':'bar'},{'series':'','type':'bar'}]
    'turnConfig': {'url': ''},
    'jsConfig': '',
    'drillData': [],
    'authFieldShowResult': [],
    'timeOut': 0,
    'chartData': '[]',
    'background': '#FFFFFF',
    'borderColor': '#E8E8E8',
    'size': {'height': 385},
    # ✅ 必填：缺少此字段前端报 TypeError: Cannot read properties of undefined (reading 'showTotal')
    'compStyleConfig': {
        'summary': {
            'showY': True, 'showTotal': False, 'showField': 'all',
            'totalType': 'sum', 'showName': '总计',
        },
        'showUnit': {
            'numberLevel': '', 'decimal': None, 'position': 'suffix', 'unit': '',
        },
        'assist': {
            'summary': {'showY': True, 'showField': 'all', 'totalType': 'sum', 'showName': '总计'},
            'showUnit': {'numberLevel': '', 'decimal': None, 'position': 'suffix', 'unit': ''},
        },
        'headerFreeze': False, 'unilineShow': False, 'izPage': False,
        'columnFreeze': False, 'lineFreeze': False, 'showProgressText': True,
        'progress': {'show': True, 'name': '进度'},
        'target': {'show': True, 'name': '目标'},
    },
    # ✅ 必填：缺少时部分图表类型渲染异常；注意正确默认值（旧版 isRawData=False/trendType='mom' 均错误）
    'analysis': {
        'showData': 1, 'isRawData': True, 'showMode': 1,
        'isCompare': False, 'izTimeOut': False,
        'showFields': [], 'trendType': '1', 'timeOut': 0,
    },
    'option': {
        'card': {'title': '', 'size': 'default', 'headColor': '#FFFFFF',
                 'textStyle': {'color': '#464646', 'fontSize': 16, 'fontWeight': 'bold'}},
        'title': {'show': True, 'text': '图表标题'},
        # ✅ 笛卡尔坐标图（JBar/JLine/JArea/JHorizontalBar/JScatter 等）必须显式写 series type：
        # 'series': [{'type': 'bar'}],          # JBar / JStackBar / JMultipleBar 等
        # 'series': [{'type': 'line'}],          # JLine / JArea / JMultipleLine 等
        # 'series': [{'type': 'bar'}],           # JHorizontalBar / JRankingList（xAxis/yAxis 互换）
        # 'series': [{'type': 'scatter'}],       # JScatter
        # 缺少时 ECharts 报 [ECharts] Unknown series undefined，坐标轴显示但无数据渲染
        # 'xAxis': {'type': 'category', 'data': []},  # 纵向柱/折线
        # 'yAxis': {'type': 'value'},
        # 'grid': {'containLabel': True},
    },
}
```

**获取设计器表单列表（确认 formCode）：**

```python
# 获取应用内设计器表单列表（需要 X-Low-App-ID 头，bi_utils 已设置）
forms = bi_utils._request('GET', '/desform/api/list/options', params={'appId': APP_ID})
for f in forms.get('result', []):
    print(f['value'], f['label'])  # value=desformCode, label=表单名称

# 获取 Online 表单列表
online_forms = bi_utils._request('GET', '/online/cgform/head/list', params={'appId': APP_ID})
```

**获取表单字段列表（确认字段名）：**

```python
# ⚠️ 设计器表单：result 是 dict，字段列表在 result['fields']，不可直接迭代 result
resp = bi_utils._request('GET', f'/desform/api/fields/{FORM_CODE}', params={'subTable': True})
result = resp.get('result') or {}
raw_fields = result.get('fields', [])   # result 结构：{desformCode, titleField, desformName, id, fields:[...]}
# 每个字段属性：model=字段名, name=显示名, type=控件类型（input/number/money/select/textarea/file-upload）
for f in raw_fields:
    print(f['model'], f['type'], f['name'])

# BI 字段类型映射（控件类型 → BI fieldType，必须小写）：
# input/textarea/select/radio/checkbox → 'string'
# number/money → 'number'
# date/datetime → 'string'
# file-upload → 跳过（不能作为维度/指标）

# Online 表单字段（结构与设计器不同，result 是 list）
fields = bi_utils._request('GET', '/online/cgform/field/listByHeadId', params={'headId': online_form_id})
```

**创建绑定表单数据的图表（完整脚本模板）：**

```python
import json, time, random
import bi_utils

t0 = time.time()
API_BASE = '<api_base>'
TOKEN = 'your-token'
APP_ID = '应用ID'
TENANT_ID = '1'
PAGE_ID = '仪表盘页面ID'
FORM_CODE = 'desform_code_xxx'   # 设计器表单编码
FORM_TYPE = 'design'             # 'design' 或 'online'

bi_utils.init_api(API_BASE, TOKEN, extra_headers={
    'X-Low-App-ID': APP_ID,
    'X-Tenant-Id': str(TENANT_ID),
})

# 缓存已有组件（防止覆盖）
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template', [])
if isinstance(tmpl, str): tmpl = json.loads(tmpl)
bi_utils._page_components[PAGE_ID] = tmpl

# compStyleConfig / analysis 默认值（必须包含，缺少时前端报 TypeError）
DEFAULT_COMP_STYLE_CONFIG = {
    'summary': {'showY': True, 'showTotal': False, 'showField': 'all', 'totalType': 'sum', 'showName': '总计'},
    'showUnit': {'numberLevel': '', 'decimal': None, 'position': 'suffix', 'unit': ''},
    'assist': {
        'summary': {'showY': True, 'showField': 'all', 'totalType': 'sum', 'showName': '总计'},
        'showUnit': {'numberLevel': '', 'decimal': None, 'position': 'suffix', 'unit': ''},
    },
    'headerFreeze': False, 'unilineShow': False, 'izPage': False,
    'columnFreeze': False, 'lineFreeze': False, 'showProgressText': True,
    'progress': {'show': True, 'name': '进度'},
    'target': {'show': True, 'name': '目标'},
}
DEFAULT_ANALYSIS = {
    'showData': 1, 'isRawData': True, 'showMode': 1,
    'isCompare': False, 'izTimeOut': False,
    'showFields': [], 'trendType': '1', 'timeOut': 0,
}

# 构建绑定表单数据的柱形图组件
comp = {
    'component': 'JBar',
    'componentName': '订单统计',
    'visible': True,
    'i': f'{int(time.time()*1000)}_{random.randint(100000,999999)}',
    'x': 0, 'y': 0, 'w': 12, 'h': 35,
    'orderNum': 10,
    'config': json.dumps({
        'dataType': 4,
        'formType': FORM_TYPE,
        'formId': FORM_CODE,
        'formName': '表单名称',
        'tableName': FORM_CODE,
        'type': FORM_TYPE,
        'appId': APP_ID,
        'appType': 'current',
        'nameFields': [{'fieldName': 'order_status', 'fieldTxt': '订单状态', 'fieldType': 'string', 'widgetType': 'select', 'options': {}}],
        'valueFields': [{'fieldName': 'record_count', 'fieldTxt': '记录数量', 'fieldType': 'count', 'widgetType': 'text'}],
        'typeFields': [], 'assistYFields': [], 'assistTypeFields': [], 'calcFields': [],
        'sorts': {'name': '', 'type': ''},    # type 字段必填
        'filter': {'queryField': 'create_time', 'queryRange': 'all', 'conditionMode': 'and', 'conditionFields': [], 'customTime': []},
        'chart': {'category': 'Bar', 'subclass': 'JBar', 'isGroup': False},
        'filterField': [...],   # 必须填入全部表单字段（含fieldShow/options），空数组导致筛选面板无字段
        'turnConfig': {'url': ''}, 'jsConfig': '', 'drillData': [],
        'authFieldShowResult': [], 'timeOut': 0,
        'chartData': '[]',
        'background': '#FFFFFF', 'borderColor': '#E8E8E8',
        'size': {'height': 385},
        'compStyleConfig': DEFAULT_COMP_STYLE_CONFIG,  # 必填！
        'analysis': DEFAULT_ANALYSIS,                   # 必填！
        'option': {
            'card': {'title': '', 'size': 'default', 'headColor': '#FFFFFF',
                     'textStyle': {'color': '#464646', 'fontSize': 16, 'fontWeight': 'bold'}},
            'title': {'show': True, 'text': '订单统计'},
        }
    }, ensure_ascii=False)
}

bi_utils._page_components[PAGE_ID].append(comp)
bi_utils.save_page(PAGE_ID)
print(f'完成！耗时: {time.time()-t0:.1f}s')
```

### QQY 全组件批量生成标准流程

> 触发场景：用户说"给应用仪表盘增加全组件"、"添加所有统计图表"、"展示全部 QQY 图表类型"

#### 必须遵守的生成规则

1. **唯一权威组件列表**：`chartConfig(isLowApp=true)` 的 30 个组件（见「qqyMenuData 可用组件」章节），**禁止添加不在列表中的任何组件**（包括 JSmoothLine/JBackgroundBar/JProgress/JGrowCard/JCommonTable/JList/JFlyLineMap 等）
2. **数据类型**：全部用 `dataType=4` 绑定表单数据，**禁止用 `dataType=1`（静态数据）**——即使静态数据更简单，QQY 前端仍会访问 compStyleConfig/analysis/filter 等 dataType=4 专有字段，缺失会导致 TypeError 白屏
3. **必填三字段**：每个组件 config 必须包含 `compStyleConfig`、`analysis`、`filter`（含 `conditionMode:"and"`），缺任一个前端必报 TypeError

#### 执行步骤

> **🚨 步骤3~4 为强制交互步骤，禁止跳过直接执行脚本。**

```
步骤1：确认前置信息（appId / tenantId / formCode）
步骤2：查询表单名称 → GET /desform/api/list/options?appId={APP_ID}  取 label
步骤3：【强制交互】查询表单字段 → GET /desform/api/fields/{formCode}，以表格形式列出所有字段：
        | 序号 | 字段名 | 显示名 | 控件类型 |
        同时给出推荐字段配置（见下方推荐规则），等待用户确认或修改后再继续
步骤4：【强制交互】用户确认 dim_field / val_field / grp_field 后，再执行后续操作
步骤5：创建仪表盘页面（POST /drag/page/add，body 含 lowAppId）
步骤6：cp gen_qqy_all_comps.py + bi_utils.py，执行脚本（传入用户确认的字段参数）
步骤7：rm 临时文件，输出预览地址
```

**推荐字段规则（步骤3 展示给用户时使用）：**
- **维度字段（dim）**：第一个 string 类型字段（input/select/radio/textarea 等）
- **数值字段（val）**：第一个 number/money 类型字段；无数值字段则用 `record_count`（记录数）
- **分组字段（grp）**：第二个 string 类型字段；无第二个则与维度字段相同

展示格式示例：
```
表单字段列表（ding_dan_biao_gui5 / 订单表）：
| 序号 | 字段名           | 显示名   | 控件类型 |
|------|-----------------|---------|---------|
|  1   | order_name      | 订单名称 | input   |
|  2   | order_no        | 订单编号 | input   |
|  3   | amount          | 金额     | money   |
|  4   | status          | 状态     | select  |

推荐配置：
  维度 = order_name（订单名称）
  数值 = amount（金额）
  分组 = order_no（订单编号）

是否采用以上配置？如需修改请直接指出。
```

#### 设计器表单字段解析代码

```python
resp = bi_utils._request('GET', f'/desform/api/fields/{FORM_CODE}', params={'subTable': True})
result = resp.get('result') or {}
raw_fields = result.get('fields', [])  # ⚠️ result 是 dict，不是 list

# ✅ fieldType 必须小写 string/number（大写 String/Integer 与手工配置不一致，导致字段类型判断异常）
# ✅ 必须保留 widgetType（前端筛选面板据此渲染不同控件，缺失导致筛选面板显示异常）
WIDGET_TYPE_MAP = {
    'input': 'input', 'textarea': 'textarea', 'select': 'select',
    'radio': 'radio', 'checkbox': 'checkbox',
    'number': 'number', 'money': 'money',
    'date': 'date', 'datetime': 'datetime',
}
FIELD_TYPE_MAP = {
    'input': 'string', 'textarea': 'string', 'select': 'string',
    'radio': 'string', 'checkbox': 'string',
    'number': 'number', 'money': 'number',
    'date': 'string', 'datetime': 'string',
}
SKIP_TYPES = {'file-upload', 'upload', 'html', 'divider', 'slot'}

fields = []
for f in raw_fields:
    ft = f.get('type', '')
    if ft in SKIP_TYPES:
        continue
    fields.append({
        'fieldName': f['model'],                     # model = 字段名
        'fieldTxt':  f.get('name', f['model']),      # name  = 显示名
        'fieldType': FIELD_TYPE_MAP.get(ft, 'string'),
        'widgetType': WIDGET_TYPE_MAP.get(ft, ft),
    })

str_fields = [f for f in fields if f['fieldType'] == 'string']
num_fields = [f for f in fields if f['fieldType'] == 'number']

dim_field = str_fields[0] if str_fields else fields[0]
val_field = num_fields[0] if num_fields else {'fieldName': 'record_count', 'fieldTxt': '记录数', 'fieldType': 'number', 'widgetType': 'number'}
grp_field = str_fields[1] if len(str_fields) > 1 else str_fields[0]

def mk(f):
    return {
        'fieldName': f['fieldName'],
        'fieldTxt':  f['fieldTxt'],
        'fieldType': f['fieldType'],
        'widgetType': f.get('widgetType', 'input'),
        'fieldShow': True,
        'options': [],
        'customDateType': '',
    }

# ✅ filterField 必须包含系统字段（人员/日期字段加 customDateType:'3'）
SYSTEM_FIELDS = [
    {'fieldName': 'create_by',   'fieldTxt': '创建人',   'fieldType': 'string', 'widgetType': 'input', 'fieldShow': True, 'options': [], 'customDateType': '3'},
    {'fieldName': 'update_by',   'fieldTxt': '更新人',   'fieldType': 'string', 'widgetType': 'input', 'fieldShow': True, 'options': [], 'customDateType': '3'},
    {'fieldName': 'create_time', 'fieldTxt': '创建时间', 'fieldType': 'string', 'widgetType': 'date',  'fieldShow': True, 'options': [], 'customDateType': '3'},
    {'fieldName': 'update_time', 'fieldTxt': '更新时间', 'fieldType': 'string', 'widgetType': 'date',  'fieldShow': True, 'options': [], 'customDateType': '3'},
    {'fieldName': 'bpm_status',  'fieldTxt': '流程状态', 'fieldType': 'string', 'widgetType': 'input', 'fieldShow': True, 'options': [], 'customDateType': ''},
]
filter_fields = [mk(f) for f in fields] + SYSTEM_FIELDS
```

#### 30 个组件的 chart.category 与 option.series 对照表

| compType | chart.category | isGroup | option 必填 series |
|----------|---------------|---------|-------------------|
| JBar | Bar | F | `[{'type':'bar'}]` + xAxis(category,data=[]) + yAxis(value) |
| JStackBar / JMultipleBar / JNegativeBar | Bar | T | `[{'type':'bar'}]` + xAxis(category,**无data**) + yAxis(value) |
| **JHorizontalBar / JRankingList** | **HorizontalBar** | F | `[{'type':'bar'}]` + yAxis(category,data=[]) + xAxis(value) |
| **JTotalProgress** | **HorizontalBar** | F | 无需 series |
| JLine / JArea | Line | F | `[{'type':'line'}]` + xAxis(category,data=[]) + yAxis(value) |
| JMultipleLine / DoubleLineBar | Line | T | `[{'type':'line'}]` / `[bar,line]` + xAxis(category,**无data**) |
| JWordCloud | WordCloud | F | 无 |
| JPie | Pie | F | **`[{'type':'pie','data':[]}]`**（缺失报 TypeError） |
| JRing | Pie | F | **`[{'type':'pie','data':[],'radius':['40%','70%'],'avoidLabelOverlap':False,'label':{'show':False},'labelLine':{'show':False}}]`** |
| JRose | Pie | F | **`[{'type':'pie','data':[],'roseType':'area'}]`** |
| JFunnel | Funnel | F | **`[{'left':'10%','gap':2,'name':'Funnel','type':'funnel','sort':'descending','data':[]}]`** |
| JPyramidFunnel | Funnel | F | **`[{'left':'10%','gap':2,'name':'Funnel','type':'funnel','sort':'ascending','data':[]}]`** |
| JRadar / JCircleRadar | Radar | T | 无 |
| JColorGauge / JAntvGauge | Gauge | F | 无（使用自身渲染引擎，非 ECharts gauge） |
| **JGauge** | Gauge | F | **`[{'type':'gauge','data':[],'min':0,'max':100,'detail':{'formatter':'{value}'},'axisTick':{'show':True,'lineStyle':{'color':'#eee'}}}]`**（缺失报 Unknown series + max TypeError） |
| JNumber | Number | F | 无（nameFields 必须为 `[]`） |
| **JScatter / JBubble** | Scatter | F/T | `[{'type':'scatter'}]` + xAxis(value) + yAxis(value)；**nameFields 和 valueFields 必须是数值类型字段**（不能用字符串字段） |
| JPivotTable | Table | T | 无（`analysis.isRawData:True`；必须在 config 顶层加 `pivotTable` 配置对象，见下方） |
| JAreaMap / JBubbleMap / JHeatMap / JBarMap | Map | F | 无（config 顶层必须有 commonOption；option 必须含 **geo（旧格式）+ area + visualMap（含seriesIndex）**，见下方） |

> ⚠️ **isGroup=true 图表 option 中禁止含 `xAxis:{data:[]}`**，会阻止前端动态填充分类轴，X 轴永远为空。isGroup 图表只写 `xAxis: {'type': 'category'}` 不加 data，或省略整个 xAxis。

> ⚠️ **地图组件必须在 config 顶层加 commonOption**（不是放在 option 里），缺失导致 `useEChartsMap.ts:1103 Cannot read 'breadcrumb'` 崩溃：
> ```python
> config['commonOption'] = {
>     'barSize': 10, 'gradientColor': False,
>     'breadcrumb': {'drillDown': False, 'textColor': '#000000'},
>     'areaColor': {'color1': '#f7f7f7', 'color2': '#fcc02e'},
>     'barColor': '#fff176', 'barColor2': '#fcc02e',
>     'inRange': {'color': ['#04387b', '#467bc0']},
> }
> # JHeatMap 额外需要 heat 字段（缺失热力图参数无默认值报错）：
> config['commonOption']['heat'] = {'blurSize': 20, 'pointSize': 15, 'maxOpacity': 1}
> ```
>
> ⚠️ **地图 option 必须含 geo，且必须用旧版 ECharts 格式**（`handleMapWarn` 在 `useEChartsMap.ts:1145` 处理 `itemStyle.normal/emphasis` 嵌套格式，使用新版 `itemStyle.areaColor` 直接写法会导致样式失效）：
> ```python
> # ✅ 正确：旧版格式（handleMapWarn 处理此格式）
> option['geo'] = {
>     'top': 30, 'zoom': 1, 'roam': False,
>     'itemStyle': {
>         'normal':   {'areaColor': '#f7f7f7', 'borderColor': '#b0b5c1', 'borderWidth': 0.5,
>                      'shadowOffsetX': 0, 'shadowOffsetY': 0, 'shadowBlur': 0, 'shadowColor': '#80d9f8'},
>         'emphasis': {'areaColor': '#fcc02e', 'borderWidth': 0},
>     },
>     'label': {'emphasis': {'show': True, 'color': '#000'}},
> }
> # ❌ 错误：新版格式（不要用）
> # option['geo'] = {'itemStyle': {'areaColor': '#f7f7f7'}, 'emphasis': {'itemStyle': {'areaColor': '#fcc02e'}}}
> ```
>
> ⚠️ **所有 4 种地图组件 option 都必须含 `area` 字段**（`bubbleMap.vue` / `areaMap.vue` 等读取 `config.option?.area?.markerType` 作为 series[0].type，缺失 → type=undefined → `[ECharts] Unknown series undefined` 崩溃）：
> ```python
> # 所有地图共用同一 area 配置
> option['area'] = {
>     'markerType': 'effectScatter',   # 必填，series[0].type 从此读取
>     'markerColor': '#DDE330', 'shadowColor': '#DDE330', 'shadowBlur': 10,
>     'markerCount': 5, 'markerOpacity': 1,
>     'scatterLabelShow': False,
>     'value': ['china'], 'name': ['中国'],
> }
> ```
>
> ⚠️ **所有 4 种地图 option 都必须含 `visualMap`，且必须指定 `seriesIndex`**（ECharts 要求 heatmap series 必须有 visualMap 明确引用其 seriesIndex，否则报 `Heatmap must use with visualMap`）：
>
> | 地图类型 | seriesIndex | show |
> |---------|------------|------|
> | JAreaMap | `[0]` | False |
> | JBubbleMap | `[1]` | False |
> | JHeatMap | `[1]` | **True** |
> | JBarMap | `[0]` | False |
>
> ```python
> # JAreaMap / JBarMap：seriesIndex=[0]
> option['visualMap'] = {'min': 0, 'max': 200, 'type': 'continuous', 'show': False,
>                        'calculable': True, 'top': 'bottom', 'left': '5%', 'seriesIndex': [0]}
> # JBubbleMap：seriesIndex=[1]（effectScatter 是 series[0]，map series 是 series[1]）
> option['visualMap'] = {'min': 0, 'max': 200, 'type': 'continuous', 'show': False,
>                        'calculable': True, 'top': 'bottom', 'left': '5%', 'seriesIndex': [1]}
> # JHeatMap：seriesIndex=[1]，show=True（热力图必须显示 visualMap 否则报错）
> option['visualMap'] = {'min': 0, 'max': 200, 'type': 'continuous', 'show': True,
>                        'calculable': True, 'top': 'bottom', 'left': '5%', 'seriesIndex': [1]}
> ```
>
> ⚠️ **地图和表格 config 顶层需要 `seriesType` + `assistTypeFields` + `assistYFields`**（缺失导致多系列/辅助轴配置失效）：
> ```python
> config['seriesType'] = [{'series': '1', 'type': 'bar'}, {'series': '2', 'type': 'bar'}, {'series': '', 'type': 'bar'}]
> config['assistTypeFields'] = [{'fieldName': 'create_time', 'fieldTxt': '创建时间',
>                                'options': {}, 'fieldType': 'date', 'widgetType': 'date', 'customDateType': '3'}]
> config['assistYFields'] = [val_field_obj]   # 与 valueFields[0] 相同
> ```

> ⚠️ **地图 valueFields 必须用用户表单的实际数值字段**（不是固定 record_count；record_count 仅是"计数"指标之一，只在用户无数值字段时作为兜底）：
> ```python
> # ✅ 正确：用表单 num_fields 中的实际字段
> 'valueFields': [mk(num_fields[0])]
> # ❌ 错误：固定写 record_count
> # 'valueFields': [{'fieldName': 'record_count', ...}]
> ```
>
> ⚠️ **JPivotTable config 顶层必须含 `pivotTable` 对象**（缺失时透视表始终显示"暂无数据"）：
> ```python
> val_keys = [f['fieldName'] for f in valueFields]
> config['pivotTable'] = {
>     'columnSummary': {
>         'name': '列汇总', 'location': 'right',
>         'controlList': [{'showName': '', 'show': True, 'totalType': 'sum', 'position': '2', 'key': k} for k in val_keys],
>     },
>     'lineSummary': {
>         'name': '行汇总', 'location': 'bottom',
>         'controlList': [{'showName': '', 'show': True, 'totalType': 'sum', 'key': k} for k in val_keys],
>     },
>     'unitList': [{'unit': '', 'numberLevel': '', 'position': 'suffix', 'decimal': 0, 'key': k} for k in val_keys],
>     'showLineCount': 0, 'showColumnCount': 0, 'showColumnTotal': False, 'showLineTotal': False,
> }
> # JPivotTable 的 analysis 必须设 isRawData:True, compareType:''
> config['analysis'] = {**DEFAULT_ANALYSIS, 'isRawData': True, 'compareType': ''}
> ```

#### 重新生成（替换已有组件）

```python
# 正确做法：query_page 后立即清空，再追加 30 个新组件
bi_utils.query_page(PAGE_ID)
bi_utils._page_components[PAGE_ID] = []   # 清空 54 个旧组件 → 替换为 30 个正确组件

for idx, (...) in enumerate(COMPS):
    bi_utils._page_components[PAGE_ID].append(comp_obj)

bi_utils.save_page(PAGE_ID)
```

> **不需要** 逐个 delete 旧组件，直接覆盖保存即可。

### 按钮（JCustomButton）操作类型配置

QQY 仪表盘中自定义按钮通过 `operationType` 绑定业务操作，5 种类型均来自 `ButtonSetModal.vue`。

**证据**：`packages/dragEngine/modal/chartset/ButtonSetModal.vue` 第 388-410 行定义 `operationTypeOption`；第 590-617 行定义按钮完整结构。

#### 添加按钮标准四步工作流（强制，不得跳过任何一步）

> **🚨 严禁在用户未确认配置前创建任何按钮组件。禁止创建空绑定的占位按钮。**

---

**第一步：询问按钮数量和名称**

> 用户说"添加按钮"时，必须先问：

```
请问需要添加几个按钮？每个按钮叫什么名字？
（可参考默认推荐：创建记录 / 打开视图 / 跳转页面 / 打开链接 / 调用业务流程）
```

---

**第二步：询问每个按钮触发的操作类型**

> 列出5种操作类型，让用户为每个按钮逐一选择：

| operationType | 操作 | 需要对接 |
|--------------|------|---------|
| `'1'` | 创建记录 | 选择**工作表（表单）** |
| `'2'` | 打开视图 | 选择**工作表（表单）** → 再选**视图** |
| `'3'` | 打开自定义页面 | 选择**应用内仪表盘页面** |
| `'4'` | 打开链接 | 用户输入**网页地址（URL）** |
| `'6'` | 调用业务流程 | 选择**业务流程** |

---

**第三步：并行查询所有候选资源并展示给用户选择**

> 根据用户选择的操作类型，查询对应的候选列表。**三个接口并行调用，一次性展示。**

```python
# 工作表（operationType 1/2）
forms = bi_utils._request('GET', '/desform/api/list/options', params={'appId': APP_ID})
# 展示: label=表单名称, value=formCode

# 应用内仪表盘页面（operationType 3）——必须按 lowAppId 精确过滤！
pages_resp = bi_utils._request('GET', '/drag/page/list', params={'lowAppId': APP_ID, 'pageNo':1, 'pageSize':100})
pages = [p for p in pages_resp.get('result',{}).get('records',[]) if p.get('lowAppId') == APP_ID]
# 展示: name=页面名称, id=pageId

# 业务流程（operationType 6）——必须用此专用接口，禁止用 /act/process/list
flows = bi_utils._request('GET', '/act/process/extActProcess/listBtProcess',
    params={'processName': '', 'processKey': '', 'lowAppId': APP_ID})
# 展示: processName=流程名称, id=流程ID
```

> **⚠️ 查询接口规范（已踩坑验证）：**
> - 表单：`/desform/api/list/options?appId=APP_ID`（返回应用下设计器表单）
> - 仪表盘页面：`/drag/page/list?lowAppId=APP_ID`，**结果必须二次过滤** `p.get('lowAppId') == APP_ID`（接口返回混入全局页面）
> - 业务流程：`/act/process/extActProcess/listBtProcess?lowAppId=APP_ID`（**专用接口**，`/act/process/list` 返回全局所有流程，禁止使用）

---

**第四步：根据用户选择生成按钮组件**

查到 desformId 后构建 worksheet 对象，然后一次性写入所有按钮：

```python
# 查 desformId（operationType 1/2 必须）
r = bi_utils._request('GET', f'/desform/api/fields/{FORM_CODE}', params={'subTable': True})
desform_id = (r.get('result') or {}).get('id')

# 查视图（operationType 2）
views = bi_utils._request('GET', '/desform/api/list/view', params={'desformCode': FORM_CODE})
# result=None 或 [] → view 填 ''（全部）
```

> **🚨 customPage 必须是对象，不能是字符串 pageId！**
> `'customPage': {'label': '页面名称', 'value': 'pageId', 'key': 'pageId'}`
>
> **🚨 bizFlow 必须是对象，不能是字符串 ID！**
> `'bizFlow': {'label': processName, 'value': id, 'key': id}`

---

**默认按钮样式（强制，除非用户明确指定）：**

```python
'option': {
    'btnType':  'button',   # 按钮样式（非图形）
    'btnStyle': 'solid',    # 方块（非圆形/虚线）
    'btnWidth': 'divide',   # 等分宽度（非自适应）
    'rowNum': len(btn_list),# 🚨 每行按钮数 = 按钮总数，确保一行横向显示
}
```

> **🚨 rowNum 必须 ≥ 按钮总数**，否则按钮换行堆叠为竖排。创建时始终设为按钮数量，不得用固定值 1/4/5。

---

| operationType | 操作 | 必须询问 | customPage/worksheet 类型 |
|--------------|------|---------|--------------------------|
| `'1'` | 创建记录 | 选择**工作表**；可选配置字段默认值 | worksheet=对象，customPage='' |
| `'2'` | 打开视图 | 选择**工作表** → 再选**视图** | worksheet=对象，customPage='' |
| `'3'` | 打开自定义页面 | 选择应用下的**仪表盘页面** → 询问**打开方式**（当前/新页面） | **customPage=对象** `{label,value,key}`，worksheet='' |
| `'4'` | 打开链接 | 用户输入**网页地址** → 询问**打开方式**；可选是否传参 | worksheet=''，customPage='' |
| `'6'` | 调用业务流程 | 立即执行 or **二次确认** → 选择**业务流程**；有传参时配置参数 | worksheet=''，customPage='' |

> 非QQY模式（普通仪表盘）只支持 `'4'` 打开链接。

#### 收集绑定信息的标准流程（强制）

> 用户确认每个按钮的操作类型后，必须先查询候选列表展示给用户选择，再创建按钮。

**worksheet 对象完整结构（operationType 1/2 必须用对象，不能是空字符串）：**
```python
'worksheet': {
    'label': '订单表',                  # 表单显示名
    'value': 'ding_dan_biao_gui5',      # formCode（同 key）
    'key':   'ding_dan_biao_gui5',
    'type':  'form',
    'desformId': '2044729857917284354', # 通过 /desform/api/fields/{code} 取 result.id
},
'desformId': '2044729857917284354',     # 顶层也要填，与 worksheet.desformId 一致
'appInfo': {'type': 'current'},         # 当前应用必填
```

**🚨 chartData 存储规则：**
- 任意一个按钮含 worksheet 对象（operationType 1/2）→ 整个 `chartData` 必须用 `json.dumps(btn_list)`
- 全部按钮无 worksheet 绑定 → `chartData` 可用 Python 列表

> 非QQY模式（普通仪表盘）只支持 `'4'` 打开链接。

#### option 样式结构

```python
'option': {
    'title': '',              # 按钮组标题
    'btnType': 'button',      # 'button'=按钮样式（默认）| 'graphical'=图形样式
    'btnStyle': 'solid',      # 'solid'=方块（默认）| 'circle'=圆形 | 'dashed'=虚线
    'btnWidth': 'divide',     # 'divide'=等分（默认）| 'custom'=自适应
    'btnDirection': 'column', # 'column'=上下 | 'row'=左右（仅btnType=graphical时有效）
    'rowNum': len(btn_list),  # 🚨 默认=按钮总数，确保一行横向显示；禁止写死固定值
}
```

> **🚨 rowNum 必须 = 按钮总数**，否则按钮换行导致竖向堆叠，用户看不全。`btnType='button'` 时 `btnDirection` 无效，横向排列完全由 `rowNum` 控制。**默认样式：方块（solid）+ 等分（divide）+ 一行全部显示（rowNum=按钮数）**。

#### chartData 每个按钮完整结构

> 🚨 字段名是 `chartData`，不是 `btnList`！

```python
# ===== 各 operationType 完整结构对照（以正确前端数据为准）=====

# operationType='1' 创建记录
btn_create = {
    'btnId': 'btn' + str(int(time.time()*1000)),
    'title': '创建记录',
    'icon': 'ant-design:plus-outlined',
    'color': '#2196f3',
    'operationType': '1',
    'worksheet': {                        # 必须是对象
        'label': '订单表', 'value': 'form_code', 'key': 'form_code',
        'type': 'form', 'desformId': 'desform_id_here',
    },
    'view': '', 'defVal': [], 'customPage': '',
    'href': {'url': '', 'isParam': False, 'params': []},
    'openMode': '2', 'bizFlow': '',
    'click': {'type': '1', 'message': {'title': '你确认执行此操作吗？', 'okText': '确认', 'cancelText': '取消'}},
    'appInfo': {'type': 'current'},       # 必须是 {'type': 'current'}，不能是 None
    'desformId': 'desform_id_here',       # 与 worksheet.desformId 一致
}

# operationType='2' 打开视图
btn_view = {
    **btn_create,
    'operationType': '2',
    'worksheet': {'label': '测试表单', 'value': 'form_code', 'key': 'form_code', 'type': 'form', 'desformId': 'desform_id_here'},
    'view': 'view_id_or_empty',           # 无独立视图时填 ''（全部）
}

# operationType='3' 打开自定义页面 🚨 customPage 必须是对象，不是字符串！
btn_page = {
    'btnId': 'btn' + str(int(time.time()*1000)),
    'title': '打开自定义页面',
    'icon': 'ant-design:layout-outlined',
    'color': '#9c27b0',
    'operationType': '3',
    'worksheet': '', 'view': '', 'defVal': [],
    'customPage': {                        # 🚨 对象！不能是 pageId 字符串
        'label': 'AI生成仪表盘',
        'value': '1204574932509007872',
        'key':   '1204574932509007872',
    },
    'href': {'url': '', 'isParam': False, 'params': []},
    'openMode': '2', 'bizFlow': '',
    'click': {'type': '1', 'message': {'title': '你确认执行此操作吗？', 'okText': '确认', 'cancelText': '取消'}},
    'appInfo': {'type': 'current'},       # 必须是 {'type': 'current'}，不能是 None
    # ❌ 不要加 desformId、bizParams（op3 没有这两个字段）
}

# operationType='4' 打开链接
btn_link = {
    'btnId': 'btn' + str(int(time.time()*1000)),
    'title': '打开链接',
    'icon': 'ant-design:link-outlined',
    'color': '#ff9800',
    'operationType': '4',
    'worksheet': '', 'view': '', 'defVal': [], 'customPage': '',
    'href': {'url': 'https://www.baidu.com', 'isParam': False, 'params': []},
    'openMode': '2', 'bizFlow': '',
    'click': {'type': '1', 'message': {'title': '你确认执行此操作吗？', 'okText': '确认', 'cancelText': '取消'}},
    'appInfo': None,
}

# operationType='6' 调用业务流程
# 🚨 Step 1: 先查询业务流程列表
# flows = bi_utils._request('GET', '/act/process/extActProcess/listBtProcess',
#     params={'processName': '', 'processKey': '', 'lowAppId': APP_ID})
# 取 result 列表中用户选择的流程：id → bizFlow.value, processName → bizFlow.label
btn_flow = {
    'btnId': 'btn' + str(int(time.time()*1000)),
    'title': '调用业务流程',
    'icon': 'ant-design:apartment-outlined',
    'color': '#4caf50',
    'operationType': '6',
    'worksheet': '', 'view': '', 'defVal': [], 'customPage': '',
    'href': {'url': '', 'isParam': False, 'params': []},
    'openMode': '2',
    # 🚨 bizFlow 必须是对象，不能是字符串ID！
    'bizFlow': {'label': '流程名称', 'value': '流程ID', 'key': '流程ID'},
    'bizParams': [],                       # 传参配置（仅 op6 有此字段）
    'click': {'type': '1', 'message': {'title': '你确认执行此操作吗？', 'okText': '确认', 'cancelText': '取消'}},
    # 🚨 op6 的 appInfo 必须是 {'type': 'current'}，不能是 None
    'appInfo': {'type': 'current'},
    # ❌ 不要加 desformId（op6 无此字段）
}

# ===== 各字段适用范围速查 =====
# worksheet(对象)   → op1/op2 必填；op3/4/6 填 ''
# desformId(顶层)   → op1/op2 必填；op3/4/6 不要加
# view              → op2 必填；其余填 ''
# customPage(对象)  → op3 必填；其余填 ''  🚨 对象不是字符串！
# href.url          → op4 必填；其余填 ''
# bizFlow(对象)     → op6 必填 {'label':名称,'value':ID,'key':ID}；其余填 ''  🚨 对象不是字符串！
# bizParams(列表)   → 仅 op6 有；其余不要加
# appInfo           → op1/op2/op3/op6 填 {'type':'current'}；仅 op4 填 None

config = {
    'dataType': 1,                   # 🚨 按钮组件固定用 dataType=1，禁止用 4
    'timeOut': 0,
    'chartData': [btn],              # 🚨 简单按钮用列表；含表单/视图绑定时用 json.dumps([btn])
    # 🚨 rowNum 必须 >= 按钮数量；btnType='button' 时 btnDirection 无效，横向由 rowNum 控制
    'option': {'title': '', 'btnType': 'button', 'btnStyle': 'solid', 'btnWidth': 'custom', 'btnDirection': 'column', 'rowNum': len(btn_list)},
    'compStyleConfig': {},           # QQY必须包含
    'analysis': {},                  # QQY必须包含
    'background': '#FFFFFF', 'borderColor': '#E8E8E8',
    'size': {'width': w*75, 'height': h*11},
}
```

#### defVal（创建记录默认值）不支持的字段类型

以下字段类型**不能**设置默认值：`dates` / `daterange` / `datetimerange` / `sub-table-design` / `link-field` / `color` / `auto-number` / `barcode` / `imgupload` / `fileupload` / `file-upload` / `editor` / `capital-money` / `text-compose` / `formula` / `phone` / `email` / `markdown` / `location` / `summary`

#### 其他限制

- 至少保留 1 个按钮（删除时需检查 `chartData.length > 1`）
- 调用业务流程二次确认弹窗可自定义提示文字/确认文字/取消文字

**通过 comp_ops.py 设置按钮 config：**
```bash
# 先查询按钮组件的 i 值
py comp_ops.py list $API_BASE $TOKEN $PAGE_ID

# 用 edit 命令写入按钮配置（chartData 是 JSON 字符串）
py comp_ops.py edit $API_BASE $TOKEN $PAGE_ID --name "自定义按钮" \
  --set 'chartData=[{"btnId":"btn_001","title":"新增","icon":"ant-design:plus-outlined","color":"#2196f3","operationType":"1","worksheet":"","view":"","defVal":[],"customPage":"","href":{"url":"","isParam":false,"params":[]},"openMode":"2","bizFlow":"","bizParams":[],"click":{"type":"1","message":{"title":"你确认执行此操作吗？","okText":"确认","cancelText":"取消"}}}]'
```

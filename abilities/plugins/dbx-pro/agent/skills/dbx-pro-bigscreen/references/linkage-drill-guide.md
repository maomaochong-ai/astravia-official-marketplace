# 组件联动与钻取

## 组件联动（linkageConfig）

组件联动实现"点击 A 组件 → 刷新 B 组件"的交互效果。

### 联动配置结构

**只需配置源组件**，目标组件不需要额外联动配置，只需有对应的 `paramOption` 参数即可接收。

```python
cfg['linkType'] = 'comp'           # 必须设为 'comp'
cfg['linkageConfig'] = [
    {
        'linkageId': '目标组件的i值',
        # ⚠️ linkage 与 linkageField 是同一组数据的两份视图，必须双写：
        #   linkage      → UI 设计器「映射字段→接受参数」表格读这个；缺失则面板表格空
        #   linkageField → 运行时执行联动数据流读这个；缺失则点击不刷新
        'linkage': [
            {'source': 'name', 'target': 'region'}    # source=点击取的字段, target=参数名
        ],
        'linkageField': [
            {'filed': 'name', 'mapping': 'region'}    # filed=source 同义, mapping=target 同义
        ],
    }
]
```

> **🚨 双写铁律（实测 2026-05-07）**：`linkage_ops.py add-linkage` 已自动双写；`multi_chart_linkage.py` 与自定义脚本只写 `linkageField` → 数据库持久化成功，运行时联动也工作，但**进入设计器打开「联动配置」面板，映射字段表格是空的**（用户截图反馈：源饼图联动配置面板只显示"联动组件"下拉，下方表格区无行）。补救：query_page → 给每个 linkageConfig entry 加一份对称的 `linkage:[{source:filed.value, target:mapping.value}]` → save_page，幂等。

### ⚠️ UI 可见性前置：源组件必须有 `fieldOption`

联动 `linkageConfig` 写入数据库成功 ≠ 界面能看到配置。**UI 联动配置面板依赖源组件 `cfg.fieldOption` 填充「源字段」下拉**。缺失/为空时：

- 数据已持久化（`linkage_ops.py show` 能打出）
- 但界面上**打开联动配置弹窗字段选择器空白**，外观等同"联动未配置" —— 最容易误判为保存失败

**典型踩坑场景**：用 `spec_builder.py` 一键生成组件后直接配联动。spec_builder 写了 `dataMapping` 但没写 `fieldOption`，联动 UI 就"看不见"。

**修复**（已被 `linkage_ops.py add-linkage / add-drill` 自动处理，手写脚本需自行补）：

```python
# fieldOption 格式：[{show:'Y', label, text, value}]
# value 取自组件数据来源的字段名，按类型优先级反推：
#   A   cfg.dataMapping[*].mapping           ← 绝大多数图表
#   B.1 cfg.option.fieldMap values           ← JStatsSummary
#   B.7 cfg.option.header[*].key             ← JScrollBoard
#   B.4/B.5/B.6 option.*FieldMapping[*].key  ← JCardScroll / JScrollList / JListProgress
#   B.2 option.titleMapping/valueMapping     ← JSemiGauge
#   B.3 option.field.dateField/valueField    ← JPermanentCalendar
cfg['fieldOption'] = [
    {'show':'Y','label':'name','text':'name','value':'name'},
    {'show':'Y','label':'value','text':'value','value':'value'},
]
```

复用脚本反推工具（推荐）：
```python
from linkage_ops import ensure_field_option
ensure_field_option(cfg, comp_label='源组件')   # 幂等：已有 fieldOption 不覆盖
```

### source 可用字段

| source 值 | 含义 | 示例 |
|-----------|------|------|
| `name` | 类目/标签名（维度） | 饼图扇区名、柱子 x 轴标签 |
| `value` | 数值 | 饼图扇区值、柱子高度 |
| `type` | 多系列图表的系列名 | "系列A"、"手机品牌" |

> `source` 取值 **必须在源组件的 `fieldOption.value` 列表内**，否则 UI 下拉选不到、配置看不见。

### 目标组件要求

1. `paramOption` 中有对应参数定义（`value` 字段与 `target` 匹配）
2. SQL 数据集中有对应 FreeMarker 动态条件：`<#if isNotEmpty(paramName)> and field = '${paramName}' </#if>`

### 完整示例：饼图联动柱形图

```python
PIE_ID = 'pie_component_i'
BAR_ID = 'bar_component_i'

page = query_page(PAGE_ID)
template = page.get('template', [])
if isinstance(template, str):
    template = json.loads(template)

for comp in template:
    cfg = comp.get('config', {})
    if isinstance(cfg, str):
        cfg = json.loads(cfg)
    if comp['i'] == PIE_ID:
        cfg['linkType'] = 'comp'
        cfg['linkageConfig'] = [
            {
                'linkageId': BAR_ID,
                'linkage': [{'source': 'name', 'target': 'name'}]
            }
        ]
    comp['config'] = cfg

bi_utils._page_components[PAGE_ID] = template
save_page(PAGE_ID)
```

### 多目标联动

```python
cfg['linkageConfig'] = [
    {'linkageId': BAR_ID, 'linkage': [{'source': 'name', 'target': 'name'}]},
    {'linkageId': TABLE_ID, 'linkage': [{'source': 'name', 'target': 'keyword'}]},
]
```

### 运行时流程

```
用户点击饼图 "张三" 扇区
→ bindClick() 获取 params: {name: '张三', value: 1000}
→ 遍历 linkageConfig，构建 linkageParams
→ refreshComp(linkageParams) → 找到柱形图实例
→ barInstance.queryData(null, {name: '张三'})
→ SQL 拼接: ... and name like '%张三%'
→ 柱形图刷新
```

---

## 目标数据集三种数据源下如何接收参数

点击源组件后，`target` 会被当作 query 参数塞给目标组件的数据集。**目标数据集必须声明对应参数**并让数据源按参数返回不同数据，否则刷新的仍是老数据。

| 数据源 | 参数传递载体 | 数据分支手段 |
|--------|-------------|-------------|
| SQL | `datasetParamList` + FreeMarker `${paramName}` / `<#if isNotEmpty(x)>` | SQL 里条件判断 |
| **API（YApi mock）** | `datasetParamList` + URL 末尾 `?paramName=${paramName}` | **YApi 高级 Mock 脚本**按 `params.xxx` 分支 |
| 自写 Java API | `datasetParamList` + URL 末尾占位符 | Controller 内按 `@RequestParam` 分支 |

### API 数据集联动（YApi Mock advmock 实战，6 步）

**场景**：点击 JBar 的品牌柱 → JScrollBoard 城市销量按品牌过滤。

**Step 1 — 创建带参 mock + 启用高级脚本（一条命令搞定）**
```bash
py yapi_ops.py create-mock https://api.jeecg.com EMAIL PWD \
  --title "城市销量-按品牌过滤" \
  --path "/city_sales_by_brand" \
  --body '[{"name":"深圳","value":100}]' \
  --advmock-file /tmp/city_adv.js
```
`/tmp/city_adv.js`：
```js
if (params.brand === '比亚迪') {
    mockJson = {"data":[{"name":"深圳","value":380},{"name":"上海","value":320}]}
} else if (params.brand === '特斯拉') {
    mockJson = {"data":[{"name":"上海","value":280},{"name":"北京","value":240}]}
} else {
    mockJson = {"data":[{"name":"深圳","value":150},{"name":"上海","value":140}]}  // 兜底
}
```
规则：用 `params.xxx` 读参；用 `mockJson = {...}` 赋值（**不是 return**）；**必须写兜底 else** 保证无参数时仍有数据。

**Step 2 — 创建 API 数据集并声明参数**
```bash
py dataset_ops.py create-api <API> <TOKEN> \
  --name "城市销量-联动" --code "city_sales_link" \
  --url "https://api.jeecg.com/mock/57/claude/city_sales_by_brand?brand=\${brand}" \
  --fields "name:String,value:Integer" \
  --params "brand:品牌"
```
⚠️ `--url` 末尾**必须带 `${brand}` 占位符**（不带则联动参数传不到 YApi）。脚本会自动提示补全格式。多参数用 `&` 连接：`?brand=${brand}&province=${province}`。

**Step 3 — 绑定目标组件**
```bash
py dataset_ops.py bind <API> <TOKEN> \
  --page <PAGE_ID> --comp-name "城市销量排行榜" \
  --dataset-id <上一步返回的ID> --dataset-name "城市销量-联动" --dataset-type api
```

**Step 4 — 源组件同样创建带参数据集**（例如品牌销量 JBar），字段至少要有 `name`（即点击时透传的值）。

**Step 5 — 配置联动**
```bash
py linkage_ops.py add-linkage <API> <TOKEN> <PAGE_ID> \
  --source "品牌销量 TOP 8" --target "城市销量排行榜" \
  --mapping "name=brand"
```

**Step 6 — 完成**。打开大屏点品牌柱 → 目标组件 URL 变为 `?brand=比亚迪` → advmock 脚本命中分支 → 返回该品牌的城市数据。

### 只给已有接口补挂高级脚本
```bash
py yapi_ops.py set-advmock https://api.jeecg.com EMAIL PWD \
  --iface-id 6011 --script-file /tmp/adv.js
```

### 钻取（drillData）同样适用
钻取参数也走同一套机制——目标组件 = 自身，数据集声明 `paramName`，URL 带占位符，advmock 脚本按参数分支。单参数多级下钻时用编码值方案（禁用多条 drillData）。

### 高级 Mock 脚本常见踩坑

| 症状 | 原因 |
|------|------|
| 点击源组件后目标组件数据不变 | URL 没带 `${paramName}` 占位符 → 参数被前端丢弃 |
| mock 接口返回 500 / 空 | 脚本漏写兜底 else，params 为空时 `mockJson` 未赋值 |
| 字段对不上 | mockJson 里的字段名与图表 dataMapping.mapping / fieldMap 不一致 |
| 写了 `script` 字段 /api/interface/up 不生效 | 必须用 `/api/plugin/advmock/save`（本脚本已内置） |
| Chinese 参数值没匹配分支 | advmock 脚本里的中文字面量要和传参一致（大小写、繁简） |

---

## 组件钻取（drillData）

钻取实现"点击组件自身 → 用点击值作为参数重新查询自身"的下钻效果。与联动不同，钻取是**组件对自身的递归查询**，支持多级下钻和回退。

### 钻取配置结构

```python
cfg['drillData'] = [
    {
        'source': 'value',    # 点击时获取的字段
        'target': 'sex'       # 传给自身的参数名
    }
]
```

### 完整示例：柱形图下钻

```python
BAR_ID = 'bar_component_i'

page = query_page(PAGE_ID)
template = page.get('template', [])
if isinstance(template, str):
    template = json.loads(template)

for comp in template:
    if comp['i'] == BAR_ID:
        cfg = comp.get('config', {})
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        cfg['drillData'] = [
            {'source': 'value', 'target': 'sex'}
        ]
        comp['config'] = cfg
        break

bi_utils._page_components[PAGE_ID] = template
save_page(PAGE_ID)
```

## 联动与钻取的区别

| 特性 | 联动（linkageConfig） | 钻取（drillData） |
|------|----------------------|-------------------|
| 作用对象 | 刷新**其他**组件 | 刷新**自身** |
| 配置位置 | 源组件 config | 自身 config |
| queryMode | `'link'` | `'drill'` |
| 支持回退 | 不支持 | 支持 |
| 可同时使用 | 是 | 是 |

### 联动 + 钻取同时配置

```python
cfg['linkType'] = 'comp'
cfg['linkageConfig'] = [{'linkageId': OTHER_ID, 'linkage': [...]}]
cfg['drillData'] = [{'source': 'name', 'target': 'category'}]
# 点击时：先执行联动刷新其他组件，再执行钻取刷新自身
```

### 关键源码位置

| 文件 | 职责 |
|------|------|
| `packages/hooks/charts/useEChartsNew.ts` (551-728) | ECharts 点击事件绑定 |
| `packages/hooks/common/useLinkage.ts` (218-288) | `refreshComp()` 执行联动/钻取刷新 |
| `packages/dragEngine/modal/LinkConfig.vue` | 联动配置 UI 弹窗 |
| `packages/dragEngine/modal/chartset/components/LowDrillConfig.vue` | 钻取配置 UI |

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
        'linkage': [
            {
                'source': 'name',      # 点击时获取的字段
                'target': 'name'       # 传给目标组件的参数名
            }
        ]
    }
]
```

### 🚨 fieldOption 格式要求（联动设置 UI 正常显示的关键）

源组件的 `config.fieldOption` 必须使用前端 `DataSource.vue` 存储的格式，否则"联动配置"弹窗中"映射字段"下拉框会显示为空（但实际联动功能仍可运行）。

**正确格式（`value` = 字段名）：**
```python
cfg['fieldOption'] = [
    {'value': 'name',  'label': '性别', 'text': '性别', 'show': 'Y', 'type': 'String'},
    {'value': 'value', 'label': '人数', 'text': '人数', 'show': 'Y', 'type': 'Integer'},
]
```

**错误格式（用 `fieldName` 而非 `value`）：**
```python
# ❌ 不能用此格式，联动设置 UI 的"映射字段"列会显示为空
cfg['fieldOption'] = [
    {'fieldName': 'name', 'fieldTxt': '性别', 'fieldType': 'String'},
]
```

**原因**（源码 `LinkConfig.vue` 第 322 行）：
```javascript
// 前端按 field.value == item.mapping 过滤 fieldOption
option = formState.fieldOption.filter((field) => field.value == item.mapping)[0];
// 若 fieldOption 没有 value 字段，filter 返回 undefined → 下拉显示空
```

**字段映射规则**：
```python
# DataSource.vue 第 288-290 行存储格式（从数据集字段列表转换）
{'value': fieldName, 'label': fieldTxt, 'text': fieldTxt, 'show': izShow, 'type': fieldType}
```

### source 可用字段

| source 值 | 含义 | 示例 |
|-----------|------|------|
| `name` | 类目/标签名（维度） | 饼图扇区名、柱子 x 轴标签 |
| `value` | 数值 | 饼图扇区值、柱子高度 |
| `type` | 多系列图表的系列名 | "系列A"、"手机品牌" |

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

### 完整端到端工作流：SQL 数据集 + 组件联动（2026-04-24 实操验证）

> **场景**：创建两个 SQL 数据集图表，源图表点击时通过 FreeMarker 参数驱动目标图表筛选。

#### 第一步：创建源数据集（无 FreeMarker）

```bash
SKILL_REFS="$HOME/.claude/skills/jimubi-dashboard/references"
PYTHONIOENCODING=utf-8 PYTHONPATH="$SKILL_REFS:$SKILL_REFS/scripts" py "$SKILL_REFS/scripts/dataset_ops.py" create-sql $API_BASE $TOKEN \
  --name "源数据集名称" --db-source "数据源ID" \
  --sql "SELECT sex as name, COUNT(*) as value FROM sys_user GROUP BY sex ORDER BY sex" \
  --fields "name:String,value:Integer"
```

#### 第二步：创建目标数据集（含 FreeMarker 参数）

> FreeMarker SQL 含 `<#if>` 语法，**必须通过 Write 工具写脚本执行，禁止 bash 命令行传递**。

```python
# 目标 SQL：含 FreeMarker 动态参数，接收源图表传来的 name 值
SQL2 = (
    "SELECT status as name, COUNT(*) as value "
    "FROM sys_user "
    "<#if isNotEmpty(name)>"       # 参数名与 linkage[].target 保持一致
    "WHERE sex = '${name}' "
    "</#if>"
    "GROUP BY status ORDER BY status"
)
# datasetParamList 必须声明参数，target 组件的 paramOption 也需同名参数
ds2_resp = bi_utils._request('POST', '/drag/onlDragDatasetHead/add', data={
    'name': '目标数据集名称', 'code': f'target_ds_{int(time.time())}',
    'dataType': 'sql', 'dbSource': DB_SOURCE, 'querySql': SQL2, 'apiMethod': 'GET',
    'parentId': parent_id,
    'datasetItemList': [
        {'fieldName': 'name', 'fieldTxt': '状态', 'fieldType': 'String', 'izShow': 'Y', 'orderNum': 0},
        {'fieldName': 'value','fieldTxt': '人数', 'fieldType': 'Integer','izShow': 'Y', 'orderNum': 1},
    ],
    'datasetParamList': [
        {'paramName': 'name', 'paramTxt': '性别值', 'defaultVal': '', 'dictCode': ''}
    ]
})
# FreeMarker SQL 还需 queryFieldBySql（需签名）+ edit 回写字段，参见 skill.md 全流程脚本
```

#### 第三步：添加两个图表（fieldOption 必须用正确格式）

```python
# 🚨 关键：fieldOption 用 {value, label, text, show, type} 格式，不是 {fieldName, fieldTxt}
FIELD_SRC = [
    {'value': 'name',  'label': '性别', 'text': '性别', 'show': 'Y', 'type': 'String'},
    {'value': 'value', 'label': '人数', 'text': '人数', 'show': 'Y', 'type': 'Integer'},
]
FIELD_TGT = [
    {'value': 'name',  'label': '状态', 'text': '状态', 'show': 'Y', 'type': 'String'},
    {'value': 'value', 'label': '人数', 'text': '人数', 'show': 'Y', 'type': 'Integer'},
]

# 源图表 config 核心字段
cfg_src.update({
    'dataType': 2, 'dataSetId': DS1_ID,
    'dataMapping': [{'filed': '维度', 'mapping': 'name'}, {'filed': '数值', 'mapping': 'value'}],
    'fieldOption': FIELD_SRC,        # ← 正确格式
    'paramOption': [],               # 源图表无参数
    'chartData': '[]',
})

# 目标图表 config 核心字段
cfg_tgt.update({
    'dataType': 2, 'dataSetId': DS2_ID,
    'dataMapping': [{'filed': '维度', 'mapping': 'name'}, {'filed': '数值', 'mapping': 'value'}],
    'fieldOption': FIELD_TGT,        # ← 正确格式
    'paramOption': [{'paramName': 'name', 'paramTxt': '性别值', 'defaultVal': '', 'dictCode': ''}],
    'chartData': '[]',
})

# batch-add 一次保存
PYTHONIOENCODING=utf-8 PYTHONPATH="$SKILL_REFS:$SKILL_REFS/scripts" py "$COMP_OPS" batch-add \
  $API_BASE $TOKEN $PAGE_ID --specs '[
    {"comp":"JBar","title":"源图表名","x":0,"y":Y,"w":12,"h":32,
     "config":{...cfg_src...}},
    {"comp":"JPie","title":"目标图表名","x":12,"y":Y,"w":12,"h":32,
     "config":{...cfg_tgt...}}
  ]'
```

#### 第四步：添加联动

```bash
PYTHONIOENCODING=utf-8 PYTHONPATH="$SKILL_REFS:$SKILL_REFS/scripts" py "$SKILL_REFS/scripts/linkage_ops.py" \
  add-linkage $API_BASE $TOKEN $PAGE_ID \
  --source "源图表名" --target "目标图表名" \
  --mapping "name=name"
# 映射格式：source字段=target参数名（对应 FreeMarker 中的 ${name}）
```

#### 效果验证

```bash
# 查看联动配置是否正确
PYTHONIOENCODING=utf-8 PYTHONPATH="$SKILL_REFS:$SKILL_REFS/scripts" py "$SKILL_REFS/scripts/linkage_ops.py" \
  show $API_BASE $TOKEN $PAGE_ID
# 期望输出:
# 组件: 源图表名 (JBar)
#   联动目标: 目标图表名 (i=xxx)
#     字段映射: name -> name
```

#### 常见问题

| 现象 | 原因 | 解决 |
|------|------|------|
| 联动设置弹窗"映射字段"列为空 | `config.fieldOption` 用了 `{fieldName}` 格式 | 改为 `{value: fieldName, label: fieldTxt, text: fieldTxt, show: 'Y', type: fieldType}` |
| 点击后目标图表不刷新 | 目标数据集 SQL 没有 FreeMarker 参数，或 `paramOption` 未声明参数 | 确保 SQL 含 `<#if isNotEmpty(name)>WHERE f='${name}'</#if>`，且 `paramOption` 有对应 paramName |
| 目标 FreeMarker 数据集查询失败 | `queryFieldBySql` 需要签名 | 使用 `signed_post('/drag/onlDragDatasetHead/queryFieldBySql', {...})` |
| `GROUP BY name`（别名）报 bad SQL grammar | MySQL 在某些模式下不支持别名分组 | 改用实际表达式：`GROUP BY DATE_FORMAT(create_time, '%Y')` |

---

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

# 查询控件参考

积木报表查询控件类型、默认值、时间控件、下拉树、范围查询、报表参数的完整配置参考。

---

## 1. 查询控件类型

支持8种查询控件类型：

| 控件类型 | 说明 | 约束条件 |
|---------|------|---------|
| 输入框 | 查询模式为空或选择输入框时，默认类型 | 无 |
| 下拉单选（带搜索） | 从列表中选一个选项 | **必须配置数据字典** |
| 下拉多选（带搜索） | 多选过滤 | **必须配置数据字典** |
| 范围查询 | 起止值查询 | **仅日期和数值类型**；报表参数不支持 |
| 模糊查询 | 文本模式匹配 | **仅字符串类型**；报表参数不支持 |
| 自定义下拉 | JS增强配置，HTTP请求动态加载 | 无 |
| 下拉树 | 树形层级选择（v1.3.79+） | 仅支持API配置；不支持默认值 |
| 时间控件 | 日期/时间/年/月等多种格式 | 无 |

### 报表参数 vs 报表字段查询

| 能力 | 报表参数 | 报表字段查询 |
|------|---------|------------|
| 输入框 | ✅ | ✅ |
| 下拉单选/多选 | ✅ | ✅ |
| 范围查询 | ❌ | ✅ |
| 模糊查询 | ❌ | ✅ |
| 自定义下拉 | ✅ | ✅ |
| 下拉树 | ✅ | ✅ |
| 时间控件 | ✅ | ✅ |

### searchMode 值映射（源码确认）

**报表字段明细（fieldList）：**

| searchMode | 查询模式 | 约束 |
|-----------|---------|------|
| 1 | 输入框 | 无 |
| 2 | 范围查询 | **仅数值(Number)或日期(date)类型** |
| 3 | 下拉多选 | **须配置 dictCode** |
| 4 | 下拉单选 | **须配置 dictCode** |
| 5 | 模糊查询 | **仅字符串(String)类型** |
| 6 | 下拉树 | 须在 dictCode 栏设置接口地址，如 `{'loadTree':'http://...'}` |
| 7 | 自定义下拉框 | 需配合 JS 增强，通常涉及多字段联动 |

**报表参数（paramList）：**

| searchMode | 查询模式 | 约束 |
|-----------|---------|------|
| 1 | 输入框 | 无（日期/数值类型也用此值） |
| 3 | 下拉多选 | 须配置 dictCode |
| 4 | 下拉单选 | 须配置 dictCode |
| 6 | 下拉树 | 须在 dictCode 栏设置接口地址 |
| 7 | 自定义下拉框 | 需配合 JS 增强 |

> **注意：** 报表参数不支持范围查询(2)、模糊查询(5)、时间控件(8)。

### 查询模式选择规则

**报表参数（paramList）：**
- 日期类型、数值类型 → searchMode=1（输入框），通过 widgetType="date"/searchFormat 或 widgetType="number" 区分类型
- 字典字段 → searchMode=4（下拉单选）或 3（下拉多选），必须配置 dictCode
- 普通字符串 → searchMode=1（输入框）

**报表字段查询（fieldList searchFlag）：**
- 日期类型(date)、数值类型(Number) → searchMode=1（输入框）或 **2（范围查询）**
- 字符串类型(String) → searchMode=1（输入框）或 5（模糊查询）
- 字典字段 → searchMode=**4**（下拉单选）或 3（下拉多选），**必须配置 dictCode**
- 下拉树 → searchMode=6，dictCode 栏填接口地址
- 自定义下拉框 → searchMode=7，需配合 JS 增强和多字段联动

---

## 2. 下拉选项配置（数据字典）

下拉单选和下拉多选必须配置数据字典，3种方式：

| 方式 | 格式 | 示例 |
|------|------|------|
| 系统字典编码 | 字典code | `sex` |
| SQL字典 | `SELECT ... AS value, ... AS text FROM 表名` | `SELECT username AS value, username AS text FROM sys_user` |
| API接口 | 返回含 text/value 的JSON | 自定义接口 |

> **SQL字典必须包含 `FROM 表名`**，纯 `SELECT 'a' AS value UNION SELECT 'b' AS value` 写法（无 FROM）系统无法识别，字典不会生效。
> 如需枚举固定值，可借助已有小表，如：
> ```sql
> SELECT dict_code AS value, dict_item_text AS text FROM sys_dict_item WHERE dict_id = 'xxx'
> ```

### SQL字典 sub-query 写法（推荐，通过 dict_code 查询，不硬编码 dict_id）

```sql
SELECT item_text AS value, item_text AS text
FROM sys_dict_item
WHERE dict_id = (SELECT id FROM sys_dict WHERE dict_code = 'supply_season')
ORDER BY sort_order ASC
```

> **为什么用 sub-query 而不是直接写 dict_id？**
> `dict_id` 是自动生成的 ID，在不同环境（开发/测试/生产）数据库中不同。
> 通过 `dict_code` 查询可以跨环境使用，不需要修改代码。

### 通过 API 创建字典和字典项（Python 脚本模板）

用于在 Python 脚本中自动创建字典，创建前先检查是否已存在（防重）：

```python
# Step 1: 检查字典是否已存在
check = api_request('/sys/dict/list?pageNo=1&pageSize=10&dictCode=supply_season')
existing = check.get('result', {}).get('records', [])

if existing:
    dict_id = existing[0]['id']
else:
    # Step 2: 创建字典
    r = api_request('/sys/dict/add', {
        "dictCode": "supply_season",
        "dictName": "供能季",
        "description": "供能季选项",
        "type": 0
    })
    # 重新查询获取 id
    check2 = api_request('/sys/dict/list?pageNo=1&pageSize=10&dictCode=supply_season')
    dict_id = check2['result']['records'][0]['id']

# Step 3: 查询已有字典项（防重）
items_check = api_request(f'/sys/dictItem/list?pageNo=1&pageSize=50&dictId={dict_id}')
existing_texts = {item['itemText'] for item in items_check['result']['records']}

# Step 4: 逐条添加字典项
items = [("2022-2023供热季", 1), ("2022供冷季", 2), ...]
for text, sort in items:
    if text in existing_texts:
        continue
    api_request('/sys/dictItem/add', {
        "dictId": dict_id,
        "itemText": text,
        "itemValue": text,   # value 与 text 相同（也可以设为编码）
        "sortOrder": sort,
        "status": 1
    })
```

> **关键接口：**
> - 查询字典：`GET /sys/dict/list?dictCode=xxx`
> - 创建字典：`POST /sys/dict/add`
> - 查询字典项：`GET /sys/dictItem/list?dictId=xxx`
> - 创建字典项：`POST /sys/dictItem/add`

---

## 3. 查询控件默认值

### 3.0 默认值存储字段（重要！fieldList 与 paramList 不同）

> **易错点：** 两处的默认值字段名不同，混用会导致默认值无法保存。

| 位置 | 默认值字段名 | 说明 |
|------|------------|------|
| **报表字段明细（fieldList）** | `searchValue` | UI "查询默认值"列对应此字段 |
| **报表参数（paramList）** | `paramValue` | UI "参数默认值"列对应此字段 |

```python
# fieldList 字段条目
{
    "fieldName": "create_date",
    "widgetType": "date",
    "searchFlag": 1,
    "searchMode": 2,
    "searchValue": "2021-11-01|2021-11-30",   # ← fieldList 用 searchValue
    "searchFormat": "yyyy-MM-dd"
}

# paramList 参数条目
{
    "paramName": "query_date",
    "widgetType": "date",
    "searchFlag": 1,
    "searchMode": 1,
    "paramValue": "=dateStr('yyyy-MM-dd')",    # ← paramList 用 paramValue
    "searchFormat": "yyyy-MM-dd"
}
```

> `loadDbData` 返回的 fieldList 中每条记录包含 `searchValue` 字段（为 null 表示未配置默认值），可用于验证是否保存成功。

---

4种配置方式（适用于 `searchValue` 和 `paramValue`）：

### 3.1 静态默认值
直接输入字符串作为固定默认值。

### 3.2 动态表达式
使用 `dateStr()` / `date2Str()` 等函数动态计算。

### 3.3 上下文系统变量

| 变量 | 说明 |
|------|------|
| `#{sysUserCode}` | 登录用户名 |
| `#{sysDate}` | 系统日期 |
| `#{sysDateTime}` | 系统日期时间 |

支持自定义系统变量。

### 3.4 范围查询默认值
用竖线 `|` 分隔起止值，详见第6节。

### 3.5 下拉多选默认值
多个默认值用英文逗号 `,` 分隔（不是 `|`）。例如：`A,B,C`。

---

## 4. 时间控件

### 支持的格式

| 格式 | 说明 |
|------|------|
| `yyyy-MM-dd` | 日期 |
| `yyyy-MM-dd HH:mm:ss` | 日期+时间 |
| `yyyy` | 年 |
| `yyyy-MM` | 年-月 |
| `MM` | 月 |
| `HH:mm:ss` / `HH:mm` | 时间 |

### 注意事项
- 时间选择后以**字符串**传递给后端
- 数据库时间字段需做格式转换匹配查询：
  - MySQL: `DATE_FORMAT(birthday, '%Y')`
  - Oracle: `to_char()`
  - SQL Server: `year()`

---

## 5. 时间控件默认值函数

### dateStr(date, format, offset)
返回格式化时间字符串。参数均可选：
- **date**: 时间字符串 `年-月-日 时:分:秒`
- **format**: 格式化模式，默认 `yyyy-MM-dd HH:mm:ss`
- **offset**: 数值偏移量，支持负数（往前）

| 示例 | 结果 |
|------|------|
| `=dateStr()` | 当前时间 |
| `=dateStr('yyyy-MM-dd')` | 当前日期 |
| `=dateStr('yyyy-MM-dd',-10)` | 10天前 |
| `=dateStr('2020-08-15 12:00:01', 'yyyy-MM-dd', 1)` | 指定时间+1天 |

### date2Str(date, format, offset)（v1.7.5+）
与 dateStr() 相同但**不去除前导零**（`01` 不会变成 `1`）。

---

## 6. 范围查询默认值

用竖线 `|` 分隔起止值。

### 数值范围
`16|22`

### 日期范围 - 静态值
`2021-11-01|2021-11-30`

### 日期范围 - 动态表达式

| 场景 | 表达式 |
|------|--------|
| 当月1号至今日 | `=concat(string.substring(dateStr('yyyy-MM-dd'),0, 8), '01')\|=dateStr('yyyy-MM-dd')` |
| N天前至当前（如10天前） | `=concat(dateStr('yyyy-MM-dd',-10),' 00:00:00')\|=dateStr('yyyy-MM-dd HH:mm:ss')` |
| 近3个月 | `=concat(dateStr('yyyy',-1),'-', dateStr('MM', -3),'-',dateStr('dd'))\|=dateStr('yyyy-MM-dd')` |

当月第一天和最后一天等复杂需求，使用 **JS增强** 动态赋值。

---

## 7. extJson 参数配置（源码确认）

每个字段/参数都可以通过 `extJson` 字段配置额外参数，对应 UI 上的"参数配置"弹窗（齿轮图标）。

### extJson 结构

```json
{
    "order": "asc",                    // 排序：asc/desc（仅报表字段明细）
    "required": true,                  // 必填：true/false
    "dictSplit": ",",                  // 字典分隔符（英文字符）
    "selectSearchPageSize": 10,        // 下拉查询每次显示条数（默认10）
    "loadTree": "http://xxx/tree",     // 加载树结构请求地址（下拉树必填）
    "loadTreeByValue": "http://xxx/treeByValue",  // 根据值获取树信息的请求地址（穿透功能）
    "treeMultiple": true               // 下拉树是否多选：true/false（默认true）
}
```

### 各配置项说明

| 字段 | 说明 | 适用场景 |
|------|------|---------|
| `order` | 排序方式 `asc`/`desc` | **仅报表字段明细**（tableType=0），报表参数不支持排序 |
| `required` | 是否必填 `true`/`false` | 所有查询控件 |
| `dictSplit` | 字典分隔符（英文字符如 `,`） | 数据库字段存多个值用分隔符的场景 |
| `selectSearchPageSize` | 下拉每次加载条数，默认10 | 下拉单选(4)/多选(3)时自动设为10 |
| `loadTree` | 加载树结构的请求地址 | **下拉树(searchMode=6)必须配置** |
| `loadTreeByValue` | 根据值获取树节点的请求地址 | 下拉树穿透功能(v1.5.0+) |
| `treeMultiple` | 下拉树是否多选 `true`/`false` | 下拉树(searchMode=6) |

### 下拉树配置方式

下拉树(searchMode=6)的接口地址配置在 **extJson 的 `loadTree` 字段**中，不是在 dictCode 中。

**extJson 配置（含穿透回显）：**
```json
{
    "loadTree": "<api_base>/test/getCategoryTree",
    "loadTreeByValue": "<api_base>/test/getCategoryTreeByValue",
    "treeMultiple": false
}
```

**fieldList/paramList 中传 extJson：**
```json
{
    "fieldName": "category",
    "fieldText": "分类",
    "widgetType": "String",
    "searchFlag": 1,
    "searchMode": 6,
    "extJson": "{\"loadTree\":\"http://xxx/getCategoryTree\",\"loadTreeByValue\":\"http://xxx/getCategoryTreeByValue\",\"treeMultiple\":false}"
}
```

> **注意：** `extJson` 值是 **JSON 字符串**（不是对象），需要 `json.dumps()` 转换。

### 树接口返回数据格式

**loadTree 接口**（加载树结构）：GET `?pid=`，不传 pid 返回一级节点，传 pid 返回子节点。

请求方式: GET

```json
[{
  "id": "001",
  "pid": "",
  "value": "A01",
  "title": "节点名称",
  "izLeaf": 0
}]
```

| 字段 | 说明 |
|------|------|
| id | 节点标识 |
| pid | 父节点ID（为空返回一级节点） |
| value | 实际查询值 |
| title | 显示文本 |
| izLeaf | 1=叶子节点；0=父节点（显示展开图标） |

**不支持默认值**。穿透功能(v1.5.0+)需配置 `loadTreeByValue` 接口。

**loadTreeByValue 接口**（根据值获取树信息，用于穿透回显）：GET `?value=`，返回该节点及所有父级节点。

```json
// 请求: GET /getCategoryTreeByValue?value=A1
// 返回: 该节点及其父级（从根到叶）
[
  {"id": "1", "pid": "", "value": "A", "title": "分类A", "izLeaf": 0},
  {"id": "11", "pid": "1", "value": "A1", "title": "分类A-1", "izLeaf": 1}
]
```

---

## 8. JS 增强（自定义下拉框联动）

自定义下拉框(searchMode=7)需配合 JS 增强实现数据加载和联动。

### 核心函数

| 函数 | 说明 |
|------|------|
| `this.updateSelectOptions(dbCode, fieldName, options)` | 动态更新下拉框选项 |
| `this.onSearchFormChange(dbCode, fieldName, callback)` | 监听控件值变化 |
| `$http.metaGet(url, params)` | 发起 GET 请求 |

**options 格式：** `[{value: '001', text: '北京市'}, ...]`

### 三级联动示例（省市区）

```javascript
function init(){
  var apiBase = '<api_base>/test/getAreaList';

  // 加载省份
  $http.metaGet(apiBase)
    .then(res => {
      var data = Array.isArray(res) ? res : (res.data || res);
      this.updateSelectOptions('queryDemo', 'province', data);
    })

  // 省 -> 市
  this.onSearchFormChange('queryDemo', 'province', (value) => {
    this.updateSelectOptions('queryDemo', 'city', []);
    this.updateSelectOptions('queryDemo', 'area', []);
    if(!value) return;
    $http.metaGet(apiBase, {pid: value})
      .then(res => {
        var data = Array.isArray(res) ? res : (res.data || res);
        this.updateSelectOptions('queryDemo', 'city', data);
      })
  })

  // 市 -> 区
  this.onSearchFormChange('queryDemo', 'city', (value) => {
    this.updateSelectOptions('queryDemo', 'area', []);
    if(!value) return;
    $http.metaGet(apiBase, {pid: value})
      .then(res => {
        var data = Array.isArray(res) ? res : (res.data || res);
        this.updateSelectOptions('queryDemo', 'area', data);
      })
  })
}
```

### JS 增强保存方式

JS 增强通过 **`POST /jmreport/editEnhance`** 接口保存（不是 save 接口）：

```python
api_request('/jmreport/editEnhance', {
    "id": report_id,
    "jsStr": js_code_string
})
```

> **注意：** `save` 接口不保存 jsStr/cssStr/pyStr，必须用 `editEnhance` 单独保存。

### 后端接口要求

联动接口需返回 `[{value, text}]` 格式：

```java
@GetMapping("/getAreaList")
public List<Map<String, String>> getAreaList(@RequestParam(value = "pid", required = false) String pid) {
    List<Map<String, String>> list = new ArrayList<>();
    // 不传pid返回省份，传pid返回下级
    Map<String, String> map = new HashMap<>();
    map.put("value", "110000");
    map.put("text", "北京");
    list.add(map);
    return list;
}
```

---

## 9. 报表参数配置

### SQL数据源参数
- 格式: `select * from sys_user where id='${id}'`
- 点击SQL输入框外部自动解析参数
- `$` 或 `#` 与 `{` 之间不可有空格
- `#` 开头的参数为系统变量，无需填报表参数

### API参数配置
- 单参数用 `?` 拼接，多参数用 `&` 连接
- 示例: `http://...?name='${name}'&createBy='#{sysUserCode}'`

### 查询条件设置
- 勾选"查询"复选框在查询区域生成查询字段
- 可配置查询模式类型（默认为输入框）
- 可设置默认值和日期格式
- 支持系统变量调用

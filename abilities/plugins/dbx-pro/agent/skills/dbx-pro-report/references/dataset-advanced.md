# 数据集进阶参考（低频）

数据源管理、JavaBean数据集、查询已有数据集、文件数据集、主子表联动、共享数据集。

---

## 1. 数据源管理

> 数据源详细 API 参见 `datasource-api.md`。本节仅记录与数据集创建直接相关的关键操作。

### 查询已有数据源

`GET /jmreport/getDataSourceByPage`（需签名）

```python
ds_resp = api_request('/jmreport/getDataSourceByPage')
ds_map = {ds['name']: ds['id'] for ds in ds_resp.get('result', [])}
```

### 添加/编辑数据源

`POST /jmreport/addDataSource`（新增不传 id，编辑传 id）

```json
{
    "id": "", "reportId": "报表ID", "name": "mysql",
    "dbType": "MYSQL5.7", "dbDriver": "com.mysql.cj.jdbc.Driver",
    "dbUrl": "jdbc:mysql://127.0.0.1:3306/jimureport?...",
    "dbUsername": "root", "dbPassword": "123456"
}
```

数据集通过 `dbSource` 字段关联数据源ID。

> 如果开启数据源安全模式（`firewall.dataSourceSafe: true`），SQL数据集必须指定 `dbSource`。

### 测试数据源连接

`POST /jmreport/testConnection`（需签名）

**请求参数：**
```json
{
    "dbType": "MYSQL5.7",
    "dbDriver": "com.mysql.cj.jdbc.Driver",
    "dbUrl": "jdbc:mysql://127.0.0.1:3306/jeecg-boot?useUnicode=true&characterEncoding=UTF-8",
    "dbUsername": "root",
    "dbPassword": "123456"
}
```

**返回示例：**
```json
{
    "success": true,
    "message": "连接成功"
}
```

**调用场景：**
- 用户指定数据源时：先 testConnection，连接成功才使用
- 连接失败：提示用户提供正确的数据库连接信息

---

## 2. JavaBean数据集

`POST /jmreport/queryFieldByBean`（解析字段）

```json
{"javaType": "spring-key", "javaValue": "testRpSpringBean", "isPage": false, "param": {}}
```

返回：`result` 直接是字段数组（`list`），不是 `{"fieldList": [...]}`。

### saveDb 字段说明

> **`javaType` 不是 Bean 名称！** 它是类型选择器，`javaValue` 才是 Bean 名称。
> **`dbType` 必须为 `"2"`**（不是 `"0"`），否则数据集在 UI 中显示为 SQL 类型。

| 字段 | 值 | 说明 |
|------|-----|------|
| `dbType` | **`"2"`** | JavaBean 数据集专属类型（实测确认）；图表 `chart_entry` 的 `data_type` 对应传 `"javabean"` |
| `javaType` | `"spring-key"` | Bean 通过 Spring 容器 `@Component("beanName")` 注册 |
| `javaType` | `"java-class"` | 直接通过类全路径反射创建 |
| `javaValue` | Bean 名称或类路径 | spring-key 时填 Bean 名称（如 `testRpSpringBean`），java-class 时填类全路径 |

```python
# saveDb 完整 payload（JavaBean）
{
    "izSharedSource": 0,
    "jimuReportId":   report_id,
    "dbCode":         "myBeanDs",
    "dbChName":       "Bean数据集",
    "dbType":         "2",          # ← 必须 "2"，不是 "0"
    "dbSource":       "",
    "isList":         "1",
    "isPage":         "0",
    "dbDynSql":       "",
    "javaType":       "spring-key",
    "javaValue":      "testRpSpringBean",
    "jsonData":       "", "apiConvert": "", "apiUrl": "", "apiMethod": "0",
    "fieldList":      field_list,
    "paramList":      [],
}
```

Bean 必须实现 `IDataSetFactory` 接口，框架自动调用 `createData()`（非分页）或 `createPageData()`（分页）方法。

### 设计态填充说明

> JavaBean 数据集**不支持**通过 `/qurestSql` 或 `/qurestApi` 进行设计态数据填充，调用这些接口均返回 `null`。
> 图表数据由运行时渲染引擎在 `/jmreport/view/{id}` 时直接调用 Bean 的 `createData()` 提供，**创建图表时跳过回填步骤**。

```python
# 错误：把 Bean 名称放到了 javaType
{"javaType": "testRpSpringBean", "javaValue": "createData"}
```

---

## 3. 查询已有数据集

### Step 1: 获取数据集列表

`GET /jmreport/field/tree/{reportId}`

```python
tree = api_request(f'/jmreport/field/tree/{report_id}')
db_map = {}  # dbCode -> dbId
for group in tree.get('result', []):
    if group and len(group) > 0:
        info = group[0]
        db_map[info['code']] = info['dbId']
```

### Step 2: 获取单个数据集详情

`GET /jmreport/loadDbData/{dbId}?reportId={reportId}`

```python
detail = api_request(f'/jmreport/loadDbData/{db_id}?reportId={report_id}').get('result', {})
report_db = detail.get('reportDb', {})
existing_sql = report_db.get('dbDynSql', '')
existing_fields = detail.get('fieldList', [])
existing_params = detail.get('paramList', [])
```

> **注意：`dbDynSql` 和 `dbSource` 在 `result.reportDb` 中，不在顶层。**

### Step 3: 查询参数列表

`GET /jmreport/getListReportDb?reportId={reportId}`

返回：`result.reportDbParam.{dbCode}: [{paramName, ...}]`

---

## 4. 文件数据集

通过上传 Excel/CSV 文件创建数据集。分为**单文件数据集**（dbType="6"）和**多文件数据集**（dbType="5"）两种。

| 类型 | dbType | 创建数据集方式 | 特点 |
|------|--------|--------------|------|
| 单文件 | `"6"` | `/dataset/files/single/save` 专用接口 | 后端自动生成 dbCode，不支持自定义 |
| 多文件 | `"5"` | 标准 `queryFieldBySql` + `saveDb` 流程 | SQL 需 `jmf.` 前缀，字段/参数配置与 SQL 数据集一致 |

> **上传接口 `isSingle` 固定传 `true`**，单文件和多文件都一样。区别在于后续创建数据集的方式不同。

### 4.0 上传文件（单文件/多文件共用）

`POST /jmreport/source/datasource/files/add`（**multipart/form-data**）

| 参数 | 类型 | 说明 |
|------|------|------|
| `reportId` | String | 报表ID |
| `isSingle` | Boolean | 固定传 `true` |
| `file` | MultipartFile | 用户提供本地文件路径，需构造为 multipart 上传 |

**Python 实现（用户提供本地文件路径）：**

```python
import os, mimetypes

def upload_file_dataset(report_id, file_path):
    """上传文件创建文件数据集"""
    file_name = os.path.basename(file_path)
    content_type = mimetypes.guess_type(file_name)[0] or 'application/octet-stream'

    # 构造 multipart/form-data
    boundary = '----WebKitFormBoundary' + str(int(time.time() * 1000))
    body = b''

    # reportId 字段
    body += f'--{boundary}\r\n'.encode()
    body += b'Content-Disposition: form-data; name="reportId"\r\n\r\n'
    body += f'{report_id}\r\n'.encode()

    # isSingle 字段
    body += f'--{boundary}\r\n'.encode()
    body += b'Content-Disposition: form-data; name="isSingle"\r\n\r\n'
    body += b'true\r\n'

    # file 字段
    body += f'--{boundary}\r\n'.encode()
    body += f'Content-Disposition: form-data; name="file"; filename="{file_name}"\r\n'.encode()
    body += f'Content-Type: {content_type}\r\n\r\n'.encode()
    with open(file_path, 'rb') as f:
        body += f.read()
    body += b'\r\n'

    body += f'--{boundary}--\r\n'.encode()

    headers = {
        'X-Access-Token': TOKEN,
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
    url = f'{API_BASE}/jmreport/source/datasource/files/add'
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    resp = urllib.request.urlopen(req, context=ctx)
    return json.loads(resp.read().decode('utf-8'))
```

**返回结果：**

```json
{
    "success": true,
    "message": "filesDataSet/报表ID/文件名.xlsx",
    "code": 0,
    "result": {
        "id": "数据源ID",
        "name": "报表ID文件数据源",
        "reportId": "报表ID",
        "dbType": "FILES",
        "dbDriver": "filesDataSet\\报表ID",
        "dbUrl": "[{\"fileName\":\"文件名.xlsx\",\"name\":\"jmf.Sheet1_文件名_excel\"}]"
    }
}
```

**关键返回字段：**
- `result.id` — 文件数据源ID（多文件流程中作为 `dbSource` 传给 `queryFieldBySql` 和 `saveDb`）
- `result.dbUrl` — JSON 数组字符串，每项的 `name` 是表名（带 `jmf.` 前缀，用于 SQL 查询）
- **多文件场景：** 每次上传新文件后，`dbUrl` 数组会累积所有已上传文件的信息

### 4.0.1 查询已上传的文件数据源

`GET /jmreport/source/datasource/files/get?reportId={reportId}`

返回该报表关联的文件数据源信息（含所有已上传文件列表）。

### Step 2: 预览文件数据

`GET /jmreport/source/datasource/files/preview`

| 参数 | 说明 |
|------|------|
| `reportId` | 报表ID |
| `tableName` | 上传返回的 `dbUrl[].name`（需 URL 编码） |

```python
import urllib.parse

# 从上传返回中提取 tableName
db_url = json.loads(upload_result['result']['dbUrl'])
table_name = db_url[0]['name']  # e.g. "jmf.Sheet1_文件数据集_excel"

# 预览
encoded_name = urllib.parse.quote(table_name)
preview = api_request(f'/jmreport/source/datasource/files/preview?reportId={report_id}&tableName={encoded_name}')
# preview['result'] = [{"id": 1, "product_name": "苹果", "price": 100}, ...]
```

### Step 3: 创建单文件数据集（dbType="6"）

> **重要：单文件数据集必须使用 `/dataset/files/single/save` 接口，不能用通用的 `/saveDb`。**
> 使用 `saveDb` 创建的单文件数据集在设计器中无法关联文件（编辑时显示"暂无数据"），因为缺少文件数据源的正确关联。

`POST /jmreport/source/dataset/files/single/save`

```python
save_data = {
    "reportId": report_id,
    "dbSource": {
        "id": upload_result['result']['id'],   # 文件数据源ID
        "dbUrl": upload_result['result']['dbUrl'],  # 文件信息JSON
        "dbChName": "文件数据集"                # 数据集中文名
    }
}
result = api_request('/jmreport/source/dataset/files/single/save', save_data)
```

**返回说明：**
- 后端自动解析文件字段、生成 dbCode（格式 `file_` + 文件名拼音）、创建 SQL
- dbCode 由后端生成，不可自定义

### Step 3.1: 获取生成的 dbCode

创建后需通过 field/tree 获取后端生成的 dbCode：

```python
tree = api_request(f'/jmreport/field/tree/{report_id}')
for group in tree.get('result', []):
    if group:
        info = group[0] if isinstance(group, list) else group
        if info.get('type') == '6':  # 文件数据集
            db_code = info['code']
            db_id = info['dbId']
            fields = [c['fieldText'] for c in info.get('children', [])]
            print(f'dbCode={db_code}, fields={fields}')
```

### Step 3.2: 查看文件数据集详情

`GET /jmreport/source/dataset/files/single/get?id={dbId}`

返回文件数据源信息（含 dbUrl 文件列表）。

### 4.1 多文件数据集（dbType="5"）

多文件数据集使用标准的 `queryFieldBySql` + `saveDb` 流程，与 SQL 数据集的字段配置、参数配置、默认值处理**完全一致**，唯一区别是 SQL 表名需要 `jmf.` 前缀。

> ⚠️ **三个必须遵守的规则（实测踩坑总结）：**
> 1. **fieldList 必须二次保存**：首次 `/saveDb`（无 id）不会持久化 fieldList，拿到 db_id 后必须再做一次带 `"id": db_id` 的更新调用，字段才真正写入DB，UI 中「字段名」列才不为空
> 2. **fieldList 条目必须带 `fieldNamePhysics`**：直接用 `/queryFieldBySql` 返回的原始 dict，不要自己手拼缺字段
> 3. **图表 data_type 必须是 `"files"`**：文件数据集绑定图表时 `chart_entry(data_type="files")`；若写 `"sql"` 运行时调 `/qurestSql` 会报 "reportDb is null"，图表永远空白

**完整流程：**

```
1. 上传文件（逐个）  → POST /jmreport/source/datasource/files/add（isSingle=false）
2. 获取文件数据源    → GET /jmreport/source/datasource/files/get?reportId=xxx
3. 写 SQL（jmf.前缀）→ select * from jmf.Sheet1_文件名_excel
4. 解析字段          → POST /jmreport/queryFieldBySql（dbSource = 文件数据源ID）
5. 保存数据集（两步）→ POST /jmreport/saveDb 无id（初建）+ 再次带id（写入fieldList）
```

**Step 1: 逐个上传文件**

多个文件需要**一个一个上传**，每次调用 `/files/add`（`isSingle=false`），`dbUrl` 会自动累积：

```python
# 上传第1个文件
r1 = upload_file_dataset(report_id, '/path/to/sales.xlsx')
# r1.result.dbUrl = '[{"fileName":"sales.xlsx","name":"jmf.Sheet1_sales_excel"}]'

# 上传第2个文件
r2 = upload_file_dataset(report_id, '/path/to/products.csv')
# r2.result.dbUrl = '[{"fileName":"sales.xlsx","name":"jmf.Sheet1_sales_excel"},{"fileName":"products.csv","name":"jmf.products_csv"}]'
```

**Step 2: 获取文件数据源信息**

```python
files_info = api_request(f'/jmreport/source/datasource/files/get?reportId={report_id}')
datasource_id = files_info['result']['id']  # 文件数据源ID
db_url = json.loads(files_info['result']['dbUrl'])  # 所有文件的表名列表
# [{"fileName":"sales.xlsx","name":"jmf.Sheet1_sales_excel"}, ...]
```

**Step 3-4: 写 SQL 并解析字段**

> **SQL 表名必须加 `jmf.` 前缀**，表名来自上传返回的 `dbUrl[].name`。

> **Calcite 保留字限制**：`value`、`type` 不能作为 SQL 别名，会报 `Encountered "value" at line 1`。必须改用其他名称（如 `sal_amt`、`ser_type`）。

```python
# 表名从 dbUrl 中获取
table_name = db_url[0]['name']  # "jmf.Sheet1_sales_excel"

sql = f"SELECT a.sales AS sal_amt, a.month AS ser_type FROM {table_name} a"
parse_result = api_request('/jmreport/queryFieldBySql', {
    "sql": sql,
    "dbSource": datasource_id,  # 文件数据源ID
    "type": "0"
})
fl_raw = parse_result['result']['fieldList']
# 直接使用原始 dict，保留 fieldNamePhysics 字段
field_list = [
    {
        "fieldNamePhysics": f["fieldNamePhysics"],   # 必须带，否则 fieldName 列为空
        "fieldName":        f["fieldName"],
        "fieldText":        f.get("fieldText", f["fieldName"]),
        "widgetType":       f.get("widgetType", "String"),
        "isShow": "1", "isQuery": "0",
        "orderNum":         f.get("orderNum", i),
    }
    for i, f in enumerate(fl_raw)
]
```

**Step 5: 保存数据集（必须两步）**

```python
db_base = {
    "izSharedSource": 0,
    "jimuReportId": report_id,
    "dbCode": "sales",
    "dbChName": "销售数据",
    "dbType": "5",               # 多文件数据集
    "dbSource": datasource_id,   # 文件数据源ID
    "isList": "1",
    "isPage": "0",
    "dbDynSql": sql,             # 含 jmf. 前缀的 SQL
    "jsonData": "", "apiConvert": "", "apiUrl": "", "apiMethod": "0",
    "fieldList": field_list,
    "paramList": []
}

# 第一步：初建，拿 db_id
db_id = api_request('/jmreport/saveDb', db_base)['result']['id']

# 第二步：带 id 更新，fieldList 才真正写入DB（没有这步，UI「字段名」列全空）
db_base["id"] = db_id
api_request('/jmreport/saveDb', db_base)
```

> **参数和默认值处理与 SQL 数据源完全一致：** FreeMarker 条件、`searchValue`/`paramValue`、`searchMode`、`dictCode`、默认值表达式等配置方式无任何区别。

**Step 6: 绑定图表（如有）**

```python
# !! data_type 必须是 "files"，不能是 "sql" !!
chart = chart_entry(
    layer_id, db_id, db_code, "bar.multi",
    echarts_cfg,
    axis_x="prod_name", axis_y="sal_amt", series="ser_type",
    api_status="1",
    data_type="files",   # 文件数据集专用，"sql" 会报 reportDb is null
)
```

### 4.1.1 Calcite 类型转换问题（String cannot be cast to Integer）

**现象：** 多文件数据集使用 FreeMarker 参数过滤时，预览报错：
```
class java.lang.String cannot be cast to class java.lang.Integer
SQL: SELECT COUNT(1) total FROM (...and user_id = ?) temp_count
```

**根因：** Calcite 引擎根据 Excel 列的实际数据推断字段类型。若列中所有值均为纯数字，Calcite 会将该列推断为 **Integer 类型**。开启分页（`isPage="1"`）后，JimuReport 将 SQL 包装为 PreparedStatement COUNT 查询，参数 `?` 被绑定为 Integer，而传入值是 String，导致类型不匹配。

**解决方案：** 在 SQL 中对字段加 `CAST(字段名 AS VARCHAR)`，强制以字符串类型比较：

```sql
-- 原始（报错）
select id, user_id, depart_name from jmf.Sheet1_部门信息_excel
where 1=1
<#if isNotEmpty(user_id)> and user_id = '${user_id}'</#if>

-- 修复（加 CAST）
select id, user_id, depart_name from jmf.Sheet1_部门信息_excel
where 1=1
<#if isNotEmpty(user_id)> and CAST(user_id AS VARCHAR) = '${user_id}'</#if>
```

**适用范围：** 所有值为纯数字但逻辑上应作为字符串的字段（如 ID、编码、手机号等）。

> **注意：** 若不需要分页，也可将 `isPage` 设为 `"0"` 规避此问题，但建议优先使用 CAST 方案以保持语义清晰。

**多文件上传 Python 实现：**

```python
def upload_file_dataset(report_id, file_path):
    """上传文件到文件数据源"""
    file_name = os.path.basename(file_path)
    content_type = mimetypes.guess_type(file_name)[0] or 'application/octet-stream'
    boundary = '----WebKitFormBoundary' + str(int(time.time() * 1000))
    body = b''

    body += f'--{boundary}\r\n'.encode()
    body += b'Content-Disposition: form-data; name="reportId"\r\n\r\n'
    body += f'{report_id}\r\n'.encode()

    body += f'--{boundary}\r\n'.encode()
    body += b'Content-Disposition: form-data; name="isSingle"\r\n\r\n'
    body += b'true\r\n'

    body += f'--{boundary}\r\n'.encode()
    body += f'Content-Disposition: form-data; name="file"; filename="{file_name}"\r\n'.encode()
    body += f'Content-Type: {content_type}\r\n\r\n'.encode()
    with open(file_path, 'rb') as f:
        body += f.read()
    body += b'\r\n'
    body += f'--{boundary}--\r\n'.encode()

    headers = {
        'X-Access-Token': TOKEN,
        'Content-Type': f'multipart/form-data; boundary={boundary}'
    }
    url = f'{API_BASE}/jmreport/source/datasource/files/add'
    req = urllib.request.Request(url, data=body, headers=headers, method='POST')
    resp = urllib.request.urlopen(req, context=ctx)
    return json.loads(resp.read().decode('utf-8'))
```

### 删除多文件数据集中的单个文件

`DELETE /jmreport/source/datasource/files/del`

```json
{
    "reportId": "报表ID",
    "tableName": "jmf.Sheet1_文件名_excel"
}
```

> `tableName` 来自上传返回的 `dbUrl[].name`，删除后该文件从 `dbUrl` 数组中移除。

### 删除数据集

`GET /jmreport/delDbData/{dbId}`

- `dbId` — 数据集ID（从 `field/tree` 返回的 `dbId`，不是报表ID）

### 删除报表

`DELETE /jmreport/delete`

参数：`id` — 报表ID

```python
api_request(f'/jmreport/delete?id={report_id}', method='DELETE')
```

返回：`{"success": true, "message": "删除成功!", "code": 200, "result": true}`

---

## 5. 主子表联动配置

通过 `/jmreport/link/saveAndEdit` 接口配置主子表数据联动，子表根据主表选中行的字段值自动过滤数据。

### 新增主子表联动

`POST /jmreport/link/saveAndEdit`

```json
{
    "mainReport": "主表数据源code",
    "subReport": "子表数据源code",
    "linkName": "主子表配置",
    "parameter": "{\"main\":\"主表code\",\"sub\":\"子表code\",\"subReport\":[{\"mainField\":\"id\",\"subParam\":\"id\",\"tableIndex\":1}]}",
    "linkType": "4",
    "reportId": "报表ID"
}
```

**参数说明：**

| 字段 | 说明 |
|------|------|
| `mainReport` | 主表数据源的 dbCode |
| `subReport` | 子表数据源的 dbCode |
| `linkName` | 联动配置名称 |
| `linkType` | `"4"` = 主子表联动 |
| `reportId` | 报表ID |
| `parameter` | JSON 字符串，定义主子表字段映射关系 |

**parameter 结构（JSON 字符串）：**

```json
{
    "main": "主表code",
    "sub": "子表code",
    "subReport": [
        {
            "mainField": "id",
            "subParam": "id",
            "tableIndex": 1
        }
    ]
}
```

| 字段 | 说明 |
|------|------|
| `main` | 主表数据源 code |
| `sub` | 子表数据源 code |
| `subReport[].mainField` | 主表关联字段名 |
| `subReport[].subParam` | 子表参数名（对应子表 SQL 中的 `${param}`） |
| `subReport[].tableIndex` | 子表序号（从1开始） |

**返回值：**
```json
{
    "success": true,
    "code": 0,
    "result": "联动配置ID"
}
```

### 编辑主子表联动

同一接口 `POST /jmreport/link/saveAndEdit`，传入 `id` 字段即为更新：

```json
{
    "id": "联动配置ID",
    "reportId": "报表ID",
    "mainReport": "主表code",
    "subReport": "子表code",
    "linkName": "主子表配置",
    "linkType": "4",
    "parameter": "{\"main\":\"主表code\",\"sub\":\"子表code\",\"subReport\":[{\"mainField\":\"id\",\"subParam\":\"id\",\"tableIndex\":1}]}"
}
```

### Python 示例

```python
import json

# 构造 parameter
parameter = json.dumps({
    "main": "orderMain",
    "sub": "orderDetail",
    "subReport": [{"mainField": "id", "subParam": "order_id", "tableIndex": 1}]
}, ensure_ascii=False)

# 新增联动
link_data = {
    "mainReport": "orderMain",
    "subReport": "orderDetail",
    "linkName": "订单主子表",
    "parameter": parameter,
    "linkType": "4",
    "reportId": report_id
}
result = api_request('/jmreport/link/saveAndEdit', link_data)
link_id = result['result']  # 联动配置ID

# 编辑联动（传 id）
link_data["id"] = link_id
result = api_request('/jmreport/link/saveAndEdit', link_data)
```

### 删除主子表联动

`POST /jmreport/link/delete`

```json
{"id": "联动配置ID"}
```

返回：`{"success": true, "result": "删除成功!"}`

### linkType 值说明

| linkType | 类型 |
|----------|------|
| `"4"` | 主子表联动 |
| `"2"` | 图表联动 |

---

## 6. 共享数据集

共享数据集与普通数据集的 CRUD 操作完全一致，唯一区别是保存时 `izSharedSource: 1`（普通数据集为 `0`）。共享数据集不关联具体报表（`jimuReportId` 为空），可被多个报表引用。

### 查询共享数据集列表

`GET /jmreport/source/getJmReportSharedDbPageList`

**请求参数：**

| 参数 | 说明 | 示例 |
|------|------|------|
| `pageSize` | 每页条数 | `10` |
| `pageNo` | 页码 | `1` |
| `name` | 按名称模糊搜索（可选） | `""` |

**返回结构：**
```json
{
    "success": true,
    "code": 0,
    "result": {
        "pageNo": 1,
        "pageSize": 10,
        "total": 6,
        "pages": 1,
        "records": [
            {
                "id": "1199211124874633216",
                "dbCode": "aaa",
                "dbChName": "aaa",
                "dbType": "0",
                "izSharedSource": 1,
                "createTime": "2026-04-01 14:43:43",
                ...
            }
        ]
    }
}
```

> **records 字段说明：** 与普通数据集结构相同（`id`、`dbCode`、`dbChName`、`dbType` 等），但 `jimuReportId` 为 `null`，`izSharedSource` 为 `1`。

### 创建共享数据集

使用 `POST /jmreport/saveDb`，与普通数据集相同，区别：
- `izSharedSource: 1`
- `jimuReportId` 传空字符串 `""` 或不传

```json
{
    "izSharedSource": 1,
    "jimuReportId": "",
    "dbCode": "shared_users",
    "dbChName": "共享用户数据",
    "dbType": "0",
    "dbSource": "",
    "isList": "1",
    "isPage": "1",
    "dbDynSql": "select * from sys_user",
    "fieldList": [...],
    "paramList": []
}
```

### 修改共享数据集

与普通数据集修改一致，传 `id` 即为更新：

```json
{
    "id": "已有共享数据集ID",
    "izSharedSource": 1,
    "dbCode": "shared_users",
    "dbChName": "共享用户数据（已修改）",
    ...
}
```

### 删除共享数据集

`POST /jmreport/source/delShareDbByDbId`

```json
{"id": "共享数据集ID"}
```

**返回：**
```json
{
    "success": true,
    "message": "共享数据集删除成功！",
    "code": 0,
    "result": null
}
```

### 报表引用（关联）共享数据集

`POST /jmreport/source/linkJmReportShareDb`

将一个已有的共享数据集关联到指定报表中。关联后报表即可使用该共享数据集的字段进行数据绑定。

**请求参数：**
```json
{
    "jimuReportId": "报表ID",
    "jimuSharedSourceId": "共享数据集ID"
}
```

**返回：**
```json
{
    "success": true,
    "message": "保存共享数据集成功",
    "code": 0,
    "result": null
}
```

> **说明：** 关联后，报表的数据集列表中会出现一条 `dbType: "4"` 的数据集，通过 `jimuSharedSourceId` 指向原始共享数据集。

### dbType 与 izSharedSource 的区别

| 概念 | 说明 |
|------|------|
| `izSharedSource: 1` | 标记数据集**本身**是共享的（保存在共享数据集列表中） |
| `dbType: "4"` | 标记数据集是**引用**共享数据集的（报表中使用共享数据集时） |

---

# 数据源管理 API

积木报表数据源的增删改查接口，用于管理报表关联的数据库连接。

---

## 添加/编辑数据源

- **接口：** POST `/jmreport/addDataSource`
- **说明：** 编辑时 `id` 不为空，新增时 `id` 为空
- **请求参数：**

```json
{
    "id": "",
    "reportId": "1199136323694804992",
    "code": "",
    "name": "redis",
    "dbType": "redis",
    "dbDriver": "",
    "dbUrl": "127.0.0.1:6379",
    "dbUsername": "",
    "dbPassword": ""
}
```

- **返回结果：**

```json
{
    "success": true,
    "message": "操作成功！",
    "code": 200,
    "result": true,
    "timestamp": 1775011551379
}
```

---

## 测试数据源连接

- **接口：** POST `/jmreport/testConnection`
- **说明：** 测试数据源是否可以正常连接，不需要 id 和 reportId
- **请求参数：**

```json
{
    "dbType": "MYSQL5.7",
    "dbDriver": "com.mysql.cj.jdbc.Driver",
    "dbUrl": "jdbc:mysql://<db_host>:3306/jeecg-boot-cr?useUnicode=true&characterEncoding=UTF-8&serverTimezone=GMT%2B8&tinyInt1isBit=false",
    "dbUsername": "root",
    "dbPassword": "123456"
}
```

- **返回结果：**

```json
{
    "success": true,
    "message": "数据库连接成功",
    "code": 200,
    "result": true,
    "timestamp": 1775013503383
}
```

---

## 获取数据源

- **接口：** GET `/jmreport/getDataSourceById?id=xxx`
- **返回结果：**

```json
{
    "success": true,
    "message": "",
    "code": 200,
    "result": {
        "id": "1194904892449841152",
        "code": "",
        "name": "mysql",
        "reportId": "1773998084122373187",
        "remark": null,
        "dbType": "MYSQL5.7",
        "dbDriver": "com.mysql.cj.jdbc.Driver",
        "dbUrl": "jdbc:mysql://127.0.0.1:3306/jimureport?useUnicode=true&characterEncoding=UTF-8&serverTimezone=GMT%2B8&tinyInt1isBit=false",
        "dbUsername": "root",
        "dbPassword": "123456",
        "createBy": "jeecg",
        "createTime": "2026-03-20 17:32:17",
        "updateBy": "jeecg",
        "updateTime": "2026-03-20 17:33:29",
        "connectTimes": 0,
        "tenantId": "2",
        "type": "report",
        "withoutDbType": null,
        "dbChName": null
    },
    "timestamp": 1775011724929
}
```

---

## 分页查询数据源

- **接口：** GET `/jmreport/getDataSourceByPage?token=xxx&pageNo=1&pageSize=10`
- **说明：** 分页查询数据源列表，返回含 id、name、dbType、type 等基本信息（不含连接详情）
- **返回结果：**

```json
{
    "success": true,
    "message": "",
    "code": 200,
    "result": {
        "pageNo": 1,
        "pageSize": 10,
        "total": 25,
        "pages": 3,
        "records": [
            {
                "id": "1189365702421168128",
                "name": "客户pos",
                "dbType": "POSTGRESQL",
                "type": "report"
            }
        ]
    },
    "timestamp": 1775013768401
}
```

---

## 删除数据源

- **接口：** POST `/jmreport/delDataSource`
- **请求参数：**

```json
{
    "id": "1194904892449841152"
}
```

---

## 初始化数据源列表

- **接口：** GET `/jmreport/initDataSource?token=xxx`
- **说明：** 返回当前可用的所有数据源列表（仅含 id、name、type 等基本信息，不含连接详情）

---

## 支持的数据库类型及默认配置

> **规则：** 用户未提供 dbDriver 和 dbUrl 时，根据 dbType 使用下表的默认值填充。`other` 类型无默认值，需用户自行填写。

### SQL 类型

| dbType | label | 默认 dbDriver | 默认 dbUrl |
|--------|-------|---------------|-----------|
| MYSQL5.7 | MySQL5.7+ | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://127.0.0.1:3306/jimureport?useUnicode=true&characterEncoding=UTF-8&serverTimezone=GMT%2B8&tinyInt1isBit=false` |
| MYSQL5.5 | MySQL5.5 | `com.mysql.jdbc.Driver` | `jdbc:mysql://127.0.0.1:3306/jimureport?characterEncoding=UTF-8&useUnicode=true&useSSL=false&serverTimezone=GMT%2B8&tinyInt1isBit=false` |
| TIDB | TIDB | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://127.0.0.1:4000/jimureport?useUnicode=true&characterEncoding=UTF-8&serverTimezone=GMT%2B8&tinyInt1isBit=false` |
| ORACLE | Oracle | `oracle.jdbc.OracleDriver` | `jdbc:oracle:thin:@127.0.0.1:1521:ORCL` |
| SQLSERVER | SQLServer | `com.microsoft.sqlserver.jdbc.SQLServerDriver` | `jdbc:sqlserver://127.0.0.1:1433;SelectMethod=cursor;DatabaseName=jimureport` |
| POSTGRESQL | PostgreSQL | `org.postgresql.Driver` | `jdbc:postgresql://127.0.0.1:5432/jimureport` |
| MARIADB | MariaDB | `org.mariadb.jdbc.Driver` | `jdbc:mariadb://127.0.0.1:3306/jimureport?characterEncoding=UTF-8&useSSL=false` |
| dm | 达梦 | `dm.jdbc.driver.DmDriver` | `jdbc:dm://127.0.0.1:5236/?jimureport&zeroDateTimeBehavior=convertToNull&useUnicode=true&characterEncoding=utf-8` |
| kingbase8 | 人大金仓 | `com.kingbase8.Driver` | `jdbc:kingbase8://127.0.0.1:54321/jimureport` |
| oscar | 神通 | `com.oscar.Driver` | `jdbc:oscar://127.0.0.1:2003/jimureport` |
| DB2 | DB2 | `com.ibm.db2.jcc.DB2Driver` | `jdbc:db2://127.0.0.1:50000/jimureport` |
| Hsqldb | Hsqldb | `org.hsqldb.jdbc.JDBCDriver` | `jdbc:hsqldb:hsql://127.0.0.1/jimureport` |
| Derby | Derby | `org.apache.derby.jdbc.ClientDriver` | `jdbc:derby://127.0.0.1:1527/jimureport` |
| H2 | H2 | `org.h2.Driver` | `jdbc:h2:tcp://127.0.0.1:8082/~/jimureport` |
| CLICKHOUSE | CLICKHOUSE | `com.clickhouse.jdbc.ClickHouseDriver` | `jdbc:clickhouse://127.0.0.1:8123/default` |
| TDENGINE | TDengine | `com.taosdata.jdbc.TSDBDriver` | `jdbc:TAOS://127.0.0.1:6030/jmreport?timezone=UTC-8&charset=utf-8&serverTimezone=Asia/Shanghai` |
| Doris | Doris | `com.mysql.cj.jdbc.Driver` | `jdbc:mysql://127.0.0.1:9030/jimureport?useUnicode=true&characterEncoding=UTF-8&serverTimezone=GMT%2B8&tinyInt1isBit=false` |
| SQLite | SQLite | `org.sqlite.JDBC` | `jdbc:sqlite://opt/jimureport.db` |

### NoSQL 类型

| dbType | label | 默认 dbDriver | 默认 dbUrl |
|--------|-------|---------------|-----------|
| redis | Redis | _(空)_ | `127.0.0.1:6379` |
| mongodb | MongoDb | _(空)_ | `127.0.0.1:27017/test` |
| es | Elasticsearch | `/` | `127.0.0.1:9200` |

> **Elasticsearch 数据源使用规范（已验证）：**
> - `dbType="es"`，`dbDriver="/"`，`dbUrl="host:port"`（**不含 http:// 前缀和尾部 /**）
> - 数据集 `dbType="0"`（SQL 数据集），`dbDynSql` 使用 **`SELECT * FROM es.索引名`** 格式（必须加 `es.` 前缀，与 MongoDB 的 `mongo.` 规律一致）
> - `ensure_datasource` 调用示例：`ensure_datasource(session, name="ES数据源", db_type="es", db_driver="/", db_url="192.168.1.6:9200", db_username="elastic", db_password="xxx")`

### 其他

| dbType | label | 默认 dbDriver | 默认 dbUrl |
|--------|-------|---------------|-----------|
| other | 其他数据库 | _(空，用户必须自行填写)_ | _(空，用户必须自行填写)_ |

---

## 创建/更新数据源操作流程

> **核心原则：先查重 → 再测试连接 → 最后保存。失败重试时走更新（传 id），禁止重复创建。**

### 流程步骤

```
0. 查重（防止重复创建）
   GET /jmreport/getDataSourceByPage?token=xxx&pageNo=1&pageSize=100
   ├── 按 name 匹配是否已存在同名数据源
   ├── 已存在 → 取其 id，走编辑模式（步骤 4 传 id）
   └── 不存在 → 走新增模式（步骤 4 id 为空）

1. 收集参数
   ├── 用户提供：name、dbType、dbUrl（可选）、dbUsername、dbPassword
   ├── 未提供 dbDriver/dbUrl → 根据 dbType 从「默认配置表」自动填充
   └── dbType 为 other → 用户必须提供 dbDriver 和 dbUrl

2. 调用测试连接接口
   POST /jmreport/testConnection
   {
       "dbType": "...",
       "dbDriver": "...",
       "dbUrl": "...",
       "dbUsername": "...",
       "dbPassword": "..."
   }

3. 判断测试结果
   ├── success: true → 进入步骤 4，直接保存
   └── success: false → 停止，向用户反馈：
       ├── 展示返回的 message（错误原因）
       ├── 分析可能原因（地址不对、端口不通、用户名密码错误、数据库不存在等）
       └── 提示用户需要补充或修正哪些信息

4. 调用保存接口
   POST /jmreport/addDataSource
   {
       "id": "已有id或空",  ← 编辑传已有 id，新增为空
       "reportId": "...",
       "code": "",
       "name": "...",
       "dbType": "...",
       "dbDriver": "...",
       "dbUrl": "...",
       "dbUsername": "...",
       "dbPassword": "..."
   }

5. 确认保存结果
   └── success: true → 完成，告知用户数据源已保存
```

> **重要：失败重试规则**
> - 创建数据源失败后重试，必须先查询是否已创建成功（按 name 查 getDataSourceByPage），已存在则传 id 走更新
> - 创建报表失败后重试，必须用同一 report_id 调用 save（save 传同一 id 即为更新）
> - **禁止**每次重试都生成新 id 或不传 id，否则会产生大量重复记录

### 常见连接失败原因及提示

| 场景 | 可能原因 | 应提示用户提供 |
|------|---------|--------------|
| 连接超时 | IP/端口不可达 | 确认数据库服务器地址和端口 |
| 认证失败 | 用户名或密码错误 | 正确的 dbUsername 和 dbPassword |
| 数据库不存在 | dbUrl 中的库名不对 | 确认数据库名称 |
| 驱动类找不到 | 服务端未引入对应驱动包 | 确认服务端是否支持该数据库类型 |
| URL 格式错误 | dbUrl 拼写/参数有误 | 确认完整的 JDBC 连接地址 |

---

## 数据集绑定数据源流程

> **场景：** 用户指定了数据源名称（如"用mysql数据源"），需要将数据源 id 绑定到数据集的 `dbSource` 字段。

### 流程步骤

```
1. 查询数据源列表
   GET /jmreport/initDataSource?token=xxx
   └── 返回所有可用数据源（含 id、name）

2. 按名称匹配
   ├── 找到匹配项 → 取其 id
   └── 未找到 → 提示用户可用的数据源列表，让用户重新选择

3. 绑定到数据集
   在数据集保存时，将匹配到的数据源 id 赋值给 dbSource 字段
   例如：
   {
       "dbCode": "db_demo",
       "dbSource": "1161942757348524032",  ← 数据源 id
       "dbType": "sql",
       "selectSql": "select * from demo"
   }
```

### 注意事项

- `dbSource` 存的是数据源的 **id**，不是 name
- 未指定数据源时 dbSource 为空，表示使用当前服务默认数据源
- 用户只说了数据源名称时，必须先通过 initDataSource 查到对应 id 再绑定

---

## Redis 数据集使用说明

> **核心：Redis 数据集本质上使用 SQL 数据集（dbType="0"），只是 dbSource 指向 Redis 数据源，dbDynSql 填写 Redis 的 key 名。**
>
> 参考文档：https://help.jimureport.com/dataSet/redis

### 使用流程

```
1. 添加 Redis 数据源
   POST /jmreport/addDataSource
   {
       "name": "my-redis",
       "dbType": "redis",
       "dbUrl": "127.0.0.1:6379",
       "dbUsername": "",
       "dbPassword": ""
   }

2. 创建数据集时，使用 SQL 数据集类型
   - dbType: "0"（SQL 数据集，不是 "redis"）
   - dbSource: Redis 数据源的 id
   - dbDynSql: 直接填 Redis 的 key 名（如 "json_demo"）

3. 调用 queryFieldBySql 解析字段
   POST /jmreport/queryFieldBySql
   {
       "sql": "json_demo",          ← Redis key 名
       "dbSource": "redis数据源id",  ← Redis 数据源 id
       "type": "0"
   }

4. saveDb 保存数据集
   {
       "dbType": "0",
       "dbSource": "redis数据源id",
       "dbDynSql": "json_demo",     ← Redis key 名
       "fieldList": [...],
       "paramList": []
   }
```

### 注意事项

- Redis 数据集**不使用** dbType="redis"，而是 dbType="0"（SQL 数据集）
- dbType="redis" 仅用于**数据源连接**（addDataSource），不用于数据集（saveDb）
- dbDynSql 中填写的是 Redis 的 key 名称，不是 SQL 语句
- Redis 中存储的数据必须是 JSON 格式，系统通过解析 JSON 结构自动识别字段
- 解析和保存流程与普通 SQL 数据集完全一致，只是 dbSource 指向 Redis 数据源
- **⚠️ Redis JSON 字段名必须全小写**：JimuReport 读取 Redis JSON 时将所有字段名强制转为小写，存入 Redis 的 JSON key、`fieldList` 的 `fieldName`、以及单元格绑定 `#{db.fieldName}` 三处必须统一使用全小写（如 `productname`）。驼峰命名（如 `productName`）会导致该列数据全部为空，而其他全小写字段正常显示。
- **⚠️ Redis 中存储的 JSON 必须是裸数组 `[{...},{...}]`**，**不能**用 `{"data":[...]}` 包裹（与 JSON 数据集规则相反）。包裹后 `queryFieldBySql` 报 "执行成功，但是数据为空，无法解析报表字段！"。实测：`SET orderinfo '[{...}]'` 可以正常解析；`SET orderinfo '{"data":[{...}]}'` 解析失败。

---

## MongoDB 数据集使用说明

> **核心：MongoDB 数据集同样使用 SQL 数据集（dbType="0"），dbSource 指向 MongoDB 数据源。推荐使用第二种方式（SQL 语法 + `mongo.` 前缀）。**
>
> 参考文档：https://help.jimureport.com/dataSet/mongo

### MongoDB 数据源配置

```
# 方式一：标准配置
dbUrl: 127.0.0.1:27017/test
dbUsername: admin
dbPassword: 123456

# 方式二：连接串配置（推荐，无需单独填用户名密码）
dbUrl: mongodb://admin:123456@127.0.0.1:27017/?authSource=test
dbUsername: （空）
dbPassword: （空）
```

### 两种查询方式

#### 方式一：MongoDB 原生查询语法

在 dbDynSql 中使用 `db.getCollection` 语法：

```javascript
// 基础查询
db.getCollection('user').find({})

// 条件查询
db.getCollection('user').find({name: '张三'})

// 模糊查询 + 条件
db.getCollection('user').find({name: /张/, age:{$gt:10}})

// 分页
db.getCollection('user').find({name: /张/}).limit(1)

// 排序
db.getCollection('user').find({name: /张/}).sort({age:-1})

// 排除 _id 字段
db.getCollection('design_form_list_view').find({}, {_id: 0})

// 只返回指定字段
db.getCollection('design_form_list_view').find({}, {'desform_code':1,'name':1})

// 带参数
db.getCollection('user').find({ name:${name}})
```

#### 方式二：SQL 语法 + `mongo.` 前缀（v1.9.2+，推荐）

> **推荐使用此方式。** 表名加 `mongo.` 前缀即可用标准 SQL 查询 MongoDB，支持分页、关联、分组、排序。

```sql
-- 基础查询
select * from mongo.user

-- 条件查询
select * from mongo.user where name = '${name}'

-- 分组统计
select category, count(*) as cnt from mongo.products group by category

-- 排序
select * from mongo.user order by age desc

-- 关联查询
select a.name, b.order_no from mongo.user a left join mongo.orders b on a.id = b.user_id
```

### 使用流程

```
1. 添加 MongoDB 数据源
   POST /jmreport/addDataSource
   {
       "name": "my-mongo",
       "dbType": "mongodb",
       "dbUrl": "mongodb://admin:123456@127.0.0.1:27017/?authSource=test",
       "dbUsername": "",
       "dbPassword": ""
   }

2. 创建数据集 — 使用 SQL 数据集类型
   - dbType: "0"（SQL 数据集）
   - dbSource: MongoDB 数据源的 id
   - dbDynSql: "select * from mongo.表名"（推荐方式二）

3. 调用 queryFieldBySql 解析字段
   POST /jmreport/queryFieldBySql
   {
       "sql": "select * from mongo.user",
       "dbSource": "mongo数据源id",
       "type": "0"
   }

4. saveDb 保存数据集（同普通 SQL 数据集）
```

### 注意事项

- MongoDB 数据集与 Redis 一样，**数据集 dbType 用 "0"（SQL）**，不是 "mongodb"
- `dbType: "mongodb"` 仅用于数据源连接（addDataSource）
- 推荐使用方式二（`mongo.` 前缀 SQL），语法更熟悉、支持更丰富（JOIN、GROUP BY 等）
- 方式二需要 JimuReport **v1.9.2+** 版本支持
- 带参数时与普通 SQL 一样使用 `${}` 占位符，解析时需替换默认值
- **自动补全规则：** 如果用户只提供了 MongoDB 集合名称（如 `user`），自动加上 `mongo.` 前缀生成 SQL：`select * from mongo.user`。不要让用户手动加前缀。
- **字段名含 `-` 必须过滤（会导致 FreeMarker 报错）：** MongoDB 返回的字段名可能含 `-`（如 `auto-number_xxx`、`file-upload_xxx`、`link-record_xxx`），**绝对不能**绑定到报表单元格中。原因：`#{cai_gou_dan.auto-number_xxx}` 会被 FreeMarker 解析为 `cai_gou_dan.auto` 减去 `number_xxx`，抛出 `NonNumericalException`/`InvalidReferenceException`。解析字段后必须：
  1. 从 fieldList 中删除所有 fieldName 含 `-` 或以 `_` 开头的字段
  2. 这些字段不绑定到报表 rows 中
  3. 不影响 SQL（仍用 `select *`），只是报表不显示这些字段
- **`mongo.` SQL 语法要求：** 数据源必须单独填写 dbUsername 和 dbPassword（不能用连接串方式内嵌账号密码），否则解析失败（`Failed to parse DataSourceConfig`）。如果用户使用连接串方式（`mongodb://user:pass@host`），自动降级为原生语法 `db.getCollection('集合名').find({})`
- 同时 `mongo.` SQL 语法需要 JimuReport **v1.9.2+** 版本支持

### MongoDB 踩坑记录（实战总结）

> 以下是实际创建 MongoDB 报表时遇到的问题，按严重程度排列。

#### 坑1：dbSource 传了数据源名称而不是 ID

**现象：** 数据集保存成功，但设计器中数据源下拉框不显示关联，预览时查不到数据。

**原因：** `saveDb` 的 `dbSource` 字段传了 `"mongodb"`（名称），而不是 `"1199218436288897024"`（ID）。API 不报错但无法正确关联。

**正确做法：**
```python
# 先查询数据源ID
ds_resp = api('/jmreport/getDataSourceByPage')
records = ds_resp['result']['records']
ds_id = next(r['id'] for r in records if r['name'] == 'mongodb')

# saveDb 时传 ID
{"dbSource": ds_id}  # ✅ "1199218436288897024"
{"dbSource": "mongodb"}  # ❌ 不会报错但不关联
```

#### 坑2：缺少 `mongo.` 前缀

**现象：** `queryFieldBySql` 返回 500 NPE 错误。

**原因：** SQL 写成 `select * from cai_gou_dan`，缺少 `mongo.` schema 前缀。

**正确做法：** `select * from mongo.cai_gou_dan`

#### 坑3：字段名含连字符 `-` 导致 FreeMarker 报错

**现象：** 预览报错 `Failed at: ${cai_gou_dan.auto - number_167171031...`

**原因：** MongoDB 集合字段名如 `auto-number_1671710310317_206584` 含有 `-`，FreeMarker 将 `-` 解析为减法运算符，导致 `cai_gou_dan.auto`（null）减去 `number_xxx`（未定义变量），抛出 `NonNumericalException`。

**正确做法：** 解析字段后过滤：
```python
def is_safe_field(fname):
    if '-' in fname: return False       # 连字符会被FreeMarker当减号
    if fname.startswith('_'): return False  # 下划线开头的系统字段
    return True

safe_fields = [f for f in field_list if is_safe_field(f['fieldName'])]
# 只用 safe_fields 保存到数据集和绑定到报表
```

#### 坑5：dbUrl 不解析 query string

**现象：** dbUrl 写 `host:port/db?authSource=admin`，预览报 `Exception authenticating ... source='db?authSource=admin'`（整段被当 authSource）。

**解决：** 用 admin 库 root 帐号给目标库建同名用户：`admin_client[target_db].command('createUser', name, pwd=pwd, roles=[{'role':'readWrite','db':target_db}])`，之后 dbUrl 用纯 `host:port/target_db` 即可。或改连接串方式 `mongodb://user:pwd@host:port/?authSource=admin`（dbUsername/dbPassword 留空，但此路径下 `mongo.SQL` 失效，须用原生语法）。

#### 坑6：mongo.SQL 报 NoSuchMethodError listCollectionNames

**现象：** `select * from mongo.xxx` 报 `NoSuchMethodError: 'MongoIterable MongoDatabase.listCollectionNames()'`，根因是服务端 mongo-java-driver 与 calcite-mongodb 版本不匹配。

**解决：** 脚本必须 try `mongo.SQL` → except 自动降级到 `db.getCollection('xx').find({})`，**save_db 的 dbDynSql 也要传降级后的 sql**（与解析时保持一致）。

#### 坑4：queryFieldBySql 脚本调用失败但 UI 正常

**现象：** 通过 Python 脚本调用 `queryFieldBySql`（传 `dbSource: "mongodb"` 名称）返回 500 NPE，但在设计器 UI 中同样的 SQL 解析成功。

**原因：** UI 传的 `dbSource` 是数据源 **ID**，脚本传的是名称。签名计算基于参数值，参数值不同导致服务端走了不同的代码路径。

**正确做法：** `dbSource` 始终传数据源 ID，与 UI 行为保持一致。

---

## 数据源 CRUD 操作实战示例

> **通用规则：有多个同名数据源时，取 id 最大的（雪花ID越大越新）。**

### 修改数据源名称

```python
# 1. 按 name 查找数据源
list_r = api_request(f'/jmreport/getDataSourceByPage?token={TOKEN}&pageNo=1&pageSize=100')
matched = [r for r in list_r['result']['records'] if r.get('name') == '原名称']

# 2. 多条时取最新的（id最大）
target = max(matched, key=lambda x: x['id'])

# 3. 获取完整详情（分页查询不含连接信息）
detail = api_request(f'/jmreport/getDataSourceById?id={target["id"]}')['result']

# 4. 修改名称并保存（传 id = 编辑模式）
api_request('/jmreport/addDataSource', {
    "id": detail['id'],           # 传 id → 编辑
    "reportId": detail.get('reportId', ''),
    "code": detail.get('code', ''),
    "name": "新名称",              # 修改的字段
    "dbType": detail['dbType'],
    "dbDriver": detail['dbDriver'],
    "dbUrl": detail['dbUrl'],
    "dbUsername": detail['dbUsername'],
    "dbPassword": detail['dbPassword']
})
```

### 删除数据源

```python
# 1. 按 name 查找
list_r = api_request(f'/jmreport/getDataSourceByPage?token={TOKEN}&pageNo=1&pageSize=100')
matched = [r for r in list_r['result']['records'] if r.get('name') == '目标名称']

# 2. 多条时取最新的
target = max(matched, key=lambda x: x['id'])

# 3. 删除
api_request('/jmreport/delDataSource', {"id": target['id']})
```

### 创建数据源（含查重）

```python
# 1. 先查重
list_r = api_request(f'/jmreport/getDataSourceByPage?token={TOKEN}&pageNo=1&pageSize=100')
matched = [r for r in list_r['result']['records'] if r.get('name') == '数据源名称']

if matched:
    # 已存在 → 走编辑模式
    existing_id = max(matched, key=lambda x: x['id'])['id']
else:
    existing_id = ""

# 2. 测试连接
test_r = api_request('/jmreport/testConnection', {
    "dbType": "MYSQL5.7", "dbDriver": "com.mysql.cj.jdbc.Driver",
    "dbUrl": "jdbc:mysql://...", "dbUsername": "root", "dbPassword": "123456"
})

# 3. 保存（id 有值=更新，空=新增）
api_request('/jmreport/addDataSource', {
    "id": existing_id,
    "reportId": "", "code": "",
    "name": "数据源名称", "dbType": "MYSQL5.7",
    "dbDriver": "com.mysql.cj.jdbc.Driver",
    "dbUrl": "jdbc:mysql://...",
    "dbUsername": "root", "dbPassword": "123456"
})
```

### getDataSourceByPage 签名注意

> `getDataSourceByPage` 是需要签名的 GET 接口。签名时必须用 URL 中的查询参数（token、pageNo、pageSize）计算签名，不能传空 dict。

```python
# GET 请求签名：从 URL query 参数中提取签名参数
if '?' in path:
    sign_params = {}
    for param in path.split('?', 1)[1].split('&'):
        k, v = param.split('=', 1)
        sign_params[k] = v
    headers['X-Sign'] = compute_sign(sign_params)
```

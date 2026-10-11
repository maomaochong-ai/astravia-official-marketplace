> 属于「数据集进阶」拆分组（§4），索引见 `references/dataset-advanced.md`

# 数据集进阶：文件数据集

## 前置：用户未提供文件时自动创建

用户未给文件路径时，根据其描述的字段和数据自动创建文件，再走上传流程。

**完整流程**：理解用户数据需求 → 创建文件 → 上传 → 创建文件数据集 → 获取 dbCode → 构建报表

**文件格式选择**（无偏好时优先 JSON，不需要第三方库）：

| 格式 | 适用场景 |
|------|---------|
| JSON | 默认选择，`json` 标准库直接写，无依赖 |
| CSV | 用户明确要求或数据量大 |
| Excel | 用户明确要求 Excel，使用 `openpyxl`（`pip install openpyxl`） |

**标题行命名约束**：只允许字母、汉字、数字、下划线，**不支持空格/短横线/括号等特殊字符**。

---

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

创建后需通过 field/tree 获取后端生成的 dbCode。

**⚠️ 单文件数据集（dbType=6）children 字段结构与 SQL 数据集不同：**
- 没有 `fieldName` key（用 SQL 数据集习惯写 `child['fieldName']` 会 KeyError）
- 绑定名取 `child['title']`（拼音，如 `xing_ming`）
- 中文显示名取 `child['fieldText']`（如 `姓名`）
- 绑定写法：`#{file_yuan_gong_xin_xi.xing_ming}`

```python
tree = session.get(f'/field/tree/{report_id}')
db_code = None
field_names = []   # 拼音，用于 #{dbCode.xxx} 绑定
field_texts = []   # 中文，用于表头显示

for group in tree.get('result', []):
    items = group if isinstance(group, list) else [group]
    for item in items:
        if str(item.get('type', '')) == '6':  # 单文件数据集
            db_code = item['code']
            for child in item.get('children', []):
                field_names.append(child['title'])               # ✅ 用 title，不是 fieldName
                field_texts.append(child.get('fieldText', child['title']))
            break
    if db_code:
        break

# 绑定示例：f"#{{{db_code}.{field_names[0]}}}"  →  #{file_yuan_gong_xin_xi.xing_ming}
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

多个文件需要**一个一个上传**，每次调用 `/files/add`（`isSingle=true`，与单文件相同），`dbUrl` 会自动累积：

> **推荐用 `session.upload()`**（比手写 multipart 更简洁，且自动带 token header）：
> ```python
> import mimetypes
> fname = os.path.basename(fpath)
> ctype = mimetypes.guess_type(fname)[0] or 'application/octet-stream'
> with open(fpath, 'rb') as f:
>     content = f.read()
> result = session.upload(
>     "/source/datasource/files/add",
>     files={"file": (fname, content, ctype)},
>     params={"reportId": report_id, "isSingle": "true"}
> )
> ```

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

### 4.1.2 中文列名 WHERE 条件不能加引号（FreeMarker 双引号转义问题）

**现象：** 预览报错：
```
parse failed: Encountered "\" at line 2, column 11
```
实际执行 SQL 变成：`CAST('商户id' AS VARCHAR) = 'M002'`（列名被单引号包裹）

**根因：** FreeMarker 模板引擎把 `"列名"` 中的双引号转换为单引号，Calcite 把单引号内容识别为字符串字面量而非列名，导致解析失败。

**解决方案：** WHERE 条件用**裸列名**，不加任何引号，不加 CAST（中文列名在 Calcite 中可直接使用）：

```sql
-- ✅ 正确：裸列名，无引号，无 CAST
SELECT * FROM jmf.订单明细_detail_excel WHERE 1=1
<#if isNotEmpty(merchant_id)> AND 商户id = '${merchant_id}'</#if>

-- ❌ 错误：双引号被 FreeMarker 转单引号，Calcite 解析失败
<#if isNotEmpty(merchant_id)> AND CAST("商户id" AS VARCHAR) = '${merchant_id}'</#if>
```

**适用范围：** 所有含中文字符的列名。CAST 仅用于纯数字列（§4.1.1），含字母的字符串列（如 M001、ABC）无需 CAST。

---

### 4.1.3 多源报表 linkType=4 的 mainField 必须用 fieldNamePhysics

**现象：** 预览报错：
```
Cannot invoke "Object.toString()" because the return value of "java.util.Map.get(Object)" is null
at TableMultiDsRenderStrategy.java:147
```

**根因：** Calcite 把 Excel 列名统一规范化为**小写**（如 `商户ID` → `商户id`），`TableMultiDsRenderStrategy` 在渲染多源联动时以 `fieldNamePhysics`（Calcite 物理列名）作为 data row map 的 key。若 `mainField` 填写的是拼音 `fieldName`（如 `shang_huid`），`map.get()` 返回 null 导致 NPE。

**解决方案：** `mainField` 必须填 `fieldNamePhysics`，可从 `queryFieldBySql` 返回值中读取：

```python
# 解析字段，找到关联字段的 fieldNamePhysics
r = session.request("/queryFieldBySql", {"sql": sql, "dbSource": ds_id, "type": "0"})
id_field_phys = next(
    f["fieldNamePhysics"] for f in r["result"]["fieldList"]
    if "商户id" in f["fieldNamePhysics"].lower()
)
# id_field_phys = "商户id"（Calcite 小写化后的物理列名）

parameter = json.dumps({
    "main": "merchant",
    "sub": "order_detail",
    "subReport": [{"mainField": id_field_phys, "subParam": "merchant_id", "tableIndex": 1}]
})
# ✅ mainField = "商户id"（fieldNamePhysics）
# ❌ mainField = "shang_huid"（fieldName 拼音，渲染引擎找不到）
```

---

### 4.1.4 修复 fieldList 时必须重新 queryFieldBySql，不能依赖 loadDbData 回读

**现象：** 设计器中数据集「字段名」列全空，patch 脚本更新 SQL 后字段依然为空。

**根因：** 若初次 saveDb 二步保存未生效，`loadDbData` 返回的 `fieldList` 本身就是空列表。直接取回再回存只是把空列表存回去，问题持续存在。

**解决方案：** 任何修复 fieldList 的 patch，必须重新调用 `queryFieldBySql` 解析字段：

```python
# ✅ 正确：重新解析字段
fl = parse_fields(f"SELECT * FROM {table_name}")   # 重新 queryFieldBySql
db_cfg = session.get(f"/loadDbData/{db_id}")["result"]["reportDb"]
db_cfg["fieldList"] = fl          # 用新解析的字段覆盖
db_cfg["dbDynSql"]  = new_sql
session.request("/saveDb", db_cfg)  # 第一步
session.request("/saveDb", db_cfg)  # 第二步：才真正持久化

# ❌ 错误：loadDbData 的 fieldList 可能本身就是空的
db_cfg = session.get(f"/loadDbData/{db_id}")["result"]["reportDb"]
db_cfg["dbDynSql"] = new_sql
session.request("/saveDb", db_cfg)  # fieldList 依然空
```

### 4.1.5 CSV 文件编码不能用 utf-8-sig（BOM）

**现象：** `queryFieldBySql` 报错 `Column 'id' not found in table 'a'`，SQL 语法本身正确。

**根因：** Python `open(path, encoding='utf-8-sig')` 写出的 CSV 首行带 BOM（`﻿`）。Calcite 读取时把 BOM 附加在第一列名前，实际列名变成 `﻿id` 而非 `id`，SQL 中 `a.id` 找不到。

**解决方案：** 程序生成供 Calcite 读取的 CSV，**始终用 `encoding='utf-8'`（无 BOM）**：

```python
# ✅ 正确
with open(csv_path, 'w', newline='', encoding='utf-8') as f:
    csv.writer(f).writerows(data)

# ❌ 错误：utf-8-sig 带 BOM，第一列名变成 '﻿id'
with open(csv_path, 'w', newline='', encoding='utf-8-sig') as f:
    csv.writer(f).writerows(data)
```

> `utf-8-sig` 只适用于给 Excel 直接打开的 CSV，不适用于 Calcite/JimuReport 文件数据集。

---

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

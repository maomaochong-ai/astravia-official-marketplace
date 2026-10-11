> 属于「数据集进阶」拆分组（§1~3），索引见 `references/dataset-advanced.md`

# 数据集进阶：数据源管理 + JavaBean数据集 + 查询已有数据集

数据源管理、JavaBean数据集、查询已有数据集。

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

## 数据源 CRUD 操作实战示例

> **通用规则：有多个同名数据源时，取 id 最大的（雪花ID越大越新）。**

### 修改数据源名称

> **必读**：`/getDataSourceByPage` 在 `SIGNED_PATHS` 中需要签名。用封装的 `Session.request` 时**必须把分页参数作为 data dict 传入**（让签名机制生效），**不能**把参数拼在 path 里。
> `/initDataSource` 是免签名简版，**只返回 `id+name`**——重命名/改密码场景拿不到 `dbUrl/dbUsername/dbPassword`，必须走 `/getDataSourceByPage`。

```python
from jimureport_utils import Session
session = Session(BASE_URL, TOKEN)

# 1. 分页查询（必须用 method='GET' + data dict，触发签名）
list_r = session.request('/getDataSourceByPage',
                         {'pageNo': 1, 'pageSize': 100}, method='GET')
records = list_r['result'].get('records') or list_r['result']
matched = [r for r in records if r.get('name') == '原名称']

# 2. 多条同名取最新的（id最大）
target = max(matched, key=lambda x: x['id'])

# 3. 修改名称并保存（POST /addDataSource，传 id = 编辑模式）
session.request('/addDataSource', {
    "id":         target['id'],                    # 传 id → 编辑
    "reportId":   target.get('reportId', '') or '',
    "code":       target.get('code', '') or '',
    "name":       "新名称",                          # 修改的字段
    "dbType":     target['dbType'],
    "dbDriver":   target.get('dbDriver', '') or '',
    "dbUrl":      target['dbUrl'],
    "dbUsername": target['dbUsername'],
    "dbPassword": target['dbPassword'],
})
```

**禁止写法**（会反复报"签名验证失败：签名参数不存在"或 405）：
```python
# ❌ 把参数拼在 path 里 → Session.request data=None → 跳过签名
session.get('/getDataSourceByPage?pageNo=1&pageSize=100')

# ❌ 用 POST → 接口只支持 GET，405 Method Not Allowed
session.request('/getDataSourceByPage', {'pageNo': 1}, method='POST')
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

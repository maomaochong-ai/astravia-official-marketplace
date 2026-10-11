# 数据集核心参考（高频）

SQL数据集、API数据集、JSON数据集、保存/修改数据集的完整参考。签名机制详见 jimureport_utils.py。

---

## 1. 需要签名的接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/jmreport/queryFieldBySql` | POST | SQL解析获取字段 |
| `/jmreport/executeSelectApi` | POST | API数据集解析 |
| `/jmreport/loadTableData` | POST | 加载表数据 |
| `/jmreport/testConnection` | POST | 测试数据源连接 |
| `/jmreport/download/image` | GET | 下载图片 |
| `/jmreport/dictCodeSearch` | GET | 字典编码搜索 |
| `/jmreport/getDataSourceByPage` | GET | 分页查询数据源 |
| `/jmreport/getDataSourceById` | GET | 按ID查询数据源 |

不需要签名的接口：`/jmreport/save`、`/jmreport/saveDb`、`/jmreport/get/{id}`、`/jmreport/field/tree/{reportId}`、`/jmreport/loadDbData/{dbId}`、`/jmreport/source/getJmReportSharedDbPageList`、`/jmreport/source/linkJmReportShareDb`、`/jmreport/source/delShareDbByDbId`

---

## 2. SQL数据集

### SQL语句用法

- 参数：`select * from table where id='${id}'`
- 系统变量：`select * from table where create_by='#{sysUserCode}'`
- 存储过程：`CALL proc_sys_role(${pageNo}, ${pageSize})`

### 存储过程数据集

存储过程使用 **SQL 数据集（dbType="0"）**，SQL 语句以 `CALL` 开头。

**基本语法：**
```sql
CALL 存储过程名(参数1, 参数2, ...)
```

**参数写法：**
- 字符串参数需要单引号包围：`CALL jmdemo('${name}')`
- 数值参数无需引号：`CALL proc_page(${pageNo}, ${pageSize})`
- 多个参数用逗号分隔

**Oracle 存储过程（需输出游标）：**

Oracle 存储过程需要 `sys_refcursor` 输出游标，`?` 占位符放在括号最后：
```sql
CALL jmtest('${sex}', ?)
```

对应 Oracle 存储过程定义：
```sql
CREATE OR REPLACE procedure jmtest(
  xb in VARCHAR2,
  out_result_cursor out sys_refcursor
) is
begin
  open out_result_cursor for
    select ID, NAME, SEX from demo where SEX = xb;
end;
```

**API 调用步骤（以 `CALL jmdemo('${nameStr}')` 为例）：**

```
Step 1: save(空报表)          → 获取 report_id
Step 2: queryFieldBySql       → 解析存储过程字段（关键：必须用具体值替换参数）
Step 3: saveDb                → 保存数据集（SQL 写回原始参数化语句）
Step 4: save(完整设计)        → 保存报表 jsonStr
```

**Step 2 关键：参数必须用具体值替换后才能解析**

存储过程的 `${param}` 参数在 `queryFieldBySql` 中无法自动解析。必须将参数替换为具体值，用硬编码 SQL 调用解析接口：

```python
# ❌ 错误：带 ${} 参数直接解析 → 返回 code:1001 "结果为空"
parse_result = api_request('/jmreport/queryFieldBySql', {
    "sql": "CALL jmdemo('${nameStr}')", "dbSource": "", "type": "0"
})  # → success=False, code=1001

# ✅ 正确：用具体值替换参数后解析
parse_result = api_request('/jmreport/queryFieldBySql', {
    "sql": "CALL jmdemo('张三')", "dbSource": "", "type": "0"
})  # → success=True, 返回 fieldList
```

> **注意：** 空字符串 `''` 可能导致存储过程返回空结果集，同样报 1001。建议用能返回数据的测试值（如 `'张三'`、`'%'` 等）。如果不确定用什么值，可以依次尝试多个：

```python
for test_val in ['%', 'test', '张三', '']:
    result = api_request('/jmreport/queryFieldBySql', {
        "sql": f"CALL jmdemo('{test_val}')", "dbSource": "", "type": "0"
    })
    if result['success'] and result.get('result'):
        field_list = result['result']['fieldList']
        break
```

**Step 3：saveDb 时写回原始参数化 SQL**

解析用具体值，但保存数据集时 `dbDynSql` 必须写回带 `${}` 的原始语句：

```python
db_data = {
    "dbType": "0",
    "dbCode": "emp",
    "dbDynSql": "CALL jmdemo('${nameStr}')",  # ← 原始参数化 SQL
    "fieldList": field_list,                    # ← Step 2 解析得到的
    "paramList": [{
        "paramName": "nameStr",
        "paramTxt": "名称",
        "paramValue": "",
        "searchMode": 1,
        "widgetType": "String"
    }],
    "isPage": "1",
    "isList": "1",
    ...
}
```

**code:1001 排查：**

| 现象 | 原因 | 解决方案 |
|------|------|---------|
| 所有 SQL 都返回 1001 | 签名计算错误 | 先用 `select 1 as t` 验证签名 |
| 仅存储过程返回 1001 | `${param}` 未替换，参数无值 | 用具体值硬编码 SQL 再解析 |
| 硬编码具体值仍返回 1001 | 存储过程不存在或返回空结果集 | 检查存储过程是否存在，换一个能返回数据的测试值 |

**注意事项：**
- Oracle 的 `?` 游标参数必须放在所有输入参数之后
- 存储过程的字段列表由 `queryFieldBySql` 自动解析返回
- 数值参数无需引号：`CALL proc_page(${pageNo}, ${pageSize})`

参考文档：https://help.jimureport.com/dataSet/storedProcedure

### SQL解析接口

`POST /jmreport/queryFieldBySql`（需签名）

```json
{"sql": "select * from demo", "type": "0", "dbSource": ""}
```

返回：`result.fieldList[]` 每项含 `fieldName`, `fieldText`, `widgetType`, `orderNum`

---

## 3. API数据集

### 3.1 解析接口

`POST /jmreport/executeSelectApi`（需签名）

```json
{"api": "http://localhost:8085/jimureport/test/getList?pid=&name=", "method": "0"}
```

API路径支持：`#{domainURL}/jimureport/test/getList`

### 3.2 saveDb 字段要求

> **重要：API 数据集（dbType="1"）必须同时设置 `apiUrl`、`apiMethod` 和 `dbDynSql` 三个字段。**
>
> - `apiUrl`：API 地址 — **设计器 UI 读取此字段**显示在「Api地址」输入框
> - `apiMethod`：请求方式 `"0"`=GET, `"1"`=POST — **设计器 UI 读取此字段**显示在「请求方式」下拉框
> - `dbDynSql`：也填 API 地址 — **后端数据拉取引擎读取此字段**执行请求
>
> 仅设 `dbDynSql` 而不设 `apiUrl`/`apiMethod`，后端能拉到数据，但设计器 UI 中「Api地址」和「请求方式」显示为空。

```python
# 正确：三个字段都设置
api_request('/jmreport/saveDb', {
    "jimuReportId": report_id,
    "dbCode": "emp", "dbChName": "员工信息",
    "dbType": "1",              # API 数据集
    "dbDynSql": api_url,        # 后端拉取数据用
    "apiUrl": api_url,          # 设计器 UI 显示用
    "apiMethod": "0",           # "0"=GET, "1"=POST
    "isList": "1", "isPage": "0",
    "dbSource": "", "jsonData": "", "apiConvert": "",
    "fieldList": field_list,
    "paramList": []
})
```

### 3.2.1 分页 API 数据集的参数配置

**规则：API 支持哪些参数就在 URL 和 paramList 里加哪些，不需要的不加。**

分页接口（`isPage="1"`）：
- `api_url` 末尾附加 `?pageSize=&pageNo=`（占位，引擎运行时自动填值）
- `param_list` 加两条 `searchFlag=0` 的分页参数

```python
# 分页 API 数据集
save_db(session,
    api_url  = "http://api.example.com/list?pageSize='${pageSize}'&pageNo='${pageNo}'",  # URL 带占位，格式固定
    is_page  = "1",
    param_list = [
        {"paramName": "pageSize", "paramValue": "20", "orderNum": 1,  # 默认值必填
         "searchFlag": 0, "widgetType": None, "searchMode": None,
         "dictCode": "", "searchFormat": None, "extJson": ""},
        {"paramName": "pageNo",   "paramValue": "1",  "orderNum": 2,  # 默认值必填
         "searchFlag": 0, "widgetType": None, "searchMode": None,
         "dictCode": "", "searchFormat": None, "extJson": ""},
    ],
)

# 非分页 API 数据集（URL 无需分页参数）
save_db(session,
    api_url  = "http://api.example.com/list",
    is_page  = "0",
    param_list = [],
)
```

> `searchFlag=0`：系统内部参数，不会显示为用户查询控件；`searchFlag=1`：显示为页面查询条件。

### 3.2.2 API 数据集接收查询条件参数

> **⚠️ 有 `paramList` 时必须同步处理 apiUrl，否则参数传不进去：**
> - 联动 / 钻取传参 → **方式一**：`api_url` 末尾加 `?paramName=${paramName}`
> - 页面查询控件 → **方式二**：`fieldList` 里对应字段设 `searchFlag=1`
>
> 两者任选其一，漏掉则参数无效。

SQL 数据集可以在语句里写 FreeMarker 条件（`<#if isNotEmpty(x)> AND x='${x}'</#if>`）实现过滤；API 数据集没有这个机制，有以下两种方式传递查询条件参数：

---

**方式一：在 URL 末尾拼 `${paramName}` 占位符**（显式，适合钻取传参 / 地址栏传参）

```python
# apiUrl 和 dbDynSql 都写含占位符的完整 URL
api_url = "https://api.example.com/list?category=${category}"

save_db(session, report_id, "db_code", "数据集名称",
        api_url, field_list,
        [{"paramName": "category", "paramTxt": "类别", "paramValue": "",
          "widgetType": "String", "orderNum": 1, "searchFlag": 1, "searchMode": 1}],
        db_type="1", api_url=api_url, api_method="0",
        is_list="1", is_page="1")
```

- 引擎请求前将 `${category}` 替换为实际值后拼入 URL
- `paramList` 中的 `paramName` 必须与 URL 占位符名称完全一致
- 多参数：`?a=${a}&b=${b}`，顺序不限；单引号可选（`?x='${x}'`）

---

**方式二：在「报表字段明细」中开启字段的「查询」checkbox**（`searchFlag=1`，适合页面查询控件过滤）

在数据集设计器的 **「报表字段明细」tab** 中，将需要过滤的字段的「查询」列勾选（✓）。jimureport 会将该字段自动注册为查询条件，用户在报表预览中输入值并点击查询时，系统自动将字段值作为 query param 传入 API 请求。

```python
# URL 不需要手动拼 ${category}，设置字段 searchFlag=1 即可
api_url = "https://api.example.com/list"

field_list = [
    ...,
    # 在 fieldList 中将 category 字段的 searchFlag 设为 1
    {"fieldName": "category", "fieldText": "类别", "widgetType": "String",
     "orderNum": 4, "tableIndex": 0, "extJson": "", "dictCode": "",
     "searchFlag": 1, "searchMode": 1},   # ← 开启查询，等价于勾选「查询」checkbox
]

save_db(session, report_id, "db_code", "数据集名称",
        api_url, field_list,
        db_type="1", api_url=api_url, api_method="0",
        is_list="1", is_page="1")
```

---

**两种方式对比：**

| | 方式一（URL 拼参） | 方式二（字段开启查询） |
|--|--|--|
| 适用场景 | 钻取传参、地址栏传参、固定过滤 | 报表页面查询控件 |
| URL 写法 | 需手动拼 `?key=${key}` | URL 保持原样 |
| 代码位置 | `apiUrl` / `dbDynSql` | `fieldList[i].searchFlag=1` |
| API 实际收到 | URL query param | URL query param（自动拼接） |

> **YApi mock 不根据 query param 过滤数据**，参数会传入但返回完整数组；真实后端需自行解析 query param 并过滤。

```python

# 错误：只设 dbDynSql，设计器 UI 显示空白
api_request('/jmreport/saveDb', {
    "dbType": "1",
    "dbDynSql": api_url,        # ✓ 后端能拉数据
    # apiUrl: 未设置             # ✗ 设计器「Api地址」为空
    # apiMethod: 未设置          # ✗ 设计器「请求方式」为空
    ...
})
```

### 3.3 API 接口响应格式要求（重要！）

积木报表 API 数据集对后端接口的响应格式有要求，**必须返回 `{"data": [...]}` 格式**，不能直接返回 JeecgBoot 标准 `Result.ok()` 包装。

| 格式 | 示例 | 是否可用 |
|------|------|---------|
| `{"data": [...]}` | `{"data": [{"name":"张三"}]}` | ✅ 积木报表能识别 |
| 裸数组 | `[{"name":"张三"}]` | ✅ 部分版本可识别 |
| `Result.ok(list)` | `{"success":true,"result":[...],"code":200}` | ❌ 积木报表**无法**识别，报表显示空白 |
| `{"data": {"records":[...], "total": N}}` | 嵌套对象 | ❌ `data` 必须是数组，**不能是对象**，否则报表显示空白 |

**⚠️ 分页 API 数据集（isPage="1"）正确响应格式：**

`data` 字段必须始终是**平铺数组**（当前页记录），分页信息放顶层：

```json
{"data": [...当前页记录...], "total": 27, "pageNo": 1, "pageSize": 10}
```

```java
// ✅ 分页正确写法：data 是数组，total/pageNo/pageSize 顶层
@GetMapping("/list")
public Map<String, Object> list(
        @RequestParam(defaultValue = "1") Integer pageNo,
        @RequestParam(defaultValue = "10") Integer pageSize) {
    IPage<SysUser> page = service.page(new Page<>(pageNo, pageSize), qw);
    List<VO> records = page.getRecords().stream().map(...).collect(toList());
    Map<String, Object> resp = new HashMap<>();
    resp.put("data", records);       // ← 平铺数组，不是嵌套对象
    resp.put("total", page.getTotal());
    resp.put("pageNo", page.getCurrent());
    resp.put("pageSize", page.getSize());
    return resp;
}

// ❌ 错误：data 是对象而非数组，executeSelectApi 返回空，报表显示空白
resp.put("data", Map.of("records", records, "total", total));
```

**JeecgBoot Controller 正确写法：**

```java
// ✅ 正确：返回 {"data": [...]}
@GetMapping("/list")
public Map<String, Object> list(@RequestParam(required = false) String mouth) {
    List<GroupSubVO> data = service.queryList(mouth);
    return Collections.singletonMap("data", data);
}

// ❌ 错误：Result.ok() 包装后积木报表找不到数据，报表显示空白
@GetMapping("/list")
public Result<List<GroupSubVO>> list() {
    return Result.ok(service.queryList());
}
```

> **注意：** 积木报表预览时接口返回 1000+ 条数据、HTTP 200，但报表完全空白，是典型的响应格式不匹配问题。

**查询参数过滤示例（年月 yyyy-MM → 匹配数据中 "N月" 字符串）：**

```java
@GetMapping("/list")
public Map<String, Object> list(@RequestParam(required = false) String mouth) {
    List<GroupSubVO> all = generateData();
    if (mouth != null && !mouth.trim().isEmpty()) {
        String[] parts = mouth.split("-");
        if (parts.length == 2) {
            String filterYear  = parts[0];                         // "2020"
            String filterMonth = parts[1].replaceFirst("^0","") + "月"; // "06" → "6月"
            all = all.stream()
                .filter(v -> v.getYear().equals(filterYear) && v.getMouth().equals(filterMonth))
                .collect(Collectors.toList());
        }
    }
    return Collections.singletonMap("data", all);
}
```

> `class` 是 Java 保留字，VO 中用 `clazz` 字段名 + `@JsonProperty("class")` 注解序列化为 `"class"` 输出给积木报表。

### 3.4 各数据集类型的 saveDb 关键字段对比

| dbType | 类型 | 数据/地址字段 | 设计器 UI 字段 | 说明 |
|--------|------|-------------|--------------|------|
| `"0"` SQL | `dbDynSql` | 同 `dbDynSql` | 后端和 UI 读同一个字段 |
| `"1"` API | `dbDynSql` | `apiUrl` + `apiMethod` | **必须同时设三个字段**，后端读 `dbDynSql`，UI 读 `apiUrl`/`apiMethod` |
| `"2"` JavaBean | — | `javaType` + `javaValue` | 见 dataset-advanced.md JavaBean 说明 |
| `"3"` JSON | `jsonData` | 同 `jsonData` | 必须用 `{"data":[...]}` 包裹 |
| `"5"` 多文件 | `dbDynSql` | 同 `dbDynSql` | SQL 需 `jmf.` 前缀，`dbSource` 传文件数据源ID，用标准 `queryFieldBySql` + `saveDb` |
| `"6"` 单文件 | — | — | 使用专用 `/dataset/files/single/save` 接口 |

---

## 4. JSON数据集

直接输入 JSON，自动解析字段：
```json
{"data": [{"cname": "牛奶", "cprice": "56", "id": "1"}]}
```

> **重要：JSON 数据必须用 `{"data": [...]}` 对象包裹，禁止直接传数组 `[...]`。** 后端使用 fastjson 解析，直接传数组会导致预览报错：`offset 1, character [, line 1, column 1`。
>
> - 正确：`{"data": [{"name": "张三", "age": "30"}]}`
> - 错误：`[{"name": "张三", "age": "30"}]`
>
> `saveDb` 接口的 `jsonData` 字段传入的是 JSON 字符串，构造时用 `json.dumps({"data": [...]})` 包裹。

---

## 5. 保存/修改数据集

`POST /jmreport/saveDb`（新增不传 id，更新传 id）

> **分页规则：**
> - **第一个数据集默认设置 `isPage: "1"`**（勾选"是否分页"）
> - 一个报表**只能有一个数据集**设置 `isPage: "1"`，其余必须为 `"0"`
> - 如果报表只有一个数据集，直接设 `isPage: "1"`
> - **对象数据集（单条记录）：`isList: "0"` + `isPage: "0"`**，见下方说明

### 列表数据集 vs 对象数据集

| 特性 | 列表数据集 | 对象数据集 |
|------|-----------|-----------|
| isList | `"1"` | `"0"` |
| isPage | `"1"` 或 `"0"` | `"0"` |
| 绑定语法 | `#{dbCode.field}` | `${dbCode.field}` |
| 数据形态 | 多条记录，循环展开 | **单条记录**，直接取值 |
| 典型场景 | 明细列表、统计报表 | 套打、证件、单据（逮捕证、合同、发票） |

> **对象数据集：** 当数据集返回的是单条记录（对象）而非列表时，`isList` 和 `isPage` 都不勾选（均为 `"0"`），报表中使用 `${dbCode.field}` 单值绑定语法。适用于套打类报表（如逮捕证、合同、证书），每次只展示一条记录的详细信息。
>
> **主子表场景中：** 主表通常用对象数据集 `${}`，子表用列表数据集 `#{}`。参见 `examples/master-sub-table.md`。

**列表数据集示例：**
```json
{
    "id": "数据集ID（更新时传）",
    "izSharedSource": 0,
    "jimuReportId": "报表ID",
    "dbCode": "数据集编码",
    "dbChName": "数据集中文名",
    "dbType": "0",
    "dbSource": "",
    "isList": "1",
    "isPage": "1",
    "dbDynSql": "select * from demo",
    "fieldList": [
        {"fieldName": "id", "fieldText": "id", "widgetType": "String", "orderNum": 0,
         "tableIndex": 0, "extJson": "", "dictCode": ""}
    ],
    "paramList": []
}
```

**对象数据集示例：**
```json
{
    "jimuReportId": "报表ID",
    "dbCode": "pdaibu",
    "dbChName": "逮捕信息",
    "dbType": "0",
    "dbSource": "",
    "isList": "0",
    "isPage": "0",
    "dbDynSql": "select pname, fname, fsex, cdata, shiqing, zhuzhi, gdata from pdaibu where id='${id}'",
    "fieldList": [...],
    "paramList": [
        {"paramName": "id", "paramTxt": "ID", "paramValue": "", "widgetType": "String", "orderNum": 1, "searchFlag": 1, "searchMode": 1}
    ]
}
```

### dbType 值说明

| dbType | 类型 | 关键字段 |
|--------|------|----------|
| `"0"` | SQL | `dbDynSql` |
| `"1"` | API | `apiUrl` + `apiMethod` |
| `"2"` | JavaBean | `javaType`（`"spring-key"` 或 `"java-class"`）+ `javaValue`（Bean名称或类全路径），见 dataset-advanced.md |
| `"3"` | JSON | `jsonData` |
| `"4"` | 共享 | — |
| `"5"` | 多文件 | SQL 需 `jmf.` 前缀，`dbSource` = 文件数据源ID，标准 `queryFieldBySql` + `saveDb` 流程 |
| `"6"` | 单文件 | 专用 `/dataset/files/single/save` 接口 |

# 查询配置与顶层配置字段

积木报表查询条件配置（fieldList/paramList）和 jsonStr 顶层字段完整参考。

---

## 0. paramList 快速速查（最常用）

### SQL 条件表达式

```sql
SELECT ... FROM t WHERE 1=1
<#if isNotEmpty(emp_name)> AND emp_name LIKE CONCAT('%','${emp_name}','%')</#if>
<#if isNotEmpty(hire_date_begin)> AND hire_date >= '${hire_date_begin}'</#if>
<#if isNotEmpty(hire_date_end)> AND hire_date <= '${hire_date_end}'</#if>
```

- `isNotEmpty(x)` — JimuReport 自定义函数，null 和 `""` 均返回 false（**必须用此函数，不能用 `?has_content` 或 `??`**）
- `${param}` — 用户查询参数；`#{sysUserCode}` — 系统变量，两者不可混用
- 解析字段时用不含 FreeMarker 的纯 SQL（`LIMIT 1`），避免解析失败

## 报表字段（fieldList）vs 报表参数（paramList）权威规范

> 依据：积木报表前端源码 `data_source_setting.ftl` Tab1（字段明细 fieldList）、Tab2（报表参数 paramList）下拉枚举与列定义。两者在 UI 层就是不同的表单，可选值不相同，**别用同一套规则套**。

### 1. 字段名差异

| | fieldList（字段明细） | paramList（报表参数） |
|---|---|---|
| 标识列 | `fieldName` / `fieldText` | `paramName` / `paramTxt` |
| 默认值列 | `searchValue` | `paramValue` |
| 与 SQL 关系 | 字段直接对应 SQL 查询出的列 | 自由变量，SQL 里通过 `${paramName}` 引用，**完全由 SQL 控制匹配逻辑** |

### 2. `widgetType` 下拉枚举（源码硬编码）

| widgetType | fieldList | paramList |
|---|---|---|
| `"number"` 数值 | ✅ | ✅ |
| `"string"` 字符（**注意是小写**） | ✅ | ✅ |
| `"date"` 日期 | ✅ | ✅ |
| `"richText"` 富文本 | ✅ | ❌ |

> 源码用的都是小写值；老文档里的 `"String"` 大写是 Java 实体序列化后的形式，**新建时统一用小写**避免歧义。

### 3. `searchMode` 下拉枚举（源码硬编码——这是踩坑根源）

| searchMode | 含义 | fieldList | paramList |
|---|---|---|---|
| `1` 输入框 | 普通文本输入 | ✅ | ✅ |
| `4` 下拉单选 | 须配 dictCode（字典/SQL/API） | ✅ | ✅ |
| `3` 下拉多选 | 须配 dictCode | ✅ | ✅ |
| `6` 下拉树 | 须在 code/编码栏配接口地址 | ✅ | ✅ |
| `7` 自定义下拉框 | JS 增强 | ✅ | ✅ |
| **`2` 范围查询** | 引擎自动拆 `_begin`/`_end` | ✅ | **❌ UI 没这个选项** |
| **`5` 模糊查询** | 引擎自动包 `%` 通配符 | ✅ | **❌ UI 没这个选项** |

> ⚠️ **关键差异**：paramList 的 searchMode 下拉**根本没有 2 和 5**——通过 API 强写进去虽然能存，但前端不会渲染对应控件，引擎也不一定按预期处理（实测 `searchMode=2` 会把空值字面量塞进 SQL 触发 `Incorrect DATE value`）。

### 4. 范围 / 模糊查询的正确做法

#### 4.1 用 fieldList（引擎接管，零 SQL）

```python
field_list = [
    {"fieldName": "name",        "fieldText": "姓名",   "widgetType": "string", "orderNum": 1,
     "searchFlag": 1, "searchMode": 5},                                      # 模糊
    {"fieldName": "create_time", "fieldText": "创建时间","widgetType": "date",  "orderNum": 2,
     "searchFlag": 1, "searchMode": 2, "searchFormat": "yyyy-MM-dd"},        # 范围
]
# SQL 不需要写 WHERE，引擎自动拼
```

#### 4.2 用 paramList（SQL 自写，模式留空）

```python
param_list = [
    {"paramName": "order_name",       "paramTxt": "订单名称",
     "widgetType": "string", "searchFlag": 1, "searchMode": None},          # 模糊：SQL 自写 LIKE
    {"paramName": "apply_date_begin", "paramTxt": "申请日期(起)",
     "widgetType": "date",   "searchFlag": 1, "searchMode": None,
     "searchFormat": "yyyy-MM-dd"},
    {"paramName": "apply_date_end",   "paramTxt": "申请日期(止)",
     "widgetType": "date",   "searchFlag": 1, "searchMode": None,
     "searchFormat": "yyyy-MM-dd"},
]
```

```sql
WHERE order_name LIKE CONCAT('%', IFNULL(NULLIF('${order_name}', ''), ''), '%')
  AND apply_date >= IFNULL(NULLIF('${apply_date_begin}', ''), '1900-01-01')
  AND apply_date <= IFNULL(NULLIF('${apply_date_end}',   ''), '9999-12-31')
```

> 范围必须**手工拆成两个独立 paramName**（`xxx_begin` / `xxx_end`），不是写 `searchMode=2` 让引擎自拆——paramList UI 没有这个能力。

### 5. 选 fieldList 还是 paramList？

| 场景 | 推荐 |
|---|---|
| 单数据集，查询条件就是 SQL 列本身，不想写 FreeMarker | **fieldList** + searchMode=2/5 引擎托管 |
| 复杂 SQL（多表 JOIN、子查询、子参数）需要细粒度控制 | **paramList** + SQL 手写 + searchMode 留空 |
| 同名字段在多张表里冲突 | **paramList** 起独立别名 |
| 范围或模糊匹配 + 默认值兜底全部数据 | **paramList** + `IFNULL(NULLIF(...))` 模板 |

### 6. 共同列含义

| 列 | 类型 | 说明 |
|---|---|---|
| `searchFlag` | `1`=启用查询/`0`=不启用 | 启用了才会渲染查询控件 |
| `searchValue` (fieldList) / `paramValue` (paramList) | string | 默认值，支持 `=dateStr(...)` 表达式、`a\|b` 范围分隔 |
| `searchFormat` | string | 日期格式：`yyyy-MM-dd` / `yyyy-MM-dd HH:mm:ss` / `yyyy-MM` |
| `dictCode` | string | 下拉选项数据源：字典编码 / SQL / API |
| `extJson` | JSON 字符串 | 控件扩展配置：`{"selectSearchPageSize":20}` 等 |
| `orderNum` | int | 排序 |

---

## 6. 查询配置

查询条件通过数据集的 `fieldList` 和 `paramList` 中的字段属性配置。

**参考文档：**
- https://help.jimureport.com/queryCriteria/api — API查询条件
- https://help.jimureport.com/queryCriteria/dictionary — 字典下拉
- https://help.jimureport.com/queryCriteria/sql — SQL动态条件
- https://help.jimureport.com/queryCriteria/apiByTime — 时间查询
- https://help.jimureport.com/queryCriteria/apiRange — 范围查询
- https://help.jimureport.com/queryCriteria/apiInterface — API接口参数接收

### 6.1 参数语法

| 语法 | 类型 | 说明 | 示例 |
|------|------|------|------|
| `${paramName}` | 用户参数 | 需在报表参数/SQL中声明 | `${id}`, `${name}` |
| `#{sysVar}` | 系统变量 | 无需声明，自动解析 | `#{sysUserCode}` |

**SQL 示例：** `select * from demo where id='${id}' and create_by='#{sysUserCode}'`
**API 示例：** `http://host/api/getData?name=${name}&date=${date}`

### 系统变量

| 变量 | 说明 |
|------|------|
| `#{sysUserCode}` | 当前登录用户名 |
| `#{sysOrgCode}` | 当前登录用户部门编码 |
| `#{sysDate}` | 当前系统日期 |
| `#{sysDateTime}` | 当前系统日期时间 |
| `#{domainURL}` | 系统域名地址 |

### 6.2 查询控件配置（字段属性）

查询条件通过 `saveDb` 接口的 `fieldList` 或 `paramList` 中的字段属性控制：

| 字段属性 | 类型 | 说明 | 取值 |
|---------|------|------|------|
| `searchFlag` | Integer | 是否启用查询 | `1`=启用, `0`/null=不启用 |
| `searchMode` | Integer | 查询模式 | `1`=单条件, `2`=范围查询, `3`=多选 |
| `searchValue` | String | 查询默认值 | 静态值/表达式/系统变量 |
| `dictCode` | String | 字典编码（下拉数据源） | 字典编码/SQL/API地址 |
| `searchFormat` | String | 日期格式 | `yyyy-MM-dd`, `yyyy-MM-dd HH:mm:ss` |
| `widgetType` | String | 控件类型 | `String`, `Number`, `date`, `datetime` |
| `extJson` | String | 扩展配置JSON | `{"selectSearchPageSize":20}`, `{"loadTree":"..."}`, `{"required":true}` |

### searchMode 查询模式值

| searchMode | 类型 | 说明 |
|-----------|------|------|
| `1` | 文本输入 | 默认输入框 |
| `2` | 范围查询 | 日期/数值范围，自动生成 `_begin`/`_end` 参数 |
| `3` | 下拉多选 | 多选下拉框，需配合 dictCode |
| `4` | 下拉单选 | 单选下拉框，需配合 dictCode |
| `5` | 模糊查询 | 模糊匹配输入框 |
| `6` | 下拉树 | 树形下拉，需配合 extJson.loadTree |
| `7` | 自定义下拉框 | JS增强自定义下拉，需配合 JS 代码 |

### 查询控件类型对照

| 控件效果 | searchFlag | searchMode | dictCode | widgetType |
|---------|-----------|-----------|----------|-----------|
| 文本输入框 | 1 | 1 | 空 | String |
| 模糊查询输入框 | 1 | 5 | 空 | String |
| 下拉单选 | 1 | 4 | 字典编码/SQL/API | String |
| 下拉多选 | 1 | 3 | 字典编码/SQL/API | String |
| 范围查询（日期） | 1 | 2 | 空 | date |
| 范围查询（数值） | 1 | 2 | 空 | Number |
| 时间选择 | 1 | 1 | 空 | date/datetime |
| 下拉树 | 1 | 6 | 空 | String |
| 自定义下拉框 | 1 | 7 | 空 | String |

### 6.3 下拉数据源配置（dictCode）

三种方式，通过 `dictCode` 字段配置：

**系统字典：** 直接填字典编码（如 `sex`）

**SQL字典：**
```sql
SELECT username AS value, realname AS text FROM sys_user
```
> 注意：必须别名为 `value` 和 `text`，仅支持SQL数据源

**API字典：**
```
/jmreport/test/getDictSex?createBy=#{sysUserCode}
```
返回格式：`[{"text":"男","value":"1"},{"text":"女","value":"2"}]`

API字典支持（v1.7.9+）：
- `dictCode` — 字典编码
- `pageNo`/`pageSize` — 分页（默认10条）
- `searchText` — 搜索关键字
- `queryAll=true` — 返回全部数据

### 6.4 时间查询

将 `widgetType` 设为 `date` 或 `datetime`，日期以字符串格式传递。

**支持的日期格式：**

| 格式 | 示例 |
|------|------|
| `yyyy-MM-dd HH:mm:ss` | 2021-07-29 12:11:10 |
| `yyyy-MM-dd` | 2021-07-29 |
| `yyyy-MM` | 2021-07 |
| `yyyy` | 2021 |

**dateStr 默认值函数：**

| 表达式 | 结果 |
|--------|------|
| `=dateStr()` | 当前日期时间 |
| `=dateStr('yyyy-MM-dd')` | 当前日期 |
| `=dateStr('MM', 2)` | 当前月+2 |
| `=dateStr('dd', -1)` | 昨天 |
| `=dateStr('yyyy-MM', -1)` | 上个月 |

### 6.5 范围查询

`searchMode=2` 时启用范围查询。系统自动生成 `字段名_begin` 和 `字段名_end` 两个参数。

**默认值用管道符 `|` 分隔起止值：**

| 场景 | searchValue |
|------|------------|
| 数字范围 | `16\|22` |
| 本月1日到今天 | `=concat(string.substring(dateStr('yyyy-MM-dd'),0,8),'01')\|=dateStr('yyyy-MM-dd')` |
| 最近10天 | `=concat(dateStr('yyyy-MM-dd',-10),' 00:00:00')\|=dateStr('yyyy-MM-dd HH:mm:ss')` |

**API 后端接收：**
```java
@GetMapping("/getData")
public JSONObject getData(
    @RequestParam(name = "riqi_begin", required = false) String riqiBegin,
    @RequestParam(name = "riqi_end", required = false) String riqiEnd) { ... }
```

### 6.6 SQL条件表达式（FreeMarker语法）

```sql
select id, name, age from demo where create_by = '#{sysUserCode}'
<#if isNotEmpty(age)> and age = '${age}'</#if>
<#if isNotEmpty(name)> and name = '${name}'</#if>
```

**LIKE模糊查询：**
```sql
select * from demo where 1=1
<#if name?? && name?length gt 0>
  and name like concat('%', '${name}', '%')
</#if>
```

**DaoFormat 函数：**

| 函数 | 用途 | 示例 |
|------|------|------|
| `DaoFormat.in('${sex}')` | 字符串IN | `male,female` → `'male','female'` |
| `DaoFormat.inNumber('${age}')` | 数字IN | `21,22` → `21,22` |
| `DaoFormat.concat('${a}', ' 00:00:00')` | 拼接 | — |

### 6.7 下拉树控件

配置 `extJson`：`{"loadTree": "{{ domainURL }}/sys/user/treeTest"}`

接口返回格式：
```json
[
  {"id": "001", "pid": "", "value": "A01", "title": "节点1", "izLeaf": 0},
  {"id": "002", "pid": "001", "value": "A02", "title": "子节点1", "izLeaf": 1}
]
```

### 6.8 JS 增强 / CSS 增强（官方文档 jsEnhance.md 全量）

**官方文档**：https://jimureport.com/docs/query/jsEnhance

JS 增强 / CSS 增强用于对**查询区域的条件控件**做事件控制和样式定制，配置位置：
**设计页面 → 其他设置 → 增强配置**（version 1.3.79+）。

---

#### 6.8.1 JS 增强 — 框架约定

| 约定 | 说明 |
|------|------|
| 函数名固定 `init` | **只能定义一个**入口函数，名字必须叫 `init` |
| `this` 上下文 | `this` 指向报表上下文，可调用各种内置方法 |
| HTTP 请求 | 使用全局 `$http.metaGet(url, params)`，params 是普通对象 |
| 返回 Promise | 所有 `$http.metaXxx` 返回 Promise，用 `.then(res => {...})` 接 |

下拉选项数据格式（所有下拉相关 API 通用）：
```javascript
[{ value: '001', text: '北京市' }, { value: '002', text: '天津市' }]
```

---

#### 6.8.2 JS 增强 — API 列表

| 方法 | 用途 |
|------|------|
| `this.updateSelectOptions(dbCode, fieldName, options)` | 动态更新下拉选项 |
| `this.onSearchFormChange(dbCode, fieldName, callback)` | 监听控件值变化（回调参数可能是值，也可能是 event 对象） |
| `this.updateSearchFormValue(dbCode, fieldName, value)` | 设置/修改控件初始值 |
| `this.getSelectOptions(dbCode, fieldName)` | 获取当前下拉选项数组 |
| `this.notLoadDataWhenShow()` | 预览时不自动加载数据，需用户手动点查询 |
| `$http.metaGet(url, params)` | 全局 HTTP GET（用于自定义下拉框数据加载） |

---

#### 6.8.3 范围查询的初始值拼接（关键技巧）

`updateSearchFormValue` 给**范围查询**控件设默认值时用 `|` 拼接起止值：

| 控件类型 | 默认值写法 | 示例 |
|---------|----------|------|
| 数值范围 | `'起\|止'` | `this.updateSearchFormValue('db', 'salary', '1000\|5000')` |
| 日期范围 | `'起\|止'`（格式必须与配置的 `searchFormat` 一致） | `this.updateSearchFormValue('db', 'date', '2021-08-01\|2021-08-23')` |

**当前月第一天 ~ 最后一天**的常用代码：
```javascript
function init(){
  var date = new Date();
  date.setDate(1);
  var month = date.getMonth() + 1;
  var day = date.getDate();
  if (month < 10) month = '0' + month;
  if (day < 10)   day   = '0' + day;
  var start = date.getFullYear() + '-' + month + '-' + day;

  var nextMonthFirstDay = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  var end = new Date(nextMonthFirstDay - 1000 * 60 * 60 * 24);

  this.updateSearchFormValue('dbCode', 'fieldName', start + '|' + end);
}
```

---

#### 6.8.4 JS 增强 — 完整示例

**① 三级联动下拉**（自定义下拉框 + 接口动态加载）

需要把对应字段的 `searchMode` 配置为 `7`（自定义下拉框）。

```javascript
function init(){
  // 加载第 1 级下拉
  $http.metaGet('<backend_url>/ces/ai/customSelect').then(res => {
    this.updateSelectOptions('pca', 'pro', res.data);
  });
  // 监听第 1 级变化，加载第 2 级
  this.onSearchFormChange('pca', 'pro', (value) => {
    $http.metaGet('<backend_url>/ces/ai/customSelect', { pid: value }).then(res => {
      this.updateSelectOptions('pca', 'city', res.data);
    });
  });
  // 监听第 2 级变化，加载第 3 级
  this.onSearchFormChange('pca', 'city', (value) => {
    $http.metaGet('<backend_url>/ces/ai/customSelect', { pid: value }).then(res => {
      this.updateSelectOptions('pca', 'area', res.data);
    });
  });
}
```

**② 修改查询表单初始值**
```javascript
function init(){
  this.updateSearchFormValue('de', 'sex', '女');
}
```

**③ 下拉单选默认选中第一项**（version 1.4.0+）
```javascript
function init(){
  let ops = this.getSelectOptions('de', 'sex');
  if (ops && ops.length > 0) {
    this.updateSearchFormValue('de', 'sex', ops[0].value);
  }
}
```

**④ 预览页不自动加载数据**（version 1.6.7+）
```javascript
function init(){
  this.notLoadDataWhenShow();
}
```

---

#### 6.8.5 CSS 增强 — 命名规范

| 规则 | 说明 |
|------|------|
| 顶层容器类 | `.jm-query-form`（查询表单容器） |
| iView 按钮基类 | `.ivu-btn-primary`（查询按钮的 Primary 主题） |
| 定位方式 | F12 调试工具找到目标元素的原生 class，前面拼上 `.jm-query-form` 限定作用域 |

**示例：把查询按钮改成红色背景 + 红色边框**
```css
.jm-query-form .ivu-btn-primary {
  background-color: red;
  border-color: red;
}
```

> ⚠️ 必须加 `.jm-query-form` 前缀限定作用域，否则会污染整个页面的 iView 按钮样式。

---

#### 6.8.6 接口返回示例（自定义下拉框配套后端）

```java
@GetMapping("/customSelect")
public List<Map<String, String>> customSelect(
    @RequestParam(value = "pid", required = false) String pid) {
    List<Map<String, String>> list = new ArrayList<>();
    Map<String, String> map = new HashMap<>();
    if (StringUtils.isEmpty(pid)) {
        map.put("text", "北京市"); map.put("value", "1001");
    } else if ("1001".equals(pid)) {
        map.put("text", "市辖区"); map.put("value", "10011002");
    }
    list.add(map);
    return list;
}
```

返回数据格式必须是 `[{text, value}]` 数组（与字典 API 一致）。

### 6.9 API 参数传递

**URL参数传递：** 预览时通过URL传参覆盖默认值
```
http://localhost:8085/jmreport/view/{reportId}?name=scott&age=25
```

**后端接收：**
- GET: `@RequestParam(name="name", required=false) String name`
- POST Body: `@RequestBody JSONObject json` → `json.getString("name")`

### 6.10 querySetting

> **注意：** 调用 `/save` 时 `querySetting` 必须是 **dict 对象**，**禁止 `json.dumps()` 包成字符串**。
> 写成字符串时 /save 仍返回 `success:true`，但前端不解析 → `izOpenQueryBar` / `izDefaultQuery` 全部失效（查询栏不展开等）。
> GET 报表时 jsonStr 内 querySetting 显示为字符串，是 jsonStr 整体二次 JSON 化的副产品，与入参格式无关。

```python
# 正确：dict
base_save(report_id, designer, ...,
    querySetting={"izOpenQueryBar": True, "izDefaultQuery": True})

# 错误：字符串（前端不解析，配置失效）
querySetting=json.dumps({"izOpenQueryBar": True, "izDefaultQuery": True})
```

| 设置 | 默认值 | 说明 |
|------|--------|------|
| `izDefaultQuery` | true | 是否自动执行查询（页面加载后立即请求数据） |
| `izOpenQueryBar` | false | 是否默认展开查询栏（有查询条件时建议设为 true） |

### 6.11 fieldList 查询条件配置示例

在 `saveDb` 时通过 fieldList 配置查询条件：

```python
field_list = [
    # 普通字段（不查询）
    {"fieldName": "id", "fieldText": "ID", "widgetType": "String", "orderNum": 0},

    # 文本输入查询
    {"fieldName": "name", "fieldText": "姓名", "widgetType": "String", "orderNum": 1,
     "searchFlag": 1, "searchMode": 1},

    # 下拉单选（字典）
    {"fieldName": "sex", "fieldText": "性别", "widgetType": "String", "orderNum": 2,
     "searchFlag": 1, "searchMode": 4, "dictCode": "sex"},

    # 下拉多选（API）
    {"fieldName": "department", "fieldText": "部门", "widgetType": "String", "orderNum": 3,
     "searchFlag": 1, "searchMode": 3, "dictCode": "/jmreport/test/getDept"},

    # 日期范围查询
    {"fieldName": "create_time", "fieldText": "创建时间", "widgetType": "date", "orderNum": 4,
     "searchFlag": 1, "searchMode": 2, "searchFormat": "yyyy-MM-dd",
     "searchValue": "=dateStr('yyyy-MM-dd',-30)|=dateStr('yyyy-MM-dd')"},

    # 普通数据字段
    {"fieldName": "salary", "fieldText": "薪水", "widgetType": "Number", "orderNum": 5}
]
```

---

## 8. 顶层配置字段

| 字段 | 说明 |
|------|------|
| `loopBlockList` | 循环块定义（含 `loopTime` 分栏次数） |
| `zonedEditionList` | 分版区域定义 |
| `fixedPrintHeadRows` | 固定打印表头（数组 `[{sri,sci,eri,eci}]`，详见 `misc-config.md` §8.1） |
| `fixedPrintTailRows` | 固定打印表尾（数组 `[{sri,sci,eri,eci}]`，详见 `misc-config.md` §8.1） |
| `groupField` | 分组字段 |
| `isGroup` | 是否启用分组 |
| `submitHandlers` | 填报提交处理器 |
| `background` | 背景图配置 |
| `imgList` | 图片列表 |
| `chartList` | 图表列表 |
| `barcodeList` | 条码列表 |
| `qrcodeList` | 二维码列表 |
| `displayConfig` | 二维码/条码显示配置 |
| `dicts` | 引用的字典编码列表 |
| `printConfig` | 打印配置（纸张/方向/边距） |
| `merges` | 合并单元格列表（如 `"A2:H2"`），**必须同时在 cell 上设置 `merge` 属性** |
| `querySetting` | 查询设置 |
| `pyGroupEngine` | 是否使用Python分组引擎 |

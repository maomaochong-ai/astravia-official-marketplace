# Online 表单字段类型与配置参考

### Step 2: 智能字段推导

**从用户自然语言描述推导字段配置：**

| 用户描述关键词 | fieldShowType | dbType | dbLength | 说明 |
|---------------|--------------|--------|----------|------|
| 名称/标题/编码/文本 | `text` | string | 100 | 单行文本 |
| 密码 | `password` | string | 32 | 密码框 |
| 备注/描述/说明 | `textarea` | string | 500 | 多行文本 |
| 金额/价格/费用 | `text` | BigDecimal | 10(2) | 数字文本框 |
| 数量/个数/数目 | `text` | int | 9 | 整数文本框 |
| 小数/比率/double | `text` | double | 10(2) | 浮点文本框 |
| 日期/生日/入职日期 | `date` | Date | 0 | 日期选择 |
| 日期时间/下单时间 | `datetime` | Datetime | 0 | 日期时间选择 |
| 时间/几点 | `time` | string | 50 | 时间选择 |
| 年 | `date` + picker=year | Date | 0 | 年选择 |
| 月 | `date` + picker=month | Date | 0 | 月选择 |
| 周 | `date` + picker=week | Date | 0 | 周选择 |
| 季度 | `date` + picker=quarter | Date | 0 | 季度选择 |
| 是否/开关/启用 | `switch` | string | 50 | 开关 |
| 状态/类型/级别 (单选) | `radio` | string | 50 | 字典单选 |
| 下拉/选择/类别 | `list` | string | 50 | 字典下拉 |
| 多选/标签/兴趣 | `checkbox` | string | 200 | 字典多选 |
| 下拉多选 | `list_multi` | string | 250 | 字典下拉多选 |
| 下拉搜索/远程搜索 | `sel_search` | string | 50 | 字典表下拉搜索 |
| 图片/头像/照片 | `image` | string | 500 | 图片上传 |
| 文件/附件 | `file` | string | 500 | 文件上传 |
| 富文本/内容/HTML | `umeditor` | Text | 0 | 富文本编辑器 |
| Markdown | `markdown` | string | 20000 | Markdown编辑器。⚠️ 必须用 string，用 Blob 会导致回显乱码 |
| 用户/负责人/审批人 | `sel_user` | string | 100 | 用户选择 |
| 部门/组织/所属部门 | `sel_depart` | string | 100 | 部门选择 |
| 省市区/地区/地址 | `pca` | string | 100 | 省市区联动 |
| 分类/分类树/树选择 | `cat_tree` | string | 100 | 分类字典树 |
| 自定义树 | `sel_tree` | string | 255 | 自定义树控件 |
| 弹窗选择/popup | `popup` | string | 100 | Popup弹窗 |
| pop字典 | `popup_dict` | string | 100 | Popup字典 |
| 关联记录/引用 | `link_table` | string | 200 | 关联记录 |
| 他表字段/自动填充 | `link_table_field` | string | 32 | 他表字段(不持久化) |
| 联动下拉/级联 | `link_down` | string | 255 | 联动组件 |

### Step 3: 字典配置推导

**支持字典的控件：** 下拉框(`list`)、多选框(`checkbox`)、单选框(`radio`)、下拉多选(`list_multi`)、下拉搜索(`sel_search`)。
这 5 种控件均支持**数据字典**和**表字典**两种模式（下拉搜索不支持 popup）。

> ⚠️ **例外：JS `changeOptions` 完全控制选项时，必须留空 dictField/dictTable/dictText。**
> 若同时配置了字典，框架在下拉打开时会重新查字典并覆盖 JS 设置，导致联动永远失效。
> 规则：选项由 JS 动态提供 → dict 全空；选项来自静态字典 → 正常配置 dict，不需要 JS。

**字典数据来源有三种方式，按以下优先级选择：**

#### 方式一：数据字典/系统字典/字典编码（dictField 有值，dictTable 为空）
用户提到"字典 sex"、"使用 urgent_level 字典"、"字典编码 education" 等：
```json
{ "dictField": "sex", "dictTable": "", "dictText": "" }
```

> **重要：数据字典（系统字典/字典编码）只需填 dictField（字典编码），dictTable 和 dictText 必须为空。**
> 绝对不能把 `dictTable` 设为 `sys_dict_item`——这是底层存储表，不是字典配置方式。
> 如果 dictField 填的字典编码不存在，需先通过 `sys/dict/list?dictCode=xxx` 查询是否已存在（先查后建），不存在则通过 `sys/dict/add` + `sys/dictItem/add` 创建。
>
> **⚠️ 创建字典项时 dictId 取值易错点：** `POST /sys/dict/add` 的响应 `result` 是完整字典对象，**不是** id 字符串。必须用 `result.get('id')` 取 dictId，直接用 `result` 会导致字典项接口返回 success=True 但实际未关联到字典（页面字典配置中看不到任何项）。
> ```python
> # 正确
> r = post('/sys/dict/add', {...})
> dict_id = r.get('result', {}).get('id', '')   # ← 取 result 下的 id
> post('/sys/dictItem/add', {'dictId': dict_id, ...})
>
> # 错误（dict_id 会是一个 dict 对象，dictItem 无法关联）
> dict_id = r.get('result', '')
> ```

#### 方式二：表字典（dictTable 有值）
用户提到"从 sys_user 表取"、"关联部门表"等。**dictTable 不仅可以填系统表，也可以填 Online 中创建的业务表。**
```json
{ "dictTable": "sys_depart", "dictField": "id", "dictText": "depart_name" }
```
Online 业务表示例：`dictTable="user_info_demo"`, `dictField="id"`, `dictText="real_name"` → 引用 Online 创建的用户表

#### 方式三：字典表带条件
用户提到"过滤/筛选/where"等：
```json
{ "dictTable": "sys_user where username like '%a%'", "dictField": "username", "dictText": "realname" }
```

**常用 JeecgBoot 系统字典编码：**

| 字典编码 | 说明 | 适用控件 |
|---------|------|---------|
| `sex` | 性别 (1=男, 2=女) | list/radio/checkbox |
| `priority` | 优先级 (L/M/H) | list/radio |
| `valid_status` | 有效状态 (0/1) | list/radio/switch |
| `urgent_level` | 紧急程度 | list/checkbox/list_multi |
| `yn` | 是否 (Y/N) | radio/switch |

**常用系统表（表字典 dictTable 可用）：**

| 表名 | 说明 | 常用字段 | 适用场景 |
|------|------|---------|---------|
| `sys_user` | 用户表 | `id`, `username`, `realname`, `phone`, `email` | sel_search/表字典下拉 |
| `sys_depart` | 组织机构表 | `id`, `depart_name`, `org_code`, `parent_id` | 表字典下拉/sel_tree |
| `sys_role` | 角色表 | `id`, `role_name`, `role_code` | 表字典下拉（角色选择） |
| `sys_position` | 职务级别 | `id`, `code`, `name`, `post_level` | 表字典下拉（职务选择） |

> **表字典配置示例**：`dictTable="sys_role"`, `dictField="role_code"`, `dictText="role_name"` → 下拉显示角色名，存储角色编码

### Step 3.5: 校验规则推导 (fieldValidType)

| 用户描述 | fieldValidType | 说明 |
|---------|---------------|------|
| 唯一/不重复 | `only` | 唯一校验（服务端校验） |
| 整数 | `z` | 整数正则 `/^-?\d+$/` |
| 数字/纯数字 | `n` | 纯数字 0-9 |
| 字母 | `s` | 纯字母 A-Z/a-z |
| 6-18位字母 | `s6-18` | 字母长度限制 |
| 6-16位数字 | `n6-16` | 数字长度限制 |
| 6-16位任意 | `*6-16` | 任意字符长度限制 |
| 手机号 | `m` | 手机号 `/^1[3-9]\d{9}$/` |
| 邮箱 | `e` | 邮箱格式 |
| 邮编 | `p` | 邮编 `/^\d{6}$/` |
| 网址/URL | `url` | URL格式 |
| 金额 | `money` | 金额 `/^\d+(\.\d{2})?$/` |
| 自定义正则 | `^正则$` | 如 `^[a-z]{2,10}$` |

### Step 3.6: 默认值推导 (fieldDefaultValue)

| 语法 | 说明 | 仅新增生效 |
|------|------|-----------|
| `#{date}` | 当前日期 YYYY-MM-DD | 是 |
| `#{time}` | 当前时间 HH:mm:ss | 是 |
| `#{datetime}` | 当前日期时间 YYYY-MM-DD HH:mm:ss | 是 |
| `#{sysUserId}` | 当前用户ID | 是 |
| `#{sysUserCode}` / `#{sys_user_code}` | 当前用户账号 | 是 |
| `#{sysUserName}` | 当前用户姓名 | 是 |
| `#{sysOrgCode}` / `#{sys_org_code}` | 当前用户部门编码 | 是 |
| `${规则编码}` | 编码规则(自动流水号)，规则编码通过 `GET /sys/fillRule/list` 查询获取 | 是 |
| `${规则编码?onl_watch=field1,field2}` | 编码规则+字段监听，field1/field2 变化时自动重新生成 | 是 |
| `${规则编码?onl_watch=field1&自定义参数=xxx}` | 编码规则+自定义参数，参数会传到后台编码规则中解析 | 是 |
| `{{JS表达式}}` | 前端JS表达式（通过 `new Function` 执行），如 `{{Math.random()}}` | 是 |
| `{{自定义方法()}}` | 调用 `src/utils/desform/customExpression.ts` 中 export 的方法 | 是 |
| 纯字符串 | 直接赋值(如 "Y", "10") | 所有操作 |

**表达式混用规则：**
- `#{}`、`{{}}`、纯字符串**可以混合使用**（如 `#{sysUserName}-{{Math.random()}}`）
- `${填值规则}` **只能和纯字符串混用**，与 `#{}` 或 `{{}}` 混用则不解析
- `${填值规则}` 一个字段只能写一个，多个不解析
- `{{}}` 内通过 `new Function` 执行，必须写能直接返回值的表达式（如 `{{Math.random()}}`、`{{1+1}}`），不能写语句（如 `var x=1`）
- 复杂逻辑需在 `src/utils/desform/customExpression.ts` 中定义方法并 export，然后用 `{{方法名()}}` 调用
- **内置可用示例**：`{{demoFieldDefVal_getAddress('海淀区')}}`、`{{sayHi('李四')}}`（源码已 export 这两个方法）
- **注意**：`dayjs` 等第三方库在 `new Function` 作用域中不可用
- **⚠️ date/datetime/time 控件的当前时间默认值必须用 `#{date}`/`#{datetime}`/`#{time}`，不能用 `{{+new Date()}}` —— 后者返回毫秒整数，MySQL datetime 列会报 Data truncation 错误**

### Step 3.7: 扩展配置推导 (fieldExtendJson)

> **来源：** `src/views/super/online/cgform/extend/FieldExtendJsonModal.vue` 完整配置项。fieldExtendJson 是 JSON 字符串，注意各属性的值类型。
> **重要：** 生成 fieldExtendJson 时必须查阅此表，不能凭猜测使用属性名。

| 属性 | 值类型 | 适用控件 | 说明 |
|------|--------|---------|------|
| `uploadnum` | int | file, image | 上传数量限制（0=不限） |
| `showLength` | int | text, textarea | 列表文本截断显示长度 |
| `popupMulti` | **boolean** | popup, popup_dict | 是否多选（**默认 true=多选**，设 false=单选） |
| `multiSelect` | **boolean** | sel_user, sel_depart, link_table | 是否多选。sel_user/sel_depart **默认 true**；link_table **默认 false** |
| `store` | string | sel_user, sel_depart | 存储字段名（如 `"id"`, `"orgCode"`） |
| `text` | string | sel_user, sel_depart | 展示字段名 |
| `orderRule` | string | sortFlag='1' 或 dbType 为数值/日期类型 | 默认排序：`"asc"` / `"desc"` / `""` |
| `validateError` | string | 所有控件 | 校验失败提示文本 |
| `labelLength` | int | 所有控件 | 查询 label 长度 |
| `isFixed` | **int** | 所有控件 | 是否固定列（1=是, 0=否，**整数不是字符串**） |
| `isOneRow` | **boolean** | umeditor, markdown | 多列布局中是否独占一行（true/false） |
| `picker` | string | date | 日期格式：`"year"` / `"month"` / `"week"` / `"quarter"` / `"default"`(年月日) |
| `displayLevel` | string | pca | 省市区显示级别：`"all"` / `"province"` / `"city"` / `"region"` |
| `switchOptions` | array | switch | 开关值数组如 `["Y","N"]` 或 `[1,0]`（数字会自动转换） |
| `showType` | string | link_table | 关联记录展示：`"card"`（默认） / `"select"` |
| `imageField` | string | link_table | 卡片模式封面图片字段名 |
| `isListReadOnly` | **boolean** | link_table | 列表只读模式（默认 false），一对多子表中隐藏 |

**示例组合：**
```json
// 固定列 + label长度5 + 默认升序
{"isFixed":1,"labelLength":5,"orderRule":"asc"}

// 用户选择多选 + 存储ID
{"multiSelect":true,"store":"id","text":"realname"}

// 日期选年
{"picker":"year"}

// 省市区只显示省
{"displayLevel":"province"}

// 富文本独占一行
{"isOneRow":true}

// 关联记录卡片多选带图
{"showType":"card","multiSelect":true,"imageField":"avatar"}
```

### Step 3.8: 字段命名与类型约束（源码校验规则）

**表名约束：**
- 最长 50 个字符
- 不允许输入中文
- 提交时自动转小写并 trim

**字段名（dbFieldName）约束：**

> ⚠️ **最高频踩坑：字段名禁止 `<单字母>_xxx` 前缀！**
>
> 正则 `/^[a-zA-Z]{1}(?!_)[a-zA-Z0-9_\\$]+$/` 的含义：字母开头，**第 2 个字符不能是下划线**。
>
> | ❌ 非法（单字母+下划线） | ✅ 合法写法 |
> |--------------------------|-------------|
> | `f_text`、`f_num`、`a_name` | `fc_text`、`fnum`、`field_name` |
> | `x_password`、`d_date` | `xp_password`、`detail_date` |
>
> **规则：下划线前至少要有 2 个字母。** 即 `ab_c` ✅、`a_b` ❌、`a_bc` ❌。

- 最长 32 个字符
- 正则：`/^[a-zA-Z]{1}(?!_)[a-zA-Z0-9_\\$]+$/`（字母开头，第 2 个字符不能是 `_`）
- 不能使用 MySQL 关键字（ADD, ALTER, TABLE, SELECT 等 270+ 个）
- 同表内不能重复
- 提交时自动转小写

**字段备注（dbFieldTxt）约束：** 最长 200 个字符

**dbType 完整选项及默认长度：**

| dbType | 默认 dbLength | 说明 |
|--------|-------------|------|
| `string` | 32 | 字符串 |
| `int` | 10 | 整数（不允许设小数点） |
| `double` | 10 | 浮点数 |
| `long` | 19 | 长整型 |
| `BigDecimal` | 10 | 高精度小数 |
| `Date` | 0 | 日期 |
| `Datetime` | 0 | 日期时间 |
| `Text` | 0 | 文本 |
| `LongText` | 0 | 长文本 |
| `Blob` | 0 | 二进制 |

**字段值类型规则（极重要！）：**
- **所有 checkbox 字段必须用字符串 `'1'`/`'0'`，不是整数 1/0**
- 涉及字段：`dbIsKey, dbIsNull, dbIsPersist, isShowForm, isShowList, sortFlag, isReadOnly, isQuery, fieldMustInput, queryConfigFlag`
- `dbLength, dbPointLength, fieldLength` 是整数类型
- 其他字段（fieldShowType, dbType, queryMode 等）是字符串类型

**dbType ↔ fieldShowType 强制约束：**
- `time` 控件 → dbType 必须是 `string`
- `date` 控件 → dbType 必须是 `Date` 或 `Datetime`
- `datetime` 控件 → dbType 必须是 `Datetime`
- dbType 变更时自动同步：`Datetime→datetime`、`Date→date`、其他→`text`

**queryMode 约束（源码严格校验）：**
- `like`（模糊查询）→ **仅支持** dbType=`string` 且 fieldShowType=`text`（textarea 不行！）
- `group`（范围查询）→ dbType 为 `int/double/BigDecimal/Date/Datetime` 或 fieldShowType=`time`
- dbType 从 string 变为其他时，`like` 自动重置为 `single`

**dbIsPersist=0 联动：** 自动禁用 isQuery 和 sortFlag（重置为 0）
**dbIsNull=0 联动：** 自动启用 fieldMustInput（必填）
**外键限制：** 每个表只允许配置一个外键字段

**子表 fieldShowType 可选项：**
`text, radio, switch, date, datetime, time, file, image, list, list_multi, sel_search, popup, link_table, link_table_field, sel_depart, sel_user, pca, textarea, cat_tree, sel_tree`
（不支持：password, checkbox, umeditor, markdown, link_down, popup_dict）

> `cat_tree` 和 `sel_tree` 已确认支持子表（实际项目验证）。

**个性查询 queryShowType 可选项（来源 QueryTable.vue）：**

| value | 说明 |
|-------|------|
| `text` | 文本框（默认） |
| `date` | 日期(yyyy-MM-dd) |
| `datetime` | 日期时间(yyyy-MM-dd HH:mm:ss) |
| `time` | 时间(HH:mm:ss) |
| `date_year` | 日期-年 |
| `date_month` | 日期-月 |
| `date_week` | 日期-周 |
| `date_quarter` | 日期-季度 |
| `list` | 下拉框 |
| `list_multi` | 下拉多选框 |
| `sel_search` | 下拉搜索框 |
| `cat_tree` | 分类字典树 |
| `popup` | Popup弹框 |
| `sel_depart` | 部门选择 |
| `sel_user` | 用户选择 |
| `pca` | 省市区组件 |
| `sel_tree` | 自定义树控件 |
| `switch` | 开关 |
| `popup_dict` | Popup字典 |

> **注意：没有 `date_range` 这个值！** 日期范围查询不是通过 queryShowType 实现的，而是通过 `queryMode: "group"` 实现。
>
> **查询优先级：个性查询 > 普通查询/精确查询/范围查询。** 当 `queryConfigFlag: "1"` 启用个性查询后，字段的 `queryMode`（single/group/like）会被忽略，查询控件完全由 `queryShowType` 决定。
>
> **queryShowType vs queryMode 区分：**
> - **普通查询**（精确匹配）：`queryMode: "single"`（默认）
> - **模糊查询**：`queryMode: "like"`（仅 string+text）
> - **范围查询**（两个输入框选区间）：`queryMode: "group"`（数值/日期类型）
> - **个性查询**（覆盖以上所有）：`queryConfigFlag: "1"` + `queryShowType`，优先级最高
>
> **常用组合：**
> - 日期范围查询：`{"isQuery": 1, "queryMode": "group"}`（不用个性查询）
> - 查询区域用下拉：`{"isQuery": 1, "queryConfigFlag": "1", "queryShowType": "list", "queryDictField": "sex"}`
> - 查询区域用年选择：`{"isQuery": 1, "queryConfigFlag": "1", "queryShowType": "date_year"}`

### Step 4: 特殊控件配置

#### switch 开关
```json
{
  "fieldShowType": "switch",
  "fieldExtendJson": "[\"Y\",\"N\"]",
  "dictField": "", "dictTable": "", "dictText": ""
}
```

#### date 日期扩展 (年/月/周/季度)
```json
{
  "fieldShowType": "date",
  "fieldExtendJson": "{\"labelLength\":6,\"picker\":\"year\"}"
}
```
picker 可选值: `year`、`month`、`week`、`quarter`

#### popup 弹窗
dictField 和 dictText 成对映射（逗号分隔）：
```json
{
  "fieldShowType": "popup",
  "dictTable": "report_user",
  "dictField": "username,realname",
  "dictText": "popup,popback"
}
```
- `dictField`：报表中要取值的字段名（逗号分隔，可多个）
- `dictText`：**当前表中接收回填值的字段名**（与 dictField 一一对应，逗号分隔）
- 特点：可同时回填多个本表字段，dictText 必须是**本表字段名**，不是报表字段。

> **⚠️ 重要：dictTable 填的是 Online 查询报表的 `code`，不是积木报表（JimuReport）的 id！**
>
> **查找已有报表：** `GET /online/cgreport/head/list?pageNo=1&pageSize=30`，取返回记录的 `code` 字段。
>
> **系统内置常用报表：**
> | code | 名称 | 说明 |
> |------|------|------|
> | `report_user` | 统计在线用户 | 查 sys_user，含 username/realname/phone/email/sex 等 |
>
> **没有合适报表时：** 调用 `POST /online/cgreport/head/add` 创建 Online 查询报表（填 `name`、`code`、`cgrSql`），不要用积木报表替代。

#### sel_tree 自定义树
```json
{
  "fieldShowType": "sel_tree",
  "dictTable": "sys_category",
  "dictField": "0",
  "dictText": "id,pid,name,has_child"
}
```
dictField 填根节点值，dictText 填 `id,pid,显示字段,是否有子节点字段`。

#### link_down 联动下拉
dictTable 填 JSON 配置字符串。**父级是 `link_down` 类型，子级是普通 `text` 类型**（接收父级联动回填的值）。

**父级字段**（`link_down`，配 `condition` 过滤根节点，`linkField` 指向子级字段名）：
```json
{
  "fieldShowType": "link_down",
  "dictTable": "{\n\ttable: \"sys_category\",\n\ttxt: \"name\",\n\tkey: \"id\",\n\tlinkField: \"field_child\",\n\tidField: \"id\",\n\tpidField: \"pid\",\n\tcondition:\"pid = '0'\"\n}",
  "dictField": "", "dictText": ""
}
```

**子级字段**（普通 `text`，无需任何 dictTable 配置，由父级 `linkField` 驱动回填）：
```json
{
  "fieldShowType": "text",
  "dbType": "string",
  "dbLength": 100,
  "dictTable": "", "dictField": "", "dictText": ""
}
```

存储格式：子级 text 字段存储父级联动选中项的 **key 值**（即 dictTable 中 `key` 字段对应的列值，通常是 id）。造测试数据时需先通过 `querySelectOptions` 查到子节点的 store 值填入，不能留空。

> ⚠️ **易错点**：子级是 `text` 字段，不是 `link_down`。造数据时必须为子级字段赋值（填子节点的 key/id），如果父级对应的分类没有子节点则才可以留空。
```

#### link_table 关联记录

> **⚠️ 前置检查（必须）：配置 link_table 前，必须先确认被关联表存在于 Online 系统中。**
>
> `link_table` 的 `dictTable` 只能填 **Online 管理的业务表名**（在 `onl_cgform_head` 中注册过的表），
> 不能填系统表（如 `sys_depart`、`sys_user`）——填系统表虽不报错，但关联记录弹窗无法加载数据。
>
> **检查流程：**
> 1. 调用 `GET /online/cgform/head/list?tableName={表名}&pageNo=1&pageSize=1`
> 2. 若 `result.records` 为空 → 表不存在，需先创建该 Online 表并同步数据库
> 3. 创建完成后插入若干条示例数据（至少 3 条），确保关联弹窗有内容可选
> 4. 若表已存在 → 取出 `headId`，调用 `GET /online/cgform/api/getColumns/{headId}`，从返回的 `result.columns[].dataIndex` 中获取实际列名
> 5. 用实际列名填写 `dictText`（如真实列是 `name,age` 就填 `"name,age"`），**不能使用模板占位符或凭猜测填写**
>
> **⚠️ 常见错误**：只检查表是否存在、不核验列名，直接沿用模板中的 `dictText: "user_code,phone"`，而目标表实际列为 `name/age/sex/birthday`，运行时报 `Unknown column 'user_code' in 'field list'`。

卡片单选（默认）：
```json
{
  "fieldShowType": "link_table",
  "dictTable": "demo_staff",
  "dictField": "id",
  "dictText": "name,age,sex",
  "fieldExtendJson": "{\"showType\":\"card\",\"multiSelect\":false,\"imageField\":\"\"}"
}
```
下拉单选：`{"showType":"select","multiSelect":false,"imageField":""}`
卡片多选带图片：`{"showType":"card","multiSelect":true,"imageField":"top_pic"}`
列表只读模式：`{"showType":"card","multiSelect":false,"imageField":"","isListReadOnly":true}`

> **link_table 的 dictText 配置规则（源码 LinkTableConfigModal.vue）：**
> - `dictText` 中第 1 个字段是 `titleField`（标题字段，必填）
> - 其余字段是 `otherFields`（附加显示字段，最多 6 个）
> - `imageField` 单独配置在 fieldExtendJson 中，不在 dictText 里
> - link_table_field 的 dictText 只能引用 titleField 或 otherFields 中的字段

#### link_table_field 他表字段
```json
{
  "fieldShowType": "link_table_field",
  "dictTable": "guanljil",
  "dictField": "",
  "dictText": "name",
  "dbIsPersist": 0
}
```
dictTable 填本表中 link_table 控件的字段名（不是数据库表名）。`dbIsPersist=0` 表示不持久化到数据库。

#### popup_dict Pop字典
```json
{
  "fieldShowType": "popup_dict",
  "dictTable": "report_user",
  "dictField": "id",
  "dictText": "realname"
}
```
- `dictField`：报表中的存储值字段（如 `"username"`，存入当前字段）
- `dictText`：**报表中的显示文本字段**（如 `"realname"`，仅用于前端显示，**不是当前表字段名**）
- 特点：行为类似 list/sel_search（存一个值、显示另一个文本），只回填当前字段本身。

> ⚠️ **易错点**：popup_dict 的 dictText 填报表字段名（显示文本），**不能**填当前表字段名——那是 popup 的用法。

#### 6.3 字段配置属性参考

JSON 配置中每个字段对象支持以下属性（未指定的使用默认值）：

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| dbFieldName | string | **必填** | 字段名(snake_case) |
| dbFieldTxt | string | **必填** | 字段标签 |
| fieldShowType | string | "text" | 控件类型(text/list/radio/date/file等) |
| dbType | string | "string" | 数据库类型(string/int/double/long/BigDecimal/Date/Datetime/Text/LongText/Blob) |
| dbLength | int | 100 | 字段长度 |
| dbPointLength | int | 0 | 小数位数 |
| fieldMustInput | **string** | "0" | 是否必填("1"=是,"0"=否) |
| isQuery | **string** | "0" | 是否查询("1"=是) |
| queryMode | string | "single" | 查询模式(single=精确/模糊, group=范围) |
| isShowForm | **string** | "1" | 是否在表单中显示("1"=是) |
| isShowList | **string** | "1" | 是否在列表中显示("1"=是) |
| isReadOnly | **string** | "0" | 是否只读("1"=是) |
| dictField | string | "" | 字典编码(系统字典) |
| dictTable | string | "" | 字典表名(字典表) |
| dictText | string | "" | 字典显示字段 |
| fieldExtendJson | string | "" | 扩展配置JSON(switch/date picker等) |
| fieldDefaultValue | string | "" | 默认值 |
| fieldValidType | string | "" | 校验规则(m=手机/e=邮箱/n=数字等) |
| fieldLength | int | 120 | 控件宽度 |
| mainTable | string | "" | 主表名(子表外键字段用) |
| mainField | string | "" | 主表关联字段(子表外键字段用) |
| sortFlag | **string** | "0" | 是否可排序("1"=是) |
| dbIsPersist | **string** | "1" | 是否持久化到数据库("0"=不持久化, link_table_field 必须设为"0") |
| fieldHref | string | "" | 超链接URL模板（见下方 fieldHref 配置说明） |
| converter | string | "" | 自定义转换器Bean名 |
| queryConfigFlag | string | "0" | 是否启用个性查询("1"=启用) |
| queryShowType | string | null | 个性查询控件类型（见 queryShowType 可选项） |
| queryDictField | string | "" | 个性查询字典编码（系统字典时填编码） |
| queryDictTable | string | "" | 个性查询字典表名（表字典时填表名） |
| queryDictText | string | "" | 个性查询字典显示字段（表字典时填显示字段） |
| queryDefVal | string | "" | 个性查询默认值（如 `"1"`, `"admin"`） |

## 子表控件限制（源码 PageAttributeTable.vue）

**一对一子表和一对多子表支持的控件相同**，都是 subTablePageOptions 的 18 种：
`text, radio, switch, date, datetime, time, file, image, list, list_multi, sel_search, popup, link_table, link_table_field, sel_depart, sel_user, pca, textarea`

子表不支持以下 8 种控件（仅主表支持）：
- `password` → 密码框
- `checkbox` → 多选框
- `umeditor` → 富文本
- `markdown` → Markdown
- `cat_tree` → 分类字典树
- `sel_tree` → 自定义树控件
- `link_down` → 联动组件
- `popup_dict` → Pop字典（源码中已注释）

> **主子表设计原则**：8 种子表不支持的控件必须放在主表中。

---

## 查询配置

### 基础查询 (isQuery + queryMode)
| queryMode | 说明 | 适用控件 |
|-----------|------|---------|
| `single` | 精确匹配 | list, radio, sel_search, sel_user 等 |
| `like` | 模糊匹配（LIKE） | **仅** fieldShowType=`text` 且 dbType=`string` |
| `group` | 范围查询 | dbType 为 int/double/BigDecimal/Date/Datetime，或 fieldShowType=`time` |

**查询控件自动转换规则（源码 QueryTable.vue）：**
- `checkbox` → 查询时变 `list_multi`
- `radio` → 查询时变 `list`
- `password`/`file`/`image` → 查询时变 `text`

### 个性查询 (queryConfigFlag='1')

个性查询用于**覆盖默认的查询控件类型和字典配置**，使查询区域的控件与表单区域不同。

**启用条件：** `queryConfigFlag='1'` 且 `queryShowType` 必须有值（启用状态下控件类型必选）。

**5 个个性查询字段：**

| 字段 | 说明 | 示例 |
|------|------|------|
| `queryConfigFlag` | 启用标志 | `'1'` |
| `queryShowType` | 查询控件类型 | `'list'`, `'date'`, `'sel_user'` 等 |
| `queryDictField` | 系统字典编码 | `'sex'`, `'priority'` |
| `queryDictTable` | 表字典表名 | `'sys_depart'` |
| `queryDictText` | 表字典显示字段 | `'depart_name'` |
| `queryDefVal` | 查询默认值 | `'1'`, `'admin'`, `'2'` |

**示例 1：文本框 + 默认值**
```json
{"queryConfigFlag": "1", "queryShowType": "text", "queryDefVal": "测试"}
```

**示例 2：系统字典下拉**
```json
{"queryConfigFlag": "1", "queryShowType": "list", "queryDictField": "sex", "queryDefVal": "1"}
```

**示例 3：表字典下拉**
```json
{"queryConfigFlag": "1", "queryShowType": "list", "queryDictTable": "sys_depart", "queryDictField": "id", "queryDictText": "depart_name"}
```

**示例 4：用户选择**
```json
{"queryConfigFlag": "1", "queryShowType": "sel_user"}
```

---

## 索引配置

在 Online 表单配置的「索引」Tab 中可以为字段添加索引，通过 addAll/editAll API 的 `indexs` 数组配置。

| 索引类型 | 说明 |
|---------|------|
| `normal` | 普通索引，加速查询 |
| `unique` | 唯一索引，保证字段值不重复 |

**索引字段支持多个字段**（联合索引），用逗号分隔：`"indexField": "field1,field2"`

```json
"indexs": [
    {"indexName": "idx_unique_code", "indexField": "code", "indexType": "unique"},
    {"indexName": "idx_status", "indexField": "status", "indexType": "normal"}
]
```

---

## 常见问题与解决方案

### 1. decimal/BigDecimal 字段同步数据库失败

**错误信息：**
```
同步数据库失败，Error calling Value#setTypeUsingReflection: containingClassName=[xxx], propertyName=[xxx], role=[xxx.xxx] : origin(null)
```

**原因：**
使用了无效的 `dbType` 值。`decimal` 是 MySQL 的类型名称，但不是 Online 表单的合法 dbType 值。

**解决方案：**
使用正确的 `dbType` 值：
- `BigDecimal` → Java 高精度小数类型（正确）
- `decimal` → 无效值，会导致同步失败

**正确配置示例：**
```json
// 金额字段（正确）
{"dbFieldName": "amount", "dbFieldTxt": "金额", "fieldShowType": "number", "dbType": "BigDecimal", "dbLength": 10, "dbPointLength": 2}

// 金额字段（错误 - 会同步失败）
{"dbFieldName": "amount", "dbFieldTxt": "金额", "fieldShowType": "number", "dbType": "decimal", "dbLength": 10, "dbPointLength": 2}
```

**dbType 有效值：**
`string`, `int`, `double`, `long`, `BigDecimal`, `Date`, `Datetime`, `Text`, `LongText`, `Blob`

---

### fieldHref 超链接配置

`fieldHref` 让字段在列表中显示为可点击的超链接。支持三种类型，**类型由值的格式自动区分**，无需额外 type 字段。

支持 `${字段名}` 动态注入当前行的字段值，如 `${id}`、`${name}`。

#### 三种类型格式

| 类型 | 值格式 | 判断规则 |
|------|--------|---------|
| **外链** | `https://www.example.com?id=${id}` | 以 `http://` 或 `https://` 开头 |
| **内部跳转** | `/dashboard/analysis` 或 `/online/cgformList/{headId}?id=${id}` | 以 `/` 开头，不含 `http` |
| **打开内部组件** | `views/` 下的相对路径，**必须含 `.vue` 后缀**，如 `demo/neibu/index.vue` | 既不以 `http` 也不以 `/` 开头（相对组件路径） |

#### 收集用户信息规则（重要！）

配置 fieldHref 之前，**必须先问用户**，不能自行猜测或补全：

| 类型 | 必须询问用户 |
|------|------------|
| 外链 | 完整的 http/https 地址是什么？ |
| 内部跳转 | 目标菜单的路由路径是什么（从系统菜单配置中查）？ |
| 打开内部组件 | 前端组件的代码路径是什么？该组件是否已存在，还是需要新建？ |

**不要**用占位符（如 `https://example.com`）代替真实值直接写入配置——这会产生无效链接。

#### 配置示例

```json
// 外链（新标签打开百度搜索，带当前行 name 参数）
{"dbFieldName": "link_name", "dbFieldTxt": "外链字段", "fieldShowType": "text", "dbType": "string", "dbLength": 200, "fieldHref": "https://www.baidu.com/s?wd=${name}"}

// 内部跳转（跳到首页分析页）
{"dbFieldName": "jump_field", "dbFieldTxt": "内部跳转字段", "fieldShowType": "text", "dbType": "string", "dbLength": 200, "fieldHref": "/dashboard/analysis"}

// 内部跳转到另一个 Online 表单详情（headId 需替换为目标表单真实 headId）
{"dbFieldName": "ref_id", "dbFieldTxt": "关联记录", "fieldShowType": "text", "dbType": "string", "dbLength": 50, "fieldHref": "/online/cgformList/4396792436db444d8ee0d1ec9068160e?id=${id}"}

// 打开内部组件（路径从 views/ 下开始，不含 views/ 前缀，必须加 .vue 后缀，支持传参）
{"dbFieldName": "comp_field", "dbFieldTxt": "组件跳转字段", "fieldShowType": "text", "dbType": "string", "dbLength": 200, "fieldHref": "demo/neibu/index.vue?product_name=${product_name}&unit_price=${unit_price}&stock_qty=${stock_qty}"}
```

#### 打开内部组件时的参数接收方式

> **⚠️ 重要：** 目标组件必须用 `useRoute().query` 接收参数，不能用 `row` prop。

```ts
import { useRoute } from 'vue-router';
const route = useRoute();
const productName = route.query.product_name as string;
```

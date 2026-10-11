# Online 表单 API 参考文档

本文档是 jeecg-onlform skill 的参考数据，包含完整的 JSON 请求模板和字段枚举。

## 1. addAll 完整请求体模板（单表）

以下是一个包含所有控件类型的完整示例：

```json
{
    "head": {
        "tableVersion": "1",
        "tableName": "表名_snake_case",
        "tableTxt": "表描述文本",
        "tableType": 1,
        "formCategory": "temp",
        "idType": "UUID",
        "isCheckbox": "Y",
        "themeTemplate": "normal",
        "formTemplate": "1",
        "scroll": 1,
        "isPage": "Y",
        "isTree": "N",
        "extConfigJson": "{\"reportPrintShow\":0,\"reportPrintUrl\":\"\",\"joinQuery\":0,\"modelFullscreen\":0,\"modalMinWidth\":\"\",\"commentStatus\":0,\"tableFixedAction\":1,\"tableFixedActionType\":\"right\",\"formLabelLengthShow\":0,\"formLabelLength\":null,\"enableExternalLink\":0,\"externalLinkActions\":\"add,edit,detail\"}",
        "isDesForm": "N",
        "desFormCode": ""
    },
    "fields": [],
    "indexs": [],
    "deleteFieldIds": [],
    "deleteIndexIds": []
}
```

### head 字段说明

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| tableName | string | 是 | - | 数据库表名(snake_case) |
| tableTxt | string | 是 | - | 表描述 |
| tableType | int | 是 | 1 | 1=单表, 2=主表, 3=子表 |
| tableVersion | string | 是 | "1" | 版本号 |
| idType | string | 是 | "UUID" | 主键策略: UUID/NATIVE(自增)/SEQUENCE(Oracle) |
| formCategory | string | 否 | "temp" | 表单分类 |
| formTemplate | string | 否 | "1" | PC表单模板 1=一列, 2=两列, 3=三列, 4=四列 |
| themeTemplate | string | 否 | "normal" | 主题: normal/erp/innerTable/tab |
| isCheckbox | string | 否 | "Y" | 是否显示复选框 |
| isPage | string | 否 | "Y" | 是否分页 |
| isTree | string | 否 | "N" | 是否树形 |
| scroll | int | 否 | 1 | 是否有横向滚动条 |
| extConfigJson | string | 否 | - | 扩展配置JSON字符串 |
| isDesForm | string | 否 | "N" | 是否用设计器表单 |
| desFormCode | string | 否 | "" | 设计器表单编码 |

### 主子表额外 head 字段

| 字段 | 说明 | 何时需要 |
|------|------|---------|
| subTableStr | 子表名列表(逗号分隔) | 主表(tableType=2) |
| relationType | 0=一对多, 1=一对一 | 子表(tableType=3) **必填** |
| tabOrderNum | 附表排序号 | 子表(tableType=3) **必填** |

### 树表额外 head 字段

| 字段 | 说明 |
|------|------|
| treeParentIdField | 父ID字段名(如 "pid") |
| treeIdField | 是否有子节点字段(如 "has_child") |
| treeFieldname | 树展开显示字段(如 "name") |

---

## 2. 系统默认字段（6个，每个表必须包含）

```json
[
    {
        "dbFieldName": "id",
        "dbFieldTxt": "主键",
        "fieldMustInput": "1",
        "isShowForm": 0,
        "isShowList": 0,
        "isReadOnly": 1,
        "fieldShowType": "text",
        "fieldLength": 120,
        "isQuery": 0,
        "queryMode": "single",
        "dbLength": 36,
        "dbPointLength": 0,
        "dbType": "string",
        "dbIsKey": 1,
        "dbIsNull": 0,
        "orderNum": 0
    },
    {
        "dbFieldName": "create_by",
        "dbFieldTxt": "创建人",
        "fieldMustInput": "0",
        "isShowForm": 0,
        "isShowList": 0,
        "sortFlag": "0",
        "isReadOnly": 0,
        "fieldShowType": "text",
        "fieldLength": 120,
        "isQuery": 0,
        "queryMode": "single",
        "dbLength": 50,
        "dbPointLength": 0,
        "dbType": "string",
        "dbIsKey": 0,
        "dbIsNull": 1,
        "orderNum": 1
    },
    {
        "dbFieldName": "create_time",
        "dbFieldTxt": "创建时间",
        "fieldMustInput": "0",
        "isShowForm": 0,
        "isShowList": 0,
        "sortFlag": "0",
        "isReadOnly": 0,
        "fieldShowType": "datetime",
        "fieldLength": 120,
        "isQuery": 0,
        "queryMode": "single",
        "dbLength": 50,
        "dbPointLength": 0,
        "dbType": "Datetime",
        "dbIsKey": 0,
        "dbIsNull": 1,
        "orderNum": 2
    },
    {
        "dbFieldName": "update_by",
        "dbFieldTxt": "更新人",
        "fieldMustInput": "0",
        "isShowForm": 0,
        "isShowList": 0,
        "sortFlag": "0",
        "isReadOnly": 0,
        "fieldShowType": "text",
        "fieldLength": 120,
        "isQuery": 0,
        "queryMode": "single",
        "dbLength": 50,
        "dbPointLength": 0,
        "dbType": "string",
        "dbIsKey": 0,
        "dbIsNull": 1,
        "orderNum": 3
    },
    {
        "dbFieldName": "update_time",
        "dbFieldTxt": "更新时间",
        "fieldMustInput": "0",
        "isShowForm": 0,
        "isShowList": 0,
        "sortFlag": "0",
        "isReadOnly": 0,
        "fieldShowType": "datetime",
        "fieldLength": 120,
        "isQuery": 0,
        "queryMode": "single",
        "dbLength": 50,
        "dbPointLength": 0,
        "dbType": "Datetime",
        "dbIsKey": 0,
        "dbIsNull": 1,
        "orderNum": 4
    },
    {
        "dbFieldName": "sys_org_code",
        "dbFieldTxt": "所属部门",
        "fieldMustInput": "0",
        "isShowForm": 0,
        "isShowList": 0,
        "sortFlag": "0",
        "isReadOnly": 0,
        "fieldShowType": "text",
        "fieldLength": 120,
        "isQuery": 0,
        "queryMode": "single",
        "dbLength": 50,
        "dbPointLength": 0,
        "dbType": "string",
        "dbIsKey": 0,
        "dbIsNull": 1,
        "orderNum": 5
    }
]
```

---

## 3. 业务字段完整属性模板

```json
{
    "id": "前端生成的短ID",
    "dbFieldName": "field_name",
    "dbFieldTxt": "字段标签",
    "queryShowType": null,
    "queryDictTable": "",
    "queryDictField": "",
    "queryDictText": "",
    "queryDefVal": "",
    "queryConfigFlag": "0",
    "mainTable": "",
    "mainField": "",
    "fieldHref": "",
    "fieldValidType": "",
    "fieldMustInput": "0",
    "dictTable": "",
    "dictField": "",
    "dictText": "",
    "isShowForm": 1,
    "isShowList": 1,
    "sortFlag": "0",
    "isReadOnly": 0,
    "fieldShowType": "text",
    "fieldLength": 120,
    "isQuery": 0,
    "queryMode": "single",
    "fieldDefaultValue": "",
    "converter": "",
    "fieldExtendJson": "",
    "dbLength": 100,
    "dbPointLength": 0,
    "dbType": "string",
    "dbIsKey": 0,
    "dbIsNull": 1,
    "orderNum": 6
}
```

---

## 4. fieldShowType 控件类型完整清单

### 基础控件

| fieldShowType | 说明 | 典型 dbType | 典型 dbLength | 字典配置 |
|--------------|------|------------|--------------|---------|
| `text` | 文本输入框 | string | 100 | 不需要 |
| `password` | 密码框 | string | 32 | 不需要 |
| `textarea` | 多行文本 | string | 500 | 不需要 |
| `date` | 日期选择 | Date | 0 | 不需要 |
| `datetime` | 日期时间 | Datetime | 0 | 不需要 |
| `time` | 时间选择 | string | 50 | 不需要 |
| `switch` | 开关 | string | 50 | fieldExtendJson 配置 |
| `file` | 文件上传 | string | 500 | 不需要 |
| `image` | 图片上传 | string | 500 | 不需要 |
| `umeditor` | 富文本编辑器 | Text | 0 | 不需要 |
| `markdown` | Markdown | Blob | 0 | 不需要 |
| `pca` | 省市区联动 | string | 100 | 不需要 |

### 字典控件（使用系统字典）

| fieldShowType | 说明 | dictField | dictTable | dictText |
|--------------|------|-----------|-----------|----------|
| `list` | 字典下拉 | 字典code | `""` | `""` |
| `radio` | 字典单选 | 字典code | `""` | `""` |
| `checkbox` | 字典多选 | 字典code | `""` | `""` |
| `list_multi` | 字典下拉多选 | 字典code | `""` | `""` |
| `cat_tree` | 分类字典树 | 分类编码 | `""` | `""` |

### 字典表控件（使用数据库表）

| fieldShowType | 说明 | dictTable | dictField | dictText |
|--------------|------|-----------|-----------|----------|
| `list` | 字典表下拉 | 表名 | 存储字段 | 显示字段 |
| `radio` | 字典表单选 | 表名 | 存储字段 | 显示字段 |
| `checkbox` | 字典表多选 | 表名 | 存储字段 | 显示字段 |
| `list_multi` | 字典表下拉多选 | 表名 | 存储字段 | 显示字段 |
| `sel_search` | 字典表下拉搜索 | 表名 | 存储字段 | 显示字段 |

### 特殊选择控件

| fieldShowType | 说明 | dictTable | dictField | dictText |
|--------------|------|-----------|-----------|----------|
| `sel_user` | 用户选择 | `""` | `""` | `""` |
| `sel_depart` | 部门选择 | `""` | `""` | `""` |
| `sel_tree` | 自定义树 | 树表名 | 根节点值 | `"id,pid,name,has_child"` |
| `popup` | Popup弹窗 | 弹窗表名 | 存储字段映射 | 回填字段映射 |
| `popup_dict` | Pop字典 | 弹窗表名 | 存储字段 | 显示字段 |

### 关联控件

| fieldShowType | 说明 | dictTable | dictField | dictText | dbIsPersist |
|--------------|------|-----------|-----------|----------|-------------|
| `link_table` | 关联记录 | 关联表名 | 主键字段 | 显示列(逗号分隔) | 1 |
| `link_table_field` | 他表字段 | 本表link_table字段名 | `""` | 显示字段名 | **0** |
| `link_down` | 联动下拉 | JSON配置 | `""` | `""` | 1 |

---

## 5. 各控件类型的完整字段配置示例

### 5.1 text 文本框
```json
{"dbFieldName": "name", "dbFieldTxt": "姓名", "fieldShowType": "text", "dbType": "string", "dbLength": 100, "dbPointLength": 0, "fieldMustInput": "1", "isQuery": 1, "queryMode": "single", "isShowForm": 1, "isShowList": 1}
```

### 5.2 BigDecimal 金额
```json
{"dbFieldName": "price", "dbFieldTxt": "单价", "fieldShowType": "text", "dbType": "BigDecimal", "dbLength": 10, "dbPointLength": 2, "isShowForm": 1, "isShowList": 1}
```

### 5.3 int 整数
```json
{"dbFieldName": "quantity", "dbFieldTxt": "数量", "fieldShowType": "text", "dbType": "int", "dbLength": 9, "dbPointLength": 0, "isShowForm": 1, "isShowList": 1}
```

### 5.4 password 密码
```json
{"dbFieldName": "mi_ma", "dbFieldTxt": "密码", "fieldShowType": "password", "dbType": "string", "dbLength": 32}
```

### 5.5 list 字典下拉
```json
{"dbFieldName": "status", "dbFieldTxt": "状态", "fieldShowType": "list", "dbType": "string", "dbLength": 50, "dictField": "sex", "dictTable": "", "dictText": "", "isQuery": 1}
```

### 5.6 list 字典表下拉
```json
{"dbFieldName": "depart", "dbFieldTxt": "部门", "fieldShowType": "list", "dbType": "string", "dbLength": 255, "dictTable": "sys_depart", "dictField": "id", "dictText": "depart_name", "fieldLength": 200}
```

### 5.7 list 字典表带条件下拉
```json
{"dbFieldName": "user_select", "dbFieldTxt": "用户", "fieldShowType": "list", "dbType": "string", "dbLength": 255, "dictTable": "sys_user where username like '%a%'", "dictField": "username", "dictText": "realname", "fieldLength": 200}
```

### 5.8 radio 字典单选
```json
{"dbFieldName": "sex", "dbFieldTxt": "性别", "fieldShowType": "radio", "dbType": "string", "dbLength": 50, "dictField": "sex", "dictTable": "", "dictText": ""}
```

### 5.9 checkbox 字典多选
```json
{"dbFieldName": "tags", "dbFieldTxt": "标签", "fieldShowType": "checkbox", "dbType": "string", "dbLength": 200, "dictField": "urgent_level", "dictTable": "", "dictText": ""}
```

### 5.10 list_multi 字典下拉多选
```json
{"dbFieldName": "multi", "dbFieldTxt": "多选", "fieldShowType": "list_multi", "dbType": "string", "dbLength": 250, "dictField": "urgent_level", "dictTable": "", "dictText": ""}
```

### 5.11 switch 开关
```json
{"dbFieldName": "enabled", "dbFieldTxt": "启用", "fieldShowType": "switch", "dbType": "string", "dbLength": 50, "dictField": "", "dictTable": "", "dictText": "", "fieldExtendJson": "[\"Y\",\"N\"]"}
```

### 5.12 date 日期
```json
{"dbFieldName": "start_date", "dbFieldTxt": "开始日期", "fieldShowType": "date", "dbType": "Date", "dbLength": 0, "isQuery": 1, "queryMode": "group"}
```

### 5.13 date 年选择
```json
{"dbFieldName": "year", "dbFieldTxt": "年", "fieldShowType": "date", "dbType": "Date", "dbLength": 0, "fieldExtendJson": "{\"labelLength\":6,\"picker\":\"year\"}", "fieldLength": 200}
```

### 5.14 datetime 日期时间
```json
{"dbFieldName": "order_time", "dbFieldTxt": "下单时间", "fieldShowType": "datetime", "dbType": "Datetime", "dbLength": 0}
```

### 5.15 time 时间
```json
{"dbFieldName": "check_time", "dbFieldTxt": "签到时间", "fieldShowType": "time", "dbType": "string", "dbLength": 50, "isQuery": 1, "queryMode": "group"}
```

### 5.16 file 文件上传
```json
{"dbFieldName": "attachment", "dbFieldTxt": "附件", "fieldShowType": "file", "dbType": "string", "dbLength": 500}
```

### 5.17 image 图片上传
```json
{"dbFieldName": "avatar", "dbFieldTxt": "头像", "fieldShowType": "image", "dbType": "string", "dbLength": 500}
```

### 5.18 textarea 多行文本
```json
{"dbFieldName": "remark", "dbFieldTxt": "备注", "fieldShowType": "textarea", "dbType": "string", "dbLength": 500}
```

### 5.19 umeditor 富文本
```json
{"dbFieldName": "content", "dbFieldTxt": "内容", "fieldShowType": "umeditor", "dbType": "Text", "dbLength": 0, "isShowList": 0}
```

### 5.20 markdown
```json
{"dbFieldName": "doc", "dbFieldTxt": "文档", "fieldShowType": "markdown", "dbType": "Blob", "dbLength": 0, "isShowList": 0}
```

### 5.21 sel_user 用户选择
```json
{"dbFieldName": "approver", "dbFieldTxt": "审批人", "fieldShowType": "sel_user", "dbType": "string", "dbLength": 100, "isQuery": 1}
```

### 5.22 sel_depart 部门选择
```json
{"dbFieldName": "dept", "dbFieldTxt": "所在部门", "fieldShowType": "sel_depart", "dbType": "string", "dbLength": 100, "isQuery": 1}
```

### 5.23 pca 省市区
```json
{"dbFieldName": "address", "dbFieldTxt": "地址", "fieldShowType": "pca", "dbType": "string", "dbLength": 100, "isQuery": 1}
```

### 5.24 sel_search 下拉搜索
```json
{"dbFieldName": "user", "dbFieldTxt": "选择用户", "fieldShowType": "sel_search", "dbType": "string", "dbLength": 50, "dictTable": "sys_user", "dictField": "username", "dictText": "realname", "isQuery": 1}
```

### 5.25 cat_tree 分类字典树
```json
{"dbFieldName": "category", "dbFieldTxt": "分类", "fieldShowType": "cat_tree", "dbType": "string", "dbLength": 100, "dictField": "B02", "dictTable": "", "dictText": ""}
```

### 5.26 sel_tree 自定义树
```json
{"dbFieldName": "tree_node", "dbFieldTxt": "树节点", "fieldShowType": "sel_tree", "dbType": "string", "dbLength": 255, "dictTable": "sys_category", "dictField": "0", "dictText": "id,pid,name,has_child"}
```

### 5.27 popup 弹窗选择
```json
{"dbFieldName": "popup_val", "dbFieldTxt": "弹窗选择", "fieldShowType": "popup", "dbType": "string", "dbLength": 100, "dictTable": "report_user", "dictField": "username,realname", "dictText": "popup_val,popup_back"}
```
注意：dictText 中的值是本表接收回填的字段名，需要对应创建 popup_back 字段。

### 5.28 popup_dict Pop字典
```json
{"dbFieldName": "pop_dict", "dbFieldTxt": "Pop字典", "fieldShowType": "popup_dict", "dbType": "string", "dbLength": 100, "dictTable": "report_user", "dictField": "id", "dictText": "realname"}
```

### 5.29 link_table 关联记录（单选）
```json
{"dbFieldName": "related", "dbFieldTxt": "关联记录", "fieldShowType": "link_table", "dbType": "string", "dbLength": 32, "dictTable": "demo_staff", "dictField": "id", "dictText": "name,age,sex", "fieldExtendJson": "{\"showType\":\"card\",\"multiSelect\":false,\"imageField\":\"\"}", "fieldLength": 200}
```

### 5.30 link_table 关联记录（多选带图）
```json
{"dbFieldName": "related_multi", "dbFieldTxt": "关联记录多选", "fieldShowType": "link_table", "dbType": "string", "dbLength": 200, "dictTable": "test_demo", "dictField": "id", "dictText": "name,sex,age", "fieldExtendJson": "{\"showType\":\"card\",\"multiSelect\":true,\"imageField\":\"top_pic\"}", "fieldLength": 200}
```

### 5.31 link_table_field 他表字段
```json
{"dbFieldName": "ta_field", "dbFieldTxt": "他表字段", "fieldShowType": "link_table_field", "dbType": "string", "dbLength": 32, "dictTable": "related", "dictField": "", "dictText": "name", "fieldLength": 200}
```
注意：dictTable 填本表中 link_table 控件的**字段名**（不是数据库表名），dbIsPersist=0。

### 5.32 link_down 联动下拉
```json
{"dbFieldName": "link1", "dbFieldTxt": "联动一", "fieldShowType": "link_down", "dbType": "string", "dbLength": 255, "dictTable": "\n{\n\ttable: \"sys_category\",\n\ttxt: \"name\",\n\tkey: \"id\",\n\tlinkField: \"link2,link3\",\n\tidField: \"id\",\n\tpidField: \"pid\",\n\tcondition:\"pid = '0'\"\n}", "dictField": "", "dictText": ""}
```
被联动的字段（link2、link3）使用普通 text 控件。

---

## 6. fieldValidType 校验规则

| 值 | 说明 | 正则 |
|---|------|------|
| `""` | 无校验 | - |
| `only` | 唯一校验（服务端 duplicateCheck） | - |
| `z` | 整数 | `/^-?\d+$/` |
| `n` | 纯数字(0-9) | `/^\d+$/` |
| `s` | 纯字母(A-Z/a-z) | `/^[a-zA-Z]+$/` |
| `s6-18` | 6-18位字母 | `/^[a-zA-Z]{6,18}$/` |
| `n6-16` | 6-16位数字 | `/^\d{6,16}$/` |
| `*6-16` | 6-16位任意字符 | `/^.{6,16}$/` |
| `*` | 非空 | - |
| `m` | 手机号 | `/^1[3-9]\d{9}$/` |
| `e` | 邮箱 | RFC email |
| `p` | 邮编(6位数字) | `/^\d{6}$/` |
| `url` | URL格式 | `/^https?:\/\/.+/` |
| `money` | 金额格式 | `/^\d+(\.\d{2})?$/` |
| `^正则$` | 自定义正则 | 如 `^[a-z]{2,10}$` |

---

## 7. fieldDefaultValue 默认值表达式

| 语法 | 说明 | 仅新增时生效 |
|------|------|-------------|
| `#{date}` | 当前日期 YYYY-MM-DD | 是 |
| `#{time}` | 当前时间 HH:mm:ss | 是 |
| `#{datetime}` | 当前日期时间 YYYY-MM-DD HH:mm:ss | 是 |
| `#{sysUserId}` | 当前用户ID | 是 |
| `#{sysUserCode}` / `#{sys_user_code}` | 当前用户账号 | 是 |
| `#{sysUserName}` | 当前用户姓名 | 是 |
| `#{sysOrgCode}` / `#{sys_org_code}` | 当前用户部门编码 | 是 |
| `${规则编码}` | 编码规则(自动流水号) | 是 |
| `${规则编码?onl_watch=field1,field2}` | 编码规则+字段变更时重新触发 | 是 |
| `{{JS表达式}}` | 前端JS表达式，如 `{{dayjs().format('YYYY')}}` | 是 |
| 纯字符串 | 直接赋值(如 "Y", "10") | 所有操作 |

---

## 8. extConfigJson 完整默认配置

```json
{
    "reportPrintShow": 0,
    "reportPrintUrl": "",
    "joinQuery": 0,
    "modelFullscreen": 0,
    "modalMinWidth": "",
    "commentStatus": 0,
    "tableFixedAction": 1,
    "tableFixedActionType": "right",
    "formLabelLengthShow": 0,
    "formLabelLength": null,
    "enableExternalLink": 0,
    "externalLinkActions": "add,edit,detail"
}
```

---

## 8.5 fieldExtendJson 扩展配置详解

fieldExtendJson 是一个 **JSON 字符串**，不同控件有不同的扩展配置：

### 文件/图片上传数量限制
```json
{"uploadnum": 3}
```

### 列表文本截断显示
```json
{"showLength": 50}
```

### Popup 多选模式
```json
{"popupMulti": true}
```

### 用户/部门选择器多选
```json
{"multiSelect": true}
```

### 自定义标签宽度
```json
{"labelLength": 8}
```

### 日期选择器变体（年/月/周/季度）
```json
{"picker": "year"}
{"picker": "month"}
{"picker": "week"}
{"picker": "quarter"}
```

### Switch 开关值
```json
["Y","N"]
["1","0"]
```
注意: switch 的 fieldExtendJson 是数组格式，不是对象。

### 关联记录展示模式
```json
{"showType": "card", "multiSelect": false, "imageField": ""}
{"showType": "select", "multiSelect": false, "imageField": ""}
{"showType": "card", "multiSelect": true, "imageField": "avatar"}
```

### 排序规则
```json
{"orderRule": "asc"}
{"orderRule": "desc"}
```

---

## 9. editAll 与 addAll 的关键差异

| 维度 | addAll (新增) | editAll (编辑) |
|------|--------------|----------------|
| head.id | 不传，服务端生成 | **必传** |
| fields[].id | 前端自定义短ID | 已有字段=32位hex ID，新增字段=前端短ID |
| fields[].dbIsPersist | 不传 | 需传(link_table_field=0, 其余=1) |
| fields[].dbDefaultVal | 不传 | 需传 |
| 空值 | 统一用 `""` | 系统字段用 null，业务字段用 `""` |
| head 额外字段 | 无 | 含 isDbSynch、createBy、createTime 等 |
| deleteFieldIds | 空数组 | 可含要删除的字段ID |
| deleteIndexIds | 空数组 | 可含要删除的索引ID |
| 版本号 | 固定 "1" | 服务端自动+1 |

### editAll 新增字段识别规则
- 字段 id 为 32 位 hex → 更新已有字段
- 字段 id 不足 32 位 → 新增字段
- 字段 id 为 "_pk" → 跳过

### editAll 删除操作
- 要删除的字段ID放入 `deleteFieldIds`
- 要删除的索引ID放入 `deleteIndexIds`

---

## 10. 查询现有表单 API

### 按ID查询
```
GET /online/cgform/api/getByHead?id={headId}
```

响应：
```json
{
    "success": true,
    "result": {
        "head": { ... },
        "fields": [ ... ],
        "indexs": [ ... ]
    }
}
```

### 查询表单列表
```
GET /online/cgform/head/list?tableName={表名}&pageNo=1&pageSize=10
```
返回 `result.records[0].id` 即为 headId。

> **tableName 查询规则：**
> - `tableName=ai_desquery_demo` → **精确查找**，只匹配完全一致的表名
> - `tableName=*ai_desquery*` → **模糊查询**，用 `*` 通配符匹配包含该关键词的表名
>
> 编辑表单时建议用精确查找确保匹配到唯一表；探索性搜索时可用模糊查询。

### 查询指定表的字段配置

```
GET /online/cgform/field/listByHeadId?headId={headId}
```

直接返回该表的字段列表（数组），无需过滤、无需分页。**优先使用此接口**。

备选接口：`GET /online/cgform/field/list?headId={headId}&pageNo=1&pageSize=500`（返回所有表的字段混排，需用 `cgformHeadId == headId` 过滤，且需分页遍历）。

---

## 9. 同步数据库 API

创建或编辑表单配置后，需要调用同步数据库 API 将配置同步为真实数据库表。

```
POST /online/cgform/api/doDbSynch/{headId}/{syncType}
```

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| headId | string | 是 | 表单配置的 ID（32位hex，从 addAll 创建后查询获取） |
| syncType | string | 是 | `normal` = 普通同步（增量，不丢数据），`force` = 强制同步（删表重建，丢数据！） |

**使用流程：**
1. 调用 `addAll` 创建表单配置 → 返回 success
2. 调用 `queryPageList?tableName=xxx` 查询刚创建的表单获取 `headId`
3. 调用 `doDbSynch/{headId}/normal` 同步到数据库

**响应示例：**
```json
{
    "success": true,
    "message": "同步成功",
    "code": 200,
    "result": null,
    "timestamp": 1773462789925
}
```

**注意事项：**
- `normal` 模式：仅增加新字段、修改字段属性，不删除已有字段，不丢失数据
- `force` 模式：删除原表并重建，所有数据丢失！仅开发环境使用
- 编辑表单（editAll）后也需要重新同步数据库

---

## 10. 菜单 SQL 模板

将 Online 表单配置为系统菜单，使用户可以在左侧菜单中直接访问。

```sql
INSERT INTO sys_permission(
    id, parent_id, name, url, component, component_name, redirect,
    menu_type, perms, perms_type, sort_no, always_show, icon,
    is_route, is_leaf, keep_alive, hidden, hide_tab,
    description, status, del_flag, rule_flag,
    create_by, create_time, update_by, update_time, internal_or_external
) VALUES (
    '{menuId}',          -- 菜单ID（32位，可用headId或自定义）
    NULL,                -- 父菜单ID（NULL=一级菜单，填ID=子菜单）
    '{tableTxt}',        -- 菜单名称（表描述）
    '/online/cgformList/{headId}',  -- 路由URL（固定格式）
    '1',                 -- component 固定为 '1'（Online组件标识）
    'OnlineAutoList',    -- component_name 固定值
    NULL,                -- redirect
    0,                   -- menu_type: 0=菜单
    NULL,                -- perms 权限编码
    '1',                 -- perms_type: 1=可授权
    0.00,                -- sort_no 排序
    0,                   -- always_show
    NULL,                -- icon 图标
    0,                   -- is_route: 0（Online组件不走路由）
    1,                   -- is_leaf: 1=叶子节点
    0,                   -- keep_alive
    0,                   -- hidden: 0=显示
    0,                   -- hide_tab: 0=显示tab
    NULL,                -- description
    '1',                 -- status: 1=有效
    0,                   -- del_flag: 0=未删除
    0,                   -- rule_flag
    'admin',             -- create_by
    now(),               -- create_time
    NULL,                -- update_by
    NULL,                -- update_time
    0                    -- internal_or_external: 0=内部
);
```

**关键字段说明：**

| 字段 | 固定值 | 说明 |
|------|--------|------|
| url | `/online/cgformList/{headId}` | Online 表单路由，headId 是表单配置ID |
| component | `'1'` | 固定值，前端识别为 Online 组件 |
| component_name | `'OnlineAutoList'` | 固定值，Online 自动列表组件 |
| is_route | `0` | Online 组件不走普通路由 |
| is_leaf | `1` | 必须是叶子节点 |
| parent_id | `NULL` 或父菜单ID | NULL=一级菜单，指定父ID=子菜单 |

---

## 10.5 表名查重（仅按需使用，默认不调用）

> **创建流程默认不调用此接口。** `addAll` 自身会校验表名是否重复并返回明确提示，前置查重属于多余开销。仅当用户明确要求"先检查后再建"时才使用。

```
GET /sys/duplicate/check?tableName=onl_cgform_head&fieldName=table_name&fieldVal={要检查的表名}
```

| 参数 | 说明 |
|------|------|
| tableName | 固定为 `onl_cgform_head`（Online 表单配置表） |
| fieldName | 固定为 `table_name`（检查的字段名） |
| fieldVal | 要检查的表名（如 `ai_demo`） |

返回 `success=true` 表示可用，`success=false` 表示已存在。

---

## 11. 表单管理操作 API（删除/复制/导入）

### 删除表单

```
DELETE /online/cgform/head/delete?id={headId}
```
删除表单配置**并删除对应的数据库表**。

### 批量删除表单

```
DELETE /online/cgform/head/deleteBatch?ids={id1},{id2},{id3}
```
批量删除多个表单配置及对应数据库表。

### 仅移除配置（保留数据库表）

```
DELETE /online/cgform/head/removeRecord?id={headId}
```
仅删除 Online 表单的配置记录，**不删除数据库中的实际表**。适用于想保留数据但不再通过 Online 管理的场景。

### 复制表单（创建视图）

```
POST /online/cgform/head/copyOnline?code={headId}
```
复制一个 Online 表单配置，生成视图表。视图表名格式 `{原表名}${序号}`（如 `ai_demo$1`）。
- 视图有独立的 headId，`physicId` 指向原表
- 视图可独立修改字段显隐、控件类型，不影响原表
- 视图列表通过 `copyType=1&physicId={原表headId}` 过滤

### 复制表单含表（完整复制）

```
GET /online/cgform/head/copyOnlineTable/{headId}?tableName={新表名}
```
复制表单配置并创建独立的新表（完整复制，非视图）。复制后 `isDbSynch=N`，需手动调用同步数据库 API。

### 导入数据库表 — 查询可用表

```
GET /online/cgform/head/queryTables
```
查询数据库中尚未被 Online 管理的表，返回可导入的表名列表。

### 导入数据库表 — 执行导入

```
GET /online/cgform/head/transTables/{tableName}
```
将已有数据库表转换为 Online 表单配置（反向工程），自动识别字段类型和属性。

---

## 12. 索引查询 API

```
GET /online/cgform/index/listByHeadId?headId={headId}
```
查询指定表单的索引配置列表。

---

## 13. 自定义按钮 API

### 按钮列表
```
GET /online/cgform/button/list/{headId}
```

### 新增按钮
```
POST /online/cgform/button/add
```

### 编辑按钮
```
PUT /online/cgform/button/edit
```

### 删除按钮
```
DELETE /online/cgform/button/delete?id={buttonId}
```

### 批量删除按钮
```
DELETE /online/cgform/button/deleteBatch?ids={id1},{id2}
```

### 内置按钮列表
```
GET /online/cgform/button/builtInList/{headId}
```

---

## 14. 增强功能 API（JS/Java/SQL）

### JS 增强
```
GET  /online/cgform/head/enhanceJs/{headId}     # 获取 JS 增强代码
POST /online/cgform/head/enhanceJs/{headId}     # 保存 JS 增强代码
```

### Java 增强
```
GET    /online/cgform/head/enhanceJava/{headId}         # 获取 Java 增强列表
POST   /online/cgform/head/enhanceJava                  # 新增 Java 增强
PUT    /online/cgform/head/enhanceJava                  # 编辑 Java 增强
DELETE /online/cgform/head/deleteBatchEnhanceJava?ids=   # 批量删除 Java 增强
```

### SQL 增强
```
GET    /online/cgform/head/enhanceSql/{headId}           # 获取 SQL 增强列表
POST   /online/cgform/head/enhanceSql                    # 新增 SQL 增强
PUT    /online/cgform/head/enhanceSql                    # 编辑 SQL 增强
DELETE /online/cgform/head/deletebatchEnhanceSql?ids=    # 批量删除 SQL 增强
```

---

## 15. 权限配置 API

### 字段权限
```
GET  /online/cgform/api/authColumn/{cgformId}           # 获取字段权限
POST /online/cgform/api/authColumn                      # 设置字段权限
```

### 按钮权限
```
GET  /online/cgform/api/authButton/{cgformId}           # 获取按钮权限
POST /online/cgform/api/authButton                      # 启用按钮权限
PUT  /online/cgform/api/authButton/{id}                 # 禁用按钮权限
```

### 数据权限
```
GET    /online/cgform/api/authData/{cgformId}            # 获取数据权限规则
POST   /online/cgform/api/authData                      # 新增数据权限规则
PUT    /online/cgform/api/authData                      # 编辑数据权限规则
DELETE /online/cgform/api/authData/{id}                  # 删除数据权限规则
```

### 角色权限
```
POST /online/cgform/api/roleColumnAuth/{roleId}/{cgformId}  # 保存角色字段权限
POST /online/cgform/api/roleButtonAuth/{roleId}/{cgformId}  # 保存角色按钮权限
POST /online/cgform/api/roleDataAuth/{roleId}/{cgformId}    # 保存角色数据权限
```

---

## 16. 代码生成 API

### 生成代码
```
POST /online/cgform/api/codeGenerate
```

### 下载生成的代码
```
GET /online/cgform/api/downGenerateCode
```

### 预览生成的代码
```
GET /online/cgform/api/codeView
```

---

## 17. 数据导入导出 API

### 导入 Excel 数据
```
POST /online/cgform/api/importXls/{tableName}
```
Content-Type: multipart/form-data，上传 Excel 文件。

### 导出 Excel 数据
```
GET /online/cgform/api/exportXlsOld/{headId}?paramsStr={JSON编码的查询参数}
```

| 参数 | 说明 |
|------|------|
| headId | 表单配置 ID（不是表名） |
| paramsStr | URL 编码的 JSON 字符串，如 `{"hasQuery":"true","column":"id","order":"asc","pageNo":1,"pageSize":10}` |

> **注意：该接口使用 chunked 流式输出，仅在浏览器环境下有效。通过 curl/python 等 CLI 工具调用会返回空内容（Content-Length: 0）。**

**CLI 替代方案（CSV 导出）：** 通过 `getData` API 查询数据 + `getColumns` API 获取列定义，用 Python 生成 CSV 文件：
```python
# 1. 获取列定义
cols = api_get(f'/online/cgform/api/getColumns/{HEAD_ID}')
columns = cols['result']['columns']
col_map = {c['dataIndex']: c['title'] for c in columns if c.get('dataIndex') and c['dataIndex'] != 'rowIndex'}

# 2. 获取数据
data = api_get(f'/online/cgform/api/getData/{HEAD_ID}?pageNo=1&pageSize=100&column=createTime&order=desc')
records = data['result']['records']

# 3. 写入 CSV（UTF-8-BOM 编码，Excel 可直接打开不乱码）
import csv
with open('export.csv', 'w', newline='', encoding='utf-8-sig') as f:
    writer = csv.writer(f)
    keys = list(col_map.keys())
    writer.writerow([col_map[k] for k in keys])
    for r in records:
        row = [r.get(f'{k}_dictText', r.get(k, '')) or '' for k in keys]  # 优先用字典翻译值
        writer.writerow(row)
```

---

## 18. AI/AIGC API

### AI 生成表单
```
POST /online/cgform/api/aigc
```

### AI 字段建议
```
GET /online/cgform/api/aigc/fields
```

### AI 生成 Mock 数据
```
POST /online/cgform/api/aigc/mock/data/{tableName}
```

---

## 19. 表单数据运行时 API

### 获取表数据（分页查询）
```
GET /online/cgform/api/getData/{tableName}?pageNo=1&pageSize=10&column=createTime&order=desc
```

### 获取表列定义
```
GET /online/cgform/api/getColumns/{tableName}
```

### 获取查询配置（Vue3）
```
GET /online/cgform/api/getQueryInfoVue3/{tableName}
```

### 获取树形数据
```
GET /online/cgform/api/getTreeData/{tableName}
```

### 获取表单项配置
```
GET /online/cgform/api/getFormItem/{headId}
GET /online/cgform/api/getFormItemBytbname/{tableName}
```

### 获取 ERP 列（一对多子表列）
```
GET /online/cgform/api/getErpColumns/{tableName}
```

### 查询下拉选项
```
GET /online/cgform/api/querySelectOptions
```

### 执行自定义按钮
```
POST /online/cgform/api/doButton
```
支持 GET/POST/PUT/DELETE 多种方法。

### 子表 CRUD
```
GET    /online/cgform/api/subform/list/{tableName}      # 查询子表数据
POST   /online/cgform/api/subform/{id}                  # 新增子表记录
PUT    /online/cgform/api/subform/{id}                  # 编辑子表记录
DELETE /online/cgform/api/subform/{id}                  # 删除子表记录
```

### 唯一性校验
```
POST /online/cgform/api/checkOnlyTable
```

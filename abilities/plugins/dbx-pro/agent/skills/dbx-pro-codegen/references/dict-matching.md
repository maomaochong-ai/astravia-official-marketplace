# 字典自动匹配规则

用户开启"字典自动匹配"后，AI 在构造 ctx 前先查 `sys_dict`，再按规则给字段补 `dictTable` / `dictText` / `dictField` / `classType`。

## 第一步：查全部字典

```bash
mysql --no-defaults --default-character-set=utf8mb4 -h127.0.0.1 -P3306 -uroot -proot {dbname} -e "
SELECT d.dict_code, d.dict_name,
       GROUP_CONCAT(i.item_text, '=', i.item_value ORDER BY i.sort_order SEPARATOR ', ') AS items
FROM sys_dict d
LEFT JOIN sys_dict_item i ON d.id = i.dict_id AND i.status = 1
WHERE d.del_flag = 0
GROUP BY d.dict_code, d.dict_name
ORDER BY d.dict_code"
```

得到一个字典清单：`dict_code` / `dict_name` / `items`。

## 第二步：逐字段匹配

按以下优先级：

1. **用户明确指定** —— "状态用字典 order_status" → 直接用 order_status
2. **fieldName == dict_code** —— 字段 `status` 与 `dict_code = 'status'` 完全相等
3. **关键词匹配** —— 字段注释含某词，搜 `dict_name` 包含该词的字典：
   - "状态" → 含"状态"的 dict_name
   - "类型" → 含"类型"的 dict_name
   - "级别 / 等级" → 含"级别"的 dict_name
4. **不匹配** —— 不设置 dict 字段，column 保持 `classType: "text"`

## 第三步：写到 ctx 上

匹配上的字段，column 这样设：

```json
{
  "fieldName": "orderStatus",
  "filedComment": "订单状态",
  "fieldDbType": "string",
  "fieldType": "java.lang.String",
  "classType": "list",
  "dictField": "order_status"
}
```

模板会自动展开为：

- **Entity.java**：`@Dict(dicCode = "order_status")`
- **data.ts columns**：`dataIndex: 'orderStatus_dictText'`
- **data.ts formSchema**：`{ component: 'JDictSelectTag', componentProps: { dictCode: 'order_status' } }`
- **data.ts searchFormSchema**：同上
- **data.ts superQuerySchema**：`{ view: 'list', dictCode: 'order_status' }`

不需要 AI 自己拼这些。

## 表字典（关联表）

不是 sys_dict，而是普通业务表（如 `sys_user`）：

```json
{
  "fieldName": "operator",
  "filedComment": "操作人",
  "classType": "list",
  "dictTable": "sys_user",
  "dictText": "realname",
  "dictField": "username"
}
```

`sel_user` / `sel_depart` 是表字典的预设别名，模板专门处理：

```json
{ "fieldName": "operator", "classType": "sel_user" }
{ "fieldName": "deptId",   "classType": "sel_depart" }
```

## 分类字典（sys_category 树）

```bash
# 查可选分类
mysql ... -e "SELECT id, code, name, pid FROM sys_category WHERE del_flag=0 ORDER BY code"
```

匹配后：

```json
{
  "fieldName": "schoolArea",
  "filedComment": "所在区域",
  "classType": "cat_tree",
  "dictField": "B03"
}
```

`B03` 是分类树根节点的 `code`。

## 摘要展示规范

在 Step 2 给用户看摘要时，匹配到字典的字段加一列"字典"，例如：

```
| 字段 | 注释 | 类型 | 控件 | 字典 |
| --- | --- | --- | --- | --- |
| orderStatus | 订单状态 | varchar | JDictSelectTag | order_status (待付款=0, 已付款=1, 已完成=2) |
| operator | 操作人 | varchar | JSelectUserByDept | sys_user.username → realname |
```

让用户在生成前能直观确认匹配结果。

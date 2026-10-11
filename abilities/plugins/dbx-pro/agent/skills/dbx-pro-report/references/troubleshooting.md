# 积木报表报错排查流程

## 第一步：查看模板 JSON 是否有问题

```python
# GET /jmreport/get/{id} — 获取报表完整配置
r = session.get(f"/get/{report_id}")
data = r["result"]
designer = json.loads(data.get("designerObj", "{}"))
json_str  = json.loads(data.get("jsonStr", "{}"))

# 重点检查：
# 1. designerObj: name/id/code 是否为 None（报表不存在或保存异常）
# 2. jsonStr 中 rows 的 text 绑定是否合法（#{dbCode.field} 格式）
# 3. chartList 的 extData.dbCode / dataId 是否匹配已有数据集
```

## 第二步：调用 /jmreport/show 看运行时报错

```python
# POST /jmreport/show — 模拟报表预览，返回实际执行错误
payload = {"id": report_id, "dbKey": "", "token": TOKEN}
r = session.request("/show", payload)
# 返回 success:false 时，message 字段即为根因
# 常见错误：SQL语法错误、数据源不存在、字段名不匹配
```

> **注意**：`/jmreport/show/{id}` (路径参数) 会报 "No static resource"，必须用 POST body 传 `id`。

## 第三步：根据错误修复

| 错误信息 | 原因 | 修复 |
|---------|------|------|
| `No static resource jmreport/show/xxx` | 用了路径参数而非 body | 改成 POST body: `{"id": "xxx"}` |
| `designerObj` name/id/code 为 null | 报表不存在或 ID 错误 | 确认 ID，重新创建 |
| SQL 语法错误 | 数据集 SQL 有问题 | `GET /jmreport/get/{id}` 查 dbDynSql 修正 |
| 数据源找不到 | dbSource 传了名称而非 ID | 先 `getDataSourceByPage` 查 ID |
| 字段绑定为空 | `#{dbCode.field}` 中 dbCode 或 field 名不匹配 | 对照数据集 fieldList 检查 |

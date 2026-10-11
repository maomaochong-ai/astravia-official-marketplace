# 多 Sheet 接口

积木报表支持多 Sheet（最多 11 个）。默认报表只有一个 `id="default"` 的 Sheet。

---

## 一、添加 Sheet

**POST** `/jmreport/sheet/addSheet`

```json
{
    "reportId": "报表ID",
    "sheetName": "Sheet1",
    "order": 1
}
```

**返回：** `result` 为新 Sheet 的 ID

```json
{"success": true, "code": 200, "result": "1201812919127990272"}
```

> 最多支持 11 个 Sheet。

---

## 二、重命名 Sheet

**POST** `/jmreport/sheet/renameSheet`

```json
{
    "reportId": "报表ID",
    "sheetId": "Sheet的ID",
    "newName": "新名称"
}
```

---

## 三、多 Sheet 保存

与第一个 Sheet 的 save JSON 结构相同，区别是最外层多三个属性：

```json
{
    "designerObj": "...",
    "rows": {...},
    "cols": {...},
    "styles": [...],
    "merges": [...],
    "sheetId": "1201812919127990272",
    "sheetName": "测试",
    "sheetOrder": 1
}
```

| 字段 | 说明 |
|------|------|
| `sheetId` | addSheet 返回的 Sheet ID |
| `sheetName` | Sheet 名称 |
| `sheetOrder` | Sheet 排序序号（从 1 开始，默认 Sheet 为 0） |

> 默认 Sheet（第一个）的 sheetId 为 `"default"`，不需要传这三个属性。

---

## 四、查询报表（含 Sheet 信息）

**GET** `/jmreport/get/{reportId}?token={token}`

返回的 `result` 中新增字段：

| 字段 | 说明 |
|------|------|
| `isMultiSheet` | `1`=多 Sheet 报表 |
| `sheets` | Sheet 列表，每项含 `{name, id, order}` |

---

## 五、使用流程

```
1. 创建报表（/save）         → 拿到 report_id（此时只有默认 Sheet）
2. 添加 Sheet（/addSheet）   → 拿到 sheet_id
3. 可选：重命名（/renameSheet）
4. 保存 Sheet 内容（/save）  → 传 sheetId/sheetName/sheetOrder
5. 查询报表（/get）          → 可看到所有 sheets 列表
```

### 脚本示例

```python
# 添加 Sheet
sheet_resp = session.request("/sheet/addSheet", {
    "reportId": report_id,
    "sheetName": "Sheet2",
    "order": 1,
})
sheet_id = sheet_resp["result"]

# 保存该 Sheet 的内容
payload = base_save(report_id, designer,
    rows=rows2, cols=cols2, styles=styles2, merges=merges2,
)
payload["sheetId"] = sheet_id
payload["sheetName"] = "Sheet2"
payload["sheetOrder"] = 1
session.request("/save", payload)
```

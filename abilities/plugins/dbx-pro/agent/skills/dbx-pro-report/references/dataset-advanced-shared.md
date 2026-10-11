> 属于「数据集进阶」拆分组（§5~6），索引见 `references/dataset-advanced.md`

# 数据集进阶：主子表联动 + 共享数据集

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

> ⚠️ **删除前置条件**：若该共享数据集已被报表通过 `linkJmReportShareDb` 关联，直接调用此接口会返回 `code:500`，提示「该共享数据集下存在报表引用，无法删除！」。
> 需先在报表设计器中手动解除所有关联，或直接操作数据库删除 `jimu_report_share_db` 表中对应的关联记录，再重新调用此接口删除。
> 若无报表引用，可直接删除，无需额外步骤。

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

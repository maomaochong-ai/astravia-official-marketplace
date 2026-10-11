# 报表组合（group API）

将多张已有积木报表聚合为一个"组合报表"，一个页面里依次展示所有子报表。

## 创建 / 更新

**端点**：`POST /jmreport/group/save`  
`id` 为空字符串 = 新建；有值 = 更新已有组合。

```json
{
    "id": "已有组合ID或空字符串",
    "name": "组合名称",
    "descr": "",
    "reportList": [
        {"id": "报表ID1", "name": "报表名1", "params": {"name": "name"}},
        {"id": "报表ID2", "name": "报表名2", "params": {}}
    ],
    "reportIds": "报表ID1,报表ID2",
    "dataValue": "[{\"reportId\":\"报表ID1\",\"params\":{\"name\":\"name\"}},{\"reportId\":\"报表ID2\"}]"
}
```

> **三字段联动**：`reportIds`、`reportList`、`dataValue` 必须保持一致。  
> `dataValue` 中 `params` **非空时必须写入**，空时省略该字段（不写 `"params":{}`）。

### Python

```python
from report_tools import save_report_group

save_report_group(
    base_url="http://host:port/jmreport",
    token="xxx",
    name="学生成绩",
    report_list=[
        {"id": "1777549042739966454", "name": "学校信息统计", "params": {"name": "name"}},
        {"id": "1777548950304797130", "name": "学生成绩交叉统计表", "params": {}},
    ],
    descr="",                          # 可选
    group_id="1212611876709953536",    # 空=新建，有值=更新
)
```

### CLI

```bash
# 新建
python report_tools.py --base-url http://host/jmreport --token T \
    group-save --name "学生成绩" \
    --ids "1777549042739966454,1777548950304797130" \
    --names "学校信息统计,学生成绩交叉统计表"

# 更新（加 --group-id）
python report_tools.py --base-url http://host/jmreport --token T \
    group-save --name "学生成绩" --ids "id1,id2" --group-id "已有组合ID"
```

> `--ids` / `--names` 顺序一一对应；`--names` 可省略。

---

## 删除

**端点**：`GET /jmreport/group/delete?id=<组合ID>&token=<token>`  
token 同时通过 header（`X-Access-Token`）和 query 参数传递。

### Python

```python
from report_tools import delete_report_group

delete_report_group(
    base_url="http://host:port/jmreport",
    token="xxx",
    group_id="1212611876709953536",
)
```

### CLI

```bash
python report_tools.py --base-url http://host/jmreport --token T \
    group-delete 1212611876709953536
```

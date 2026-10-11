# 字典管理（jimu_dict / jimu_dict_item）

大屏/仪表盘的字典翻译使用 `jimu_dict` 和 `jimu_dict_item` 表，**不是**系统字典表 `sys_dict` / `sys_dict_item`。

## 关键区别

| 项目 | 大屏字典（正确） | 系统字典（错误） |
|------|-----------------|-----------------|
| 数据库表 | `jimu_dict` / `jimu_dict_item` | `sys_dict` / `sys_dict_item` |
| API 前缀 | `/jmreport/dict/*`、`/jmreport/dictItem/*` | `/sys/dict/*`、`/sys/dictItem/*` |
| 使用场景 | 大屏/仪表盘组件的数据集字典翻译 | JeecgBoot 系统业务字典 |

## API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/jmreport/dict/list` | GET | 分页查询字典列表 |
| `/jmreport/dict/add` | POST | 新增字典 |
| `/jmreport/dict/edit` | POST | 编辑字典 |
| `/jmreport/dictItem/list` | GET | 查询字典项列表（`dictId` 过滤） |
| `/jmreport/dictItem/add` | POST | 新增字典项 |
| `/jmreport/dictItem/edit` | POST | 编辑字典项 |

## 实体结构

```python
# jimu_dict
{'dictName': '性别新', 'dictCode': 'sexnew', 'description': '性别字典'}

# jimu_dict_item
{'dictId': '字典主表ID', 'itemText': '男性', 'itemValue': '1', 'sortOrder': 1, 'status': 1}
```

## 创建字典完整示例

```python
# 1. 检查字典是否已存在
check = req('GET', '/jmreport/dict/list', params={'dictCode': 'sexnew', 'pageNo': 1, 'pageSize': 10})
records = check.get('result', {}).get('records', [])

# 2. 创建字典主表
if not records:
    add_result = req('POST', '/jmreport/dict/add', data={
        'dictName': '性别新', 'dictCode': 'sexnew', 'description': '性别字典',
    })
    # 注意：返回 result 为 null，需要重新查询获取 ID
    re_query = req('GET', '/jmreport/dict/list', params={'dictCode': 'sexnew', 'pageNo': 1, 'pageSize': 10})
    dict_id = re_query['result']['records'][0]['id']

# 3. 创建字典项
for item in [
    {'itemText': '男性', 'itemValue': '1', 'sortOrder': 1},
    {'itemText': '女性', 'itemValue': '2', 'sortOrder': 2},
    {'itemText': '其他', 'itemValue': '0', 'sortOrder': 3},
]:
    req('POST', '/jmreport/dictItem/add', data={
        'dictId': dict_id, 'itemText': item['itemText'],
        'itemValue': item['itemValue'], 'sortOrder': item['sortOrder'], 'status': 1,
    })
```

## 数据集中使用字典翻译

在 `datasetItemList` 中通过 `dictCode` 绑定字典：

```python
'datasetItemList': [
    {'fieldName': 'name', 'fieldTxt': 'name', 'fieldType': 'String',
     'izShow': 'Y', 'orderNum': 0, 'dictCode': 'sexnew'},  # 绑定字典翻译
    {'fieldName': 'value', 'fieldTxt': 'value', 'fieldType': 'String',
     'izShow': 'Y', 'orderNum': 1}
]
```

绑定后，数据集查询返回的 `dictOptions` 包含翻译映射，组件渲染时自动将 `name=1` 显示为"男性"。

## 踩坑记录

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **字典翻译不生效** | 字典创建到了 `sys_dict` 表 | 必须使用 `/jmreport/dict/add` |
| **创建字典后返回 result=null** | add 接口不返回 ID | 创建后重新查询获取 ID |
| **字典项 itemValue 类型** | 必须是字符串 | `'1'` 而不是 `1` |
| **dictCode 不是 dictId** | 数据集绑定用编码不是 ID | `dictCode` 填 `'sexnew'` |

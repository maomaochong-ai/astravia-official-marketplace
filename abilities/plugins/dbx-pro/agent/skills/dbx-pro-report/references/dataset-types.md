# 数据集类型与字段解析速查

## 解析方式对照表

| 数据集类型 | dbType | 解析方式 | 工具函数/说明 |
|-----------|--------|---------|---------|
| SQL | `"0"` | `POST /queryFieldBySql`（传 sql + dbSource） | `parse_sql(session, sql, db_source)` |
| API | `"1"` | `POST /executeSelectApi?api=URL&method=0` | `parse_api(session, api_url)` — saveDb 额外传 `apiUrl=URL, apiMethod="0"(GET)/"1"(POST)` |
| JSON | `"3"` | **手动构建** fieldList，无需调接口 | `[{"fieldName":..,"fieldText":..,"widgetType":"String"/"Number","orderNum":N}]` |
| 共享数据集 | `"4"` | 复用已有数据集，无需解析 | `linkJmReportShareDb` 关联到报表 |
| 多文件(Excel/CSV) | `"5"` | 先上传文件，再 `queryFieldBySql`（dbSource=文件数据源ID，SQL 表名加 `jmf.` 前缀） | 详见 `dataset-advanced.md §4.1` |
| 单文件(Excel/CSV) | `"6"` | 上传文件后系统自动解析，用专用接口 `/dataset/files/single/save`（不能用 saveDb） | 详见 `dataset-advanced.md §4` |
| JavaBean | `"2"` | `POST /queryFieldByBean`（传 javaType + javaValue） | `javaType="spring-key"`, `javaValue=Bean名称`；**chart_entry `data_type="javabean"`**；设计态 `/qurestSql` 不可用，数据由运行时引擎调 `createData()` 提供 |
| Redis | `"0"`* | `queryFieldBySql`（sql=Redis key名，dbSource=Redis数据源ID） | 数据源 dbType="redis"，但**数据集** dbType 仍为 `"0"` |
| MongoDB | `"0"`* | `queryFieldBySql`（SQL 加 `mongo.` 前缀，dbSource=MongoDB数据源ID） | 数据源 dbType="mongodb"，数据集 dbType 仍为 `"0"` |
| Elasticsearch | `"0"`* | `queryFieldBySql`（dbSource=ES数据源ID） | 数据源 dbType="es" |

> `*` Redis / MongoDB / ES 的**数据集** dbType 均为 `"0"`，区别在于 `dbSource` 指向对应类型的数据源。JavaBean 使用独立的 `dbType="2"`，不需要 dbSource，通过 `javaType`+`javaValue` 识别。

## 多数据集并行

```python
field_lists = parallel_parse_sqls(session, [{"sql": sql1}, {"sql": sql2}])
db_ids      = parallel_save_dbs(session, [{"report_id":..., "db_code":..., ...}, ...])
```

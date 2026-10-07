# 数据完整性判断

## dbx_query_full 返回的 5 个关键字段

每次调用 dbx_query_full，**必须检查以下字段才能判断数据是否完整**：

| 字段 | 值 | 含义 |
|------|---|------|
| `completeness` | `"complete"` | ✅ 数据完整。总行数已知，已全部返回 |
| | `"truncated"` | ⚠️ 数据被截断。知道总行数，但 maxRows 不够，还有数据没拉 |
| | `"unknown"` | ❓ 不知道全不全。引擎不支持分页，只拉了第一页（最多 1000 行） |
| `pagination` | `"supported"` | 引擎支持分页，可以完整拉取 |
| | `"unsupported"` | 引擎/DB/SQL 不支持分页 |
| `totalRows` | number \| undefined | 引擎报告的真实总行数（仅分页且 completeness≠unknown 时可用） |
| `rowCount` | number | 本次实际返回的行数 |
| `isTruncated` | boolean | 快捷判断：是否被截断 |

## 三种场景的处理策略

### 场景 1: `completeness: "complete"` ✅

```
dbx_query_full 成功返回，pagination=supported，totalRows 已知，
rowCount >= totalRows。数据完整，可以直接用。
```

**Agent 行动**：放心用 rows 做 Chart.js 图表。

### 场景 2: `completeness: "truncated"` ⚠️

```
pagination=supported，totalRows=5231，rowCount=1832。
还有 3399 行没拉，因为 maxRows=2000 不够。
```

**Agent 行动**：
1. 增大 maxRows 重跑：`dbx_query_full(connection, sql, maxRows=6000)`
2. 或在 SQL 里加 LIMIT / TOP N 先看前几行
3. 不要用这批截断的数据做图表——图表会漏数据

### 场景 3: `completeness: "unknown"` / `pagination: "unsupported"` ❓

```
引擎不支持分页（某些 DB 类型或特定 SQL 形态）。
只返回了 1000 行，不知道实际总行数。
返回 note 类似："Pagination not supported by this DB/SQL — got 1000 rows, unknown total."
```

**Agent 行动**（按优先级）：
1. **不要放弃，先换一个 DB 试**——同一连接上其他查询可能支持分页
2. **写 COUNT 子查询拿真实总数**：
   ```sql
   SELECT COUNT(*) FROM (SELECT ... FROM orders WHERE ...) AS sub
   ```
   知道总数后再决定是否继续（如果总数 < 1000 那当前数据就是完整的）
3. **改用 dbx MCP execute_query 拿第一页**，但在图表里加标注："数据可能不全，仅展示前 1000 行"
4. **加 SQL 侧 LIMIT 确保可控**：`SELECT ... LIMIT 1000`（聚合 SQL 通常天然少行，不会截断）

## 黄金法则

> 永远不要在没看 completeness 字段的情况下直接把 rows 做成图表。
> 图表少几行不只是"小误差"——在聚合场景下，少一行 GROUP BY 就少一个维度，
> 可能漏掉整个分类。

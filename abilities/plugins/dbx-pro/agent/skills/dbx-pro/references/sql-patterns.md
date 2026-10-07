# SQL 写得好不好，直接决定结果全不全

## 引擎 1000 行硬上限

引擎（dbx engine）单次查询最多返回 1000 行。**写 SQL 时必须考虑这个限制**。

## 好 SQL vs 坏 SQL

### ❌ 坏 SQL — 明细查询

```sql
SELECT * FROM orders;                                    -- 1000 行截断，不知道总共多少行
SELECT * FROM orders WHERE created_at > '2025-01-01';    -- 仍然可能超 1000 行
```

问题：返回大量行，会被截断。就算 dbx_query_full 分页拼页，明细行也没有业务意义。

### ✅ 好 SQL — 聚合查询

```sql
-- 维度压缩到有限个，天然少行
SELECT category, SUM(amount) AS total FROM orders GROUP BY category;

-- 时间聚合：按月而非按日
SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS cnt
FROM orders GROUP BY month;

-- 带 WHERE 限定范围
SELECT channel, SUM(amount) AS total
FROM orders
WHERE created_at BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY channel;

-- TOP N 排名图表只需要前 N
SELECT product, SUM(amount) AS total
FROM orders GROUP BY product
ORDER BY total DESC
LIMIT 20;
```

### ✅ 好 SQL — COUNT 确认总行数

```sql
-- 分页不支持时，先跑 COUNT 知道到底要多少行
SELECT COUNT(*) FROM (
  SELECT category, SUM(amount) AS total FROM orders GROUP BY category
) AS sub;
```

## 按图表类型写 SQL

| 图表类型 | SQL 模式 | 维度数 |
|---------|---------|--------|
| line 趋势 | `GROUP BY time_unit` | 1（时间） |
| bar 排名 | `GROUP BY category ORDER BY metric DESC LIMIT 20` | 1-2 |
| pie 占比 | `GROUP BY category`（分类 ≤ 8） | 1（有限分类） |
| scatter 相关 | `SELECT x, y FROM table`（明细） | 2 |
| bubble 三变量 | `SELECT x, y, z FROM table`（明细） | 3 |

scatter/bubble 需要明细行时，控制在几百行内（加 WHERE 或 LIMIT），不要直接 SELECT *。

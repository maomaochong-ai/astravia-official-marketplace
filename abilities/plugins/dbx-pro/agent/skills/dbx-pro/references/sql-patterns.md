# SQL 本身决定数据量 — 这是客观事实

## 核心观点

> **工具是拿不到"不存在的数据"的。**
>
> 引擎有 1000 行硬上限 + dbx_query_full 能分页拼页，但如果你的 SQL 返回
> 10000 行明细，就算你能拉到全部 10000 行——那 10000 行塞进 LLM context
> 也是灾难，做图表也没有业务意义（散点图 10000 个点肉眼根本看不清）。
>
> **真正的解法是写好 SQL，从源头上让数据量可控。**

## 引擎 1000 行硬上限

引擎（dbx engine）单次查询最多返回 1000 行。分页拼页能绕开，但绕开了
之后数据量本身的问题还在——多出来的行数不会凭空变成"有用的信息"。

## 按聚合粒度压缩数据量

### 好 SQL — 天然少行

```sql
-- 维度压缩到有限个，聚合后可能只有几行到几十行
SELECT category, SUM(amount) AS total FROM orders GROUP BY category;

-- 时间聚合：按月（12 行/年）而非按日（365 行/年）
SELECT DATE_TRUNC('month', created_at) AS month, COUNT(*) AS cnt
FROM orders GROUP BY month;

-- 带 WHERE 限定范围
SELECT channel, SUM(amount) AS total
FROM orders
WHERE created_at BETWEEN '2025-01-01' AND '2025-12-31'
GROUP BY channel;

-- TOP N 排名图表只需要前 N 行
SELECT product, SUM(amount) AS total
FROM orders GROUP BY product
ORDER BY total DESC
LIMIT 20;
```

### 坏 SQL — 天然多行

```sql
-- 明细表：直接返回几千到几十万行
SELECT * FROM orders;                                    -- 问题不是引擎截断，是 SQL 本身没聚合
SELECT * FROM orders WHERE created_at > '2025-01-01';    -- WHERE 不能代替 GROUP BY

-- 多维度交叉产生大量组合：category × month × channel = 可能几百行
SELECT category, DATE_TRUNC('month', created_at) AS month, channel, SUM(amount)
FROM orders GROUP BY category, month, channel;
-- 如果 category 有 10 个 × month 12 × channel 5 = 600 行，还能接受
-- 但如果 category 有 100 个 × month 12 = 1200 行，开始失控
-- 解决：选两个最重要的维度，砍掉交叉
```

## 数据量估算（写 SQL 之前先算）

| GROUP BY 维度 | 典型基数 | 聚合后行数 |
|---|---|---|
| category（产品分类） | 5-20 | 5-20 ✅ |
| month × channel | 12 × 3 = 36 | 36 ✅ |
| customer | 100-1000 | 可能超 ❌ |
| product × month | 100 × 12 = 1200 | 临界 ⚠️ |
| id（明细主键） | 10000+ | 完全失控 ❌ |

**规则**：写 SQL 前先算 GROUP BY 的笛卡儿积。超过 500 行就要考虑降维
（砍掉一个分组维度、或者加 WHERE 限定范围）。

## COUNT 知道真实规模

```sql
-- 分页不支持时，先跑 COUNT 知道到底要多少行
SELECT COUNT(*) FROM (
  SELECT category, SUM(amount) AS total FROM orders GROUP BY category
) AS sub;

-- 如果 COUNT 返回值远小于 1000，就算不分页也是完整数据
-- 如果 COUNT 返回值 > 1000，先想能不能改 SQL 降维
```

## 按图表类型写 SQL

| 图表类型 | SQL 模式 | 维度数 | 数据量预估 |
|---------|---------|--------|-----------|
| line 趋势 | `GROUP BY time_unit` | 1（时间） | 月: 12/年, 季: 4/年 ✅ |
| bar 排名 | `GROUP BY category ORDER BY metric DESC LIMIT 20` | 1-2 | ≤ 20 ✅ |
| pie 占比 | `GROUP BY category` | 1（有限分类） | ≤ 8 ✅ |
| scatter 相关 | `SELECT x, y FROM table` | 2 | 需要明细行，控制 ≤ 500 行 ⚠️ |
| bubble 三变量 | `SELECT x, y, z FROM table` | 3 | 需要明细行，控制 ≤ 300 行 ⚠️ |

scatter/bubble 需要明细行时，加 WHERE 或 LIMIT 控制在几百行内，
不要直接 SELECT *（会拉几万行，图表里看不清）。

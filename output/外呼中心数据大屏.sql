-- 外呼中心数据大屏 · 取数脚本
-- 数据源：pgsql / new_schema.new_table
-- 样本区间：2026-10-08 09:00:00 ~ 2026-10-08 14:25:00（10 通，演示数据）
--
-- 说明：全部指标均来自真实查询，无任何模拟／推算值。
--       phone 等敏感列不参与任何图表展示。

-- ① 核心 KPI + 时段 / 结果 / 部门明细聚合（大屏全部数值的唯一来源）
SELECT 'kpi_total_calls'  AS k, count(*)::text                                   AS v FROM new_schema.new_table
UNION ALL SELECT 'kpi_connected',      count(*) FILTER (WHERE connection_status = '已接通')::text FROM new_schema.new_table
UNION ALL SELECT 'kpi_customers',      count(DISTINCT customer_name)::text                        FROM new_schema.new_table
UNION ALL SELECT 'kpi_duration_sum',   coalesce(sum(call_duration), 0)::text                      FROM new_schema.new_table
UNION ALL SELECT 'kpi_duration_avg',   round(coalesce(avg(call_duration), 0), 1)::text            FROM new_schema.new_table
UNION ALL SELECT 'kpi_time_range',     min(call_time)::text || ' ~ ' || max(call_time)::text      FROM new_schema.new_table
UNION ALL SELECT 'status_'     || connection_status,             count(*)::text FROM new_schema.new_table GROUP BY 1
UNION ALL SELECT 'hour_calls_' || to_char(call_time, 'HH24:00'), count(*)::text FROM new_schema.new_table GROUP BY 1
UNION ALL SELECT 'hour_secs_'  || to_char(call_time, 'HH24:00'), sum(call_duration)::text FROM new_schema.new_table GROUP BY 1
UNION ALL SELECT 'result_'     || call_result,                   count(*)::text FROM new_schema.new_table GROUP BY 1
UNION ALL SELECT 'dept_calls_' || dept_id,                       count(*)::text FROM new_schema.new_table GROUP BY 1
UNION ALL SELECT 'dept_secs_'  || dept_id,                       sum(call_duration)::text FROM new_schema.new_table GROUP BY 1
UNION ALL SELECT 'op_calls_'   || create_by,                     count(*)::text FROM new_schema.new_table GROUP BY 1
UNION ALL SELECT 'dur_bucket_' || CASE
           WHEN call_duration < 60  THEN '00_<1分钟'
           WHEN call_duration < 120 THEN '01_1-2分钟'
           WHEN call_duration < 180 THEN '02_2-3分钟'
           ELSE '03_>=3分钟' END, count(*)::text
  FROM new_schema.new_table GROUP BY 1
ORDER BY 1;

-- ② 时段 × 接通状态 / 结果 × 接通状态 / 部门 × 结果 交叉验证
SELECT 'hs_' || to_char(call_time, 'HH24:00') || '_' || connection_status AS k, count(*)::text AS v
  FROM new_schema.new_table GROUP BY 1
UNION ALL SELECT 'dr_' || call_result || '_' || CASE WHEN connection_status = '已接通' THEN '接通' ELSE '未接通' END, count(*)::text
  FROM new_schema.new_table GROUP BY 1
UNION ALL SELECT 'mx_' || dept_id || '_' || call_result, count(*)::text
  FROM new_schema.new_table GROUP BY 1
ORDER BY 1;

-- 大屏取值结果（与 output/外呼中心数据大屏.spec.json 一一对应）
--   外呼总量 10 通 | 接通通话 6 通 | 接通率 60.0 % | 平均通话时长 99.6 秒
--   各时段外呼量：09:00=3  10:00=3  11:00=2  14:00=2
--   各时段通话总时长（秒）：09:00=335  10:00=410  11:00=96  14:00=155
--   通话结果分布：承诺还款=3  号码为空号=2  需再次跟进=2  无人接听=2  拒绝还款=1
--   通话时长分布：<1分钟=4  1-2分钟=2  2-3分钟=2  ≥3分钟=2
--   部门通话时长（秒）：D001=125  D002=278  D003=438  D004=155
--   未接通 4 通 | 承诺还款 3 单 | 需再次跟进 2 单 | 通话总时长 996 秒

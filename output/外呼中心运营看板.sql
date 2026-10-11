-- 外呼中心运营看板 —— 取数口径（与 外呼中心运营看板.html 中每张图一一对应）
-- 连接：pgsql-dev（PostgreSQL，47.106.121.38:9286，库 rongshan_dw）
-- 表：new_schema.new_table
-- 口径：全表（当前为 2026-10-08 的 10 条示例通话记录，非生产全量），无时间过滤条件
-- 隐私：phone 列不参与任何聚合，也不进入产物
-- 说明：数据量很小（10 行），所有指标都是明细直算，未做加权重或补点

-- [1] 核心指标（外呼总量 / 接通通话 / 接通率 / 平均通话时长）
select
  count(*)                                                                  as total_calls,
  count(*) filter (where connection_status = '已接通')                       as connected_calls,
  round(100.0 * count(*) filter (where connection_status = '已接通') / nullif(count(*), 0), 1) as connect_rate_pct,
  round(avg(call_duration), 1)                                              as avg_duration_sec
from new_schema.new_table;

-- [2] 外呼转化漏斗（外呼总量 → 接通通话 → 承诺还款）
select
  count(*)                                                     as 外呼总量,
  count(*) filter (where connection_status = '已接通')          as 接通通话,
  count(*) filter (where call_result = '承诺还款')              as 承诺还款
from new_schema.new_table;

-- [3] 接通状态分布
select connection_status as name, count(*) as value
from new_schema.new_table
group by connection_status
order by value desc;

-- [4][5][6] 各时段：外呼量 / 接通率 / 通话总时长（按 call_time 小时切分）
select
  to_char(call_time, 'HH24') || '时'                                     as hour_label,
  count(*)                                                              as calls,
  count(*) filter (where connection_status = '已接通')                   as connected,
  round(100.0 * count(*) filter (where connection_status = '已接通') / count(*), 1) as connect_rate_pct,
  coalesce(sum(call_duration), 0)                                       as duration_sec
from new_schema.new_table
group by 1
order by 1;

-- [7] 通话结果分布
select call_result as name, count(*) as value
from new_schema.new_table
group by call_result
order by value desc;

-- [8] 通话时长分档
select
  case
    when call_duration < 60  then '<1分钟'
    when call_duration < 120 then '1-2分钟'
    when call_duration < 180 then '2-3分钟'
    else '≥3分钟'
  end                   as bucket,
  count(*)              as value
from new_schema.new_table
group by 1
order by 1;

-- [9][10] 各部门：通话量 / 通话总时长
select
  dept_id                        as dept,
  count(*)                       as calls,
  coalesce(sum(call_duration), 0) as duration_sec,
  round(avg(call_duration), 1)   as avg_duration_sec
from new_schema.new_table
group by dept_id
order by dept_id;

-- 数据窗口与规模（用于标注“示例数据”）
select
  min(call_time) as 起始,
  max(call_time) as 结束,
  count(*)       as 行数,
  count(distinct create_by) as 坐席数
from new_schema.new_table;

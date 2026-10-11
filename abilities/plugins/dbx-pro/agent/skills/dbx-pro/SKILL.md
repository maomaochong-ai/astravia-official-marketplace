---
name: dbx-pro
version: 0.0.113
description: >-
  dbx-pro 数据库工作台与 BI 可视化插件。连接 PostgreSQL/MySQL/SQLite/ClickHouse 等 60+ 数据库，
  AI 写 SQL 执行查询，生成 ECharts 看板、大屏、报表，支持 28 种 ECharts 组件 + 12 种 HTML 组件，
  内置 10 个行业模板（旅游/政务/医疗/金融/环保/警务/集团/科技），
  提供 5 套命名色板（科技/政务/商务/复古/医疗）自动应用深色主题。
  触发：用户说"看板/大屏/图表/报表/可视化/仪表盘"或描述数据展示需求。
---

# dbx-pro —— 数据库工作台 + BI 可视化

## 触发条件

用户提到数据库操作、SQL 查询、看板/大屏/图表/报表/仪表盘/可视化/BI 展示时。

## 工具清单

| 工具 | 说明 |
|---|---|
| `dbx_execute_query` | 执行 SQL 查询（直连 dbx MCP 连接池） |
| `dbx_describe_table` | 获取表结构（列名/类型/注释）|
| `dbx_list_tables` | 列出数据库所有表 |
| `dbx_query_full` | 完整查询：自动 describe + 安全检查 + 分页执行 + 返回 Chart.js 格式数据 |
| `dbx_chart_collection` | 生成多图表看板/大屏 HTML（ECharts 引擎，Grid 布局）|
| `dbx_bigscreen_builder` | **新增**：JimuBI 紧凑 spec → ECharts option + HTML 编译链 |
| `dbx_report_builder` | **新增**：jimureport 对等实现（SQL + 参数化 + 多级表头 → HTML 报表）|

## §1 看板/大屏生成（dbx_bigscreen_builder）

### 紧凑 spec 格式（AI 只写最少字段）

```json
{
  "page": { "name": "标题", "theme": "dark" },
  "palette": "tech",
  "components": [
    { "type": "JText", "text": "数据更新时间", "style": "subtitle" },
    { "type": "JStatsSummary", "title": "核心指标", "variant": "2", "items": [...] },
    { "type": "JBar", "title": "柱状图", "data": [{ "name": "A", "value": 100 }] },
    { "type": "JPie", "title": "饼图", "data": [{ "name": "X", "value": 35 }] },
    { "type": "JGauge", "title": "仪表盘", "value": 78, "max": 100 },
    { "type": "JScrollRankingBoard", "title": "排行", "rowNum": 5, "data": [{ "name": "A", "value": 100 }] }
  ]
}
```

### 已支持的组件类型（40 种）

| 分类 | JimuBI 类型 | 渲染方式 |
|---|---|---|
| **柱图族** | JBar / JStackBar / JMultipleBar / JNegativeBar / JPercentBar | ECharts bar |
| **折线族** | JLine / JSmoothLine / JStepLine / JArea / JMultipleLine | ECharts line |
| **饼图族** | JPie / JRing / JRose / JRotatePie / JBreakRing / JActiveRing | ECharts pie |
| **雷达** | JRadar / JCircleRadar | ECharts radar |
| **散点** | JScatter / JBubble | ECharts scatter |
| **漏斗** | JFunnel / JPyramidFunnel | ECharts funnel |
| **仪表盘** | JGauge / JSemiGauge / JColorGauge | ECharts gauge |
| **排行榜** | JScrollRankingBoard | ECharts bar（自动排序 TOP N）|
| **文本** | JText / JDragDecoration | HTML div |
| **统计卡** | JStatsSummary / JCountTo / JNumber | HTML 卡片 |
| **滚动表** | JScrollBoard / JScrollTable / JScrollList | HTML 表格 |

**不支持**（需 GeoJSON 地图数据）：JFlyLineMap / JAreaMap / JBubbleMap / JBarMap → 建议换 JBar / JScatter 组合。

### 命名色板（palette 字段）

| 名称 | 配色 | 适用场景 |
|---|---|---|
| `tech` | 科技深色（#00d4ff 青 + #f0c040 金）| 通用大屏 |
| `gov` | 政务深空蓝 + 金 | 政务监控 |
| `biz` | 商务深空蓝 + 青 | 企业看板 |
| `retro` | 复古暗红 + 金 | 数据博物馆 |
| `medical` | 医疗深绿 + 白 | 医疗监控 |
| `financial` | 金融深蓝 + 金 | 金融大屏 |

### 防踩坑清单（pitfall 自动修正）

| 问题 | 自动修正 |
|---|---|
| `label` 字段错写成 `name` | 自动补全 |
| 颜色缩写 `#abc` → `#aabbcc` | 展开 |
| 饼图添加了 xAxis/yAxis | 警告忽略 |
| grid.width/height 用百分比字符串 | 移除（用 containLabel）|
| 饼图高度 < 220px | 警告图例可能重叠 |
| 仪表盘高度 < 180px | 警告显示不全 |

### 10 个行业模板（演示数据一键套用）

| 模板 | 行业 | 布局 |
|---|---|---|
| 香山公园客流大数据 | 旅游 | 左中右 |
| 集团综合数据大屏 | 集团 | 顶 KPI + 网格 |
| 警务监控系统 | 警务 | 顶 KPI + 网格 |
| 医院实时数据监控 | 医疗 | 顶 KPI + 网格 |
| 乡村振兴普惠金融 | 金融 | 网格 |
| 北京市污水排放监控 | 环保 | 网格 |

AI 可以直接说"用 [模板名] 模板生成大屏" → builder 自动加载 spec + 生成 mock 数据 → 编译 → 输出 HTML。

---

## §2 SQL 查询（dbx_query_full）

Agent 写 SQL 时的安全模式：
1. **先 describe** → `dbx_describe_table` 确认表名 + 列名
2. **写 SELECT** → 禁止 DDL/DML（CREATE/DELETE/UPDATE/DROP）
3. **参数化** → 用 `?` 占位符，server 端 report-executor 替换
4. **row_limit 截断** → 结果超过 default_row_limit 自动截断 + 提示

### SQL 模式库（jeecg-codegen + jeecg-aiflow 知识层吸收）

| 模式 | 适用场景 | 示例 |
|---|---|---|
| **时间聚合** | 大屏折线图趋势 | `SELECT DATE_TRUNC('hour', ts) AS t, COUNT(*) FROM logs GROUP BY t` |
| **分组 TOP N** | 排行榜 | `SELECT name, value FROM t ORDER BY value DESC LIMIT 10` |
| **窗口函数** | 累计/环比 | `SELECT dept, date, SUM(amt) OVER(PARTITION BY dept ORDER BY date) AS cum_amt FROM sales` |
| **分组合计** | 报表汇总 | `SELECT dept, category, SUM(amt), COUNT(*) FROM t GROUP BY ROLLUP(dept, category)` |

---

## §3 报表生成（dbx_report_builder）

jimureport + jeecg-onlreport 对等实现。

### spec 格式

```json
{
  "title": "销售月度报表",
  "sql": "SELECT dept, SUM(amt) AS total, COUNT(*) AS cnt FROM orders WHERE month = ? GROUP BY dept",
  "parameters": [{ "name": "month", "type": "string", "default": "2026-10" }],
  "groups": ["dept"],
  "headers": [
    { "label": "部门", "column": "dept", "children": [...] }
  ],
  "charts": [
    { "title": "部门销售分布", "type": "pie", "xColumn": "dept", "yColumn": "total" }
  ]
}
```

### 能力

- **参数化 SQL**：? 占位符 + server 端安全替换
- **多级表头**：headers.children 嵌套
- **分组合计**：groups 定义 → 自动小计/总计行
- **内嵌图表**：charts 数组 → ECharts 联动（同一 SQL 结果数据）
- **筛选器 UI**：前端 filter-panel 从 DISTINCT 自动生成下拉选项

---

## §4 数据建模（jeecg-codegen + jeecg-onlform + jeecg-system 知识层吸收）

### 实体-字典-角色 三表模式

```sql
-- 业务实体表
CREATE TABLE employee (
  id BIGSERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL,
  dept_id INT REFERENCES sys_depart(id),      -- 外键到部门字典
  status VARCHAR(20) REFERENCES sys_dict_item(code='emp_status'), -- 字典值
  salary NUMERIC(12,2),
  hire_date DATE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 字典表
CREATE TABLE sys_dict_type (id SERIAL PK, code VARCHAR(50) UNIQUE, name VARCHAR(100));
CREATE TABLE sys_dict_item (id SERIAL PK, type_code VARCHAR(50), value VARCHAR(100), label VARCHAR(200));
INSERT INTO sys_dict_type VALUES (1, 'emp_status', '员工状态');
INSERT INTO sys_dict_item VALUES (1, 'emp_status', 'active', '在职');
INSERT INTO sys_dict_item VALUES (2, 'emp_status', 'resigned', '离职');

-- 主数据表（部门/角色/权限）
CREATE TABLE sys_depart (id SERIAL PK, name VARCHAR(100), parent_id INT);
CREATE TABLE sys_role (id SERIAL PK, name VARCHAR(50));
CREATE TABLE sys_user_role (user_id BIGINT, role_id INT);
```

### 主子表 SQL

```sql
-- 主表：订单
CREATE TABLE orders (id SERIAL PK, customer VARCHAR(100), total NUMERIC(12,2), status VARCHAR(20));
-- 子表：订单明细（通过 order_id 外键关联）
CREATE TABLE order_items (id SERIAL PK, order_id INT REFERENCES orders(id), product VARCHAR(100), qty INT, price NUMERIC(10,2));
-- 联查
SELECT o.*, STRING_AGG(oi.product || ' ×' || oi.qty, ', ') AS items FROM orders o LEFT JOIN order_items oi ON oi.order_id = o.id GROUP BY o.id;
```

---

## §5 AI 编排（jeecg-aiflow 知识层吸收）

dbx-pro 不自己实现 AI 编排运行时（宿主 Astravia Agent 负责），但 Agent 可以按以下模式组织多步工作流：

### 17 种编排节点类型

| 节点类型 | dbx-pro 执行方式 |
|---|---|
| start / end | Agent 自己管理 |
| llm | 宿主 Astravia Agent |
| sql | **dbx_execute_query** |
| report | **dbx_report_builder** → **dbx_execute_query** → **dbx_chart_collection** |
| bigscreen | **dbx_bigscreen_builder** → **dbx_chart_collection** |
| http | 宿主 network.fetch 权限 |
| var | Agent 内存变量 |
| switch | Agent if/else 逻辑 |
| loop | Agent 循环 |

### 编排模式示例

```
start
  → llm: "分析用户需求是看销售趋势还是排行？"
  → switch:
    trend → sql: SELECT DATE_TRUNC('day', ts), SUM(amt) FROM sales GROUP BY 1
           → bigscreen: { JLine: 折线图, JPie: 产品分布 }
           → end
    ranking → sql: SELECT product, SUM(amt) FROM sales GROUP BY 1 ORDER BY 2 DESC LIMIT 10
           → bigscreen: { JScrollRankingBoard: TOP10 }
           → end
```

---

## §6 安全准则（必须遵守）

1. **先 describe 再写 SQL** — 确认表名/列名，禁止幻觉
2. **SQL 只读** — 禁止 DDL/DML，只 SELECT
3. **row_limit 截断** — 超过 default_row_limit 自动提示
4. **参数化** — 禁止字符串拼接 SQL（server 端参数替换已实现）
5. **执行前安全检查** — sql-safety.mjs 自动扫描

---

## references/ 索引

| 文件 | 内容 |
|---|---|
| references/spec-format.md | 紧凑 spec 格式完整说明 + 每个字段详解 |
| references/chart-mapping.md | JimuBI 组件类型 → ECharts 完整映射表 + 不可用组件替代方案 |
| references/pitfalls.md | 15+ AI 易错点 + 自动修正规则 |
| references/layout-rules.md | 组件高度估算公式 + 3 种布局形态（左中右/顶KPI+网格/四角落） |
| references/palettes.md | 6 套命名色板完整字段（含 hex 值）|
| references/sql-patterns.md | 时间聚合 / 窗口函数 / 分组合计 / 排名 TOP N |

---

## 版本

- **dbx-pro 插件版本**：0.4.3 → 0.4.5（本次整合）
- **dbx-pro SKILL 版本**：0.0.112 → 0.0.113
- **ECharts 版本**：5.6.0
- **图表引擎**：Chart.js → ECharts 替换（ADR-0010b）

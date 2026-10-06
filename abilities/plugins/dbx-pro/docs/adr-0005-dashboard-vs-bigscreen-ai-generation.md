# ADR-0005: 看板与大屏 AI 生成的概念区分与架构设计

## 状态
草案（Draft）
v0.0.89 进行中 — 基础拆分与主题分流
v0.0.90 计划 — AI 布局推断 + Canvas 渲染

---

## 1. 背景

dbx-pro 插件已具备基础的数据可视化能力，但存在一个概念混淆：**看板（Dashboard）与大屏（BigScreen）被当作同一类东西渲染**。两者都是数据展示工具，却面向完全不同的场景、用户与审美。如果不拆分，后续 AI 自动生成会持续产出"既不像看板也不像大屏"的中性产物。

### Gap 分析

| 维度 | 看板期望 | 大屏期望 | 现状 |
|------|---------|---------|------|
| 主题 | 浅色、白底、柔和阴影 | 深色、发光、玻璃拟态 | **统一暗色 + recharts 默认 grid** |
| 容器 | `radius:12px` + 投影 | 霓虹边框 + `backdrop-blur` | **同一款 card 样式** |
| 布局 | 12 列栅格 + 筛选条 | 高密堆积 + 等比缩放 | **同一条 recharts grid** |
| 交互 | 筛选器、下钻、联动 | 自动轮播、全屏 | **两者均缺失** |
| 定位 | 用户日常分析（QuickBI） | 监控室 / 高管汇报（DataV） | **仅靠 preset ID 区分，无视觉差异** |

**根因**：`DashboardRenderer` 与 `ScreenRenderer` 共享 chart-card 样式与 recharts 配置；主题未形成 token 体系；AI 生成路径没有"形态分流"。

---

## 2. 概念分析

### 2.1 看板（Dashboard）

**参考**：QuickBI、Metabase、Superset

- **用户**：业务分析师、日常使用者
- **场景**：浏览器内按需查看，带筛选器与交互下钻
- **视觉**：浅灰背景 `#f8fafc`、白卡 `#ffffff`、柔和投影 `0 1px 3px rgba(0,0,0,.06)`、`radius:12px`、标题 `font-weight:500`
- **图表**：KPI 指标卡、折线、柱状、堆叠、饼/环、数据表、地图
- **布局**：12 列栅格，卡片跨 3/6/12 列，高度自适应
- **独有**：顶部筛选器条（日期范围、下拉多选、枚举切换）

### 2.2 大屏（BigScreen）

**参考**：阿里 DataV、帆软大屏、Grafana Dark

- **用户**：监控室、高管汇报、发布会
- **场景**：全屏展示、自动轮播、远距离可读、无鼠标交互
- **视觉**：深蓝渐变背景 `#0c0c0c → #1a1a2e`、cyan/blue 发光强调 `#06b6d4/#3b82f6`、霓虹边框 `1px solid rgba(6,182,212,.4)` + `box-shadow:0 0 24px rgba(6,182,212,.15)`、玻璃拟态、超大 KPI 字号 48–72px、方角（科技感）
- **图表**：大数字、仪表盘（gauge）、发光折线/柱、3D 地图、雷达、水球
- **布局**：高密堆积、强制 16:9 / 21:9、`aspect-ratio` 锁死

### 2.3 分流决策

- **不再有"通用图表卡"** — chart-card 必须在 theme layer 就分流到 dashboard-card 或 bigscreen-card
- 形态由入口决定。AI 进入生成前必须收到 `intent: "dashboard" | "bigscreen"`；若无参数，根据 SQL 特征 + prompt 关键词（"监控/汇报/轮播" → bigscreen，"分析/筛选/指标" → dashboard）启发式判断
- 同一 SQL 结果集可以产出两种形态，但布局、主题、图表组件完全不同

---

## 3. AI 生成算法（四步流水线）

### Step 1 — SQL Schema 分析

对每一列打标签：`dimension`（string/enum）、`measure`（number）、`time`（date/datetime）、`categorical`（低基数 string ≤20）、`id`（唯一值 ≥90%）

派生特征：是否存在 `time + measure` 组合（→时间序列）、measure 数量、categorical 基数分布、总行数（>500 行自动触发聚合建议）

### Step 2 — 图表类型推断（规则优先）

| 条件 | 看板 | 大屏 |
|------|------|------|
| 仅 1 measure 无 dimension | **KPI 卡** | **超大数字 + 发光描边** |
| time + 1–2 measure | **折线 / 面积图** | **发光多折线 + 渐变面积** |
| 2+ categorical + measure | **柱状 / 堆叠条** | **横向发光柱 + 排序** |
| categorical 分布 | **饼 / 环形图** | **3D 环形 + 中心数字** |
| 3+ measure + dimension | **数据表** | **精简表 + 斑马线 glow** |
| time + categorical + measure | **堆叠条 / 多线** | **多柱并排 + 霓虹边** |
| 仅 id + measure | **散点 / 表** | **不生成**（语义无效） |

### Step 3 — 栅格布局打包

**参考** `astravia-ui-design` 的 `arrange.ts` / `inferGrid` / `layoutGrid`

公共基础：12 列 CSS Grid，行高 48px，间距 16px

| 形态 | KPI 卡 | 中等图表 | 宽图表/表 | 画布约束 |
|------|--------|---------|----------|---------|
| Dashboard | 3 列（1/4） | 6 列（1/2） | 12 列（全宽） | 自适应 viewport |
| BigScreen | 2 列（更密） | 4/6 列 | 12 列 | 强制 16:9 / 21:9 |

打包策略：
1. 先放 KPI 卡（顶部一行，dashboard 最多 4 张 / bigscreen 最多 6 张）
2. 剩余空间按优先级填充（大图表 → 中 → 小）
3. 溢出时自动缩放（dashboard 缩字号，bigscreen 压缩 padding）
4. 输出 `LayoutSpec { widgets: WidgetSpec[] }`

### Step 4 — 流式 Canvas 渲染

AI 生成过程中 widget 逐个到达：
1. 新 widget 到达 → canvas 先渲染 **skeleton placeholder**（dashboard 灰 shimmer / bigscreen 暗色 glow shimmer）
2. 数据到位后替换为实际图表，**不重排已有 widget**（保证流式体验稳定）
3. 全部完成后触发 `finalizeLayout` 补足空隙

---

## 4. Canvas 架构

**参考** `astravia-ui-design/DesignCanvas` + Figma FrameView

```
Canvas
 └─ FrameView (viewport)
     ├─ FrameWidget (KPI 卡)  ← col/row/colSpan/rowSpan
     ├─ FrameWidget (折线图)
     └─ ...
FilterBar  ← dashboard 独有
Toolbar    ← 导出 / 全屏 / 主题切换（形态感知）
```

### 4.1 核心组件行为

| 组件 | Dashboard | BigScreen |
|------|-----------|-----------|
| `Canvas` | 固定 viewport、无 pan/zoom | 支持 pan/zoom、等比缩放 |
| `FrameView` | 选中高亮、可拖拽（未来） | 只读、锁定位置 |
| `FilterBar` | **有**（日期/多选/枚举） | **无** |
| `Toolbar` | 导出、全屏、主题切换 | 仅全屏、自动播放开关 |

### 4.2 WidgetSpec 数据模型

```ts
interface WidgetSpec {
  id: string;
  kind: 'kpi' | 'line' | 'bar' | 'pie' | 'table' | 'gauge';
  col: number;       // 0-11
  row: number;
  colSpan: number;   // 1-12
  rowSpan: number;
  title: string;
  dataRef: string;   // 查询结果引用
  options: Record<string, unknown>;
}
```

### 4.3 模式（未来扩展）

- **Inference Mode（当前）**：AI 一次性产出完整 `LayoutSpec`
- **Design Mode（v0.1 规划）**：手动拖拽 resize，类似 astravia-ui-design 画布编辑

---

## 5. 主题系统（形态化 token 体系）

### 5.1 Dashboard Tokens

| 层 | Token |
|----|-------|
| canvas | `bg:#f8fafc`, `padding:24px` |
| card | `bg:#fff`, `radius:12px`, `shadow:0 1px 3px rgba(0,0,0,.06)`, `border:#e2e8f0` |
| title | `14px/500/#1e293b` |
| kpi | `28px/600/#0f172a` |
| accent | `#3b82f6 / #10b981 / #f59e0b / #ef4444 / #8b5cf6` |
| filterBar | `bg:#fff`, `border:#e2e8f0`, `radius:8px` |

### 5.2 BigScreen Tokens

| 层 | Token |
|----|-------|
| canvas | `bg:linear-gradient(135deg,#0c0c0c,#1a1a2e)`, `padding:32px` |
| card | `bg:rgba(255,255,255,.04)`, `backdropBlur:12px`, `border:1px solid rgba(6,182,212,.4)`, `glow:0 0 24px rgba(6,182,212,.15)`, `radius:4px` |
| title | `16px/500/#a5f3fc` |
| kpi | `56px/700/#06b6d4`, `letterSpacing:-1px` |
| accent | `#06b6d4 / #3b82f6 / #22d3ee / #60a5fa / #818cf8` |

### 5.3 注入方式

- `Canvas` 根用 `ThemeProvider` 注入对应形态 token
- 子组件通过 `useTheme()` 消费，**不允许子组件自行判断形态**（避免漂移）
- recharts 颜色、axis、tooltip 全部从 token 派生，**封装 `BaseChart` 统一注入**

---

## 6. AI 协议

### 输入 Context

```json
{
  "intent": "dashboard | bigscreen | auto",
  "sql": "...",
  "schema": [
    { "name": "order_date", "type": "date", "role": "time" },
    { "name": "gmv", "type": "decimal", "role": "measure" },
    { "name": "channel", "type": "varchar", "role": "categorical", "cardinality": 5 }
  ],
  "row_count": 1280
}
```

### 输出 Schema（强制 JSON）

```json
{
  "layout": { "cols": 12, "rowHeight": 48, "gap": 16 },
  "widgets": [
    { "id": "kpi-1", "kind": "kpi", "col": 0, "row": 0, "colSpan": 3, "rowSpan": 1,
      "title": "今日 GMV", "dataRef": { "column": "gmv", "agg": "sum" } }
  ]
}
```

### 拒答与降级

- 全是 id 列时返回 `{ "error": "no-meaningful-metric" }`
- 前端降级：仅展示数据表 + 提示"当前结果不适合可视化"
- **禁止** AI 编造数据或跳过 schema 分析

---

## 7. 风险

| 风险 | 概率 | 影响 | 缓解 |
|------|------|------|------|
| 形态推断不准 | 中 | 低 | 一键切换 dashboard ↔ bigscreen override |
| 布局溢出画布 | 中 | 中 | 前端二次 pack + `transform:scale()` 兜底 |
| recharts axis/tooltip 残留默认白色 | 高 | 中 | `BaseChart` 统一 token 注入 |
| 大屏非 16:9 显示异常 | 中 | 低 | `auto-fit` 与 `letterbox` 两种缩放 |
| 流式 skeleton 闪烁 | 低 | 低 | `opacity transition` 平滑替换 |
| auto-play 打断临时操作 | 低 | 中 | 鼠标 hover 暂停轮播 |

---

## 8. 验收标准

- [ ] AI 根据 `intent` 参数产出**不同**的 `LayoutSpec`（至少图表类型、colSpan 分配不同）
- [ ] Dashboard：浅灰背景、白底圆角 12px 卡片、顶栏筛选器占位
- [ ] BigScreen：深蓝渐变、cyan 发光霓虹边框、超大 KPI 字号
- [ ] 同一 SQL，`intent=dashboard` 与 `intent=bigscreen` 产出视觉完全不同的画布
- [ ] 流式渲染：widget 逐个出现、不重排、最终触发 `finalizeLayout`
- [ ] recharts 不再出现默认蓝色 `#61a8ff`，全部从 token 派生
- [ ] 用户可一键在看板 ↔ 大屏之间切换形态（重跑布局推断）

---

## 9. 参考

- **astravia-ui-design** — `DesignCanvas`、`arrange.ts`、`inferGrid`、`FrameView`
- **QuickBI 仪表板** — 看板形态标杆
- **阿里 DataV / 帆软大屏** — 大屏形态标杆
- **ADR-0001** — AI 交互基础架构

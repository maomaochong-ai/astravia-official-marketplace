# ADR-0007: 统一可视化流水线 —— 宿主 Agent 与插件 UI 的看板/大屏生成能力边界

## 状态

提案中，实施 v0.0.93

---

## 1. 问题陈述

dbx-pro 存在**两条并行的可视化生成路径**，产生不一致的产物：

| 路径 | 触发方 | 入口 | 数据来源 | 渲染方式 |
|------|--------|------|---------|---------|
| **A. Tool Handler** | 宿主 AI Agent（MCP 调用） | `dbx_dashboard` / `dbx_screen` | 工具内预设 SQL（kpi_overview / trend_analysis / data_command 等） | `charts[]` 数组 → 走 preset 模板渲染（`dashboard-renderer.tsx` / `screen-renderer.tsx`） |
| **B. Canvas Button** | 插件内用户（点「看板」/「大屏」按钮） | result-panel → `openCanvas()` | 当前 SQL 执行结果集（`result.rows`） | `resultRows/resultColumns` → 走 Canvas 规则引擎自动推断布局 |

### Gap 症状

1. **同一数据源两条路径产物不同**：工具侧生成的是预设模板布局（3 个固定模板），Canvas 侧生成的是规则引擎自由推断布局 —— 同一个 `Visualization` 类型，两种数据形状，渲染出完全不同的画面。
2. **预设模板覆盖不全**：工具只有 3 个看板模板 + 3 个大屏模板；Canvas 能处理任意 SQL 结果集。
3. **`previewCallback` 时序风险**：宿主 Agent 调用工具时，插件工作台可能还没挂载（callback 为 null），产物就丢了。
4. **CSS scope 泄漏**：插件 reload 时，宿主侧 CSS 与插件侧 CSS 注入时序竞争，导致字体/圆角/边框错乱。

---

## 2. 能力边界决策

### 2.1 统一原则

> **所有可视化生成，无论触发方是宿主 Agent 还是插件内用户，必须走同一条 Canvas 流水线。**

```
               ┌─────────────┐
               │  LayoutSpec │  ← Canvas inferLayout 规则引擎（唯一真相源）
               │  (JSON)     │
               └──────┬──────┘
                      │
          ┌───────────┴───────────┐
          │                       │
   intent=dashboard          intent=bigscreen
   (QuickBI 浅)              (DataV 深)
          │                       │
   DashboardRenderer        ScreenRenderer
   (recharts + theme token)  (recharts + theme token)
```

### 2.2 何时走宿主侧 vs 插件侧

| 场景 | 触发方 | 生成逻辑 | 渲染逻辑 |
|------|--------|---------|---------|
| 用户在宿主聊天中说 "帮我做个销售看板" | **宿主 AI Agent** | ① Agent 调用 `dbx_dashboard` / `dbx_screen`（工具内执行 SQL）② 工具把执行结果打包成 `{ resultColumns, resultRows, intent }` ③ 走 Canvas 流水线 | **插件侧 Canvas** |
| 用户在 SQL 执行结果页点"看板"按钮 | **插件内用户** | ① 当前 SQL 结果集已是 `result.rows/columns` ② 直接走 Canvas 流水线 | **插件侧 Canvas** |
| 用户打开已保存的产物 | **插件内用户** | 从 store 读 `Visualization` | **插件侧 Canvas**（若有 `resultRows`）或 preset renderer（legacy fallback） |

### 2.3 工具 Handler 的角色转换

**旧职责**：工具 → 执行预设 SQL → 组装 `charts[]` 数组 → 生成 HTML 字符串 → preset renderer 消费 `charts[]`

**新职责**：工具 → 执行预设 SQL → 组装 `{ resultColumns, resultRows, intent }` → **走 Canvas**

工具不再负责图表类型选择和布局打包（这是 Canvas 的工作）。工具只负责：
1. 根据预设模板决定**要跑哪些 SQL 查询**
2. 执行查询拿到结果集
3. 把所有查询结果集合并到一个 `resultRows/resultColumns` 中（或让 Canvas 接受多份数据）

**如果 callback 为 null**（工作台没挂载）：工具仍然调 `saveVisualizationToStore()` 把产物持久化。用户下次打开插件时，产物在可视化产物列表里，点开走 Canvas 渲染。

---

## 3. Visualization 数据形状契约

### 3.1 新增顶层字段（已在 v0.0.91 引入）

```ts
interface Visualization {
  // ... 原有字段保留 ...
  
  /** Canvas 模式：原始 SQL 结果集（v0.0.91 新增） */
  resultColumns?: string[];
  resultRows?: Array<Record<string, unknown>>;
  
  /** 
   * Legacy preset 模式：预执行的 charts[] 数组
   * v0.0.93 起降级为 fallback；Canvas 优先
   */
  charts?: Array<{ ... }>;
}
```

### 3.2 渲染优先级（可视化产物列表 / 新 tab）

```
if (viz.resultRows && viz.resultRows.length > 0) {
    → Canvas(columns=resultColumns, rows=resultRows, intent=viz.type)
} else if (viz.charts && viz.charts.length > 0) {
    → legacy preset renderer（兼容 v0.0.91 之前保存的产物）
} else {
    → 空状态提示
}
```

### 3.3 统一入口：`Visualization → Canvas` 转换

在 `visualization-tab.tsx` 或 `canvas/` 目录下提供一个转换函数：

```ts
function vizToCanvasInput(viz: Visualization): CanvasProps | null {
  if (viz.resultRows?.length && viz.resultColumns?.length) {
    return {
      columns: viz.resultColumns,
      rows: viz.resultRows,
      intent: viz.type === "screen" ? "bigscreen" : "dashboard",
    };
  }
  return null; // fallback 到 legacy
}
```

---

## 4. Tool Handler 改造方案

### 4.1 `dbx_dashboard.ts` / `dbx_screen.ts` 的 handler

```
改造前：tool 执行 N 个 preset SQL → charts[] → generatePreviewHtml() → showVisualizationPreview(viz{charts[], html})
改造后：tool 执行 N 个 preset SQL → 合并成统一 resultColumns + resultRows → showVisualizationPreview(viz{resultColumns, resultRows})
```

### 4.2 多查询结果集合并

一个 dashboard preset（如 kpi_overview）会执行 3-4 个 SQL（KPI、趋势、分布）。Canvas 目前只接受一个结果集。

**决策**：工具把多份结果集**按列拼接到一个 rows 数组**中（缺失列用 null 填充），让 Canvas 看到一个"宽表"。Canvas 内的 inferLayout 规则引擎仍然能正确识别各列角色（time/measure/categorical）并生成多图表。

```ts
function mergeResultSets(results: Array<{ columns: string[], rows: R[] }>): { columns: string[], rows: R[] } {
  const allCols = [...new Set(results.flatMap(r => r.columns))];
  const mergedRows = results.flatMap(r => 
    r.rows.map(row => {
      const obj: Record<string, unknown> = {};
      for (const c of allCols) obj[c] = row[c] ?? null;
      return obj;
    })
  );
  return { columns: allCols, rows: mergedRows };
}
```

---

## 5. CSS Scope 与插件隔离

### 5.1 问题

插件 reload 时，宿主侧有自己的 CSS 注入、字体加载、Tailwind 预设。dbx-pro 的 CSS 如果有**未 scope 到 `.dbx-root` 的选择器**，会：
- 被宿主 CSS 覆盖（字体/圆角/边框变乱）
- 或反过来污染宿主（插件的 recharts tooltip 样式漏到宿主其他组件）

### 5.2 解决方案

**容器隔离**：插件根 DOM 用 CSS containment boundary 包裹，阻断宿主 → 插件的样式污染。

```tsx
// index.tsx 的 PanelLoading、Suspense fallback、PanelErrorBoundary 所有根节点加：
<div data-astravia-plugin-root="dbx-pro" className="dbx-root"
     style={{ contain: "layout style paint" }}>
  {/* ... */}
</div>
```

**严格 scope 审计**：扫描所有 7 个 CSS 文件，确保：
1. 没有裸 `*` 选择器
2. 没有裸元素选择器（`div`, `span`, `td` 等）
3. 所有规则都在 `.dbx-root` 或 `.viz-root` 或 `.dbx-chrome` 作用域下

---

## 6. 验收标准

### 统一流水线

- [ ] 宿主 Agent 调用 `dbx_dashboard` → 工具执行 → 自动创建 viz tab → Canvas 渲染（**不是 preset renderer**）
- [ ] 宿主 Agent 调用 `dbx_screen` → 同上 → Canvas bigscreen 主题渲染
- [ ] 插件内 result-panel 点"看板/大屏" → Canvas 渲染（已在 v0.0.91 实现）
- [ ] 两条路径同一数据源产出一致的 LayoutSpec（同一份 Canvas 输出）
- [ ] 当 callback 为 null 时，工具仍调 `saveVisualizationToStore()`，产物可在可视化产物列表中找到

### CSS 隔离

- [ ] 所有 7 个 CSS 文件零裸选择器（全 scope 到 `.dbx-root`）
- [ ] 插件根节点 `contain: layout style paint`
- [ ] reload 后 UI 不出现字体/圆角/边框错乱

### 跨版本兼容

- [ ] v0.0.91 及之前保存的产物（只有 `charts[]` 没有 `resultRows`）打开时仍能用 legacy preset renderer 渲染
- [ ] 新产物有 `resultRows`，Canvas 优先渲染

---

## 7. 风险

| 风险 | 概率 | 缓解 |
|------|------|------|
| 多查询结果集合并后 inferLayout 识别不准 | 中 | 给 merge 的 rows 加 `__source` 列标记，Canvas 规则引擎可区分；或工具直接给 Canvas 多份数据集 |
| legacy 产物没有 `resultRows` 导致 Canvas 无法渲染 | 低 | visualization-tab 保留 preset renderer fallback 分支 |
| CSS containment 阻断宿主 Tailwind 类 | 中 | 先用 `contain: paint` 逐步测试；或用 Shadow DOM（更彻底但成本高） |
| Agent 工具返回的 message 需要改文案 | 低 | 改 handler 的 return message 即可 |

---

## 8. 参考

- ADR-0005: Canvas 画布 PoC + inferLayout 规则引擎
- ADR-0006: SQL Editor 工具栏对齐
- `tools/dbx-dashboard.ts` L59-143 handler
- `tools/dbx-screen.ts` L59-143 handler
- `visualization-bridge.ts` previewCallback 机制
- `domain/visualization.ts` Visualization 类型（v0.0.91 加 resultColumns/resultRows）

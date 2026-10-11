# ADR-0010d: 演示模板库 UX —— BI 按钮入口 + 预置模板 Gallery

## 状态

已接受。执行版本 `0.4.5`。

父决策：ADR-0010。

**用户明确**：演示数据量原则需要一个**UI 入口**——在插件 BI 按钮点击后，可以看到真实的模板效果用于演示。

---

## 0. 背景

jimubi-bigscreen 模板库（`references/templates/bigScreen/`）有 **10 个行业大屏模板**：

| 模板 | 行业 | 组件选择 | 布局 |
|---|---|---|---|
| 香山公园客流大数据 | 旅游 | 左飞线地图 + 中 KPI 行 + 右排行 + 底柱图 | 左中右 |
| 集团综合数据大屏 | 集团 | 顶 KPI 行 + 中左柱图 + 中右表格 + 底折线 | 顶 + 网格 |
| 车辆分布图 | 车辆 | 左地图 + 中柱图 + 右饼图 | 左中右 |
| 警务监控系统 | 警务 | 左表 + 中地图 + 右表 | 左中右 |
| 杭州房地产市场宏观监控 | 地产 | 顶 KPI 行 + 柱图网格 | 顶 + 网格 |
| 旅游数据分析中心大屏 | 旅游 | 左表 + 中折线 + 右排行 | 左中右 |
| 北京科技数字化云平台 | 政务 | 顶 KPI + 左柱 + 中饼 + 右表 | 顶 + 网格 |
| 医院实时数据监控 | 医疗 | 顶 KPI + 中折线 + 右排行 + 底柱 | 顶 + 网格 |
| 北京市污水排放总量 | 环保 | 地图 + 柱图 + 饼图 | 网格 |
| 乡村振兴普惠金融服务平台 | 金融 | 地图 + 柱图 + 折线 + 表 | 网格 |

jimubi-dashboard 有另外一套 dashboard 模板（亮色 + 24 栅格）。

dbx-pro 现在**没有模板入口**——用户只能从零开始，不知道"一个好的大屏/看板长什么样"。演示模板库解决的就是这个问题。

---

## 1. UX 设计

### 1.1 入口

**顶栏 BI 按钮**（现有 `workbench-top-bar.tsx` 里已有 BI 按钮）。点击后弹出菜单：

```
┌──────────────────────────────┐
│  数据源  ● 已连接 xxx          │
│  ───────────────────────────  │
│  📊 从模板生成                │  ← 新增入口
│  📊 空白看板                  │
│  📊 空白大屏                  │
│  📊 空白报表                  │
│  ───────────────────────────  │
│  最近使用 (3)                 │
└──────────────────────────────┘
```

### 1.2 模板 Gallery UI（全新面板）

点击「从模板生成」→ 进入模板选择面板（全屏浮层或右侧抽屉）：

```
┌─────────────────────────────────────────────────────────────┐
│  BI 模板库                              [看板] [大屏] [报表] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  🔍 搜索模板...              全部  旅游  政务  医疗  金融     │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📊 大屏（10 个模板）                                   │   │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│  │ │ 香山公园客流  │ │ 集团综合数据  │ │ 车辆分布图    │   │   │
│  │ │ [缩略图]      │ │ [缩略图]      │ │ [缩略图]      │   │   │
│  │ │ 左中右布局    │ │ 顶+网格      │ │ 左中右        │   │   │
│  │ │ ▶ 使用模板    │ │ ▶ 使用模板    │ │ ▶ 使用模板    │   │   │
│  │ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│  │ │ 警务监控系统  │ │ 杭州房地产    │ │ 旅游数据分析  │   │   │
│  │ │ [缩略图]      │ │ [缩略图]      │ │ [缩略图]      │   │   │
│  │ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ 📊 看板（5 个模板）                                    │   │
│  │ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │   │
│  │ │ 运营数据看板  │ │ 销售统计看板  │ │ 用户增长看板  │   │   │
│  │ │ [缩略图]      │ │ [缩略图]      │ │ [缩略图]      │   │   │
│  │ └──────────────┘ └──────────────┘ └──────────────┘   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.3 模板数据结构

每个模板 = 紧凑 spec + mock 数据生成规则：

```typescript
// server/src/engine/template-library.ts
export interface BigscreenTemplate {
  id: string;
  name: string;
  industry: "旅游" | "政务" | "医疗" | "金融" | "环保" | "地产" | "车辆" | "警务" | "集团" | "科技";
  layout: "top-kpi-grid" | "left-center-right" | "four-corners" | "grid";
  description: string;
  thumbnailPrompt: string;  // AI 生成缩略图的描述
  spec: JimubiCompactSpec;  // jimubi 风格紧凑 spec
  mockDataRules: MockDataRule[];  // mock 数据生成规则
  // 可选：真实数据源参考 SQL（模板不绑定真实表，但提示用户可以用什么表）
  suggestedSql?: string;
  suggestedTables?: string[];
}

export interface MockDataRule {
  targetComponent: string;       // spec.components[i].type + variant
  targetField: string;           // data / rows / ...
  generator: "random-range" | "time-series" | "geo-coords" | "hierarchical" | "top-n";
  params: Record<string, unknown>;  // { min: 0, max: 100, count: 20 } 等
}
```

### 1.4 一键套用流程

```
用户点击模板卡片「香山公园客流大数据」
  ↓
1. builder 加载模板 spec
2. mock-data-generator 按 mockDataRules 生成 mock 数据
3. dbx-bigscreen-builder 编译 spec + mock 数据 → ECharts option
4. 弹出「数据源选择」对话框（可选："用 mock 数据预览" / "从数据库选表"）
5. 用户选"用 mock 数据预览" → 打开大屏预览
6. 用户选"从数据库选表" → 进入 AI Prompt 模式，AI 根据 suggestedSql 帮用户写真实 SQL
```

---

## 2. 文件清单

### 前端（src/）

| 文件 | 行数估算 | 职责 |
|---|---|---|
| `src/features/visualization/components/template-gallery.tsx` | ~300 | 模板选择面板（Grid + 筛选 + 搜索）|
| `src/features/visualization/components/template-card.tsx` | ~100 | 单个模板卡片（缩略图 + 名称 + 行业 + ▶ 使用）|
| `src/features/visualization/domain/template-library.ts` | ~200 | 模板 JSON 注册 + 加载 + 查询 |

### 后端（server/）

| 文件 | 行数估算 | 职责 |
|---|---|---|
| `server/src/engine/template-library.mjs` | ~200 | 模板数据 + mock 数据生成规则 |
| `server/src/engine/mock-data-generator.mjs` | ~400 | mock 数据生成器（random-range / time-series / geo-coords / hierarchical / top-n）|

### 模板数据

| 文件 | 内容 |
|---|---|
| `server/src/engine/templates/bigscreen-*.json` × 10 | 10 个大屏模板 spec + mockDataRules |
| `server/src/engine/templates/dashboard-*.json` × 5 | 5 个仪表盘模板（新增）|

---

## 3. 验收标准

| # | 验收 | 通过标准 |
|---|---|---|
| 1 | BI 按钮菜单新增「从模板生成」选项 | 顶栏 BI 按钮 → 弹出菜单 → 「从模板生成」可见 |
| 2 | 模板 Gallery UI 可用 | 面板打开 → 10+ 模板卡片 → 筛选/搜索生效 |
| 3 | 模板可一键套用（mock 数据）| 选模板 → 用 mock 数据预览 → 大屏/看板正常渲染 |
| 4 | mock 数据生成合理 | 滚动组件 ≥ 可视行数 × 1.5 数据量（演示数据量原则）|
| 5 | mock-data-generator 可独立扩展 | 新增 generator 类型只需加一个函数 + 注册 |

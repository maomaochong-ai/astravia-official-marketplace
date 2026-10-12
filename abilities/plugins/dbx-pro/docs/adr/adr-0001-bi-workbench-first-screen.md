# ADR-0001: BI 首屏工作台 —— Quick BI 参考 + Canvas 工作流不变

## 状态

已接受。2026-10-13 确立。这是 dbx-pro BI 首屏工作台的第一个决策文档。

> 本文件是首屏工作台的决策；画布编辑器（canvas-editor / node-graph）的详细决策见后续 ADR。

---

## §0 现状速览

### 已真实存在（2026-10-13 仓库实测）

**UI 设计稿**：[ui-mock/.../frames/workbench.tsx](file:///Users/zhugeyue/Desktop/project/bigdate/source-code/astravia-official-marketplace/ui-mock/dbx-bi-editor.astravia-design/frames/workbench.tsx) — 三栏布局：

```
┌─ 顶栏: 面包屑 + 搜索 + 工具 ─────────────────────────────────────────┐
│ 左栏 NAV (6 项) │ 主栏: 看板网格 (3 列) + 最近运行 │ 右栏: 入口 + 链接 + 发布 │
└─────────────────┴───────────────────────────────────┴──────────────────┘
```

**实现**：[bigscreen-workspace.tsx](file:///Users/zhugeyue/Desktop/project/bigdate/source-code/astravia-official-marketplace/abilities/plugins/dbx-pro/src/features/bi-editor/workbench/bigscreen-workspace.tsx)（478 行）—— 已高度还原设计稿，真实后端数据（`/drag/*` 4 个端点）。

**画布编辑器**：[canvas-editor.tsx](file:///Users/zhugeyue/Desktop/project/bigdate/source-code/astravia-official-marketplace/abilities/plugins/dbx-pro/src/features/bi-editor/canvas/canvas-editor.tsx) + [node-graph.tsx](file:///Users/zhugeyue/Desktop/project/bigdate/source-code/astravia-official-marketplace/abilities/plugins/dbx-pro/src/features/bi-editor/canvas/components/node-graph.tsx) — 点击卡片后进入节点图编辑器，**这是核心路线，不动**。

### 当前实现 vs 设计稿 6 个 Gap

| # | Gap | 设计稿期望 | 当前实现 | 修复 Phase |
|---|---|---|---|---|
| ① | NAV 4 项 notify 占位 | 数据集 → 真实视图；工作树 → 真实视图；分享给我 → 真实列表；回收站 → 真实列表 | 全部 `notify("功能开发中")` | Phase 1 |
| ② | 卡片缺元数据 | 页数 chip + 节点数 chip + 状态 chip（运行中/失败/草稿） | 只有"更新 N 次"（updateCount），无 pages/nodes/status | Phase 2 |
| ③ | 右栏三条入口全 notify | "从数据集新建" → 选表；"让 AI 生成" → 调 Agent；"粘一条 SQL" → 直接解析 | 全部 `notify("功能开发中")` | Phase 3 |
| ④ | 搜索框无功能 | 按名称搜索看板/大屏/数据集 | 静态占位文字 | Phase 1 |
| ⑤ | 网格/列表切换无功能 | 网格视图 ↔ 列表视图 | 视觉按钮，无状态切换 | Phase 2 |
| ⑥ | 排序下拉无功能 | 最近更新/名称/创建时间/运行次数 | 视觉按钮，无排序逻辑 | Phase 2 |

**Canvas 编辑器内部 gap**（不在本 ADR 范围，归 canvas-editor 专项 ADR）：属性面板覆盖不全、节点执行链路只打通 AI 路径、保存→compile→render 闭环不完整。

---

## §1 Quick BI 首屏 vs dbx-pro 首屏 差异对照

### Quick BI 控制台五大区（getting-started__gui-elements-in-the-quick-bi-console-1.md）

| 区域 | 定位 | dbx-pro 对应 |
|---|---|---|
| **我的看板** | 高管看数阵地：首页+卡片看板+指标监控+我的收藏+最近访问+授权与我 | ❌ 不做（单用户无权限层级） |
| **企业门户** | 企业级数据门户 | ❌ 不做（无企业主体） |
| **工作台** | **开发者起点页** | ✅ dbx-pro BI 首屏 = 对齐此定位 |
| **开放平台** | 嵌入 / API / SDK / 扩展 | ❌ 不做（本地插件无 API 暴露） |
| **模板市场** | 一键应用行业模板 | ⚠️ Phase 4（可选） |

### Quick BI 工作台首页 6 块 → dbx-pro 首屏映射

| Quick BI 块 | dbx-pro 对齐位置 | 说明 |
|---|---|---|
| ①当前账号信息 | ❌ 裁剪为顶栏头像（单用户无多空间，不需要"空间管理"层） | dbx-pro 是**本地工作树**，切空间是伪需求 |
| ②从模板创建 | ⚠️ Phase 4（可选） | 行业模板有价值但不紧急；Phase 3 的"让 AI 生成"可以先顶 |
| ③快速创建 | ✅ 右栏"从哪开始"3 条路 | 设计稿：从数据集新建 / 让 AI 生成 / 粘一条 SQL |
| ④我的工作空间 | ❌ 裁剪为左栏 NAV + 主栏卡片网格 | 没有"空间"概念，所有资产平铺 |
| ⑤我最近的操作 | ✅ 主栏"最近运行"列表 | 真实后端 `/drag/runlog/list` |
| ⑥常用操作视频 | ❌ 不做 | 本地插件无视频托管 |

### 核心差异（为什么不做 Quick BI 磁贴式仪表板）

Quick BI 的仪表板 = **磁贴布局**（拖图表到 12 列栅格、图表独立组件）。dbx-pro 的画布编辑器 = **节点图**（数据节点→变换节点→图表节点连线执行）。

| 维度 | Quick BI 仪表板 | dbx-pro canvas 路线 |
|---|---|---|
| 建表方式 | 拖图表组件到栅格，每个图表独立绑 SQL | 节点连线：数据源→计算→图表，上游变化下游自动更新 |
| 数据绑定 | 每个图表各自 SQL / 共享数据集 | 一个节点的输出 = 下一个节点的输入 |
| 复用粒度 | 图表级 | 节点级（一个计算节点可被多个图表消费） |
| 优势 | 上手快、所见即所得 | 数据血缘天然清晰、复杂分析表达力强 |

**这条路线不动**。本 ADR 只管**首屏**如何引导用户进入 canvas 编辑器，不管编辑器内部。

---

## §2 决策

### 一句话

**首屏布局对齐 ui-mock workbench.tsx（= Quick BI 工作台首页的单用户精简版），数据模型保持 BigscreenPage + canvas-editor 节点图（≠ Quick BI 磁贴），NAV 六项按单用户场景裁剪（数据集/工作树沿用数据库工作台，分享给我/回收站后续 ADR）。**

### 三条核心理由

1. **设计稿 + 当前实现 已经跑通** —— bigscreen-workspace.tsx 已对齐 workbench.tsx 三栏、4 个真实后端端点、点击卡片进入 canvas-editor。gap 是功能补齐，不是推翻重来。
2. **单用户本地工作树 ≠ 多空间权限体系** —— Quick BI 的"我的看板/企业门户/空间切换"都是企业多用户需要的，dbx-pro 不需要，把这些裁剪后才是适配本地插件的首屏。
3. **Canvas 工作流的表达力比磁贴强** —— 节点图天然带数据血缘、计算复用、依赖追踪，这是 Quick BI 磁贴式做不到的。首屏对齐 Quick BI 设计语言，但进入编辑器后走自己的路。

---

## §3 接口点表

逐项 `[ -e path ]` 验证后列入。

| # | 文件 | 状态 | 关系 |
|---|---|---|---|
| 1 | `src/features/bi-editor/workbench/bigscreen-workspace.tsx` | ✅ 活跃 | **BI 首屏**，三栏，4 个 engine 端点 |
| 2 | `src/features/bi-editor/canvas/canvas-editor.tsx` | ✅ 活跃 | 点击卡片后进入的画布编辑器（node-graph） |
| 3 | `src/features/bi-editor/canvas/components/node-graph.tsx` | ✅ 活跃 | 节点图组件（拖拽 / 连线 / 属性面板） |
| 4 | `src/features/bi-editor/shared/hooks/use-bigscreen-pages.ts` | ✅ 活跃 | `BigscreenPage` CRUD（当前卡片网格数据源） |
| 5 | `src/features/database-workspace/components/workbench-top-bar.tsx` | ✅ 活跃 | BI 入口按钮所在 |
| 6 | `src/features/database-workspace/components/sql-editor-workspace.tsx` | ✅ 活跃 | 路由切换点（`activeTab?.gallery` → `<BigscreenWorkspace />`） |
| 7 | `server/src/api/internal/drag.ts` | ✅ 活跃 | `/drag/datasource/list` `/drag/runlog/list` `/drag/sharelink/list` `/drag/worktree/*` |
| 8 | `src/features/bi-editor/workbench/bi-workbench.tsx` | 💀 死代码 | 旧尝试，仅被 bi-editor/index.ts re-export，无生产 import |
**新增**（首屏补齐需要）：

| # | 文件 | Phase | 说明 |
|---|---|---|---|
| 10 | `src/features/bi-editor/shared/hooks/use-card-meta.ts` | Phase 2 | 从 BigscreenPage + template JSON 解析 pages/nodes/status 元数据 |
| 11 | `src/features/bi-editor/shared/hooks/use-nav-filter.ts` | Phase 1 | NAV 六项切换 + 搜索 + 排序 |
| 12 | `src/features/bi-editor/workbench/quick-create-dialog.tsx` | Phase 3 | 右栏三条入口的对话框（数据集选表 / AI Prompt / SQL 粘贴） |

---

## §4 非目标

- ❌ 不改 canvas-editor / node-graph 内部实现（节点功能打通归编辑器专项 ADR）
- ❌ 不改 server 侧 `/drag/*` + `/api-bigscreen/*` 路由与 compile / render 引擎
- ❌ 不做 Quick BI 磁贴式仪表板（保持 canvas 节点图路线）
- ❌ 不做多空间 / 多权限 / 我的看板 / 企业门户 / 开放平台 / 视频教程
- ❌ 不改顶栏路由（BI 入口按钮位置保持 workbench-top-bar.tsx）
- ❌ 不改旧 visualization 模块（visualization-store.ts 残余归 Phase 清理）
- ❌ 新增 Agent 工具

---

## §5 里程碑

### Phase 1（1–2 天）：NAV 切换 + 搜索打通

- [ ] NAV 6 项真实切换：
  - "我的看板" → 主栏只显示 `style === "default"` 的卡片
  - "数据大屏" → 主栏只显示 `style === "bigScreen"` 的卡片
  - "数据集" → 左栏数据源区展开为完整列表（沿用数据库工作台组件，不新造）
  - "工作树" → 主栏切换为工作树视图（dirtyCount + 可发布 pages 列表）
  - "分享给我" → 主栏切换为 `useSharelinks()` 数据
  - "回收站" → 主栏切换为已删除 pages（engine 端点确认后接）
- [ ] 搜索框：按名称模糊过滤卡片网格（前端过滤，不调后端）
- [ ] Grid/List 视图切换：状态 + 渲染两种布局
- [ ] 排序下拉：最近更新 / 名称 A-Z / 创建时间 / 运行次数

### Phase 2（2–3 天）：卡片元数据补齐

- [ ] `use-card-meta.ts` hook：从 BigscreenPage + template JSON 解析
  - `pageCount`（多页面大屏）
  - `nodeCount`（节点总数）
  - `status`（running / failed / draft）—— 从 runlog 推断
- [ ] 卡片渲染补齐三个 chip（页面数 / 节点数 / 状态）
- [ ] 预览缩略图从静态 hash 改成节点图真实渲染（Phase 2 末期或 Phase 4）

### Phase 3（2–3 天）：右栏三条入口真实接线

- [ ] "从数据集新建" → 弹出数据集选择对话框 → 选表选字段 → 自动创建 canvas 项目 + 初始 chart 节点
- [ ] "让 AI 生成" → 弹出 AI Prompt 对话框 → 调 `dbx_chart_collection` / `dbx_query_full` → 自动创建 canvas 项目 + 完整节点图
- [ ] "粘一条 SQL" → 弹出 SQL 输入框 → 解析 schema → 自动创建 canvas 项目 + 初始 SQL 数据源节点
- [ ] 三条路径统一落到 `<BigscreenEditor pageId={...} />`（保持 canvas 路线不变）

### Phase 4（可选，时间允许时做）

- [ ] 模板市场：预置 5–10 套看板/大屏模板（JSON），一键应用
- [ ] 画布编辑器节点功能打通（属性面板 + 执行链路 + 保存闭环）—— 归编辑器专项 ADR
- [ ] 旧 visualization 模块彻底清理

---

## 附录 A：Quick BI 原文参考

调研全文见 [quick-bi-reference.md](./quick-bi-reference.md)；原文库在 [quick-bi-docs/](./quick-bi-docs/)（1125 篇）。

本 ADR 引用的关键原文：

1. **Quick BI 控制台五大区** —— `getting-started__gui-elements-in-the-quick-bi-console-1.md`
2. **工作台首页六块布局** —— 同上（§工作台首页小节）
3. **工作台资源列表** —— 同上（§工作台资源列表小节）

---

## 附录 B：复核命令

```bash
cd abilities/plugins/dbx-pro

# 1) 确认 bigscreen-workspace.tsx 是唯一 BI 首屏实现
grep -rn "BigscreenWorkspace" src/ --include=*.tsx --include=*.ts

# 2) 确认 BI 入口按钮路径
grep -rn "gallery\|onOpenVisualization" src/features/database-workspace/ --include=*.tsx

# 3) 确认 use-bigscreen-pages 是唯一卡片数据源
grep -rn "useBigscreenPages\|use-bigscreen-pages" src/ --include=*.tsx --include=*.ts

# 4) bigscreen-workspace.tsx 当前 4 个 engine 端点
grep -n "engineRequest\|/drag/" src/features/bi-editor/workbench/bigscreen-workspace.tsx

# 6) 死代码 bi-workbench.tsx 确认零生产引用
grep -rn "BiWorkbench\|bi-workbench" src/ --include=*.tsx --include=*.ts
```

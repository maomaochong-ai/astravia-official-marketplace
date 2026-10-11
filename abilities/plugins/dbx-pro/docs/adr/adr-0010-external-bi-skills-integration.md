# ADR-0010: 外部 BI skills 整合 —— JeecgBoot skill 资产在 dbx-pro 中的吸收策略

## 状态

已接受。执行版本 `0.4.5`。

**范围升级（2026-10-11 第三轮）**：从「BI skill 知识层吸收」→「**全部 13 个 JeecgBoot skill 能力对等实现**」+「ECharts 替换 Chart.js 渲染引擎」+「Chart.js 组件模型重构」+「演示模板库 UI 入口」。

**执行**：
- ✅ 5 个 BI 可视化 skill **执行层对等移植**（jimubi-bigscreen / jimubi-dashboard / jimureport / jeecg-onlchart / jeecg-onlreport）
- ✅ ECharts 渲染引擎**替换** Chart.js（16+ 文件迁移）
- ✅ Chart.js 组件模型重构（从 8 种 Chart.js 类型 → 60+ 种 ECharts graphType）
- ✅ 演示模板库（10 个 JeecgBoot 行业大屏模板 + BI 按钮入口）
- ✅ 8 个非 BI skill **知识层吸收 + 执行层对等实现（技术边界内）**

**诚实声明**：8 个非 BI skill（jeecg-codegen / jeecg-bpmn / jeecg-aiflow / jeecg-portal / jeecg-system / jeecg-dev / jeecg-onlform / jeecg-codegen-new）的**执行层**全部依赖 JeecgBoot 后端服务器功能（Flowable 流程引擎 / FreeMarker 代码生成 / JWT 用户体系 / 企业门户布局引擎 / AI 编排节点运行时）。dbx-pro 是**桌面数据库工作台插件**（TypeScript 前端 + Node MCP server），没有也不应该有这些后端组件。「对等实现」在当前架构下**不可能完整覆盖**——见 ADR-0010c 逐 skill 技术分析。

---

## 子文档索引

| 子文档 | 范围 | 核心决策 |
|---|---|---|
| **ADR-0010a** | 5 个 BI 可视化 skill 执行层移植 | jimubi spec_builder TypeScript 编译链 + jimureport 报表编译器 + jeecg-onlchart graphType 映射 + jeecg-onlreport SQL 参数化 + 演示模板库 |
| **ADR-0010b** | ECharts 渲染引擎迁移 | ECharts **替换** Chart.js（不是并存）+ 16+ 受影响文件清单 + 迁移成本评估 |
| **ADR-0010c** | 8 个非 BI skill 技术边界 | 逐 skill 后端依赖分析 + dbx-pro 可提供什么 + 不可提供什么 + 对等实现的务实边界 |
| **ADR-0010d** | 演示模板库 UX 设计 | BI 按钮入口 + 预置模板 gallery（10 个行业大屏 + 5 个仪表盘）+ mock 数据生成 + 一键套用 |

---

## 13 个 JeecgBoot Skill 分类（技术边界诚实评估）

### ✅ 第一类：BI 可视化（5 个，完整对等实现）

| Skill | JeecgBoot 执行层 | dbx-pro 对等实现 |
|---|---|---|
| jimubi-bigscreen | spec_builder.py（紧凑 spec → JimuBI 组件 JSON）+ 129 defaults + 10 行业模板 | **dbx-bigscreen-builder.ts**（紧凑 spec → ECharts option）+ 30+ Chart.js/ECharts defaults + 10 模板移植 |
| jimubi-dashboard | spec_builder.py 同 bigscreen + 亮色主题 + 24 栅格 | 同上，换亮色主题 + 24 栅格 CSS Grid |
| jimureport | 26 Python 脚本（报表 CRUD + 多级表头 + 分组 + 参数化） | **dbx-report-builder.ts**（SQL + 参数化 → HTML 报表 + ECharts 图表联动）|
| jeecg-onlchart | onlchart_api.py（graphType → Online 图表）| **dbx-chart-engine.ts**（60+ ECharts graphType → 统一渲染接口）|
| jeecg-onlreport | onlreport_api.py（SQL 驱动列表）| 结果网格 + **dbx-filter-builder.ts**（筛选器 + SQL 参数化）|

### 🟡 第二类：非 BI 技能（8 个，知识层吸收 + 执行层务实边界）

| Skill | JeecgBoot 后端依赖 | dbx-pro 可提供 | dbx-pro 不可提供 |
|---|---|---|---|
| **jeecg-codegen-new** | FreeMarker 模板引擎 + Java 后端项目 + Vue3 前端项目 + Flyway SQL | SQL 建表脚本生成（dbx MCP 直连数据库 CREATE TABLE）| FreeMarker 模板渲染 + Java/Vue3 代码编译 + Flyway 迁移执行 |
| **jeecg-codegen** | 同上（多版本兼容层） | 同上 | 同上 |
| **jeecg-bpmn** | Flowable BPMN 2.0 流程引擎 + 审批节点运行时 | 流程定义描述（SQL `CREATE TABLE ... workflow_nodes` + 文档）| Flowable 引擎实例 + 审批流程运行时（会签/抄送/监听器）|
| **jeecg-aiflow** | AI 编排引擎（LLM 节点 + 知识库节点 + SQL 节点运行时）| AI 编排**知识层**（SKILL.md 里写"如何设计 AI 编排"）| AI 节点运行时（dbx-pro 不自己实现 Agent 编排，用宿主 Astravia）|
| **jeecg-onlform** | 元数据驱动 CRUD + 26 控件类型 + JS/Java/SQL 增强 | 元数据驱动 CRUD 的**知识层** | 元数据运行时（dbx-pro 是数据库浏览器，不是低代码表单平台）|
| **jeecg-system** | JWT 用户/角色/部门/字典管理 | 用户/角色/字典的**知识层**（SKILL.md 里写"如何设计这些表"）| JWT 认证服务 + 用户/角色表 CRUD（宿主 Astravia 有自己的用户体系）|
| **jeecg-portal** | 企业门户布局引擎 + 14 种门户组件 | 门户**知识层**（SKILL.md 里写"门户组件类型"）| 门户布局运行时（dbx-pro 不做企业门户）|
| **jeecg-dev** | JeecgBoot 开发工具集 | JeecgBoot 开发**知识层** | 开发工具运行时 |

### 🟢 所有 skill 共用：知识层吸收

**全部 13 个 skill 的 SKILL.md + references/ 目录**完整保留在 `agent/skills/jeecgboot-ref/`（gitignore，不进制品）。dbx-pro 重写 SKILL.md 时吸收所有 skill 里与平台解耦的设计知识：

| JeecgBoot skill | 吸收的知识 |
|---|---|
| jimubi-bigscreen | 5 维组件挑选、3 种布局形态、演示数据量原则、深色主题配色、10 个行业模板组件清单 |
| jimubi-dashboard | 24 栅格、亮色主题、KPI 布局 |
| jimureport | 多级表头、分组合计、参数化 SQL、报表布局 |
| jeecg-onlchart | graphType 选型矩阵、组合图表语法、字段推断 |
| jeecg-onlreport | 筛选器设计、数据隔离、多级表头 |
| jeecg-codegen | Freemarker 上下文设计、Entity/DTO/VO 分层 |
| jeecg-bpmn | BPMN 节点类型、审批流程设计模式 |
| jeecg-aiflow | AI 编排节点类型（LLM/知识库/SQL/变量/HTTP）、流程编排模式 |
| jeecg-onlform | 26 控件类型、字段权限、JS 增强模式 |
| jeecg-system | 字典/角色/权限设计模式 |
| jeecg-portal | 14 门户组件类型、门户布局 |
| jeecg-dev | 开发工具使用模式 |

---

## 影响

### 版本号

当前 `0.4.3` → 本次整合为 **`0.4.5`**（BI skill + ECharts 迁移 + 演示模板 + 8 skill 知识层吸收，属于功能大幅增强）。

### 分层规则（用户明确）

| 层 | 目录 | 内容 |
|---|---|---|
| 前端 | `src/` | React UI / TypeScript 工具注册 / 可视化组件 / ECharts + Chart.js 渲染 |
| 后端 | `server/` | Node MCP / SQL 引擎 / API 数据源 / dbx MCP client |
| Skill 知识层 | `agent/skills/` | SKILL.md + references/ |
| 原文参考 | `agent/skills/jeecgboot-ref/` | gitignore，不进制品 |

### 安全边界

- **不引入外部脚本执行** — 新增代码是 TypeScript + Node（与现有 server/ 同栈），无 Python 依赖
- **不引入新凭证模型** — Agent 仍然只通过 dbx MCP 连接池访问数据库
- **JeecgBoot 原文保留在 gitignore 中** — 不进制品包

---

## 验收标准（总括，详细见子文档）

| # | 验收 | 子文档 |
|---|---|---|
| 1 | ECharts 替换 Chart.js 完成，`dbx_chart_collection` 正常渲染柱状图 + 折线图 | ADR-0010b |
| 2 | jimubi spec_builder TS 编译链：紧凑 spec → ECharts option | ADR-0010a |
| 3 | 10 个行业大屏模板可一键套用（mock 数据生成） | ADR-0010d |
| 4 | BI 按钮入口 + 演示模板 gallery UI | ADR-0010d |
| 5 | 构建链全绿（tsc / vite build / marketplace check / tests） | 本次主文档 |
| 6 | 8 个非 BI skill 的知识层已吸收进重写的 SKILL.md | ADR-0010c |
| 7 | jeecgboot-ref/ 保留完整原文（gitignore） | 本次主文档 |

---

## 8. 附录：jeecgboot-ref/ 完整资产清单

```
agent/skills/jeecgboot-ref/           ← gitignore，不进制品
├── jimubi-bigscreen/                 ← 完整目录拷贝
│   ├── SKILL.md
│   └── references/
│       ├── scripts/ (19 个 Python)
│       ├── scripts/defaults/ (129 个 ECharts defaults)
│       ├── templates/bigScreen/ (10 个行业模板 JSON)
│       ├── core-configs/ (5 个核心配置)
│       └── *.md (36 份)
├── jimubi-dashboard/                 ← 完整目录
├── jimureport/                       ← 完整目录（26 个 Python 脚本）
├── jeecg-onlchart/                   ← 完整目录
├── jeecg-onlreport/                  ← 完整目录
├── jeecg-onlform/                    ← 完整目录
├── jeecg-codegen-new/                ← 完整目录
├── jeecg-codegen/                    ← 完整目录
├── jeecg-bpmn/                       ← 完整目录
├── jeecg-aiflow/                     ← 完整目录（35 个 Python 脚本）
├── jeecg-system/                     ← 完整目录
├── jeecg-portal/                     ← 完整目录
└── jeecg-dev/                        ← 完整目录
```

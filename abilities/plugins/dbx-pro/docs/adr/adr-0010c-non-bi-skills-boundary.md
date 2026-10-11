# ADR-0010c: 非 BI 8 skill 技术边界 —— 架构不匹配分析与务实对等实现

## 状态

已接受。执行版本 `0.4.5`。

父决策：ADR-0010。

**用户明确**：全部 13 个 JeecgBoot skill 都要整合过来。本文档诚实分析 8 个非 BI skill 在 dbx-pro 架构下的**可提供 vs 不可提供边界**，并给出务实的对等实现策略。

---

## 0. 核心架构冲突（必须正视）

dbx-pro 是 **桌面数据库工作台插件**（TypeScript 前端 + Node MCP server + Chart.js/ECharts 渲染）。它的能力边界是：
- ✅ 直连 60+ 种数据库（dbx MCP）
- ✅ AI 写 SQL + 执行 + 结果网格
- ✅ 生成 Chart.js/ECharts 看板/大屏/报表
- ✅ 导出 HTML/Excel/CSV

JeecgBoot 的 8 个非 BI skill 全部依赖 **JeecgBoot 后端服务器组件**：
- Flowable BPMN 流程引擎（Java）
- FreeMarker 模板引擎（Java）+ Java/Vue3 代码项目结构
- JWT 用户/角色/部门/字典管理（Java + 数据库表）
- 企业门户布局引擎（Vue3 + 后端 API）
- AI 编排节点运行时（Java/Python + LLM 调用）
- Online 表单元数据驱动 CRUD（Vue3 + 后端 API）
- X-Access-Token JWT 认证

**这些后端组件在 dbx-pro 架构中都不存在，也不应该存在。** dbx-pro 不应该尝试实现一个 Flowable 流程引擎或 FreeMarker 模板引擎——那会让它变成一个 JeecgBoot 克隆，而不是数据库工作台插件。

**对等实现的务实边界**：保留每个 skill 的**设计模式 / 知识层 / 数据模型**，实现**执行层中与 dbx-pro 能力边界重合的部分**，诚实标注**不可提供的部分**。

---

## 1. 8 个 skill 逐分析

### 1.1 jeecg-codegen-new / jeecg-codegen — 代码生成

**JeecgBoot 执行层**：FreeMarker 模板引擎 → Java Entity/DTO/VO/Mapper/Service + Vue3 API + Flyway SQL + 菜单 SQL。

**dbx-pro 可提供**：

| JeecgBoot 能力 | dbx-pro 对等 | 实现方式 |
|---|---|---|
| 建表 SQL 生成（CREATE TABLE）| ✅ dbx MCP 直连数据库 CREATE TABLE | SKILL.md 里写"AI 直接调 dbx_execute_query 执行 CREATE TABLE" |
| 字段类型映射（Java ↔ DB）| ✅ dbx-pro driver-tiers.ts 已有完整映射 | 复用 |
| 字典表设计模式 | ✅ SQL 模板：`sys_dict_type` + `sys_dict_item` | SKILL.md 知识层 |
| 菜单 SQL | ❌ | JeecgBoot 专属菜单表结构，dbx-pro 不需要 |
| Flyway 迁移 | ❌ | dbx-pro 不管理应用部署 |
| Java/Vue3 代码生成 | ❌ | dbx-pro 只有 TypeScript 前端，不编译 Java |

**SKILL.md 整合**：吸收 jeecg-codegen 的「FreeMarker 上下文设计 / Entity-DTO-VO 分层 / 字段类型映射表」知识。执行层写"如何用 dbx-pro 建表 + 建字典 + 写基础 SQL 模板"。

### 1.2 jeecg-bpmn — BPMN 流程

**JeecgBoot 执行层**：Flowable 引擎（Java）+ `act/process/` API + 审批节点运行时（会签/抄送/监听器/定时器）+ OA 表单关联。

**dbx-pro 可提供**：

| JeecgBoot 能力 | dbx-pro 对等 | 实现方式 |
|---|---|---|
| BPMN 2.0 XML 定义 | ✅ | SKILL.md 知识层：节点类型（start/userTask/serviceTask/exclusiveGateway/end）+ 审批流程设计模式（经理→HR→CEO 会签）|
| 流程发起/审批/结束 SQL | ✅ dbx MCP 直连 | 设计 `workflow_def` / `workflow_instance` / `workflow_task` 三张表 + 建表 SQL + 审批流转 SQL |
| 审批人/会签人设计 | ✅ SQL 模板 | 任务表 assigneeId / candidateGroupIds 字段 |
| 监听器 | ❌ | Flowable 专属 |
| 定时任务 | ❌ | Flowable Job Service |
| BPMN XML 运行时解析 | ❌ | Flowable 引擎 |

**SKILL.md 整合**：吸收 BPMN 节点类型 + 审批流程设计模式知识。执行层写"如何设计数据库表支持审批流转"，不承诺 BPMN 引擎。

### 1.3 jeecg-aiflow — AI 编排

**JeecgBoot 执行层**：AIFlow 引擎（Java + 35 个 Python 节点脚本）+ 节点运行时（LLM/知识库/SQL/HTTP/变量/循环/分支）+ 流程发布/调试/运行 API。

**dbx-pro 可提供**：

| JeecgBoot 能力 | dbx-pro 对等 | 实现方式 |
|---|---|---|
| AI 编排节点类型 | ✅ | SKILL.md 知识层：start/end/llm/knowledge/sql/http/var/switch/loop/reply 17 种节点 + 数据在节点间的传递模式 |
| SQL 节点执行 | ✅ dbx MCP | 直接调 dbx_execute_query |
| HTTP 节点执行 | ✅ Astravia 宿主 network.fetch 权限 | 宿主已授权 |
| LLM 节点 | ❌ | dbx-pro 用宿主 Astravia Agent，不自己实现 LLM 调用链 |
| 知识库节点 | ❌ | 需要向量数据库 + 索引 |
| 流程运行时（节点调度/变量传递）| ❌ | AIFlow 引擎专属 |

**SKILL.md 整合**：吸收 AI 编排节点类型 + 流程编排模式（start → llm → sql → switch → reply）。执行层写"如何设计 AI 编排流程图"，不承诺运行时。

### 1.4 jeecg-onlform — Online 表单

**JeecgBoot 执行层**：元数据驱动 CRUD（cgform API）+ 26 控件类型 + JS/Java/SQL 增强 + 主子表/树表 + 字段权限 + 字典下拉。

**dbx-pro 可提供**：

| JeecgBoot 能力 | dbx-pro 对等 | 实现方式 |
|---|---|---|
| 元数据驱动 CRUD 设计 | ✅ | SKILL.md 知识层：26 控件类型 + 字段类型映射 + 主子表 SQL 设计 |
| 建表 SQL | ✅ dbx MCP | AI 直接执行 CREATE TABLE |
| 下拉选项字典设计 | ✅ SQL 模板 | `sys_dict` + `sys_dict_item` |
| 主子表关联 SQL | ✅ SQL 模板 | parent_id 外键 + 联查 SQL |
| 前端表单渲染 | ❌ | cgform 元数据运行时是 Vue3 + JeecgBoot API，dbx-pro 不做低代码表单平台 |
| JS/Java/SQL 增强 | ❌ | 需要表单运行时注入 |

**SKILL.md 整合**：吸收 26 控件类型 + 字段权限 + 主子表设计模式。执行层写"如何设计支持低代码表单的数据库表结构"。

### 1.5 jeecg-system — 系统主数据

**JeecgBoot 执行层**：JWT 用户/角色/部门/字典/岗位/租户/数据源管理（`sys_user`/`sys_role`/`sys_depart`/`sys_dict` 等 20+ 表 + `/sys/` API）。

**dbx-pro 可提供**：

| JeecgBoot 能力 | dbx-pro 对等 | 实现方式 |
|---|---|---|
| 字典表设计 | ✅ SQL 模板 | `sys_dict_type` + `sys_dict_item` |
| 角色/权限表设计 | ✅ SQL 模板 | `sys_role` + `sys_permission` + `sys_role_permission` |
| 用户/部门表设计 | ✅ SQL 模板 | `sys_user` + `sys_depart` + `sys_user_role` |
| 字典 CRUD API | ❌ | JeecgBoot `/sys/dict/` API 专属 |
| JWT 认证 | ❌ | dbx-pro 不管理用户认证（宿主 Astravia 有自己的体系）|
| 租户隔离 | ❌ | 多租户是应用级，dbx-pro 是插件级 |

**SKILL.md 整合**：吸收字典/角色/权限/用户的数据库设计模式（表结构 + 外键 + 索引）。执行层写"如何设计这些表 + SQL"。

### 1.6 jeecg-portal — 门户

**JeecgBoot 执行层**：14 门户组件（轮播图/新闻/公告/流程中心/快捷入口/待办/知识库/文本/iframe 等）+ Web/App 双端布局引擎 + `/portal/` API。

**dbx-pro 可提供**：

| JeecgBoot 能力 | dbx-pro 对等 | 实现方式 |
|---|---|---|
| 门户组件类型清单 | ✅ | SKILL.md 知识层 |
| 门户布局设计模式 | ✅ | 网格布局 + 卡片组件 |
| 门户数据来源 | ❌ | 需要后端 API 或数据源 |
| 门户运行时（布局引擎）| ❌ | 企业门户专属 |

**SKILL.md 整合**：吸收门户组件类型 + 布局设计模式。纯知识层，无执行层。

### 1.7 jeecg-dev — 开发工具

JeecgBoot 开发工具集（IDE 插件 + Maven 插件 + 脚手架）。**完全不适用**——dbx-pro 是 dbx-pro 插件，不做开发工具。

**SKILL.md 整合**：无。原文保留在 `jeecgboot-ref/` 但不整合进 dbx-pro SKILL.md。

---

## 2. 所有 13 个 skill 的 dbx-pro 对等实现总结

| Skill | 知识层吸收 | 执行层对等 |
|---|---|---|
| **jimubi-bigscreen** | ✅ 完整 | ✅ dbx-bigscreen-builder.ts（spec → ECharts option）|
| **jimubi-dashboard** | ✅ 完整 | ✅ 同上，换亮色主题 + 24 栅格 |
| **jimureport** | ✅ 完整 | ✅ dbx-report-builder.ts（SQL → HTML 报表）|
| **jeecg-onlchart** | ✅ 完整 | ✅ chart-graph-registry.ts（60+ graphType）|
| **jeecg-onlreport** | ✅ 完整 | ✅ filter-builder.mjs（SQL 筛选）|
| **jeecg-codegen-new** | ✅ Entity-DTO-VO + 字段类型映射 | ✅ dbx MCP CREATE TABLE + 字典表 SQL 模板 |
| **jeecg-codegen** | ✅ 同上（多版本兼容）| ✅ 同上 |
| **jeecg-bpmn** | ✅ 17 种 BPMN 节点类型 + 审批流程设计 | ✅ workflow_def/instance/task 三表设计 + 审批流转 SQL |
| **jeecg-aiflow** | ✅ 17 种 AI 编排节点类型 + 流程编排模式 | ✅ SQL 节点执行（dbx MCP）+ HTTP 节点（宿主 fetch）|
| **jeecg-onlform** | ✅ 26 控件类型 + 主子表 + 字段权限 | ✅ 建表 SQL + 字典下拉模板 |
| **jeecg-system** | ✅ 字典/角色/权限/用户表设计模式 | ✅ 建表 SQL 模板 |
| **jeecg-portal** | ✅ 14 门户组件 + 布局设计 | ❌ 无执行层 |
| **jeecg-dev** | ❌ | ❌ 完全不适用 |

---

## 3. SKILL.md 重写规划

当前 dbx-pro SKILL.md（154 行）只覆盖数据库 + BI 可视化。重写后（~500 行）将覆盖：

```
dbx-pro SKILL.md（v0.0.113）
├── 触发条件
├── 核心能力总览
├── § 工具清单
│   ├── dbx_execute_query / dbx_describe_table / dbx_list_tables
│   ├── dbx_query_full
│   ├── dbx_chart_collection
│   └── dbx_bigscreen_builder / dbx_report_builder（新增）
├── § 看板/大屏生成（BI 可视化 5 skill 完整吸收）
│   ├── 紧凑 spec 格式
│   ├── ECharts graphType 选型矩阵
│   ├── 命名色板 + 主题自动应用
│   ├── pitfall 防踩坑清单
│   └── 10 个行业大屏模板清单
├── § 报表生成（jimureport + jeecg-onlreport）
│   ├── SQL 参数化模式
│   ├── 多级表头 / 分组合计
│   └── 筛选器设计
├── § AI 编排（jeecg-aiflow 知识层）
│   ├── 17 种节点类型
│   ├── 流程编排模式
│   └── SQL 节点执行（dbx MCP）
├── § 数据库建模（jeecg-codegen + jeecg-onlform + jeecg-system 知识层）
│   ├── 实体-字典-角色表设计模式
│   ├── 主子表 SQL
│   └── 建表模板
├── § 审批流程设计（jeecg-bpmn 知识层）
│   ├── 三表设计 + 审批流转 SQL
│   └── 会签/抄送设计
├── § 安全准则
├── references/ 索引（6 份）
└── 工作流示例
```

---

## 4. 验收标准

| # | 验收 | 通过标准 |
|---|---|---|
| 1 | SKILL.md 重写完成 | 覆盖全部 13 个 skill 的知识层 + 执行层可提供部分 |
| 2 | 8 个非 BI skill 的**不可提供部分**在 SKILL.md 里诚实标注 | 不承诺 Flowable 引擎 / FreeMarker 模板 / JWT 用户体系 |
| 3 | dbx-bigscreen-builder / dbx-report-builder 等新工具注册 | register-tools.ts 包含新工具 |
| 4 | server/ 新增文件通过 SQL 安全检查 | report-executor.mjs / filter-builder.mjs 复用 sql-safety.mjs |
| 5 | jeecgboot-ref/ 原文保留 | gitignore，不进制品 |

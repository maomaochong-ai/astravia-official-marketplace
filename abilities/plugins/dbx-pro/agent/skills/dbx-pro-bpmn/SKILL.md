---
name: dbx-pro-bpmn
description: >-
  BPMN 工作流知识库 —— jeecg-bpmn 对等，BPMN XML 生成 + 工作流三表设计 + 审批节点类型。
  触发：用户说"流程/工作流/BPMN/审批/Flowable"。
---

# dbx-pro-bpmn —— BPMN 工作流知识库（jeecg-bpmn 对等）

> **dbx-pro 没有 Flowable 引擎运行时。本 skill 提供 jeecg-bpmn 知识层：
> BPMN XML 规范 + 工作流三表设计 + 审批节点类型，AI 据此设计流程定义和表结构。**

## 触发条件

流程 / 工作流 / BPMN / 审批 / 申请流 / 节点流转 / Flowable / Activiti。

## 核心流程（知识层指导）

```
用户描述审批流程（如"请假三级审批"）
  ↓
① 确定节点：申请 → 直属领导 → 部门总监 → HR 备案 → 结束
  ↓
② 从 10 种审批节点类型选择对应节点
  ↓
③ 输出：BPMN XML + 业务表（带 workflow_status 字段）
  ↓
④ 如需运行时，由宿主应用（Astravia Agent）编排
```

## 审批节点类型（10 种）

| 节点类型 | 说明 | BPMN 元素 |
|---|---|---|
| UserTask | 用户审批（指定人/角色）| `<userTask>` |
| ServiceTask | 自动任务（调 SQL / HTTP）| `<serviceTask>` |
| ExclusiveGateway | 排他网关（条件分支）| `<exclusiveGateway>` |
| ParallelGateway | 并行网关（同时执行）| `<parallelGateway>` |
| InclusiveGateway | 包容网关（满足条件都执行）| `<inclusiveGateway>` |
| StartEvent | 开始事件 | `<startEvent>` |
| EndEvent | 结束事件 | `<endEvent>` |
| BoundaryEvent | 边界事件（超时/异常）| `<boundaryEvent>` |
| SubProcess | 子流程 | `<subProcess>` |
| CallActivity | 调用活动 | `<callActivity>` |

## 工作流三表设计模式

```sql
-- 1. 流程定义表
CREATE TABLE act_re_procdef (
  id SERIAL PRIMARY KEY,
  key VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  version INT DEFAULT 1,
  category VARCHAR(50),
  bpmn_xml TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

-- 2. 流程实例运行表
CREATE TABLE act_ru_execution (
  id BIGSERIAL PRIMARY KEY,
  proc_def_id INT REFERENCES act_re_procdef(id),
  instance_no VARCHAR(50) UNIQUE,
  business_key VARCHAR(200),
  start_user_id BIGINT,
  status VARCHAR(20) DEFAULT 'running', -- running / completed / suspended
  started_at TIMESTAMP DEFAULT NOW(),
  ended_at TIMESTAMP
);

-- 3. 任务表（待办/已办）
CREATE TABLE act_ru_task (
  id BIGSERIAL PRIMARY KEY,
  execution_id BIGINT NOT NULL REFERENCES act_ru_execution(id),
  node_id VARCHAR(50) NOT NULL,     -- BPMN 节点 ID
  node_name VARCHAR(200),
  assignee BIGINT,                   -- 处理人
  candidate_roles TEXT[],            -- 候选角色
  candidate_users BIGINT[],          -- 候选用户
  form_key VARCHAR(200),
  status VARCHAR(20) DEFAULT 'todo', -- todo / claimed / completed
  created_at TIMESTAMP DEFAULT NOW(),
  claimed_at TIMESTAMP,
  completed_at TIMESTAMP,
  outcome VARCHAR(20)                -- approve / reject / delegate
);
CREATE INDEX idx_task_assignee ON act_ru_task(assignee, status);
CREATE INDEX idx_task_execution ON act_ru_task(execution_id);
```

## BPMN XML 最小示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  id="diagram" targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="leave-approval" name="请假审批" isExecutable="true">
    <bpmn2:startEvent id="StartEvent_1"/>
    <bpmn2:userTask id="manager" name="直属领导审批"
      bpmn:assignee="${manager}"/>
    <bpmn2:userTask id="director" name="部门总监审批"/>
    <bpmn2:exclusiveGateway id="Gateway_1" name="是否超过3天?"/>
    <bpmn2:endEvent id="EndEvent_1"/>
  </bpmn2:process>
</bpmn2:definitions>
```

## 与 jeecg-bpmn 的差异

| 维度 | jeecg-bpmn | dbx-pro-bpmn |
|---|---|---|
| 引擎 | Flowable 6.x 运行时 | 无引擎（知识层）|
| BPMN 存储 | 数据库表 act_re_procdef | XML 文本输出 |
| 任务运行 | Flowable RuntimeService | 宿主 Agent 编排 |
| API | `/flowable/*` REST API | 无 HTTP API |

## 服务端代码

无独立 server 模块。知识层，输出 BPMN XML + SQL DDL。

## references/

| 文件 | 内容 |
|---|---|
| references/bpmn-advanced.md | 条件表达式系统、抄送、按钮、服务任务详解 |
| references/bpmn-api-task-autocreate.md | apiTask 自动创建后端 Controller 接口（用户未提供 apiUrl 时）|
| references/bpmn-assignee-types.md | 7 种审批人配置方式详解 + XML 属性组合 |
| references/bpmn-call-activity.md | 外部调用子流程 / 会签子流程 / 嵌套子流程三种模式 |
| references/bpmn-countersign.md | 会签（多实例任务）配置详解：完成比例、完成条件、加签减签 |
| references/bpmn-custom-form-frontend.md | 代码生成模块关联审批流程时的前端代码变更指南 |
| references/bpmn-db-config.md | ext_act_process 系列 4 张流程配置表结构与使用 |
| references/bpmn-deploy-authorize.md | 流程发布、授权与编辑完整操作（含 Python 实现代码）|
| references/bpmn-examples.md | 完整请假审批流程示例 + Python 脚本 + 流程模式 |
| references/bpmn-field-permissions.md | 节点字段权限配置（严重坑：saveOrUpdateBatch 必须在 deploy 之后）|
| references/bpmn-layout.md | 三条强制布局规范 + 节点 ID 命名规则 |
| references/bpmn-manual-branch.md | 手工分支（意见分支）配置：与条件分支的区别与 XML |
| references/bpmn-oa-approval-comments.md | OA 审批意见字段与 DesForm 流程节点联动配置 |
| references/bpmn-oa-templates.md | OA 表单字段类型清单（input / textarea / select 等）|
| references/bpmn-process-config.md | 流程高级配置与报表打印（Python 实现）|
| references/bpmn-save-process-api.md | saveProcess API 规范 + 临时脚本指南 |
| references/bpmn-service-task-autocreate.md | serviceTask 自动创建 Java 类（用户未提供 className 时）|
| references/bpmn-signal-message-events.md | 信号事件 / 消息事件 6 种类型配置说明 |
| references/bpmn-subprocess-gateway.md | 网关类型一览 + 子流程与网关类型详解 |
| references/bpmn-task-extend.md | taskExtendJson 字段速查 + 监听器配置 |
| references/bpmn-templates.md | BPMN 模板参考文档索引（已拆分为多文件）|
| references/bpmn-xml-skeleton.md | BPMN XML 骨架模板 + 基本节点 XML 模板 |

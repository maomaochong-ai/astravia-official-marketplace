# taskExtendJson 与监听器配置

## 0. 常见需求速查（避免猜字段名）

> **⛔ 修改已有节点的 taskExtendJson 前，必须先读 XML 确认现有字段名，不可猜测。**

| 用户需求 | 字段 | 正确值 | 错误示例 |
|---------|------|--------|---------|
| 审批人与发起人为**同一人**时自动跳过 | `sameMode` | `2` | ~~`isSkipAssigneeSameUser: true`~~、~~`isSkipApproval: true`~~（后者是无条件跳过） |
| 只有**一个候选人**时自动签收 | `isSkipAssigneeOnePersion` | `true` | ~~`isAutoClaimTask: true`~~、~~`isSkipOne: true`~~ （注意字段名拼写 `Persion` 不是 `Person`）|
| 审批人**为空**时自动跳过 | `isSkipAssigneeEmpty` | `true` | - |
| **无条件**跳过（自动通过，与发起人无关） | `isSkipApproval` | `true` | 不要与 sameMode=2 混淆 |
| 由**上一节点**指派审批人 | `isAssignedByPreviousNode` | `true` | - |

配置以上任意跳过行为的节点，**必须**同时挂载 `TaskSkipApprovalListener`（event=create），否则配置不生效。

---

## 1. taskExtendJson 配置说明

taskExtendJson 控制审批节点的行为，以 JSON 字符串存储在 extensionElements 中：

```xml
<flowable:taskExtendJson value="{JSON内容}" />
```

| 字段 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `sameMode` | int | `0` | 相同处理人模式：0=默认（发起人对自己审批不跳过），**2=审批人与发起人为同一人时自动跳过**，4=转交给部门负责人审批。草稿节点（draft=true）固定用 0，配合 AutoSubmitListener 自动提交。**注意：原文档中"1=跳过"有误，实测正确值为 2** |
| `isSkipAssigneeEmpty` | bool | `false` | 审批人为空时是否自动跳过 |
| `isSkipAssigneeOnePersion` | bool | `false` | 只有一人时是否自动跳过（常用于发起人=审批人场景） |
| `isSkipApproval` | bool | `false` | 是否跳过审批（自动通过） |
| `isAssignedByPreviousNode` | bool | `false` | 是否由上一节点指派审批人 |
| `isEmptyAssignedByPreviousNode` | bool | `false` | 上一节点未指派时是否允许空 |
| `isSkipApprovedOnCountersignReturn` | bool | `false` | 会签驳回时是否跳过已审批的人 |

### 配置项互斥规则（必须遵守）

以下三个配置项逻辑上互斥，**不可同时设为 `true`**：

| 已设为 true 的配置 | 不可同时为 true |
|-------------------|----------------|
| `isSkipAssigneeEmpty`（为空自动跳过） | `isAssignedByPreviousNode`、`isEmptyAssignedByPreviousNode` |
| `isAssignedByPreviousNode`（由上节点指定） | `isSkipAssigneeEmpty`、`isEmptyAssignedByPreviousNode` |
| `isEmptyAssignedByPreviousNode`（为空则由上节点指定） | `isSkipAssigneeEmpty`、`isAssignedByPreviousNode` |

**`isSkipApprovedOnCountersignReturn`**（会签退回后已审批过的不需要审）仅会签节点（`countersign`）可设为 `true`，普通审批节点必须为 `false`。

> 生成或修改 taskExtendJson 时，若用户要求开启某项，需同时关闭与之互斥的配置。

使用 taskExtendJson 时，通常需要配合跳过审批监听器：
```xml
<flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
```

---

## 2. 必需的监听器汇总

### 2.1 流程级监听器（写在 process > extensionElements 中）

```xml
<bpmn2:extensionElements>
  <!-- 流程结束监听器（必需，所有流程都要有） -->
  <flowable:executionListener
    class="org.jeecg.modules.extbpm.listener.execution.ProcessEndListener"
    event="end" />

  <!-- 任务创建全局监听器（必需，新版设计器标配） -->
  <flowable:eventListener
    class="org.jeecg.modules.listener.tasktip.TaskCreateGlobalListener" />
</bpmn2:extensionElements>
```

### 2.2 节点级监听器（写在 userTask > extensionElements 中）

```xml
<!-- 跳过审批监听器（使用 taskExtendJson 时必需） -->
<flowable:taskListener
  class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener"
  event="create" />

<!-- 完成时更新表单数据监听器（按需） -->
<flowable:taskListener
  class="org.jeecg.modules.extbpm.listener.task.TaskUpdateFormDataListener"
  event="complete" />

<!-- 首节点自动提交监听器（草稿节点专用） -->
<!-- 首次发起流程时自动跳过此节点，驳回后才需手动操作 -->
<flowable:taskListener
  class="org.jeecg.modules.extbpm.listener.task.TaskCreatedAutoSubmitListener"
  event="create"
  id="9c3064baa7074eab62e3c5b3b5458691" />
```

### 2.3 结束节点监听器（按需）

```xml
<bpmn2:endEvent id="End_reject">
  <bpmn2:extensionElements>
    <!-- 拒绝时触发业务逻辑 -->
    <flowable:executionListener
      expression="${myBizListener.onReject(execution)}"
      event="start" />
  </bpmn2:extensionElements>
</bpmn2:endEvent>
```

---

## 3. 系统预置监听器一览（ext_act_listener 表）

系统在 `ext_act_listener` 表中预置了所有可用的监听器，设计器界面从此表加载监听器列表供用户选择。

**listener_type：** 1=执行监听器（executionListener），2=任务监听器（taskListener）

**listener_value_type：** `javaClass`=Java类，`expression`=表达式，`delegateExpression`=Spring委托表达式

### 3.1 执行监听器（type=1，用于流程级/节点级）

| 名称 | 事件 | 类型 | 完整类路径 |
|------|------|------|-----------|
| 平台通用流程结束监听 | end | javaClass | `org.jeecg.modules.extbpm.listener.execution.ProcessEndListener` |
| 公文收文分发 | end | javaClass | `org.jeecg.modules.listener.easyoa.ReveicedStartListener` |
| 子流程会签开始监听 | start | javaClass | `org.jeecg.modules.extbpm.listener.execution.SubProcessHqStartListener` |
| 子流程开始监听 | start | javaClass | `org.jeecg.modules.extbpm.listener.execution.SubProcessStartListener` |
| 信号启动流程监听 | start | javaClass | `org.jeecg.modules.extbpm.listener.execution.SignalProcessStartListener` |
| 表单设计器生成自动编号 | start | javaClass | `org.jeecg.modules.designform.listener.DesformAutoNumberListener` |
| 公文表单监听 | start | javaClass | `org.jeecg.modules.listener.easyoa.OaOfficialdocStartListener` |

### 3.2 任务监听器（type=2，用于 userTask 级）

| 名称 | 事件 | 类型 | 完整类路径/表达式 |
|------|------|------|-----------------|
| 用户审核节点跳过规则监听 | create | javaClass | `org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener` |
| 首任务节点自动提交监听 | create | javaClass | `org.jeecg.modules.extbpm.listener.task.TaskCreatedAutoSubmitListener` |
| 子流程 | create | expression | `${subProcessListener}` |
| spring表达式监听 | create | delegateExpression | `${someJavaDelegateBean}` |
| 节点监听更新业务数据到流程变量 | complete | javaClass | `org.jeecg.modules.extbpm.listener.task.TaskUpdateFormDataListener` |
| 公告审核监听 | complete | javaClass | `org.jeecg.modules.listener.announcement.NoticeReviewEndListener` |
| 新闻审核监听 | complete | javaClass | `org.jeecg.modules.listener.easyoa.NewsReviewEndListener` |
| 公文发文分发 | complete | javaClass | `org.jeecg.modules.listener.easyoa.DistributeIssuedEndListener` |

### 3.3 常用监听器使用场景

| 监听器 | 使用场景 | 是否必需 |
|--------|---------|---------|
| `ProcessEndListener` | 所有流程都要挂，流程结束时更新业务状态 | 必需 |
| `TaskSkipApprovalListener` | 使用 taskExtendJson 时挂载，实现跳过审批逻辑 | 配合 taskExtendJson 必需 |
| `TaskCreatedAutoSubmitListener` | 草稿节点（sameMode=2），首次自动跳过 | 草稿节点必需 |
| `TaskUpdateFormDataListener` | 节点完成时将表单数据同步到流程变量 | 按需 |
| `SubProcessStartListener` | 子流程启动时的初始化 | 子流程必需 |
| `SubProcessHqStartListener` | 子流程会签场景 | 子流程会签必需 |
| `DesformAutoNumberListener` | DesForm 表单自动编号 | DesForm 自动编号时需要 |

---

## 4. 源码级监听器完整清单

以下从源码中扫描所有 `implements TaskListener` 和 `implements ExecutionListener` 的实现类。

### 4.1 TaskListener 实现类（11个）

#### 平台核心（jeecg-boot-module-bpm-flowable）

| 完整类路径 | 事件 | 说明 |
|-----------|------|------|
| `org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener` | create | 节点审批自动跳过（发起人=审批人跳过、审批人为空跳过、已审批免二次等） |
| `org.jeecg.modules.extbpm.listener.task.TaskUpdateFormDataListener` | create | 同步表单字段到流程变量，更新业务标题，触发简流事件 |
| `org.jeecg.modules.extbpm.listener.task.TaskCreatedAutoSubmitListener` | create | 草稿节点首次自动提交（sameMode=2），自动设置发起人并完成任务 |
| `org.jeecg.modules.extbpm.listener.task.SubProcessListener` | create | 子流程启动时传递主流程标题和业务号 |

#### 简流（jeecg-boot-module-mindesflow-flowable）

| 完整类路径 | 事件 | 说明 |
|-----------|------|------|
| `org.jeecg.modules.listener.easyoa.TaskApprovalListener` | create | 简流版审批跳过监听 |
| `org.jeecg.modules.extbpm.process.adapter.listener.ApproveResultBranchListener` | create | 审批结果分支标识变量设置 |
| `org.jeecg.modules.extbpm.process.adapter.listener.BeforeEditListener` | create | 填写节点自定义表单数据ID设置 |

#### 业务（jeecg-boot-module-joa-flowable）

| 完整类路径 | 事件 | 说明 |
|-----------|------|------|
| `org.jeecg.modules.testListenerExpression.TestTaskListener` | create/assign/complete/delete | 测试用监听器，记录各事件日志 |
| `org.jeecg.modules.listener.announcement.NoticeReviewEndListener` | complete | 公告审核完成自动发布 |
| `org.jeecg.modules.listener.easyoa.DistributeIssuedEndListener` | complete | 公文发文分发，按抄送部门创建分发记录 |
| `org.jeecg.modules.listener.easyoa.NewsReviewEndListener` | complete | 新闻审核完成自动发布 |

### 4.2 ExecutionListener 实现类（12个）

#### 平台核心（jeecg-boot-module-bpm-flowable）

| 完整类路径 | 事件 | 说明 |
|-----------|------|------|
| `org.jeecg.modules.extbpm.listener.execution.ProcessEndListener` | end | 流程结束更新状态、处理表单数据、清Redis缓存（**必需**） |
| `org.jeecg.modules.extbpm.listener.execution.SignalProcessStartListener` | start | 信号启动流程初始化变量、获取表单数据、设置业务key |
| `org.jeecg.modules.extbpm.listener.execution.SubProcessStartListener` | start | 子流程启动传递主流程标题、表单key、数据ID |
| `org.jeecg.modules.extbpm.listener.execution.SubProcessHqStartListener` | start | 会签子流程启动传递主流程变量、表单URL和业务数据 |

#### 简流（jeecg-boot-module-mindesflow-flowable）

| 完整类路径 | 事件 | 说明 |
|-----------|------|------|
| `org.jeecg.modules.minides.listener.ProcessEndRemoveRedisListener` | end | 简流结束清Redis缓存 |
| `org.jeecg.modules.minides.listener.MiniSubProcessStartListener` | start | 简流子流程启动初始化，传递流程变量 |
| `org.jeecg.modules.extbpm.process.adapter.delegate.MiniCallActivityListener` | start | 简流调用活动参数传递，处理系统变量和工作表映射 |

#### 业务（jeecg-boot-module-joa-flowable）

| 完整类路径 | 事件 | 说明 |
|-----------|------|------|
| `org.jeecg.modules.designform.listener.DesformAutoNumberListener` | start | 表单设计器自动编号 |
| `org.jeecg.modules.testListenerExpression.TestExecutionListener` | start/end | 测试用执行监听器 |
| `org.jeecg.modules.listener.easyoa.ReveicedStartListener` | end | 公文收文分发，根据部门信息分发任务 |
| `org.jeecg.modules.listener.easyoa.OaOfficialdocStartListener` | start | 公文表单监听，校验各节点意见字段 |
| `org.jeecg.modules.extbpm.listener.execution.ProcessEndListener`（JOA副本） | end | OA模块流程结束处理（与平台核心同类名，不同模块） |

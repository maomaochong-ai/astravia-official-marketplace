# 会签配置详解

会签（多实例任务）：一个审批节点同时由多人处理，根据完成比例决定是否通过。

**重要前提：** 不启动多实例（不加 `multiInstanceLoopCharacteristics`），则只会创建一个任务，默认不启动。不启动多实例时，会签相关配置都无效。

## 1. 会签通用结构

```xml
<bpmn2:userTask id="task_xxx" name="会签节点"
  flowable:assignee="${assigneeUserId}"
  flowable:countersignRule="${RULE}">
  <bpmn2:extensionElements>
    <flowable:taskExtendJson value="{...}" />
    <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
    <flowable:taskCountersignExtendJson value="${BASE64_CONFIG}" />
  </bpmn2:extensionElements>
  <bpmn2:multiInstanceLoopCharacteristics isSequential="false"
    flowable:collection="${COLLECTION_EXPR}"
    flowable:elementVariable="assigneeUserId">
    <bpmn2:completionCondition xsi:type="bpmn2:tFormalExpression">
      ${COMPLETION_CONDITION}
    </bpmn2:completionCondition>
  </bpmn2:multiInstanceLoopCharacteristics>
</bpmn2:userTask>
```

## 2. 会签规则（countersignRule）

| 规则值 | 说明 | completionCondition |
|--------|------|---------------------|
| `countersign_all` | 全部通过 | `${nrOfCompletedInstances/nrOfInstances==1}` |
| `countersign_one` | 一人通过即可 | `${nrOfCompletedInstances/nrOfInstances>0}` |
| `countersign_half` | 半数通过 | `${nrOfCompletedInstances/nrOfInstances>=0.5}` |
| `countersign_proportion` | 按比例通过（自定义比例） | `${nrOfCompletedInstances/nrOfInstances>=0.N}` |
| `countersign_custom` | 自定义选人 | 自定义 |

> **注意：** XML 中 `>=` 需要写成 `&gt;=`，如 `${nrOfCompletedInstances/nrOfInstances&gt;=0.6}`

> **投票比例限制（countersign_proportion）：** 系统 UI 下拉只提供10的整数倍：**10%/20%/30%/40%/50%/60%/70%/80%/90%/100%**，对应小数 `0.1`~`1.0`。不支持任意小数（如 0.75、0.33 等）。`bpmn_creator.py` 已内置验证，传入非整数倍会报 `ValueError`。

## 3. 顺序会签 vs 并行会签

| 对比项 | 并行会签（isSequential="false"） | 顺序会签（isSequential="true"） |
|--------|-------------------------------|-------------------------------|
| 任务创建 | 同时为所有审批人创建任务 | 按顺序逐个创建，前一个完成才创建下一个 |
| nrOfActiveInstances | 等于尚未完成的审批人数 | 始终为 1 |
| 适用场景 | 多人同时审批，互不影响 | 按层级逐级审批 |
| 完成条件触发 | 每完成一个就检查条件 | 每完成一个就检查条件 |

```xml
<!-- 并行会签（默认，所有人同时收到任务） -->
<bpmn2:multiInstanceLoopCharacteristics isSequential="false" ...>
<!-- 顺序会签（按顺序逐个审批） -->
<bpmn2:multiInstanceLoopCharacteristics isSequential="true" ...>
```

## 4. 多实例内置流程变量

多实例自动创建以下 3 个流程变量，用于 `completionCondition` 表达式：

| 变量名 | 类型 | 说明 |
|--------|------|------|
| `nrOfInstances` | int | 实例总数（审批人总数） |
| `nrOfActiveInstances` | int | 当前活跃的（未完成的）实例数。**顺序会签时此值始终为 1** |
| `nrOfCompletedInstances` | int | 已完成的实例个数 |

**完成条件示例：**
```
${nrOfCompletedInstances/nrOfInstances==1}      → 全部完成
${nrOfCompletedInstances/nrOfInstances>0}       → 至少一人完成
${nrOfCompletedInstances/nrOfInstances>=0.5}    → 50%完成
${nrOfCompletedInstances/nrOfInstances>=0.6}    → 60%完成时，删除其他未完成任务，继续下一步
```

## 5. 会签工具 Bean — flowUtil

`flowUtil` 是系统暴露的 Spring Bean，提供会签人员集合获取方法：

| 方法 | 说明 | 用于 |
|------|------|------|
| `${flowUtil.stringToList('user1,user2')}` | 将逗号分隔字符串转为 List 集合 | 固定人员会签（candidateUsers） |
| `${flowUtil.getAssigneeUsers(execution,'BASE64配置')}` | 根据 Base64 编码的配置动态获取审批人列表 | 部门/岗位/表单字段会签 |

**`stringToList` 的变量写法：**
```xml
<!-- 固定人员 -->
flowable:collection="${flowUtil.stringToList('admin,jeecg,zhangsan')}"
<!-- 使用流程变量（动态） -->
flowable:collection="${flowUtil.stringToList(assigneeUserIdList)}"
```

**`getAssigneeUsers` 的 Base64 配置：** 将 taskCountersignExtendJson 的 JSON（去掉 timestamp 和 countersignProportion）进行 Base64 编码后作为参数传入。

## 4. 会签审批人类型（auditorUserType）

taskCountersignExtendJson 是 Base64 编码的 JSON，解码后结构如下：

### 人员会签（candidateUsers）

```json
{
  "auditorUserType": "candidateUsers",
  "auditorUserIds": ["jeecg", "admin"],
  "countersignProportion": "0.2",
  "timestamp": 1758257673121
}
```

对应 XML collection：
```xml
flowable:collection="${flowUtil.stringToList('jeecg,admin')}"
```

### 部门会签（candidateDepts）

```json
{
  "auditorUserType": "candidateDepts",
  "auditorDeptIds": ["部门ID1", "部门ID2"],
  "timestamp": 1758257664644
}
```

对应 XML collection：
```xml
flowable:collection="${flowUtil.getAssigneeUsers(execution,'BASE64编码的配置')}"
```

### 职务会签（candidatePosts）

```json
{
  "auditorUserType": "candidatePosts",
  "auditorPostIds": ["职务ID1", "职务ID2"],
  "timestamp": 1758202368122
}
```

对应 XML collection：
```xml
flowable:collection="${flowUtil.getAssigneeUsers(execution,'BASE64编码的配置')}"
```

### 表单字段会签（formData）

从表单中的用户选择控件动态获取会签人：

```json
{
  "auditorUserType": "formData",
  "auditorCountersignFormField": "select_user_xxx",
  "auditorCountersignFormFieldType": "select-user",
  "timestamp": 1758257668105
}
```

对应 XML collection：
```xml
flowable:collection="${flowUtil.getAssigneeUsers(execution,'BASE64编码的配置')}"
```

### 角色会签（candidateGroups）

```json
{
  "auditorUserType": "candidateGroups",
  "auditorGroupIds": ["admin"]
}
```

对应 XML collection：
```xml
flowable:collection="${flowUtil.getAssigneeUsers(execution,'BASE64编码的配置')}"
```

### 审批角色会签（candidateApprovalGroups）

```json
{
  "auditorUserType": "candidateApprovalGroups",
  "auditorApprovalGroupIds": ["1979845941985529857"]
}
```

对应 XML collection：
```xml
flowable:collection="${flowUtil.getAssigneeUsers(execution,'BASE64编码的配置')}"
```

### 岗位会签（candidateDeptPositions）

```json
{
  "auditorUserType": "candidateDeptPositions",
  "auditorDeptPositionIds": ["1958497164103520258"]
}
```

对应 XML collection：
```xml
flowable:collection="${flowUtil.getAssigneeUsers(execution,'BASE64编码的配置')}"
```

### 自定义会签（countersign_custom）— 指定人员

无 taskCountersignExtendJson，通过流程变量 `assigneeUserIdList` 动态传入：

```xml
flowable:collection="${flowUtil.stringToList(assigneeUserIdList)}"
```

### 自定义会签（countersign_custom）— 上一会签节点处理人的上级

使用 `oaUtil` 获取上一个会签节点所有处理人的上级领导：

```xml
flowable:collection="${oaUtil.getLastTaskAssigneePositionLevel1(execution)}"
```

> **适用场景：** 当前节点需要由上一个会签节点所有审批人的直属上级来审批。

## 4.1 XML 转义规则（重要）

> **编写临时脚本生成会签 XML 时，必须注意以下转义规则，否则 Flowable 部署会报 "Error parsing XML"：**

| 字符 | XML 属性中必须写为 | 说明 |
|------|------------------|------|
| `"` | `&#34;` | taskExtendJson value 中的 JSON 双引号 |
| `'` | `&#39;` | `flowUtil.getAssigneeUsers(execution,'BASE64')` 和 `flowUtil.stringToList('user1,user2')` 中的单引号 |
| `>=` | `&gt;=` | completionCondition 中的大于等于号 |

**collection 表达式正确写法（Python）：**
```python
# 使用 &#39; 转义单引号
collection = '${flowUtil.getAssigneeUsers(execution,&#39;%s&#39;)}' % assignee_b64
# 或
collection = "${flowUtil.stringToList(&#39;admin,jeecg&#39;)}"
```

**错误写法（URL 编码后单引号会丢失）：**
```python
# 错误！不要用三引号字符串拼接嵌入单引号
xml = '''...flowable:collection="${flowUtil.getAssigneeUsers(execution,'''' + b64 + '''')}"...'''
```

## 5. 会签审批人类型汇总

| auditorUserType | 说明 | collection 表达式 | ID 字段 |
|-----------------|------|-------------------|---------|
| `candidateUsers` | 指定人员 | `flowUtil.stringToList('user1,user2')` | `auditorUserIds` |
| `candidateDepts` | 部门 | `flowUtil.getAssigneeUsers(execution,'BASE64')` | `auditorDeptIds` |
| `candidatePosts` | 职务 | `flowUtil.getAssigneeUsers(execution,'BASE64')` | `auditorPostIds` |
| `candidateGroups` | 角色 | `flowUtil.getAssigneeUsers(execution,'BASE64')` | `auditorGroupIds` |
| `candidateApprovalGroups` | 审批角色 | `flowUtil.getAssigneeUsers(execution,'BASE64')` | `auditorApprovalGroupIds` |
| `candidateDeptPositions` | 岗位 | `flowUtil.getAssigneeUsers(execution,'BASE64')` | `auditorDeptPositionIds` |
| `formData` | 表单字段 | `flowUtil.getAssigneeUsers(execution,'BASE64')` | `auditorCountersignFormField` + `auditorCountersignFormFieldType` |
| (自定义-指定人员) | 流程变量 | `flowUtil.stringToList(assigneeUserIdList)` | 无 taskCountersignExtendJson |
| (自定义-上级) | 上一节点处理人上级 | `oaUtil.getLastTaskAssigneePositionLevel1(execution)` | 无 taskCountersignExtendJson |

> **参考文件：** `references/example/会签流程.bpmn` — 包含以上所有会签类型的完整实例（并行/顺序/各种审批人配置）。

## 7. 完整会签示例 — 人员会签（并行，全部通过）

```xml
<bpmn2:userTask id="task_countersign" name="部门会签"
  flowable:assignee="${assigneeUserId}"
  flowable:countersignRule="countersign_all">
  <bpmn2:extensionElements>
    <flowable:taskExtendJson value="{&#34;sameMode&#34;:0,&#34;isSkipAssigneeEmpty&#34;:false,&#34;isSkipAssigneeOnePersion&#34;:false,&#34;isSkipApproval&#34;:false,&#34;isAssignedByPreviousNode&#34;:false,&#34;isEmptyAssignedByPreviousNode&#34;:false,&#34;isSkipApprovedOnCountersignReturn&#34;:false}" />
    <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
    <flowable:taskCountersignExtendJson value="eyJhdWRpdG9yVXNlclR5cGUiOiJjYW5kaWRhdGVVc2VycyIsImF1ZGl0b3JVc2VySWRzIjpbImFkbWluIiwiamVlY2ciXSwidGltZXN0YW1wIjoxNzU4MjU3NjczMTIxfQ==" />
  </bpmn2:extensionElements>
  <bpmn2:multiInstanceLoopCharacteristics
    flowable:collection="${flowUtil.stringToList(&#39;admin,jeecg&#39;)}"
    flowable:elementVariable="assigneeUserId">
    <bpmn2:completionCondition xsi:type="bpmn2:tFormalExpression">${nrOfCompletedInstances/nrOfInstances==1}</bpmn2:completionCondition>
  </bpmn2:multiInstanceLoopCharacteristics>
</bpmn2:userTask>
```

> **注意：** `flowUtil.stringToList` 中的单引号必须写为 `&#39;`，不能用字面单引号 `'`。`completionCondition` 内容必须紧跟标签，不能有换行和缩进空白。

## 8. 完整会签示例 — 人员比例通过（并行，20%）

```xml
<bpmn2:userTask id="task_vote" name="投票表决"
  flowable:assignee="${assigneeUserId}"
  flowable:countersignRule="countersign_proportion"
  flowable:countersignProportion="0.2">
  <bpmn2:extensionElements>
    <flowable:taskExtendJson value="{&#34;sameMode&#34;:0,&#34;isSkipAssigneeEmpty&#34;:false,&#34;isSkipAssigneeOnePersion&#34;:false,&#34;isSkipApproval&#34;:false,&#34;isAssignedByPreviousNode&#34;:false,&#34;isEmptyAssignedByPreviousNode&#34;:false,&#34;isSkipApprovedOnCountersignReturn&#34;:false}" />
    <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
    <flowable:taskCountersignExtendJson value="eyJjb3VudGVyc2lnblByb3BvcnRpb24iOiIwLjIiLCJhdWRpdG9yVXNlclR5cGUiOiJjYW5kaWRhdGVVc2VycyIsImF1ZGl0b3JVc2VySWRzIjpbImplZWNnIl0sInRpbWVzdGFtcCI6MTc1ODI1NzY3MzEyMX0=" />
  </bpmn2:extensionElements>
  <bpmn2:multiInstanceLoopCharacteristics
    flowable:collection="${flowUtil.stringToList(&#39;jeecg&#39;)}"
    flowable:elementVariable="assigneeUserId">
    <bpmn2:completionCondition xsi:type="bpmn2:tFormalExpression">${nrOfCompletedInstances/nrOfInstances&gt;=0.2}</bpmn2:completionCondition>
  </bpmn2:multiInstanceLoopCharacteristics>
</bpmn2:userTask>
```

## 9. 完整会签示例 — 岗位会签（顺序，比例20%）

来自生产环境的岗位（candidatePosts）顺序会签示例，使用 `flowUtil.getAssigneeUsers` 动态获取审批人：

**taskCountersignExtendJson Base64 解码后：**
```json
{
  "countersignProportion": "0.2",
  "auditorUserType": "candidatePosts",
  "auditorPostIds": ["2032387176954642433", "1958471111989067778"],
  "timestamp": 1773418938149
}
```

**getAssigneeUsers 参数 Base64 解码后（不含 timestamp 和 countersignProportion）：**
```json
{
  "auditorUserType": "candidatePosts",
  "auditorPostIds": ["2032387176954642433", "1958471111989067778"]
}
```

```xml
<bpmn2:userTask id="task_dept_mgr" name="部门经理审批"
  flowable:assignee="${assigneeUserId}"
  flowable:countersignRule="countersign_proportion">
  <bpmn2:extensionElements>
    <flowable:taskExtendJson value="{&#34;sameMode&#34;:0,&#34;isSkipAssigneeEmpty&#34;:false,&#34;isSkipAssigneeOnePersion&#34;:false,&#34;isSkipApproval&#34;:false,&#34;isAssignedByPreviousNode&#34;:false,&#34;isEmptyAssignedByPreviousNode&#34;:false,&#34;isSkipApprovedOnCountersignReturn&#34;:false}" />
    <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
    <flowable:taskCountersignExtendJson value="eyJjb3VudGVyc2lnblByb3BvcnRpb24iOiIwLjIiLCJhdWRpdG9yVXNlclR5cGUiOiJjYW5kaWRhdGVQb3N0cyIsImF1ZGl0b3JQb3N0SWRzIjpbIjIwMzIzODcxNzY5NTQ2NDI0MzMiLCIxOTU4NDcxMTExOTg5MDY3Nzc4Il0sInRpbWVzdGFtcCI6MTc3MzQxODkzODE0OX0=" />
  </bpmn2:extensionElements>
  <bpmn2:multiInstanceLoopCharacteristics isSequential="true"
    flowable:collection="${flowUtil.getAssigneeUsers(execution,&#39;eyJhdWRpdG9yVXNlclR5cGUiOiJjYW5kaWRhdGVQb3N0cyIsImF1ZGl0b3JQb3N0SWRzIjpbIjIwMzIzODcxNzY5NTQ2NDI0MzMiLCIxOTU4NDcxMTExOTg5MDY3Nzc4Il19&#39;)}"
    flowable:elementVariable="assigneeUserId" />
</bpmn2:userTask>
```

> **注意：** `flowUtil.getAssigneeUsers` 中的单引号也必须写为 `&#39;`。`&#34;` 用于 taskExtendJson 中的 JSON 双引号。

**关键差异：**
- `isSequential="true"` — 顺序逐个审批
- 没有 `completionCondition` — 当 countersignRule 为 proportion 但未写 completionCondition 时，系统通过 countersignProportion 属性和 taskCountersignExtendJson 中的 countersignProportion 值自动处理
- `flowUtil.getAssigneeUsers(execution, 'BASE64')` — 运行时根据岗位ID动态获取用户列表

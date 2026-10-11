# 条件表达式、抄送、按钮与服务任务

## 1. 条件表达式系统（来自设计器源码）

### 1.1 系统内置变量（可用于网关条件）

| 变量名 | 含义 | 用法示例 |
|--------|------|---------|
| `applyUserId` | 发起人用户名 | `${applyUserId == 'admin'}` |
| `applyUserDept` | 发起人部门 | `${applyUserDept == '部门ID'}` |
| `applyUserDeptManager` | 发起部门负责人 | `${applyUserDeptManager == 'username'}` |
| `applyUserParentDeptManager` | 上级部门负责人 | 同上 |
| `lastAssignee` | 上个节点处理人 | `${lastAssignee == 'admin'}` |
| `applyUserPostLevel` | 发起人职级 | `${applyUserPostLevel == '职级ID'}` |
| `applyUserApprovalRole` | 发起人审批角色 | `${applyUserApprovalRole == '角色ID'}` |
| `applyDate` | 发起日期 | `${applyDate > '2026-01-01'}` |
| `result` | 审批结果 | `${result == 1}` 通过 / `${result == 0}` 拒绝 |

### 1.2 条件表达式格式（flowUtil.evaluateExpression）

> **重要：所有网关分支条件必须使用 `flowUtil.evaluateExpression` 格式，不要使用简单的 `${variable > 3}` 写法。**

**表达式格式：**
```xml
<bpmn2:conditionExpression xsi:type="bpmn2:tFormalExpression">${flowUtil.evaluateExpression(execution, 'BASE64_ENCODED_JSON', 'and')}</bpmn2:conditionExpression>
```

**base64 解码后的 JSON 结构：**
```json
[{
  "logic": "and",
  "conditions": [{
    "operator": "gt",
    "field": "integer_xxx_xxx",
    "fieldType": "integer",
    "fieldName": "请假天数",
    "expectedValue": "3"
  }]
}]
```

**字段说明：**
| 字段 | 说明 | 示例 |
|------|------|------|
| `logic` | 条件组逻辑 | `and` / `or` |
| `operator` | 运算符 | 见下方运算符表 |
| `field` | 表单字段 model | `integer_xxx_xxx`（desform 字段）或系统变量如 `result` |
| `fieldType` | 字段类型 | `integer`, `number`, `input`, `select`, `date` 等 |
| `fieldName` | 字段中文名 | 用于设计器显示 |
| `expectedValue` | 比较值 | 字符串格式 |

> **⚠️ fieldType 必须与 DesForm 字段类型精确匹配（实测验证）**
> fieldType 写错时，条件表达式在 XML 中存在且运行时可能正常，但设计器「条件规则配置」面板上字段下拉框显示为空（无法反解析），导致用户无法在界面上查看和修改条件。

**DesForm 字段类型 → fieldType 映射表（实测）：**

| DesForm 字段 `type` | 条件 `fieldType` | 备注 |
|---------|---------|------|
| `money` | `"money"` | ❌ 不要用 `"number"` |
| `integer` | `"integer"` | |
| `number` | `"number"` | 仅纯数字类型 |
| `input` / `textarea` | `"input"` | |
| `select` | `"select"` | |
| `radio` | `"radio"` | 实测验证 |
| `checkbox` | `"checkbox"` | |
| `date` | `"date"` | |
| `select-user` | `"select-user"` | |
| `select-depart` | `"select-depart"` | |
| Online 表单整数字段 | `"integer"` | model 以 `integer_` 开头 |
| 系统变量（`result` 等） | `"integer"` 或 `"number"` | result 为 0/1 |

**多条件组合：** 支持多个条件组（数组中多个对象），也支持单个组内多个条件：
```json
[{
  "logic": "and",
  "conditions": [
    {"operator": "gt", "field": "amount", "fieldType": "number", "fieldName": "金额", "expectedValue": "10000"},
    {"operator": "eq", "field": "type", "fieldType": "select", "fieldName": "类型", "expectedValue": "采购"}
  ]
}]
```

**Python 生成 base64：**
```python
import json, base64
condition = json.dumps([{"logic": "and", "conditions": [...]}], ensure_ascii=False)
b64 = base64.b64encode(condition.encode('utf-8')).decode('utf-8')
```

### 1.3 条件运算符

| 运算符 | 含义 | 适用类型 |
|--------|------|---------|
| `eq` | 等于 | 字符串、数字、日期 |
| `ne` | 不等于 | 字符串、数字、日期 |
| `gt` | 大于 | 数字、日期 |
| `gte` | 大于等于 | 数字、日期 |
| `lt` | 小于 | 数字、日期 |
| `lte` / `le` | 小于等于 | 数字、日期 |
| `in` | 在列表中 | 字符串、数字 |
| `not_in` | 不在列表中 | 字符串、数字 |
| `contains` | 包含 | 字符串 |
| `is_empty` | 为空 | 字符串、数字、文件 |
| `is_not_empty` | 不为空 | 字符串、数字、文件 |
| `is_department_manager` | 是部门负责人 | applyUserId, lastAssignee |
| `is_not_department_manager` | 不是部门负责人 | applyUserId, lastAssignee |

### 1.4 排他网关默认流规则

> **重要：排他网关必须设置一条默认流（`default` 属性），默认流不带条件表达式。**

```xml
<!-- default 指向默认流 id -->
<bpmn2:exclusiveGateway id="gateway_xxx" name="网关名称" default="flow_default" />

<!-- 有条件分支 -->
<bpmn2:sequenceFlow id="flow_condition" name="大于3天" sourceRef="gateway_xxx" targetRef="task_hr">
  <bpmn2:conditionExpression xsi:type="bpmn2:tFormalExpression">${flowUtil.evaluateExpression(execution, 'BASE64', 'and')}</bpmn2:conditionExpression>
</bpmn2:sequenceFlow>

<!-- 默认流（无条件） -->
<bpmn2:sequenceFlow id="flow_default" name="3天及以内(默认)" sourceRef="gateway_xxx" targetRef="end" />
```

当所有条件分支都不满足时，流程自动走默认流，避免流程卡死。

---

## 2. 抄送配置（ccConfigJson）

用户任务可配置抄送人，通知相关人员但不影响审批流程。`value` 为 JSON 数组经 base64 编码后的字符串。

```xml
<bpmn2:userTask id="task_xxx" name="审批">
  <bpmn2:extensionElements>
    <flowable:ccConfigJson value="BASE64_ENCODED_JSON" />
  </bpmn2:extensionElements>
</bpmn2:userTask>
```

> **注意：** 标签名为 `ccConfigJson`（全小写 cc），不是 `CcConfigJson`。

### 抄送类型及 JSON 结构

数组中每个对象代表一类抄送人，可同时配置多种（取并集）：

| type | 说明 | 必要附加字段 |
|------|------|------------|
| `candidateUsers` | 指定用户 | `userIds`（用户名数组）、`selectedUsers`（`[{value, label}]`） |
| `candidateRoles` | 指定角色 | `roleIds`（角色编码数组）、`selectedRoles`（`[{value, label}]`） |
| `candidateDeptPositions` | 指定岗位 | `deptPositionIds`（岗位ID数组）、`selectedDeptPositions`（`[{value, label}]`） |
| `submitter_user` | 发起人本人 | 无 |
| `submitter_dept_leader` | 发起人的部门负责人 | 无 |
| `submitter_parent_dept_leader` | 发起人的上级部门负责人 | 无 |
| `dept_members` | 发起人所在部门全体成员 | 无 |
| `dept_leader` | 当前节点审批人的部门负责人 | 无 |

### 完整 JSON 示例（解码前）

```json
[
  {
    "type": "candidateUsers",
    "userIds": ["qinfeng"],
    "selectedUsers": [{"value": "qinfeng", "label": "秦峰"}]
  },
  {
    "type": "candidateRoles",
    "roleIds": ["admin"],
    "selectedRoles": [{"value": "admin", "label": "管理员"}]
  },
  {
    "type": "candidateDeptPositions",
    "deptPositionIds": ["1958497164103520258"],
    "selectedDeptPositions": [{"value": "1958497164103520258", "label": "销售总监"}]
  },
  {"type": "submitter_user"},
  {"type": "submitter_dept_leader"},
  {"type": "submitter_parent_dept_leader"},
  {"type": "dept_members"},
  {"type": "dept_leader"}
]
```

### Python 生成 ccConfigJson

```python
import json, base64

cc_list = [
    {
        "type": "candidateUsers",
        "userIds": ["qinfeng"],
        "selectedUsers": [{"value": "qinfeng", "label": "秦峰"}]
    },
    {"type": "submitter_dept_leader"},
]
cc_b64 = base64.b64encode(
    json.dumps(cc_list, ensure_ascii=False).encode('utf-8')
).decode('utf-8')
# 写入 XML：
# <flowable:ccConfigJson value="{cc_b64}" />
```

### bpmn_creator.py 中的 ccConfig 配置（节点 JSON 字段）

在 JSON 配置的节点中，通过 `ccConfig` 字段声明抄送人（脚本自动完成 base64 编码）：

```json
{
  "id": "task_manager",
  "type": "userTask",
  "name": "经理审批",
  "assignee": {"type": "role", "value": "manager"},
  "ccConfig": [
    {
      "type": "candidateUsers",
      "userIds": ["qinfeng"],
      "selectedUsers": [{"value": "qinfeng", "label": "秦峰"}]
    },
    {"type": "submitter_dept_leader"},
    {"type": "dept_leader"}
  ]
}

---

## 3. 自定义按钮（Button）

用户任务可配置自定义操作按钮：

```xml
<bpmn2:userTask id="task_xxx" name="审批">
  <bpmn2:extensionElements>
    <flowable:Button id="btn_1" name="同意" code="approve" isHide="0" next="task_next" sort="1" />
    <flowable:Button id="btn_2" name="拒绝" code="reject" isHide="0" next="end" sort="2" />
    <flowable:Button id="btn_3" name="转办" code="transfer" isHide="0" sort="3" />
  </bpmn2:extensionElements>
</bpmn2:userTask>
```

| 属性 | 说明 |
|------|------|
| `id` | 按钮唯一ID |
| `name` | 显示名称 |
| `code` | 按钮编码标识 |
| `isHide` | 是否隐藏（0=显示，1=隐藏） |
| `next` | 点击后跳转的目标节点ID |
| `sort` | 显示排序 |

---

## 4. 服务任务（ServiceTask）

服务任务是自动执行节点，流程流转到该节点时自动调用指定逻辑，无需人工操作。Flowable 支持三种配置方式。

### 4.1 Java 类配置（flowable:class）

指定一个实现了 `JavaDelegate` 接口的 Java 类，流程到达该节点时自动调用 `execute()` 方法。

**XML 配置：**
```xml
<bpmn2:serviceTask id="service_java" name="Java服务节点"
  flowable:class="org.jeecg.modules.testListenerExpression.TestService">
</bpmn2:serviceTask>
```

**Java 代码示例：**
```java
package org.jeecg.modules.testListenerExpression;

import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;

public class TestService implements JavaDelegate {
    @Override
    public void execute(DelegateExecution execution) {
        // 读取流程变量
        String applyUser = (String) execution.getVariable("applyUserId");

        // 执行业务逻辑（如调用数据库、调用外部API等）
        System.out.println("Java服务节点执行，发起人: " + applyUser);

        // 设置流程变量供后续节点使用
        execution.setVariable("serviceResult", "success");
    }
}
```

**适用场景：** 复杂业务逻辑、调用数据库、调用外部 API、数据转换处理等。

### 4.2 表达式配置（flowable:expression）

使用 UEL 表达式调用 Spring Bean 的方法：

**XML 配置：**
```xml
<bpmn2:serviceTask id="service_expr" name="表达式服务节点"
  flowable:expression="${myService.doSomething(execution)}">
</bpmn2:serviceTask>
```

**带返回值（存入流程变量）：**
```xml
<bpmn2:serviceTask id="service_expr_result" name="表达式带返回值"
  flowable:expression="${myService.calculate(execution)}"
  flowable:resultVariable="calcResult">
</bpmn2:serviceTask>
```

**Java 代码示例：**
```java
@Service("myService")
public class MyService {
    public void doSomething(DelegateExecution execution) {
        // 无返回值，直接执行逻辑
        String formData = (String) execution.getVariable("formField");
        // ... 业务处理
    }

    public String calculate(DelegateExecution execution) {
        // 有返回值，结果自动存入 flowable:resultVariable 指定的流程变量
        return "计算结果";
    }
}
```

**适用场景：** 调用已有的 Spring Bean 方法，无需创建额外的 JavaDelegate 类，代码更简洁。

### 4.3 委托表达式配置（flowable:delegateExpression）

通过 Spring Bean 名称引用一个实现了 `JavaDelegate` 接口的 Bean：

**XML 配置：**
```xml
<bpmn2:serviceTask id="service_delegate" name="委托表达式服务节点"
  flowable:delegateExpression="${myJavaDelegateBean}">
</bpmn2:serviceTask>
```

**Java 代码示例：**
```java
@Component("myJavaDelegateBean")
public class MyJavaDelegateBean implements JavaDelegate {
    @Autowired
    private SomeRepository repository;  // 可注入 Spring 依赖

    @Override
    public void execute(DelegateExecution execution) {
        // 可使用 Spring 注入的依赖
        repository.save(...);
    }
}
```

**适用场景：** 需要同时使用 `JavaDelegate` 接口和 Spring 依赖注入的场景，结合了 4.1 和 4.2 的优点。

### 4.4 三种配置方式对比

| 对比项 | flowable:class | flowable:expression | flowable:delegateExpression |
|--------|---------------|--------------------|-----------------------------|
| 配置值 | Java 类全路径 | UEL 表达式 | Spring Bean 名称 |
| 实例化 | 每次 new 新实例 | Spring 容器管理 | Spring 容器管理 |
| Spring 注入 | 不支持（需手动获取） | 支持 | 支持 |
| 返回值 | 不支持 | 支持（resultVariable） | 不支持 |
| 代码要求 | 实现 JavaDelegate | 普通 Spring Bean 方法 | 实现 JavaDelegate + @Component |
| 典型场景 | 独立工具类 | 调用已有服务方法 | 需要 DI 的 JavaDelegate |

### 4.5 服务任务中的流程变量操作

```java
// 读取流程变量
String value = (String) execution.getVariable("variableName");
Integer num = (Integer) execution.getVariable("intField");

// 设置流程变量（后续节点可读取）
execution.setVariable("resultKey", "resultValue");

// 获取流程实例信息
String processInstanceId = execution.getProcessInstanceId();
String businessKey = execution.getProcessInstanceBusinessKey();
```

### 4.6 API 服务任务（JeecgBoot 内置）

自动调用外部 HTTP 接口：

```xml
<bpmn2:serviceTask id="service_api" name="调用外部接口"
  flowable:class="org.jeecg.modules.extbpm.listener.service.ApiServiceTaskDelegate">
  <bpmn2:extensionElements>
    <flowable:ApiServiceTaskConfig value="${BASE64_ENCODED_JSON}" />
  </bpmn2:extensionElements>
</bpmn2:serviceTask>
```

ApiServiceTaskConfig JSON 结构：
```json
{
  "apiUrl": "https://api.example.com/endpoint",
  "method": "GET|POST",
  "headers": {},
  "parameters": {},
  "timeout": 30000,
  "retryCount": 0
}
```

### 4.7 AI 服务任务（JeecgBoot 内置）

调用 AI 大模型进行智能处理：

```xml
<bpmn2:serviceTask id="service_ai" name="AI智能处理"
  flowable:class="org.jeecg.modules.extbpm.listener.service.AigcServiceTaskDelegate">
  <bpmn2:extensionElements>
    <flowable:AiServiceTaskConfig value="${BASE64_ENCODED_JSON}" />
  </bpmn2:extensionElements>
</bpmn2:serviceTask>
```

AiServiceTaskConfig JSON 结构：
```json
{
  "aiFlowId": "AI对话流ID",
  "inputParams": {},
  "outputParams": {}
}
```

---

## 5. 脚本任务（ScriptTask）

脚本任务是另一种自动执行节点，与服务任务不同的是脚本代码直接写在 BPMN XML 中，无需编写和部署 Java 类。

### 5.1 基本配置

```xml
<bpmn2:scriptTask id="script_calc" name="脚本任务" scriptFormat="javascript">
  <bpmn2:script>
    var sum = 2 + 9;
    execution.setVariable("myVar", sum);
  </bpmn2:script>
</bpmn2:scriptTask>
```

| 属性 | 说明 | 必填 |
|------|------|------|
| `scriptFormat` | 脚本语言 | 是 |
| `flowable:resultVariable` | 脚本返回值存入的流程变量名 | 否 |
| `<bpmn2:script>` | 脚本内容（子元素） | 是 |

### 5.2 支持的脚本语言

| scriptFormat | 说明 | JDK 支持 |
|-------------|------|---------|
| `javascript` | JavaScript（推荐，兼容性最好） | JDK 8 内置 Nashorn；JDK 15+ 需引入 GraalVM JS |
| `groovy` | Groovy（需引入 groovy 依赖） | 需额外依赖 |
| `juel` | JUEL 表达式 | Flowable 内置 |

> **推荐使用 `javascript`**，JeecgBoot 默认支持，无需额外依赖。

### 5.3 脚本中操作流程变量

```javascript
// 读取流程变量
var applyUser = execution.getVariable("applyUserId");
var amount = execution.getVariable("money_field");

// 设置流程变量
execution.setVariable("approved", true);
execution.setVariable("totalAmount", amount * 1.1);

// 条件判断后设置变量
if (amount > 10000) {
    execution.setVariable("needDirectorApproval", true);
} else {
    execution.setVariable("needDirectorApproval", false);
}
```

### 5.4 带返回值的脚本任务

```xml
<bpmn2:scriptTask id="script_result" name="计算总额"
  scriptFormat="javascript"
  flowable:resultVariable="totalPrice">
  <bpmn2:script>
    var price = execution.getVariable("unitPrice");
    var qty = execution.getVariable("quantity");
    price * qty;
  </bpmn2:script>
</bpmn2:scriptTask>
```

> 脚本最后一行表达式的值会自动存入 `flowable:resultVariable` 指定的流程变量。

### 5.5 完整流程示例（来自生产环境）

```xml
<!-- 开始 → 拟稿人 → Java服务节点 → 脚本任务 → 结束 -->
<bpmn2:startEvent id="start" name="开始" flowable:initiator="applyUserId" />

<bpmn2:userTask id="task_draft" name="拟稿人" flowable:assignee="${applyUserId}" />

<bpmn2:serviceTask id="service_java" name="Java服务节点"
  flowable:class="org.jeecg.modules.testListenerExpression.TestService" />

<bpmn2:scriptTask id="script_calc" name="脚本任务" scriptFormat="javascript">
  <bpmn2:script>var sum = 2 + 9;
execution.setVariable("myVarsex", sum);</bpmn2:script>
</bpmn2:scriptTask>

<bpmn2:endEvent id="end" />

<bpmn2:sequenceFlow id="f1" sourceRef="start" targetRef="task_draft" />
<bpmn2:sequenceFlow id="f2" sourceRef="task_draft" targetRef="service_java" />
<bpmn2:sequenceFlow id="f3" sourceRef="service_java" targetRef="script_calc" />
<bpmn2:sequenceFlow id="f4" sourceRef="script_calc" targetRef="end" />
```

> **参考 BPMN 文件：** `references/example/流程java和脚本节点配置.bpmn`

### 5.6 服务任务 vs 脚本任务对比

| 对比项 | serviceTask | scriptTask |
|--------|------------|------------|
| 代码位置 | Java 后端类 | XML 内联脚本 |
| 部署方式 | 需编译部署 Java 类 | 脚本随流程 XML 部署，修改流程即生效 |
| 适用场景 | 复杂业务逻辑、数据库操作、外部 API | 简单计算、变量赋值、条件判断 |
| Spring 依赖 | expression/delegateExpression 支持注入 | 不支持（只能操作流程变量） |
| 调试 | 标准 Java 调试 | 较难调试 |
| 性能 | 高 | 一般（脚本引擎解析开销） |

### 5.7 XML 转义注意事项

脚本内容在 XML 中时，特殊字符需要转义或使用 CDATA：

```xml
<!-- 方式1：XML 实体转义 -->
<bpmn2:script>if (amount &gt; 1000) { execution.setVariable("flag", true); }</bpmn2:script>

<!-- 方式2：使用 CDATA 包裹（推荐，避免转义麻烦） -->
<bpmn2:script><![CDATA[
if (amount > 1000 && type == "purchase") {
    execution.setVariable("flag", true);
}
]]></bpmn2:script>
```

> **临时脚本生成 XML 时**，如果脚本内容包含 `<`、`>`、`&` 等字符，推荐用 CDATA 包裹整个脚本内容，避免 XML 解析错误。

---

## 6. 设计器 API 端点一览

| API 路径 | 方法 | 用途 |
|----------|------|------|
| `act/designer/api/saveProcess` | POST | 保存/新建流程 |
| `act/designer/api/getProcessXml` | GET | 获取流程 XML |
| `act/designer/api/getTypes` | GET | 获取流程类型列表 |
| `act/designer/api/getPageUsers` | GET | 获取用户列表（审批人选择） |
| `act/designer/api/getGroups` | GET | 获取角色/组列表 |
| `act/designer/api/getRoleNameByCodes` | GET | 根据角色编码获取名称 |
| `act/designer/api/getExpressions` | GET | 获取可用表达式列表 |
| `act/designer/api/getListenersByType` | GET | 获取监听器列表 |
| `sys/sysDepart/queryDepartAndPostTreeSync` | GET | 获取部门+岗位树 |
| `sys/position/list` | GET | 获取职级列表 |

---

## 7. 流程实例操作 API

### 7.1 撤回已发起的流程实例

**接口：** `/act/task/callBackProcess`

**方法：** POST

**请求体：**
```json
{
  "processInstanceId": "流程实例ID"
}
```

**返回：**
```json
{"success": true, "message": "撤回成功", "code": 200}
```

**错误返回（流转中的实例）：**
```json
{"success": false, "message": "流转中的实例不能被撤回，只有被退回的实例才能撤回", "code": 500}
```

> **注意：** 只有被审批人**拒绝/退回**的实例才能撤回，流转中的实例不能撤回。

### 7.2 查询我的申请列表

**接口：** `/act/task/myApplyProcessList`

**方法：** GET

**参数：**
| 参数 | 说明 | 示例 |
|------|------|------|
| `column` | 排序字段 | `createTime` |
| `order` | 排序方向 | `desc` |
| `pageNo` | 页码 | `1` |
| `pageSize` | 每页数量 | `10` |

**返回字段：**
| 字段 | 说明 |
|------|------|
| `id` / `processInstanceId` | 实例ID |
| `processDefinitionName` | 流程名称 |
| `currentTaskKey` / `currentTaskName` | 当前节点 |
| `bpmStatus` | 状态 (1=草稿, 2=流转中, 3=已结束) |
| `startTime` | 发起时间 |
| `bpmBizTitle` | 业务标题 |

### 7.3 删除流程实例

**接口：** `/act/process/extActProcess/delete`

**方法：** DELETE

**参数：** `id` - 流程实例ID

---

## 8. 信号节点（Signal Event）

信号事件用于流程内（或跨流程）广播通知，所有监听同一信号的节点都会收到。

> **参考 BPMN 文件：** `references/example/信号节点配置.bpmn`

### 8.1 流程结构示意

```
开始 → 经理审批 → [抛出信号] → 总监审批 → 总经理审批 → 结束
                                    ↓（边界捕获信号）
                                 人力审批 → 结束
```

### 8.2 全局信号定义

在 `<bpmn2:definitions>` 内（与 `<bpmn2:process>` 同级）定义信号：

```xml
<bpmn2:signal id="Signal_fYBEFz" name="xinhao" />
```

| 属性 | 说明 |
|------|------|
| `id` | 唯一标识符（XML 内引用用） |
| `name` | 信号名称（业务标识，抛出/捕获匹配的是 name） |

### 8.3 中间抛出信号事件（Intermediate Throw Event）

```xml
<bpmn2:intermediateThrowEvent id="Event_0pj4s1m" name="抛出信号">
    <bpmn2:incoming>Flow_02jbxem</bpmn2:incoming>
    <bpmn2:outgoing>Flow_1vw3ukw</bpmn2:outgoing>
    <bpmn2:signalEventDefinition id="SignalEventDefinition_1mdlxx5"
        flowable:signalRef="Signal_fYBEFz" />
</bpmn2:intermediateThrowEvent>
```

- `flowable:signalRef`：引用 `<bpmn2:signal>` 的 `id`
- 流程到达该节点时自动广播信号，随后继续向 outgoing 方向流转

### 8.4 边界捕获信号事件（Boundary Signal Event）

```xml
<bpmn2:boundaryEvent id="Event_09vbiup" name="捕获信号"
    attachedToRef="Task_036lygp">
    <bpmn2:outgoing>Flow_05u00vg</bpmn2:outgoing>
    <bpmn2:signalEventDefinition id="SignalEventDefinition_0lfql30"
        flowable:signalRef="Signal_fYBEFz" />
</bpmn2:boundaryEvent>
```

| 属性 | 说明 |
|------|------|
| `attachedToRef` | 绑定的任务节点 ID |
| `flowable:signalRef` | 与抛出节点引用同一个信号 id |

> 收到信号后，流程从边界事件的 outgoing 连线继续执行（通常中断原任务）。

### 8.5 完整骨架示例

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions ...>
  <bpmn2:process id="process_xxx" name="信号示例">
    <!-- 扩展监听器（固定配置） -->
    <bpmn2:extensionElements>
      <flowable:executionListener class="org.jeecg.modules.extbpm.listener.execution.ProcessEndListener" event="end" />
      <flowable:eventListener class="org.jeecg.modules.listener.tasktip.TaskCreateGlobalListener" />
    </bpmn2:extensionElements>

    <bpmn2:startEvent id="start" name="开始" flowable:initiator="applyUserId">
      <bpmn2:outgoing>f1</bpmn2:outgoing>
    </bpmn2:startEvent>

    <bpmn2:userTask id="task_manager" name="经理审批" flowable:assignee="admin">
      <bpmn2:incoming>f1</bpmn2:incoming>
      <bpmn2:outgoing>f2</bpmn2:outgoing>
    </bpmn2:userTask>

    <!-- 抛出信号 -->
    <bpmn2:intermediateThrowEvent id="signal_throw" name="抛出信号">
      <bpmn2:incoming>f2</bpmn2:incoming>
      <bpmn2:outgoing>f3</bpmn2:outgoing>
      <bpmn2:signalEventDefinition id="sed_throw" flowable:signalRef="Signal_xxx" />
    </bpmn2:intermediateThrowEvent>

    <bpmn2:userTask id="task_director" name="总监审批" flowable:assignee="admin">
      <bpmn2:incoming>f3</bpmn2:incoming>
      <bpmn2:outgoing>f4</bpmn2:outgoing>
    </bpmn2:userTask>

    <!-- 边界捕获信号（绑定到总监审批） -->
    <bpmn2:boundaryEvent id="signal_catch" name="捕获信号" attachedToRef="task_director">
      <bpmn2:outgoing>f5</bpmn2:outgoing>
      <bpmn2:signalEventDefinition id="sed_catch" flowable:signalRef="Signal_xxx" />
    </bpmn2:boundaryEvent>

    <bpmn2:userTask id="task_hr" name="人力审批" flowable:assignee="admin">
      <bpmn2:incoming>f5</bpmn2:incoming>
      <bpmn2:outgoing>f6</bpmn2:outgoing>
    </bpmn2:userTask>

    <bpmn2:endEvent id="end1"><bpmn2:incoming>f4</bpmn2:incoming></bpmn2:endEvent>
    <bpmn2:endEvent id="end2"><bpmn2:incoming>f6</bpmn2:incoming></bpmn2:endEvent>

    <bpmn2:sequenceFlow id="f1" sourceRef="start" targetRef="task_manager" />
    <bpmn2:sequenceFlow id="f2" sourceRef="task_manager" targetRef="signal_throw" />
    <bpmn2:sequenceFlow id="f3" sourceRef="signal_throw" targetRef="task_director" />
    <bpmn2:sequenceFlow id="f4" sourceRef="task_director" targetRef="end1" />
    <bpmn2:sequenceFlow id="f5" sourceRef="signal_catch" targetRef="task_hr" />
    <bpmn2:sequenceFlow id="f6" sourceRef="task_hr" targetRef="end2" />
  </bpmn2:process>

  <!-- 信号定义（与 process 同级） -->
  <bpmn2:signal id="Signal_xxx" name="xinhao" />
</bpmn2:definitions>
```

### 8.6 信号 vs 消息

| 特性 | 信号（Signal） | 消息（Message） |
|------|---------------|----------------|
| 广播范围 | 全局广播，所有监听者都能收到 | 点对点，指定接收者 |
| 定义位置 | `<bpmn2:signal>` 与 process 同级 | `<bpmn2:message>` 与 process 同级 |
| 适用场景 | 跨节点/跨流程同时通知多方 | 流程间精确单向通信 |

---

## 9. 手动修改已有流程 XML（增量编辑）

> 适用场景：用户要求在现有流程中插入/修改节点、网关、条件，而不是重建整个流程。

### 9.1 标准操作流程

```python
import json, base64, re, urllib.request, urllib.parse

# Step 1: 获取当前 XML
result = api_get(f'/act/process/extActProcess/queryById?id={PROCESS_ID}')
info = result['result']
xml_str = base64.b64decode(info['processXml']).decode('utf-8')
process_key = info.get('processKey', '')   # 注意大写 K，queryById 返回驼峰
process_name = info['processName']

# Step 2: 用字符串操作修改 XML
#   - 替换连线 targetRef / sourceRef
#   - 修改节点 incoming/outgoing 子元素
#   - 在 </bpmn2:process> 前插入新节点/连线
#   - 在 </bpmndi:BPMNPlane> 前插入新 Shape/Edge

# Step 3: 获取节点列表（用于 nodes 参数）
nodes_result = api_get(f'/act/process/extActProcessNode/list?processId={PROCESS_ID}')
node_records = nodes_result.get('result', {}).get('records', [])
nodes_str = '@@@'.join(
    f'id={n["processNodeCode"]}###nodeName={n["processNodeName"]}'
    for n in node_records if n.get('processNodeCode') not in ('start', 'end')
)

# Step 4: 保存
save_data = {
    'processDefinitionId': PROCESS_ID,
    'processName': process_name,
    'processkey': process_key,     # saveProcess 请求字段全小写
    'typeid': info.get('processType', 'oa'),
    'lowAppId': '', 'params': '',
    'nodes': nodes_str,
    'processDescriptor': xml_str,  # 原始 XML，不要 base64
    'realProcDefId': '',
    'startType': info.get('startType', 'manual'),
}
save_result = api_post_form('/act/designer/api/saveProcess', save_data)
# ⚠️ 编辑已有流程时 save_result['obj'] 可能为 null（实测）
# 此时 saveProcess 仍成功，但不返回新 ID，直接用原 PROCESS_ID 发布
if not save_result.get('success'):
    raise Exception(f'saveProcess failed: {save_result}')
new_id = save_result.get('obj') or PROCESS_ID

# Step 5: 发布
deploy_result = api_put_json('/act/process/extActProcess/deployProcess', {'id': new_id})
```

### 9.2 插入排他网关的完整模板

```python
def make_condition_expr(field_model, field_type, field_name, operator, value):
    """构造正确的 evaluateExpression 条件表达式（用于原始 XML）"""
    cond_json = [{"logic": "and", "conditions": [{
        "operator": operator,
        "field": field_model,
        "fieldType": field_type,    # 必须匹配 DesForm 字段类型，见映射表
        "fieldName": field_name,
        "expectedValue": str(value)  # 注意是 expectedValue，不是 value
    }]}]
    b64 = base64.b64encode(json.dumps(cond_json, ensure_ascii=False).encode()).decode()
    # &#39; 转义单引号（在 XML 元素内容中合法）
    return "${flowUtil.evaluateExpression(execution,&#39;" + b64 + "&#39;,&#39;and&#39;)}"

# 示例：金额 > 1000
expr_gt = make_condition_expr('money_1777276832095_357468', 'money', '预算金额', 'gt', '1000')
expr_le = make_condition_expr('money_1777276832095_357468', 'money', '预算金额', 'lte', '1000')

# 插入网关 XML 片段（在 </bpmn2:process> 前）
new_elements = (
    '<bpmn2:exclusiveGateway id="gateway_amount" name="金额判断">'
    '<bpmn2:incoming>flow_2</bpmn2:incoming>'
    '<bpmn2:outgoing>flow_gt1000</bpmn2:outgoing>'
    '<bpmn2:outgoing>flow_le1000</bpmn2:outgoing>'
    '</bpmn2:exclusiveGateway>'
    f'<bpmn2:sequenceFlow id="flow_gt1000" name="大于1000" sourceRef="gateway_amount" targetRef="task_gm">'
    f'<bpmn2:conditionExpression xsi:type="bpmn2:tFormalExpression">{expr_gt}</bpmn2:conditionExpression>'
    '</bpmn2:sequenceFlow>'
    f'<bpmn2:sequenceFlow id="flow_le1000" name="小于等于1000" sourceRef="gateway_amount" targetRef="task_dept">'
    f'<bpmn2:conditionExpression xsi:type="bpmn2:tFormalExpression">{expr_le}</bpmn2:conditionExpression>'
    '</bpmn2:sequenceFlow>'
)
xml_str = xml_str.replace('</bpmn2:process>', new_elements + '</bpmn2:process>')
```

### 9.3 常见陷阱

| 陷阱 | 原因 | 解决方法 |
|------|------|---------|
| `saveProcess obj: null` | 编辑已有流程时服务端不返回新 ID | `new_id = save_result.get('obj') or PROCESS_ID` |
| 第二次运行脚本 assert 失败 | XML 上次已修改，模式匹配失效 | 每次从 `queryById` 重新拉取最新 XML |
| 条件规则面板字段为空 | `fieldType` 不匹配，或条件 JSON 缺 `logic/conditions` 包装，或用了 `value` 而非 `expectedValue` | 用 `make_condition_expr` 函数生成，对照映射表填 fieldType |
| deploy "未找到对应实体" | `id` 传了 null 或错误 | 确保 `new_id = save_result.get('obj') or PROCESS_ID` |
| Python `r.get('result', {})` 返回 `None` | API 返回 `{"result": null}` 时，key 存在但值为 null，`dict.get(key, default)` 的 default 只在 key **不存在** 时生效 | 改用 `(r.get('result') or {})` —— `or` 会在 None/False/0 时启用默认值 |
| 角色创建后 admin 未加入角色 | `sys/role/add` 成功但 result 字段为 null（返回数字ID），`result.get('id')` 报 AttributeError | 用 `result_val = r.get('result') or {}`，再 `role_id = result_val.get('id') if isinstance(result_val, dict) else str(result_val)` |
| deploy "路径不存在" | 使用了错误的 deploy 端点（如 `GET /deploy?id=...`） | 正确端点：`PUT /act/process/extActProcess/deployProcess`，body `{"id": id}`；始终用 `deploy_process()` 函数，不要手动拼接 |

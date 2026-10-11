# BPMN XML 骨架与基本节点模板

## 1. XML 骨架模板

所有生成的 BPMN XML 必须使用以下骨架：

```xml
<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
  xmlns:flowable="http://flowable.org/bpmn"
  id="sample-diagram"
  targetNamespace="http://bpmn.io/schema/bpmn"
  xsi:schemaLocation="http://www.omg.org/spec/BPMN/20100524/MODEL BPMN20.xsd">

  <bpmn2:process id="${PROCESS_KEY}" name="${PROCESS_NAME}">
    <!-- 必需的监听器 -->
    <bpmn2:extensionElements>
      <flowable:executionListener class="org.jeecg.modules.extbpm.listener.execution.ProcessEndListener" event="end" />
      <flowable:eventListener class="org.jeecg.modules.listener.tasktip.TaskCreateGlobalListener" />
    </bpmn2:extensionElements>

    <!-- 节点定义区 -->
    ${NODES}

    <!-- 连线定义区 -->
    ${SEQUENCE_FLOWS}
  </bpmn2:process>

  <!-- 图形布局区 -->
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="${PROCESS_KEY}">
      ${SHAPES_AND_EDGES}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>
```

## 2. 节点 XML 模板

### 2.1 开始节点（必需）

```xml
<bpmn2:startEvent id="start" name="开始" flowable:initiator="applyUserId" />
```

### 2.2 结束节点（必需）

**普通结束节点：**
```xml
<bpmn2:endEvent id="end" name="结束" />
```

**带监听器的结束节点（如需在结束时触发业务逻辑）：**
```xml
<bpmn2:endEvent id="End_reject">
  <bpmn2:extensionElements>
    <flowable:executionListener expression="${myListener.onReject(execution)}" event="start" />
  </bpmn2:extensionElements>
</bpmn2:endEvent>
```

> 一个流程可以有多个结束节点（如"同意结束"和"拒绝结束"各一个），每个可挂不同监听器。

### 2.3 用户任务（userTask）

```xml
<!-- 指定人 -->
<bpmn2:userTask id="task_xxx" name="节点名称" flowable:assignee="username" />

<!-- 候选人（多人） -->
<bpmn2:userTask id="task_xxx" name="节点名称" flowable:candidateUsers="user1,user2" />

<!-- 候选角色组 -->
<bpmn2:userTask id="task_xxx" name="节点名称" flowable:candidateGroups="roleCode" />

<!-- 表达式（动态） -->
<bpmn2:userTask id="task_xxx" name="节点名称" flowable:assignee="${variableName}" />

<!-- 发起人 -->
<bpmn2:userTask id="task_xxx" name="节点名称" flowable:assignee="${applyUserId}" />
```

### 2.4 排他网关（exclusiveGateway）

**重要规则：**
1. 排他网关必须设置 `default` 属性指向一条默认流（无条件分支）
2. 只有非默认分支才需要条件表达式
3. 条件表达式**必须使用 `flowUtil.evaluateExpression`** + base64 编码的 JSON 条件（不要用简单的 `${variable > 3}` 写法）

```xml
<!-- default 属性指向默认流的 id -->
<bpmn2:exclusiveGateway id="gateway_xxx" name="网关名称" default="flow_default" />
```

**条件表达式格式（`flowUtil.evaluateExpression`）：**

条件 JSON 结构（需 base64 编码后传入）：
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

支持的 operator 值：`eq`(等于), `ne`(不等于), `gt`(大于), `gte`(大于等于), `lt`(小于), `lte`(小于等于), `le`(小于等于), `in`(在列表中), `not_in`(不在列表中), `contains`(包含), `is_empty`(为空), `is_not_empty`(不为空)

带条件的连线（使用 base64 编码条件）：
```xml
<!-- 有条件分支 -->
<bpmn2:sequenceFlow id="flow_xxx" name="大于3天" sourceRef="gateway_xxx" targetRef="task_yyy">
  <bpmn2:conditionExpression xsi:type="bpmn2:tFormalExpression">${flowUtil.evaluateExpression(execution, 'BASE64_ENCODED_JSON', 'and')}</bpmn2:conditionExpression>
</bpmn2:sequenceFlow>

<!-- 默认流（无条件） -->
<bpmn2:sequenceFlow id="flow_default" name="3天及以内(默认)" sourceRef="gateway_xxx" targetRef="end" />
```

**Python 中生成 base64 条件：**
```python
import json, base64

condition = json.dumps([{
    "logic": "and",
    "conditions": [{
        "operator": "gt",
        "field": "integer_xxx_xxx",      # 表单字段 model
        "fieldType": "integer",           # 字段类型
        "fieldName": "请假天数",           # 字段中文名
        "expectedValue": "3"              # 比较值
    }]
}], ensure_ascii=False)
b64 = base64.b64encode(condition.encode('utf-8')).decode('utf-8')
# 在 XML 中使用: ${flowUtil.evaluateExpression(execution, '<b64>', 'and')}
```

> **踩坑警告：**
> - `xsi:type` 的值必须是 `bpmn2:tFormalExpression`（带 `bpmn2:` 前缀），不要用 `tFormalExpression`
> - 不要用 `<![CDATA[]]>` 包裹 `flowUtil.evaluateExpression`，直接写表达式即可
> - 系统内置变量（如 `result`）的条件也推荐用 `flowUtil.evaluateExpression` 格式

### 2.5 并行网关（parallelGateway）

并行网关需要成对使用（分支 + 汇聚）：

```xml
<!-- 并行分支 -->
<bpmn2:parallelGateway id="gateway_fork" name="并行开始" />

<!-- 并行汇聚 -->
<bpmn2:parallelGateway id="gateway_join" name="并行汇聚" />
```

### 2.6 普通连线（sequenceFlow）

```xml
<bpmn2:sequenceFlow id="flow_xxx" name="" sourceRef="nodeA" targetRef="nodeB" />
```

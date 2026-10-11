# 完整示例、Python 脚本与流程模式

## 1. 完整示例 — 请假审批流程

**流程描述：** 开始 → 员工提交 → 经理审批 → 排他网关(通过/拒绝) → HR审批 → 结束

### 1.1 节点定义

```xml
<bpmn2:startEvent id="start" name="开始" flowable:initiator="applyUserId" />
<bpmn2:userTask id="task_apply" name="员工提交申请" flowable:assignee="${applyUserId}" />
<bpmn2:userTask id="task_manager" name="部门经理审批" flowable:assignee="manager" />
<bpmn2:exclusiveGateway id="gateway_result" name="审批结果" />
<bpmn2:userTask id="task_hr" name="HR审批" flowable:assignee="hr" />
<bpmn2:endEvent id="end" name="结束" />
```

### 1.2 连线定义

```xml
<bpmn2:sequenceFlow id="flow_1" name="" sourceRef="start" targetRef="task_apply" />
<bpmn2:sequenceFlow id="flow_2" name="" sourceRef="task_apply" targetRef="task_manager" />
<bpmn2:sequenceFlow id="flow_3" name="" sourceRef="task_manager" targetRef="gateway_result" />
<bpmn2:sequenceFlow id="flow_approve" name="通过" sourceRef="gateway_result" targetRef="task_hr">
  <bpmn2:conditionExpression xsi:type="tFormalExpression"><![CDATA[${result == 1}]]></bpmn2:conditionExpression>
</bpmn2:sequenceFlow>
<bpmn2:sequenceFlow id="flow_reject" name="拒绝" sourceRef="gateway_result" targetRef="end">
  <bpmn2:conditionExpression xsi:type="tFormalExpression"><![CDATA[${result == 0}]]></bpmn2:conditionExpression>
</bpmn2:sequenceFlow>
<bpmn2:sequenceFlow id="flow_4" name="" sourceRef="task_hr" targetRef="end" />
```

### 1.3 布局计算

```
节点列表（按垂直顺序）：
  start:          type=startEvent,       y=30,  h=36  → bottom=66
  task_apply:     type=userTask,         y=106, h=60  → bottom=166
  task_manager:   type=userTask,         y=206, h=60  → bottom=266
  gateway_result: type=exclusiveGateway, y=306, h=50  → bottom=356
  task_hr:        type=userTask,         y=396, h=60  → bottom=456
  end:            type=endEvent,         y=496, h=36  → bottom=532
```

### 1.4 nodes 参数

```
id=task_apply###nodeName=员工提交申请@@@id=task_manager###nodeName=部门经理审批@@@id=task_hr###nodeName=HR审批@@@
```

## 2. Python 调用脚本模板

```python
import urllib.request
import urllib.parse
import json
import time

def create_bpm_process(api_base, token, process_name, process_type, bpmn_xml, nodes_str, tenant_id="1"):
    """
    创建 JeecgBoot BPM 流程

    Args:
        api_base: 后端地址，如 "https://api3.boot.jeecg.com"
        token: X-Access-Token
        process_name: 流程名称
        process_type: 流程类型（如 "oa"）
        bpmn_xml: 完整 BPMN XML 字符串
        nodes_str: nodes 参数字符串
        tenant_id: 租户ID，默认 "1"

    Returns:
        dict: API 返回结果
    """
    ts = str(int(time.time() * 1000))
    process_key = f"process_{ts}"

    # 替换 XML 中的占位符
    bpmn_xml = bpmn_xml.replace("${PROCESS_KEY}", process_key)
    bpmn_xml = bpmn_xml.replace("${PROCESS_NAME}", process_name)

    data = {
        "processDefinitionId": "0",
        "processName": process_name,
        "processkey": process_key,
        "typeid": process_type,
        "lowAppId": "",
        "params": "",
        "nodes": nodes_str,
        "processDescriptor": bpmn_xml,
        "realProcDefId": "",
        "startType": "manual"
    }

    encoded_data = urllib.parse.urlencode(data).encode('utf-8')

    req = urllib.request.Request(
        f"{api_base}/act/designer/api/saveProcess",
        data=encoded_data,
        headers={
            "X-Access-Token": token,
            "X-Sign": "00000000000000000000000000000000",
            "X-Tenant-Id": tenant_id,
            "X-Timestamp": ts,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        method="POST"
    )

    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    return result, process_key


def update_bpm_process(api_base, token, process_id, process_key, process_name, process_type, bpmn_xml, nodes_str, tenant_id="1"):
    """
    更新已有 JeecgBoot BPM 流程

    Args:
        api_base: 后端地址
        token: X-Access-Token
        process_id: 流程数据表ID（新建时返回的 obj）
        process_key: 流程定义ID
        process_name: 流程名称
        process_type: 流程类型
        bpmn_xml: 完整 BPMN XML 字符串
        nodes_str: nodes 参数字符串
        tenant_id: 租户ID，默认 "1"

    Returns:
        dict: API 返回结果
    """
    ts = str(int(time.time() * 1000))

    data = {
        "processDefinitionId": process_id,
        "processName": process_name,
        "processkey": process_key,
        "typeid": process_type,
        "lowAppId": "",
        "params": "",
        "nodes": nodes_str,
        "processDescriptor": bpmn_xml,
        "startType": "manual"
    }

    encoded_data = urllib.parse.urlencode(data).encode('utf-8')

    req = urllib.request.Request(
        f"{api_base}/act/designer/api/saveProcess",
        data=encoded_data,
        headers={
            "X-Access-Token": token,
            "X-Sign": "00000000000000000000000000000000",
            "X-Tenant-Id": tenant_id,
            "X-Timestamp": ts,
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
        },
        method="POST"
    )

    resp = urllib.request.urlopen(req)
    result = json.loads(resp.read().decode('utf-8'))
    return result
```

## 3. 常见流程模式速查

### 模式A：简单审批（线性）

```
开始 → 提交 → 审批 → 结束
```

### 模式B：多级审批（线性）

```
开始 → 提交 → 经理审批 → 总监审批 → HR审批 → 结束
```

### 模式C：条件分支（排他网关）

```
开始 → 提交 → 审批 → 网关
  ├─ 通过 → 下一步 → 结束
  └─ 拒绝 → 结束
```

### 模式D：金额条件分支

```
开始 → 提交 → 网关（金额判断）
  ├─ ≤1000 → 经理审批 → 结束
  ├─ ≤10000 → 总监审批 → 结束
  └─ >10000 → CEO审批 → 结束
```

### 模式E：并行会签

```
开始 → 提交 → 并行网关(fork)
  ├─ 部门A审批
  └─ 部门B审批
并行网关(join) → 结束
```

### 模式F：审批+驳回到发起人（草稿节点模式）

```
开始 → 草稿(自动跳过) → 审批 → 网关
  ├─ 通过 → 结束
  └─ 驳回 → 草稿（发起人修改后重新提交）
```

**关键节点 XML：**

```xml
<!-- 草稿节点：首次自动跳过，驳回后发起人手动操作 -->
<bpmn2:userTask id="task_draft" name="草稿" flowable:assignee="${applyUserId}">
  <bpmn2:extensionElements>
    <flowable:taskExtendJson value="{&quot;sameMode&quot;:2,&quot;isSkipAssigneeEmpty&quot;:false,&quot;isSkipAssigneeOnePersion&quot;:false,&quot;isSkipApproval&quot;:false,&quot;isAssignedByPreviousNode&quot;:false,&quot;isEmptyAssignedByPreviousNode&quot;:false}" />
    <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
    <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskCreatedAutoSubmitListener" event="create" id="9c3064baa7074eab62e3c5b3b5458691" />
  </bpmn2:extensionElements>
</bpmn2:userTask>

<!-- 驳回连线：从网关回到草稿节点 -->
<bpmn2:sequenceFlow id="flow_reject" name="驳回" sourceRef="gateway_result" targetRef="task_draft">
  <bpmn2:conditionExpression xsi:type="tFormalExpression"><![CDATA[${result == 0}]]></bpmn2:conditionExpression>
</bpmn2:sequenceFlow>
```

### 模式G：多级审批 + 表达式审批人 + 上一节点指派（实战验证）

```
开始 → 申请人填写(草稿) → 部门负责人审批(表达式) → 分管领导审批(表达式) → 指派确认(上一节点指派) → 结束
```

**已验证成功的完整 Python 脚本（f-string 方式构造 XML）：**

```python
import urllib.request
import urllib.parse
import json
import time

API_BASE = '{后端地址}'
TOKEN = '{X-Access-Token}'

ts = str(int(time.time() * 1000))
process_key = f'process_{ts}'
process_name = '车辆出差申请流程'

# 注意：f-string 中 ${xxx} 写作 ${{xxx}}，JSON 花括号也需 {{}}
bpmn_xml = f'''<?xml version="1.0" encoding="UTF-8"?>
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

  <bpmn2:process id="{process_key}" name="{process_name}">
    <bpmn2:extensionElements>
      <flowable:executionListener class="org.jeecg.modules.extbpm.listener.execution.ProcessEndListener" event="end" />
      <flowable:eventListener class="org.jeecg.modules.listener.tasktip.TaskCreateGlobalListener" />
    </bpmn2:extensionElements>

    <bpmn2:startEvent id="start" name="开始" flowable:initiator="applyUserId" />

    <bpmn2:userTask id="task_apply" name="申请人填写" flowable:assignee="${{applyUserId}}">
      <bpmn2:extensionElements>
        <flowable:taskExtendJson value='{{"sameMode":2,"isSkipAssigneeEmpty":false,"isSkipAssigneeOnePersion":false,"isSkipApproval":false,"isAssignedByPreviousNode":false,"isEmptyAssignedByPreviousNode":false}}' />
        <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
        <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskCreatedAutoSubmitListener" event="create" id="auto_submit_1" />
      </bpmn2:extensionElements>
    </bpmn2:userTask>

    <bpmn2:userTask id="task_dept_leader" name="部门负责人审批"
      flowable:candidateUsers="${{flowNodeExecution.getDepartLeaders(execution)}}">
      <bpmn2:extensionElements>
        <flowable:taskExtendJson value='{{"sameMode":0,"isSkipAssigneeEmpty":false,"isSkipAssigneeOnePersion":true,"isSkipApproval":false,"isAssignedByPreviousNode":false,"isEmptyAssignedByPreviousNode":true}}' />
        <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
      </bpmn2:extensionElements>
    </bpmn2:userTask>

    <bpmn2:userTask id="task_leader" name="分管领导审批"
      flowable:candidateUsers="${{flowNodeExecution.getLevel1DepartLeaders(execution)}}">
      <bpmn2:extensionElements>
        <flowable:taskExtendJson value='{{"sameMode":0,"isSkipAssigneeEmpty":false,"isSkipAssigneeOnePersion":true,"isSkipApproval":false,"isAssignedByPreviousNode":false,"isEmptyAssignedByPreviousNode":true}}' />
        <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
      </bpmn2:extensionElements>
    </bpmn2:userTask>

    <bpmn2:userTask id="task_dispatch" name="车辆调度确认">
      <bpmn2:extensionElements>
        <flowable:taskExtendJson value='{{"sameMode":0,"isSkipAssigneeEmpty":false,"isSkipAssigneeOnePersion":false,"isSkipApproval":false,"isAssignedByPreviousNode":true,"isEmptyAssignedByPreviousNode":false}}' />
        <flowable:taskListener class="org.jeecg.modules.extbpm.listener.task.TaskSkipApprovalListener" event="create" />
      </bpmn2:extensionElements>
    </bpmn2:userTask>

    <bpmn2:endEvent id="end" name="结束" />

    <bpmn2:sequenceFlow id="flow_1" name="" sourceRef="start" targetRef="task_apply" />
    <bpmn2:sequenceFlow id="flow_2" name="" sourceRef="task_apply" targetRef="task_dept_leader" />
    <bpmn2:sequenceFlow id="flow_3" name="" sourceRef="task_dept_leader" targetRef="task_leader" />
    <bpmn2:sequenceFlow id="flow_4" name="" sourceRef="task_leader" targetRef="task_dispatch" />
    <bpmn2:sequenceFlow id="flow_5" name="" sourceRef="task_dispatch" targetRef="end" />
  </bpmn2:process>

  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="{process_key}">
      <bpmndi:BPMNShape id="shape_start" bpmnElement="start">
        <dc:Bounds x="200" y="30" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="207" y="73" width="22" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_task_apply" bpmnElement="task_apply">
        <dc:Bounds x="168" y="106" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_task_dept_leader" bpmnElement="task_dept_leader">
        <dc:Bounds x="168" y="206" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_task_leader" bpmnElement="task_leader">
        <dc:Bounds x="168" y="306" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_task_dispatch" bpmnElement="task_dispatch">
        <dc:Bounds x="168" y="406" width="100" height="60" />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="shape_end" bpmnElement="end">
        <dc:Bounds x="200" y="506" width="36" height="36" />
        <bpmndi:BPMNLabel><dc:Bounds x="207" y="549" width="22" height="14" /></bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="edge_flow_1" bpmnElement="flow_1">
        <di:waypoint x="218" y="66" /><di:waypoint x="218" y="106" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow_2" bpmnElement="flow_2">
        <di:waypoint x="218" y="166" /><di:waypoint x="218" y="206" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow_3" bpmnElement="flow_3">
        <di:waypoint x="218" y="266" /><di:waypoint x="218" y="306" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow_4" bpmnElement="flow_4">
        <di:waypoint x="218" y="366" /><di:waypoint x="218" y="406" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="edge_flow_5" bpmnElement="flow_5">
        <di:waypoint x="218" y="466" /><di:waypoint x="218" y="506" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>'''

nodes_str = 'id=task_apply###nodeName=申请人填写@@@id=task_dept_leader###nodeName=部门负责人审批@@@id=task_leader###nodeName=分管领导审批@@@id=task_dispatch###nodeName=车辆调度确认@@@'

data = {
    'processDefinitionId': '0',
    'processName': process_name,
    'processkey': process_key,
    'typeid': 'oa',
    'lowAppId': '',
    'params': '',
    'nodes': nodes_str,
    'processDescriptor': bpmn_xml,
    'realProcDefId': '',
    'startType': 'manual'
}

encoded_data = urllib.parse.urlencode(data).encode('utf-8')
req = urllib.request.Request(
    f'{API_BASE}/act/designer/api/saveProcess',
    data=encoded_data,
    headers={
        'X-Access-Token': TOKEN,
        'X-Sign': '00000000000000000000000000000000',
        'X-Tenant-Id': '1',
        'X-Timestamp': str(int(time.time() * 1000)),
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
    },
    method='POST'
)
resp = urllib.request.urlopen(req)
result = json.loads(resp.read().decode('utf-8'))
print(json.dumps(result, ensure_ascii=False, indent=2))
print(f'\\nProcess Key: {process_key}')
```

**实战要点：**
1. 此脚本必须先写入 `.py` 文件再执行（不能 `python3 -c` 内联，bash 会展开 `${}` 导致报错）
2. f-string 中所有 `${xxx}` 都写作 `${{xxx}}`
3. taskExtendJson 的 `value` 用单引号包裹 JSON，JSON 花括号用 `{{}}` 转义
4. 执行完毕后删除临时 `.py` 文件

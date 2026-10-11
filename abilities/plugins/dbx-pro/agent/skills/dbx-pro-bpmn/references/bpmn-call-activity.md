# 子流程（callActivity / subProcess）

JeecgBoot BPM 支持三种子流程模式：
1. **外部调用子流程** `callActivity` — 调用独立部署的子流程
2. **会签子流程** `callActivity` + `countersign` — 多人并行/顺序审批
3. **内嵌子流程（扩展子流程）** `subProcess` — 子流程嵌入主流程 XML 内部

## 内嵌子流程（subProcess / 扩展子流程）

内嵌子流程将子流程的节点直接嵌入主流程 XML 中，无需单独创建和部署。

### JSON 配置

```json
{
  "processName": "扩展子流程审批",
  "nodes": [
    {"id": "start", "type": "startEvent", "name": "开始"},
    {"id": "task_fill", "type": "userTask", "name": "填写人",
     "assignee": {"type": "expression", "value": "applyUserId"}},
    {"id": "sub_process", "type": "subProcess",
     "subNodes": [
       {"id": "sub_start", "type": "startEvent", "name": "开始"},
       {"id": "sub_task1", "type": "userTask", "name": "经理审批",
        "assignee": {"type": "candidateUsers", "value": "zhangli,jeecg"}},
       {"id": "sub_task2", "type": "userTask", "name": "总监审批",
        "assignee": {"type": "assignee", "value": "admin"}},
       {"id": "sub_end", "type": "endEvent", "name": "结束"}
     ],
     "subFlows": [
       {"id": "sf1", "source": "sub_start", "target": "sub_task1"},
       {"id": "sf2", "source": "sub_task1", "target": "sub_task2"},
       {"id": "sf3", "source": "sub_task2", "target": "sub_end"}
     ]},
    {"id": "task_hr", "type": "userTask", "name": "人力审批",
     "assignee": {"type": "assignee", "value": "jeecg"}},
    {"id": "end", "type": "endEvent", "name": "结束"}
  ],
  "flows": [
    {"id": "f1", "source": "start", "target": "task_fill"},
    {"id": "f2", "source": "task_fill", "target": "sub_process"},
    {"id": "f3", "source": "sub_process", "target": "task_hr"},
    {"id": "f4", "source": "task_hr", "target": "end"}
  ]
}
```

**subProcess 节点字段：**
- `subNodes` — 内部节点数组（支持 startEvent/userTask/endEvent）
- `subFlows` — 内部连线数组

### ⚠️ 关键生成规则（实测验证，必须遵守）

#### 1. BPMNShape 必须加 `isExpanded="true"`

```xml
<bpmndi:BPMNShape id="shape_sub_1" bpmnElement="sub_1" isExpanded="true">
  <dc:Bounds x="410" y="130" width="660" height="200" />
</bpmndi:BPMNShape>
```

**错误写法（缺少属性，设计器中子流程会折叠成小方块）：**
```xml
<bpmndi:BPMNShape id="shape_sub_1" bpmnElement="sub_1">  <!-- ❌ 缺少 isExpanded -->
  <dc:Bounds x="410" y="190" width="100" height="80" />   <!-- ❌ 尺寸错误 -->
</bpmndi:BPMNShape>
```

#### 2. 子流程容器尺寸：宽度 ≥ 660，高度 = 200

- 宽度公式：`max(660, len(subNodes) * 160 + 100)`
- 高度固定：200
- Y 坐标：`row_center_y - 100`（使子流程垂直居中于所在行）

#### 3. 内部节点坐标为绝对坐标（非相对坐标）

BPMNDiagram 中，内部节点（sub_start/sub_task/sub_end）使用**整个图的绝对坐标**，不是相对于子流程容器的相对坐标：

```xml
<!-- 子流程容器: x=410, y=130, w=660, h=200, center_y=230 -->
<bpmndi:BPMNShape id="shape_sub_start" bpmnElement="sub_start">
  <dc:Bounds x="519" y="212" width="36" height="36" />   <!-- 绝对坐标 -->
</bpmndi:BPMNShape>
<bpmndi:BPMNShape id="shape_sub_task1" bpmnElement="sub_task1">
  <dc:Bounds x="610" y="190" width="100" height="80" />  <!-- 绝对坐标 -->
</bpmndi:BPMNShape>
```

#### 4. 内部 subFlows 必须在 BPMNDiagram 中生成 BPMNEdge

`subFlows` 的连线除了在 `<bpmn2:subProcess>` 内部有 `sequenceFlow` 外，还必须在 BPMNDiagram 中有对应的 `BPMNEdge`：

```xml
<bpmndi:BPMNEdge id="edge_sf1" bpmnElement="sf1">
  <di:waypoint x="555" y="230" />
  <di:waypoint x="610" y="230" />
</bpmndi:BPMNEdge>
```

**常见错误：** 只生成了 `<bpmn2:sequenceFlow>` 而漏掉了 BPMNDiagram 中的 `BPMNEdge`，导致设计器中连线不可见。

#### 5. 手工分支布局中 subProcess 作为前置节点（prefix node）时

当主流程使用手工分支（task_dept 有 2 条无条件出线），而 subProcess 位于手工分支源节点**之前**（作为 prefix node）时：
- **不能**用普通任务的 100×80 尺寸
- **必须**使用展开后的实际尺寸（宽 ≥ 660，高 200）
- 后续节点的 x 坐标须在 subProcess 右边缘之后

`bpmn_creator.py` 已在 2026-04-02 修复此 bug（`calc_layout_manual_branch` 中 prefix_nodes 循环改为按实际宽度计算）。

### 内嵌子流程 vs 外部调用子流程

| 特性 | 内嵌子流程 `subProcess` | 外部调用 `callActivity` |
|------|----------------------|----------------------|
| XML 位置 | 嵌在主流程 XML 内部 | 独立流程，单独部署 |
| 部署 | 随主流程一起部署 | 需先部署子流程 |
| 复用 | 不可复用 | 可被多个主流程调用 |
| 布局 | `isExpanded="true"` 展开显示 | 普通节点大小 |
| start 节点 | 无需配 PC 表单地址 | 需要配（发布前） |

### 参考示例

- 扩展子流程: `references/example/扩展子流程.bpmn`

---

## 外部调用子流程（callActivity）

主流程通过 `callActivity` 节点调用外部子流程。子流程结束后自动回到主流程继续执行。

## JSON 配置

### 子流程配置

子流程分两种场景，使用不同的表单地址配置方式：

---

#### 场景 A：OA 类子流程（如借款、用车，复用主流程表单）

**规则：**
- 子流程**不关联独立表单**（不配置 `formLink`）
- draft 节点 PC 地址使用**主流程的 DesForm 地址**（通过 `draftNodeForm` 指定）
- 子流程 start 节点不需要单独配表单地址

```json
{
  "processName": "借款申请子流程",
  "processKey": "oa_business_trip_loan_sub",
  "isSubProcess": true,
  "draftNodeForm": {
    "formType": "desform",
    "formCode": "oa_business_trip_apply",
    "mode": "edit"
  },
  "nodes": [
    {"id": "start", "type": "startEvent", "name": "开始"},
    {"id": "task_draft", "type": "userTask", "name": "填写借款申请", "draft": true,
     "assignee": {"type": "expression", "value": "applyUserId"}},
    {"id": "task_finance", "type": "userTask", "name": "财务审批",
     "assignee": {"type": "role", "value": "admin"}},
    {"id": "end", "type": "endEvent", "name": "结束"}
  ],
  "flows": [
    {"id": "f1", "source": "start", "target": "task_draft"},
    {"id": "f2", "source": "task_draft", "target": "task_finance"},
    {"id": "f3", "source": "task_finance", "target": "end"}
  ]
}
```

**`draftNodeForm` 字段说明：**

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `formType` | 否 | `desform` | `desform` 或 `online` |
| `formCode` | 是 | - | 主流程的表单编码（DesForm 时为表单 code） |
| `mode` | 否 | `edit` | `edit`=编辑 / `detail`=查看 |

> **注意：** `draftNodeForm` 只影响 draft 节点的 PC 地址，不关联表单到流程，不影响流程执行。

### ⛔ 严重坑（callActivity + SubProcessStartListener，2026-04-27 实测）

#### 坑1：子流程中 `draft: true` 仅限发起人节点，禁止用于其他审批/填写任务

**现象：** 流程进入 callActivity 子流程时报 FK 约束错误：
```
Cannot add or update a child row: a foreign key constraint fails
(act_ru_variable, CONSTRAINT ACT_FK_VAR_EXE FOREIGN KEY (EXECUTION_ID_)
REFERENCES act_ru_execution (id_))
```

**根本原因：** `draft: true` 会给节点加上 `TaskCreatedAutoSubmitListener`。在 callActivity 子流程中，`SubProcessStartListener` 负责初始化子流程执行记录（绑定 `JG_SUB_MAIN_PROCESS_ID`）。当子流程第一个任务被创建时，`TaskCreatedAutoSubmitListener` 立即尝试自动提交并写入 `act_ru_variable`，而此时 `SubProcessStartListener` 的执行记录初始化尚未完成，导致 `EXECUTION_ID_` 引用了已失效的记录 → 外键约束报错。

**结论：**
- ✅ `draft: true` 只能用于主流程中 **发起人自己填写并提交** 的草稿节点（`assignee.value: "applyUserId"`）
- ❌ 子流程中任何 **审批人/HR/其他人** 填写的节点，**禁止** 使用 `draft: true`

**正确做法：** 子流程的非发起人填写节点使用普通 userTask，部署后通过 `edit_node_config` 单独配置 `formEditStatus=1`：

```python
from bpmn_creator import edit_node_config, deploy_process

# 1. 先 deploy 子流程（必须在 edit_node_config 之前）
deploy_process(API_BASE, TOKEN, sub_process_id)

# 2. 配置填写节点的表单地址（formEditStatus=1 允许编辑）
edit_node_config(API_BASE, TOKEN, sub_process_id, 'task_bg_hr', {
    'formEditStatus': 1,
    'modelAndView': 'desform/desFormIndex?formCode=oa_main_form_code&edit=1',
    'modelAndViewMobile': '',
})

# 3. 重新 deploy 激活 formEditStatus（必须）
deploy_process(API_BASE, TOKEN, sub_process_id)
```

子流程 JSON 配置（HR 填写节点，不加 `draft: true`）：
```json
{
  "processName": "背景调查子流程",
  "processKey": "oa_background_check_sub",
  "isSubProcess": true,
  "nodes": [
    {"id": "start", "type": "startEvent", "name": "开始"},
    {"id": "task_bg_hr", "type": "userTask", "name": "HR填写背景调查结果",
     "assignee": {"type": "role", "value": "hr_staff"}},
    {"id": "end", "type": "endEvent", "name": "结束"}
  ],
  "flows": [
    {"id": "f1", "source": "start", "target": "task_bg_hr"},
    {"id": "f2", "source": "task_bg_hr", "target": "end"}
  ]
}
```

> 注意：没有 `draftNodeForm`，没有 `draft: true`。表单地址通过 deploy 后的 `edit_node_config` 步骤配置。

---

#### 坑2：callActivity 的 `inVars`/`outVars` 不能用于传递 DesForm 字段值

**场景 A 子流程（复用主流程 DesForm）** 中，DesForm 字段（如 `bg_check_result`、`candidate_name`）存储在 DesForm 的独立数据库表中，**不是** Flowable 流程变量，不存在于 `act_ru_variable`。子流程通过 `JG_SUB_MAIN_PROCESS_ID` 自动共享主流程数据，无需主动传递。

- ❌ 不要用 `inVars`/`outVars` 传 DesForm 字段值（传不过去，它们不是 Flowable 变量）
- ✅ 子流程条件网关直接用 `flowUtil.evaluateExpression` 读 DesForm 字段（自动走父流程数据表）
- ✅ `inVars`/`outVars` 只用于传递真正的 Flowable 流程变量（如 `applyUserId` 等自定义变量）

```json
// ❌ 错误：试图用 inVars/outVars 传 DesForm 字段
{"id": "call_bgcheck", "type": "callActivity", "calledElement": "oa_background_check_sub",
 "inVars":  [{"source": "candidate_name",  "target": "candidate_name"}],
 "outVars": [{"source": "bg_check_result", "target": "bg_check_result"}]}

// ✅ 正确：直接调用，子流程内通过 flowUtil.evaluateExpression 读表单字段
{"id": "call_bgcheck", "type": "callActivity", "calledElement": "oa_background_check_sub"}
```

---

#### 坑3：deploy API 端点

**正确端点：** `PUT /act/process/extActProcess/deployProcess`，body `{"id": process_id}`

**错误端点（会报 "路径不存在"）：** `GET /act/process/extActProcess/deploy?id=...`

始终使用 `bpmn_creator.py` 的 `deploy_process(api_base, token, process_id)` 函数，不要手动拼接 deploy URL。

---

#### 坑4：desform 表单 URL 禁止用 f-string 手动拼接（2026-04-29 实测）

**现象：** 节点配置的表单地址出现 `${{BPM_DES_DATA_ID}}`，多了一个 `{`，导致流程打开表单时变量无法解析。

**根本原因：** 在 Python f-string 中：
- 产生 `{{DOMAIN_URL}}`（2 个花括号）需要写 `{{{{DOMAIN_URL}}}}` (4 个花括号)
- 产生 `${BPM_DES_DATA_ID}`（1 个花括号）只需要写 `${{BPM_DES_DATA_ID}}` (2 个花括号)

如果对两者统一用 4 个花括号（`${{{{BPM_DES_DATA_ID}}}}`），输出会是 `${{BPM_DES_DATA_ID}}`（多了一个 `{`）。

**正确做法：** 永远用 `_build_form_url_pair()` 生成表单地址，不要手动拼接：

```python
# ✅ 正确：使用 _build_form_url_pair，内部用 % 格式化，无 f-string 问题
pc_url, mobile_url = bc._build_form_url_pair('desform', form_code, 'edit')

# ❌ 错误：f-string 手动拼接，花括号转义容易出错
desform_url = f'{{{{DOMAIN_URL}}}}/desform/edit/{form_code}/${{{{BPM_DES_DATA_ID}}}}?...'
# 上面输出：{{DOMAIN_URL}}/desform/edit/xxx/${{BPM_DES_DATA_ID}}?...  ← 多了花括号！
```

---

#### 坑5：`config_start_node_form` 找不到非标准 id 的 start 节点（2026-04-29 实测）

**现象：** 调用 `bc.config_start_node_form(API_BASE, TOKEN, sub_pid, {...})` 报 `[警告] 未找到 start 节点记录`，但子流程确实有开始节点。

**根本原因：** `config_start_node_form` 原先硬编码查找 `processNodeCode == 'start'`。
当子流程的 startEvent 使用了非标准 id（如 `bg_start`、`sub_start` 等），`processNodeCode` 也会是对应 id，导致匹配失败。

**修复：** `bpmn_creator.py` 已于 2026-04-29 更新 `config_start_node_form`，新增 `node_code` 参数并支持模糊匹配含 `start` 的节点 code。如已知确切 code，显式传入：

```python
# ✅ 显式传入 node_code（当 startEvent id 不是 'start' 时）
bc.config_start_node_form(API_BASE, TOKEN, sub_pid, {
    'formType': 'desform',
    'formCode': 'main_form_code',
    'mode': 'detail',
}, node_code='bg_start')   # ← 子流程中 startEvent 的实际 id

# ✅ 也可省略 node_code，函数会自动模糊匹配含 'start' 的节点
bc.config_start_node_form(API_BASE, TOKEN, sub_pid, {...})
```

**最佳实践：** 子流程中 startEvent 的 id 统一命名为 `start`，避免此问题。

---

#### 场景 A 完整正确执行顺序（含子流程）

```
1. 创建子流程 JSON（非发起人节点不加 draft: true，不加 inVars/outVars）
2. 调用 bpmn_creator.py 创建并保存子流程
3. deploy_process(sub_id)             ← 第一次发布
4. edit_node_config(sub_id, node_id, {formEditStatus:1, modelAndView:...})
5. deploy_process(sub_id)             ← 第二次发布，激活 formEditStatus
6. 创建主流程（callActivity 不加 inVars/outVars）
7. deploy_process(main_id)            ← 发布主流程
```

---

#### 场景 B：独立子流程（有自己的独立表单）

子流程拥有独立的 DesForm 表单，通过 `startNodeForm` 配置 start 节点 PC 地址：

```json
{
  "processName": "客户申请子流程",
  "processKey": "process_customer_sub",
  "isSubProcess": true,
  "startNodeForm": {
    "formType": "desform",
    "formCode": "crm_customer_info",
    "mode": "detail"
  },
  "nodes": [
    {"id": "start", "type": "startEvent", "name": "开始"},
    {"id": "sub_task1", "type": "userTask", "name": "子流程审核",
     "assignee": {"type": "expression", "value": "applyUserId"}},
    {"id": "end", "type": "endEvent", "name": "结束"}
  ],
  "flows": [
    {"id": "f1", "source": "start", "target": "sub_task1"},
    {"id": "f2", "source": "sub_task1", "target": "end"}
  ]
}
```

**关键字段：**
- `isSubProcess: true` — 标记为子流程，自动添加 `SubProcessStartListener`，start 节点纳入 nodes 参数
- `startNodeForm` — start 节点的 PC 表单地址配置（**必须在发布前配置**）

### 主流程配置（含 callActivity）

```json
{
  "processName": "客户申请主流程",
  "nodes": [
    {"id": "start", "type": "startEvent", "name": "开始"},
    {"id": "task_draft", "type": "userTask", "name": "填写申请", "draft": true,
     "assignee": {"type": "expression", "value": "applyUserId"}},
    {"id": "call_sub", "type": "callActivity", "name": "调用子流程",
     "calledElement": "process_customer_sub"},
    {"id": "end", "type": "endEvent", "name": "结束"}
  ],
  "flows": [
    {"id": "f1", "source": "start", "target": "task_draft"},
    {"id": "f2", "source": "task_draft", "target": "call_sub"},
    {"id": "f3", "source": "call_sub", "target": "end"}
  ]
}
```

**callActivity 节点字段：**
- `calledElement` — 子流程的 processKey（必填）
- 脚本自动传递变量 `applyUserId` 和 `JG_LOCAL_PROCESS_ID`

## 执行顺序（重要）

```
1. 创建子流程  →  保存（不发布）
2. 配 start 节点  →  配置 PC + 移动端表单地址（必须在发布前）
             ↑ 若未指定 startNodeForm，bpmn_creator.py 自动从 draftNodeForm 推导（detail 模式）
3. 发布子流程  →  部署到引擎
4. 创建主流程  →  保存 + 发布
```

> **严格规则：** start 节点的表单地址必须在发布流程之前配置，否则不生效。

### start 节点表单地址自动推导规则

`bpmn_creator.py` 对 `isSubProcess: true` 的子流程，按以下优先级确定 start 节点表单地址：

1. 明确指定了 `startNodeForm` → 使用 `startNodeForm`
2. 未指定 `startNodeForm` 但有 `draftNodeForm` → **自动推导**：取 `draftNodeForm` 的 `formType`/`formCode`，`mode` 固定为 `detail`（只读查看）
3. 两者都没有 → 跳过 start 节点配置（不推荐，start 节点无表单地址时移动端无法查看主流程数据）

**为什么 start 节点用 detail 模式？** 子流程的 start 节点不是表单入口，而是让审批人查看主流程的提交数据，应该是只读的。编辑权限留给 draft 节点。

## 表单地址规则（PC 端 + 移动端）

| 表单类型 | 端 | URL 格式 |
|---------|-----|---------|
| **DesForm 设计器** | PC-查看 | `{{DOMAIN_URL}}/desform/detail/{formCode}/${BPM_DES_DATA_ID}?token={{TOKEN}}&taskId={{TASKID}}&skip=false` |
| **DesForm 设计器** | PC-编辑 | `{{DOMAIN_URL}}/desform/edit/{formCode}/${BPM_DES_DATA_ID}?token={{TOKEN}}&taskId={{TASKID}}&skip=false` |
| **DesForm 设计器** | 移动端-查看 | `{{DOMAIN_URL}}/desform/detail/{formCode}/${BPM_DES_DATA_ID}?token={{TOKEN}}&taskId={{TASKID}}` |
| **DesForm 设计器** | 移动端-编辑 | `{{DOMAIN_URL}}/desform/edit/{formCode}/${BPM_DES_DATA_ID}?token={{TOKEN}}&taskId={{TASKID}}` |
| **Online 表单** | PC-查看 | `super/bpm/process/components/OnlineFormDetail` |
| **Online 表单** | PC-编辑 | `super/bpm/process/components/OnlineFormOpt` |
| **Online 表单** | 移动端（查看/编辑） | `check/onlineForm/flowedit` |
| **自定义开发表单** | PC | `{viewDir}/components/{EntityName}Form?edit=1` |
| **自定义开发表单** | 移动端 | `applyform/{routeName}`（按实际路由填写） |

> **⚠️ 移动端 DesForm 不能用 `check/xxx/flowedit` 格式** — 该格式仅适用于 Online 表单（cgform）。DesForm 有自己的完整 URL，必须包含 `${BPM_DES_DATA_ID}` 占位符，否则移动端无法正确打开表单数据。

**占位符规则：**
- `{{DOMAIN_URL}}`、`{{TOKEN}}`、`{{TASKID}}` — 双花括号，系统模板变量
- `${BPM_DES_DATA_ID}` — 单花括号 `${}`，流程变量（不要写成 `${{}}` 双花括号）
- 移动端 URL 末尾不需要 `&skip=false`（PC 端需要）

## startNodeForm 配置

| 字段 | 必填 | 默认值 | 说明 |
|------|------|--------|------|
| `formType` | 否 | `desform` | `desform` 或 `online` |
| `formCode` | 是(desform) | - | DesForm 表单编码 |
| `mode` | 否 | `detail` | `detail`=查看 / `edit`=编辑 |

## 会签子流程（countersign）

会签是多人审批场景，通过 `callActivity` + `multiInstanceLoopCharacteristics` 实现。

### 会签 vs 普通调用子流程

| 特性 | 普通调用子流程 | 会签子流程 |
|------|-------------|----------|
| 监听器 | `SubProcessStartListener` | `SubProcessHqStartListener`（注意 **Hq**） |
| 多实例 | 无 | `multiInstanceLoopCharacteristics` |
| 审批人变量 | - | `assigneeUserId`（循环变量） |
| 会签人列表 | - | `assigneeUserIdList` |
| JSON 标记 | `isSubProcess: true` | `isCountersignSubProcess: true` |

### 会签子流程 JSON 配置

```json
{
  "processName": "会签子流程",
  "isCountersignSubProcess": true,
  "startNodeForm": {
    "formType": "desform",
    "formCode": "crm_customer_info",
    "mode": "detail"
  },
  "nodes": [
    {"id": "start", "type": "startEvent", "name": "开始"},
    {"id": "sub_task1", "type": "userTask", "name": "子节点1",
     "assignee": {"type": "expression", "value": "assigneeUserId"}},
    {"id": "sub_task2", "type": "userTask", "name": "子节点2",
     "assignee": {"type": "expression", "value": "assigneeUserId"}},
    {"id": "end", "type": "endEvent", "name": "结束"}
  ],
  "flows": [
    {"id": "f1", "source": "start", "target": "sub_task1"},
    {"id": "f2", "source": "sub_task1", "target": "sub_task2"},
    {"id": "f3", "source": "sub_task2", "target": "end"}
  ]
}
```

### 主流程 callActivity 会签配置

```json
{"id": "call_hq", "type": "callActivity", "name": "会签子流程",
 "calledElement": "process_hq_sub_key",
 "countersign": {
   "sequential": false,
   "collection": "assigneeUserIdList",
   "elementVariable": "assigneeUserId"
 }}
```

**countersign 字段：**

| 字段 | 默认值 | 说明 |
|------|--------|------|
| `sequential` | `false` | `false`=并行会签（所有人同时审） / `true`=顺序会签（按序逐个审） |
| `collection` | `assigneeUserIdList` | 会签人列表变量名 |
| `elementVariable` | `assigneeUserId` | 循环变量名（传入子流程的审批人） |

### 会签 XML 关键元素

```xml
<!-- callActivity 内的多实例配置（缺任何一项都会报 ${assigneeUserId} 无法解析） -->
<bpmn2:multiInstanceLoopCharacteristics
  isSequential="false"
  flowable:collection="${flowUtil.stringToList(assigneeUserIdList)}"
  flowable:elementVariable="assigneeUserId" />

<!-- 额外传递的变量 -->
<!-- ⚠ 必须用 sourceExpression 而不是 source，确保传入当前循环变量的值 -->
<flowable:in sourceExpression="${assigneeUserId}" target="assigneeUserId" />
<flowable:in source="applyUserId" target="applyUserId" />
<flowable:in source="JG_LOCAL_PROCESS_ID" target="JG_SUB_MAIN_PROCESS_ID" />
```

> **⛔ assigneeUserIdList 为空时的陷阱：** 若该变量未设置，多实例不会启动任何子流程，callActivity 静默完成。演示时可硬编码：`flowable:collection="${flowUtil.stringToList('admin,qinfeng')}"`；生产环境通过前一节点 `selnextUserStatus=1` 动态选人。

### 会签子流程监听器（注意是 Hq）

```xml
<flowable:executionListener
  class="org.jeecg.modules.extbpm.listener.execution.SubProcessHqStartListener"
  event="start" id="1177167770459070465" />
```

### 参考示例

- 会签主流程: `references/example/会签主流程.bpmn`
- 会签子流程: `references/example/会签子流程.bpmn`

---

## BPMN XML 特征

### 子流程额外监听器

```xml
<flowable:executionListener
  class="org.jeecg.modules.extbpm.listener.execution.SubProcessStartListener"
  event="start" id="64d675c1a3adcb514ea5f9835093c29b" />
```

### callActivity XML

```xml
<bpmn2:callActivity id="call_sub" name="调用子流程" calledElement="process_sub_key">
  <bpmn2:extensionElements>
    <flowable:in source="applyUserId" target="applyUserId" />
    <flowable:in source="JG_LOCAL_PROCESS_ID" target="JG_SUB_MAIN_PROCESS_ID" />
  </bpmn2:extensionElements>
</bpmn2:callActivity>
```

## 参考

- 主流程示例: `references/example/外部主流程.bpmn`
- 子流程示例: `references/example/外部子流程.bpmn`

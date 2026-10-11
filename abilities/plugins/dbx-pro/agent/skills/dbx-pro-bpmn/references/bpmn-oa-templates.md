### OA 表单字段类型

| type | 可选参数 | 说明 |
|------|---------|------|
| `input` | `required`, `placeholder`, `unique` | 单行文本 |
| `textarea` | `required` | 多行文本 |
| `number` | `required`, `unit`, `precision` | 数字 |
| `integer` | `required`, `unit` | 整数 |
| `money` | `required`, `unit` | 金额 |
| `date` | `required`, `fmt` | 日期 |
| `time` | `required` | 时间 |
| `radio` | `options`(必填), `required`, `dictCode` | 单选 |
| `select` | `options`(必填), `required`, `multiple`, `dictCode` | 下拉 |
| `checkbox` | `options`(必填), `required`, `dictCode` | 多选 |
| `select-user` | `required`, `multiple` | 选人 |
| `select-depart` | `required`, `multiple` | 选部门 |
| `phone` | `required` | 手机 |
| `email` | `required` | 邮箱 |
| `file-upload` | `required` | 文件上传 |
| `imgupload` | `required` | 图片上传 |
| `hand-sign` | `required` | 手写签名 |
| `auto-number` | `prefix` | 自动编号 |
| `divider` | `text` | 分隔符 |
| `formula` | `mode`, `expression`, `decimal`, `unit` | 公式 |
| `location` | `required` | 定位 |
| `barcode` | `codeType` | 条码 |
| `editor` | `required` | 富文本 |
| `oa-approval-comments` | - | 审批意见（grid 6:18布局，禁用状态） |

> **审批意见组件规则：** 当字段名包含"意见"、"签字"、"审批"等关键词（如"部门负责人意见"、"财务审核签字"），**必须**使用 `oa-approval-comments` 类型，**不要**使用 `hand-sign` 或 `textarea`。该组件自动生成 grid 布局（左侧标签 + 右侧审批意见区域），默认禁用，由流程节点控制启用。

### OA 流程分支规则

> **重要：** 生成流程 JSON 配置时，必须根据表单字段决定分支方式：
> - **表单有 `result` 等可用于条件判断的字段** → 使用 `exclusiveGateway` + `conditions` 条件分支
> - **表单没有 `result` 字段** → 使用**手工分支**（从 userTask 直接引出多条无条件的 sequenceFlow）
>
> **手工分支使用前提：** 仅在通过/拒绝后还需要经过不同的后续处理节点时才使用。如果审批后只有结束节点，不需要手工分支，直接连到结束即可。

### OA callActivity 外部子流程

使用 callActivity 需要**两步创建**：

**第 1 步：先创建并部署外部子流程**（使用 `bpmn_creator.py`）

OA 类子流程（如借款、用车）**不关联独立表单**，draft 节点 PC 地址复用主流程 DesForm：

```json
{
  "processName": "借款申请子流程",
  "processKey": "oa_business_trip_loan_sub",
  "typeId": "oa",
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
    {"id": "flow_1", "source": "start", "target": "task_draft"},
    {"id": "flow_2", "source": "task_draft", "target": "task_finance"},
    {"id": "flow_3", "source": "task_finance", "target": "end"}
  ]
}
```

> **关键规则：**
> - `isSubProcess: true` — start 节点纳入 nodes 参数（必须，否则设计器看不到 start 节点）
> - `draftNodeForm` — draft 节点 PC 地址指向**主流程**的 DesForm（不配置则无 PC 表单地址）
> - **不要**加 `formLink` — OA 子流程不需要关联独立表单
> - `draftNodeForm.formCode` 填**主流程**的表单编码（如 `oa_business_trip_apply`）

**第 2 步：创建主 OA 应用**（使用 `bpmn_oa.py`），在主流程 JSON 中用 callActivity 节点引用子流程：
```json
{"id": "call_loan", "type": "callActivity", "name": "借款子流程",
 "calledElement": "oa_business_trip_loan_sub"}
```
`calledElement` 必须与子流程的 `processKey` 一致。

### 会签子流程（自动创建规则）

> **执行规则：当流程中包含会签子流程节点（`callActivity` + `multiInstanceLoopCharacteristics`）时，无需询问用户是否创建子流程，直接按以下步骤自动创建并部署。**

#### 创建步骤

**第 1 步：创建会签子流程**（`bpmn_creator.py`）

```json
{
  "processName": "XXX会签子流程",
  "processKey": "<calledElement值>",
  "typeId": "oa",
  "isCountersignSubProcess": true,
  "nodes": [
    {"id": "start", "type": "startEvent", "name": "开始"},
    {"id": "sub_task_review", "type": "userTask", "name": "会签审核",
     "assignee": {"type": "expression", "value": "assigneeUserId"}},
    {"id": "end", "type": "endEvent", "name": "结束"}
  ],
  "flows": [
    {"id": "f1", "source": "start", "target": "sub_task_review"},
    {"id": "f2", "source": "sub_task_review", "target": "end"}
  ]
}
```

关键规则：
- `isCountersignSubProcess: true` — 自动添加 `SubProcessHqStartListener`，区别于普通子流程的 `SubProcessStartListener`
- 任务节点 assignee 固定用 `assigneeUserId`（由主流程 callActivity 通过 `flowable:in` 传入）
- **不加** `formLink`、**不加** `draftNodeForm`

**第 2 步：配置所有节点表单地址**（发布前，指向主流程表单 detail 模式）

```python
DETAIL_URL = '{{DOMAIN_URL}}/desform/detail/<主流程formCode>/${BPM_DES_DATA_ID}?token={{TOKEN}}&taskId={{TASKID}}&skip=false'
# 通过 /act/process/extActProcessNode/list 查询节点列表
# 逐个调用 /act/process/extActProcessNode/edit 设置 modelAndView + modelAndViewMobile
```

**第 3 步：重新发布子流程**（`deploy_process`）

#### 更新流程 XML 的正确方式

> **重要：** `/act/designer/api/saveProcess` 不会更新 `ext_act_process.process_xml`，必须直接操作数据库：

```python
# 1. 从数据库读取 XML
conn = pymysql.connect(...)
cur.execute('SELECT process_xml FROM ext_act_process WHERE id=%s', (process_id,))
xml = cur.fetchone()[0].decode('utf-8')

# 2. 修改 XML（字符串替换）

# 3. 写回数据库
cur.execute('UPDATE ext_act_process SET process_xml=%s WHERE id=%s', (xml.encode('utf-8'), process_id))
conn.commit()

# 4. 调用 deploy API 重新发布
deploy_process(api_base, token, process_id)
```

---

### 常见 OA 应用模板

#### 费用报销单
- 字段：报销单号、申请人、部门、日期、报销类别、金额、说明、发票、附件、部门负责人意见(审批意见)、财务审核意见(审批意见)
- 流程：提交 → 部门审批 →(手工分支: 通过/拒绝)→ 财务审核 → 结束
- **注意：** 表单无 result 字段，使用手工分支

#### 请假申请单
- 字段：申请人、部门、日期、请假类型、开始/结束日期、天数、说明、附件、部门负责人意见(审批意见)
- 流程：提交 → 部门审批 → 结束
- **注意：** 审批后只有结束节点，不需要手工分支

#### 采购申请单
- 字段：申请人、部门、日期、采购物品、数量、预算金额、供应商、说明、附件、部门负责人意见(审批意见)、总经理意见(审批意见)
- 流程：提交 → 部门审批 →(手工分支: 通过/拒绝)→ 总经理审批 → 结束

#### 出差申请单（含 callActivity 子流程）
- 字段：申请人、部门、出差地点、开始/结束日期、天数、事由、预算、附件、部门负责人意见(审批意见)、总监审批意见(审批意见)、财务审批意见(审批意见)
- 子流程：借款子流程（processKey: oa_business_trip_loan_sub），含财务审批节点
- 主流程：提交 → 部门审批 →(手工分支: 同意/不同意)→ 总监审批 → 借款子流程(callActivity) → 结束
- **注意：** 需先用 `bpmn_creator.py` 创建子流程（设置 `isSubProcess:true` + `draftNodeForm` 指向主流程表单，不加 `formLink`），再用 `bpmn_oa.py` 创建主流程

---

## 编辑已有流程

在 JSON 配置中传入 `"processId": "已有流程ID"` 即可更新流程。

> **⛔ 严重坑（已发生，耗时翻倍）：修改 taskExtendJson 前必须先读 XML**
>
> 直接猜测字段名（如 `isSkipAssigneeSameUser`、`isAutoClaimTask`）会写入无效字段，实际不生效，还需要再跑一次纠错。
>
> **强制操作顺序：**
> 1. 先 `queryById` 读取 XML，base64 decode 后找到目标节点的 `taskExtendJson`
> 2. 打印现有字段名和值，确认后再修改
> 3. 常见字段名：`sameMode`、`isSkipAssigneeOnePersion`（注意拼写）、`isSkipApproval`、`isSkipAssigneeEmpty`
>
> **流程名称搜索必须精确匹配：**
> - 用 `name == '流程名称'` 精确匹配，不要用 `'关键词' in name`
> - 模糊匹配会拿到同名子流程（如「网关测试-会签子流程」），导致找不到目标节点而报错

### 查询已有流程 XML

**API：** `GET /act/process/extActProcess/queryById?id={processId}`

返回 `result.processXml` 字段是 **base64 编码**的，必须先解码才能得到原始 XML：

```python
import base64, json, urllib.request
req = urllib.request.Request(
    f'{api_base}/act/process/extActProcess/queryById?id={process_id}',
    headers={'X-Access-Token': token, 'X-Sign': '0'*32, 'X-Tenant-Id': '1'},
)
result = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))['result']
xml_str = base64.b64decode(result['processXml']).decode('utf-8')  # 原始 XML
# ... 修改 xml_str ...
# 回写时传原始 xml_str，不要再 base64.b64encode（服务器自动做）
```

### 修改已有流程 XML 前必须做的三件事（强制）

> **⛔ 严重教训（已发生，导致 XML 彻底清空）：** 下面三件事缺一不可。

**1. 修改前必须把原始 XML 保存到本地文件**

```python
# 读取后立即保存备份，防止后续操作失败导致无法恢复
xml_str = base64.b64decode(result['processXml']).decode('utf-8')
with open('backup_original.xml', 'w', encoding='utf-8') as f:
    f.write(xml_str)
print('已备份原始 XML 到 backup_original.xml')
```

> 原因：JeecgBoot 没有暴露从 Flowable 引擎取回已部署 XML 的 API（尝试了 `/getProcessBpmnXml`、`/getProcDefXml`、`/procDefXml` 等十余个路径均返回 null 或 404）。一旦 `saveProcess` 写入损坏的 XML，原始内容**彻底丢失，无法恢复**，只能从头重建整个流程。

**2. BPMNEdge 必须在 `</bpmndi:BPMNPlane>` 内，不是 `</bpmndi:BPMNDiagram>` 内**

```python
# ❌ 错误：在 BPMNDiagram 结束前插入，导致 Flowable 发布报错
xml = xml.replace('</bpmndi:BPMNDiagram>', new_edges + '</bpmndi:BPMNDiagram>')

# ✅ 正确：在 BPMNPlane 结束前插入
xml = xml.replace('</bpmndi:BPMNPlane>', new_edges + '</bpmndi:BPMNPlane>')
```

> 错误时 Flowable 发布报错：`cvc-complex-type.2.4.a: 发现了以元素 BPMNEdge 开头的无效内容，应以 BPMNLabelStyle 之一开头`。saveProcess 仍返回 success，但 deployProcess 失败。

**3. 禁止用字符串索引（`index()`）切片重组 XML，极易截断**

```python
# ❌ 危险：用索引切片重组极易出错（已导致 XML 截断为空）
plane_end = xml.index('</bpmndi:BPMNPlane>')
diag_end  = xml.index('</bpmndi:BPMNDiagram>')
xml = xml[:plane_end] + xml[plane_end:diag_end].replace(...) + xml[diag_end:]
# ↑ xml[diag_end:] 包含的是从 </bpmndi:BPMNDiagram> 开始的内容，
#   但 replace 的结果如果把 section_between 弄丢了，末尾会被截断

# ✅ 安全：用 .replace() 精确替换，不使用索引切片
xml = xml.replace('</bpmndi:BPMNPlane>', new_shape + '</bpmndi:BPMNPlane>', 1)
xml = xml.replace('<target_node_marker', new_task_xml + '<target_node_marker', 1)
```

> 索引切片操作一旦出错，`saveProcess` 仍然返回 success（不校验 XML 合法性），但实际写入的是截断/空的 XML，下次查询 `processXml` 会得到空字符串。

**4. 插入节点优先用 `bpmn_creator.py` JSON 配置全量重建**

当需要向已有流程插入节点时，**优先考虑全量重建而不是手工拼 XML**。全量重建的优点：
- 不需要处理 XML 字符串操作的边界问题
- BPMNShape、BPMNEdge 位置由脚本自动计算
- 避免截断/损坏风险

```json
{
  "processId": "已有流程ID",
  "processName": "原流程名称",
  "processKey": "原流程Key",
  "nodes": [ /* 原有节点 + 新节点 */ ],
  "flows": [ /* 原有连线（修改源/目标） + 新连线 */ ]
}
```

> 全量重建的前提是：知道所有节点的完整配置（审批人、会签规则等）。如果原始 XML 已在手（备份或刚读取），可以从中解析出所有配置再重建。

---

### 向已有流程插入节点（两节点之间）

**⛔ 踩坑记录（已发生，导致节点重叠）：** 在两个已有节点 A → B 之间插入新节点 C 时，如果只计算 `C.y = A.bottom + gap`，可能会把 C 放到 B 的上方甚至重叠，因为 B 没有随之下移。

**⛔ 踩坑记录（已发生，导致节点跑偏成水平排列）：** 向垂直布局流程中插入节点时，**不能**用「A 右侧 + gap」作为新节点的 x 坐标。正确做法是**沿原流程方向插入**：垂直布局 → 新节点 x 与 A 相同、y = A.bottom + gap；水平布局 → 新节点 y 与 A 相同、x = A.right + gap。插入前先判断原流程方向。

**布局方向判断：**
```python
# A → B 连线：两节点坐标差决定方向
dx = abs(B.x - A.x)
dy = abs(B.y - A.y)
is_vertical = dy > dx  # True=垂直布局，False=水平布局
```

**正确操作顺序（5 步）：**

1. **读取 A、B 的当前坐标**（从 `<bpmndi:BPMNShape>` 中读取 x/y/width/height）
2. **判断布局方向**，按方向计算新节点坐标：
   - 垂直：`new_x = A.x`，`new_y = A.bottom + gap`（gap 建议 60px）
   - 水平：`new_y = A.y`，`new_x = A.right + gap`
3. **计算 B 需要下移/右移的偏移量**：`shift = (new_C_far_edge + gap) - B_near_edge`，若 shift > 0 则将 B 及其后所有节点的坐标整体偏移
4. **插入新节点的 BPMNShape**（宽高与流程中其他同类节点一致，userTask/serviceTask/apiTask 均为 w=100, h=80）
5. **重建连线 BPMNEdge 的 waypoints**（A→C 和 C→B 各写两个 waypoint，连接对应边的中心点）

```python
# 正确的 BPMNDiagram 区段批量下移示例
di_start = xml.index('<bpmndi:BPMNDiagram')
head, diag = xml[:di_start], xml[di_start:]

def shift_shape_y(match):
    block = match.group(0)
    elem_id = re.search(r'bpmnElement="([^"]+)"', block)
    if elem_id and elem_id.group(1) == NEW_TASK_ID:
        return block  # 新节点已经设好，跳过
    def replace_y(m2):
        old_y = float(m2.group(1))
        if old_y >= B_original_y - 5:   # 容差 5px
            return f'y="{int(old_y + shift)}"'
        return m2.group(0)
    return re.sub(r'y="(-?\d+(?:\.\d+)?)"', replace_y, block)

diag = re.sub(r'<bpmndi:BPMNShape[^>]*>.*?</bpmndi:BPMNShape>',
              shift_shape_y, diag, flags=re.DOTALL)
xml = head + diag
```

### 复杂混合流程的布局修复（手工计算坐标）

**⛔ 严重坑（已实测，多次复现）：`bpmn_creator.py` 自动布局引擎在以下任一组合出现时，会产生严重渲染问题，节点巨大、连线交叉、终止节点位置错误。**

**已知触发场景（满足任一即触发）：**

| 场景 | 具体表现 |
|------|---------|
| 并行网关 + 手工分支 | 并行汇聚网关跑到水平线上方；手工分支退回线横穿所有节点 |
| **手工分支 + 多个 exclusiveGateway + 多个 endEvent + callActivity**（已实测：新员工入职申请流程） | 节点显示为超大红框；gw 网关尺寸异常；多余 endEvent 悬浮到错误位置；连线大幅交叉重叠 |

**根本原因：** `bpmn_creator.py` 的手工分支水平布局、条件旁路垂直布局、callActivity 布局各自使用独立坐标体系，三者混用时坐标全面冲突，自动布局引擎无法正确解决。

> **⛔ 强制规则（禁止违反）：凡流程同时包含「手工分支」+「条件网关（exclusiveGateway）」或「callActivity」任意一项，必须在创建时就使用手工坐标，禁止依赖 bpmn_creator.py 自动布局后再事后修复。事后修复会导致节点配置和字段权限全部丢失，需要额外补救步骤。**

**解决方案：完全绕过 bpmn_creator.py 布局，手工计算所有坐标并替换 BPMNDiagram 段。**

#### 已验证的垂直主流坐标方案（实测 oa_new_employee_onboard_process：手工分支+条件网关+callActivity+多endEvent）

**布局思路：主流垂直排列（cx=400），旁路终止节点在右侧列（cx=620），旁路 userTask 也在右侧（cx=620）。**

```python
# 节点坐标 (x, y, w, h)
shapes = {
    # 主流（垂直，cx=400）
    'start':           (382,   30,   36,  36),
    'task_draft':      (350,  106,  100,  80),
    'task_supervisor': (350,  226,  100,  80),   # 手工分支源节点
    'task_hr':         (350,  346,  100,  80),
    'call_bg':         (350,  476,  100,  80),   # callActivity
    'gw_bg':           (375,  606,   50,  50),   # exclusiveGateway
    'task_finance':    (350,  706,  100,  80),
    'gw_salary':       (375,  836,   50,  50),   # exclusiveGateway
    'task_gm':         (350,  966,  100,  80),
    'end':             (382, 1096,   36,  36),
    # 旁路（右侧列，cx=620）
    'end_reject':      (602,  248,   36,  36),   # 与 task_supervisor 同行
    'end_bg_fail':     (602,  613,   36,  36),   # 与 gw_bg 同行
    'task_cfo_sign':   (570,  821,  100,  80),   # 与 gw_salary 同行
}
# 连线折点规则：
# - 主流垂直连线：(cx_src, bottom_src) → (cx_tgt, top_tgt)
# - 手工分支→右侧 endEvent：(right_src, cy_src) → (left_tgt, cy_tgt)  水平
# - exclusiveGateway→右侧：(right_gw, cy_gw) → (left_tgt, cy_tgt)  水平
# - exclusiveGateway→右侧 task 再→主流：L形 (cx_task, bottom_task)→(cx_task, cy_tgt)→(right_tgt, cy_tgt)
```

**节点间距参考（userTask 高 80px，gateway 高 50px，gap=40px）：**
- userTask 底部到下一 userTask 顶部：40px
- userTask 底部到 gateway 顶部：40px
- gateway 底部到下一 userTask 顶部：40px

#### 手工修复布局的完整步骤

> **⛔⛔ 严重禁令（已实测踩坑，导致无效修复）：禁止凭记忆或猜测写节点 ID**
>
> `bpmn_creator.py` 生成的实际节点 ID 与脚本中的变量名往往不同！修复时若直接猜测 ID 写入 `bpmnElement`，Shape/Edge 引用不存在的元素，上传成功但设计器完全错误。
>
> **实测案例（oa_purchase_full_demo）：** `task_direct_mgr`→实为`task_manager`，`task_finance_mgr`→实为`task_finance`，`gw_parallel`→实为`gw_split`，`task_api_callback`→实为`task_api`，`timer_finance_mgr`→实为`timer_task_finance`。第一版修复全部 ID 错误，白费一次完整往返。
>
> **强制：修复前必须先打印所有 sequenceFlow，从中获取真实 ID，再写坐标：**
> ```python
> import re
> for m in re.finditer(r'sequenceFlow[^>]+', xml):
>     s = m.group()
>     fid = re.search(r'\bid=["\'](\S+?)["\']', s)
>     src = re.search(r'sourceRef=["\'](\S+?)["\']', s)
>     tgt = re.search(r'targetRef=["\'](\S+?)["\']', s)
>     if src and tgt:
>         print(f'{fid.group(1)}: {src.group(1)} → {tgt.group(1)}')
> ```
> 同时注意：获取 XML 的字段名是 `processXml`（不是 `bpmnXml`），部署接口是 `PUT /act/process/extActProcess/deployProcess`（body: `{id: process_id}`）。

1. **先从服务器获取当前 XML，备份 process 段**（业务逻辑不动，只改 diagram 段）
2. **打印所有 sequenceFlow 获取真实节点 ID**（见上方代码，禁止跳过此步）
3. **定义 shapes 字典**：`{elem_id: (x, y, w, h)}`，手工为每个节点指定坐标
4. **定义 edges 字典**：`{flow_id: [(x1,y1), (x2,y2), ...]}`，手工为每条连线指定折点
5. **生成新的 BPMNDiagram 段**，替换原有段（`process` 段保持不变）
6. **saveProcess + deployProcess**，再重新执行后处理脚本恢复节点配置和字段权限

#### 已验证的坐标方案（实测 oa_purchase_full_demo，含条件旁路+并行网关+手工分支+定时器）

> **关键规则：条件旁路（如财务审批）、并行分支A、手工分支同意线，统一放到主流上方同一 Y 行（不同 X 段），避免交叉。**

```
上方共用行:  center_y = 120  (task top_y=80)   ← 条件旁路 + 并行A + 手工分支agree
主流水平线:  center_y = 300  (task top_y=260, gw top_y=275, event top_y=282)
下方并行行:  center_y = 480  (task top_y=440)  ← 并行B
定时器绕行:  y_bottom = 560  (深在所有节点下方)
```

节点尺寸：userTask/serviceTask/apiTask/callActivity=100×80，gateway=50×50，start/end=36×36，timerBoundary=36×36。  
节点列间距建议 140px（center to center）。

**连线折点规则（L 形，全部用水平+垂直折线，严禁斜线）：**

| 连线类型 | waypoints |
|---------|-----------|
| 主流水平 | 源节点右边中心 → 目标节点左边中心（同 y=300） |
| 网关→上方旁路/分支 | 网关顶中心 → (网关cx, 120) → 目标左边中心 |
| 网关→下方分支 | 网关底中心 → (网关cx, 480) → 目标左边中心 |
| 上方节点→回主流 | 节点右边中心 → (目标cx, 120) → 目标顶中心 |
| 下方节点→回主流 | 节点右边中心 → (目标cx, 480) → 目标底中心 |
| 手工分支→上方节点 | 源顶中心 → (源cx, 120) → 目标左边中心 |
| 上方节点→end | 节点右边中心 → (end_cx, 120) → end 顶中心 |
| 定时器→end | timer底中心 → (timer_cx, 560) → (end_cx, 560) → end 底中心 |

**模板脚本（`fix_layout.py`）核心结构：**

```python
import sys, json, base64, urllib.request, re

sys.path.insert(0, r'<skill目录>/skills/jeecg-bpmn/scripts')
from bpmn_creator import api_request, deploy_process

# 1. 获取当前 XML
result = ...queryById...
xml_str = base64.b64decode(info['processXml']).decode('utf-8')

# 2. 定义坐标（手工计算）
shapes = {
    'start':       (50,  222, 36, 36),
    'task_xxx':    (130, 200, 100, 80),
    ...
}
edges = {
    'flow_xxx':    [(x1, y1), (x2, y2), ...],
    ...
}

# 3. 生成新 BPMNDiagram 段
def gen_diagram(shapes, edges, process_id):
    parts = [f'<bpmndi:BPMNDiagram id="BPMNDiagram_1">',
             f'<bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="{process_id}">']
    for elem_id, (x, y, w, h) in shapes.items():
        is_exp = ' isExpanded="true"' if elem_id.startswith('call_') else ''
        parts.append(f'<bpmndi:BPMNShape id="shape_{elem_id}" bpmnElement="{elem_id}"{is_exp}>'
                     f'<dc:Bounds x="{x}" y="{y}" width="{w}" height="{h}" /></bpmndi:BPMNShape>')
    for flow_id, waypts in edges.items():
        wp_str = ''.join(f'<di:waypoint x="{x}" y="{y}" />' for x, y in waypts)
        parts.append(f'<bpmndi:BPMNEdge id="edge_{flow_id}" bpmnElement="{flow_id}">'
                     f'{wp_str}</bpmndi:BPMNEdge>')
    parts += ['</bpmndi:BPMNPlane>', '</bpmndi:BPMNDiagram>']
    return ''.join(parts)

# 4. 替换 BPMNDiagram 段（保留 process 段）
diag_start = xml_str.find('<bpmndi:BPMNDiagram')
diag_end   = xml_str.find('</bpmndi:BPMNDiagram>') + len('</bpmndi:BPMNDiagram>')
new_xml = xml_str[:diag_start] + gen_diagram(shapes, edges, 'process_key') + xml_str[diag_end:]

# 5. saveProcess + deployProcess
# ... 然后立即执行后处理脚本恢复节点配置和字段权限
```

---

### 调整已有流程布局（x 坐标平移）

**场景：** 流程在设计器中显示异常（节点被工具栏遮住、节点 x 坐标为负、或想整体平移避开面板）。

**步骤：**
1. `queryById` 取出 base64 后 decode 得到原始 XML
2. 只对 `<bpmndi:BPMNDiagram>` 区段内的 `x="N"` 做替换（避免误改表达式中的数字）
3. `saveProcess` 传回**原始 XML**（不是 base64）
4. `deployProcess` 重新发布

```python
import re, base64
# 定位到布局区段，只改这部分
di_start = xml_str.index('<bpmndi:BPMNDiagram')
head = xml_str[:di_start]
diag = xml_str[di_start:]
# 整体右移 +120px
diag = re.sub(r'x="(-?\d+)"', lambda m: f'x="{int(m.group(1)) + 120}"', diag)
new_xml = head + diag

# saveProcess 参数与 bpmn_creator.py 一致，processDescriptor 传 new_xml（原始 XML）
# 注意：防止多次运行导致重复平移，应先检查最小 x 值，若已 >= 安全阈值则跳过
```

> **防重复平移：** 脚本应记录"已平移"状态或检查当前最小 x（`min_x = min(int(m.group(1)) for m in re.finditer(r'x="(-?\d+)"', diag))`），如果 `min_x >= 50` 则跳过，避免重复运行导致节点越跑越远。

---

## 踩坑记录（oa_new_employee_onboard_process，2026-04-29 实测）

> **⛔ 坑1：DesForm 字段 model 查询 — 不在 `design["fields"]`，在 `design["list"]` 的嵌套节点中**
>
> `GET /desform/queryByIdOrCode` 返回 `desformDesignJson`，解析后 `design["fields"]` 为空列表；字段实际存储在 `design["list"]` 下的 grid/word 布局容器内，需递归遍历才能提取。
>
> **错误写法（fields 永远为空）：**
> ```python
> fields = design.get('fields', [])   # ← 一直是 []，没有字段！
> ```
>
> **正确写法（递归提取叶子字段）：**
> ```python
> def find_fields(node, results):
>     if isinstance(node, dict):
>         if node.get('type') not in ('grid', 'text', '') and node.get('model'):
>             results.append(node)
>         for v in node.values():
>             find_fields(v, results)
>     elif isinstance(node, list):
>         for item in node:
>             find_fields(item, results)
>
> fields = []
> find_fields(design, fields)
> # 按顺序对应到字段名（word 布局下 label 与 model 不在同一层，靠顺序推断）
> # 例：第1个 input → 姓名，第1个 money → 薪资，第1个 select → 背景调查结果
> ```
>
> **后果：** 使用 fallback model 名生成的条件表达式永远不会被 `flowUtil.evaluateExpression` 命中，条件网关失效，流程逻辑错误。
>
> **预防：** 写主脚本前先用一行代码探查实际字段结构：
> ```bash
> python -c "import json,sys; sys.path.insert(0,'.../jeecg-bpmn/scripts'); from bpmn_creator import api_request; r=api_request(..., '/desform/queryByIdOrCode?desformCode=xxx', method='GET'); design=json.loads(r['result']['desformDesignJson']); print(list(design.keys()))"
> ```

---

## 错误处理

| 错误 | 解决方案 |
|------|---------|
| Token 过期（401/认证失败） | 提示用户重新获取 X-Access-Token |
| `流程ID重复` | 重新生成时间戳作为 processkey |
| `不是最新版本` | 先查询最新的 processDefinitionId 再保存 |
| 中文乱码 | 确认使用 Python urllib（不要用 curl） |
| 连接超时 | 确认后端地址可达，检查网络 |

## 数据库配置表

流程创建后，可通过以下数据库表进一步配置节点行为、表单绑定和字段权限：

| 表名 | 说明 | 用途 |
|------|------|------|
| `ext_act_process` | 流程主表 | 流程属性、XML、发起方式、催办/撤回/通知等 |
| `ext_act_process_form` | 表单绑定 | 流程与业务表单关联，标题表达式，表单类型（1=Online/2=DesForm/3=自定义） |
| `ext_act_process_node` | 节点配置 | 每个审批节点的功能开关（编辑/抄送/转办/加签/驳回等） |
| `ext_act_process_node_auth` | 字段权限 | 每个节点上表单字段的显示/隐藏/可编辑/禁用控制 |

详细的字段说明和取值参见 `references/bpmn-db-config.md`。

## 参考文档

- 阅读 `references/bpmn-call-activity.md` 获取调用子流程（callActivity）详细说明
- 阅读 `references/bpmn-manual-branch.md` 获取手工分支（意见分支）详细说明
- 阅读 `references/bpmn-templates.md` 获取参考文件索引（已拆分为 8 个子文件）


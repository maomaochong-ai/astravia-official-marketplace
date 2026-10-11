# 节点 ID 命名与图形布局规则

## ⛔⛔ 三条强制布局规范（每次生成流程必须遵守，违反必须修复）

> 这三条规范来自多次实测踩坑，**不遵守会导致用户明确反馈要求重做**。

| 规范 | 规则 | 详见 |
|------|------|------|
| **单一结束节点** | 每个流程**只允许 1 个 endEvent**，end_approved / end_rejected 等全部合并到 `end` | SKILL.md 规则26 |
| **显式 BPMNLabel** | 有名称的 sequenceFlow 必须在 BPMNEdge 中包含 `<bpmndi:BPMNLabel><dc:Bounds .../>` | SKILL.md 规则27 |
| **结构性网关不加 name** | parallelGateway 全部、inclusiveGateway 汇合节点：**不加 name 属性** | SKILL.md 规则28 |

---

## ⛔ 严重禁令：自动布局的失效场景（已多次实测）

> **凡流程同时包含以下任意两项，禁止使用 `bpmn_creator.py` 自动布局，必须手工计算坐标：**
>
> - 手工分支（userTask 有 2+ 条无条件出线）
> - 条件网关（exclusiveGateway）
> - 调用子流程（callActivity）
> - 多个终止节点（多个 endEvent）
>
> **失效表现：** 节点显示为超大红框、网关尺寸异常、endEvent 悬浮到错误位置、连线大幅交叉重叠。
>
> **强制操作：** 创建脚本中在 `bpmn_xml = bpmn_creator.build_bpmn_xml(config)` 之后，必须立即用手工坐标字典重写 BPMNDiagram 段，禁止直接使用自动生成的布局。
>
> **已知触发案例：** `oa_new_employee_onboard_process`（手工分支+2个exclusiveGateway+callActivity+3个endEvent），自动布局严重失效，事后修复额外耗费时间且需重建所有节点配置和字段权限。

---

## ⛔⛔ 严重禁令：修复现有流程布局时禁止猜测节点 ID（已实测踩坑，导致无效修复）

> **根本原因：** `bpmn_creator.py` 自动生成节点时所用的 ID，与开发者自定义脚本中的假设 ID 往往不同。修复布局时若凭记忆或猜测写入 `bpmnElement`，Shape/Edge 将引用不存在的元素，导致上传成功但设计器看不到节点的"幽灵修复"。
>
> **典型案例（oa_purchase_full_demo）：**
>
> | 脚本中猜测的 ID | XML 中真实的 ID |
> |----------------|----------------|
> | `task_direct_mgr` | `task_manager` |
> | `task_finance_mgr` | `task_finance` |
> | `gw_parallel` | `gw_split` |
> | `task_multi_cand` | `task_multi` |
> | `task_dept_branch` | `task_dept_appr` |
> | `task_call_sub` | `call_sub` |
> | `task_api_callback` | `task_api` |
> | `timer_finance_mgr` | `timer_task_finance` |
>
> 第一版修复脚本全部用错 ID，上传成功、发布成功，但设计器中 BPMNDiagram 完全错误，白费一次往返。
>
> **强制操作顺序（修复布局时必须执行）：**
>
> ```python
> # Step 1：读取当前流程 XML（字段名是 processXml，不是 bpmnXml）
> result = req(f'/act/process/extActProcess/queryById?id={PROCESS_ID}')
> xml = base64.b64decode(result['result']['processXml']).decode('utf-8')
>
> # Step 2：提取所有 sequenceFlow 的 sourceRef/targetRef，建立 ID→连接关系图
> import re
> for m in re.finditer(r'sequenceFlow[^>]+', xml):
>     s = m.group()
>     fid = re.search(r'\bid=["\'](\S+?)["\']', s)
>     src = re.search(r'sourceRef=["\'](\S+?)["\']', s)
>     tgt = re.search(r'targetRef=["\'](\S+?)["\']', s)
>     if src and tgt:
>         print(f'{fid.group(1)}: {src.group(1)} → {tgt.group(1)}')
>
> # Step 3：用真实 ID 构建 BPMNDiagram，再替换、上传、发布
> # ⚠️ 上传字段：processXml（base64编码），部署接口：PUT /act/process/extActProcess/deployProcess
> ```
>
> **一句话规则：先打印所有 sequenceFlow 的 ID，再写坐标，绝不猜测。**

---

## 1. 节点 ID 命名规范

| 节点类型 | ID 前缀 | 示例 |
|----------|---------|------|
| 开始事件 | `start` | `start` |
| 结束事件 | `end` | `end` |
| 用户任务 | `task_` | `task_apply`, `task_manager`, `task_hr` |
| 排他网关 | `gateway_` | `gateway_result`, `gateway_amount` |
| 并行网关 | `pgw_` | `pgw_fork`, `pgw_join` |
| 连线 | `flow_` | `flow_1`, `flow_approve`, `flow_reject` |

## 2. 图形布局计算规则

### 2.1 尺寸常量

| 元素 | 宽度(width) | 高度(height) |
|------|------------|-------------|
| startEvent | 36 | 36 |
| endEvent | 36 | 36 |
| userTask | 100 | 60 |
| exclusiveGateway | 50 | 50 |
| parallelGateway | 50 | 50 |

### 2.2 布局策略 — 垂直主轴

所有节点沿 **垂直方向（Y轴）** 从上到下排列，中心线 X 固定。

**基准参数：**
- 主轴中心 X = `400`（所有节点以此为中心对齐）
  - 必须足够大以避开设计器左侧浮动工具栏（约 50px 宽）。
  - 3 并行分支时最左列 x ≈ CENTER_X - 230；4 分支时最左列 x ≈ CENTER_X - 320。
- 起始 Y = `30`
- 节点间垂直间距 = `40`（节点底部到下一节点顶部的距离）

**计算公式：**

```python
CENTER_X = 400
START_Y = 30
VERTICAL_GAP = 40

# 节点尺寸
SIZES = {
    "startEvent":       {"w": 36, "h": 36},
    "endEvent":         {"w": 36, "h": 36},
    "userTask":         {"w": 100, "h": 60},
    "exclusiveGateway": {"w": 50, "h": 50},
    "parallelGateway":  {"w": 50, "h": 50},
}

def layout_nodes(nodes):
    """计算每个节点的 Bounds (x, y, width, height)"""
    y = START_Y
    positions = []
    for node in nodes:
        size = SIZES[node["type"]]
        x = CENTER_X - size["w"] / 2
        positions.append({
            "id": node["id"],
            "x": x, "y": y,
            "w": size["w"], "h": size["h"],
            "center_x": CENTER_X,
            "center_y": y + size["h"] / 2,
            "bottom_y": y + size["h"]
        })
        y += size["h"] + VERTICAL_GAP
    return positions
```

### 2.3 Shape XML 生成

```xml
<!-- startEvent / endEvent -->
<bpmndi:BPMNShape id="shape_{id}" bpmnElement="{id}">
  <dc:Bounds x="{x}" y="{y}" width="{w}" height="{h}" />
  <bpmndi:BPMNLabel>
    <dc:Bounds x="{x+7}" y="{y+h+7}" width="22" height="14" />
  </bpmndi:BPMNLabel>
</bpmndi:BPMNShape>

<!-- userTask -->
<bpmndi:BPMNShape id="shape_{id}" bpmnElement="{id}">
  <dc:Bounds x="{x}" y="{y}" width="{w}" height="{h}" />
</bpmndi:BPMNShape>

<!-- gateway (isMarkerVisible="true" 用于排他网关) -->
<bpmndi:BPMNShape id="shape_{id}" bpmnElement="{id}" isMarkerVisible="true">
  <dc:Bounds x="{x}" y="{y}" width="{w}" height="{h}" />
  <bpmndi:BPMNLabel>
    <dc:Bounds x="{x+w+10}" y="{center_y-7}" width="44" height="14" />
  </bpmndi:BPMNLabel>
</bpmndi:BPMNShape>
```

### 2.4 Edge XML 生成

**直线连接（垂直方向、上下相邻节点）：**
```xml
<bpmndi:BPMNEdge id="edge_{flow_id}" bpmnElement="{flow_id}">
  <di:waypoint x="{source.center_x}" y="{source.bottom_y}" />
  <di:waypoint x="{target.center_x}" y="{target.y}" />
</bpmndi:BPMNEdge>
```

**分支连线（排他网关的非主路径，从右侧绕行）：**

当网关有拒绝/回退路径需要连接到非相邻节点时，使用右侧绕行：
```xml
<bpmndi:BPMNEdge id="edge_{flow_id}" bpmnElement="{flow_id}">
  <di:waypoint x="{gateway.center_x + 25}" y="{gateway.center_y}" />
  <di:waypoint x="{gateway.center_x + 132}" y="{gateway.center_y}" />
  <di:waypoint x="{gateway.center_x + 132}" y="{target.center_y}" />
  <di:waypoint x="{target.center_x + target.w/2}" y="{target.center_y}" />
</bpmndi:BPMNEdge>
```

**并行分支连线（从左侧出发）：**
```xml
<bpmndi:BPMNEdge id="edge_{flow_id}" bpmnElement="{flow_id}">
  <di:waypoint x="{gateway.center_x - 25}" y="{gateway.center_y}" />
  <di:waypoint x="{target.center_x - target.w/2 - 50}" y="{gateway.center_y}" />
  <di:waypoint x="{target.center_x - target.w/2 - 50}" y="{target.center_y}" />
  <di:waypoint x="{target.center_x - target.w/2}" y="{target.center_y}" />
</bpmndi:BPMNEdge>
```

---

## 3. 复杂混合流程的标准手工坐标模板

> **适用条件：** 流程同时含有「手工分支 + 排他网关 + 并行网关 + callActivity」中任意两项以上。  
> **使用规则：直接套用此模板，不再分析是否可用自动布局，跳过决策推演。**

### 3.1 坐标计算辅助函数

```python
# 复制到创建脚本中，无需改动
def p(x, y, w, h):
    """构建位置字典"""
    return {'x': x, 'y': y, 'w': w, 'h': h,
            'cx': x + w/2, 'cy': y + h/2, 'bottom': y + h}

def edge_xml(flow_id, waypoints, label=None):
    """生成 BPMNEdge XML（手工指定折线坐标）"""
    lines = [f'      <bpmndi:BPMNEdge id="edge_{flow_id}" bpmnElement="{flow_id}">']
    for (wx, wy) in waypoints:
        lines.append(f'        <di:waypoint x="{int(wx)}" y="{int(wy)}" />')
    if label:
        lx, ly = label
        lines.append(f'      <bpmndi:BPMNLabel>'
                     f'<dc:Bounds x="{lx}" y="{ly}" width="60" height="14" /></bpmndi:BPMNLabel>')
    lines.append(f'      </bpmndi:BPMNEdge>')
    return '\n'.join(lines)

def shape_xml(node_id, pos, is_gw=False, is_exclusive=False, is_expanded=False):
    """生成 BPMNShape XML"""
    marker   = ' isMarkerVisible="true"' if is_exclusive else ''
    expanded = ' isExpanded="true"' if is_expanded else ''
    x, y, w, h = pos['x'], pos['y'], pos['w'], pos['h']
    lines = [f'      <bpmndi:BPMNShape id="shape_{node_id}" bpmnElement="{node_id}"{marker}{expanded}>']
    lines.append(f'        <dc:Bounds x="{x}" y="{y}" width="{w}" height="{h}" />')
    if is_gw:
        lines.append(f'        <bpmndi:BPMNLabel>')
        lines.append(f'          <dc:Bounds x="{x+w+8}" y="{y+h/2-7}" width="78" height="14" />')
        lines.append(f'        </bpmndi:BPMNLabel>')
    lines.append(f'      </bpmndi:BPMNShape>')
    return '\n'.join(lines)

def event_shape_xml(node_id, pos):
    """生成 startEvent/endEvent 的 BPMNShape XML（含标签）"""
    x, y, w, h = pos['x'], pos['y'], pos['w'], pos['h']
    return (
        f'      <bpmndi:BPMNShape id="shape_{node_id}" bpmnElement="{node_id}">\n'
        f'        <dc:Bounds x="{x}" y="{y}" width="{w}" height="{h}" />\n'
        f'        <bpmndi:BPMNLabel>'
        f'<dc:Bounds x="{x+7}" y="{y+h+7}" width="22" height="14" /></bpmndi:BPMNLabel>\n'
        f'      </bpmndi:BPMNShape>'
    )
```

### 3.2 标准垂直主轴间距表（CENTER_X=400）

> 节点间距规则：上节点 bottom + 40 = 下节点 top

| 节点类型 | w | h | 占用高度（h+40） |
|----------|---|---|--------------|
| startEvent / endEvent | 36 | 36 | 76 |
| userTask | 100 | 80 | 120 |
| exclusiveGateway / parallelGateway | 50 | 50 | 90 |
| callActivity | 100 | 80 | 120 |
| serviceTask / apiTask | 100 | 80 | 120 |

**起始 Y=30，CENTER_X=400，竖排公式：**
```
start:   y=30,  bottom=66
node1:   y=106, bottom=186  (66+40)
node2:   y=226, bottom=306  (186+40)
node3:   y=346, bottom=426  ...依此类推
gw:      y=466, bottom=516  (排他/并行网关 h=50)
```

### 3.3 标准连线 waypoints 模式速查

| 连接场景 | waypoints |
|---------|-----------|
| 垂直直连（上→下同列） | `[(cx, bot_src), (cx, top_tgt)]` |
| 网关右侧旁路（绕过右列节点） | `[(gw_right, gw_cy), (right_col_cx, gw_cy), (right_col_cx, top_tgt)]` |
| 右列回主列（右→左进入） | `[(right_cx, bot_src), (right_cx, tgt_cy), (main_cx, tgt_cy), (main_cx, top_tgt)]` 或使用 mid_y |
| 并行分叉→左支 | `[(gw_cx, gw_bot), (gw_cx, gw_bot+20), (left_cx, gw_bot+20), (left_cx, top_tgt)]` |
| 并行分叉→右支 | `[(gw_cx, gw_bot), (gw_cx, gw_bot+20), (right_cx, gw_bot+20), (right_cx, top_tgt)]` |
| 左支→汇聚 | `[(left_cx, bot_src), (left_cx, join_cy), (join_left, join_cy)]` |
| 右支→汇聚 | `[(right_cx, bot_src), (right_cx, join_cy), (join_right, join_cy)]` |
| 手工分支→右侧节点（水平） | `[(task_right, task_cy), (next_left, next_cy)]` |
| 手工分支→结束（向下绕行） | `[(task_cx, task_bot), (task_cx, task_bot+60), (end_cx, task_bot+60), (end_cx, end_bot)]` |
| 边界定时器→结束（右侧远端） | `[(timer_right, timer_cy), (far_right, timer_cy), (far_right, end_cy), (end_right, end_cy)]` |

**推荐 far_right 值：** CENTER_X + 490（约 890），足够绕过所有右侧节点。

### 3.4 混合流程完整节点坐标快速计算脚本

需要为复杂流程分配坐标时，运行此脚本代替手动推演：

```python
# 输入节点列表（按流程顺序，不含并行分支子链），自动计算主列坐标
NODES_MAIN = [
    ('start',           'startEvent'),
    ('task_draft',      'userTask'),
    ('task_manager',    'userTask'),
    ('gw_amount',       'exclusiveGateway'),
    ('task_vp',         'userTask'),
    ('gw_split',        'parallelGateway'),
    ('gw_join',         'parallelGateway'),
    ('task_countersign','userTask'),
    # ...
    ('end',             'endEvent'),
]
SIZES = {'startEvent':(36,36), 'endEvent':(36,36),
         'userTask':(100,80), 'exclusiveGateway':(50,50), 'parallelGateway':(50,50),
         'callActivity':(100,80), 'serviceTask':(100,80), 'apiTask':(100,80)}
CENTER_X, GAP = 400, 40
y = 30
for nid, ntype in NODES_MAIN:
    w, h = SIZES[ntype]
    x = CENTER_X - w//2
    print(f"'{nid}': p({x}, {y}, {w}, {h}),  # center=({CENTER_X}, {y+h//2})")
    y += h + GAP

# 并行分支（手动指定左/右列 cx）
PARALLEL_LEFT_CX  = 220   # 主列 cx - 180
PARALLEL_RIGHT_CX = 580   # 主列 cx + 180
# 使用 gw_split 的 bottom+40 作为分支起始 y
```

---

## 4. 已知陷阱与规避

### 4.1 `edit_node_config` 不支持的节点类型

`callActivity`、`serviceTask`、`apiTask` **不在** `extActProcessNode` 表中，调用 `edit_node_config` 会返回「节点未找到」。**直接跳过这些类型，无需配置。**

```python
# 跳过非 userTask 节点，避免报错
SKIP_NODE_TYPES = {'callActivity', 'serviceTask', 'apiTask', 'gateway'}
for node_code, settings in node_cfg_map.items():
    if node_code not in SKIP_NODE_TYPES:
        cfg(node_code, settings)
```

### 4.2 API 路径不可含中文（URL encoding）

查询流程时，**用 `processKey` 替代 `processName`**，避免中文 URL 编码问题：

```python
# ❌ 错误：URL 含中文，urllib 会抛 UnicodeEncodeError
bc.api_request(API_BASE, TOKEN, '/act/process/extActProcess/list?processName=综合采购审批流程', method='GET')

# ✅ 正确：用 processKey（纯 ASCII）
bc.api_request(API_BASE, TOKEN, f'/act/process/extActProcess/list?processKey={PROCESS_KEY}&pageNo=1&pageSize=10', method='GET')
```

### 4.3 手工分支不触发水平布局的写法

若使用 `build_bpmn_xml(config)` 但**不想触发**手工分支水平布局，可在 `expand_config` 之前预先设置一个假的 `_manualBranch` 抑制检测，或直接绕过 `expand_config` 手工组装 XML（推荐）：

```python
# 复杂混合流程：直接手工组装，不调用 build_bpmn_xml
all_nodes_xml = '\n'.join([node_start, node_draft, node_manager, ...])
main_bpmn_xml = f'''{bc.BPMN_HEADER}
  <bpmn2:process id="{PROCESS_KEY}" name="...">
{bc.PROCESS_LISTENERS}
{all_nodes_xml}
{chr(10).join(flows_xml)}
  </bpmn2:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="{PROCESS_KEY}">
{chr(10).join(shapes)}
{chr(10).join(edges)}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>'''
```

### 4.4 手工分支布局中 gateway 节点尺寸 bug（已修复）

**问题**：`calc_layout_manual_branch` 在 chain_nodes / non_end_targets 中把 exclusiveGateway、parallelGateway 等网关节点也按 `MB_TASK_W=100, MB_TASK_H=80` 分配坐标，导致：
- 网关在 BPMN 设计器中呈现为 100×80 的超大菱形（应为 50×50）
- 连线 waypoint 基于错误尺寸计算，出现歪斜
- 网关标签位置偏移（`x+w+10` 基于错误 `w=100`），与相邻节点重叠

**修复**（已于 2026-04-29 在 `bpmn_creator.py` 中修复）：
chain_nodes 和 non_end_targets 循环改为调用 `_get_node_size(node_map[nid])` 取实际尺寸，节点垂直以 `row2_cy` 为中心对齐。

**仍需注意**：水平手工分支布局（`_manualBranch`）不适合含多个 endEvent 的复杂流程——非主 endEvent 会走 fallback 垂直布局，位置仍会错乱。遇此情形仍需手工坐标。

### 4.5 边界定时器的 shape 坐标

`gen_boundary_timer_shape(event_id, task_pos)` 放在节点右下角：
```
timer_x = task_x + task_w/2 + 12
timer_y = task_y + task_h - 18
```
对应的边界边 edge 起点（timer 中心右侧）：
```
ex = timer_x + 36   # timer 右边缘
ey = timer_y + 18   # timer 中心
```

---

## 5. `complex_vertical` 自动布局失效的"绕过路径"模式

### 5.1 失效条件

`_detect_complex_vertical` 能检测到需要竖向布局，但 `calc_layout_complex_vertical` 使用贪心 BFS 深度分配，**当某条 sequenceFlow 跨越中间节点直接连接下游节点时会失效**：

```
gw_salary ──(薪资>15000)──> task_cfo_sign ──> task_ceo
    └──(薪资≤15000)─────────────────────────> task_ceo  ← 绕过路径
```

BFS 给 `task_ceo` 分配深度 = gw_salary 深度+1（via 直连），与 `task_cfo_sign` 相同，导致两节点完全重叠。

**失效触发规则（有任一条即需手工坐标）：**
- 同一节点被多条不同长度路径到达（菱形收敛 + 绕过）
- `exclusiveGateway` 有一条边跳过下方 1+ 个节点直达更下游节点
- 多个 `endEvent` 合并到 1 个（如将 3 个 end_fail 合并为 1 个 end_fail 后拓扑变复杂）

### 5.2 推荐修复方案：混合模式（expand_config + 手工 BPMNDiagram）

**核心思路：** 用 `expand_config` + `build_bpmn_xml` 自动生成**流程定义 XML**（含监听器、条件表达式、会签配置等），只替换 `<bpmndi:BPMNDiagram>` 段为手工坐标。避免手写完整 BPMN XML，不用操心监听器顺序。

```python
import sys, base64
sys.path.insert(0, '<skill目录>/skills/jeecg-bpmn/scripts')
import importlib.util
spec = importlib.util.spec_from_file_location('bc', '.../bpmn_creator.py')
bc = importlib.util.module_from_spec(spec); spec.loader.exec_module(bc)

pcfg = { ... }  # 完整流程配置（nodes/flows/formLink 等）

# Step 1：生成含正确监听器+条件的流程 XML
pcfg_expanded = bc.expand_config(pcfg)
auto_xml = bc.build_bpmn_xml(pcfg_expanded)

# Step 2：截取 <bpmn2:process> 段（不含 BPMNDiagram）
proc_start    = auto_xml.index('<bpmn2:process ')
diagram_start = auto_xml.index('<bpmndi:BPMNDiagram')
defs_header   = auto_xml[:proc_start]
proc_xml      = auto_xml[proc_start:diagram_start].rstrip()

# Step 3：手工构建 BPMNDiagram
def shape(nid, x, y, w, h, is_gateway=False, is_event=False):
    marker = ' isMarkerVisible="true"' if is_gateway else ''
    return (f'      <bpmndi:BPMNShape id="shape_{nid}" bpmnElement="{nid}"{marker}>\n'
            f'        <dc:Bounds x="{x}" y="{y}" width="{w}" height="{h}" />\n'
            f'      </bpmndi:BPMNShape>')

def edge(fid, pts, label_txt=None, lx=None, ly=None):
    lines = [f'      <bpmndi:BPMNEdge id="edge_{fid}" bpmnElement="{fid}">']
    for (px, py) in pts:
        lines.append(f'        <di:waypoint x="{px}" y="{py}" />')
    if label_txt:
        lines.append(f'        <bpmndi:BPMNLabel>'
                     f'<dc:Bounds x="{lx}" y="{ly}" width="80" height="14" /></bpmndi:BPMNLabel>')
    lines.append('      </bpmndi:BPMNEdge>')
    return '\n'.join(lines)

# ... 逐节点定义坐标字典 + edges 列表 ...

PROCESS_KEY = pcfg['processKey']
diagram_xml = f'''<bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="{PROCESS_KEY}">
{shapes_str}
{edges_str}
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>'''

# Step 4：拼装 + 保存 + 发布
new_xml = defs_header + proc_xml + '\n  ' + diagram_xml + '\n</bpmn2:definitions>'
result = bc.save_process(API_BASE, TOKEN, pcfg_expanded, new_xml)
bc.deploy_process(API_BASE, TOKEN, result.get('obj') or PROCESS_ID)
```

### 5.3 `oa_new_employee_onboard_process` 的手工坐标参考

> 主链垂直居中 cx=400，end_fail 右侧 cx=620，三条拒绝线经 x=540 汇入，薪资≤15000 从左侧 x=230 绕过 task_cfo_sign。

| 节点 | x | y | w | h | cy |
|------|---|---|---|---|----|
| start | 382 | 30 | 36 | 36 | 48 |
| task_draft | 350 | 106 | 100 | 80 | 146 |
| task_supervisor | 350 | 226 | 100 | 80 | 266 |
| task_hr | 350 | 346 | 100 | 80 | 386 |
| call_bgcheck | 350 | 466 | 100 | 60 | 496 |
| gw_bgcheck | 375 | 566 | 50 | 50 | 591 |
| task_finance | 350 | 656 | 100 | 80 | 696 |
| gw_salary | 375 | 776 | 50 | 50 | 801 |
| task_cfo_sign | 350 | 866 | 100 | 80 | 906 |
| task_ceo | 350 | 986 | 100 | 80 | 1026 |
| end_success | 382 | 1106 | 36 | 36 | 1124 |
| end_fail | 602 | 573 | 36 | 36 | 591 |

关键连线 waypoints：

| 连线 | waypoints | 说明 |
|------|-----------|------|
| flow_sup_rej（拒绝→end_fail） | `(450,266)→(540,266)→(540,591)→(602,591)` | 右行→向下→进入 |
| flow_bgcheck_fail（不通过→end_fail） | `(425,591)→(602,591)` | 同行直接水平 |
| flow_fin_rej（财务拒绝→end_fail） | `(450,696)→(540,696)→(540,591)→(602,591)` | 右行→向上→进入 |
| flow_salary_low（≤15000 跳过会签） | `(375,801)→(230,801)→(230,1026)→(350,1026)` | 左绕旁路 |

---

## 6. 多分支扇出布局（6+ 条分支从同一网关发出）

### 6.1 设计约束：一个开始节点 + 一个结束节点

> **强制规则：每个流程只允许存在一个 startEvent 和一个 endEvent。**
>
> 多 endEvent 问题表现：设计器中出现大量"悬浮"结束圆，流程图视觉混乱，用户无法判断正常结束路径。
>
> **实测踩坑**：初版生成了 9 个 endEvent（end_a / end_b / end_cd / end_e / end_f / end_small / end_medium / end_detail / end_quick），用户明确反馈"每个流程只允许存在一个开始节点，一个结束节点"后需要重建。
>
> **修复方法**：
> 1. 保留流程定义 XML 不变（不重新运行 bpmn_creator.py）
> 2. 通过字符串替换把所有 `targetRef="end_xxx"` 改为 `targetRef="end"` — **必须用字符串 replace，不能用正则**，因为 flowName 中可能含 `/` 导致 `[^/]*` 截断
> 3. 用正则删除所有旧 endEvent 元素（自闭合 + 完整两种形式）
> 4. 在 `</bpmn2:process>` 前插入单个 `<bpmn2:endEvent id="end" name="结束">` 含全部 incoming refs
> 5. 检查是否已存在时：必须用 `'<bpmn2:endEvent id="end"'` 而非 `'id="end"'`（后者是子串，会误匹配 `id="end_medium"` 等）

```python
# ✅ 正确：直接字符串替换，不受 flow name 中 "/" 影响
OLD_ENDS = {'end_a','end_b','end_cd','end_e','end_f','end_small','end_medium','end_detail','end_quick'}
for old_id in OLD_ENDS:
    xml = xml.replace(f'targetRef="{old_id}"', 'targetRef="end"')

# ✅ 正确：幂等删除，防止二次运行时产生重复 id
xml = re.sub(r'<bpmn2:endEvent[^>]+id="end"[^>]*/>\s*', '', xml)
xml = re.sub(r'<bpmn2:endEvent[^>]+id="end"[^>]*>.*?</bpmn2:endEvent>\s*', '', xml, flags=re.DOTALL)
# 然后再插入新 end event

# ❌ 错误：正则 targetRef 替换，当 flow name 含"/" 时被截断
xml = re.sub(r'<bpmn2:sequenceFlow\b[^/]*/>', fix_target, xml)  # [^/]* 遇到 "/" 停止
```

---

### 6.2 水平 L→R 布局策略（适用于 6 条以上平级分支）

> **触发条件：** 单个网关有 5 条以上出线（如 6 个 apply_type 分支），且各分支深度不一（有的 1 步到终点，有的需要 3-4 步子流程）。
>
> **原因：** 垂直主轴布局在此场景下会把所有分支节点水平堆叠在同一行，严重重叠；水平 L→R 布局每条分支独占一个 y 行，向右延伸，互不干扰。

**布局方案：**

```
主干（左侧，y≈760）：start → task_draft → gw1_type
                                   │
       ┌───────────────────────────┼──────────────────────────────────────────┐
       │ 垂直扇出（x=515 脊柱线）  │                                          │
       ↓                           ↓                          …               ↓
分支A (y=90)：   gw_par_split → task_finance + task_legal → gw_par_join ──→ end
分支B (y=320)：  gw_inc_split → task_large_amount + task_nonormal → gw_inc_join → task_summary ──→ end
分支C/D (y=630)：task_manual  → task_expert + task_direct ──→ end
分支E (y=880)：  task_cs_seq ──→ end
分支F (y=1040)： task_cs_par ──→ end
默认 (y=1220)：  gw2_amount  → task_small / task_medium / task_large → gw3_desc → task_detail ──→ end
                                                                                            ↑
                                                           右侧汇流公路（x=HIGHWAY_X）──────┘
单一结束（右侧中央，y=760）：end
```

**关键参数：**
```python
HIGHWAY_X = 1390   # 所有分支末节点先水平到此列，再垂直到 END_CY
END_CX    = 1460   # end 事件中心 x
END_CY    = 760    # end 事件中心 y（与主干同行）

# gw1_type → 分支：经过脊柱线 x=515 做 L 形路由
def gw1_to_branch(gw1_cx, gw1_cy, spine_x, branch_entry_x, branch_cy):
    return [(gw1_cx+25, gw1_cy), (spine_x, gw1_cy), (spine_x, branch_cy), (branch_entry_x, branch_cy)]

# 所有末节点 → end：经过公路
def to_end(src_right_x, src_cy, highway_x, end_cx, end_cy):
    return [(src_right_x, src_cy), (highway_x, src_cy), (highway_x, end_cy), (end_cx-18, end_cy)]
```

---

### 6.3 多分支水平布局的行间距规则（防止重叠）

> **实测踩坑**：分支 B 的 task_nonormal（y=395）与分支 C/D 的 task_expert（y=495）同在 x=820 列，底边到顶边仅 20px，视觉上严重重叠。

**规则：相邻分支中，同 x 列的任意两个任务框，底边到顶边间距 ≥ 80px（建议 100px）。**

```python
# 任务框高度 80px，则分支行间距计算：
# 上方分支最低任务的 cy_max + 40（半高）→ 下方分支最高任务的 cy_min - 40（半高）≥ 80
# 即：cy_min_lower - cy_max_upper ≥ 160px（两个任务中心之间）

# 行间距参考：
# A 行最低任务 cy=150（bottom=190）→ B 行最高任务 cy=265（top=225）：gap=35px ✓（实测可接受）
# B 行最低任务 cy=395（bottom=435）→ C/D 行最高任务 cy=575（top=535）：gap=100px ✓✓ 安全
# C/D 行最低任务（bottom=755）→ E 行最高任务（top=840）：gap=85px ✓

# 经验值：两个相邻有子任务的分支行，主体高度差 ≥ 250px
```

---

### 6.4 边界定时器位置：必须中心点在任务框边缘（不能悬浮）

> **实测踩坑**：将定时器边界事件放在任务框边界之外（如 cx=885, cy=1175，而任务框右边界为 x=880），会导致设计器显示定时器悬浮、与任务无视觉连接（"连线存在间隔，没连上"）。

**强制规则：** 边界事件的圆心坐标必须落在宿主任务框的边界线上。

```python
# task_medium: center=(820, 1300), size=120×80
# bounds: x=[760,880], y=[1260,1340]

# ✅ 正确：放在底边中心（center on bottom edge）
BEV_CX = 820   # 底边中心 x = task_cx
BEV_CY = 1340  # 底边 y = task_cy + task_h/2 = 1300 + 40 = 1340

# ✅ 或放在右边中心（center on right edge）
BEV_CX = 880   # 右边 x = task_cx + task_w/2 = 820 + 60
BEV_CY = 1300  # 右边中心 y = task_cy

# ❌ 错误：偏移到任务框外部（center beyond edge）
BEV_CX = 885   # 880+5，超出右边界，视觉上脱离任务框
BEV_CY = 1175  # 也不在任务框范围内
```

**定时器流线路由（从底边出发向右到公路）：**
```python
# 底边出发：从 (BEV_CX+18, BEV_CY) 向右
timer_flow_pts = [(BEV_CX + 18, BEV_CY), (HIGHWAY_X, BEV_CY), (HIGHWAY_X, END_CY), (END_CX-18, END_CY)]
```

---

### 6.5 包含网关默认流线（绕过中间任务节点）

> **实测踩坑**：包含网关（inclusiveGateway）的 default 流从 gw_inc_split 直达 gw_inc_join，若路由经过任务节点所占的 y 区间，会穿越任务框，视觉混乱。

**规则：默认流线必须绕行至两侧任务框的外部。**

```python
# gw_inc_split (620, 320) → gw_inc_join (1020, 320)，绕过中间的 task_large_amount(y=265) 和 task_nonormal(y=395)
# task_nonormal bottom = 395+40 = 435 → 绕行 y=490（低于 435）

BELOW_Y = 490  # 低于 B 分支所有任务的底边
inclusive_default_flow = [
    (gw_inc_split_cx + 25, gw_inc_split_cy),  # 出网关右侧
    (gw_inc_split_cx + 25, BELOW_Y),           # 向下绕到任务框下方
    (HIGHWAY_X - 20,       BELOW_Y),           # 向右（公路左侧 20px，避免压线）
    (HIGHWAY_X - 20,       gw_inc_join_cy),    # 向上进入 join 位置
    (gw_inc_join_cx - 25,  gw_inc_join_cy),    # 进入 join 左侧
]
```

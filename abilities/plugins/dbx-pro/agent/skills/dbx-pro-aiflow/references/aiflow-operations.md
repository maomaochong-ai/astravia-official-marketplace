# AIFlow 流程操作参考

除创建流程外的所有操作指南。

---

## 编辑已有流程

### 总体步骤

```
init-work（初始化 + 自动导出） → 编辑 design.json → submit（提交）
```

### Step 1：初始化工作目录并导出流程

```bash
python "<skill目录>/scripts/aiflow_creator.py" init-work \
  --name "流程名称" \
  --api-base "<api_base>" \
  --token "<token>" \
  --flow-id "<flow_id>"
```

传入 `--flow-id` 时，脚本自动校验 token 有效性、查询流程并将 design.json 导出到工作目录，同时更新 meta.json 中的 name 和 descr。

返回 `workId` + `nodes`（含 `{id, type, startLine, endLine}`），用于后续操作中定位节点。

> 如需单独导出（如更换 flow-id），仍可使用 `export -w <workId> --flow-id <newId>`。

### Step 2：执行编辑操作

根据用户需求，执行以下一种或多种操作：

---

#### 操作 A：新增节点

通过脚本生成新节点，不要手写节点 JSON：

```bash
python "<skill目录>/scripts/aiflow_creator.py" add-node \
  -w "<workId>" \
  --type llm \
  --after "746790001"
```

**脚本做什么**：从权威模板创建新节点（完整结构 + Snowflake ID），插入到 `--after` 节点之后，自动右移下游节点坐标（水平方向）。如果插入的是 loop 类型，会自动创建 loopBody 节点和 loop→loopBody 连接边。

**脚本不做什么**：不处理连线 edges（loop→loopBody 的联动边除外），不填写业务配置，不调整竖向坐标。

**竖向坐标**：脚本生成的新节点 y 值与 after 节点相同。如果在分支场景下需要竖向偏移（如 switch 的多个下游节点），需要手动用 Edit 调整 y 坐标。布局常量：节点宽度 332px、基准高度 62px、水平间距 400px、竖向间距 ≥ 180px。

**AI 接下来的步骤**：
1. Read 读取更新后的 JSON
2. Edit 编辑新节点的 `properties.options`（查阅 node-reference.md）
3. Edit 编辑 `edges` 数组，添加新节点的连线

**连线示例 — 线性插入**（在 A→C 之间插入 B）：

原有 edges 中找到 A→C 的边，改为 A→B，再添加 B→C：
```json
// 修改前
{"sourceNodeId": "A", "targetNodeId": "C", "sourceAnchorId": "A_output", "targetAnchorId": "C_input", "type": "base-edge"}

// 修改后（把上面那条的 target 改为 B）
{"sourceNodeId": "A", "targetNodeId": "B", "sourceAnchorId": "A_output", "targetAnchorId": "B_input", "type": "base-edge"}
// 新增一条 B→C
{"sourceNodeId": "B", "targetNodeId": "C", "sourceAnchorId": "B_output", "targetAnchorId": "C_input", "type": "base-edge"}
```

**连线示例 — 分支引出**（从 switch 节点引出新分支到 B）：

只需添加一条新边，sourceAnchorId 使用分支专用锚点（不是 `_output`）：
```json
{"sourceNodeId": "switch_id", "targetNodeId": "B", "sourceAnchorId": "switch_id_case_2", "targetAnchorId": "B_input", "type": "base-edge"}
```

---

#### 操作 B：删除节点

通过脚本删除，不要手动从 JSON 中移除：

```bash
python "<skill目录>/scripts/aiflow_creator.py" remove-node \
  -w "<workId>" \
  --node-id "746790002"
```

**脚本做什么**：从 nodes 中移除该节点，移除所有引用该节点的 edges，左移后续节点坐标填补空位。如果删除的是 loop 或 loopBody 节点，会级联删除对方及其内部子节点。

**脚本不做什么**：不创建新的连线。

**AI 接下来的步骤**：
1. Read 读取更新后的 JSON
2. 检查返回的 `remainingNodes` 确认删除正确
3. Edit 编辑 `edges`，根据业务逻辑补充必要的连线

**连线示例 — 删除中间节点**（原 A→B→C，删除 B 后需补 A→C）：

脚本已删除 A→B 和 B→C 两条边，AI 需要添加 A→C：
```json
{"sourceNodeId": "A", "targetNodeId": "C", "sourceAnchorId": "A_output", "targetAnchorId": "C_input", "type": "base-edge"}
```

**连线示例 — 删除分支末端节点**（从 switch 引出的末端节点）：

脚本已删除 switch→B 的边，通常不需要补充新连线。但如果该分支还有后续节点，需要将 switch 直接连到后续节点。

---

#### 操作 C：修改节点配置

直接用 Edit 工具修改 design JSON 中对应节点的 `properties.options`。

**如何定位节点**：在 export 返回的 `nodes` 中找到目标节点的 ID 和 `startLine/endLine`，然后用行号范围直接定位到 design.json 中对应的节点对象。

**示例**：将 llm 节点的系统提示词改为"你是一个客服助手"：

```json
// 在 JSON 中找到 id 为 "746790002" 的节点
// 修改 properties.options.messages[0].content
// 先在 inputParams 中绑定：
"inputParams": [
  {"field": "content", "name": "用户问题", "nodeId": "start-node", "type": "string"}
]

// 然后在 messages 中用 name 引用：
"messages": [
  {"role": "system", "content": "你是一个客服助手，请友好、专业地回答用户问题。"},
  {"role": "user", "content": "{{用户问题}}"}
]
```

具体字段说明见 `references/node-reference.md`，按 SKILL.md 中的索引表 Read 对应片段。

---

#### 操作 D：修改连线

用 Edit 工具编辑 `design.edges` 数组。

**普通边格式**（贝塞尔曲线，大多数情况）— 必须带 anchorId：
```json
{"sourceNodeId": "源节点ID", "targetNodeId": "目标节点ID", "sourceAnchorId": "源节点ID_output", "targetAnchorId": "目标节点ID_input", "type": "base-edge"}
```

**分支节点的出边** — sourceAnchorId 使用专用锚点（不是 `_output`），targetAnchorId 仍为 `_input`：

| 节点类型 | sourceAnchorId 格式 | 说明 |
|---------|-------------------|------|
| switch | `{nodeId}_source_if` | 第一个 IF 分支 |
| switch | `{nodeId}_case_{n}` | 第 n 个 ELIF 分支（n≥2） |
| switch | `{nodeId}_source_else` | ELSE 分支 |
| classifier | `{nodeId}_case_{n}` | 第 n 个分类分支（n≥1） |
| classifier | `{nodeId}_case_else` | ELSE 分支 |
| varExtract | `{nodeId}_success` | 提取成功分支 |
| varExtract | `{nodeId}_fail` | 提取失败分支 |

**分支边示例**：
```json
{"sourceNodeId": "sw_1", "targetNodeId": "llm_1", "sourceAnchorId": "sw_1_source_if", "targetAnchorId": "llm_1_input", "type": "base-edge"},
{"sourceNodeId": "sw_1", "targetNodeId": "llm_2", "sourceAnchorId": "sw_1_source_else", "targetAnchorId": "llm_2_input", "type": "base-edge"}
```

**循环体内的边**：loopBody→第一个子节点使用 `base-line-edge`（直线）：
```json
{"sourceNodeId": "bodyId", "targetNodeId": "子节点ID", "sourceAnchorId": "bodyId_loop_start", "targetAnchorId": "子节点ID_input", "type": "base-line-edge"}
```
循环体内子节点之间的边使用普通 `base-edge`。循环体内最后一个子节点**不需要**连回 loopBody（否则会导致 chain 生成死循环）。

---

### Step 3：提交保存

```bash
python "<skill目录>/scripts/aiflow_creator.py" submit -w "<workId>"
```

脚本自动从工作目录读取所有信息，完成：校验 → 生成 chain → 保存设计。校验不通过会返回错误列表，修改 design.json 后重新提交。

---

### 编辑流程端到端示例

用户说："在知识库问答流程的 knowledge 和 llm 之间加一个代码节点做数据清洗，然后把 llm 的提示词改一下"

**Step 1** — 初始化 + 导出：
```bash
python aiflow_creator.py init-work --name "知识库问答" --api-base ... --token ... --flow-id "1234567890"
```
返回 workId + nodes：`[{"id":"start-node","type":"start","startLine":4,"endLine":30}, {"id":"746790001","type":"knowledge","startLine":31,"endLine":58}, ...]`

**Step 2a** — 在 knowledge 之后插入 code 节点：
```bash
python aiflow_creator.py add-node -w "<workId>" --type code --after "746790001"
```
返回 newNodeId: `"746790004"`

**Step 2b** — Read JSON，编辑：
- 编辑 code 节点的 `options.code`（写入清洗脚本）
- 修改 edges：原 `knowledge→llm` 改为 `knowledge→code`，新增 `code→llm`
- 修改 llm 节点的 `messages[0].content`（更新提示词）

**Step 3** — 提交：
```bash
python aiflow_creator.py submit -w "<workId>"
```

---

## 查询流程列表

```python
from aiflow_apis import list_flows
result = list_flows(page=1, size=10, keyword="关键词")
# result['result']['records'] 是流程列表
```

## 查询流程详情

```python
from aiflow_apis import query_flow_by_id
result = query_flow_by_id(flow_id)
# result['result']['design'] 是 JSON 字符串，需要 json.loads() 解析
```

一般不需要手动调用——使用 `export` 命令一步完成查询+导出。

## 删除流程

```python
from aiflow_apis import delete_flow, delete_flows_batch
delete_flow(flow_id)                           # 单个删除
delete_flows_batch(["id1", "id2", "id3"])      # 批量删除
```

## 复制流程

```python
from aiflow_apis import copy_flow
result = copy_flow(flow_id, name="新名称")
# result['result'] 是新流程的 ID
```

## 发布 / 取消发布

```python
from aiflow_apis import release_flow, unrelease_flow
release_flow(flow_id)        # 发布（状态 → release）
unrelease_flow(flow_id)      # 取消发布（状态 → enable）
```

状态：`enable`(可编辑) / `disable`(禁用) / `release`(已发布)

## 调试运行

```python
from aiflow_apis import run_flow, run_flow_plugin
run_flow(flow_id, input_params={"content": "你好"}, response_mode="blocking")
run_flow_plugin(flow_id, input_params={"content": "你好"})  # 插件模式，JSON同步返回
```

## 查询子流程

```python
from aiflow_apis import list_subflows, query_subflow_by_id
list_subflows(page=1, size=10)
query_subflow_by_id(sub_flow_id)  # 含 inputParams/outputParams/endOutputType
```

---

## 端到端示例

用户说："做一个简单的 AI 对话流程，用大模型回答用户问题"

**Step 1** — 初始化工作目录：
```bash
python "<skill目录>/scripts/aiflow_creator.py" init-work \
  --name "AI对话" --api-base "<api_base>" --token "<token>"
```
返回 `workId`（后续所有命令都用这个 ID）。

**Step 2** — 确定节点：`start → llm → end`

**Step 3** — 展示摘要，用户确认

**Step 4** — 生成模板：
```bash
python "<skill目录>/scripts/aiflow_creator.py" generate -w "<workId>" --types "start,llm,end"
```

**Step 5** — 用 Read 读取工作目录下的 `design.json`，用 Edit 编辑：
- `llm` 节点：设置 `model.modeId`（取 value）和 `model.params.model`（取 text）（可通过 `query --resource models` 查询）、编写系统提示词
- `llm` 节点：在 `inputParams` 中绑定 start 的输入，`messages[1].content` 设为 `{{用户问题}}`
- `end` 节点：在 `outputParams` 中绑定 llm 输出，设置 `outputContent: "{{回复内容}}"`
- 添加 edges（每条边带 id、anchorId、pointsList、properties）。`base-edge` 的 pointsList 必须恰好 4 个点，`base-line-edge` 的 pointsList 必须为空数组 `[]`，详见 SKILL.md 的连线规范
- 设置坐标

**Step 6** — 提交保存：
```bash
python "<skill目录>/scripts/aiflow_creator.py" submit -w "<workId>"
```

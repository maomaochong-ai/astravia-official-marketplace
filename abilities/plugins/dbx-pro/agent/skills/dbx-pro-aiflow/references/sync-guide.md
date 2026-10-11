# AIFlow 节点同步指南

> **本文档仅在用户要求"同步节点配置"、"更新节点"、"同步前端/后端变更"等操作时才需要阅读。**
> 正常的创建/编辑流程不需要阅读此文档。

---

## 前置条件

执行同步前需要用户提供以下路径：

| 路径 | 说明 | 示例 |
|------|------|------|
| 前端源码 | Vue3 项目中 AIFlow 节点目录 | `E:\Projects\BJGJ\jeecgboot-vue3\src\views\super\airag\aiflow\` |
| 后端源码 | Java 模块中 flow 组件目录 | `E:\Projects\BJGJ\JeecgBoot\...\jeecg-boot-module-airag-flow\` |

如果用户没有提供，主动询问。

---

## 源码结构映射

### 前端 → 本 skill 的映射关系

```
前端 nodes/{node-type}-node/          →  skill scripts/nodes/{nodeType}/
  index.ts                             →  __init__.py (create_node, validate_node, upgrade_node)
  {Type}Setting.vue                    →  参考来源（配置字段、校验逻辑）
  const.ts / utils.ts                  →  参考来源（锚点、分支逻辑）

前端 types/types.ts → NodeTypes 枚举   →  skill scripts/nodes/ 目录名 + generate_chain.py NodeTypes

前端 lib/logicflow-liteflow/           →  skill scripts/generate_chain.py
                                          （详见本文档「场景 E：chain 生成逻辑变更」）
```

### 前端节点命名转换规则

前端目录用 kebab-case，skill 用 camelCase：

| 前端目录名 | skill 节点 type |
|-----------|----------------|
| `llm-node` | `llm` |
| `switch-node` | `switch` |
| `var-extract-node` | `varExtract` |
| `chat-var-get-node` | `chatVarGet` |
| `knowledge-write-node` | `knowledgeWrite` |
| `sys-get-userinfo-node` | `sysGetUserinfo` |
| `loop-node/break-node` | `loopBreak` |
| `loop-node/continue-node` | `loopContinue` |
| `loop-node/body-node` | `loopBody` |
| `loop-node/set-loop-var-node` | `setLoopVar` |

### 后端节点组件映射

```
后端 component/{Type}Node.java         →  后端运行时逻辑（用于理解字段含义）
后端 FlowConsts.java                    →  常量定义
```

---

## 同步场景与操作步骤

### 场景 A：新增节点类型

当前端新增了一个节点类型时：

**1. 识别新节点**

```
对比前端 types/types.ts 中的 NodeTypes 枚举与 skill scripts/nodes/ 下的目录列表。
新增的枚举值 = 需要创建的节点。
```

**2. 创建节点模块**

在 `scripts/nodes/` 下创建新目录（用 camelCase 命名），包含两个文件：

`template.json` — 从前端 `index.ts` 的 `defaultData` 或 `initOptions` 提取：
```json
{
  "type": "<nodeType>",
  "properties": {
    "text": "<中文标签>",
    "remarks": "",
    "options": { ... },
    "inputParams": [],
    "outputParams": [...]
  }
}
```

提取要点：
- `type` → 前端 `index.ts` 中 `type: NodeTypes.XXX` 对应的字符串值
- `text` → 前端 `index.ts` 中 `label` 字段
- `options` → 前端 `{Type}Setting.vue` 中的响应式变量初始值，或 `index.ts` 的 `initOptions`
- `inputParams` / `outputParams` → 前端 `index.ts` 中 `defaultData.properties.inputParams/outputParams`
- 如有 `_idPrefix`（如 code 节点的 `code_`），加上 `"_idPrefix": "code_"`

`__init__.py` — 标准三函数：
```python
import os
from .._base import create_node_from_template

_DIR = os.path.dirname(os.path.abspath(__file__))

def create_node(node_id: str, x: int, y: int) -> dict:
    return create_node_from_template(_DIR, node_id, x, y)

def validate_node(node: dict, prefix: str) -> list:
    errors = []
    # 从前端 index.ts 的 checkNode 或 Setting.vue 中提取校验逻辑
    return errors

def upgrade_node(node: dict):
    # 从前端 index.ts 的 updateNodeSetting 函数中提取迁移逻辑
    # 新节点首次创建时此函数通常为空（pass），但如果前端已有迁移代码则需同步
    pass
```

**3. 检查前端 updateNodeSetting**

新节点的 `index.ts` 中如果 `updateNodeSetting` 不只是 `mergeIOParams()`，而是还有 `updateOption` 或手动补字段的逻辑，说明该节点经历过参数变更，需要把这些迁移逻辑同步到 `upgrade_node`（参见场景 F 的详细说明）。

**4. 更新参考文档**

- `references/node-reference.md` — 新增该节点的 options 字段表、inputParams、outputParams、校验规则、特殊行为
- `SKILL.md` 节点类型速查表 — 新增一行

**4. 更新 chain 生成器（如需要）**

如果新节点是分支类型（像 switch/classifier 有多个出边）或分组类型（像 loop）：
- 更新 `scripts/generate_chain.py` 中的 `NodeTypes`
- 按需更新 `CUSTOM_SWITCH_NODES`、`build_anchor_next_ids_map`
- 参照场景 E 中的源码映射表对照前端源文件

**5. 验证**

```bash
cd scripts
python -c "from nodes import get_available_types; print(get_available_types())"
python -c "from nodes import create_node; import json; print(json.dumps(create_node('<type>', 'test_id', 200, 300), ensure_ascii=False, indent=2))"
```

---

### 场景 B：节点参数变更

当前端某个节点的配置字段发生增删改时：

**1. 定位变更**

对比前端 `nodes/{type}-node/index.ts` 和 `{Type}Setting.vue` 的 diff，识别：
- 新增字段 → template.json 中加默认值 + node-reference.md 加描述
- 删除字段 → template.json 中移除 + node-reference.md 移除
- 默认值变更 → template.json 中更新
- 可选值变更 → node-reference.md 中更新

**2. 更新 template.json**

只改 `properties.options` 中的对应字段，不要触碰 type、text 等结构字段。

**3. 同步 updateNodeSetting → upgrade_node**

前端每个节点的 `index.ts` 中都有 `updateNodeSetting` 函数，它在加载老流程数据时被调用，负责将老数据迁移为新格式。**必须检查该函数是否有变更，并同步到 Python 的 `upgrade_node`。**

前端 `updateNodeSetting` 的常见操作及其 Python 对应写法：

| 前端操作 | 含义 | Python upgrade_node 写法 |
|---------|------|------------------------|
| `mergeIOParams()` | 将新版 template 中新增的 inputParams/outputParams 合并到老数据 | 见下方通用工具函数 |
| `updateOption('fieldName', v => typeof v !== 'boolean')` | 老数据缺少该字段时用 template 默认值补齐 | `if "fieldName" not in opts: opts["fieldName"] = <默认值>` |
| `updateOption('fieldName', v => !Array.isArray(v))` | 同上，字段应为数组 | `if not isinstance(opts.get("fieldName"), list): opts["fieldName"] = []` |
| 直接赋值 `options.xxx = yyy` | 无条件修复老数据 | `opts["xxx"] = yyy` |
| 字段重命名 `importParams → inputParams` | 兼容老字段名 | `if "oldKey" in opts: opts["newKey"] = opts.pop("oldKey")` |

**示例：同步 llm 节点的 updateNodeSetting**

前端代码：
```typescript
function updateNodeSetting(node) {
  const {mergeIOParams, updateOption} = useUpdateSettings(node, getDefProp);
  mergeIOParams();
  updateOption('showToolExecution', v => typeof v !== 'boolean');
  updateOption('structuredOutput', v => typeof v !== 'boolean');
  updateOption('structuredOutputFields', v => !Array.isArray(v));
}
```

对应的 Python `upgrade_node`：
```python
def upgrade_node(node: dict):
    opts = node.get("properties", {}).get("options", {})
    if "showToolExecution" not in opts:
        opts["showToolExecution"] = False
    if "structuredOutput" not in opts:
        opts["structuredOutput"] = False
    if not isinstance(opts.get("structuredOutputFields"), list):
        opts["structuredOutputFields"] = []
```

**4. 更新校验逻辑**

如果前端 `checkNode` 函数有变更，同步到 `__init__.py` 的 `validate_node`。

**5. 更新参考文档**

更新 `references/node-reference.md` 中对应节点的字段表。

---

### 场景 C：节点更名

当前端节点的 `label`（中文显示名）变更时：

**1. 更新 template.json**

修改 `properties.text` 字段。

**2. 更新 SKILL.md**

修改节点类型速查表中的「标签」列。

**3. 更新 node-reference.md**

修改章节标题 `## {type} — {新标签}节点`。

> 注意：节点的 `type`（编程名）一般不会变。如果 type 也变了，这等同于「删除旧节点 + 新增新节点」，按场景 A 处理。

---

### 场景 D：节点校验逻辑变更

**1. 定位变更**

对比前端 `index.ts` 中 `checkNode` 函数和 `components/WorkflowView.vue` 中 `checkIOParamsProblems` 的 diff。

**2. 分类变更**

- 节点自身校验（checkNode）→ 更新 `scripts/nodes/{type}/__init__.py` 的 `validate_node`
- 公共参数校验（checkIOParamsProblems）→ 更新 `scripts/aiflow_utils.py` 的 `_validate_params_refs`
- 全局结构校验（validateData）→ 更新 `scripts/aiflow_utils.py` 的 `validate_design`

**3. 更新参考文档**

更新 `references/node-reference.md` 中对应节点的校验规则表。

---

### 场景 E：chain 生成逻辑变更

**前端源码位置**：`{前端根目录}/lib/logicflow-liteflow/`

**Python ↔ TypeScript 源码映射表**：

| Python 类/函数 | 前端源文件 | 说明 |
|---------------|-----------|------|
| `ELType` | `lib/logicflow-liteflow/type/ELType.ts` → `enum ELType` | EL 节点类型枚举 |
| `GroupType` | `lib/logicflow-liteflow/type/ELType.ts` → `enum GroupType` | 分组类型枚举 |
| `ELNode` | `lib/logicflow-liteflow/type/ELNode.ts` → `class ELNode` | EL 节点类，包含 EL 表达式生成 |
| `ELStack` | `lib/logicflow-liteflow/ELStack.ts` → `class ELStack` | 栈结构，管理解析环境 |
| `MyContext` | `lib/logicflow-liteflow/MyContext.ts` → `class MyContext` | 上下文，管理节点映射和边关系 |
| `MyParse` | `lib/logicflow-liteflow/MyParse.ts` → `class MyParse` | 主解析器，图→EL 转换 |
| `switch_get_case_list` | `nodes/switch-node/utils.ts` → `getCaseList` | Switch 节点的分支列表 |
| `switch_get_anchor_id` | `nodes/switch-node/utils.ts` → `getAnchorId` | Switch 节点的锚点 ID |
| `classifier_get_case_list` | `nodes/classifier-node/utils.ts` → `getCaseList` | 分类器节点的分支列表 |
| `classifier_get_anchor_id` | `nodes/classifier-node/utils.ts` → `getAnchorId` | 分类器节点的锚点 ID |
| `var_extract_get_anchor_id` | `nodes/var-extract-node/utils.ts` → `getAnchorId` | 变量提取器的锚点 ID |
| `build_anchor_next_ids_map` | `components/WorkflowView.vue` → `validateData` 中的锚点映射构建逻辑 | 构建锚点→后继节点映射 |
| `preprocess_loop_nodes` | `components/WorkflowView.vue` → `getLiteFlowData` 中的循环节点预处理逻辑 | 将循环体内部节点打包到 loop.flowData |

**同步步骤**：

1. `git diff` 检查上述前端源文件是否有改动
2. 对照映射表，将 TypeScript 变更翻译到 `scripts/generate_chain.py` 对应的 Python 类/函数
3. 重点关注：新增节点类型 → 更新 `NodeTypes`、`CUSTOM_SWITCH_NODES`、`_type_format`；EL 表达式逻辑 → 更新 `ELNode.get_el_string_raw` 及其子方法；新分支节点 → 更新 `_handle_switch_node` 和 `build_anchor_next_ids_map`

---

### 场景 F：节点数据格式升级（upgrade_node 与前端 updateNodeSetting 的关系）

**背景**：前端的每个节点 `index.ts` 中都有一个 `updateNodeSetting(node)` 函数。当用户打开一个老流程时，前端会对每个节点调用此函数，将老数据迁移到新格式。Python 的 `upgrade_node` 是它的对应物——当脚本处理（校验/提交）老流程数据时执行同样的迁移。

**前端 updateNodeSetting 的两个核心操作**：

1. **`mergeIOParams()`** — 将当前版本 template 中新增的 inputParams/outputParams 合并到老节点数据中（按 `field + nodeId` 去重，不覆盖已有项）
2. **`updateOption(key, checkFn)`** — 如果老数据中某个 options 字段不存在或类型不对，用 template 默认值补齐

**Python upgrade_node 的实现模式**：

```python
def upgrade_node(node: dict):
    props = node.get("properties", {})
    opts = props.get("options", {})

    # ── 对应 mergeIOParams：补齐新增的 inputParams/outputParams ──
    # 从 template.json 加载默认值
    from .._base import load_template
    tpl = load_template(os.path.dirname(__file__))
    tpl_props = tpl.get("properties", {})

    # 合并 inputParams（按 field+nodeId 去重）
    existing_keys = {(p.get("field","") + "_" + p.get("nodeId","")) for p in props.get("inputParams", [])}
    for p in tpl_props.get("inputParams", []):
        key = p.get("field","") + "_" + p.get("nodeId","")
        if key not in existing_keys:
            props.setdefault("inputParams", []).append(p)

    # 合并 outputParams（按 field 去重）
    existing_fields = {p.get("field","") for p in props.get("outputParams", [])}
    for p in tpl_props.get("outputParams", []):
        if p.get("field","") not in existing_fields:
            props.setdefault("outputParams", []).append(p)

    # ── 对应 updateOption：补齐新增的 options 字段 ──
    # 示例：新增了 showToolExecution 字段
    if "showToolExecution" not in opts:
        opts["showToolExecution"] = False

    # ── 字段重命名 ──
    # 示例：cronTrigger.importParams → cronTrigger.inputParams
    cron = opts.get("cronTrigger", {})
    if "importParams" in cron and "inputParams" not in cron:
        cron["inputParams"] = cron.pop("importParams")
```

**何时需要更新 upgrade_node**：

在执行场景 B（参数变更）时，**必须同时检查前端对应节点的 `updateNodeSetting` 函数是否有新增/变更的迁移逻辑**。如果有，同步到 Python 的 `upgrade_node`。

**升级调用时机**：

`aiflow_utils.py` 的 `validate_design` 在校验步骤 0 中已自动调用各节点的 `upgrade_node`，确保老流程数据在校验前完成迁移。

---

## 同步检查清单

完成同步后，依次确认：

- [ ] `scripts/nodes/` 目录数量与前端 `NodeTypes` 枚举一致
- [ ] 每个节点的 `template.json` 与前端 `defaultData` 一致
- [ ] 每个有自定义校验的节点，`validate_node` 与前端 `checkNode` 逻辑一致
- [ ] 每个节点的 `upgrade_node` 与前端 `updateNodeSetting` 逻辑一致
- [ ] `node-reference.md` 的字段表与前端 Setting.vue 一致
- [ ] `generate_chain.py` 的 `NodeTypes` 与前端一致
- [ ] 如有分支/分组节点变更，chain 生成逻辑已同步
- [ ] SKILL.md 节点类型速查表已更新
- [ ] 运行 `python -c "from nodes import get_available_types; print(get_available_types())"` 无报错
- [ ] 构造一个包含新/改节点的测试流程，`validate_design` 无误报

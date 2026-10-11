### Step 6: 节点字段权限配置（可选）

> **⛔ 严重坑（已实测）：saveOrUpdateBatch 必须在 deploy_process 之后调用！**
>
> `deploy_process` 发布时会清空/重建节点的权限记录。如果在 deploy 之前调用 `saveOrUpdateBatch` 保存字段权限，deploy 会把这些权限记录清掉，导致权限配置丢失。
>
> 另外，`formEditStatus=1`（节点可编辑）需要重新发布才能激活——deploy 是必须的，不可跳过。
> **已知现象：** 后台"字段权限"页面显示正确（数据库有记录），但走审批表单时权限不生效。根因是权限记录被 deploy 清除了。手动在页面重新点一次保存（仅调 saveOrUpdateBatch，不触发 deploy）即可恢复。

> **⛔ 严重坑（已实测）：任何修复布局并重新 deploy 后，节点配置和字段权限全部丢失，必须重新设置！**
>
> 触发场景：修复布局坐标（如替换 BPMNDiagram 段）后调用 `deploy_process`，会清除所有 `ext_act_process_node` 的字段权限（`ext_act_process_node_auth`）和节点配置（ccStatus、transferStatus、nodeTimeout 等）。
>
> **强制要求：** 每次调用 `deploy_process` 后，必须重新执行以下步骤：
> 1. `edit_node_config` 恢复各节点配置（msgStatus、ccStatus、transferStatus、addSignStatus、nodeTimeout）
> 2. `set_node_field_permissions` 恢复各节点字段权限（只读/可编辑/必填）
>
> **最佳实践：** 将后处理逻辑（节点配置 + 字段权限）封装为独立脚本（如 `reapply_postprocess.py`），每次 deploy 后立即执行。不要依赖上一次已配置好的状态。

流程创建后，可通过 `bpmn_creator.py` 中的函数配置每个节点上表单字段的可见、可编辑、必填状态。

**两个核心函数：**

#### `edit_node_config(api_base, token, process_id, node_code, node_settings)`

编辑节点级配置（表单可编辑、抄送、转办、加签、驳回等开关）。

```python
from bpmn_creator import edit_node_config

edit_node_config(api_base, token, process_id, 'task_draft', {
    'formEditStatus': '1',   # 表单可编辑
    'ccStatus': '1',          # 启用抄送
    'selnextUserStatus': '1', # 选择下一步处理人
    'msgStatus': '1',         # 消息通知
    'addSignStatus': '1',     # 加签
    'transferStatus': '1',    # 转办
    'rejectStatus': '1',      # 驳回
    'nodeTimeout': 1,         # 超时提醒时长（小时），不设置传 null
    'modelAndView': 'PC端表单地址',
    'modelAndViewMobile': '移动端表单地址',
})
```

#### `set_node_field_permissions(api_base, token, process_id, node_code, form_code, field_permissions, form_type='2')`

批量设置节点上每个字段的可见/可编辑/必填权限。支持用**字段中文名**或**字段 model** 引用字段。

```python
from bpmn_creator import set_node_field_permissions

result = set_node_field_permissions(api_base, token, process_id, 'task_draft', 'oa_interview_apply', [
    {"field": "面试地点", "visible": True, "editable": False},              # 可见但禁用
    {"field": "联系电话", "visible": True, "editable": True, "required": True},  # 必填
    {"field": "面试说明", "visible": False},                                # 隐藏
])
# 返回: {"success": True, "updated": 3, "errors": [], "message": "批量保存成功！"}
```

**字段权限配置项：**

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `field` | string | 必填 | 字段中文名或字段 model |
| `visible` | bool | `true` | 是否可见 |
| `editable` | bool | `true` | 是否可编辑 |
| `required` | bool | `false` | 是否必填 |

> **必填时必须同时显式设 `editable: True`**
>
> `required: true` 会自动强制 `visible=true` + `editable=true`，但生成的 ruleType=2 status 必须为 `'0'`（可编辑勾选）才能在 UI 上正确显示必填。
> `bpmn_creator.py` 中 ruleType=2 的 status 已修正为 `'0' if editable else '1'`（原来写反，导致必填时 UI 可编辑未勾选、必填校验不生效）。
>
> 正确写法：`{"field": "申请日期", "visible": True, "editable": True, "required": True}`
> 错误写法：`{"field": "申请日期", "required": True}` ← 省略 editable 时默认值为 True，代码会自动补，但明确写出更安全

> **联动规则（formEditStatus=1 节点的 API status 值对照，实测验证）：**
>
> **关键：ruleType=2 的 status 与 UI 可编辑勾选状态是反的！**
> - `status='0'` → UI 可编辑**已勾选**（跟随节点默认=可编辑）
> - `status='1'` → UI 可编辑**未勾选**（启用控制=禁用/只读）
>
> | 操作 | UI 可见 | UI 可编辑 | UI 必填 | 可见(ruleType=1) status | 可编辑(ruleType=2) status | required |
> |------|--------|---------|--------|----------------------|------------------------|----------|
> | **隐藏** | ✗ | ✗ | ✗ | `'0'` | `'1'` | `false` |
> | **可见+可编辑**（默认） | ✓ | ✓ | ✗ | `'1'` | `'0'` | `false` |
> | **可见+禁用**（只读） | ✓ | ✗ | ✗ | `'1'` | `'1'` | `false` |
> | **必填** | ✓ | ✓ | ✓ | `'1'` | `'0'` | `true` |

**API 对应关系：**

| UI 列 | API 字段 | 说明 |
|--------|---------|------|
| 可见 | `ruleType='1'` 的 `status` | `'1'`=勾选（可见），`'0'`=未勾选（隐藏） |
| 可编辑 | `ruleType='2'` 的 `status` | **`'0'`=勾选（可编辑），`'1'`=未勾选（禁用）——与直觉相反！** |
| 必填 | `required` (`true`/`false`) | 两行记录都需设置 |

> **重要：ruleType=2 的 status 含义与 ruleType=1 相反（实测验证）：**
>
> 当节点开启了 `formEditStatus=1`（表单可编辑）时，所有字段默认可编辑。此时：
> - `ruleType=2` 的 `status='0'` = UI 可编辑**勾选** = 字段可编辑（跟随节点默认）
> - `ruleType=2` 的 `status='1'` = UI 可编辑**未勾选** = 字段禁用/只读（启用控制覆盖默认）
>
> 这与 `ruleType=1` 的逻辑相反（ruleType=1: status='1'=勾选=可见）。
>
> 各操作的正确 status 值：
> - **必填**：ruleType=1 status=`'1'`，ruleType=2 status=`'0'`，required=`true`
> - **隐藏**：ruleType=1 status=`'0'`，ruleType=2 status=`'1'`，required=`false`
> - **禁用**：ruleType=1 status=`'1'`，ruleType=2 status=`'1'`，required=`false`
> - **可编辑**：ruleType=1 status=`'1'`，ruleType=2 status=`'0'`，required=`false`

**三种表单类型的 ruleCode 格式（实测验证）：**

| 表单类型 | ruleCode 格式 | formBizCode | desformComKey |
|---------|--------------|-------------|---------------|
| Online (formType=1) | `online:{表名}:{字段名}` | 表名 | null |
| DesForm (formType=2) | `{desformComKey}` | 表单编码 | 组件 key |
| **自定义 (formType=3)** | **`{自定义编码}`** | **主表表名（主表字段和子表列都用主表名！）** | null |

**Online 表单子表字段的 ruleName 格式（实测验证）：**

- 主表字段：`ruleName` = 字段中文名，如 `申请标题`
- **子表字段：`ruleName` = `{子表描述}::{字段中文名}`，如 `采购明细::金额`**
- `formBizCode` 填**子表表名**（不是主表表名），`ruleCode` 也用子表表名：`online:{子表表名}:{字段名}`

> **⚠ Online 与自定义表单的子表列 formBizCode 规则相反（实测验证）：**
> - **Online (formType=1)**：子表列 `formBizCode` = **子表表名**
> - **自定义 (formType=3)**：子表列 `formBizCode` = **主表表名**（与主表字段相同！）
>
> 用错会导致权限保存成功但流程节点设计器中看不到配置，`subPermissionList` 也不注入。

**⛔ 踩坑记录（已发生）：字段分类不能用模糊关键词匹配，必须用明确字段名！**

> 曾经用 `'部门' in name.lower()` 来判断"部门类字段"，导致"部门负责人审批意见"被错误地归类为只读字段，实际上它是 task_dept_leader 节点的审批意见字段，应当在该节点可编辑必填。
>
> **强制要求：** 当字段权限涉及多个节点、多类字段时，**必须先查询出所有实际字段名（`get_desform_fields`），再手工写死节点→字段的映射关系**，禁止用关键词模糊匹配来分类字段：
>
> ```python
> # ✅ 正确：明确映射
> BASIC_READONLY   = ['申请人', '所在部门', '申请日期', '采购金额']
> BASIC_EDITABLE   = ['采购说明', '附件']
> COMMENT_NODE_MAP = {
>     'task_manager':       '直属经理审批意见',
>     'task_dept_leader':   '部门负责人审批意见',   # ← 包含"部门"但不是基础字段！
>     'task_dept_approval': '部门审批意见',         # ← 同上
>     'task_finance':       '财务经理审批意见',
>     ...
> }
>
> # ❌ 错误：模糊匹配
> if '部门' in name.lower():
>     basic_readonly_fields.append(name)  # 会把审批意见字段错误归类！
> ```

**更新已有字段权限时（强制要求）：**

> 调用 `saveOrUpdateBatch` 更新权限时，**必须先查询已有记录**，携带原记录的 `id` 提交，**不得修改 `ruleName`**。直接新建（不带 `id`）会导致重复记录；擅自修改 `ruleName` 会破坏系统中已有的字段名称显示。

```python
# 正确流程：先查 → 取 id + ruleName → 只改 status/required
r = requests.get(f"{BASE}/act/process/extActProcessNodePermission/list",
    headers=headers,
    params={"processId": process_id, "processNodeCode": node_code, "pageNo": 1, "pageSize": 100})
records = r.json()["result"]["records"]
existing = {rec["ruleCode"]: rec for rec in records}

# 更新时保留原 id 和 ruleName，只修改 status/required
payload = []
for rule_code, new_status_1, new_status_2, new_required in fields_to_update:
    rec1 = existing.get(rule_code + ":ruleType1")  # 按实际查询结果匹配
    payload.append({
        "id": rec["id"],           # 必须携带原 id
        "ruleName": rec["ruleName"],  # 保留原 ruleName，不修改
        "ruleType": rec["ruleType"],
        "status": new_status,
        "required": new_required,
        # ... 其他字段不变
    })
```

**自定义开发表单（formType=3）字段权限配置详解（实测验证）：**

> 自定义开发表单的字段权限通过前端 `usePermission` 的 `hasPermission(code)` / `isDisabledAuth(code)` 与后端配置的 `ruleCode` 联动。`ruleCode` 是自定义的权限编码，需要与前端 data.ts 中 formSchema 的 `show`/`dynamicDisabled` 里使用的编码一致。

**ruleCode 命名规则：** `{模块简称}:{字段名}`，如 `demoall:password`、`demoall:remark`

**完整 API 调用流程：**

**第 1 步：编辑节点配置（开启表单可编辑 + 设置表单地址）**

```
PUT /act/process/extActProcessNode/edit

请求体：
{
    "id": "{节点记录ID}",
    "formEditStatus": "1",
    "ccStatus": "1",
    "selnextUserStatus": "1",
    "msgStatus": "1",
    "modelAndView": "{{viewDir}}/components/{{entityName}}Form?edit=1",
    "modelAndViewMobile": "",
    "processId": "{流程ID}",
    "processNodeCode": "task_draft",
    "processNodeName": "提交申请",
    "addSignStatus": "1",
    "transferStatus": "1",
    "rejectStatus": "1"
}

返回：{"success": true, "message": "编辑成功", "code": 200}
```

> **节点记录ID** 通过 `GET /act/process/extActProcessNode/list?processId={流程ID}` 查询获取。

**第 1.5 步：添加授权标识到菜单（前置条件）**

> **重要（实测验证，按表结构区分）：**
>
> | 表类型 | 是否需要 sys_permission | 说明 |
> |--------|----------------------|------|
> | **单表**（formType=3） | ✅ **需要** | `hasPermission`/`isDisabledAuth` 依赖 sys_permission 中的权限编码 |
> | **一对多主子表**（formType=3） | ❌ **不需要** | BPM 引擎直接通过 `formData.permissionList` 注入，前端从中读取，与 sys_permission 无关 |
>
> 一对多场景只需两步：① data.ts 中 `getBpmFormSchema` 加钩子 ② `saveOrUpdateBatch` 写权限记录。

> **重要：** 自定义开发**单表**表单的字段权限编码（ruleCode）必须先作为**按钮/权限**添加到系统菜单中，并授权给 admin 角色，否则 `hasPermission(code)` 和 `isDisabledAuth(code)` 无法识别该权限编码。

```
POST /sys/permission/add

请求体（每个字段权限一条记录）：
{
    "menuType": 2,
    "name": "密码显示",
    "parentId": "{主菜单ID}",
    "perms": "demoall:password",
    "permsType": "1",
    "status": "1"
}

返回：{"success": true, "message": "添加成功！", "code": 200}
```

**字段说明：**

| 字段 | 说明 | 示例 |
|------|------|------|
| `menuType` | 固定 `2`（按钮/权限） | `2` |
| `name` | 权限名称（UI显示） | `"密码显示"` |
| `parentId` | 上级菜单ID（即该模块的主菜单ID，Flyway SQL 中生成的 `{timestamp}01`） | `"177501111975001"` |
| `perms` | 授权标识（与 ruleCode、前端 hasPermission/isDisabledAuth 的参数一致） | `"demoall:password"` |
| `permsType` | 授权策略：`"1"`=可见/可访问，`"2"`=可编辑 | `"1"` |
| `status` | `"1"`=有效 | `"1"` |

**permsType 与前端函数对应关系：**

| permsType | 含义 | 前端对应函数 | 流程节点 ruleType |
|-----------|------|-----------|-----------------|
| `"1"` | 可见/可访问 | `hasPermission(code)` — 控制字段 `show` | ruleType=1（可见性） |
| `"2"` | 可编辑 | `isDisabledAuth(code)` — 控制字段 `dynamicDisabled` | ruleType=2（可编辑性） |

**添加后需授权给 admin 角色：**
```
POST /sys/permission/saveRolePermission

请求体：
{
    "roleId": "f6817f48af4fb3af11b9e8bf182f618b",
    "permissionIds": "{新增的权限ID1},{新增的权限ID2},...",
    "lastpermissionIds": "{原有权限IDs}"
}
```
> 或者通过 Flyway SQL 直接插入 `sys_permission` + `sys_role_permission` 表（参考代码生成的菜单 SQL 格式）。

**第 2 步：保存节点字段权限**

```
POST /act/process/extActProcessNodePermission/saveOrUpdateBatch

请求体（数组，每个字段2条记录：ruleType=1 可见 + ruleType=2 可编辑）：
[
    {
        "ruleType": "1",
        "status": "1",
        "formType": "3",
        "formBizCode": "demo_all_component",
        "processId": "2039187744210108418",
        "processNodeCode": "task_draft",
        "ruleCode": "demoall:password",
        "ruleName": "密码显示隐藏"
    },
    {
        "ruleType": "2",
        "status": "0",
        "formType": "3",
        "formBizCode": "demo_all_component",
        "processId": "2039187744210108418",
        "processNodeCode": "task_draft",
        "ruleCode": "demoall:password",
        "ruleName": "密码显示隐藏"
    }
]

返回：{"success": true, "message": "批量保存成功！", "code": 200}
```

**字段权限记录字段说明：**

| 字段 | 说明 | 示例 |
|------|------|------|
| `ruleType` | `'1'`=可见性规则，`'2'`=可编辑性规则 | `'1'` |
| `status` | ruleType=1: `'1'`=可见/`'0'`=隐藏；ruleType=2: `'0'`=可编辑/`'1'`=禁用 | `'1'` |
| `formType` | `'3'`=自定义开发 | `'3'` |
| `formBizCode` | 数据库表名 | `'demo_all_component'` |
| `processId` | 流程ID | `'2039187744210108418'` |
| `processNodeCode` | 节点编码 | `'task_draft'` |
| `ruleCode` | 权限编码（与前端 hasPermission/isDisabledAuth 的参数一致） | `'demoall:password'` |
| `ruleName` | 权限名称（UI显示用） | `'密码显示隐藏'` |
| `id` | 记录ID（新增不传，编辑传） | `'2039250050830880769'` |

**前端 data.ts 与后端权限编码对应关系：**

```typescript
// data.ts 中 — ruleCode 与 hasPermission/isDisabledAuth 的参数必须一致
{ label: '密码', field: 'password', component: 'InputPassword',
  show: ({ values }) => {
    return hasPermission('demoall:password');  // ← 对应后端 ruleCode: 'demoall:password'
  },
},
{ label: '多行文本', field: 'remark', component: 'InputTextArea',
  dynamicDisabled: ({ values }) => {
    return isDisabledAuth('demoall:demoall');  // ← 对应后端 ruleCode: 'demoall:demoall'
  },
},
```

> **子表字段的 ruleName 格式（实测验证）：**
>
> - **Online (formType=1)**：`ruleName` = `{子表描述}::{字段标签}`，如 `商品明细::小计`；`formBizCode` = 子表表名
> - **自定义 (formType=3)**：`ruleName` = `{子表描述}{字段标签}`（无 `::`，直接拼接），如 `订单明细商品名称`；`formBizCode` = **主表表名**（与主表字段完全相同）；`ruleCode` = `{子表Key前缀}:{columnKey}`，如 `salOrderItemColumns:productName`
>
> 自定义表单子表列权限写入示例：
> ```python
> # formBizCode 统一用主表名，不论主表字段还是子表列！
> {"ruleType":"1","status":"1","formType":"3","formBizCode":"sal_sales_order",
>  "ruleCode":"salOrderItemColumns:productName","ruleName":"订单明细商品名称", ...}
> {"ruleType":"2","status":"1","formType":"3","formBizCode":"sal_sales_order",
>  "ruleCode":"salOrderItemColumns:productName","ruleName":"订单明细商品名称", ...}
> ```

**Online 表单设置必填的完整示例：**
```python
# 为 task_draft 节点的 order_date 字段设置必填
records = [
    {
        'processId': PROCESS_ID,
        'processNodeCode': 'task_draft',
        'ruleCode': 'online:sales_order:order_date',  # online:{表名}:{字段名}
        'ruleName': '下单日期',
        'ruleType': '1',       # 可见
        'status': '1',         # 启用
        'required': 1,         # 必填
        'formType': '1',       # Online 表单
        'formBizCode': 'sales_order'  # 表名
    },
    {
        'processId': PROCESS_ID,
        'processNodeCode': 'task_draft',
        'ruleCode': 'online:sales_order:order_date',
        'ruleName': '下单日期',
        'ruleType': '2',       # 可编辑
        'status': '0',         # 跟随节点默认（formEditStatus=1 时已默认可编辑）
        'required': 1,         # 必填
        'formType': '1',
        'formBizCode': 'sales_order'
    }
]
api_request(api_base, token, '/act/process/extActProcessNodePermission/saveOrUpdateBatch', data=records)
```

> 每个字段在后端存储为两条记录：`ruleType=1`（可见性规则）和 `ruleType=2`（可编辑性规则），批量通过 `POST /act/process/extActProcessNodePermission/saveOrUpdateBatch` 保存。

---

## 自定义开发单表（formType=3）字段权限完整配置流程（实测验证）

> **触发场景：** 已有流程节点需配置字段级可见/可编辑权限，表单是自定义开发的单表（非 Online、非 DesForm）。

### 关键规则（⚠️ 强制）

**规则A：`set_node_field_permissions` 不支持 formType=3，必须直接调 API**

`bpmn_creator.py` 的 `set_node_field_permissions` 内部对 formType=3 走 `get_desform_fields` 分支，会因找不到 DesForm 编码而返回 `{'success': False, 'updated': 0, 'errors': ['无法获取表单字段信息']}`。  
**强制规则：formType=3 必须手动构造 batch_data，直接调用 `saveOrUpdateBatch` API。**

```python
# ✅ 正确 —— 直接构造 batch_data
FIELDS = [
    {'field': 'username', 'label': '账号', 'editable': False},
    {'field': 'age',      'label': '年龄', 'editable': True},
]
batch_data = []
for fd in FIELDS:
    rule_code = f"{MODULE}:{fd['field']}"   # MODULE = 'testLocalBpm'
    base = {
        'formType': '3', 'formBizCode': TABLE_NAME,   # TABLE_NAME = 'test_local_bpm'
        'processId': PROCESS_ID, 'processNodeCode': NODE_CODE,
        'ruleCode': rule_code, 'ruleName': fd['label'], 'required': 0,
    }
    batch_data.append({**base, 'ruleType': '1', 'status': '1'})                            # 可见
    batch_data.append({**base, 'ruleType': '2', 'status': '0' if fd['editable'] else '1'}) # 可编辑
bc.api_request(API_BASE, TOKEN,
    '/act/process/extActProcessNodePermission/saveOrUpdateBatch', data=batch_data)
```

**规则B：`sys/permission/list` 不支持按 perms 过滤参数（已实测）**

`GET /sys/permission/list?perms=xxx` 中的 `perms` 参数被忽略，始终返回全量数据。  
**查找新增权限 ID 的唯一可靠方式：** 调用 `/sys/permission/queryTreeList`，展开树后按 `parentId` + `title`（即添加时的 `name`）匹配。

```python
# ✅ 正确 —— 按 parentId+title 查新增权限的 ID
def flatten_tree(nodes, acc=None):
    if acc is None: acc = []
    for n in (nodes or []):
        if isinstance(n, dict):
            acc.append(n)
            flatten_tree(n.get('children', []), acc)
    return acc

r = api_get('/sys/permission/queryTreeList')
all_nodes = flatten_tree(r.get('result', {}).get('treeList', []))
children = [n for n in all_nodes if n.get('parentId') == MENU_ID]
# queryTreeList 节点用 'key' 字段做 ID（不是 'id'），且不含 'perms' 字段
# 需按 title/label 匹配（即 add 时传的 name 值）
NAME_TO_PERMS = {'账号显示': 'testLocalBpm:username', '年龄显示': 'testLocalBpm:age'}
target_ids = [c['key'] for c in children if (c.get('title') or c.get('label')) in NAME_TO_PERMS]
```

> ⚠️ `queryTreeList` 树节点结构：`key`=ID、`title`/`label`=名称、`parentId`=父节点ID，**不含 `perms` 字段**（被剥离）。

**规则C：单表 sys_permission 每个 ruleCode 只需一条记录（permsType=1 即可）**

实测发现：对单表 formType=3，`hasPermission` 和 `isDisabledAuth` 都基于 `permissionList`（由 BPM 引擎注入）工作，只需用 permsType=1 注册可见性权限即可——字段的可编辑/禁用由 `extActProcessNodePermission` 中 `ruleType=2` 的 status 控制。  
permsType=2 的 sys_permission 条目可以不添加，**不影响 `isDisabledAuth` 工作**。

### 完整 Python 脚本模板（单表 formType=3）

```python
# -*- coding: utf-8 -*-
"""单表 formType=3 节点字段权限完整配置"""
import json, urllib.request, urllib.parse
import sys, os, pathlib
_SKILLS = pathlib.Path.home() / '.claude' / 'skills'
sys.path.insert(0, str(_SKILLS / 'jeecg-bpmn' / 'scripts'))
import bpmn_creator as bc

API_BASE   = 'http://...'
TOKEN      = '...'
HEADERS    = {'X-Access-Token': TOKEN, 'Content-Type': 'application/json'}
PROCESS_ID = '...'
NODE_CODE  = 'task_finance'     # 目标节点
FORM_CODE  = 'test_local_bpm'  # 数据库主表名
FORM_TYPE  = '3'
ADMIN_ROLE = 'f6817f48af4fb3af11b9e8bf182f618b'
MODULE     = 'testLocalBpm'    # ruleCode 前缀（驼峰模块名）
MENU_ID    = '...'             # 该模块在 sys_permission 的菜单 ID
FORM_URL   = 'demo/components/TestLocalBpmForm?edit=1'  # 前端路由

# ── 字段定义 ──
FIELDS = [
    {'field': 'username', 'label': '账号',  'editable': False},
    {'field': 'realname', 'label': '名称',  'editable': False},
    {'field': 'age',      'label': '年龄',  'editable': True},
    {'field': 'sex',      'label': '性别',  'editable': False},
]

def api_get(path):
    req = urllib.request.Request(f'{API_BASE}{path}', headers=HEADERS)
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))

def api_post(path, data):
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(f'{API_BASE}{path}', data=body, headers=HEADERS, method='POST')
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))

def api_put(path, data):
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(f'{API_BASE}{path}', data=body, headers=HEADERS, method='PUT')
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))

def flatten_tree(nodes, acc=None):
    if acc is None: acc = []
    for n in (nodes or []):
        if isinstance(n, dict):
            acc.append(n); flatten_tree(n.get('children', []), acc)
    return acc

# ── Step 1: 开启节点 formEditStatus=1，同步 nodeConfigJson ──
r_nodes = api_get(f'/act/process/extActProcessNode/list?processId={PROCESS_ID}&pageNo=1&pageSize=50')
nodes = r_nodes.get('result', {}).get('records', [])
target_node = next((n for n in nodes if n['processNodeCode'] == NODE_CODE), None)
target_node['formEditStatus'] = '1'
target_node['modelAndView'] = FORM_URL
target_node['modelAndViewMobile'] = FORM_URL
cfg = json.loads(target_node.get('nodeConfigJson') or '{}')
cfg['formEditStatus'] = True
target_node['nodeConfigJson'] = json.dumps(cfg, ensure_ascii=False)
api_put('/act/process/extActProcessNode/edit', target_node)
api_put('/act/process/extActProcess/deployProcess', {'id': PROCESS_ID})
print('Step 1: 节点配置+发布 OK')

# ── Step 2: 注册 sys_permission（每字段一条，permsType=1） ──
# 先查已有，避免重复
r_tree = api_get('/sys/permission/queryTreeList')
all_nodes = flatten_tree(r_tree.get('result', {}).get('treeList', []))
children = [n for n in all_nodes if n.get('parentId') == MENU_ID]
existing_name_ids = {(c.get('title') or c.get('label')): c['key'] for c in children}

new_ids = []
for fd in FIELDS:
    perm_name = f"{fd['label']}显示"
    if perm_name not in existing_name_ids:
        api_post('/sys/permission/add', {
            'menuType': 2, 'name': perm_name, 'parentId': MENU_ID,
            'perms': f"{MODULE}:{fd['field']}", 'permsType': '1', 'status': '1',
        })
        # 重新查树取 ID（按 name 匹配，queryTreeList 是唯一可靠来源）
        r2 = api_get('/sys/permission/queryTreeList')
        fresh = flatten_tree(r2.get('result', {}).get('treeList', []))
        c2 = [n for n in fresh if n.get('parentId') == MENU_ID]
        added = next((n for n in c2 if (n.get('title') or n.get('label')) == perm_name), None)
        if added:
            new_ids.append(added['key']); existing_name_ids[perm_name] = added['key']
print(f'Step 2: 注册 {len(new_ids)} 个新权限')

# ── Step 3: 授权给 admin 角色 ──
if new_ids:
    r_role = api_get(f'/sys/permission/queryByRole?roleId={ADMIN_ROLE}')
    role_result = r_role.get('result', []) or []
    existing_ids = [p.get('id') or p.get('key','') for p in role_result if isinstance(p, dict)]
    existing_ids = [x for x in existing_ids if x]
    all_ids = list(set(existing_ids + new_ids))
    api_post('/sys/permission/saveRolePermission', {
        'roleId': ADMIN_ROLE,
        'permissionIds': ','.join(all_ids),
        'lastpermissionIds': ','.join(existing_ids),
    })
    print(f'Step 3: 授权 OK')

# ── Step 4: 删除旧节点字段权限，重写（deploy 后再写） ──
old_r = bc.api_request(API_BASE, TOKEN,
    f'/act/process/extActProcessNodePermission/list?processId={PROCESS_ID}'
    f'&processNodeCode={NODE_CODE}&pageNo=1&pageSize=200', method='GET')
old_recs = old_r.get('result', {})
old_recs = old_recs.get('records', []) if isinstance(old_recs, dict) else (old_recs or [])
for rec in old_recs:
    bc.api_request(API_BASE, TOKEN,
        f'/act/process/extActProcessNodePermission/delete?id={rec["id"]}', method='DELETE')

batch_data = []
for fd in FIELDS:
    rule_code = f"{MODULE}:{fd['field']}"
    base = {
        'formType': FORM_TYPE, 'formBizCode': FORM_CODE,
        'processId': PROCESS_ID, 'processNodeCode': NODE_CODE,
        'ruleCode': rule_code, 'ruleName': fd['label'], 'required': 0,
    }
    batch_data.append({**base, 'ruleType': '1', 'status': '1'})
    batch_data.append({**base, 'ruleType': '2', 'status': '0' if fd['editable'] else '1'})

r_save = bc.api_request(API_BASE, TOKEN,
    '/act/process/extActProcessNodePermission/saveOrUpdateBatch', data=batch_data)
print(f'Step 4: 字段权限保存 {r_save.get("success")} {r_save.get("message","")}')
```

### 前端 data.ts 标准改法（实测验证）

**改动点 3 处（顶部 + formSchema 每字段 + getBpmFormSchema）：**

```typescript
// ① 顶部新增（文件最顶层，非组件内部）
import { usePermission } from '/@/hooks/web/usePermission';
const { isDisabledAuth, hasPermission, initBpmFormData } = usePermission();

// ② formSchema 每个需要权限控制的字段加 show + dynamicDisabled
export const formSchema: FormSchema[] = [
  {
    label: '账号', field: 'username', component: 'Input',
    show: () => hasPermission('testLocalBpm:username'),
    dynamicDisabled: () => isDisabledAuth('testLocalBpm:username'),
  },
  {
    label: '年龄', field: 'age', component: 'Input',
    show: () => hasPermission('testLocalBpm:age'),
    dynamicDisabled: () => isDisabledAuth('testLocalBpm:age'),
  },
  // ... 其他字段同理
];

// ③ getBpmFormSchema 调用 initBpmFormData（必须在 return 之前）
export function getBpmFormSchema(_formData): FormSchema[] {
  initBpmFormData(_formData);   // ← 激活节点权限读取，缺少则权限不生效
  return formSchema;
}
```

> **`show`/`dynamicDisabled` 的回调不需要 `({ values }) =>` 参数**，直接 `() =>` 即可（两种写法均合法，但简洁写法更清晰）。

### 权限生效原理（单表 formType=3）

```
BPM 引擎启动流程节点
  → 查询 ext_act_process_node_auth（ruleCode/ruleType/status）
  → 注入到 formData.permissionList（type=1 可见，type=2 禁用，action=ruleCode）
  → Form.vue 接收 props.formData
  → getBpmFormSchema(formData) 调用 initBpmFormData(formData)
  → usePermission 内部 formData 变量指向节点权限列表
  → hasPermission('testLocalBpm:age') 检查 permissionList 中 type=1 action=该code → true=可见
  → isDisabledAuth('testLocalBpm:age') 检查 type=2 action=该code → true=禁用，false=可编辑
```

> **sys_permission 的作用：** 当 `formData.permissionList` 为空（非 BPM 流程打开，或普通新增/编辑弹窗）时，`hasPermission` 回退到检查 `allCodeList`（来自 sys_permission）。因此注册 sys_permission 是为了保证**非流程场景下字段正常显示**，不是流程权限的核心机制。

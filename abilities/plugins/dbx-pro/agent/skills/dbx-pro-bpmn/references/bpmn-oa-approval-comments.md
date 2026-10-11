### OA 审批意见字段配置规范（DesForm + 流程节点联动）

> 适用场景：表单使用 `oa-approval-comments`（审批意见控件），需要与流程节点联动——表单上默认禁用，流转到对应节点时才启用并必填。

#### 第一步：表单设计器中设置审批意见为禁用状态

`oa-approval-comments` 控件创建时默认 `disabled: false`，**必须手动将其设为 `disabled: true`**，否则表单上的审批意见框始终可编辑，与流程节点控制失效。

**操作方式（通过 desform_utils）：**

```python
import sys, json
sys.path.insert(0, r'<desform-skill目录>/scripts')
from desform_utils import init_api, export_design_json, save_design_from_file

init_api('<api_base>', '<token>')

# 1. 导出当前设计 JSON
file_path, _ = export_design_json('<form_code>')

# 2. 遍历所有控件，将 oa-approval-comments 的 disabled 设为 True
with open(file_path, 'r', encoding='utf-8') as f:
    design = json.load(f)

def walk(items):
    for w in items:
        if w.get('type') == 'oa-approval-comments':
            w['options']['disabled'] = True
        for child in w.get('list', []):
            walk([child])
        for col in w.get('columns', []):
            walk(col.get('list', []))

walk(design.get('list', []))

with open(file_path, 'w', encoding='utf-8') as f:
    json.dump(design, f, ensure_ascii=False)

# 3. 保存回服务器
save_design_from_file('<form_code>', file_path)
```

#### 第二步：每个审批节点配置字段权限

**规则（必须同时满足三点）：**
1. 开启节点表单可编辑（`formEditStatus=1`）并设置 DesForm 表单地址
2. 对应审批意见字段：`editable=True, required=True`（启用并必填）
3. 其他所有字段：`editable=False`（只读，防止审批人篡改申请内容）

**完整 Python 示例：**

```python
import sys
sys.path.insert(0, r'<bpmn-skill目录>/scripts')
from bpmn_creator import edit_node_config, set_node_field_permissions

api_base = '<api_base>'
token = '<token>'
process_id = '<process_id>'
form_code = '<form_code>'
form_url = '{{DOMAIN_URL}}/desform/edit/<form_code>/${BPM_DES_DATA_ID}?token={{TOKEN}}&taskId={{TASKID}}&skip=false'

# 所有表单字段（中文名列表）
all_fields = ['字段A', '字段B', '审批意见1', '审批意见2', ...]

# 每个节点 → 该节点可编辑且必填的审批意见字段
node_editable_fields = {
    'task_node1': {'审批意见1'},
    'task_node2': {'审批意见2'},
}

for node_code, editable_set in node_editable_fields.items():
    # 1. 开启表单可编辑 + 设置表单地址
    edit_node_config(api_base, token, process_id, node_code, {
        'formEditStatus': '1',
        'modelAndView': form_url,
        'modelAndViewMobile': form_url,   # DesForm 移动端与 PC 端地址相同
    })

    # 2. 设置字段权限：对应审批意见字段必填，其余只读
    perms = []
    for field in all_fields:
        if field in editable_set:
            perms.append({'field': field, 'visible': True, 'editable': True, 'required': True})
        else:
            perms.append({'field': field, 'visible': True, 'editable': False, 'required': False})
    set_node_field_permissions(api_base, token, process_id, node_code, form_code, perms)
```

#### 第三步：deploy 之后再保存字段权限

> **⚠️ 字段权限（saveOrUpdateBatch）必须在 deploy_process 之后调用。**
> deploy 会清空权限记录；formEditStatus=1 需要 deploy 激活。
>
> **标准顺序：**
> ```
> edit_node_config（开启可编辑）
>   → deploy_process（激活 formEditStatus，同时会清空旧权限）
>   → saveOrUpdateBatch（deploy 之后再保存权限）
> ```

---


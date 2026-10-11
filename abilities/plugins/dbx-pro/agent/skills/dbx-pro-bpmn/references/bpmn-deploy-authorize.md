# 流程发布、授权与编辑

> 从 SKILL.md 提取，包含 Step 4/5 的完整 Python 实现代码和编辑已有流程的操作方法。

## Step 4: 发布流程（Python 实现）

流程创建成功后，自动调用发布接口部署流程：

```python
# 发布流程 — PUT /act/process/extActProcess/deployProcess
deploy_data = json.dumps({'id': process_id}).encode('utf-8')
req = urllib.request.Request(
    f'{API_BASE}/act/process/extActProcess/deployProcess',
    data=deploy_data,
    headers={
        'X-Access-Token': TOKEN,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Sign': '00000000000000000000000000000000',
        'X-Tenant-Id': '1',
    },
    method='PUT'
)
resp = urllib.request.urlopen(req)
result = json.loads(resp.read().decode('utf-8'))
# success: true → 发布成功
```

通用脚本 `bpmn_creator.py` 已内置 `--deploy` 参数自动发布。

## Step 5: 发起授权（完整实现）

流程关联设计器表单（formType=1 或 formType=2）后，需要将表单授权给角色，用户才能在「发起审批」中看到该流程。

**适用范围：**
- `formType=1`（Online 表单）— 需要授权
- `formType=2`（设计器表单 DesForm）— 需要授权
- `formType=3`（自定义表单）— **不需要授权**，跳过此步骤

**授权 API 说明：**

| 步骤 | API | 方法 | 说明 |
|------|-----|------|------|
| 1. 查询已有授权 | `/joa/designform/designFormCommuse/getAuthorizedDesignList?principalId={roleId}&authMode=role&_t={timestamp}` | GET | 获取角色已授权的表单ID列表 |
| 2. 保存授权 | `/joa/designform/designFormCommuse/saveWorkorderAuth/{roleId}` | POST | 追加新表单ID并保存 |

**保存授权请求体：**
```json
{
  "authMode": "role",
  "authId": "id1,id2,id3,...,新表单ID",
  "subDepartIds": ""
}
```

> **重要：** `authId` 必须包含该角色已有的所有授权表单ID + 新表单ID（逗号分隔），否则会覆盖已有授权。

**默认角色ID：** `f6817f48af4fb3af11b9e8bf182f618b`（管理员角色）

**不同表单类型的 form_id 取值：**

| formType | 表单类型 | form_id 取值 | 获取方式 |
|----------|---------|-------------|---------|
| `1` | Online 表单 | Online 表单的 **headId** | 创建时输出，或 `GET /online/cgform/head/list?tableName={表名}` |
| `2` | 设计器表单 DesForm | DesForm 的**表单 ID** | 创建时输出，或 `GET /desform/queryByIdOrCode?desformCode={编码}` |

> **踩坑：** Online 表单授权时 `form_id` 必须传 `headId`，不是流程 ID 也不是表名。

**Python 示例：**
```python
import json, time, urllib.request

def authorize_form(api_base, token, form_id, role_id='f6817f48af4fb3af11b9e8bf182f618b'):
    """为表单添加发起授权（保留已有授权）"""
    headers = {
        'X-Access-Token': token,
        'Content-Type': 'application/json; charset=UTF-8',
    }

    # 1. 查询已有授权
    ts = str(int(time.time() * 1000))
    url = f'{api_base}/joa/designform/designFormCommuse/getAuthorizedDesignList?principalId={role_id}&authMode=role&_t={ts}'
    req = urllib.request.Request(url, headers=headers)
    result = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    existing_ids = [item['id'] for item in result.get('result', []) or []]

    # 2. 追加新表单ID
    if form_id not in existing_ids:
        existing_ids.append(form_id)

    # 3. 保存授权
    url = f'{api_base}/joa/designform/designFormCommuse/saveWorkorderAuth/{role_id}'
    data = json.dumps({
        'authMode': 'role',
        'authId': ','.join(existing_ids),
        'subDepartIds': '',
    }, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(url, data=data, headers=headers, method='POST')
    result = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    return result
```

> **何时执行：** 流程关联 Online/DesForm 表单后自动执行。自定义表单（formType=3）不需要。

---

## 编辑已有流程

在 JSON 配置中传入 `"processId": "已有流程ID"` 即可更新流程。

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

### 调整已有流程布局（x 坐标平移）

**场景：** 流程在设计器中显示异常（节点被遮挡、x 坐标为负、或想整体平移）。

**步骤：**
1. `queryById` 取出 base64 后 decode 得到原始 XML
2. 只对 `<bpmndi:BPMNDiagram>` 区段内的 `x="N"` 做替换
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
# 防重复平移：先检查 min_x，若 >= 50 则跳过
```

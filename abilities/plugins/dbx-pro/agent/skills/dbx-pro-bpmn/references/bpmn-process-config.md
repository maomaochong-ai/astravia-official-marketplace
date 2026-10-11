# 流程高级配置与报表打印

> 从 SKILL.md 提取，包含 Step 7.5/7.6 的完整 Python 实现代码。

## Step 7.5: 流程高级配置

流程创建/发布后，可通过以下 API 修改流程的高级配置（通知方式、催办、撤回、督办等）：

**API：** `PUT /act/process/extActProcess/edit`

**请求体（JSON）：**
```json
{
    "id": "{流程ID}",
    "notifyWay": "system,dingtalk,email,wechat_enterprise",
    "urgeStatus": "1",
    "backStatus": "1",
    "graphicStatus": "1",
    "autoSubmitStatus": "0",
    "pcIcon": "",
    "appIcon": "",
    "messageTemplate": "bpm_node_notify",
    "izSupervise": 0
}
```

**字段说明：**

| 字段 | 说明 | 取值 |
|------|------|------|
| `notifyWay` | 通知方式（逗号分隔） | `system`=系统消息, `dingtalk`=钉钉, `email`=邮件, `wechat_enterprise`=企业微信 |
| `urgeStatus` | 允许催办 | `"1"`=开, `"0"`=关 |
| `backStatus` | 允许撤回 | `"1"`=开, `"0"`=关 |
| `graphicStatus` | 显示流程图 | `"1"`=开, `"0"`=关 |
| `autoSubmitStatus` | 自动提交 | `"1"`=开, `"0"`=关 |
| `messageTemplate` | 消息模板 | `bpm_node_notify`（默认） |
| `izSupervise` | 督办 | `1`=开, `0`=关 |
| `pcIcon` | PC 端图标 | 图标路径或留空 |
| `appIcon` | 移动端图标 | 图标路径或留空 |

**Python 示例：**
```python
def edit_process_config(api_base, token, process_id, config):
    """修改流程高级配置"""
    data = {'id': process_id, **config}
    body = json.dumps(data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        f'{api_base}/act/process/extActProcess/edit',
        data=body,
        headers={
            'X-Access-Token': token,
            'Content-Type': 'application/json; charset=UTF-8',
            'X-Sign': '00000000000000000000000000000000',
            'X-Tenant-Id': '1',
        },
        method='PUT'
    )
    resp = urllib.request.urlopen(req)
    return json.loads(resp.read().decode('utf-8'))

# 示例：只开启系统消息+钉钉，关闭催办和撤回
edit_process_config(api_base, token, process_id, {
    'notifyWay': 'system,dingtalk',
    'urgeStatus': '0',
    'backStatus': '0',
    'graphicStatus': '1',
    'autoSubmitStatus': '0',
    'messageTemplate': 'bpm_node_notify',
    'izSupervise': 0,
})
```

---

## Step 7.6: 设置报表打印地址

流程关联了积木报表后，用户可在审批详情页直接打印报表。**仅 formType=3（自定义开发表单）支持此配置。**

**正确 API：** `PUT /act/process/extActProcessForm/edit`（不是 extActProcess/edit）

**reportPrintUrl 格式（通用模板，只替换报表ID）：**
```
{{DOMAIN_URL}}/jmreport/view/{积木报表ID}?id={{DATAID}}&token={{TOKEN}}&procInstId={{PROCINSTID}}
```

**操作步骤：**

1. 查询流程表单绑定记录，获取记录 id
2. 调用 edit 接口更新 `reportPrintUrl` 字段

**Python 示例：**
```python
import json, urllib.request, urllib.parse

def set_report_print_url(api_base, token, process_id, report_id):
    headers = {
        'X-Access-Token': token,
        'Content-Type': 'application/json; charset=UTF-8',
        'X-Sign': '00000000000000000000000000000000',
        'X-Tenant-Id': '1',
    }

    # Step 1: 查询表单绑定记录
    url = f'{api_base}/act/process/extActProcessForm/list?processId={process_id}'
    req = urllib.request.Request(url, headers=headers)
    result = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
    records = result.get('result', {}).get('records', [])
    if not records:
        raise Exception('未找到流程表单绑定记录')
    form_record = records[0]

    # Step 2: 更新 reportPrintUrl
    report_print_url = (
        '{{DOMAIN_URL}}/jmreport/view/' + report_id +
        '?id={{DATAID}}&token={{TOKEN}}&procInstId={{PROCINSTID}}'
    )
    edit_data = {
        'id': form_record['id'],
        'processId': process_id,
        'formDealStyle': form_record.get('formDealStyle', 'default'),
        'formType': form_record.get('formType', '3'),
        'relationCode': form_record.get('relationCode', ''),
        'flowStatusCol': form_record.get('flowStatusCol', 'bpm_status'),
        'titleExp': form_record.get('titleExp', ''),
        'formTableName': form_record.get('formTableName', ''),
        'reportPrintUrl': report_print_url,
    }
    body = json.dumps(edit_data, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        f'{api_base}/act/process/extActProcessForm/edit',
        data=body, headers=headers, method='PUT'
    )
    return json.loads(urllib.request.urlopen(req).read().decode('utf-8'))
```

> **常见错误：** 用 `/act/process/extActProcess/edit` + `printUrl` 字段无法生效，必须用 `/act/process/extActProcessForm/edit` + `reportPrintUrl` 字段。

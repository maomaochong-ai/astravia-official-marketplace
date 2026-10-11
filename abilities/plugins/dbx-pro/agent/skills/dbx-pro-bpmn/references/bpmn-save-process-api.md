# saveProcess API 规范与临时脚本指南

> 从 SKILL.md 提取。仅在需要编写临时 Python 脚本（通用 bpmn_creator.py 无法覆盖的场景）时阅读。

## saveProcess API 规范

> **重要：** 临时脚本调用 `saveProcess` API 时，必须与 `bpmn_creator.py` 保持一致：

| 项目 | 正确值 | 常见错误 |
|------|--------|---------|
| **请求路径** | `/act/designer/api/saveProcess` | ~~`/act/process/extActProcess/saveProcess`~~ |
| **Content-Type** | `application/x-www-form-urlencoded` | ~~`application/json`~~ |
| **流程Key字段名** | `processkey`（全小写） | ~~`processKey`~~（驼峰） |
| **类型字段名** | `typeid`（全小写） | ~~`typeId`~~（驼峰） |
| **XML字段名** | `processDescriptor` | ~~`processXml`~~ |
| **XML 值的形式** | **原始 XML 字符串**（服务器自动 base64） | ~~`base64.b64encode(xml)`~~（双重编码，deployProcess 报"前言中不允许有内容"） |
| **流程ID字段名** | `processDefinitionId`（新建传`0`） | ~~`id`~~ |
| **返回值中流程ID** | `result['obj']` | ~~`result['result']`~~ |
| **流程列表名称字段** | `processName` | ~~`name`~~ |
| **DesForm 设计 JSON 字段** | `desformDesignJson` | ~~`designJson`~~ |
| **queryById 返回的编码字段名** | `processKey`（驼峰） | ~~`processkey`~~（全小写） |

> **⛔ 严重坑：** 编辑已有流程时，从 `queryById` 读取编码必须用 `info.get('processKey', '')`（大写 K）。若误用 `info.get('processkey', '')`（小写 k），取到空字符串后传给 `saveProcess`，流程编码会被清空。
>
> ```python
> info = result['result']
> process_key = info.get('processKey', '')  # ✅ 正确：大写K
> # process_key = info.get('processkey', '')  # ❌ 小写k，取到空字符串
> save_data = { ..., 'processkey': process_key, ... }  # 发送时仍用全小写
> ```

> **⚠ 关键坑：** `processDescriptor` 必须传**原始 XML 字符串**，不是 base64。从 `queryById` 取出的 `processXml` 是 base64，必须先 `base64.b64decode` 得到原始 XML，修改后以原始 XML 传回。

**saveProcess 请求参数完整列表：**
```python
data = {
    'processDefinitionId': '0',        # 新建传 '0'，编辑传已有流程ID
    'processName': '流程名称',
    'processkey': 'process_key',        # 注意全小写
    'typeid': 'oa',                     # 注意全小写
    'lowAppId': '',
    'params': '',
    'nodes': 'id=task_xxx###nodeName=节点名@@@',  # 节点列表字符串
    'processDescriptor': bpmn_xml,       # 完整 BPMN XML
    'realProcDefId': '',
    'startType': 'manual',
}
result = api_request('/act/designer/api/saveProcess', data,
                     content_type='application/x-www-form-urlencoded')
# ⚠️ 编辑已有流程时 obj 可能为 null；processKey 已存在时也走 update，obj=null
# 正确 fallback：按 processKey 精确查询真实 ID
process_id = result['obj'] or process_definition_id
if not process_id:
    qr = api_request('/act/process/extActProcess/list?pageNo=1&pageSize=100', method='GET')
    for rec in (qr.get('result') or {}).get('records', []):
        if rec.get('processKey') == process_key:
            process_id = rec.get('id', '')
            break
```

---

## BPMN XML 转义规则

| 字符 | 必须转义为 | 使用场景 | 错误写法 |
|------|----------|---------|---------|
| `"` | `&#34;` | taskExtendJson 的 value 属性中的 JSON 双引号 | ~~`&quot;`~~（推荐用 `&#34;` 与设计器前端一致） |
| `'` | `&#39;` | `flowUtil.getAssigneeUsers(execution,'BASE64')` 中的单引号 | ~~字面单引号~~（URL 编码后可能丢失） |

**正确写法：**
```python
# taskExtendJson — 使用 &#34; 转义双引号
TASK_EXTEND = '{&#34;sameMode&#34;:0,&#34;isSkipAssigneeEmpty&#34;:false,...}'

# collection 表达式 — 使用 &#39; 转义单引号
COLLECTION = '${flowUtil.getAssigneeUsers(execution,&#39;%s&#39;)}' % b64_config

# 拼接 XML
xml_parts.append('<flowable:taskExtendJson value="%s" />' % TASK_EXTEND)
```

**错误写法（URL 编码后单引号丢失）：**
```python
# 错误！三引号拼接中的单引号在 URL 编码后会被吞掉
xml = '''...flowable:collection="${flowUtil.getAssigneeUsers(execution,'''' + b64 + '''')}"...'''
```

---

## BPMN XML 元素顺序规则

> **⛔ 严重坑：** Flowable BPMN 2.0 XSD 对 `userTask` 内部子元素顺序有严格要求。

**`userTask` 子元素强制顺序：**

```xml
<bpmn2:userTask ...>
  <!-- 1. extensionElements 必须第一个 -->
  <bpmn2:extensionElements>
    <flowable:taskExtendJson ... />
    <flowable:taskListener ... />
    <flowable:taskCountersignExtendJson ... />
  </bpmn2:extensionElements>

  <!-- 2. incoming / outgoing 必须在 loopCharacteristics 之前 -->
  <bpmn2:incoming>flow_xxx</bpmn2:incoming>
  <bpmn2:outgoing>flow_yyy</bpmn2:outgoing>

  <!-- 3. multiInstanceLoopCharacteristics 必须最后 -->
  <bpmn2:multiInstanceLoopCharacteristics ...>
    <bpmn2:completionCondition .../>
  </bpmn2:multiInstanceLoopCharacteristics>
</bpmn2:userTask>
```

顺序错会报 `cvc-complex-type.2.4.a: 发现了以元素 incoming 开头的无效内容`。

---

## 条件表达式格式

```python
# ✅ 正确：外层是数组，logic 小写，三参数表达式
payload = [{"logic": "and", "conditions": [{"field": "...", "fieldType": "money", "operator": "gt", "expectedValue": "1000"}]}]
b64 = base64.b64encode(json.dumps(payload, ensure_ascii=False).encode()).decode()
expr = f"${{flowUtil.evaluateExpression(execution,&#39;{b64}&#39;,&#39;and&#39;)}}"

# ❌ 错误1：外层是对象不是数组 → 条件规则面板显示为空
# ❌ 错误2：缺少第三个参数 → 条件规则面板显示为空
```

> **最优实践：直接调用 `bpmn_creator.build_condition_b64(conditions, logic='and')` 生成 b64。**

---

## 临时脚本推荐模式

使用 `xml_parts` 列表逐行拼接 XML（压缩格式）：

```python
xml_parts = []
xml_parts.append('<?xml version="1.0" encoding="UTF-8"?>')
xml_parts.append('<bpmn2:definitions ...>')
xml_parts.append('<bpmn2:process id="%s" name="%s">' % (key, name))
# ... 逐行添加节点、连线、布局 ...
xml_parts.append('</bpmn2:definitions>')
bpmn_xml = ''.join(xml_parts)
```

**临时脚本执行步骤：**
```
1. Write 工具 → 写入临时脚本到当前工作目录
2. Bash 工具 → 执行脚本：
   - Python 在 PATH：python -X utf8 <script>.py
   - Python 不在 PATH（Windows）：从记忆读取路径，用 PowerShell 调用：
     powershell -Command "& '<PYTHON_PATH>' '-X' 'utf8' '<script_path>'"
3. 清理所有临时文件（Windows 用 PowerShell）：
     powershell -Command "Remove-Item 'C:\path\to\script.py', 'C:\path\to\other.json'"
```

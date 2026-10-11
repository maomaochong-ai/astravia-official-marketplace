# 组件连线配置指南（linesConfig.connectLine）

> 文档：https://help.jimureport.com/biScreen/base/interactive/connectLine

## 重要限制

- **仅适用于 JImg（图片）组件**，JCustomIcon 不支持（源码第 69 行过滤条件：`item.component == 'JImg'`）
- 连线从源组件的 `linesConfig.connectLine` 数组中配置，指向目标组件（也必须是 JImg）

## 数据结构

```typescript
interface AuxiliaryLine {
    sourceId: string;    // 源组件的 i（UUID）
    targetId: string;    // 目标组件的 i（UUID）
    startPosition: string; // 起点位置
    endPosition: string;   // 终点位置
    lineWidth: number;     // 线宽（1-10）
    lineType: string;      // 线条类型
    lineColor: string;     // 线条颜色（hex）
}
```

组件 `config` 中的 `linesConfig` 结构：
```json
{
  "linesConfig": {
    "connectLine": [ ...AuxiliaryLine[] ],
    "show": false
  }
}
```

## 枚举值

### lineType（线条类型）
| 值 | 含义 |
|----|------|
| `Straight` | 直线 |
| `Flowchart` | 流程图连线 |
| `Bezier` | 贝塞尔曲线 |

### startPosition / endPosition（位置）
| 值 | 含义 |
|----|------|
| `AutoDefault` | 默认（自动） |
| `TopLeft` | 左上 |
| `LeftMiddle` | 左中 |
| `BottomLeft` | 左下 |
| `TopRight` | 右上 |
| `RightMiddle` | 右中 |
| `BottomRight` | 右下 |
| `TopCenter` | 上中 |
| `BottomCenter` | 下中 |

### 默认新建连线值
```json
{
  "sourceId": "<源组件UUID>",
  "targetId": "",
  "startPosition": "AutoDefault",
  "endPosition": "AutoDefault",
  "lineWidth": 3,
  "lineType": "Straight",
  "lineColor": "#75cede"
}
```

## 配置示例（Python 脚本）

```python
import json
import bi_utils

bi_utils.API_BASE = '<api_base>'
bi_utils.TOKEN = "..."
PAGE_ID = "..."

# 查询页面
raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
p = raw.get('result') or {}
template_str = p.get('template')
template = json.loads(template_str) if isinstance(template_str, str) else (template_str or [])

# 找到源组件和目标组件
source = next(c for c in template if c.get('componentName') == '源图片')
target = next(c for c in template if c.get('componentName') == '目标图片')

# 解析 config
cfg = source.get('config', {})
if isinstance(cfg, str):
    cfg = json.loads(cfg)

# 配置连线
lines_config = cfg.setdefault('linesConfig', {'connectLine': [], 'show': False})
lines_config['connectLine'].append({
    "sourceId": source['i'],
    "targetId": target['i'],
    "startPosition": "TopCenter",
    "endPosition": "BottomCenter",
    "lineType": "Straight",
    "lineColor": "#75CEDE",
    "lineWidth": 3
})

# 回写 config
source['config'] = json.dumps(cfg, ensure_ascii=False)

# 保存
des_raw = p.get('desJson')
des = json.loads(des_raw) if des_raw and isinstance(des_raw, str) else (des_raw or {})
bi_utils._request('POST', '/drag/page/edit', data={
    'id': PAGE_ID,
    'name': p.get('name', ''),
    'template': json.dumps(template, ensure_ascii=False),
    'updateCount': p.get('updateCount', 1),
    'style': p.get('style', 'bigScreen'),
    'theme': p.get('theme', 'dark'),
    'backgroundImage': p.get('backgroundImage', ''),
    'designType': p.get('designType', 100),
    'desJson': json.dumps(des, ensure_ascii=False),
})
print('连线配置完成')
```

## 注意事项

- `linesConfig` 在组件 `config` JSON 的**顶层**（与 `option` 同级）
- `config` 保存到 template 时必须序列化为 JSON 字符串
- 源码中目标组件下拉只显示同页面中其他的 JImg 组件（排除自身）

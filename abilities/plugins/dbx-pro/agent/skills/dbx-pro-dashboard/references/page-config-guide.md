# 修改页面级配置（背景色、水印、背景图、宽高、名称）

页面级配置直接存储在页面实体的顶层字段中，通过 `/drag/page/edit` 接口修改。

> **性能规则：** 修改 2 个及以上页面属性时，必须编写合并脚本（1 次 query + 修改所有字段 + 1 次 edit），禁止逐个调用 page_ops.py。

## 页面实体关键字段

| 字段 | 类型 | 说明 | 示例值 |
|------|------|------|--------|
| `backgroundColor` | string | 页面背景色 | `#1E90FF`、`#1E0047` |
| `backgroundImage` | string | 页面背景图路径 | `/img/bg/bg5.png` |
| `theme` | string | 主题 | `dark` / `light` |
| `desJson` | string (JSON) | 页面设计配置 | 见下方结构 |

## desJson 结构

```python
{
    "width": 1920,
    "height": 1080,
    "waterMark": {
        "show": True,
        "content": "JeecgBoot",
        "fontSize": 12,
        "color": "#ffffff",
        "angle": 45
    },
    "sysDefColor": [
        {"color": "#1e90ff", "color1": "#1e90ff"},
    ],
    "layoutMode": "fullScreen",
    "autoRefresh": {
        "enabled": False,
        "time": "03:00"
    }
}
```

## 修改示例

```python
import json
from bi_utils import *
import bi_utils

init_api('<api_base>', '<token>')
PAGE_ID = 'xxx'

# 用 _request 获取完整页面实体（不是 query_page）
raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
p = raw['result']

# 1. 修改背景色
p['backgroundColor'] = '#1E90FF'

# 2. 修改背景图
p['backgroundImage'] = '/img/bg/bg5.png'

# 3. 解析 desJson（注意：可能为 None、空字符串、dict 或 JSON 字符串）
if p.get('desJson') and isinstance(p['desJson'], str):
    des = json.loads(p['desJson'])
elif isinstance(p.get('desJson'), dict):
    des = p['desJson']
else:
    des = {}

# 4. 开启水印
des['waterMark'] = {
    'show': True,
    'content': '水印文字',
    'fontSize': 14,
    'color': '#ffffff',
    'angle': 45
}
p['desJson'] = json.dumps(des, ensure_ascii=False)

# 保存
bi_utils._request('POST', '/drag/page/edit', data=p)
```

## 背景图图库列表

| 序号 | 路径 | 说明 |
|------|------|------|
| 1 | `/img/bg/defbg.png` | 默认背景 |
| 2 | `/img/bg/bg1.png` | 背景1 |
| 3 | `/img/bg/bg2.png` | 背景2 |
| 4 | `/img/bg/bg3.png` | 背景3 |
| 5 | `/img/bg/bg4.png` | 背景4（大屏默认） |
| 6 | `/img/bg/bg5.png` | 背景5 |
| 7 | `/img/bg/bg6.png` | 背景6 |
| 8 | `/img/bg/bg7.png` | 背景7 |
| 9 | `/img/bg/bg8.png` | 背景8 |
| 10 | `/img/bg/bg10.png` | 背景10 |
| 11 | `/img/bg/bg12.png` | 背景12 |
| 12 | `/img/bg/bg18.jpg` | 背景18 |

## 注意事项

- `query_page()` 只返回组件相关信息，修改页面级字段需用 `_request('GET', '/drag/page/queryById')`
- **`desJson` 可能为 None**：模板复制创建的页面 `desJson` 字段可能为 `None` 或空字符串，直接 `json.loads()` 或下标访问会报 `TypeError: 'NoneType' object does not support item assignment`。必须先判空，为 None 时初始化为空 dict `{}`
- `desJson` 是 JSON 字符串，修改前需 `json.loads()`，修改后需 `json.dumps()` 回写
- 水印配置在 `desJson.waterMark` 中，不是页面顶层字段
- 背景色与背景图同时生效，背景图叠加在背景色之上

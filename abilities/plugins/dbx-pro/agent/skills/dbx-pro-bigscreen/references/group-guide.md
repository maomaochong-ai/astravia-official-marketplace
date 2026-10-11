# 组件组合（JGroup）

组合功能将多个组件合并为一个 JGroup，使它们可以作为整体一起拖动、缩放。

## JGroup 数据结构

```python
group_comp = {
    'i': bi_utils._gen_uuid(),
    'component': 'JGroup',
    'componentName': '组合名称',
    'group': True,
    'selected': False,
    'x': group_x,        # 包围盒左上角 x
    'y': group_y,        # 包围盒左上角 y
    'w': group_w,        # 包围盒宽度
    'h': group_h,        # 包围盒高度
    'angle': 0,
    'equalProportion': False,   # 子组件有旋转时设为 True
    'visible': True,
    'disabled': False,
    'config': {'size': {}},
    'style': {},
    'props': {
        'elements': [child1, child2, ...]   # 子组件数组
    }
}
```

## groupStyle 百分比计算

每个子组件必须包含 `groupStyle` 字段，使用百分比定位（相对于 JGroup 容器）：

```python
child['groupStyle'] = {
    'config': {},
    'width':  f'{(child_w / group_w) * 100:.2f}%',
    'height': f'{(child_h / group_h) * 100:.2f}%',
    'left':   f'{((child_x - group_x) / group_w) * 100:.2f}%',
    'top':    f'{((child_y - group_y) / group_h) * 100:.2f}%',
    'transform': f'rotate({child.get("angle", 0)}deg)',
    'position': 'absolute'
}
```

## API 创建组合完整示例

```python
import sys, json
sys.path.insert(0, r'当前工作目录')
from bi_utils import *
import bi_utils

init_api('<api_base>', '<token>')
PAGE_ID = '页面ID'

page = query_page(PAGE_ID)
tmpl = page.get('template', [])
if isinstance(tmpl, str):
    tmpl = json.loads(tmpl)

# 1. 找到要组合的组件，从 template 中取出
target_names = {'组件A名称', '组件B名称'}
children = []
other_comps = []
for comp in tmpl:
    cfg = comp.get('config', {})
    if isinstance(cfg, str):
        try: cfg = json.loads(cfg)
        except: cfg = {}
        comp['config'] = cfg
    if comp.get('componentName', '') in target_names:
        children.append(comp)
    else:
        other_comps.append(comp)

# 2. 计算包围盒
min_x = min(c['x'] for c in children)
min_y = min(c['y'] for c in children)
group_w = max(c['x'] + c['w'] for c in children) - min_x
group_h = max(c['y'] + c['h'] for c in children) - min_y

# 3. 为每个子组件计算 groupStyle
for child in children:
    child['groupStyle'] = {
        'config': {},
        'width':  f'{(child["w"] / group_w) * 100:.2f}%',
        'height': f'{(child["h"] / group_h) * 100:.2f}%',
        'left':   f'{((child["x"] - min_x) / group_w) * 100:.2f}%',
        'top':    f'{((child["y"] - min_y) / group_h) * 100:.2f}%',
        'transform': f'rotate({child.get("angle", 0)}deg)',
        'position': 'absolute'
    }

# 4. 构建 JGroup
group_comp = {
    'i': bi_utils._gen_uuid(),
    'component': 'JGroup',
    'componentName': '组合名称',
    'group': True, 'selected': False,
    'x': min_x, 'y': min_y, 'w': group_w, 'h': group_h,
    'angle': 0, 'equalProportion': False,
    'visible': True, 'disabled': False,
    'orderNum': max(c.get('orderNum', 0) for c in tmpl) + 1,
    'config': {'size': {}}, 'style': {},
    'props': {'elements': children}
}

# 5. 重建 template（移除原组件，加入 JGroup）
new_tmpl = other_comps + [group_comp]
bi_utils._page_components[PAGE_ID] = new_tmpl
save_page(PAGE_ID)
```

## 执行效率规则（强制）

组合操作必须 **2 轮**完成，禁止多轮探索：

```
轮次1: Read 凭据 + Bash cp scripts（并行）
轮次2: 执行组合脚本 + cleanup（1 条 py -X utf8 -c "..." 命令）
```

**关键要求：**
- 查询组件列表和创建组合必须合并在同一个 Python 脚本中执行，禁止分开查询再操作
- **禁止用 `comp_ops.py list` 单独查询组件名**（Git Bash 终端中文乱码，浪费额外轮次重试）
- 直接在 Python 脚本中用 `query_page()` 获取组件列表，打印时用 `json.dumps(ensure_ascii=False)` 或 `py -X utf8` 解决编码

**组件名模糊匹配规则（强制）：**
用户描述的组件名往往不是精确的 `componentName`，必须按关键词匹配：

| 用户描述 | 实际 componentName | 匹配策略 |
|---------|-------------------|---------|
| 智慧社区折线图 | 智慧社区_时间分部 | 包含「智慧社区」关键词 |
| 基础柱形图 | 基础柱形图 | 精确匹配 |
| 男女比例饼状图 | 男女比例 | 包含「男女比例」关键词 |

匹配优先级：精确匹配 > 包含用户关键词 > 包含组件类型关键词。**禁止仅按组件类型（如 JLine）匹配，必须优先匹配用户描述中的业务关键词。**

## 踩坑记录

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **组合后子组件不显示** | 缺少 `groupStyle` 字段 | 必须按百分比计算 groupStyle |
| **组合后子组件位置偏移** | `groupStyle.left/top` 计算错误 | left = `(child.x - group.x) / group.w * 100%` |
| **缩放后子组件比例变形** | `equalProportion` 未正确设置 | 子组件有旋转时设 `True` |
| **原组件未从 template 移除** | 组合后原组件仍独立存在 | 必须将原组件从 template 移除 |
| **⚠️ comp_ops.py list 中文乱码** | Git Bash 终端编码问题，导致多轮重试 | 不要单独 list，在 Python 脚本中 query_page() 一步到位 |
| **⚠️ 组件名匹配错误** | 按组件类型（JLine）匹配，选错同类型组件 | 必须按用户描述的业务关键词匹配 componentName |

## 核心源码位置

| 文件 | 职责 |
|------|------|
| `packages/dragEngine/components/bigScreenComponents/group/Group.vue` | JGroup 组件 |
| `packages/dragEngine/components/bigScreenComponents/rightMenu/utils.ts` | `makeGroup()` / `cancelGroup()` |
| `packages/dragEngine/components/bigScreenComponents/rightMenu/useActions.ts` | 右键菜单入口 |

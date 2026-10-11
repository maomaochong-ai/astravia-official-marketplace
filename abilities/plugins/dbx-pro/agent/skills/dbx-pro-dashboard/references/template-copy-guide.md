# 模板复制创建大屏

> **注意：模板复制方式仅作为备选。** 模板 JSON 中的 config 结构复杂且样式耦合严重，批量文本替换容易破坏配置完整性。仅在需要精确还原某个已有模板的视觉布局时才考虑使用。

## 模板复制完整流程

```python
import json
from bi_utils import *
import bi_utils

init_api('<api_base>', '<token>')

# 1. 读取模板 JSON
tpl_path = r'<skill_base_dir>/references/templates/bigScreen/集团综合数据大屏_1151069555267260416.json'
with open(tpl_path, 'r', encoding='utf-8') as f:
    tpl_data = json.load(f)
template_components = tpl_data.get('template', [])

# 2. 建立旧 ID → 新 ID 映射（关键！）
id_mapping = {}
for comp in template_components:
    old_i = comp['i']
    id_mapping[old_i] = bi_utils._gen_uuid()

# 3. 更新组件 ID 和清理
for comp in template_components:
    comp['i'] = id_mapping[comp['i']]
    comp.pop('pageCompId', None)
    config = comp.get('config', {})
    if isinstance(config, str):
        try: config = json.loads(config)
        except: config = {}
    comp['config'] = config

# 4. 更新 JTabToggle 的 compVals 引用
for comp in template_components:
    if comp['component'] == 'JTabToggle':
        for item in comp['config'].get('option', {}).get('items', []):
            item['compVals'] = [id_mapping.get(v, v) for v in item.get('compVals', [])]

# 5. 更新 JGroup 内部 props.elements 中的 ID 引用
for comp in template_components:
    if comp['component'] == 'JGroup':
        props = comp.get('props', {})
        elements = props.get('elements', [])
        if elements:
            el_str = json.dumps(elements, ensure_ascii=False)
            for old_id, new_id in id_mapping.items():
                el_str = el_str.replace(old_id, new_id)
            props['elements'] = json.loads(el_str)

# 6. 创建页面并保存
page_id = create_page('我的大屏', style='bigScreen', theme='dark',
                       background_image='/img/bg/bg4.png')
bi_utils._page_components[page_id] = template_components
save_page(page_id)
```

## 模板复制踩坑记录

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| **页签切换不工作** | JTabToggle 的 `compVals` 引用了旧组件 ID | 必须建立 ID 映射，更新 `config.option.items[].compVals` |
| **JGroup 内部组件异常** | JGroup 的 `props.elements` 内也有 ID 交叉引用 | 序列化后批量替换旧 ID |
| **新增组件不显示** | config 格式不完整或被头部背景图遮挡 | 用模板中已有的同类组件 config 作参考；设 `orderNum: 300` 提高层级 |
| **组件超出大屏边界导致显示不全** | 模板中组件的 y+h 超过 1080 或 x+w 超过 1920 | 复制模板后必须做边界检查 |
| **替换数据后图表显示拥挤或溢出** | 替换的数据条数、文字长度与原模板差异过大 | 替换数据时保持数据量与原模板一致 |

## 模板复制原则（重要）

**只替换数据，不改装饰：**
- **不要替换的组件样式**：JDragBorder、JDragDecoration、JImg、JSelectRadio 等装饰/图片/边框类组件的样式、类型、位置、尺寸不要修改
- **边框/装饰中的标题文字可以替换**：JDragBorder 等装饰组件如果包含标题文本可以改为业务相关文字，但边框样式本身保持不变
- **可以替换的组件**：JBar/JLine/JPie/JRing 等图表组件的 `chartData`、JScrollBoard/JScrollTable 的数据、JColorBlock 的指标数据、JText 的文本内容
- **替换范围**：只修改 `config.chartData` 和相关标题文字，不修改 `config.option` 中的样式配置
- **数据量控制**：替换后的数据条数应与原模板保持一致或接近

## 组件边界检查（1920×1080）

大屏预览页面不支持滚动，组件超出 1920×1080 会被裁切不可见。

```python
SCREEN_W, SCREEN_H = 1920, 1080

max_bottom = max(c['y'] + c['h'] for c in template)
max_right = max(c['x'] + c['w'] for c in template)

if max_bottom > SCREEN_H:
    content_min_y = min(c['y'] for c in template if c['y'] >= 150)
    scale_y = (SCREEN_H - content_min_y) / (max_bottom - content_min_y)
    for comp in template:
        if comp['y'] >= content_min_y:
            comp['y'] = round(content_min_y + (comp['y'] - content_min_y) * scale_y)
            comp['h'] = round(comp['h'] * scale_y)
            cfg = comp.get('config', {})
            cfg['h'] = comp['h']
            if 'size' in cfg:
                cfg['size']['height'] = comp['h']

if max_right > SCREEN_W:
    for comp in template:
        if comp['x'] + comp['w'] > SCREEN_W:
            comp['w'] = SCREEN_W - comp['x'] - 10
            cfg = comp.get('config', {})
            cfg['w'] = comp['w']
            if 'size' in cfg:
                cfg['size']['width'] = comp['w']
```

## 替换业务数据

```python
tpl_str = json.dumps(tpl_data['template'], ensure_ascii=False)
replacements = {
    '集团业务综合管理平台': '招商银行经营管理驾驶舱',
    '新成业务板块': '零售金融业务',
}
for old, new in replacements.items():
    tpl_str = tpl_str.replace(old, new)
template_components = json.loads(tpl_str)
```

## 向已有大屏新增组件

> **关键：新增组件的 config 必须从模板中同类组件复制，不要自己拼装。**

```python
# 从模板中找到参考组件的 config
for comp in tpl_data['template']:
    if comp.get('component') == 'JCurrentTime':
        ref_config = comp.get('config', {})
        break

clock = {
    'component': 'JCurrentTime',
    'componentName': '实时日期',
    'visible': True,
    'i': bi_utils._gen_uuid(),
    'x': 1580, 'y': 15, 'w': 320, 'h': 40,
    'orderNum': 300,
    'config': ref_config,
}

page = query_page(page_id)
tmpl = page.get('template', [])
if isinstance(tmpl, str): tmpl = json.loads(tmpl)
tmpl.append(clock)
bi_utils._page_components[page_id] = tmpl
save_page(page_id)
```

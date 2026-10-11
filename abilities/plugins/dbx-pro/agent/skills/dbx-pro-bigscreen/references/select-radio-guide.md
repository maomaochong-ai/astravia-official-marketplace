# JSelectRadio 选项卡组件完整脚本

> 选项卡核心功能：点击不同选项，显示/隐藏关联组件。
> comp_ops.py 可添加基础选项卡，但无法配置 `compShowConfig`，需自定义脚本。
> 参考文档：https://help.jimureport.com/biScreen/componentconfig/other/tab/

## 添加选项卡并关联新建组件

```python
import sys, json
sys.path.insert(0, '.')
import bi_utils
bi_utils.API_BASE = API_BASE
bi_utils.TOKEN = TOKEN

defaults = json.load(open('default_configs.json', 'r', encoding='utf-8'))

# 查询页面现有组件
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template', [])

# 生成关联组件的 ID（新增场景）
comp1_id = bi_utils._gen_uuid()
comp2_id = bi_utils._gen_uuid()

# --- 创建关联组件（折线图、柱形图等） ---
# 使用 bi_utils.add_component 的逻辑构建 comp dict，此处略
# 关键：记录每个组件的 i（UUID）

# --- 创建选项卡 ---
tab_cfg = json.loads(json.dumps(defaults.get('JSelectRadio', {})))
tab_w, tab_h = tab_cfg.pop('w', 300), tab_cfg.pop('h', 40)
tab_cfg['chartData'] = json.dumps([
    {"label": "选项一", "value": "1"},
    {"label": "选项二", "value": "2"}
], ensure_ascii=False)
tab_cfg['background'] = '#FFFFFF00'
tab_cfg['borderColor'] = '#FFFFFF00'
# ⚠️ 核心：组件可见性配置
tab_cfg['compShowConfig'] = [
    {"selectVal": "1", "compVals": [comp1_id]},
    {"selectVal": "2", "compVals": [comp2_id]}
]
tab_cfg['size'] = {'width': tab_w, 'height': tab_h}  # ⚠️ 必须设置，否则组件不渲染
tab_cfg['chart'] = {'subclass': 'JSelectRadio', 'category': 'other'}
tab_cfg.setdefault('turnConfig', {})
tab_cfg.setdefault('linkageConfig', [])
tab_config_str = json.dumps(tab_cfg, ensure_ascii=False)
tab_comp = {
    "i": bi_utils._gen_uuid(),
    "component": "JSelectRadio",
    "componentName": "选项卡",
    "x": 100, "y": 250, "w": tab_w, "h": tab_h,
    "dataType": 0,
    "config": tab_config_str,
    "dataMapping": {},
    "size": {"width": tab_w, "height": tab_h},  # ⚠️ 顶层也要设置
    "chart": {"subclass": "JSelectRadio", "category": "other"},
    "turnConfig": {}, "linkageConfig": []
}

# 插入组件（选项卡置顶，关联组件紧随其后）
tmpl.insert(0, tab_comp)
tmpl.insert(1, comp1_dict)  # 折线图
tmpl.insert(2, comp2_dict)  # 柱形图

bi_utils._page_components[PAGE_ID] = tmpl
bi_utils.save_page(PAGE_ID)
```

## 为已有组件添加选项卡关联

```python
# 查询页面，找到已有组件的 ID
page = bi_utils.query_page(PAGE_ID)
tmpl = page.get('template', [])

# 按名称查找已有组件 ID
line_id = next(c['i'] for c in tmpl if c.get('componentName') == '基础折线图')
bar_id = next(c['i'] for c in tmpl if c.get('componentName') == '基础柱形图')

# 创建选项卡并关联已有组件
tab_cfg = json.loads(json.dumps(defaults.get('JSelectRadio', {})))
tab_cfg.pop('w', None); tab_cfg.pop('h', None)
tab_cfg['chartData'] = json.dumps([
    {"label": "折线图", "value": "1"},
    {"label": "柱形图", "value": "2"}
], ensure_ascii=False)
tab_cfg['compShowConfig'] = [
    {"selectVal": "1", "compVals": [line_id]},
    {"selectVal": "2", "compVals": [bar_id]}
]
# ... 构建 tab_comp 并 insert(0, tab_comp)
```

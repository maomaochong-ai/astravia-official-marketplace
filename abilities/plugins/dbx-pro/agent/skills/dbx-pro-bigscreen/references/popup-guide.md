# 大屏弹窗（Popup Modal）实现指南

> 参考文档：https://help.jimureport.com/biScreen/base/interactive/popup  
> 实测验证：2026-04-10，PAGE_ID=1202497312900390912

## 功能说明

点击 JText 文本组件，弹出一个包含图表/表格等组件的 JGroup 组合弹窗。支持全屏（full）和适合大小（fit）两种模式。

---

## 核心数据结构

### 1. JText 触发组件

**关键字段（config 为 dict，非 JSON 字符串）：**

```python
{
    'i': text_i,                        # UUID
    'component': 'JText',
    'componentName': '查看详情',
    'visible': True,
    'x': 50, 'y': 50, 'w': 200, 'h': 60,
    'config': {
        'borderColor': '#FFFFFF00',
        'background':  '#1565c0',       # 按钮背景色
        'dataMapping': [{'mapping': '', 'filed': '数值'}],
        'dataType': 1,
        'h': 60,
        'url': 'http://api.jeecg.com/mock/42/nav',   # 文字数据来源
        'timeOut': 0,
        'chartData': '{"value":"点击查看详情"}',     # 注意：JSON字符串内嵌对象
        'size': {'height': 60},
        'actionConfig': {'operateType': 'modal', 'modalName': '', 'url': ''},  # 必须有
        'w': 200,
        'setModalCited': True,          # 标记：已绑定弹窗（必须有）
        'turnConfig': {'type': '_blank', 'url': ''},
        'linkType': 'url',
        'linkageConfig': [],
        'option': {
            'openUrl': '',
            'isLink': False,
            'body': {
                'color': '#FFFFFF',
                'letterSpacing': 2,
                'text': '',             # 文字来自 chartData.value，此处留空
                'fontWeight': 'bold',
                'marginTop': 0,
                'marginLeft': 0,
            },
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''},
            'modal': {
                'backgroundColor':    '#0d1b2a',    # 内容区背景色
                'backgroundImage':    '',
                'backgroundSize':     '100% 100%',
                'targetCompId':       group_i,      # ← JGroup 的 i 字段（关键！）
                'backgroundPosition': 'center center',
                'title':              '弹窗标题',
                'sizeMode':           'fit',        # 'fit' 适合大小 / 'full' 全屏（全屏无标题无关闭按钮，按ESC退出）
                'backgroundRepeat':   'no-repeat',
                'titleBgColor':       '#1565c0',    # 标题区背景色
            },
            'openType': '_blank',
        },
    },
}
```

### 2. JGroup 弹窗容器

```python
{
    'i': group_i,                       # UUID（JText 的 targetCompId 指向此值）
    'component': 'JGroup',
    'componentName': '弹窗内容组合',
    'group': True,                      # 必须为 True
    'selected': False,
    'visible': False,                   # 初始隐藏（弹窗打开时由前端控制显示）
    'disabled': False,
    'modalCited': text_i,               # 引用此 JGroup 的 JText 的 i 字段（必须有）
    'x': 200, 'y': 200,               # 屏幕绝对坐标（决定弹窗位置，但 fit 模式下居中显示）
    'w': 960, 'h': 360,
    'angle': 0,
    'equalProportion': False,
    'config': {                         # JGroup 的 config 是简单 dict
        'borderColor': '#FFFFFF00',
        'background':  '#FFFFFF00',
        'size': {},
    },
    'style': {},
    'props': {
        'elements': [child1, child2],   # 子组件数组
    },
}
```

### 3. 子组件（JGroup 内部的图表）

子组件与普通组件结构相同，但有两处关键区别：

**A. x/y 是 JGroup 内部局部坐标（非屏幕绝对坐标）**

```python
# JBar 子组件 - 局部坐标示例
{
    'i': bar_i,
    'component': 'JBar',
    'componentName': '月度销售额',
    'visible': True,
    'x': 10,   # ← 相对于 JGroup 左边缘的像素偏移（不是屏幕绝对 x）
    'y': 10,   # ← 相对于 JGroup 上边缘的像素偏移（不是屏幕绝对 y）
    'w': 450, 'h': 330,
    'orderNum': 0,
    'groupStyle': {...},   # 见下方
    'config': {...},       # dict，非 JSON 字符串
}
```

**B. groupStyle 百分比（相对于 JGroup 尺寸）**

```python
# groupStyle 计算公式（注意：分母是 group.w/h，分子是局部 x/y，无需减去 group.x/y）
def calc_group_style(local_x, local_y, child_w, child_h, group_w, group_h):
    return {
        'transform': 'rotate(0deg)',
        'top':    f"{local_y / group_h * 100:.2f}%",
        'left':   f"{local_x / group_w * 100:.2f}%",
        'width':  f"{child_w  / group_w * 100:.2f}%",
        'height': f"{child_h  / group_h * 100:.2f}%",
        'position': 'absolute',
        'config': {},
    }

# 例：group_w=960, group_h=360
# JBar: local_x=10, local_y=10, w=450, h=330
# → left=1.04%, top=2.78%, width=46.88%, height=91.67%
```

**C. config 必须为 dict（非 JSON 字符串），且包含完整图表配置**

```python
# 子组件 config 示例（JBar）
config = {
    'borderColor': '#FFFFFF00',
    'background':  '#FFFFFF00',
    'markLineConfig': {'show': False, 'markLine': []},
    'dataMapping': [
        {'mapping': '', 'filed': '维度'},
        {'mapping': '', 'filed': '数值'},
    ],
    'dataType': 1,                      # 1=API数据，chartData 作为静态备用
    'h': 330,
    'url': 'http://api.jeecg.com/mock/33/chart',
    'timeOut': 0,
    'chartData': '[{"name":"苹果","value":1000},...]',  # JSON 数组字符串
    'size': {'height': 330},            # 注意：只有 height，没有 width
    'actionConfig': {'operateType': 'modal', 'modalName': '', 'url': ''},
    'w': 450,
    'turnConfig': {'type': '_blank', 'url': ''},
    'linkType': 'url',
    'linkageConfig': [],
    'option': {
        # ... ECharts option 配置
        'title': {'show': True, 'text': '图表标题', ...},
        'series': [{'type': 'bar', 'barWidth': 40, 'data': [], ...}],
        ...
    },
}
```

---

## 完整实现流程（3步）

```
Step 1: 生成 UUID（text_i, group_i, 各子组件 i）
Step 2: 构建子组件（局部坐标 + groupStyle + config as dict）
Step 3: 构建 JGroup（visible=False, modalCited=text_i, props.elements=子组件）
Step 4: 构建 JText（setModalCited=True, option.modal.targetCompId=group_i）
Step 5: 插入模板并保存（必须用 queryById+edit，禁止 save_page）
```

```python
# 插入顺序（JGroup 在最前=最顶层，JText 紧随其后）
new_tmpl = [group_comp, text_comp] + existing_tmpl

# ⚠️ 必须用 queryById+edit，禁止 save_page（save_page 可能因 query_page 返回空 template 覆盖现有组件）
raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
p   = raw.get('result') or {}
des = json.loads(p['desJson']) if isinstance(p.get('desJson'), str) else (p.get('desJson') or {})
bi_utils._request('POST', '/drag/page/edit', data={
    'id': PAGE_ID, 'name': p.get('name', ''),
    'template': json.dumps(new_tmpl, ensure_ascii=False),
    'updateCount': p.get('updateCount', 1),
    'style': p.get('style', 'bigScreen'),
    'theme': p.get('theme', 'dark'),
    'backgroundImage': p.get('backgroundImage', ''),
    'designType': p.get('designType', 100),
    'desJson': json.dumps(des, ensure_ascii=False),
})
```

---

## 踩坑记录（实测 2026-04-10）

| 错误 | 正确做法 |
|------|---------|
| **⚠️ config 序列化为 JSON 字符串** | 弹窗场景所有组件（JText/JGroup/子组件）的 `config` 必须是 **dict**，不能 `json.dumps()` |
| **⚠️ 子组件 x/y 用屏幕绝对坐标** | 子组件 x/y 是 **JGroup 内部局部坐标**（从 JGroup 左上角起算的像素偏移），不是大屏绝对坐标 |
| **⚠️ groupStyle.left 减去 group.x** | 正确公式：`left = child.x(局部) / group.w * 100`，不需要减 group.x |
| **⚠️ JText 文字放在 `option.body.text` 字段** | 当 dataType=1 时，文字来自 `chartData.value`；`option.body.text` 留空；chartData 格式：`'{"value":"文字内容"}'` |
| **⚠️ 缺少 `actionConfig`** | JText 必须有 `actionConfig: {"operateType":"modal","modalName":"","url":""}` |
| **⚠️ 缺少 `setModalCited: True`** | JText config 中必须有此字段，前端以此判断是否有弹窗绑定 |
| **⚠️ 缺少 `modalCited`** | JGroup 中必须有 `modalCited: text_i`，前端以此关联哪个文本组件引用了它 |
| **⚠️ JGroup visible 为 True** | JGroup 初始必须 `visible: False`，否则弹窗内容直接显示在大屏上 |
| **⚠️ 子组件 config.size 包含 width** | 子组件 `config.size` 只含 `{"height": h}`，不含 width（模板格式） |
| **⚠️ option.modal.targetCompId 填错** | 必须填 JGroup 的 `i` 字段（UUID），不是 componentName 也不是 pageCompId |
| **⚠️ 子组件 chartData 格式错误** | 图表子组件 chartData 是 **JSON 数组字符串**（`'[{...}]'`）；JText 的 chartData 是 **JSON 对象字符串**（`'{"value":"..."}'`） |

---

## 常用 Mock 数据 URL

| 图表类型 | URL |
|---------|-----|
| 基础柱形图 | `http://api.jeecg.com/mock/33/chart` |
| 堆叠柱形图 | `http://api.jeecg.com/mock/26/stackedBar` |
| 折线图 | `http://api.jeecg.com/mock/26/chart` |
| 饼图 | `http://api.jeecg.com/mock/26/pie` |
| 文字组件 | `http://api.jeecg.com/mock/42/nav` |

---

## sizeMode 说明

| 值 | 效果 |
|----|------|
| `'fit'` | 适合大小弹窗，显示标题栏（option.modal.title），有关闭按钮 |
| `'full'` | 全屏覆盖，无标题无关闭按钮，按 ESC 退出 |

---

## 场景二：关联已有 JText 到已有 JGroup（设计页已手动组合）

> **触发条件**：用户在设计页拖拽创建了 JGroup 组合组件，需要通过 API 将已有 JText 与该 JGroup 关联，实现点击弹窗效果。

```python
# 只需修改 JText config，让它指向已有 JGroup，无需重建 JGroup
text_i  = '已有JText的i字段'
group_i = '已有JGroup的i字段'

raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
p   = raw.get('result') or {}
tmpl = json.loads(p['template']) if isinstance(p.get('template'), str) else (p.get('template') or [])

# 找到 JText，修改 config（保持 dict，不 json.dumps）
for comp in tmpl:
    if comp.get('i') == text_i:
        cfg = comp.get('config') or {}
        if isinstance(cfg, str):
            cfg = json.loads(cfg)
        cfg['setModalCited'] = True
        cfg['actionConfig'] = {'operateType': 'modal', 'modalName': '', 'url': ''}
        opt = cfg.get('option') or {}
        modal = opt.get('modal') or {}
        modal['targetCompId']       = group_i
        modal['title']              = '详情'
        modal['sizeMode']           = 'fit'        # 'fit' 有标题+关闭按钮；'full' 全屏仅ESC退出
        modal['backgroundColor']    = '#0d1b2a'
        modal['titleBgColor']       = '#1565c0'
        modal['backgroundImage']    = ''
        modal['backgroundSize']     = '100% 100%'
        modal['backgroundPosition'] = 'center center'
        modal['backgroundRepeat']   = 'no-repeat'
        opt['modal'] = modal
        cfg['option'] = opt
        comp['config'] = cfg
        break

# 同时确保 JGroup 有 modalCited 字段
for comp in tmpl:
    if comp.get('i') == group_i:
        comp['visible']     = False
        comp['modalCited']  = text_i
        break

des = json.loads(p['desJson']) if isinstance(p.get('desJson'), str) else (p.get('desJson') or {})
bi_utils._request('POST', '/drag/page/edit', data={
    'id': PAGE_ID, 'name': p.get('name', ''),
    'template': json.dumps(tmpl, ensure_ascii=False),
    'updateCount': p.get('updateCount', 1),
    'style': p.get('style', 'bigScreen'), 'theme': p.get('theme', 'dark'),
    'backgroundImage': p.get('backgroundImage', ''),
    'designType': p.get('designType', 100),
    'desJson': json.dumps(des, ensure_ascii=False),
})
```

---

## 完整可执行脚本模板（从零创建 JText + JGroup + 子图表）

> 实测验证：2026-04-21

```python
import sys, json, time, uuid
sys.path.insert(0, '/path/to/bi_utils_dir')
import bi_utils

t0 = time.time()
bi_utils.API_BASE = 'http://192.168.x.x:8085'
bi_utils.TOKEN    = 'YOUR_TOKEN'
PAGE_ID = 'YOUR_PAGE_ID'

def gen_id():
    return str(int(time.time() * 1000)) + '_' + str(uuid.uuid4())[:6]

def group_style(lx, ly, cw, ch, gw, gh):
    return {
        'transform': 'rotate(0deg)',
        'top':    f"{ly / gh * 100:.2f}%",
        'left':   f"{lx / gw * 100:.2f}%",
        'width':  f"{cw / gw * 100:.2f}%",
        'height': f"{ch / gh * 100:.2f}%",
        'position': 'absolute',
        'config': {},
    }

text_i  = gen_id()
group_i = gen_id()
bar_i   = gen_id()

GW, GH = 800, 480
bx, by, bw, bh = 20, 20, 760, 440

bar_child = {
    'i': bar_i, 'component': 'JBar', 'componentName': '柱形图',
    'visible': True, 'x': bx, 'y': by, 'w': bw, 'h': bh, 'orderNum': 0,
    'groupStyle': group_style(bx, by, bw, bh, GW, GH),
    'config': {
        'borderColor': '#FFFFFF00', 'background': '#FFFFFF00',
        'dataMapping': [{'mapping': '', 'filed': '维度'}, {'mapping': '', 'filed': '数值'}],
        'dataType': 1, 'h': bh, 'url': '', 'timeOut': 0,
        'chartData': json.dumps([{'name': '一月', 'value': 120}, {'name': '二月', 'value': 200},
                                  {'name': '三月', 'value': 150}, {'name': '四月', 'value': 280}]),
        'size': {'height': bh},
        'actionConfig': {'operateType': 'modal', 'modalName': '', 'url': ''},
        'w': bw, 'turnConfig': {'type': '_blank', 'url': ''},
        'linkType': 'url', 'linkageConfig': [],
        'option': {
            'title': {'show': False, 'text': ''},
            'grid': {'top': 40, 'bottom': 30, 'left': 40, 'right': 20, 'containLabel': True},
            'xAxis': {'type': 'category', 'data': [], 'axisLabel': {'color': '#9ed3ff'}},
            'yAxis': {'type': 'value', 'axisLabel': {'color': '#9ed3ff'}},
            'series': [{'type': 'bar', 'barWidth': 40, 'data': [], 'itemStyle': {'color': '#1e90ff'}}],
            'tooltip': {'show': True, 'trigger': 'axis'},
        },
    },
}

group_comp = {
    'i': group_i, 'component': 'JGroup', 'componentName': '弹窗内容组合',
    'group': True, 'selected': False, 'visible': False, 'disabled': False,
    'modalCited': text_i,
    'x': 560, 'y': 300, 'w': GW, 'h': GH,
    'angle': 0, 'equalProportion': False,
    'config': {'borderColor': '#1e5a8a', 'background': '#0d1b2a', 'size': {}},
    'style': {}, 'props': {'elements': [bar_child]},
}

text_comp = {
    'i': text_i, 'component': 'JText', 'componentName': '查看详情',
    'visible': True, 'x': 50, 'y': 50, 'w': 200, 'h': 60,
    'config': {
        'borderColor': '#FFFFFF00', 'background': '#1565c0',
        'dataMapping': [{'mapping': '', 'filed': '数值'}],
        'dataType': 1, 'h': 60, 'url': '', 'timeOut': 0,
        'chartData': '{"value":"点击查看详情"}',
        'size': {'height': 60},
        'actionConfig': {'operateType': 'modal', 'modalName': '', 'url': ''},
        'w': 200, 'setModalCited': True,
        'turnConfig': {'type': '_blank', 'url': ''},
        'linkType': 'url', 'linkageConfig': [],
        'option': {
            'openUrl': '', 'isLink': False,
            'body': {'color': '#FFFFFF', 'letterSpacing': 2, 'text': '',
                     'fontWeight': 'bold', 'marginTop': 0, 'marginLeft': 0},
            'card': {'rightHref': '', 'size': 'default', 'extra': '', 'title': ''},
            'modal': {
                'backgroundColor': '#0d1b2a', 'backgroundImage': '',
                'backgroundSize': '100% 100%', 'targetCompId': group_i,
                'backgroundPosition': 'center center',
                'title': '弹窗标题',
                'sizeMode': 'fit',       # 'fit' 有标题+关闭按钮；'full' 全屏仅ESC退出
                'backgroundRepeat': 'no-repeat', 'titleBgColor': '#1565c0',
            },
            'openType': '_blank',
        },
    },
}

raw = bi_utils._request('GET', '/drag/page/queryById', params={'id': PAGE_ID})
p   = raw.get('result') or {}
existing_tmpl = json.loads(p['template']) if isinstance(p.get('template'), str) else (p.get('template') or [])
new_tmpl = [group_comp, text_comp] + existing_tmpl

des = json.loads(p['desJson']) if isinstance(p.get('desJson'), str) else (p.get('desJson') or {})
bi_utils._request('POST', '/drag/page/edit', data={
    'id': PAGE_ID, 'name': p.get('name', ''),
    'template': json.dumps(new_tmpl, ensure_ascii=False),
    'updateCount': p.get('updateCount', 1),
    'style': p.get('style', 'bigScreen'), 'theme': p.get('theme', 'dark'),
    'backgroundImage': p.get('backgroundImage', ''),
    'designType': p.get('designType', 100),
    'desJson': json.dumps(des, ensure_ascii=False),
})
print(f'弹窗创建成功，耗时 {time.time()-t0:.1f}s')
```

# 地图管理（JAreaMap / JFlyLineMap / JBubbleMap 等）

大屏地图组件依赖后端存储的 GeoJSON 地图数据。使用地图组件前，必须先查询后端是否已有对应区域的地图数据，**仅在查不到时才新增**。

## 地图数据 API 端点

| 端点 | 方法 | 说明 |
|------|------|------|
| `/drag/jimuDragMap/list` | GET | 分页查询已有地图数据列表（name 字段为 adcode） |
| `/jmreport/map/addMapData` | POST | 新增地图数据（name=adcode, mapData=GeoJSON字符串） |
| `/drag/onlDragDatasetHead/getMapDataByCode` | GET | 根据 code 和 name 查询地图 GeoJSON |

## GeoJSON 数据来源

```
基础 URL：https://geo.datav.aliyun.com/areas_v3/bound/
完整版（含子区域边界）：{adcode}_full.json
精简版（不含子区域）：{adcode}.json
示例：全国=100000_full.json 新疆=650000_full.json
```

**常用省份 adcode：**

| 省份 | adcode | 省份 | adcode | 省份 | adcode |
|------|--------|------|--------|------|--------|
| 北京 | 110000 | 上海 | 310000 | 广东 | 440000 |
| 天津 | 120000 | 江苏 | 320000 | 广西 | 450000 |
| 河北 | 130000 | 浙江 | 330000 | 海南 | 460000 |
| 山西 | 140000 | 安徽 | 340000 | 重庆 | 500000 |
| 内蒙古 | 150000 | 福建 | 350000 | 四川 | 510000 |
| 辽宁 | 210000 | 江西 | 360000 | 贵州 | 520000 |
| 吉林 | 220000 | 山东 | 370000 | 云南 | 530000 |
| 黑龙江 | 230000 | 河南 | 410000 | 西藏 | 540000 |
| 湖北 | 420000 | 湖南 | 430000 | 陕西 | 610000 |
| 甘肃 | 620000 | 青海 | 630000 | 宁夏 | 640000 |
| 新疆 | 650000 | 台湾 | 710000 | 香港 | 810000 |

## 地图数据上传流程

```python
import json, urllib.request, ssl

adcode = '650000'
geo_url = f'https://geo.datav.aliyun.com/areas_v3/bound/{adcode}_full.json'
ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE
req = urllib.request.Request(geo_url, headers={'User-Agent': 'Mozilla/5.0'})
with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
    geo_json = resp.read().decode('utf-8')

existing = bi_utils._request('GET', '/drag/jimuDragMap/list', params={'pageNo': 1, 'pageSize': 100, 'name': adcode})
records = existing.get('result', {}).get('records', [])
map_exists = any(r.get('name') == adcode for r in records)

if not map_exists:
    bi_utils._request('POST', '/jmreport/map/addMapData', data={
        'name': adcode,
        'mapData': geo_json
    })
```

## JAreaMap 组件 config 结构

```python
map_config = {
    'borderColor': '#FFFFFF00',
    'background': '#FFFFFF00',
    'dataType': 1,
    'w': 700, 'h': 550,
    'size': {'width': 700, 'height': 550},
    'chartData': json.dumps([
        {"name": "乌鲁木齐市", "value": 405},
        {"name": "喀什地区", "value": 468},
    ], ensure_ascii=False),
    'dataMapping': [
        {'mapping': '', 'filed': '区域'},
        {'mapping': '', 'filed': '数值'}
    ],
    'commonOption': {
        'barSize': 10,
        'gradientColor': False,
        'breadcrumb': {'drillDown': False, 'textColor': '#FFFFFF'},
        'areaColor': {'color1': '#132937', 'color2': '#fcc02e'},
        'barColor': '#fff176',
        'barColor2': '#fcc02e',
        'inRange': {'color': ['#04387b', '#467bc0']}
    },
    'option': {
        'drillDown': False,
        'area': {
            'name': ['新疆维吾尔自治区'],
            'value': ['650000'],
            'markerColor': '#DDE330',
            'shadowBlur': 10,
            'markerCount': 5,
            'markerOpacity': 1,
            'scatterLabelShow': False,
            'shadowColor': '#DDE330',
            'markerType': 'effectScatter'
        },
        'geo': {
            'top': 30,
            'zoom': 1,
            'roam': True,
            'itemStyle': {
                'normal': {
                    'borderColor': '#0692A4',
                    'areaColor': '',
                    'borderWidth': 1,
                    'shadowBlur': 0,
                    'shadowColor': '#80d9f8',
                    'shadowOffsetX': 0,
                    'shadowOffsetY': 0
                },
                'emphasis': {
                    'areaColor': '#fff59c',
                    'borderWidth': 0
                }
            },
            'label': {
                'normal': {'color': '#EEF1FA', 'show': True},
                'emphasis': {'color': '#fff', 'show': False}
            }
        },
        'visualMap': {
            'min': 0,
            'max': 500,
            'top': 'bottom',
            'left': '5%',
            'calculable': True,
            'show': True,
            'type': 'continuous',
            'seriesIndex': [0],
            'textStyle': {'color': '#ffffff'},
            'inRange': {'color': ['#04387b', '#467bc0']}
        },
        'title': {
            'show': True, 'text': '新疆区域地图', 'left': 10,
            'textStyle': {'color': '#ffffff', 'fontSize': 16, 'fontWeight': 'normal'}
        },
        'card': {'title': '', 'extra': '', 'rightHref': '', 'size': 'default'},
        'grid': {'bottom': 115, 'show': False},
        'legend': {'data': []},
        'graphic': []
    },
    'url': '', 'timeOut': 0,
    'actionConfig': {'operateType': 'modal', 'modalName': '', 'url': ''},
    'turnConfig': {'type': '_blank', 'url': ''},
    'linkType': 'url', 'linkageConfig': []
}
```

## 地图运行时加载流程

```
JAreaMap 初始化
→ getAreaCode: config.option.area.value 最后一个元素（如 "650000"）
→ registerMap():
    code == 'china' → 加载内置 china.json
    code != 'china' → getMapDataByCode(code, name) 从后端获取
→ echarts.registerMap(code, geoJson)
→ series[0].map = code, geo.map = code
→ setOptions() 渲染
```

## 地图踩坑记录

| 问题 | 原因 | 解决方案 |
|------|------|----------|
| **地图空白不渲染** | 后端没有对应 adcode 的地图数据 | 先通过 `/jmreport/map/addMapData` 上传 GeoJSON |
| **子区域无数据着色** | chartData name 与 GeoJSON features name 不一致 | 解析 GeoJSON 获取精确 name 列表 |
| **visualMap 色带不显示** | `visualMap.show` 为 false 或 `max` 太小 | 设 `show: true`，`max` 设为数据最大值 |
| **HTTPS 证书错误** | DataV Aliyun HTTPS 证书问题 | Python 中用 `ssl.CERT_NONE` 跳过 |
| **china 地图不走后端** | 代码逻辑 code='china' 加载前端内置 JSON | 全国地图不需要上传 |
| **addMapData 的 name 格式** | name 存储 adcode（数字字符串）不是中文 | 用 `"650000"` 不是 `"新疆"` |
| **台湾 710000 在 DataV 返回 404**（实测 2026-05-13） | `geo.datav.aliyun.com/areas_v3/bound/710000_full.json` 不存在，整省批量钻取上传时唯一会失败的省 | 批量上传循环里捕获 HTTPError 单独跳过；或从 echarts 地图源 / geojson.cn 等替代源拉取后用同样 `/jmreport/map/addMapData` 接口上传 |

## 核心源码位置

| 文件 | 职责 |
|------|------|
| `packages/components/echarts/Map/AreaMap/AreaMap.vue` | JAreaMap 组件 |
| `packages/hooks/charts/useEChartsMap.ts` | 地图核心 hook |
| `packages/dragEngine/api.ts` → `getMapDataByCode()` | 获取地图 GeoJSON |

## 🚨 地图组件 config 必须从 default_configs.json 深拷贝（2026-04-10 严重事故）

> **禁止手工构造地图组件的 option / commonOption / dataMapping！**  
> 手写导致 8 个组件全部报错不渲染（2026-04-10 已观测）。

**强制写法（仅替换 chartData 和标题）：**
```python
import copy, json
defaults = json.load(open('default_configs.json', encoding='utf-8'))

cfg = copy.deepcopy(defaults['JAreaMap'])   # 按需换组件名
cfg.pop('w', None); cfg.pop('h', None)
cfg['background'] = '#FFFFFF00'
cfg['borderColor'] = '#FFFFFF00'
cfg['chartData'] = json.dumps(data, ensure_ascii=False)  # 替换数据
if isinstance(cfg.get('option', {}).get('title'), dict):
    cfg['option']['title']['text'] = '新标题'  # 可选：替换标题
# 其余 option / commonOption / dataMapping 全部保持默认，不要动！
```

## 🚨 各地图组件 chartData 格式严格对应（禁止跨组件套用）

| 组件 | 正确 chartData 格式 | 常见错误 |
|------|-------------------|---------|
| JAreaMap / JBubbleMap / JBarMap / JHeatMap | `[{"name":"省名/城市名","value":数字}]` | ❌ 用 `[lng,lat,val]` 坐标数组 |
| JFlyLineMap | `[{"fromName":"城市","toName":"城市","fromLng":数字,"fromLat":数字,"toLng":数字,"toLat":数字,"value":数字}]` | ❌ 用 `coords:[[lng,lat],[lng,lat]]` |
| JTotalFlyLineMap | 同 JFlyLineMap + `"group":"分组名"` | ❌ 用 `type` 替代 `group` |
| JTotalBarMap | `[{"name":"地区","lng":数字,"lat":数字,"value":数字,"group":"分类"}]` | ❌ 用 `coords:[lng,lat]` 数组；❌ 用 `type` 替代 `group` |

## 静态数据参考

> **添加静态数据地图组件时，必须读取并使用 `map-static-data.md` 中的数据，禁止自行设计简陋数据。**

`references/map-static-data.md` 包含：
- 省份 GDP 数据（31省，2023年实际值）→ JAreaMap / JBubbleMap / JBarMap（name+value 格式）
- 城市热力数据（24城）→ JHeatMap（name+value 格式）
- 飞线数据（15条路线，fromLng/fromLat/toLng/toLat 格式）→ JFlyLineMap
- 时间轴飞线数据（4季度×8路线，+group 字段）→ JTotalFlyLineMap
- 分组柱形数据（7大区×3产业，lng/lat/group 格式）→ JTotalBarMap
- JAreaMap 美化 option 配置（深蓝渐变 + 金色标注 + 炫光边框）

> ⚠️ **map-static-data.md 中的"城市经纬度散点数据（24城，[经度, 纬度, 指标值]）"格式仅供参考，实际使用时 JBubbleMap/JBarMap/JHeatMap 只需 `name+value`，不需要坐标字段**（系统内置城市坐标库）。坐标格式仅在 JFlyLineMap/JTotalFlyLineMap/JTotalBarMap 的指定字段中使用。

---

## 各组件专属配置速查（来源：data.ts 实测 2026-04-21）

> 以下配置项均为各组件独有、不被其他组件共享，且 map-guide 主体文档未覆盖。
> 使用时仍须先从 default_configs.json 深拷贝，再覆盖对应字段。

---

### JAreaMap — 区域地图

**⚠️ `option.geo.roam` 默认是 `false`（不可漫游），需要可拖拽时须显式设为 `true`。**

```python
# visualMap 色带文字样式（默认不显示，show=false 时无效）
cfg['option']['visualMap']['textStyle'] = {
    'color': '#ffffff', 'fontWeight': 'bold', 'fontSize': 12,
}
# tooltip 自定义字段映射（留空 = 默认展示）
cfg['option']['tooltip'] = {'fieldMapping': []}
```

| 路径 | 说明 | 默认值 |
|------|------|--------|
| `option.geo.roam` | 可漫游拖拽 | `false`（⚠️ 不是 true） |
| `option.visualMap.textStyle.color` | 色带文字颜色 | 无默认 |
| `option.visualMap.seriesIndex` | visualMap 绑定的系列 | `[0]` |
| `option.tooltip.fieldMapping` | tooltip 字段映射 | `[]` |
| `commonOption.areaColor.color2` | 渐变色终止色 | `'#fcc02e'` |

---

### JBubbleMap — 散点地图（扩展 area 字段）

散点标注比 JAreaMap 多几个独有字段：

| 路径 | 说明 | 默认值 |
|------|------|--------|
| `option.area.markerSize` | 散点基础大小 | `1.5` |
| `option.area.markerShape` | 散点形状 | `'circle'` |
| `option.area.scatterLabelColor` | 散点标签文字颜色 | `'#ffffff'` |
| `option.area.scatterLabelPosition` | 散点标签位置 | `'top'` |
| `option.area.scatterFontSize` | 散点标签字号 | `12` |
| `option.visualMap.seriesIndex` | visualMap 绑定系列 | `[1]`（不是 0） |
| `commonOption.areaColor` | 仅有 `color1`（无 color2） | `{color1:'#132937'}` |

```python
cfg['option']['area'].update({
    'markerSize': 2,
    'markerShape': 'circle',        # 'circle'/'rect'/'roundRect'/'triangle'/'diamond'
    'scatterLabelShow': True,
    'scatterLabelColor': '#FFD700',
    'scatterLabelPosition': 'top',
    'scatterFontSize': 11,
})
```

---

### JFlyLineMap — 飞线地图（飞线动画 effect）

**飞线动画完全由 `commonOption.effect` 控制，默认不文档，缺失会导致无动效：**

| 路径 | 说明 | 默认值 |
|------|------|--------|
| `commonOption.effect.show` | 开启飞线动效 | `true` |
| `commonOption.effect.trailLength` | 拖尾长度（0=无拖尾） | `0` |
| `commonOption.effect.period` | 动画周期（秒） | `6` |
| `commonOption.effect.symbolSize` | 飞点大小 | `15` |
| `option.visualMap.seriesIndex` | visualMap 绑定系列 | `[2]`（⚠️ 是2，不是0/1） |

```python
cfg['commonOption']['effect'] = {
    'show': True,
    'trailLength': 0.2,   # 0~1，越大拖尾越长
    'period': 4,
    'symbolSize': 8,
}
```

---

### JBarMap — 柱形地图（tooltip + 地图比例）

| 路径 | 说明 | 默认值 |
|------|------|--------|
| `option.tooltip.show` | 显示 tooltip | `false` |
| `option.tooltip.trigger` | 触发方式 | `'item'` |
| `option.tooltip.enterable` | 鼠标可进入 tooltip | `true` |
| `option.tooltip.textStyle.fontSize` | tooltip 字号 | `20` |
| `option.tooltip.textStyle.color` | tooltip 文字色 | `'#fff'` |
| `option.tooltip.backgroundColor` | tooltip 背景色 | `'#000259CC'` |
| `option.tooltip.fieldMapping` | 字段映射 | `[]` |
| `option.geo.aspectScale` | 地图宽高比缩放 | `0.96` |

```python
# 开启柱形地图 tooltip
cfg['option']['tooltip'] = {
    'show': True, 'trigger': 'item', 'enterable': True,
    'textStyle': {'fontSize': 14, 'color': '#fff'},
    'backgroundColor': '#000259CC',
    'fieldMapping': [],
}
```

---

### JHeatMap — 热力地图（热力点参数）

**热力效果完全由 `commonOption.heat` 控制，缺失则无热力扩散效果：**

| 路径 | 说明 | 默认值 |
|------|------|--------|
| `commonOption.heat.pointSize` | 热力点大小（px） | `6` |
| `commonOption.heat.blurSize` | 模糊扩散半径 | `13` |
| `commonOption.heat.maxOpacity` | 最大不透明度 | `1` |
| `option.visualMap.show` | 色带默认**显示** | `true`（⚠️ 与其他地图不同） |
| `option.visualMap.seriesIndex` | 绑定系列 | `[1]` |
| `commonOption.inRange.color` | 热力色阶 | `['#E08D8D','#ff9800']` |

```python
cfg['commonOption']['heat'] = {
    'pointSize': 8,     # 越大热力圆越大
    'blurSize': 20,     # 越大扩散越广
    'maxOpacity': 0.9,
}
# 热力颜色（冷→热）
cfg['commonOption']['inRange'] = {'color': ['#00bcd4', '#ff5722']}
```

---

### JTotalFlyLineMap — 时间轴飞线地图（timeline 完整配置）

**`option.timeline` 是该组件核心，控制时间轴播放行为：**

| 路径 | 说明 | 默认值 |
|------|------|--------|
| `option.timeline.show` | 显示时间轴 | `true` |
| `option.timeline.axisType` | 轴类型 | `'category'` |
| `option.timeline.autoPlay` | 自动播放 | `false`（JTotalBarMap 是 true） |
| `option.timeline.playInterval` | 播放间隔（ms） | `2000` |
| `option.timeline.left/right` | 时间轴左右位置 | `'10%'` / `'5%'` |
| `option.timeline.bottom` | 距底部距离 | `10` |
| `option.timeline.width` | 时间轴宽度 | `'80%'` |
| `option.timeline.symbolSize` | 轴点大小 | `10` |
| `option.timeline.lineStyle.color` | 轴线颜色 | `'#555555'` |
| `option.timeline.checkpointStyle.borderColor` | 当前帧圆圈颜色 | `'#777777'` |
| `option.timeline.controlStyle.showNextBtn` | 显示下一帧按钮 | `true` |
| `option.timeline.label.normal.textStyle.color` | 标签文字色 | `'#ffffff'` |
| `option.title.subtextStyle.color` | 副标题颜色 | `'#ffffff'` |

```python
# 修改时间轴样式示例
cfg['option']['timeline'].update({
    'autoPlay': True,
    'playInterval': 3000,
    'lineStyle': {'color': '#00bcd4'},
    'checkpointStyle': {'borderColor': '#00bcd4', 'borderWidth': 2},
    'label': {
        'normal': {'textStyle': {'color': '#c0e8ff'}},
        'emphasis': {'textStyle': {'color': '#ffffff'}},
    },
})
```

---

### JTotalBarMap — 柱形排名地图（右侧数据面板 + timeline）

**右侧数据统计面板由 `commonOption` 中专有字段控制（其他地图没有）：**

| 路径 | 说明 | 默认值 |
|------|------|--------|
| `commonOption.mapTitle` | 地图左上角标题 | `''` |
| `commonOption.dataTitle` | 右侧统计面板标题 | `'数据统计情况'` |
| `commonOption.dataTitleSize` | 面板标题字号 | `20` |
| `commonOption.dataTitleColor` | 面板标题颜色 | `'#ffffff'` |
| `commonOption.dataNameColor` | 面板条目名称颜色 | `'#dddddd'` |
| `commonOption.dataValueColor` | 面板条目数值颜色 | `'#dddddd'` |
| `commonOption.grid.bottom/left/top` | 右侧图表内边距 | `{bottom:50,left:75,top:20}` |
| `option.timeline.autoPlay` | 自动播放（默认 true） | `true`（⚠️ 与 JTotalFlyLineMap 不同） |
| `option.geo.show` | 地图显示 | `true` |
| `option.geo.left` | 地图左移量 | `'3%'` |

```python
# 自定义右侧数据面板
cfg['commonOption'].update({
    'mapTitle': '全国产业布局',
    'dataTitle': '区域产业统计',
    'dataTitleSize': 18,
    'dataTitleColor': '#c0e8ff',
    'dataNameColor': '#a0c8f0',
    'dataValueColor': '#FFD700',
})
```

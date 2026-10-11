# 地图组件静态数据美化方案

> 当用户需要为地图组件配置静态数据（无数据集）时，直接使用本文件中的数据，
> 无需重新设计，保证视觉效果丰富美观。
>
> **⚠️ 各数据变量格式已严格对应组件 chartData 要求，禁止跨组件套用，禁止用原始 coords 数组格式。**

---

## 省份 GDP 数据（2023年实际值，亿元）

适用组件：JAreaMap、JBarMap（省级粒度）

```python
PROVINCE_GDP = [
    {"name": "广东", "value": 135673}, {"name": "江苏", "value": 122875},
    {"name": "山东", "value": 92069},  {"name": "浙江", "value": 82553},
    {"name": "河南", "value": 61345},  {"name": "四川", "value": 60132},
    {"name": "湖北", "value": 55803},  {"name": "福建", "value": 53109},
    {"name": "湖南", "value": 50012},  {"name": "安徽", "value": 46015},
    {"name": "上海", "value": 47218},  {"name": "北京", "value": 43760},
    {"name": "河北", "value": 42370},  {"name": "陕西", "value": 33786},
    {"name": "江西", "value": 32200},  {"name": "重庆", "value": 30145},
    {"name": "辽宁", "value": 28975},  {"name": "云南", "value": 28803},
    {"name": "广西", "value": 26612},  {"name": "天津", "value": 16311},
    {"name": "内蒙古", "value": 23159}, {"name": "山西", "value": 25647},
    {"name": "贵州", "value": 20164},  {"name": "新疆", "value": 19125},
    {"name": "黑龙江", "value": 15901}, {"name": "吉林", "value": 13070},
    {"name": "甘肃", "value": 10545},  {"name": "海南", "value": 7173},
    {"name": "宁夏", "value": 5315},   {"name": "青海", "value": 3799},
    {"name": "西藏", "value": 2392},
]
```

---

## 城市指标数据（24城，name+value 格式）

适用组件：JBubbleMap、JBarMap（市级粒度）、JHeatMap
**⚠️ 直接用此格式，系统内置城市坐标库，无需传经纬度字段**

```python
CITY_NV = [
    {"name": "北京",   "value": 95}, {"name": "上海",   "value": 87},
    {"name": "广州",   "value": 73}, {"name": "深圳",   "value": 68},
    {"name": "成都",   "value": 62}, {"name": "杭州",   "value": 58},
    {"name": "武汉",   "value": 55}, {"name": "西安",   "value": 48},
    {"name": "南京",   "value": 45}, {"name": "重庆",   "value": 43},
    {"name": "天津",   "value": 40}, {"name": "郑州",   "value": 38},
    {"name": "苏州",   "value": 36}, {"name": "长沙",   "value": 34},
    {"name": "沈阳",   "value": 30}, {"name": "青岛",   "value": 28},
    {"name": "昆明",   "value": 25}, {"name": "大连",   "value": 23},
    {"name": "厦门",   "value": 21}, {"name": "哈尔滨", "value": 18},
    {"name": "宁波",   "value": 17}, {"name": "济南",   "value": 15},
    {"name": "合肥",   "value": 14}, {"name": "福州",   "value": 13},
]
```

---

## 飞线数据（15条城市间贸易/物流路线）

适用组件：JFlyLineMap
**⚠️ 必须用 fromLng/fromLat/toLng/toLat 独立字段，禁止用 coords 数组**

```python
FLY_LINE_DATA = [
    {"fromName": "北京", "toName": "上海",  "fromLng": 116.46, "fromLat": 39.92, "toLng": 121.48, "toLat": 31.22, "value": 520},
    {"fromName": "北京", "toName": "广州",  "fromLng": 116.46, "fromLat": 39.92, "toLng": 113.23, "toLat": 23.16, "value": 380},
    {"fromName": "上海", "toName": "成都",  "fromLng": 121.48, "fromLat": 31.22, "toLng": 104.06, "toLat": 30.67, "value": 260},
    {"fromName": "广州", "toName": "武汉",  "fromLng": 113.23, "fromLat": 23.16, "toLng": 114.31, "toLat": 30.52, "value": 195},
    {"fromName": "北京", "toName": "西安",  "fromLng": 116.46, "fromLat": 39.92, "toLng": 108.95, "toLat": 34.27, "value": 310},
    {"fromName": "上海", "toName": "杭州",  "fromLng": 121.48, "fromLat": 31.22, "toLng": 120.19, "toLat": 30.26, "value": 450},
    {"fromName": "成都", "toName": "重庆",  "fromLng": 104.06, "fromLat": 30.67, "toLng": 106.54, "toLat": 29.59, "value": 280},
    {"fromName": "广州", "toName": "深圳",  "fromLng": 113.23, "fromLat": 23.16, "toLng": 114.07, "toLat": 22.62, "value": 420},
    {"fromName": "北京", "toName": "沈阳",  "fromLng": 116.46, "fromLat": 39.92, "toLng": 123.38, "toLat": 41.80, "value": 175},
    {"fromName": "上海", "toName": "南京",  "fromLng": 121.48, "fromLat": 31.22, "toLng": 118.78, "toLat": 32.04, "value": 390},
    {"fromName": "武汉", "toName": "长沙",  "fromLng": 114.31, "fromLat": 30.52, "toLng": 113.00, "toLat": 28.21, "value": 215},
    {"fromName": "北京", "toName": "天津",  "fromLng": 116.46, "fromLat": 39.92, "toLng": 117.20, "toLat": 39.13, "value": 600},
    {"fromName": "成都", "toName": "昆明",  "fromLng": 104.06, "fromLat": 30.67, "toLng": 102.73, "toLat": 25.04, "value": 165},
    {"fromName": "上海", "toName": "青岛",  "fromLng": 121.48, "fromLat": 31.22, "toLng": 120.33, "toLat": 36.07, "value": 285},
    {"fromName": "广州", "toName": "福州",  "fromLng": 113.23, "fromLat": 23.16, "toLng": 119.30, "toLat": 26.08, "value": 235},
]
```

---

## 时间轴飞线数据（4季度×8路线 = 32条）

适用组件：JTotalFlyLineMap
**⚠️ 必须用 fromLng/fromLat/toLng/toLat 独立字段 + group 字段（禁止用 coords 数组，禁止用 type）**

```python
# 直接使用已生成的完整数据
TOTAL_FLY_DATA = []
periods = ['2023Q1', '2023Q2', '2023Q3', '2023Q4']
routes = [
    ("北京","上海",  116.46,39.92, 121.48,31.22),
    ("广州","北京",  113.23,23.16, 116.46,39.92),
    ("上海","成都",  121.48,31.22, 104.06,30.67),
    ("北京","西安",  116.46,39.92, 108.95,34.27),
    ("广州","深圳",  113.23,23.16, 114.07,22.62),
    ("武汉","长沙",  114.31,30.52, 113.00,28.21),
    ("上海","南京",  121.48,31.22, 118.78,32.04),
    ("成都","重庆",  104.06,30.67, 106.54,29.59),
]
base_vals = [520, 380, 260, 310, 420, 215, 390, 280]
for i, period in enumerate(periods):
    for j, (fn, tn, flo, fla, tlo, tla) in enumerate(routes):
        TOTAL_FLY_DATA.append({
            "fromName": fn, "toName": tn,
            "fromLng": flo, "fromLat": fla,
            "toLng": tlo, "toLat": tla,
            "value": base_vals[j] + i * 40 + j * 18,
            "group": period,          # 必须是 group，不是 type
        })
```

---

## 分组柱形地图数据（7大区×3产业 = 21条）

适用组件：JTotalBarMap
**⚠️ 必须用 lng/lat 独立字段 + group 字段（禁止用 coords 数组，禁止用 type）**

```python
regions_info = [
    ("华东", 121.48, 31.22), ("华南", 113.23, 23.16), ("华北", 116.46, 39.92),
    ("华中", 114.31, 30.52), ("西南", 104.06, 30.67), ("东北", 123.38, 41.80),
    ("西北", 108.95, 34.27),
]
cat_data = {
    "制造业": [28500, 18200, 15600, 22000, 19800, 12000, 10500],
    "服务业": [35800, 24600, 22000, 16500, 13200,  9800,  8200],
    "农业":   [ 4200,  5800,  6100,  8500, 12000,  9200, 15600],
}
TOTAL_BAR_DATA = []
for i, (region, lng, lat) in enumerate(regions_info):
    for cat, vals in cat_data.items():
        TOTAL_BAR_DATA.append({
            "name": region, "value": vals[i],
            "lng": lng, "lat": lat,   # 必须独立字段，不是 coords 数组
            "group": cat,             # 必须是 group，不是 type
        })
```

---

## JAreaMap 美化配置（中国地图 option 专项）

> 直接覆盖 `cfg['option']` 和 `cfg['commonOption']`，替换 default_configs.json 中的默认值。
> 已通过实测验证，效果：深蓝底色 + 蓝色炫光边框 + 金色标注点 + 五色渐变色带。

```python
# ── 覆盖 cfg['option'] ──
opt = cfg.get('option', {})
opt['drillDown'] = False
opt['area'] = {
    'name': ['中国'], 'value': ['china'],
    'markerColor': '#FFD700',
    'shadowBlur': 20, 'shadowColor': '#FFD700',
    'markerCount': 10, 'markerOpacity': 0.9,
    'markerType': 'effectScatter',
    'scatterLabelShow': True,
}
opt['geo'] = {
    'top': 40, 'zoom': 1.1, 'roam': True,
    'itemStyle': {
        'normal': {
            'borderColor': '#1bc8ff', 'areaColor': '#0d2b45',
            'borderWidth': 1, 'shadowBlur': 8,
            'shadowColor': '#1bc8ff80', 'shadowOffsetX': 0, 'shadowOffsetY': 2,
        },
        'emphasis': {'areaColor': '#ffd06690', 'borderWidth': 1}
    },
    'label': {
        'normal': {'color': '#c0e8ff', 'show': True, 'fontSize': 10},
        'emphasis': {'color': '#fff', 'show': True}
    }
}
opt['visualMap'] = {
    'min': 0, 'max': 140000,
    'top': 'bottom', 'left': '3%',
    'calculable': True, 'show': True, 'type': 'continuous',
    'seriesIndex': [0],
    'textStyle': {'color': '#c0e8ff', 'fontSize': 11},
    'inRange': {'color': ['#04387b', '#1565c0', '#1e88e5', '#29b6f6', '#ffd066']}
}
opt['title'] = {
    'show': True, 'text': '标题', 'left': 10,
    'textStyle': {'color': '#e8f4ff', 'fontSize': 16, 'fontWeight': 'bold'}
}
cfg['option'] = opt

# ── 覆盖 cfg['commonOption'] ──
cfg['commonOption'] = {
    'barSize': 10,
    'gradientColor': True,
    'breadcrumb': {'drillDown': False, 'textColor': '#FFFFFF'},
    'areaColor': {'color1': '#04387b', 'color2': '#ffd066'},
    'barColor': '#29b6f6',
    'barColor2': '#ffd066',
    'inRange': {'color': ['#04387b', '#1e88e5', '#29b6f6', '#ffd066']}
}
```

---

## 各组件 chartData 对应关系速查

| 组件 | 使用数据变量 | 备注 |
|------|------------|------|
| JAreaMap | `PROVINCE_GDP` | name 必须匹配 GeoJSON 省名，china 地图内置无需上传 |
| JBubbleMap | `CITY_NV` | name+value，系统内置城市坐标，无需经纬度 |
| JBarMap | `CITY_NV` | name+value，同散点，条形高度=值 |
| JHeatMap | `CITY_NV` | name+value，同散点，热力强度=值 |
| JFlyLineMap | `FLY_LINE_DATA` | fromLng/fromLat/toLng/toLat 独立字段 |
| JTotalFlyLineMap | `TOTAL_FLY_DATA` | 同飞线 + group 字段区分时间段 |
| JTotalBarMap | `TOTAL_BAR_DATA` | lng/lat 独立字段 + group 字段区分分类 |
| JGaoDeMap | 无（默认） | 依赖高德 API Key，不设静态数据 |

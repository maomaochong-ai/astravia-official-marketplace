# 地图类组件速查

> 涵盖：JAreaMap / JBubbleMap / JFlyLineMap / JBarMap / JHeatMap / JTotalFlyLineMap / JTotalBarMap / JGaoDeMap  
> 按需加载：当用户要添加地图类组件时，同时读本文件 + `references/map-guide.md`（详细配置）  
> 静态演示数据必须用 `references/map-static-data.md`（省份GDP/城市散点/飞线等，禁止自行设计简陋数据）

---

## 通用规则（地图类强制）

**⚠️ 地图组件必须从 default_configs.json 深拷贝 option 和 commonOption**，手工构造必然遗漏字段：

```python
import copy, json
with open('default_configs.json') as f:
    DEFAULTS = json.load(f)

d = copy.deepcopy(DEFAULTS['JAreaMap'])  # 替换为实际compType
cfg['option'] = d['option']
cfg['commonOption'] = d['commonOption']  # 地图必须设 commonOption
```

**地图 option 必须包含**：`drillDown`、`area`、`commonOption.breadcrumb`  
否则前端访问 `commonOption.breadcrumb` 报 TypeError

---

## JAreaMap（区域地图）

**尺寸** w=450 h=360  
**chartData** `[{name:'北京', value:1000}, ...]`（name=省份/城市名，value=数值）  
**dataMapping** `[{filed:'区域'},{filed:'数值'}]`  
**用途** 中国地图省份着色，颜色深浅表示数值大小

## JBubbleMap（气泡地图/散点地图）

**尺寸** w=450 h=360  
**chartData** `[{name:'北京', value:199}, {name:'天津', value:42}, ...]`  
**dataMapping** `[{filed:'区域'},{filed:'数值'}]`  
**用途** 城市散点，气泡大小/颜色表示数值

## JFlyLineMap（飞线地图）

**尺寸** w=450 h=360  
**chartData** `[{from:'北京', to:'上海', value:100}, ...]`  
**关键 option**: `commonOption.effect`（飞线动效：`trailLength`/`symbolSize`/`color`）  
**用途** 展示城市间流向/迁移

## JBarMap（柱形地图）

**尺寸** w=450 h=360  
**chartData** `[{name, value}]`  
**用途** 地图上各城市竖立柱形，高度表示数值

## JHeatMap（热力地图）

**尺寸** w=450 h=360  
**关键 option**: `commonOption.heat`（热力点配置：`blurSize`/`radius`/`minOpacity`）  
**用途** 展示密度/热度分布

## JTotalFlyLineMap（时间轴飞线地图）

**尺寸** w=450 h=360  
**关键 option**: `option.timeline`（时间轴配置）  
**用途** 随时间变化的飞线动画，配合 map-static-data.md 的时间轴飞线数据

## JTotalBarMap（柱形排名地图）

**尺寸** w=450 h=360  
**关键 option**: `option.timeline`（时间轴）；右侧数据面板  
**用途** 地图+右侧排行榜联动展示

## JGaoDeMap（高德地图）

**尺寸** w=450 h=360  
**chartData** `[{"name":"城市","value":[lng, lat, val]}]`（固定地理坐标格式）  
**必须读取专项文档**：`references/gaode-map-option-config.md`（含中心坐标/地图样式/缩放/旋转俯仰等）  
**常用城市坐标**（详见 gaode-map-option-config.md）：
- 北京：`[116.4074, 39.9042]`
- 上海：`[121.4737, 31.2304]`
- 广州：`[113.2644, 23.1291]`
- 深圳：`[114.0579, 22.5431]`

---

## 地图组件选型速查

| 需求 | 组件 |
|------|------|
| 中国地图省份着色 | JAreaMap |
| 城市散点/气泡 | JBubbleMap |
| 城市间流向/飞线 | JFlyLineMap |
| 城市竖立柱形 | JBarMap |
| 热度/密度分布 | JHeatMap |
| 带时间轴的飞线 | JTotalFlyLineMap |
| 地图+右侧排名联动 | JTotalBarMap |
| 实际地理底图（高德）| JGaoDeMap |

---

## 踩坑（地图类）

- **必须传 commonOption** `bi_utils.add_component` 不会自动从default_configs.json加载地图专属字段，必须显式深拷贝 `d['commonOption']` 传入
- **commonOption.breadcrumb** 地图 commonOption 必须含此字段，缺失前端报 TypeError
- **option 必须含 drillDown 和 area** 顶层字段，手写必然遗漏
- **chartData格式跨组件不通用** 各地图组件格式完全不同（飞线要from/to，高德要经纬度），禁止套用
- **JGaoDeMap value格式** `[lng, lat, val]` 三元素数组，不是 `{value:数值}`
- **静态数据** 必须用 `map-static-data.md` 的数据，禁止自行设计简陋数据（省份名称拼写错误导致匹配失败）
- **地图 Online表单** 必须同时设 `option`（含drillDown/area/geo/visualMap）+ `commonOption`（必含breadcrumb）

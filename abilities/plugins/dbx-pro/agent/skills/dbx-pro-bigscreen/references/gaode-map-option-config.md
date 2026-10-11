# JGaoDeMap（高德地图）配置路径

> 来源：`GaoDeMapSettings.vue`（配置面板）+ `GaoDeMap.vue`（渲染逻辑）
>
> 注意：JGaoDeMap 使用高德地图 JavaScript API，需要在项目中配置高德地图 Key。

## 中心坐标

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 中心点经度 | `option.center_longitude` | `116.397428`（北京天安门） |
| 中心点纬度 | `option.center_latitude` | `39.90923` |

## 地图样式（option.mapStyle）

| 说明 | 配置路径 | 枚举值 |
|------|---------|--------|
| 地图主题 | `option.mapStyle` | `normal`（标准）/ `dark`（深色）/ `light`（浅色）/ `whitesmoke`（白烟）/ `fresh`（清新）/ `grey`（灰色）/ `graffiti`（涂鸦）/ `macaron`（马卡龙）/ `blue`（蓝色）/ `darkblue`（深蓝）/ `wine`（酒红） |

> 大屏场景推荐使用 `dark`、`darkblue`、`blue` 等深色主题。

## 地图显示要素（option.features）

`option.features` 是数组，控制地图上显示哪些要素：

| 要素值 | 说明 |
|--------|------|
| `bg` | 背景面（显示区域底色） |
| `road` | 道路 |
| `building` | 建筑物（3D模式下有立体效果） |
| `point` | 兴趣点（地标、商铺等） |

```python
# 显示全部要素
option["features"] = ["bg", "road", "building", "point"]

# 仅显示背景和道路（简洁风格）
option["features"] = ["bg", "road"]
```

## 视图模式（option.viewMode）

| 说明 | 配置路径 | 枚举值 |
|------|---------|--------|
| 视图维度 | `option.viewMode` | `2D` / `3D` |

> 3D 模式下 `pitch`（俯仰角）才会生效。

## 缩放配置

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 初始缩放级别 | `option.zoom` | `15` |
| 最小缩放级别 | `option.minZoom` | `2` |
| 最大缩放级别 | `option.maxZoom` | `26` |

> 常用缩放参考：全国视图约 4-5，省级约 7-8，城市约 11-13，区县约 14-15，街道约 16-17。

## 旋转与俯仰

| 说明 | 配置路径 | 范围 / 默认值 |
|------|---------|--------------|
| 地图旋转角度 | `option.rotation` | `0`~`360`，默认 `0` |
| 俯仰角（3D模式） | `option.pitch` | `0`~`90`，默认 `0`；viewMode=3D 时生效 |

## 常用城市坐标参考

| 城市 | 经度 | 纬度 |
|------|------|------|
| 北京 | `116.397428` | `39.90923` |
| 上海 | `121.473701` | `31.230416` |
| 广州 | `113.264385` | `23.129112` |
| 深圳 | `114.057868` | `22.543099` |
| 杭州 | `120.153576` | `30.287459` |
| 成都 | `104.065735` | `30.659462` |
| 武汉 | `114.298572` | `30.584355` |
| 南京 | `118.796877` | `32.060255` |

## 完整 option 示例

```python
option = {
    "center_longitude": 116.397428,
    "center_latitude": 39.90923,
    "mapStyle": "darkblue",
    "features": ["bg", "road", "building", "point"],
    "viewMode": "3D",
    "zoom": 13,
    "minZoom": 2,
    "maxZoom": 26,
    "rotation": 0,
    "pitch": 45,  # 3D模式下的俯仰角
}
```

## chartData 格式（实测 2026-04-28）

> ⚠️ 旧文档曾写 `{name, value:[lng,lat,size]}` — 错误，实际 useGaode.ts 读 `data.longitude`/`data.latitude`。

每条记录必须含：
- `longitude`: 经度（数字）
- `latitude`: 纬度（数字）
- `title`: 标题（显示为 marker hover 时弹窗标题，以及 marker label 文字）
- 任意额外字段 → 对应 `infoWindow.contentFieldMapping[i].key`

```python
chart_data = [
    {
        "longitude": 116.46, "latitude": 39.92,
        "title": "湘B.8J1VS",
        "imgUrl": "drag/lib/img/car-normal.png",  # 若 showImgField=true
        "company": "小米集团", "carType": "轿车",
        "status": "正常", "time": "2025-08-08 10:00:00"
    },
    {
        "longitude": 116.38, "latitude": 39.95,
        "title": "粤A.99999",
        "imgUrl": "drag/lib/img/trucks-normal.png",
        "company": "顺丰速运", "carType": "货车",
        "status": "正常", "time": "2025-08-08 10:05:00"
    }
]
```

## marker 配置（option.marker）

| 路径 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `option.marker.imgUrl` | string | `""` | 固定图标 URL，空时 AMap 用默认 pin |
| `option.marker.showImgField` | bool | `true` | 优先从数据字段读图标 URL |
| `option.marker.imgField` | string | `"imgUrl"` | 数据中图标 URL 字段名 |
| `option.marker.width` | number | `40` | 图标宽度（px） |
| `option.marker.height` | number | `50` | 图标高度（px） |
| `option.marker.offsetX` | number | `-20` | 水平偏移（-width/2 使图标水平居中于坐标点） |
| `option.marker.offsetY` | number | `-50` | 垂直偏移（-height 使图标底部对齐坐标点） |

**内置图标路径**（项目 webpack 打包资源，生产环境用 `drag/lib/img/` 前缀）：
- `drag/lib/img/car-normal.png` — 轿车正常
- `drag/lib/img/car-abnormal.png` — 轿车异常
- `drag/lib/img/trucks-normal.png` — 货车正常
- `drag/lib/img/trucks-abnormal.png` — 货车异常
- `drag/lib/img/bg.png` — 弹窗背景图

> ⚠️ 这些路径只在部署后有效（`dist/` 构建输出），本地开发模式下需换 `/img/gaoDeMap/xxx.png`。

## infoWindow 配置（option.infoWindow）

| 路径 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `option.infoWindow.show` | bool | `true` | 是否显示弹窗 |
| `option.infoWindow.event` | string | `"hover"` | `"hover"` 划过触发 / `"click"` 点击触发 |
| `option.infoWindow.width` | number | `220` | 弹窗宽度（px） |
| `option.infoWindow.height` | number | `130` | 弹窗高度（px） |
| `option.infoWindow.padding` | number | `10` | 内边距（px） |
| `option.infoWindow.bgImgUrl` | string | `""` | 背景图 URL（优先于 bgColor） |
| `option.infoWindow.bgColor` | string | `"#0a1a2e"` | 背景色 |
| `option.infoWindow.offsetX` | number | `0` | 弹窗水平偏移 |
| `option.infoWindow.offsetY` | number | `-10` | 弹窗垂直偏移 |
| `option.infoWindow.showTitle` | bool | `true` | 显示标题行 |
| `option.infoWindow.titleField` | string | `"title"` | 数据中用作标题的字段名 |
| `option.infoWindow.titleFontSize` | number | `15` | 标题字号 |
| `option.infoWindow.titleLineHeight` | number | `30` | 标题行高 |
| `option.infoWindow.titleColor` | string | `"#ffffff"` | 标题颜色 |
| `option.infoWindow.titleFontWeight` | string | `"bold"` | `"normal"/"bold"/"lighter"` |
| `option.infoWindow.titleTextAlign` | string | `"center"` | `"left"/"center"/"right"` |
| `option.infoWindow.showContent` | bool | `true` | 显示内容行 |
| `option.infoWindow.contentColor` | string | `"#a0c8f0"` | 内容文字颜色 |
| `option.infoWindow.contentFontSize` | number | `12` | 内容字号 |
| `option.infoWindow.contentLineHeight` | number | `20` | 内容行高 |
| `option.infoWindow.contentPaddingTop` | number | `5` | 内容上边距 |
| `option.infoWindow.contentPaddingLeft` | number | `10` | 内容左边距 |
| `option.infoWindow.contentFieldMapping` | array | `[]` | 字段映射列表，格式 `[{"key":"字段名","name":"显示标签"}]` |

**contentFieldMapping 示例**（对应截图中"公司/类型/状态/时间"弹窗）：
```python
"contentFieldMapping": [
    {"key": "company", "name": "公司"},
    {"key": "carType", "name": "类型"},
    {"key": "status",  "name": "状态"},
    {"key": "time",    "name": "时间"}
]
```

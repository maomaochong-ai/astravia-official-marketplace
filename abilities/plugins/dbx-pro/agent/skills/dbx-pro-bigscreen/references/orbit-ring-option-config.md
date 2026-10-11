# JOrbitRing（轨道环形文字）配置路径

> 来源：`OrbitRingOption.vue` + `OrbitRingOptionModal.vue`（配置面板）+ `OrbitRing.vue`（渲染逻辑）

## 显示模式

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 图文模式（每项显示图片+文字） | `option.imgTextMode` | `false` |
| 图文展示形式 | `option.showType` | `"1"`（上图下文）/ `"2"`（文字居中图上）；imgTextMode=true 时生效 |

## 轨道参数

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 显示轨道环（仅设计器可见） | `option.showOrbit` | `true` |
| 轨道半径（px） | `option.orbitRadius` | 组件宽度的一半（`compConfig.w / 2`） |
| 倾角（0.2~1） | `option.tilt` | `0.55` |
| 公转速度（0.2~3） | `option.sharedSpeed` | `1` |
| 深度感强度（0~1.5） | `option.depthStrength` | `1` |
| 旋转方向 | `option.direction` | `1`（顺时针）/ `-1`（逆时针） |
| 行星项宽度（px） | `option.planetWidth` | `100` |
| 行星项高度（px） | `option.planetHeight` | `100` |

## 文字样式

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 字号 | `option.fontSize` | `14` |
| 颜色 | `option.fontColor` | `#ffffff` |
| 字重 | `option.fontWeight` | `normal` |
| 字体风格 | `option.fontStyle` | `normal` |
| 字间距 | `option.letterSpacing` | `0` |
| 渐变启用 | `option.fontGradient.enabled` | `false` |
| 渐变类型 | `option.fontGradient.type` | `linear` / `radial` |
| 渐变方向 | `option.fontGradient.direction` | `to right` |
| 渐变起始色 | `option.fontGradient.startColor` | `#000000` |
| 渐变结束色 | `option.fontGradient.endColor` | `#FFFFFF` |

## 中心点图片（option.sun）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 图片 URL | `option.sun.bgImg` | `""` |
| 图片宽度（px） | `option.sun.width` | `300` |
| 图片高度（px） | `option.sun.height` | `300` |
| 图片重复 | `option.sun.repeat` | `no-repeat` |
| 图片位置 | `option.sun.position` | `center` |
| 图片大小 | `option.sun.size` | `cover` |
| 圆角 | `option.sun.borderRadius` | `0` |
| 上下偏移（有图时） | `option.sun.offsetY` | `0` |
| 左右偏移（有图时） | `option.sun.offsetX` | `0` |

## 行星项目配置（option.items）

`option.items` 是数组，每项代表一个绕行的行星，对应 chartData 中的一条数据。

### 基础字段（items[i]）

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 显示名称 | `option.items[i].name` | `分析报告` |
| 数据值（联动用） | `option.items[i].value` | `analysis` |
| 背景图片 URL（优先于背景色） | `option.items[i].bgImg` | `""` |
| 背景颜色 | `option.items[i].bgColor` | `#1890ff` |

### 图文模式专有字段（imgTextMode=true）

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 常态图片 URL | `option.items[i].normalImgUrl` | `""` |
| 高亮图片 URL | `option.items[i].activeImgUrl` | `""` |
| 自定义宽度（0=auto） | `option.items[i].width` | `0` |
| 左边距 | `option.items[i].marginLeft` | `0` |
| 右边距 | `option.items[i].marginRight` | `0` |
| 上边距 | `option.items[i].marginTop` | `0` |
| 下边距 | `option.items[i].marginBottom` | `0` |

### 联动配置字段

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 当前高亮项的 value | `option.currentValue` | `"analysis"`（与 items[i].value 对应） |
| 切换时显示的组件 ID 列表 | `option.items[i].compVals` | `["comp_id_1", "comp_id_2"]` |

> `compVals` 控制当该项高亮时哪些组件可见，可多选页面上其他组件的 ID。

## chartData 格式

```python
chart_data = [
    {"name": "分析报告", "value": "analysis"},
    {"name": "销售概览", "value": "sales"},
    {"name": "库存管理", "value": "inventory"},
    {"name": "客户管理", "value": "customer"},
    {"name": "财务报表", "value": "finance"},
]
# name=显示文字，value=唯一标识（用于联动）
```

## 完整 option 示例

```python
option = {
    "imgTextMode": False,
    "showOrbit": True,
    "orbitRadius": 300,
    "tilt": 0.55,
    "sharedSpeed": 1,
    "depthStrength": 1,
    "direction": 1,
    "planetWidth": 100,
    "planetHeight": 100,
    "fontSize": 14,
    "fontColor": "#40A9FF",
    "fontWeight": "bold",
    "fontStyle": "normal",
    "letterSpacing": 0,
    "fontGradient": {"enabled": False},
    "sun": {"bgImg": "", "width": 200, "height": 200, "borderRadius": 100},
    "currentValue": "analysis",
    "items": [
        {"name": "分析报告", "value": "analysis", "bgColor": "#1890ff", "compVals": []},
        {"name": "销售概览", "value": "sales",    "bgColor": "#52c41a", "compVals": []},
    ],
}
```

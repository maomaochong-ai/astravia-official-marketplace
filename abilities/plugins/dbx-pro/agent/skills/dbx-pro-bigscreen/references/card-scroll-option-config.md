# JCardScroll（卡片滚动）配置路径

> 来源：`CardScrollOption.vue`（配置面板）+ `CardScroll.vue`（渲染逻辑）+ `cardScroll/config.ts`（默认值）
>
> 三个变体：`JCardScroll_1`（横向）、`JCardScroll_2`（竖向+序号）、`JCardScroll_3`（高亮+联动）
> 三者共用同一组件类型 `JCardScroll`，差异仅在 option 内容。

## 基础配置

| 说明 | 配置路径 | 枚举 / 默认值 |
|------|---------|--------------|
| 排列方向 | `option.direction` | `horizontal`（横向）/ `vertical`（竖向）；默认 `horizontal` |
| 列间隙（横向时） | `option.columnGap` | 默认 `16` |
| 行间隙（竖向时） | `option.rowGap` | 默认 `16` |

> **注意**：切换 direction 时，`scrollDirection` 会自动重置（horizontal→left，vertical→up）

## 滚动配置

| 说明 | 配置路径 | 枚举 / 默认值 |
|------|---------|--------------|
| 是否滚动 | `option.autoScrollEnabled` | 默认 `true`（内容溢出才生效） |
| 滚动方向 | `option.scrollDirection` | `left`（横向）/ `up`（竖向） |
| 每次滚动个数 | `option.scrollCount` | 默认 `1`；不能超出容器内显示数量 |
| 停留时间（ms） | `option.stayDuration` | 默认 `2000` |
| 动画时长（ms） | `option.animationDuration` | 默认 `500` |
| 滚动速度（内部） | `option.autoScrollSpeed` | 默认 `100`（面板不暴露，勿改） |

## 卡片样式（option.cardStyle）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 卡片宽度（横向时固定，竖向时自动100%） | `option.cardStyle.width` | `300` |
| 卡片高度 | `option.cardStyle.height` | `200` |
| 背景色 | `option.cardStyle.backgroundColor` | `#1890ff1a` |
| 背景图片 URL | `option.cardStyle.backgroundImage` | `""` |
| 背景图片重复 | `option.cardStyle.backgroundImageRepeat` | `no-repeat` |
| 背景图片位置 | `option.cardStyle.backgroundImagePosition` | `center` |
| 背景图片大小 | `option.cardStyle.backgroundImageSize` | `cover` |
| 高亮背景图 URL（选中项） | `option.cardStyle.bgHighlightImage` | `""` |
| 卡片圆角 | `option.cardStyle.borderRadius` | `8` |
| 显示边框 | `option.cardStyle.borderEnabled` | `true` |
| 边框颜色 | `option.cardStyle.borderColor` | `#1890ff` |
| 边框样式 | `option.cardStyle.borderStyle` | `solid` / `dashed` / `dotted` / `double`；默认 `dashed` |
| 边框宽度 | `option.cardStyle.borderWidth` | `1` |
| 上内边距 | `option.cardStyle.paddingTop` | `16` |
| 右内边距 | `option.cardStyle.paddingRight` | `16` |
| 下内边距 | `option.cardStyle.paddingBottom` | `16` |
| 左内边距 | `option.cardStyle.paddingLeft` | `16` |

> `backgroundImage` 和 `backgroundColor` 互斥：有 backgroundImage 时 backgroundColor 不渲染。

## 内容字段配置

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 显示序号 | `option.showIndex` | `false`；开启后自动在 contentFieldMapping 头部插入 `__index__` 系统字段 |
| 字段映射数组 | `option.contentFieldMapping` | 见下方「字段对象结构」|
| 当前选中字段（面板高亮，内部状态） | `option.contentCurrent` | `0` |
| 当前高亮卡片索引（内部状态） | `option.currentValue` | `0` |

### 字段对象结构（contentFieldMapping[i]）

每个字段对象包含以下子结构：

#### 字段元信息

| 说明 | 配置路径 | 示例值 |
|------|---------|--------|
| 字段显示名 | `option.contentFieldMapping[i].name` | `客户名称` |
| 数据键名（对应数据中的字段） | `option.contentFieldMapping[i].key` | `customerName` |
| 是否显示 label（字段名） | `option.contentFieldMapping[i].showLabel` | `true` / `false` |
| 是否显示 value（字段值） | `option.contentFieldMapping[i].showValue` | `true` / `false` |
| 值类型 | `option.contentFieldMapping[i].valueType` | `non-array`（默认）/ `array`（数组多行展示） |
| 是否系统字段（序号） | `option.contentFieldMapping[i].__system` | `true`（序号字段自动生成，勿手动设置） |

#### 整体布局（itemConfig）

| 说明 | 配置路径 | 枚举 / 默认值 |
|------|---------|--------------|
| 排列方式 | `option.contentFieldMapping[i].itemConfig.layoutDirection` | `row` / `row-reverse` / `column` / `column-reverse`；默认 `row` |
| 水平对齐（主轴） | `option.contentFieldMapping[i].itemConfig.justifyContent` | `flex-start` / `flex-end` / `center` / `space-between` / `space-around` / `space-evenly`；默认 `flex-start` |
| 垂直对齐（交叉轴） | `option.contentFieldMapping[i].itemConfig.alignItems` | `flex-start` / `flex-end` / `center` / `stretch` / `baseline`；默认 `center` |
| 宽度（0=auto） | `option.contentFieldMapping[i].itemConfig.width` | `0` |
| 高度（0=auto） | `option.contentFieldMapping[i].itemConfig.height` | `0` |
| 上边距 | `option.contentFieldMapping[i].itemConfig.marginTop` | `0` |
| 下边距 | `option.contentFieldMapping[i].itemConfig.marginBottom` | `0` |
| 左边距 | `option.contentFieldMapping[i].itemConfig.marginLeft` | `0` |
| 右边距 | `option.contentFieldMapping[i].itemConfig.marginRight` | `0` |

#### 省略显示（omitConfig）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 启用省略 | `option.contentFieldMapping[i].omitConfig.show` | `false`；开启时自动将 height 重置为 0 |
| 省略行数 | `option.contentFieldMapping[i].omitConfig.lines` | `1` |

#### 千分符（thousandSeparatorConfig）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 启用千分符 | `option.contentFieldMapping[i].thousandSeparatorConfig.show` | `false` |

#### label 样式（nameStyle）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 字号 | `option.contentFieldMapping[i].nameStyle.fontSize` | `12` |
| 颜色 | `option.contentFieldMapping[i].nameStyle.fontColor` | `#cccccc` |
| 字重 | `option.contentFieldMapping[i].nameStyle.fontWeight` | `normal` |
| 字体风格 | `option.contentFieldMapping[i].nameStyle.fontStyle` | `normal` |
| 字间距 | `option.contentFieldMapping[i].nameStyle.letterSpacing` | `0` |
| 字体族 | `option.contentFieldMapping[i].nameStyle.fontFamily` | `""` |
| 宽度（label+value都显示时） | `option.contentFieldMapping[i].nameStyle.width` | `0` |
| 上/下/左/右边距 | `option.contentFieldMapping[i].nameStyle.marginTop/Bottom/Left/Right` | `0` |
| 渐变启用 | `option.contentFieldMapping[i].nameStyle.fontGradient.enabled` | `false` |
| 渐变类型 | `option.contentFieldMapping[i].nameStyle.fontGradient.type` | `linear` / `radial` |
| 渐变方向 | `option.contentFieldMapping[i].nameStyle.fontGradient.direction` | `to right` |
| 渐变起始色 | `option.contentFieldMapping[i].nameStyle.fontGradient.startColor` | `#000000` |
| 渐变结束色 | `option.contentFieldMapping[i].nameStyle.fontGradient.endColor` | `#FFFFFF` |

#### label 组合显示（nameCompose）

| 说明 | 配置路径 | 说明 |
|------|---------|------|
| 启用组合 | `option.contentFieldMapping[i].nameCompose.enabled` | `false` |
| 前缀文字 | `option.contentFieldMapping[i].nameCompose.prefix` | 如 `差旅费：` |
| 后缀文字 | `option.contentFieldMapping[i].nameCompose.suffix` | 如 `元` |
| 前缀样式 | `option.contentFieldMapping[i].nameCompose.prefixStyle.fontSize/fontColor/...` | 同 nameStyle 字段 |
| 内容样式 | `option.contentFieldMapping[i].nameCompose.contentStyle.fontSize/fontColor/...` | 同 nameStyle 字段 |
| 后缀样式 | `option.contentFieldMapping[i].nameCompose.suffixStyle.fontSize/fontColor/...` | 同 nameStyle 字段 |

#### value 样式（valueStyle）

| 说明 | 配置路径 | 默认值 |
|------|---------|--------|
| 字号 | `option.contentFieldMapping[i].valueStyle.fontSize` | `14` |
| 颜色 | `option.contentFieldMapping[i].valueStyle.fontColor` | `#1890ff` |
| 字重 | `option.contentFieldMapping[i].valueStyle.fontWeight` | `bold` |
| 字体风格 | `option.contentFieldMapping[i].valueStyle.fontStyle` | `normal` |
| 字间距 | `option.contentFieldMapping[i].valueStyle.letterSpacing` | `0` |
| 字体族 | `option.contentFieldMapping[i].valueStyle.fontFamily` | `""` |
| 上/下/左/右边距 | `option.contentFieldMapping[i].valueStyle.marginTop/Bottom/Left/Right` | `0` |
| 渐变启用 | `option.contentFieldMapping[i].valueStyle.fontGradient.enabled` | `false` |
| 渐变类型 | `option.contentFieldMapping[i].valueStyle.fontGradient.type` | `linear` / `radial` |
| 渐变方向 | `option.contentFieldMapping[i].valueStyle.fontGradient.direction` | `to bottom` |
| 渐变起始色 | `option.contentFieldMapping[i].valueStyle.fontGradient.startColor` | — |
| 渐变结束色 | `option.contentFieldMapping[i].valueStyle.fontGradient.endColor` | — |

#### value 组合显示（valueCompose）

| 说明 | 配置路径 | 说明 |
|------|---------|------|
| 启用组合 | `option.contentFieldMapping[i].valueCompose.enabled` | `false`；valueType=array 时强制关闭 |
| 前缀文字 | `option.contentFieldMapping[i].valueCompose.prefix` | 如 `NO.` |
| 后缀文字 | `option.contentFieldMapping[i].valueCompose.suffix` | 如 `万元` |
| 前缀样式 | `option.contentFieldMapping[i].valueCompose.prefixStyle.fontSize/fontColor/...` | 同 valueStyle |
| 内容样式 | `option.contentFieldMapping[i].valueCompose.contentStyle.fontSize/fontColor/...` | 同 valueStyle |
| 后缀样式 | `option.contentFieldMapping[i].valueCompose.suffixStyle.fontSize/fontColor/...` | 同 valueStyle |

## chartData 格式

数据是数组，每条记录是一个卡片。字段名对应 `contentFieldMapping[i].key`：

```python
# JCardScroll_1 / JCardScroll_2 默认数据格式
chart_data = [
    {"rank": 1, "customerName": "北京华信科技有限公司", "contractAmount": 8000},
    {"rank": 2, "customerName": "上海智远信息技术股份有限公司", "contractAmount": 7800},
]

# JCardScroll_3 支持 array 类型字段（显示为多行列表项）
chart_data = [
    {"projectName": "苏州地铁5号线工程", "status": "一期", "paymentMethod": "分期",
     "type": ["建筑工程", "市政工程"]},
]
```

## 三个变体的关键差异

| 变体 | direction | scrollDirection | 序号 | 高亮图片 | 特色 |
|------|-----------|----------------|------|---------|------|
| JCardScroll_1（横向） | `horizontal` | `left` | 无 | 无 | 卡片宽98px，背景图，渐变数值 |
| JCardScroll_2（竖向+序号） | `vertical` | `up` | 有（系统字段） | 无 | valueCompose 组合显示序号 |
| JCardScroll_3（高亮） | `horizontal` | `left` | 有 | 有 | bgHighlightImage 切换高亮，array 类型字段 |

## 完整字段对象示例（带渐变值）

```python
field_item = {
    "name": "合同额(万元)",
    "key": "contractAmount",
    "showLabel": True,
    "showValue": True,
    "valueType": "non-array",
    "itemConfig": {
        "layoutDirection": "column",    # 字段名在上，值在下
        "justifyContent": "center",
        "alignItems": "center",
        "width": 0,
        "height": 100,
        "marginTop": 0,
        "marginBottom": 0,
        "marginLeft": 0,
        "marginRight": 0,
    },
    "nameStyle": {
        "fontSize": 12,
        "fontColor": "#B0B0B0",
        "fontWeight": "normal",
    },
    "nameCompose": {"enabled": False},
    "valueStyle": {
        "fontSize": 18,
        "fontColor": "#40A9FF",
        "fontWeight": "bold",
        "fontGradient": {
            "enabled": True,
            "type": "linear",
            "direction": "to bottom",
            "startColor": "#96F5F8",
            "endColor": "#49ABFF",
        },
    },
    "valueCompose": {
        "enabled": False,
        "suffix": "万元",
        "suffixStyle": {"fontSize": 14, "fontColor": "#40A9FF"},
    },
    "omitConfig": {"show": False, "lines": 1},
    "thousandSeparatorConfig": {"show": True},
}
```

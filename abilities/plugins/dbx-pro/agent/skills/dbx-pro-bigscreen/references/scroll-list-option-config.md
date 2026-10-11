# JScrollList（滚动列表）配置路径

> **来源**：`config.ts`（默认数据结构，实测）+ `ScrollListOption.vue`（面板配置项，实测 2026-04-21）
>
> ⚠️ **三个变体 compType 均为 `JScrollList`**，不能用 `JScrollList_1/2/3`（前端无法识别，组件不显示）。
> 变体通过 `option` 内的字段组合区分，见下方「变体区分规则」。

---

## 变体区分规则（必读）

| 变体 | compType | `showHeader` | `showIndex` | `itemsPerRow` | 特点 |
|------|---------|-------------|-------------|--------------|------|
| 单行（无表头/序号） | `JScrollList` | `false` | 不设 / `false` | `1` | 简洁单列滚动 |
| 多行+序号 | `JScrollList` | `false` | `true` | `2` | 两列并排 + 左侧序号 |
| 带表头 | `JScrollList` | `true` | `true` | `1` | 顶部固定表头行 |

---

## 容器基础配置

| 说明 | 配置路径 | 类型 | 默认值 |
|------|---------|------|--------|
| 容器背景色 | `option.backgroundColor` | color | `#FFFFFF00`（透明） |
| 圆角 | `option.borderRadius` | number | `0` |
| 每行列数 | `option.itemsPerRow` | number | `1`（变体2用`2`） |
| 显示表头行 | `option.showHeader` | boolean | `false` |
| 显示序号列 | `option.showIndex` | boolean | `false` |
| 启用自动滚动 | `option.autoScrollEnabled` | boolean | `true` |
| 网格间距 | `option.gridGap` | number | `8` |
| 当前高亮行 | `option.currentValue` | number | `0` |

---

## 行样式（option.row）

| 说明 | 配置路径 | 类型 | 可选值 / 默认值 |
|------|---------|------|----------------|
| 行高 | `option.row.height` | number | `44` |
| 行底部间距 | `option.row.marginBottom` | number | `10` |
| 行左边距 | `option.row.marginLeft` | number | `0` |
| 行右边距 | `option.row.marginRight` | number | `0` |
| 背景类型 | `option.row.backgroundType` | string | `'color'`（纯色）/ `'image'`（图片） |
| 奇行背景色 | `option.row.backgroundColor` | color | `#FFFFFF` |
| 偶行背景色 | `option.row.alternateBackgroundColor` | color | `#F8F9FA` |
| 背景图片 | `option.row.backgroundImg` | string | 图片路径 / require 路径（⚠️ 是 `backgroundImg` 不是 `backgroundImage`） |
| 背景图尺寸 | `option.row.backgroundSize` | string | `'100% 100%'` |
| 背景图重复 | `option.row.backgroundRepeat` | string | `'no-repeat'` |
| 多行显示 | `option.row.isMultiline` | boolean | `false` |

---

## 表头样式（option.header）— 仅 `showHeader:true` 时生效

| 说明 | 配置路径 | 类型 | 默认值 |
|------|---------|------|--------|
| 表头高度 | `option.header.height` | number | `43` |
| 内边距 | `option.header.padding` | string | `'8px 0'` |
| 背景色 | `option.header.backgroundColor` | color | `#003B6F` |
| 文字颜色 | `option.header.fontColor` | color | `#FFFFFF` |
| 字号 | `option.header.fontSize` | number | `16` |
| 字重 | `option.header.fontWeight` | string | `'bold'` |
| 字体风格 | `option.header.fontStyle` | string | `'normal'` |
| 文字对齐 | `option.header.textAlign` | string | `'center'` / `'left'` / `'right'` |
| 渐变启用 | `option.header.fontGradient.enabled` | boolean | `false` |
| 渐变起始色 | `option.header.fontGradient.startColor` | color | `#000000` |
| 渐变结束色 | `option.header.fontGradient.endColor` | color | `#FFFFFF` |

---

## 序号列样式（option.indexFieldStyle）— 仅 `showIndex:true` 时生效

| 说明 | 配置路径 | 类型 | 默认值 |
|------|---------|------|--------|
| 列宽 | `option.indexFieldStyle.width` | number | `28` |
| 左边距 | `option.indexFieldStyle.marginLeft` | number | `15` |
| 文字对齐 | `option.indexFieldStyle.textAlign` | string | `'center'` |
| 字号 | `option.indexFieldStyle.textStyle.fontSize` | number | `21` |
| 字体颜色 | `option.indexFieldStyle.textStyle.fontColor` | color | `#FFFFFF` |
| 字体样式 | `option.indexFieldStyle.textStyle.fontStyle` | string | `'italic'` |
| 渐变启用 | `option.indexFieldStyle.textStyle.fontGradient.enabled` | boolean | `false` |
| 渐变类型 | `option.indexFieldStyle.textStyle.fontGradient.type` | string | `'linear'` |
| 渐变方向 | `option.indexFieldStyle.textStyle.fontGradient.direction` | string | `'to bottom'` |
| 渐变起始色 | `option.indexFieldStyle.textStyle.fontGradient.startColor` | color | `#D4BA28` |
| 渐变结束色 | `option.indexFieldStyle.textStyle.fontGradient.endColor` | color | `#F54100` |

---

## 字段列配置（option.fieldMapping[]）

`fieldMapping` 是数组，每项对应一个数据列。`showIndex:true` 时，系统自动在头部插入 `key:'__index__'` 的序号列。

### 列对象基础字段

| 说明 | 配置路径 | 类型 | 默认值 |
|------|---------|------|--------|
| 列显示名（表头） | `fieldMapping[i].name` | string | `'列名'` |
| 数据字段 key | `fieldMapping[i].key` | string | 对应 chartData 字段名 |
| 列宽（像素） | `fieldMapping[i].width` | number | `0` |
| 文字对齐 | `fieldMapping[i].textAlign` | string | `'left'` |

> ⚠️ **width 规则（实测 2026-05-13）**：必须是**数字像素**，不是百分比字符串。
> - `width > 0` → 该列固定 N 像素
> - `width = 0` → 自动填充剩余宽度（其他列定宽后均分剩余空间）
> - **所有列 width 全 0** → 按列数均分容器宽度
> - 写 `"50%"`/`"25%"` 等百分比字符串无效，平台 fallback 0；只有部分列写百分比时，会造成"自动列意外吞掉剩余宽度"。spec_builder `handle_JScrollList` 已加防呆，检测字符串 width 自动改 0 并告警
| 左边距 | `fieldMapping[i].marginLeft` | number | `0` |
| 右边距 | `fieldMapping[i].marginRight` | number | `0` |

### 文字样式（fieldMapping[i].textStyle）

⚠️ 路径是 `textStyle`，不是 `style`。

| 说明 | 配置路径 |
|------|---------|
| 字号 | `fieldMapping[i].textStyle.fontSize` |
| 字体颜色 | `fieldMapping[i].textStyle.fontColor` |
| 字重 | `fieldMapping[i].textStyle.fontWeight` |
| 字体样式 | `fieldMapping[i].textStyle.fontStyle` |
| 渐变启用 | `fieldMapping[i].textStyle.fontGradient.enabled` |
| 渐变类型 | `fieldMapping[i].textStyle.fontGradient.type` |
| 渐变方向 | `fieldMapping[i].textStyle.fontGradient.direction` |
| 渐变起始色 | `fieldMapping[i].textStyle.fontGradient.startColor` |
| 渐变结束色 | `fieldMapping[i].textStyle.fontGradient.endColor` |

### 前缀/后缀组合（fieldMapping[i].compose）— 可选

| 说明 | 配置路径 | 类型 |
|------|---------|------|
| 启用组合 | `fieldMapping[i].compose.enabled` | boolean |
| 前缀文字 | `fieldMapping[i].compose.prefix` | string |
| 前缀样式 | `fieldMapping[i].compose.prefixStyle.fontColor/fontSize` | style |
| 后缀文字 | `fieldMapping[i].compose.suffix` | string |
| 后缀样式 | `fieldMapping[i].compose.suffixStyle.fontColor/fontSize` | style |
| 内容样式 | `fieldMapping[i].compose.contentStyle` | style（含 fontSize/fontColor/fontStyle/fontGradient/marginLeft/marginRight） |

---

## chartData 格式

字段名与 `fieldMapping[i].key` 对应，按需定义业务字段：

```json
[
  {"projectName": "项目A", "officeFee": 1200, "travelFee": 5600, "arrearsAmount": 3000},
  {"projectName": "项目B", "officeFee": 800,  "travelFee": 4200, "arrearsAmount": 0}
]
```

序号列（`key: '__index__'`）由系统自动注入，无需在 chartData 中提供。

---

## 三变体完整 option 最小配置示例

### 变体1：单行

```python
option = {
    'backgroundColor': '#FFFFFF00',
    'showHeader': False,
    'showIndex': False,
    'itemsPerRow': 1,
    'autoScrollEnabled': True,
    'borderRadius': 8,
    'row': {
        'height': 48, 'marginBottom': 8, 'backgroundType': 'color',
        'backgroundColor': '#001433', 'alternateBackgroundColor': '#00224e',
    },
    'fieldMapping': [
        {'name': '项目名称', 'key': 'projectName', 'width': 120,
         'textStyle': {'fontSize': 15, 'fontColor': '#FFFFFF', 'fontWeight': 'bold'}},
        {'name': '金额', 'key': 'amount', 'width': 0,
         'compose': {'enabled': True, 'suffix': '元',
                     'suffixStyle': {'fontColor': '#FFFFFF'},
                     'contentStyle': {'fontSize': 16, 'fontColor': '#06CFC8', 'fontStyle': 'italic'}}},
    ],
}
```

### 变体2：多行+序号

```python
option = {
    'backgroundColor': '#FFFFFF00',
    'showHeader': False,
    'showIndex': True,
    'itemsPerRow': 2,
    'autoScrollEnabled': True,
    'borderRadius': 8,
    'indexFieldStyle': {
        'width': 30, 'marginLeft': 12,
        'textStyle': {
            'fontSize': 20, 'fontColor': '#FFFFFF', 'fontStyle': 'italic',
            'fontGradient': {'enabled': True, 'type': 'linear', 'direction': 'to bottom',
                             'startColor': '#FFD700', 'endColor': '#FF4500'},
        },
    },
    'row': {
        'height': 48, 'marginBottom': 8, 'backgroundType': 'color',
        'backgroundColor': '#001433', 'alternateBackgroundColor': '#001e40',
    },
    'fieldMapping': [
        {'name': '车牌', 'key': 'plateNumber', 'width': 90,
         'textStyle': {'fontSize': 15, 'fontColor': '#FFFFFF', 'fontWeight': 'bold'}},
        {'name': '违规', 'key': 'violationCount', 'width': 100,
         'compose': {'enabled': True, 'suffix': '次',
                     'suffixStyle': {'fontSize': 16, 'fontColor': '#FFFFFF'},
                     'contentStyle': {'fontSize': 22, 'fontStyle': 'italic',
                                      'fontGradient': {'enabled': True, 'type': 'linear',
                                                       'startColor': '#00D4FF', 'endColor': '#0066CC',
                                                       'direction': 'to bottom'}}}},
    ],
}
```

### 变体3：带表头

```python
option = {
    'backgroundColor': '#FFFFFF00',
    'showHeader': True,
    'showIndex': True,
    'itemsPerRow': 1,
    'autoScrollEnabled': True,
    'borderRadius': 6,
    'header': {
        'height': 43, 'padding': '8px 0', 'textAlign': 'center',
        'backgroundColor': '#003B6F', 'fontColor': '#FFFFFF',
        'fontSize': 16, 'fontWeight': 'bold',
    },
    'indexFieldStyle': {
        'width': 38, 'marginLeft': 3, 'textAlign': 'center',
        'textStyle': {'fontSize': 21, 'fontColor': '#FFFFFF', 'fontStyle': 'italic',
                      'fontGradient': {'enabled': True, 'type': 'linear', 'direction': 'to bottom',
                                       'startColor': '#D4BA28', 'endColor': '#F54100'}},
    },
    'row': {
        'height': 44, 'marginBottom': 1, 'backgroundType': 'color',
        'backgroundColor': '#001E3C', 'alternateBackgroundColor': '#00284E',
    },
    'fieldMapping': [
        {'name': '车牌号', 'key': 'plateNumber', 'width': 0, 'textAlign': 'center',
         'textStyle': {'fontSize': 15, 'fontColor': '#FFFFFF', 'fontWeight': 'bold'}},
        {'name': '违规次数', 'key': 'violationCount', 'width': 0, 'textAlign': 'center',
         'textStyle': {'fontColor': '#FFFFFF'}},
    ],
}
```

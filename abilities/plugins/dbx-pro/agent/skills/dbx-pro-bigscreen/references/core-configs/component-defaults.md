# 大屏组件默认配置完整参考

> 提取自 `packages/dragEngine/components/bigScreenComponents/data.ts`
> 所有组件通过 `menuData` 数组注册，每个组件的 `compConfig` 包含默认尺寸、数据、选项。

---

## 高级组件技术要点（非 ECharts 组件）

以下组件不使用 ECharts，而是通过 `useDataSource()` hooks 接收 `config.chartData` 和 `config.option` 进行自渲染。
它们的默认配置来自各自的 `config.ts` 文件（不在 data.ts 中内联），已全部内联到 `default_configs.json`。

| 组件 | compType | 配置源 | 变体数 | 特殊说明 |
|------|----------|--------|--------|---------|
| 列表进度图 | JListProgress | `listProgress/config.ts` | 1 | 支持滚动动画、进度条超值警告、多字段组合显示 |
| 圆形进度图 | JRoundProgress | `roundProgress/config.ts` | 1 | 基于 ECharts polar + gauge，支持渐变色 |
| 半圆仪表盘 | JSemiGauge | `semiGauge/config.ts` | 1 | 多层 gauge 叠加，config.ts 含 `echarts.graphic.LinearGradient`（已降级为纯 JSON） |
| 日历 | JPermanentCalendar | `permanentCalendar/config.ts` | 1 | data 由 `generatePermanentCalendarData()` 动态生成当前月份日期 |
| 卡片轮播 | JCardCarousel | `cardCarousel/config.ts` | 1 | 支持自动横向滚动、背景图（`require()` 路径已置空） |
| 统计概览 | JStatsSummary | `statsSummary/config.ts` | 3 | 卡片/背景/高亮三种模式，使用工厂函数展开样式（已内联） |
| 滚动列表 | JScrollList | `scrollList/config.ts` | 3 | 单行/多行+序号/带表头，data 由生成函数产出（已内联） |
| 卡片滚动 | JCardScroll | `cardScroll/config.ts` | 3 | 基础/竖向+序号/高亮三种变体 |
| 断环图 | JBreakRing | `echarts/JBreakRing/config.ts` | 1 | 基于 ECharts polar |
| 轨道环 | JOrbitRing | `orbitRing/config.ts` | 1 | 卫星环绕动画 |
| 胶囊图 | JCapsuleChart | 无 config.ts（内联在 data.ts） | 1 | 配置直接写在 menuData 中 |

### default_configs.json 中的 key 命名规则

- 基础变体：`JScrollList`、`JStatsSummary_1`
- 带中文后缀变体：`JScrollList_滚动列表(多行+序号)`、`JCardScroll_卡片滚动(高亮)`

---

## 通用 compConfig 结构模板

```javascript
compConfig: {
  w: 450,              // 宽度（像素）
  h: 300,              // 高度（像素）
  dataType: 1,         // 1=静态/URL, 2=数据集, 4=自定义
  url: 'http://api.jeecg.com/mock/33/chart',  // 默认 API
  timeOut: 0,          // 请求超时（0=无限）
  background: '#FFFFFF00',  // 透明背景
  turnConfig: { url: '', type: '_blank' },
  linkType: 'url',
  linkageConfig: [],
  markLineConfig: { show: false, markLine: [] },
  dataMapping: [
    { filed: '维度', mapping: '' },
    { filed: '数值', mapping: '' },
  ],
  chartData: [],       // 组件特定数据
  option: {},          // 组件特定配置
}
```

---

## 一、柱形图系列

### JBar（基础柱形图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name: '苹果', value: 1000, type: '手机品牌'}, ...]`
- **dataMapping**: `[{filed:'维度'}, {filed:'数值'}]`
- **option**:
  ```
  grid: {show:false, top:30, bottom:18, right:40, left:0, containLabel:true}
  card: {title:'', extra:'', rightHref:'', size:'default'}
  title: {text:'', show:true, textAlign:'left', textStyle:{fontWeight:'normal'}}
  tooltip: {trigger:'axis', textStyle:{color:'#EEF1FA'}, axisPointer:{type:'shadow'}}
  xAxis: {axisLabel:{color:'#EEF1FA'}}
  yAxis: {yUnit:'', axisLabel:{color:'#EEF1FA'}, splitLine:{show:false, interval:2, lineStyle:{color:'#8F8D8D'}}}
  series: [{data:[], type:'bar', barWidth:40, itemStyle:{color:'#64b5f6', borderRadius:0}, label:{position:'top'}}]
  ```

### JStackBar（堆叠柱形图）
- **尺寸**: w=450, h=300
- **url**: `http://api.jeecg.com/mock/26/stackedBar`
- **chartData**: `[{name, value, type}]`（type 字段用于分组堆叠）
- **dataMapping**: `[{filed:'分组'}, {filed:'维度'}, {filed:'数值'}]`
- **option**: 同 JBar，series 中 stack 属性启用

### JDynamicBar（动态柱形图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value, type}]`
- **option**: 同 JBar + 动画配置

### JCapsuleChart（胶囊柱形图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value}]`

### JHorizontalBar（水平柱形图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value, type}]`
- **option**: xAxis/yAxis 互换

### JBackgroundBar（背景柱形图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value}]`

### JMultipleBar（对比柱形图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value, type}]`（type 区分多系列）

### JNegativeBar（负数柱形图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value}]`（value 可为负数）

### JPercentBar（百分比柱形图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value}]`

### JMixLineBar（混合折线柱形）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value, type}]`
- **option**: series 含 bar + line 两种 type

---

## 二、折线图系列

### JLine（基础折线图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`
- **option**: series type='line'

### JSmoothLine（平滑曲线图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`
- **option**: series smooth=true

### JStepLine（阶梯折线图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`
- **option**: series step=true

### JArea（面积图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`
- **option**: series areaStyle 启用

### JMultipleLine（多条折线图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name, type}]`（type 区分多系列）

### DoubleLineBar（折线柱形混合/双轴图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name, type}]`

---

## 三、饼图/环形图系列

### JPie（饼图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`
- **option**: innerRadius, outRadius, series type='pie', legend, tooltip trigger='item'

### JRose（南丁格尔玫瑰图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`

### JRotatePie（旋转饼图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`

### JRing（饼状环形图）
- **尺寸**: w=480, h=300
- **chartData**: `[{value, name}]`
- **option**: series radius=['40%','70%']

### JBreakRing（多色环形图/断裂环形）
- **尺寸**: w=480, h=300
- **chartData**: 从 `breakRingData` 导入
- **option**: 从 `breakRingOption` 导入

### JRingProgress（环形进度图）
- **尺寸**: w=300, h=300
- **chartData**: `[{value}]`

### JActiveRing（动态环形图）
- **尺寸**: w=480, h=300
- **chartData**: `[{value, name}]`

### JRadialBar（径向柱形图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`

---

## 四、进度图系列

### JCustomProgress（基础进度图）
- **尺寸**: w=450, h=100
- **chartData**: `[{name, value}]`
- **option**: barWidth, padding, progressColor, backgroundColor, titleColor, titleFontSize, valueColor, valueFontSize

### JProgress（进度图）
- **尺寸**: w=450, h=100
- **chartData**: `[{name, value}]`

### JListProgress（列表进度图）
- **chartData**: `[{name, value}]`
- **option**: 从 `ListProgressOption` 导入，数据从 `ListProgressData` 导入

### JRoundProgress（圆形进度图）
- **尺寸**: w=200, h=200
- **chartData**: `[{value}]`
- **option**: 从 `roundProgressOption` 导入

### JLiquid（液体进度图/水球图）
- **尺寸**: w=300, h=300
- **chartData**: `[{value}]`

---

## 五、仪表盘系列

### JGauge（基础仪表盘）
- **尺寸**: w=400, h=300
- **chartData**: `[{value, name, max}]`
- **option**: gauge series, startAngle, endAngle, min, max

### JColorGauge（多色仪表盘）
- **尺寸**: w=400, h=300
- **chartData**: `[{value, name, max}]`

### JAntvGauge（渐变仪表盘）
- **尺寸**: w=400, h=300
- **chartData**: `[{value, name, max}]`

### JSemiGauge（半圆仪表盘）
- **尺寸**: w=400, h=300
- **chartData**: `[{value, name, max}]`
- **option**: 从 `semiGaugeOption` 导入

---

## 六、散点图系列

### JScatter（普通散点图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value}]`（name=X, value=Y）

### JQuadrant（象限图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value}]`

### JBubble（气泡图）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value}]`（含 size 维度）

---

## 七、漏斗图系列

### JFunnel（普通漏斗图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`
- **option**: reversal, series sort='descending'

### JPyramidFunnel（金字塔漏斗）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`

### JPyramid3D（3D金字塔）
- **尺寸**: w=750, h=540
- **chartData**: `[{value, name}]`

---

## 八、雷达图系列

### JRadar（普通雷达图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name, type, max}]`
- **option**: radar indicator[], series type='radar'

### JCircleRadar（圆形雷达图）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name, type, max}]`

---

## 九、3D图表系列

### JBar3d（3D柱形图）
- **尺寸**: w=490, h=332
- **chartData**: `[{name, value}]`
- **option**: graphic, grid, series 含多 color ID

### JBarGroup3d（3D分组柱形）
- **尺寸**: w=490, h=332
- **chartData**: `[{name, value, type}]`

---

## 十、其他图表

### JPictorialBar（象形柱形图）
- **尺寸**: w=450, h=300, **chartData**: `[{name, value}]`

### JPictorial（象形图）
- **尺寸**: w=450, h=300, **chartData**: `[{name, value}]`

### JGender（性别占比）
- **尺寸**: w=450, h=300, **chartData**: `[{name, value}]`

### JRectangle（矩形树图）
- **尺寸**: w=450, h=300, **chartData**: `[{name, value, children}]`

### JWordCloud（词云）
- **尺寸**: w=650, h=400, **chartData**: `[{value, name}]`

### JImgWordCloud（图片词云）
- **尺寸**: w=650, h=400

### JFlashCloud（闪动词云）
- **尺寸**: w=650, h=400, **chartData**: `[{value, name}]`

---

## 十一、UI 装饰类组件（菜单：图表 → 装饰 wrapper）

> "装饰" 在源码菜单中是双层语义：wrapper（含边框/装饰条/图片/图标/图库）vs 子菜单（仅 JDragDecoration）。用户口语"装饰"默认按子菜单理解 = JDragDecoration × 12。详见 `bi-component-types.md` 第三节。

### JDragBorder（边框 1~13）
- **尺寸**: w=450, h=300
- **option**: `{type:'1'~'13', title:'', titleWidth, mainColor:'#83bff6', subColor:'#00CED1', backgroundColor:'#ffffff00', reverse:false, dur:number}`

### JDragDecoration（装饰 1~12）
- **尺寸**: w=450, h=300
- **option**: `{type:'1'~'12'}`（12种装饰图案）

---

## 十二、图片/轮播

### JImg（图片）
- **尺寸**: w=200, h=200
- **chartData**: URL 图片地址

### JCarousel（轮播图）
- **尺寸**: w=600, h=400
- **chartData**: 多张图片 URL

---

## 十三、文字组件

### JText（文本）
- **尺寸**: w=170, h=60
- **chartData**: `{value: string}`
- **option**: body: {text, color, fontWeight, marginLeft, marginTop, letterSpacing}

### JCountTo（翻牌器）
- **尺寸**: w=300, h=80
- **chartData**: `{value: number}`
- **option**: whole, boxWidth, boxHeight, fontSize, color, prefixFontSize, suffixFontSize

### JColorBlock（色块）
- **尺寸**: w=100, h=100
- **chartData**: `{color}`

### JCurrentTime（当前时间）
- **尺寸**: w=200, h=50
- **chartData**: 自动生成实时时钟

### JNumber（数字）
- **尺寸**: w=150, h=50
- **chartData**: `{value: number}`

### JOrbitRing（轨道环）
- **尺寸**: w=750, h=540
- **option/data**: 从 `orbitRingOption/orbitRingData` 导入

### JWeatherForecast（天气预报）
- **尺寸**: w=300, h=custom
- **chartData**: API 天气数据

---

## 十四、表格/列表

### JScrollBoard（翻滚表格）
- **尺寸**: w=450, h=300
- **chartData**: `[[row1col1, row1col2, ...], [row2col1, ...]]`
- **option**: header[], headerBGC, waitTime, carousel:'single'|'page', rowNum, hoverPause

### JScrollTable（表格）
- **尺寸**: w=450, h=300
- **chartData**: `[{key: value, ...}]`
- **option**: header[{label, key, width}], syncColumn, dynamicColumn

### JCommonTable（通用表格）
- **尺寸**: w=450, h=300
- **chartData**: `[{...}]`

### JList（列表）
- **尺寸**: w=450, h=300

### JScrollRankingBoard（排行榜）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value, rank}]`

### JFlashList（闪动列表）
- **尺寸**: w=450, h=300

### JBubbleRank（气泡排行）
- **尺寸**: w=450, h=300
- **chartData**: `[{name, value}]`

### JScrollList（滚动列表）
- **尺寸**: w=450, h=300
- **chartData**: 从 `ScrollListData/Data1/Data2` 导入
- **option**: 从 `ScrollListOption/Option1/Option2` 导入（3种变体）

---

## 十五、地图

### JBubbleMap（气泡地图）
- **尺寸**: w=450, h=360
- **chartData**: `[{name:'北京', value:199}, {name:'天津', value:42}, ...]`
- **dataMapping**: `[{filed:'区域'}, {filed:'数值'}]`
- **option**: jsConfig, activeKey

### JFlyLineMap（飞线地图）
- **尺寸**: w=450, h=360
- **chartData**: `[{from, to, value}]`

### JBarMap（柱形地图）
- **尺寸**: w=450, h=360
- **chartData**: `[{name, value}]`

### JTotalFlyLineMap（总飞线地图）
- **尺寸**: w=450, h=360

### JTotalBarMap（总柱形地图）
- **尺寸**: w=450, h=360

### JHeatMap（热力地图）
- **尺寸**: w=450, h=360

### JAreaMap（区域地图）
- **尺寸**: w=450, h=360
- **chartData**: `[{name, value}]`

### JGaoDeMap（高德地图）
- **尺寸**: w=450, h=360
- **option/data**: 从 `gaoDeMapOption/gaoDeMapData` 导入

---

## 十六、视频

### JVideoPlay（视频播放）
- **尺寸**: w=450, h=300

### JVideoJs（视频播放器）
- **尺寸**: w=450, h=300

---

## 十七、表单/交互

### JSelectRadio（单选框）
- **尺寸**: w=400, h=80
- **chartData**: `[{label, value}]`
- **option**: type:'radio', fontSize, color, activeColor

### JTabToggle（导航切换）
- **尺寸**: w=680, h=70
- **chartData**: `[{label, value}]` + 图片 URL

### JForm（表单）
- **尺寸**: w=450, h=custom

### JIframe（框架）
- **尺寸**: w=450, h=300
- **chartData**: URL 字符串

### JRadioButton（单选按钮）
- **尺寸**: w=600, h=50
- **chartData**: `[{label, value}]`

### JDragEditor（富文本编辑）
- **尺寸**: w=450, h=300

### JCommon（通用组件/自定义ECharts脚本）
- **尺寸**: w=450, h=300
- **chartData**: `[{value, name}]`

### JCustomEchart（自定义组件）
- **尺寸**: w=450, h=300

---

## 十八、轮播/卡片

### JCardScroll（卡片滚动）
- **3种变体**:
  - 横向: w=556, h=255, option/data 从 `cardScrollOption/cardScrollData` 导入
  - 竖向+序号: w=430, h=530, 从 `cardScrollOption1/cardScrollData1` 导入
  - 高亮: w=538, h=302, 从 `cardScrollOption2/cardScrollData2` 导入

### JCardCarousel（卡片轮播）
- **尺寸**: w=1000, h=230
- **option/data**: 从 `cardCarouselOption/cardCarouselData` 导入

---

## 十九、统计概览

### JStatsSummary（统计概览）
- **3种变体**:
  - 卡片式: w=1000, h=180, option 从 `statsSummaryCardOption` 导入
  - 背景式: w=713, h=129, option 从 `statsSummaryOption` 导入
  - 高亮式: w=713, h=106, option 从 `statsSummaryHighlightOption()` 导入
- **data**: 从 `statsSummaryData` 导入

---

## 二十、日历

### JPermanentCalendar（日历）
- **尺寸**: w=1000, h=480
- **option/data**: 从 `permanentCalendarOption/permanentCalendarData` 导入

---

## 外部导入配置汇总

| 组件 | 导入来源 |
|------|---------|
| JPermanentCalendar | `@/components/permanentCalendar/config` |
| JStatsSummary | `@/components/statsSummary/config` |
| JCardCarousel | `@/components/cardCarousel/config` |
| JListProgress | `@/components/listProgress/config` |
| JScrollList | `@/components/scrollList/config`（3套变体） |
| JOrbitRing | `@/components/orbitRing/config` |
| JGaoDeMap | `@/components/echarts/Map/GaoDeMap/config` |
| JCardScroll | `@/components/cardScroll/config`（3套变体） |
| JSemiGauge | `@/components/semiGauge/config` |
| JBreakRing | `@/components/echarts/JBreakRing/config` |
| JRoundProgress | `@/components/roundProgress/config` |

---

## dataMapping 字段映射汇总

| 组件类型 | dataMapping 字段 |
|---------|-----------------|
| 柱形图/折线图/饼图 | `[{filed:'维度'}, {filed:'数值'}]` |
| 堆叠/分组图表 | `[{filed:'分组'}, {filed:'维度'}, {filed:'数值'}]` |
| 地图 | `[{filed:'区域'}, {filed:'数值'}]` |
| 表单 | `[{filed:'文本'}, {filed:'数值'}]` |
| 雷达图 | `[{filed:'维度'}, {filed:'数值'}, {filed:'分组'}, {filed:'最大值'}]` |

---

## 默认颜色约定（大屏暗色主题）

| 属性 | 默认值 | 说明 |
|------|--------|------|
| 文本/轴标签颜色 | `#EEF1FA` | 浅蓝白色 |
| tooltip 文字颜色 | `#EEF1FA` | |
| axisPointer 背景 | `#333` | |
| splitLine 颜色 | `#8F8D8D` | 灰色 |
| 柱形图默认色 | `#64b5f6` | 浅蓝色 |
| 边框主色 | `#83bff6` | |
| 边框副色 | `#00CED1` | 青色 |
| 透明背景 | `#FFFFFF00` | 必须用此格式 |

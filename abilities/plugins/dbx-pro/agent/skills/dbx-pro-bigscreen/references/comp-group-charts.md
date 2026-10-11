# 图表类组件速查（ECharts 系）

> 涵盖：柱形图、折线图、饼/环形图、散点/漏斗/雷达、象形/3D/字符云  
> 按需加载：当用户要添加上述任意图表时读本文件

---

## 一、柱形图系列

### JBar（基础柱形图）
**尺寸** w=450 h=300 | **chartData** `[{name, value, type}]` | **dataMapping** `[{filed:'维度'},{filed:'数值'}]`  
**关键 option**:
- `series[0].itemStyle.color` — 柱颜色（`option.color[0]` 无效，必须设这里）
- `series[0].barWidth` — 柱宽（默认40）
- `option.customColor:[{color1,color}]` — 多系列配色（JPie/JLine等20种组件均需此字段，`option.color` 对这类组件无效）
- `grid.{top,bottom,left,right}` — 图表边距

### JStackBar（堆叠柱形图）
**尺寸** w=450 h=300 | **chartData** `[{name, value, type}]`（type区分堆叠系列）  
**dataMapping** `[{filed:'分组'},{filed:'维度'},{filed:'数值'}]`

### JDynamicBar（动态赛跑柱形图）
**尺寸** w=450 h=300 | **行为** 柱形按数值排序实时移动（bar chart race），有时间轴播放  
**不是静态柱形**，chartData 按时间序列变化

### JCapsuleChart（胶囊图）
**尺寸** w=450 h=300 | **chartData** `[{name, value}]`  
**key config**: `option.showValue` (true/false 显示数值) | `option.unit` (X轴名称)

### JHorizontalBar（水平条形图）
**尺寸** w=450 h=300 | **chartData** `[{name, value, type}]` | xAxis/yAxis互换

### JBackgroundBar（背景对比柱形图）
**尺寸** w=450 h=300 | **chartData** `[{name, value}]`  
**行为** 每根柱后有灰色背景参考柱（目标/最大值对比）

### JMultipleBar（对比柱形图）
**尺寸** w=450 h=300 | **chartData** `[{name, value, type}]`（type区分多系列）  
**dataMapping** `[{filed:'分组'},{filed:'维度'},{filed:'数值'}]`

### JNegativeBar（正负条形图）
**尺寸** w=450 h=300 | **行为** 水平条从中心轴向两侧延伸  
**chartData** `[{name, value, type:'正'},{name, value, type:'负'}]` — 两个type系列

### JPercentBar（百分比条形图）
**尺寸** w=450 h=300 | **行为** 所有柱均堆至100%  
**chartData** `[{name, value, type}]` — 多系列

### JMixLineBar（折柱混合图）
**尺寸** w=450 h=300 | **行为** 柱+折线共用**同一Y轴**  
**chartData** `[{name, value, type:'降水量'},{name, value, type:'温度'}]`  
**对比 DoubleLineBar**：MixLineBar单Y轴，DoubleLineBar双Y轴量纲不同

---

## 二、折线图系列

### JLine（基础折线图）
**尺寸** w=450 h=300 | **chartData** `[{value, name}]`  
**颜色踩坑** 必须同时设 `lineStyle.color + itemStyle.color + option.color[0]` 三处

### JSmoothLine（平滑曲线图）
**尺寸** w=450 h=300 | **chartData** `[{value, name}]` | series smooth=true

### JStepLine（阶梯折线图）
**尺寸** w=450 h=300 | **chartData** `[{value, name}]` | series step=true

### JArea（面积图）
**尺寸** w=450 h=300 | **chartData** `[{value, name}]` | areaStyle 启用

### JMultipleLine（多条折线/对比折线）
**尺寸** w=450 h=300 | **chartData** `[{value, name, type}]`（type区分多系列）  
**dataMapping** `[{filed:'分组'},{filed:'维度'},{filed:'数值'}]`

### DoubleLineBar（双轴图）
**尺寸** w=450 h=300 | **行为** 柱+折线，**左右两个独立Y轴**（不同量纲）  
**chartData** `[{value, name, type}]`  
**特殊规则（Online表单）**：nameFields=[]，typeFields=[维度]，assistYFields/assistTypeFields必须设，yAxis必须是两元素数组，config根层必须有 `seriesType:[]`

---

## 三、饼图/环形图系列

### JPie（饼图）
**尺寸** w=450 h=300 | **chartData** `[{value, name}]`  
**角度不等**（等半径），多系列配色用 `option.customColor`

### JRose（南丁格尔玫瑰图）
**尺寸** w=450 h=300 | **chartData** `[{value, name}]`  
**行为** 角度相等，**半径不等**（JPie角度不等）

### JRotatePie（旋转饼图）
**尺寸** w=450 h=300 | **chartData** `[{value, name}]` | 持续旋转动效

### JRing（饼状环形图）
**尺寸** w=480 h=300 | **chartData** `[{value, name}]` | series radius=['40%','70%']  
**用途** 多分类占比，数据量级相近

### JBreakRing（多色环形图/等宽断环）
**尺寸** w=480 h=300 | **chartData** `[{value, name}]`  
**用途** 多分类占比，**数据差距悬殊时用此组件**（等宽弧，不失衡）  
**必须从 default_configs.json 深拷贝**（缺 series/tooltip/innerRadius 则空白）

### JRingProgress（基础环形图/单值进度）
**尺寸** w=300 h=300 | **chartData** `[{value}]`（value 0-100）  
**行为** 单环，中心显示百分比 | 与JRing区别：JRing多分类，此组件单值进度

### JActiveRing（动态环形图）
**尺寸** w=480 h=300 | **chartData** `[{name, value}]`  
**行为** 鼠标悬停时该段向外扩展（activeRadius效果）| showOriginValue=false时显示百分比

### JRadialBar（玉珏图）
**尺寸** w=450 h=300 | **chartData** `[{name, value}]`  
**行为** 极坐标同心弧形柱，每项一圈（maxAngle:240，不是完整圆）

---

## 四、散点/漏斗/雷达系列

### JScatter（散点图）
**尺寸** w=450 h=300 | **chartData** `[{name, value}]`（name=X，value=Y）

### JQuadrant（象限图）
**尺寸** w=450 h=300 | **chartData** `[{name, value}]`

### JBubble（气泡图）
**尺寸** w=450 h=300 | **chartData** `[{name, value}]`（含size维度）  
**dataMapping** `[{filed:'分组'},{filed:'维度'},{filed:'数值'}]`

### JFunnel（普通漏斗图）
**尺寸** w=450 h=300 | **chartData** `[{value, name}]`  
**⚠️ Online表单**：禁用含xAxis/yAxis的柱形option，tooltip trigger='item'

### JPyramidFunnel（金字塔漏斗）
**尺寸** w=450 h=300 | **chartData** `[{value, name}]`

### JPyramid3D（3D金字塔）
**尺寸** w=750 h=540 | **chartData** `[{value, name}]`

### JRadar（普通雷达图）
**尺寸** w=450 h=300 | **chartData** `[{value, name, type, max}]`  
**dataMapping** `[{filed:'维度'},{filed:'数值'},{filed:'分组'},{filed:'最大值'}]`  
**⚠️ Online表单**：禁用柱形option，必须含 `radar:{indicator:[]}`；isGroup=true时需要typeFields

### JCircleRadar（圆形雷达图）
**尺寸** w=450 h=300 | 同JRadar

---

## 五、象形/3D/字符云/其他

### JPictorialBar（象形柱图）
**尺寸** w=450 h=300 | **chartData** `[{name, value}]`  
**行为** 用SVG图标（鹿/飞机/火箭等）叠加填充柱高

### JPictorial（象形图）
**尺寸** w=450 h=300 | **chartData** `[{name, value}]`

### JGender（男女占比）
**尺寸** w=450 h=300 | **chartData** `[{name:'男', value},{name:'女', value}]`

### JRectangle（矩形树图/Treemap）
**尺寸** w=450 h=300 | **chartData** `[{name, value, children:[...]}]`  
**行为** 嵌套矩形按面积显示层级数据（不是柱形）

### JBar3d（3D柱形图）
**尺寸** w=490 h=332 | **chartData** `[{name, value}]`

### JBarGroup3d（3D分组柱形图）
**尺寸** w=490 h=332 | **chartData** `[{name, value, type}]`

### JWordCloud（字符云）
**尺寸** w=650 h=400 | **chartData** `[{value, name}]`  
**⚠️ Online表单**：禁用含xAxis/yAxis的柱形option

### JImgWordCloud（图层字符云）
**尺寸** w=650 h=400 | 词云按指定图片轮廓排列，需配置遮罩图片

### JFlashCloud（闪动字符云）
**尺寸** w=650 h=400 | **chartData** `[{value, name}]` | 词随机闪烁高亮，科技感强

### JCustomEchart（自定义图表）
**尺寸** w=450 h=300 | 直接写ECharts option JSON，标准组件无法满足时的兜底方案

---

## ECharts 组件通用配色规范

**⚠️ 以下20种组件必须用 `option.customColor`，`option.color` 无效：**  
JPie/JRose/JLine/JArea/JMixLineBar/JMultipleLine/JStackBar/JMultipleBar/JCapsuleChart 等

```python
# 系统默认9色
SYSTEM_CUSTOM_COLORS = [
    {"color1": "#1e90ff", "color": "#1e90ff"},
    {"color1": "#90ee90", "color": "#90ee90"},
    {"color1": "#00ced1", "color": "#00ced1"},
    {"color1": "#e2bd84", "color": "#e2bd84"},
    {"color1": "#7a90e0", "color": "#7a90e0"},
    {"color1": "#3ba272", "color": "#3ba272"},
    {"color1": "#2be7ff", "color": "#2be7ff"},
    {"color1": "#0a8ada", "color": "#0a8ada"},
    {"color1": "#ffd700", "color": "#ffd700"},
]
```

## ECharts 轴标签颜色（bg4.png必须覆盖）

```python
opt_patch = {
    'xAxis': {'axisLabel': {'color': '#8ab8d0'}, 'axisLine': {'lineStyle': {'color': '#1a3a5a'}}},
    'yAxis': {'axisLabel': {'color': '#8ab8d0'}, 'splitLine': {'lineStyle': {'color': '#1a3a5a55'}}},
    'legend': {'textStyle': {'color': '#8ab8d0'}},
    'tooltip': {'backgroundColor': '#0b1e3acc', 'textStyle': {'color': '#e0f0ff'}},
}
```

## 踩坑（图表类）

- **JBar颜色** `option.color[0]` 不生效，必须设 `series[0].itemStyle.color`
- **JLine颜色** 必须同时设 lineStyle.color + itemStyle.color + option.color[0] 三处
- **customColor组件** 用 `option.customColor:[{color1,color}]`，`option.color` 无效
- **JBar series** 必须含 `type:'bar'`，禁止空数组 `[]`
- **DoubleLineBar yAxis** 必须是两元素数组
- **饼图/雷达/词云/JProgress** 禁用含xAxis/yAxis的柱形option
- **xAxis/yAxis格式** 对象格式（不是数组格式）
- **JBreakRing/JRadialBar** 必须从default_configs.json深拷贝，手写option必然遗漏series
- **JGender** 固定两个系列（男/女），不是通用 `[{name,value}]` 格式
- **option.title两种模式** ECharts组件title是dict（`title.show=False`）；JFlashList等是字符串（用`titleShow`字段）

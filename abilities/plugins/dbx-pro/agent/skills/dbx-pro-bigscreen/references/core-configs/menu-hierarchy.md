# 大屏组件菜单层级（实际显示）

> 来源：`packages/dragEngine/components/bigScreenComponents/data.ts` 的 `menuData`。
> **只列界面上能看到的二级菜单**——一级 Tab（图表/文字/自定义/地图/视频/其他）在 UI 上不显式展示，按需在末尾"Tab 归属速查"里查。
> "列出所有 X 图"时按下面的二级菜单分组取即可。

---

## 二级菜单（产品左侧菜单一一对应）

```
柱形图
├── JBar           基础柱形图
├── JStackBar      堆叠柱形图
├── JDynamicBar    动态柱形图
├── JCapsuleChart  胶囊图
├── JHorizontalBar 基础条形图
├── JBackgroundBar 背景柱形图
├── JMultipleBar   对比柱形图
├── JNegativeBar   正负条形图
├── JPercentBar    百分比条形图
└── JMixLineBar    折柱图

饼状图
├── JPie           饼图
├── JRose          南丁格尔玫瑰图
└── JRotatePie     旋转饼图

折线图
├── JLine          基础折线图
├── JSmoothLine    平滑曲线图
├── JStepLine      阶梯折线图
├── JArea          面积图
├── JMultipleLine  对比折线图
└── DoubleLineBar  双轴图

进度图
├── JCustomProgress  基础进度图   ← 命名陷阱：菜单"基础进度图"是 JCustomProgress
├── JProgress        进度图
├── JListProgress    列表进度图
├── JRoundProgress   圆形进度图
└── JLiquid          水波图

象形图
├── JPictorialBar  象形柱图
├── JPictorial     象形图
└── JGender        男女占比

仪表盘
├── JGauge         基础仪表盘
├── JColorGauge    多色仪表盘
├── JAntvGauge     渐变仪表盘
└── JSemiGauge     半圆仪表盘

散点图
├── JScatter       普通散点图
├── JQuadrant      象限图
└── JBubble        气泡图

漏斗图
├── JFunnel        普通漏斗图
├── JPyramidFunnel 金字塔漏斗图
└── JPyramid3D     3D 金字塔

雷达图
├── JRadar         普通雷达图
└── JCircleRadar   圆形雷达图

环形图
├── JRing          饼状环形图
├── JBreakRing     多色环形图
├── JRingProgress  基础环形图    ← G2Plot 库；与 JRing 兄弟（ECharts）数据格式不同
├── JActiveRing    动态环形图
└── JRadialBar     玉珏图        ← G2Plot 库

矩形图
└── JRectangle     矩形图

3D 图表
├── JBar3d         3D 柱形图
└── JBarGroup3d    3D 分组柱形图

日历
└── JPermanentCalendar  日历

轮播
├── JCardScroll index=0  卡片滚动(横向)
├── JCardScroll index=1  卡片滚动(竖向+序号)
├── JCardScroll index=2  卡片滚动(高亮)
└── JCardCarousel        卡片轮播

统计
├── JStatsSummary index=0  统计概览（卡片模式）
├── JStatsSummary index=1  统计概览（背景模式）
└── JStatsSummary index=2  统计概览（高亮模式）

边框
└── JDragBorder type='1'~'13'   边框 1~13

装饰
└── JDragDecoration type='1'~'12'   装饰 1~12

图片
├── JImg        图片
└── JCarousel   轮播图

图标
└── JCustomIcon  图标（36 种，type='01'~'36'）

图库
└── （暂无子组件，compType:'gallery'）

轮播表格
├── JScrollBoard  轮播表
├── JScrollTable  表格
└── JDevHistory   发展历程

普通表格
├── JCommonTable  数据表格
└── JList         数据列表

排名表格
├── JScrollRankingBoard  排行榜
├── JFlashList           个性排名(前四)
└── JBubbleRank          气泡排名(前五)

高级表格
└── JScrollList  滚动列表（3 变体：单行 index=0 / 多行+序号 index=1 / 带表头 index=2）

文本类
├── JText         文本
├── JCountTo      翻牌器
├── JColorBlock   颜色块
├── JCurrentTime  当前时间
├── JNumber       数值
└── JOrbitRing    轨道环形文字

字符云
├── JWordCloud    字符云
├── JImgWordCloud 图层字符云
└── JFlashCloud   闪动字符云

天气预报
└── JWeatherForecast（6 个 template 变体：滚动版 11 / 横线版 34 / 带背景 21 / 好123版 12 / 温度计版 27 / 列表文字版 94）

自定义
├── Online表单     ← 动态加载用户已建 Online 表单图表（compType: online）
└── 设计器表单     ← 动态加载用户已建设计器表单图表（compType: design）

离线地图
├── JBubbleMap        散点地图
├── JFlyLineMap       飞线地图
├── JBarMap           柱形地图
├── JTotalFlyLineMap  时间轴飞线地图
├── JTotalBarMap      柱形排名地图
├── JHeatMap          热力地图
├── JAreaMap          区域地图
└── JGaoDeMap         高德地图

在线地图
└── （暂无子组件）

视频
├── JVideoPlay   播放器
└── JVideoJs     RTMP 播放器

其他（交互/容器）
├── JSelectRadio   选项卡       ← 命名陷阱：菜单"选项卡"是 JSelectRadio 不是 JTabToggle
├── JTabToggle     导航切换
├── JForm          表单
├── JIframe        Iframe
├── JRadioButton   按钮         ← 命名陷阱：菜单"按钮"是 JRadioButton 不是普通按钮
├── JDragEditor    富文本
├── JCommon        通用组件
└── JCustomEchart  自定义组件
```

---

## 组件总数统计

| 二级菜单 | 组件数 | compType 列表 |
|------|--------|--------------|
| 柱形图 | 10 | JBar/JStackBar/JDynamicBar/JCapsuleChart/JHorizontalBar/JBackgroundBar/JMultipleBar/JNegativeBar/JPercentBar/JMixLineBar |
| 饼状图 | 3 | JPie/JRose/JRotatePie |
| 折线图 | 6 | JLine/JSmoothLine/JStepLine/JArea/JMultipleLine/DoubleLineBar |
| 进度图 | 5 | JCustomProgress/JProgress/JListProgress/JRoundProgress/JLiquid |
| 象形图 | 3 | JPictorialBar/JPictorial/JGender |
| 仪表盘 | 4 | JGauge/JColorGauge/JAntvGauge/JSemiGauge |
| 散点图 | 3 | JScatter/JQuadrant/JBubble |
| 漏斗图 | 3 | JFunnel/JPyramidFunnel/JPyramid3D |
| 雷达图 | 2 | JRadar/JCircleRadar |
| 环形图 | 5 | JRing/JBreakRing/JRingProgress/JActiveRing/JRadialBar |
| 矩形图 | 1 | JRectangle |
| 3D 图表 | 2 | JBar3d/JBarGroup3d |
| 日历 | 1 | JPermanentCalendar |
| 轮播 | 4 | JCardScroll(×3 变体)/JCardCarousel |
| 统计 | 3 | JStatsSummary(×3 变体) |
| 边框 | 13 | JDragBorder(type='1'~'13') |
| 装饰 | 12 | JDragDecoration(type='1'~'12') |
| 图片 | 2 | JImg/JCarousel |
| 图标 | 1 | JCustomIcon（36 种 type） |
| 轮播表格 | 3 | JScrollBoard/JScrollTable/JDevHistory |
| 普通表格 | 2 | JCommonTable/JList |
| 排名表格 | 3 | JScrollRankingBoard/JFlashList/JBubbleRank |
| 高级表格 | 3 | JScrollList(×3 变体) |
| 文本类 | 6 | JText/JCountTo/JColorBlock/JCurrentTime/JNumber/JOrbitRing |
| 字符云 | 3 | JWordCloud/JImgWordCloud/JFlashCloud |
| 天气预报 | 6 | JWeatherForecast(×6 template 变体) |
| 自定义 | 3 | JTotalProgress/JPivotTable/JRankingList（+ Online/设计器表单动态加载） |
| 离线地图 | 8 | JBubbleMap/JFlyLineMap/JBarMap/JTotalFlyLineMap/JTotalBarMap/JHeatMap/JAreaMap/JGaoDeMap |
| 视频 | 2 | JVideoPlay/JVideoJs |
| 其他/交互 | 8 | JSelectRadio/JTabToggle/JForm/JIframe/JRadioButton/JDragEditor/JCommon/JCustomEchart |
| **总计** | **~129 实例** | **~85 compType**（含同 compType 多变体） |

---

## Tab 归属速查（仅供 debug，UI 不展示）

源码 `data.ts` 顶层有 6 个 Tab，实际左侧菜单是把所有二级合到一个滚动列表里：

- **图表**：柱形图/饼状图/折线图/进度图/象形图/仪表盘/散点图/漏斗图/雷达图/环形图/矩形图/3D 图表/日历/轮播/统计/边框/装饰/图片/图标/图库/表格（含 4 子菜单）
- **文字**：文本类/字符云/天气预报
- **自定义**：自定义（5 项，含动态加载入口）
- **地图**：离线地图/在线地图
- **视频**：视频
- **其他**：其他（8 项）

> ⚠️ 源码 quirks：
> - 边框/装饰/图片/图标 节点的 `parentId` 误写为 `1009728871115423744`（视频 Tab id），但按数组嵌套实际属于"图表 Tab → 装饰 wrapper(id:15341365037580)"。
> - 进度图子节点 `parentId` 误写为 `'200'`，按嵌套属于进度图分组。
> - 判断真实归属一律以**数组嵌套结构**为准，不看 parentId。

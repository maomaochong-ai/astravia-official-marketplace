# 大屏组件类型参考

> 本文档只列**大屏菜单实际可用的组件**（来源：`packages/dragEngine/components/bigScreenComponents/data.ts` 的 `menuData` 激活项）。前端 `packages/index.ts` 里注册的是大屏+仪表盘全集 —— 大屏未注册的（`JFly3dMap`）、仪表盘独有的（`JCalendar/JTable/JTabs/JGrid/JQuickNav/JFilterQuery/JCustomButton/JGrowCard/JSimpleCard/JProjectCard/JCustomCard/JDynamicInfo/JGraphSimple`）均不列入。

## 意图 → 组件（严格映射，防止误推荐）

> **根本原则**：系统中每个组件名就是独立类别。只有"系列"（柱状图系列、折线图系列等系统原生大类）才可合并；独立命名的组件（JText / JDragEditor / JOrbitRing / JDragDecoration / JDragBorder / JCustomIcon / JPermanentCalendar / JCurrentTime）**不能合并同义类**，用户意图必须严格一对一匹配。

| 用户只说 | 严格唯一对应 | 禁止混入 |
|---|---|---|
| "装饰" / "加点装饰" / "好看点" / "装饰下所有" / "装饰菜单的所有组件" | `JDragDecoration`（仅 12 个 variant，不扩展为 wrapper 全集） | JDragBorder（边框）/ JImg / JCarousel / JCustomIcon / JText / JCurrentTime |
| "边框" / "框一下" | `JDragBorder` | JDragDecoration |
| "装饰类全部" / "wrapper 全部" / 显式列出"边框+装饰+图片+图标" | wrapper 全集（JDragBorder + JDragDecoration + JImg + JCarousel + JCustomIcon） | — |
| "文字" / "标题" / "标语" | `JText` | JDragEditor / JOrbitRing |
| "富文本" / "编辑器" | `JDragEditor` | JText |
| "轨道环形文字" / "行星文字" | `JOrbitRing` | JText |
| "时钟" / "实时时间" | `JCurrentTime` | JPermanentCalendar |
| "日历" | `JPermanentCalendar` | JCurrentTime |
| "图标" / "加个小图标" | `JCustomIcon` | — |
| "轮播"（图片） | `JCarousel` | JCardCarousel |
| "卡片切换" / "卡片轮播" | `JCardCarousel` | JCarousel / JCardScroll |
| "卡片滚动" / "卡片自动滚动" | `JCardScroll` | JCardCarousel（切换≠滚动）/ JScrollBoard（文本滚） |
| "象形图" / "图标代替柱子" / "人形柱图" | `JPictorialBar` / `JPictorial` | JBar（普通柱）|
| "发展历程" / "时间轴" / "历程展示" | `JDevHistory` | JList（无时间结构）|

---

## 一、图表组件（ECharts）

> **分类与产品菜单 1:1 对齐**（来源：`data.ts` menuData）。说"列出所有 X 图"时，按下面的小节标题取该节下的全部组件即可。

### 柱形图（菜单：柱形图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JBar` | 基础柱形图 | 分类数据对比 |
| `JStackBar` | 堆叠柱形图 | 部分与整体 |
| `JDynamicBar` | 动态柱形图 | 动画排名效果 |
| `JCapsuleChart` | 胶囊图 | 进度/占比展示 |
| `JHorizontalBar` | 基础条形图 | 类目名较长（横向） |
| `JBackgroundBar` | 背景柱形图 | 带背景色柱图 |
| `JMultipleBar` | 对比柱形图 | 多系列对比 |
| `JNegativeBar` | 正负条形图 | 正负值对比 |
| `JPercentBar` | 百分比条形图 | 占比可视化 |
| `JMixLineBar` | 折柱图 | 柱+线混合（不同量级对比） |

### 饼状图（菜单：饼状图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JPie` | 饼图 | 占比分析 |
| `JRose` | 南丁格尔玫瑰图 | 带大小的占比 |
| `JRotatePie` | 旋转饼图 | 动态展示 |

### 折线图（菜单：折线图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JLine` | 基础折线图 | 趋势变化 |
| `JSmoothLine` | 平滑曲线图 | 柔和趋势展示 |
| `JStepLine` | 阶梯折线图 | 离散变化 |
| `JArea` | 面积图 | 带填充的趋势 |
| `JMultipleLine` | 对比折线图 | 多系列趋势 |
| `DoubleLineBar` | 双轴图 | 双 Y 轴混合 |

### 进度图（菜单：进度图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JCustomProgress` | 基础进度图 | 完成进度（默认条形） |
| `JProgress` | 进度图 | 自定义样式进度条 |
| `JListProgress` | 列表进度图 | 多项进度对比 |
| `JRoundProgress` | 圆形进度图 | 圆形完成度 |
| `JLiquid` | 水波图 | 百分比/液位 |

> ⚠️ 命名陷阱：菜单"基础进度图"对应 `JCustomProgress`，"进度图"才是 `JProgress`。

### 仪表盘（菜单：仪表盘）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JGauge` | 基础仪表盘 | 完成度/达标率 |
| `JColorGauge` | 多色仪表盘 | 多色阈值 |
| `JAntvGauge` | 渐变仪表盘 | G2Plot 风格渐变 |
| `JSemiGauge` | 半圆仪表盘 | 半圆展示 |

### 散点图（菜单：散点图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JScatter` | 普通散点图 | 分布/相关性 |
| `JQuadrant` | 象限图 | 四象限分析 |
| `JBubble` | 气泡图 | 三维数据 |

### 漏斗图（菜单：漏斗图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JFunnel` | 普通漏斗图 | 转化分析 |
| `JPyramidFunnel` | 金字塔漏斗图 | 层级占比 |
| `JPyramid3D` | 3D 金字塔 | 立体效果 |

### 雷达图（菜单：雷达图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JRadar` | 普通雷达图 | 多维度对比 |
| `JCircleRadar` | 圆形雷达图 | 圆形多维 |

### 环形图（菜单：环形图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JRing` | 饼状环形图 | 占比（中心可放数字） |
| `JBreakRing` | 多色环形图 | 断裂/多色视觉 |
| `JRingProgress` | 基础环形图 | G2Plot 环形进度（chartData[0].value=0~100 整数，仅取首条） |
| `JActiveRing` | 动态环形图 | 动画环形 |
| `JRadialBar` | 玉珏图 | 径向柱状对比 |

> ⚠️ JRing/JBreakRing/JActiveRing 是 ECharts 环形图（多条数据=多瓣）；JRingProgress/JRadialBar 是 G2Plot 库，数据结构不同——勿混用。

### 矩形图（菜单：矩形图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JRectangle` | 矩形图 | 层级占比 |

### 象形图（菜单：象形图）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JPictorialBar` | 象形柱图 | 用图标/形状代替柱子（人形/箭头/自定义图形） |
| `JPictorial` | 象形图 | 图标重复表数量（n 个图标=n 个单位） |
| `JGender` | 男女占比 | 性别比例可视化 |

### 3D 图表（菜单：3D 图表）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JBar3d` | 3D 柱形图 | 立体柱状 |
| `JBarGroup3d` | 3D 分组柱形图 | 立体分组 |

### 日历（菜单：日历）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JPermanentCalendar` | 日历 | 日历展示 |

### 轮播（菜单：轮播）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JCardScroll` | 卡片滚动 | 3 变体：横向 index=0 / 竖向+序号 index=1 / 高亮 index=2（详见 `card-scroll-option-config.md`） |
| `JCardCarousel` | 卡片轮播 | 多卡片切换（一次显一张） |

### 统计（菜单：统计）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JStatsSummary` | 统计概览 | 3 变体：卡片 index=0 / 背景 index=1 / 高亮 index=2（多指标汇总卡片） |

---

## 二、表格组件（菜单：图表 → 表格）

### 轮播表格
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JScrollBoard` | 轮播表 | 信息滚动 |
| `JScrollTable` | 表格 | 自动轮播表格 |
| `JDevHistory` | 发展历程 | 时间轴/历程展示 |

### 普通表格
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JCommonTable` | 数据表格 | 静态数据表格 |
| `JList` | 数据列表 | 通用列表 |

### 排名表格
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JScrollRankingBoard` | 排行榜 | 通用排名展示 |
| `JFlashList` | 个性排名(前四) | 闪烁/动态前四 |
| `JBubbleRank` | 气泡排名(前五) | 气泡式前五排名 |

### 高级表格
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JScrollList` | 滚动列表 | 3 变体：单行 index=0 / 多行+序号 index=1 / 带表头 index=2 |

---

## 三、UI 装饰类组件（菜单：图表 → 装饰 wrapper）

> ⚠️ **"装饰"在源码菜单中是双层语义**：
> - **大节点（wrapper）**："图表 Tab → 装饰"是个分组容器，下挂 5 个子菜单（边框/装饰/图片/图标/图库）
> - **子菜单**："装饰"子菜单 = 仅 `JDragDecoration`（12 个 variant）
>
> **AI 默认理解**：用户口语说"装饰" / "装饰组件" / "装饰下所有" / "装饰菜单全部"——一律按**子菜单**理解，只取 `JDragDecoration` × 12。要 wrapper 全集，用户必须显式列出"边框+装饰+图片+图标"或说"装饰 wrapper 全部"。

### 边框（子菜单）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JDragBorder` | 边框 | 13 种样式（type='1'~'13'），"加边框/框一下"时使用 |

### 装饰条（子菜单 · 用户口语"装饰"独占）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JDragDecoration` | 装饰条 | 12 种样式（variant='1'~'12'）。⚠️ **7/8/11 是静态装饰**（无动画），其余动态。**仅 11** 是可填 `option.title` 的切角矩形容器（其它变体 title 不可见）。横向窄长位选 3/4/10，区块角部选 5，监控雷达感选 9/12，分区标题面板选 11。详见 `py spec_builder.py --schema JDragDecoration` |

### 图片
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JImg` | 图片 | 单张图片展示 |
| `JCarousel` | 轮播图 | 图片/内容轮播 |

### 图标
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JCustomIcon` | 图标 | 36 种内置图标（type='01'~'36'） |

---

## 四、地图组件（菜单：地图 Tab）

| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JBubbleMap` | 散点地图 | 地理数据点标注 |
| `JFlyLineMap` | 飞线地图 | 迁徙/物流 |
| `JBarMap` | 柱形地图 | 地理柱状 |
| `JTotalFlyLineMap` | 时间轴飞线地图 | 多节点流动 |
| `JTotalBarMap` | 柱形排名地图 | 多地理柱状 |
| `JHeatMap` | 热力地图 | 密度分布 |
| `JAreaMap` | 区域地图 | 区域数据着色 |
| `JGaoDeMap` | 高德地图 | 真实在线地图 |

---

## 五、文字组件（菜单：文字 Tab）

### 文本类
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JText` | 文本 | 标题/说明文字 |
| `JCountTo` | 翻牌器 | 动画计数 |
| `JColorBlock` | 颜色块 | 颜色+数字色块 |
| `JCurrentTime` | 当前时间 | 实时时钟 |
| `JNumber` | 数值 | KPI 核心指标（支持表单数据） |
| `JOrbitRing` | 轨道环形文字 | 文字/图文沿环形轨道排列（数据驱动） |

### 字符云
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JWordCloud` | 字符云 | 关键词频率词云 |
| `JImgWordCloud` | 图层字符云 | 图形/图片轮廓词云 |
| `JFlashCloud` | 闪动字符云 | 闪烁动态词云 |

### 天气预报
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JWeatherForecast` | 天气预报 | 6 个 template 变体：滚动版(11)/横线版(34)/带背景(21)/好123版(12)/温度计版(27)/列表文字版(94) |

---

## 六、视频组件（菜单：视频 Tab）

| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JVideoPlay` | 播放器 | 通用视频播放 |
| `JVideoJs` | RTMP 播放器 | Video.js 高级视频/直播流 |

---

## 七、其他/交互组件（菜单：其他 Tab）

| component | 菜单显示名 | 适用场景 |
|-----------|------|---------|
| `JSelectRadio` | 选项卡 | 数据筛选下拉/单选 |
| `JTabToggle` | 导航切换 | 简化 Tab 切换 |
| `JForm` | 表单 | 查询表单 |
| `JIframe` | Iframe | 嵌入外部页面 |
| `JRadioButton` | 按钮 | 单选按钮组（筛选） |
| `JDragEditor` | 富文本 | TinyMCE 编辑器 |
| `JCommon` | 通用组件 | 自定义/通用容器（高级开发用，普通需求别用） |
| `JCustomEchart` | 自定义组件 | 高级 ECharts 配置（写完整 option） |

> ⚠️ 命名陷阱：菜单"选项卡"是 `JSelectRadio` 不是 `JTabToggle`；菜单"按钮"是 `JRadioButton` 不是普通按钮组件。

---

## 八、自定义组件（菜单：自定义 Tab）

| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JTotalProgress` | 统计进度图 | 多分组进度对比（分组+维度+数值） |
| `JPivotTable` | 透视表 | 多维度交叉汇总（行+列+数值） |
| `JRankingList` | 排行榜(自定义) | 自定义样式排名（区别于 JScrollRankingBoard） |

> 自定义 Tab 还有 "Online 表单" / "设计器表单" 两个动态加载入口（compType: `online` / `design`），不是固定组件，由用户已建表单动态生成图表。

---

## 特殊组件

| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JGroup` | 组合组件 | **由"组合/拆分"操作自动生成**，不能手工拖入；用 `group_ops.py` 维护 |

---

## 组件通用配置结构

### 大屏模式（bigScreen）组件 config

```json
{
  "w": 450,
  "h": 300,
  "dataType": 1,
  "url": "",
  "timeOut": 0,
  "turnConfig": {
    "url": "",
    "type": "_blank"
  },
  "linkType": "url",
  "linkageConfig": [],
  "markLineConfig": {
    "show": false,
    "markLine": []
  },
  "dataMapping": [
    {"filed": "维度", "mapping": ""},
    {"filed": "数值", "mapping": ""}
  ],
  "chartData": [],
  "option": {}
}
```

### 数据源类型（dataType）

| dataType | 说明 |
|----------|------|
| 1 | 静态数据（chartData 中直接写入） |
| 2 | 动态数据（通过数据集获取，支持 SQL / API / WebSocket / JSON / 文件等类型） |
| 4 | 关联表单数据 |

### JNumber 组件 config 示例

```json
{
  "dataType": 4,
  "formId": "form_code",
  "formName": "表单名称",
  "tableName": "table_name",
  "formType": "design",
  "valueFields": [{
    "fieldName": "record_count",
    "fieldTxt": "记录数量",
    "fieldType": "count",
    "widgetType": "text"
  }],
  "analysis": {
    "showData": 1,
    "isRawData": true,
    "isCompare": false,
    "showMode": 1,
    "trendType": "1"
  },
  "filter": {
    "conditionMode": "and",
    "conditionFields": [],
    "queryField": "create_time",
    "queryRange": "month"
  },
  "size": {"height": 500},
  "chart": {
    "subclass": "JNumber",
    "category": "Number"
  },
  "option": {
    "isCompare": false,
    "trendType": "1",
    "body": {"color": "#000000", "fontWeight": "bold"},
    "card": {"size": "small"}
  }
}
```

### JBar/JLine 等轴类图表 config 示例

```json
{
  "dataType": 1,
  "chartData": [
    {"name": "一月", "value": 820},
    {"name": "二月", "value": 932},
    {"name": "三月", "value": 901}
  ],
  "size": {"width": 860, "height": 380},
  "chart": {
    "subclass": "JBar",
    "category": "Bar"
  },
  "option": {
    "title": {"text": "月度销售", "show": true},
    "tooltip": {"show": true},
    "legend": {"show": true},
    "xAxis": {
      "type": "category",
      "show": true,
      "data": ["一月", "二月", "三月"]
    },
    "yAxis": {"type": "value", "show": true},
    "series": [{
      "name": "销售额",
      "type": "bar",
      "data": [820, 932, 901]
    }],
    "grid": {"left": "10%", "right": "10%", "top": "15%", "bottom": "15%"}
  }
}
```

### JPie 饼图 config 示例

```json
{
  "dataType": 1,
  "chartData": [
    {"name": "直接访问", "value": 335},
    {"name": "邮件营销", "value": 310},
    {"name": "联盟广告", "value": 234}
  ],
  "size": {"width": 500, "height": 350},
  "chart": {
    "subclass": "JPie",
    "category": "Pie"
  },
  "option": {
    "title": {"text": "访问来源", "show": true},
    "tooltip": {"show": true},
    "legend": {"show": true, "orient": "vertical", "left": "left"},
    "series": [{
      "name": "来源",
      "type": "pie",
      "radius": "55%",
      "data": [
        {"name": "直接访问", "value": 335},
        {"name": "邮件营销", "value": 310},
        {"name": "联盟广告", "value": 234}
      ]
    }]
  }
}
```

### JTable 表格 config 示例

```json
{
  "dataType": 1,
  "chartData": [
    {"fieldTxt": "姓名", "fieldName": "name", "type": "field", "isShow": "Y", "isTotal": "N"},
    {"fieldTxt": "年龄", "fieldName": "age", "type": "field", "isShow": "Y", "isTotal": "Y"},
    {"fieldTxt": "地址", "fieldName": "address", "type": "field", "isShow": "Y", "isTotal": "N"}
  ],
  "url": "http://api.jeecg.com/mock/42/tableData",
  "tableList": "http://api.jeecg.com/mock/42/tableList",
  "size": {"width": 700, "height": 350},
  "option": {
    "bordered": true,
    "size": "small"
  }
}
```

### JCustomButton 按钮 config 示例

```json
{
  "dataType": 1,
  "chartData": [{
    "btnId": "74591654852155",
    "title": "请假申请",
    "color": "#ED4B82",
    "icon": "ant-design:calendar-twotone",
    "operationType": "1",
    "openMode": "2",
    "worksheet": {
      "label": "请假申请",
      "value": "form_code",
      "key": "form_code"
    },
    "click": {
      "type": "1",
      "message": {"title": "确认执行？", "okText": "确认", "cancelText": "取消"}
    }
  }],
  "option": {
    "btnDirection": "column",
    "btnStyle": "solid",
    "rowNum": 5,
    "title": "常用操作",
    "btnType": "button",
    "btnWidth": "custom"
  }
}
```

### JCarousel 轮播 config 示例

```json
{
  "dataType": 1,
  "chartData": "[{\"src\":\"https://example.com/1.png\"},{\"src\":\"https://example.com/2.png\"}]",
  "size": {"width": 800, "height": 300},
  "option": {
    "dots": true,
    "autoplay": true,
    "dotPosition": "bottom"
  }
}
```

---

## 大屏 vs 仪表盘 布局差异

### 大屏（bigScreen）
- **布局方式**：绝对定位（像素坐标）
- **坐标单位**：x/y 为像素值
- **尺寸单位**：w/h 为像素值
- **典型画布**：1920×1080 像素
- **支持旋转**：是（angle 属性）
- **背景**：深色 + 背景图

### 仪表盘（default）
- **布局方式**：网格布局（vue-grid-layout）
- **坐标单位**：x 为列号（0-23），y 为行号
- **尺寸单位**：w 为列数（1-24），h 为行数（rowHeight=1px）
- **支持旋转**：否
- **背景**：浅色/白色

### template 中的坐标字段

| 字段 | 大屏 | 仪表盘 | 说明 |
|------|------|--------|------|
| `x` | 像素 | 栅格列 | 水平位置 |
| `y` | 像素 | 栅格行 | 垂直位置 |
| `w` | 像素 | 列数(1-24) | 宽度 |
| `h` | 像素 | 行数 | 高度 |
| `pcX` | 像素 | — | PC端水平位置 |
| `pcY` | 像素 | — | PC端垂直位置 |
| `pcW` | 像素 | — | PC端宽度 |

---



组件主题颜色：`default`, `gray`, `green`, `red`, `blue`, `dark`

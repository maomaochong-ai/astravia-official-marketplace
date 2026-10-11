# 仪表盘组件类型完整参考

> **权威来源**：`data.ts` 中 `export const menuData`（第3行）
> ⚠️ **不在 menuData 中的组件禁止用于仪表盘，下一个导出 `qqyMenuData` 是敲敲云仪表盘，两者不同。**

---

## 仪表盘 menuData 完整组件列表（共66个）

### 柱状图系列（8个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JBar` | 基础柱状图 | 分类数据对比 |
| `JStackBar` | 堆叠柱状图 | 部分与整体 |
| `JDynamicBar` | 动态柱状图 | 动画排名效果 |
| `JHorizontalBar` | 横向柱状图 | 类目名较长 |
| `JBackgroundBar` | 背景柱状图 | 带背景色柱状图 |
| `JMultipleBar` | 分组柱状图 | 多系列对比 |
| `JNegativeBar` | 正负柱状图 | 正负值对比 |
| `JMixLineBar` | 柱线混合图 | 不同量级对比 |

### 折线图系列（5个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JLine` | 基础折线图 | 趋势变化 |
| `JSmoothLine` | 平滑曲线图 | 柔和趋势展示 |
| `JStepLine` | 阶梯折线图 | 离散变化 |
| `JMultipleLine` | 多折线图 | 多系列趋势 |
| `DoubleLineBar` | 双轴图 | 双Y轴混合 |

### 饼图/环形图系列（3个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JPie` | 饼图 | 占比分析 |
| `JRose` | 南丁格尔玫瑰图 | 带大小的占比 |
| `JRing` | 环形图 | 占比（中心可放数字） |

### 面积/特殊柱图（2个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JArea` | 面积图 | 趋势+面积 |
| `JPictorialBar` | 象形柱状图 | 图标化数据 |

### 进度/完成度（2个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JCustomProgress` | 自定义进度条 | 自定义样式 |
| `JProgress` | 进度条 | 完成进度 |

### 仪表盘表盘（2个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JGauge` | 仪表盘 | 完成度/达标率 |
| `JColorGauge` | 彩色仪表盘 | 多色阈值 |

### 散点/气泡（2个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JScatter` | 散点图 | 分布/相关性 |
| `JBubble` | 气泡图 | 三维数据 |

### 漏斗系列（2个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JFunnel` | 漏斗图 | 转化分析 |
| `JPyramidFunnel` | 金字塔漏斗 | 层级占比 |

### 雷达图（2个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JRadar` | 雷达图 | 多维度对比 |
| `JCircleRadar` | 圆形雷达 | 圆形多维 |

### 自定义图表（1个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JCustomEchart` | 自定义ECharts | 自定义配置 |

### 地图系列（7个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JBubbleMap` | 气泡地图 | 地理数据标注 |
| `JFlyLineMap` | 飞线地图 | 迁徙/物流 |
| `JBarMap` | 柱状地图 | 地理柱状 |
| `JTotalFlyLineMap` | 多节点飞线 | 多点流动 |
| `JTotalBarMap` | 多柱状地图 | 多地理柱状 |
| `JHeatMap` | 热力地图 | 密度分布 |
| `JAreaMap` | 区域地图 | 区域数据着色 |

### 表格/列表（4个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JCommonTable` | 通用表格 | 基础表格 |
| `JList` | 列表 | 通用列表 |
| `JCommon` | 通用组件 | 自定义 |
| `JPivotTable` | 透视表 | 交叉分析 |

### 数字/卡片（6个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JNumber` | 数字指标 | KPI核心指标 |
| `JGrowCard` | 增长卡片 | 增长率指标 |
| `JProjectCard` | 项目卡片 | 项目概览 |
| `JSimpleCard` | 简单卡片 | 信息卡片 |
| `JWaitMatter` | 待办事项 | 待办列表 |
| `JDynamicInfo` | 动态信息 | 实时信息流 |

### 媒体/内容（8个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JCarousel` | 轮播 | 图片/内容轮播 |
| `JIframe` | 内嵌页 | 嵌入外部页面 |
| `JCalendar` | 日历 | 日历展示 |
| `JMultiViewCalendar` | 多视图日历 | 多视图日历 |
| `JImg` | 图片 | 图片展示 |
| `JText` | 文本 | 标题/说明文字 |
| `JDragEditor` | 富文本 | TinyMCE编辑器 |
| `JCurrentTime` | 实时时钟 | 当前时间 |

### 交互/筛选（5个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JForm` | 查询表单 | 查询表单 |
| `JRadioButton` | 单选按钮组 | 筛选切换 |
| `JFilterQuery` | 筛选查询 | 复合查询 |
| `JCustomButton` | 自定义按钮 | 操作按钮 |
| `JQuickNav` | 快捷导航 | 菜单导航 |

### 布局容器（2个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JTabs` | 选项卡 | Tab切换 |
| `JGrid` | 栅格布局 | 布局容器 |

### 自定义表单（2个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `online` | Online表单 | cgform表单图表 |
| `design` | 设计器表单 | desform表单图表 |

### 其他（3个）
| component | 名称 | 适用场景 |
|-----------|------|---------|
| `JArchitecture` | 架构图 | 组织架构 |
| `JVrHourse` | VR房屋 | 3D展示 |
| `JMap` | 地图 | 自定义地图 |

---

## ⛔ 不在 menuData 中（仪表盘禁用）

以下组件**不在 menuData**，在仪表盘中使用会报错或无法渲染，禁止使用：

| 组件 | 所属 |
|------|------|
| `JPyramid3D` | 大屏专属 |
| `JAntvGauge` `JSemiGauge` `JRoundProgress` `JRingProgress` `JLiquid` `JRadialBar` `JListProgress` | 大屏专属 |
| `JCapsuleChart` `JPercentBar` | 大屏专属 |
| `JRectangle` `JGraphSimple` `JWordCloud` `JImgWordCloud` | 大屏专属 |
| `JBar3d` `JBarGroup3d` | 大屏专属 |
| `JGaoDeMap` `JFly3dMap` | 大屏专属 |
| `JScrollTable` `JScrollBoard` `JScrollList` `JScrollRankingBoard` `JFlashList` `JFlashCloud` `JRankingList` | 大屏专属 |
| `JCountTo` `JColorBlock` `JCustomCard` `JStatsSummary` | 大屏专属 |
| `JTabToggle` `JSelectRadio` `JGroup` | 大屏专属 |
| `JDragBorder` `JDragDecoration` `JOrbitRing` `JCustomIcon` `JPermanentCalendar` | 大屏专属 |
| `JVideoPlay` `JVideoJs` `JWeatherForecast` | 大屏专属 |
| `JTable` | 大屏专属（仪表盘用 `JCommonTable`） |
| `JBreakRing` `JRotatePie` `JActiveRing` `JTotalProgress` | qqyMenuData（敲敲云仪表盘）专属 |
| `JQuadrant` `JBubbleRank` | 大屏专属 |

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
| 2 | API 接口（url 字段指定） |
| 3 | SQL 查询（数据集配置） |
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

## 主题配置

### 大屏主题
```json
{
  "theme": "dark",
  "style": "bigScreen",
  "backgroundColor": "",
  "backgroundImage": "/img/bg/bg4.png"
}
```

可用背景图：
- `/img/bg/bg1.png` ~ `/img/bg/bg10.png`

### 仪表盘主题
```json
{
  "theme": "default",
  "style": "default",
  "backgroundColor": "#f3f5f8"
}
```

组件主题颜色：`default`, `gray`, `green`, `red`, `blue`, `dark`

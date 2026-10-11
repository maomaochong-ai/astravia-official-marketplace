---
name: dbx-pro-bigscreen
description: >-
  数据大屏生成器 —— 将自然语言需求转换为 ECharts 紧凑 spec，
  通过 dbx-pro server HTTP API (`/api/bigscreen/generate`) 编译为完整大屏 HTML。
  触发：用户说"大屏/数据大屏/BI大屏/监控大屏/展厅展示/全屏幕"，
  或描述大屏需求如"做一个销售数据大屏"/"做一个客流大屏"。
disable-model-invocation: false
---

# dbx-pro-bigscreen —— 数据大屏生成器（dbx-pro 品牌化）

> **与 jimubi-bigscreen 同构，但渲染引擎是 ECharts（不是 JimuBI 组件），API 是 dbx-pro server（不是 JeecgBoot 平台）。**

## 触发条件

用户提到：大屏、数据大屏、BI大屏、可视化大屏、监控大屏、展厅展示、全屏幕、data visualization big screen、big screen。

## 核心流程

```
用户描述需求
  ↓
① 确认数据源：mock 数据 / 数据库表 / SQL
  ↓
② 确认布局：左中右 / 顶KPI + 网格 / 四角落 / 全网格
  ↓
③ 确认主题色板（palette）:
     tech（科技深蓝）/ tech-blue（科技青）/ gov（政务金）/ biz（商务）/
     retro（复古暗红）/ medical（医疗深绿）/ financial（金融深蓝）
  ↓
④ 写紧凑 spec → 调 HTTP API
   POST http://localhost:{PORT}/api/bigscreen/generate
   body: { spec: {...}, engine: "echarts" }
  ↓
⑤ server 编译链（engine/bigscreen-compiler.mjs）:
   spec → defaults 展开 → handler 路由 → palette 应用 → pitfall 防呆 → ECharts option
  ↓
⑥ 返回 { html, options, warnings }
```

## 紧凑 spec 格式（AI 只写最少字段）

```json
{
  "page": { "name": "香山公园客流大数据", "theme": "dark" },
  "palette": "tech",
  "components": [
    { "type": "JStatsSummary", "title": "今日客流", "variant": "2",
      "items": [{ "label": "总客流", "value": "29,500", "suffix": "人" }] },
    { "type": "JBar", "title": "各区域客流",
      "data": [{ "name": "东门", "value": 12000 }, { "name": "西门", "value": 8500 }] },
    { "type": "JGauge", "title": "客流饱和度", "value": 78, "max": 100 }
  ]
}
```

## 已支持的组件类型（40 种）

| 分类 | JimuBI 类型 | dbx-pro 渲染 |
|---|---|---|
| 柱图族 | JBar / JStackBar / JMultipleBar / JNegativeBar / JPercentBar | ECharts bar |
| 折线族 | JLine / JSmoothLine / JStepLine / JArea / JMultipleLine | ECharts line |
| 饼图族 | JPie / JRing / JRose / JRotatePie / JBreakRing | ECharts pie |
| 雷达 | JRadar / JCircleRadar | ECharts radar |
| 散点 | JScatter / JBubble | ECharts scatter |
| 漏斗 | JFunnel / JPyramidFunnel | ECharts funnel |
| 仪表盘 | JGauge / JSemiGauge / JColorGauge | ECharts gauge |
| 排行榜 | JScrollRankingBoard | ECharts bar（自动排序 TOP N）|
| 文本/装饰 | JText / JDragDecoration | HTML div |
| 统计卡 | JStatsSummary / JCountTo / JNumber | HTML 卡片 |
| 滚动表 | JScrollBoard / JScrollTable | HTML 表格 |

**不支持**（需 GeoJSON 地图数据）：JFlyLineMap / JAreaMap / JBubbleMap / JBarMap → 建议换 JBar / JScatter 组合。

## Pitfall 清单（自动修正）

| 问题 | 自动修正 |
|---|---|
| label 字段错写成 name | 自动补全 |
| 颜色缩写 #abc → #aabbcc | 展开 |
| 饼图添加了 xAxis/yAxis | 警告忽略 |
| grid.width/height 百分比字符串 | 移除（用 containLabel:true）|
| 饼图高度 < 220px | 警告图例可能重叠 |
| 仪表盘高度 < 180px | 警告显示不全 |

## 10 个行业模板（一键套用）

| ID | 名称 | 行业 | 布局 |
|---|---|---|---|
| xiangshan | 香山公园客流大数据 | 旅游 | 左中右 |
| group-data | 集团综合数据大屏 | 集团 | 顶 KPI + 网格 |
| police-monitor | 警务监控系统 | 警务 | 顶 KPI + 网格 |
| medical-monitor | 医院实时数据监控 | 医疗 | 顶 KPI + 网格 |
| finance-service | 乡村振兴普惠金融 | 金融 | 网格 |
| environment-emit | 北京市污水排放监控 | 环保 | 网格 |

AI 可以说："用香山公园客流模板生成大屏" → Agent 加载模板 spec + 自动生成 mock 数据 → 调 API → 返回 HTML。

## HTTP API 参考

### POST /api/bigscreen/generate

```bash
curl -X POST http://localhost:PORT/api/bigscreen/generate \
  -H "Content-Type: application/json" \
  -d '{"spec": {...}, "engine": "echarts"}'
```

**请求体**：
```typescript
{
  spec: JimubiCompactSpec;   // 紧凑 spec
  engine?: "echarts" | "chartjs"; // 默认 echarts
  mockDataRules?: MockDataRule[]; // 可选：mock 数据生成规则
}
```

**响应体**：
```typescript
{
  html: string;             // 可直接预览的完整 HTML 大屏
  components: Array<{       // 每个组件的编译产物
    kind: "echarts" | "html";
    type: string;           // 标准化类型
    echartsOption?: object; // ECharts option
    html?: string;          // HTML 片段
    warnings?: string[];    // pitfall + 布局预警
  }>;
  palette: Palette;         // 应用的完整色板
  template?: string;        // 如果用了模板，模板 ID
}
```

### GET /api/bigscreen/templates

返回所有可用模板列表。

### GET /api/bigscreen/templates/:id

返回单个模板 spec + mock 数据生成规则。

## 服务端代码位置

| 层 | 文件 | 职责 |
|---|---|---|
| HTTP API | `server/src/api/bigscreen-api.mjs` | 路由 /api/bigscreen/* → 调用 compiler |
| 核心编译 | `server/src/engine/bigscreen-compiler.mjs` | Jimubi spec → ECharts option（28 种 handler + 5 套色板 + 15 pitfall）|
| mock 生成 | `server/src/engine/mock-data-generator.mjs` | 6 种 generator（top-n / time-series / categorical / ...）|
| 模板数据 | `server/src/engine/templates/bigscreen-*.json` | 10 个行业大屏模板 spec |

## 与 jimubi-bigscreen 的差异

| 维度 | jimubi-bigscreen (JeecgBoot) | dbx-pro-bigscreen |
|---|---|---|
| 渲染引擎 | JimuBI ECharts 组件 | 原生 ECharts 5.6.0 |
| API 地址 | `POST /jmreport/bigscreen/page/save` | `POST /api/bigscreen/generate` |
| 输出 | JimuBI 组件 JSON → 上传 | 直接返回完整 HTML 大屏 |
| 数据库 | JeecgBoot 在线表（cgform）| dbx MCP 直连 60+ 数据库 |
| 颜色体系 | PALETTES bg4（只有一套）| 6 套命名色板（tech/gov/biz/retro/medical/financial）|
| 组件类型 | 60+ JimuBI 组件 | 40 种映射（ECharts 28 + HTML 12）|
| 平台依赖 | JeecgBoot 后端 + X-Access-Token | dbx-pro server（localhost）|

## 安全准则

1. **先确认数据源**：用户未指定时必须先问（mock / 数据库 / SQL），禁止编造虚假数据
2. **SQL 安全**：执行 SQL 必须走 dbx MCP + sql-safety.mjs 检查
3. **执行前 show tables**：确认表名正确，禁止幻觉表名
4. **组件类型不匹配**：地图类组件（JFlyLineMap 等）不支持，告知 AI 换等价组合

## references/

| 文件 | 内容 |
|---|---|
| references/api-dataset-examples.md | 92 条 API mock 接口参考库（GET，无需鉴权）|
| references/bi-comp-option-config.md | 大屏组件配置修改参考（含专文索引）|
| references/bi-component-types.md | 大屏实际可用组件类型列表（menuData 激活项）|
| references/bi-mode-online.md | BI 模式（dataType=4）直连 Online 表的差异点 |
| references/border-style-guide.md | JDragBorder 13 种边框样式速查 |
| references/break-ring-option-config.md | JBreakRing（多色环形图）配置路径 |
| references/card-scroll-option-config.md | JCardScroll 三个变体配置路径（横向 / 竖向+序号 / 高亮+联动）|
| references/comp-group-charts.md | 图表类组件速查（柱形 / 折线 / 饼环 / 散点漏斗雷达 / 象形 3D 字符云）|
| references/comp-group-maps.md | 地图类组件速查（AreaMap / BubbleMap / FlyLineMap / BarMap / HeatMap / GaoDeMap）|
| references/comp-group-special.md | 仪表盘 / 进度 / 视频 / 天气 / 日历 / 交互类组件速查 |
| references/comp-group-stats.md | 统计 / 数字 / 轮播类组件速查（StatsSummary / CountTo / CardScroll / CardCarousel）|
| references/comp-group-tables.md | 表格 / 列表 / 排行类组件速查（ScrollBoard / ScrollTable / ScrollRankingBoard / ScrollList）|
| references/connect-line-guide.md | 组件连线（linesConfig.connectLine）配置指南 |
| references/data-binding-mapping.md | 数据集绑定到组件的唯一映射机制文档 |
| references/dataset-guide.md | 数据集管理（SQL / API / JSON / WebSocket 四种动态数据源）|
| references/datasource-dataset-chart-guide.md | 从零创建数据源 → SQL 数据集 → 图表组件完整操作流程 |
| references/dict-guide.md | 大屏字典表 jimu_dict / jimu_dict_item 管理（非 sys_dict）|
| references/gaode-map-option-config.md | JGaoDeMap（高德地图）配置路径 |
| references/group-guide.md | JGroup 组件组合：将多组件合并为整体拖动缩放 |
| references/linkage-drill-guide.md | 组件联动（linkageConfig）与钻取配置 |
| references/list-progress-option-config.md | JListProgress（列表进度图）配置路径 |
| references/map-guide.md | 地图组件 GeoJSON 数据管理（AreaMap / FlyLineMap / BubbleMap 等）|
| references/map-static-data.md | 省份 GDP / 城市散点 / 飞线等静态演示数据（禁止自行设计简陋数据）|
| references/online-design-form-chart-guide.md | Online 表单 / 设计器表单生成图表技术指南 |
| references/orbit-ring-option-config.md | JOrbitRing（轨道环形文字）配置路径 |
| references/page-config-guide.md | 页面级配置（背景色 / 水印 / 背景图 / 宽高 / 名称）|
| references/permanent-calendar-option-config.md | JPermanentCalendar（日历）配置路径 |
| references/pitfalls.md | API 踩坑记录（多组件并行绑数据集等）|
| references/popup-guide.md | 大屏弹窗（Popup Modal）实现指南 |
| references/rightclick-actions-guide.md | 组件右键操作 / 图层排序 / z-index 数组操作 |
| references/scroll-list-option-config.md | JScrollList 三个变体配置路径（注意 compType 均为 JScrollList）|
| references/select-radio-guide.md | JSelectRadio 选项卡：点击显示隐藏关联组件 + compShowConfig |
| references/semi-gauge-option-config.md | JSemiGauge（半圆仪表盘）配置路径 |
| references/signing-datasource-guide.md | @SignatureValidation 接口签名机制与数据源管理 |
| references/spec-builder.md | spec_builder.py 一站式速查（精简速查，80% 常用场景）|
| references/stats-summary-option-config.md | JStatsSummary 三个变体配置（卡片 / 背景 / 高亮）|
| references/tab-toggle-option-config.md | JTabToggle（导航切换）配置：点击/轮播控制其他组件显隐 |
| references/template-copy-guide.md | 模板复制创建大屏（备选方案，视觉布局精确还原时用）|
| references/weather-forecast-guide.md | JWeatherForecast 天气预报组件（dataType 必须为 1）|

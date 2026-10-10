# ADR-0009: BI 数据资产 —— 从「图表打包器」到「看板/大屏工作台」的能力边界

## 状态

已接受。M0（`0.1.16`）、M1（`0.2.0`）、M2（`0.3.0`）与 M3（`0.4.0`，轻量血缘）已交付；M4 的三项远期评估本轮已给出结论（不做，理由见 §9 M4），仍维持非本次交付。

截至 `0.4.0` 的验收状态：**用自动化证据能勾的都已勾完**。M1 原先唯一未闭环的「重新取数」真实连接验收项，已由新增的**真库门控集成测试** `src/test/bi-live-postgres.test.js` 在本机真实 PostgreSQL 上跑通（3/3 通过，不是跳过）。但实施方案 §4 那份**界面级**手动清单仍未手动跑过一遍（本机只有 PostgreSQL、没有 MySQL 实例），逐个条目的覆盖状态与缺口记在实施方案 §4 与其下的结论里 —— 两处不能互相顶替。

调研数据取自 **2026-10-09 一轮 Quick BI 官方文档实测**（`help.aliyun.com/zh/quick-bi/` 的 `llms.txt` 文档树共 1126 篇，精选 61 篇读全文）与本仓库 **2026-10-09 实测源码**（行数均为当日实测值）。

配套实施方案见 [`../plans/bi-data-assets-implementation-plan.md`](../plans/bi-data-assets-implementation-plan.md)。

---

## 0. 本轮（2026-10-09）增量结论

| # | 发现 | 对决策的影响 |
|---|------|-------------|
| 1 | Quick BI 的对象模型是「组织 → 工作空间 → 资源」三层，**一切权限、发布、协作、血缘都挂在工作空间上**。dbx-pro 是「连接 → 表 → 产物」三层，没有对应物。 | 「工作空间」**不引入**。本次唯一新增的中间层是**数据集**（`DatasetSpec`），它只是产物私有的数据来源，不是可授权的资源。 |
| 2 | Quick BI 有六种分析模式：仪表板 / 数据大屏 / 电子表格 / 数据门户 / 自助取数 / 即席分析。dbx-pro 只有前两种的对应物（`type: "dashboard" \| "screen"`）。 | 电子表格 / 数据门户 / 数据填报 / 数据服务**不进范围**。自助取数与即席分析的能力已被「结果网格 + 导出」和「AI 对话」覆盖。 |
| 3 | Quick BI 的仪表板是**磁贴式布局 + 拖拽画布**，产物是服务端持久化的可编辑对象。dbx-pro 的产物是**一次性生成的整页 HTML 字符串**（`Visualization.html`）。 | 这是最大的结构差距：dbx-pro 的产物**不可局部编辑**，改一个标题也只能整页重生成。 |
| 4 | 但 `Visualization.chartItems: ChartItem[]` **已经存了可二次编辑的 Chart.js 结构**，只是 UI 只用它画图表类型图标占位（`visualization-gallery.tsx:217`），没有编辑器。 | 「可编辑」的地基已经在了：缺的是编辑器与数据来源，不是数据模型。这决定了方案取舍。 |
| 5 | Quick BI 的查询控件（筛选器）是仪表板级一等公民：6 种条件类型 + 条件级联 + 查询条件组 + 跨数据集关联 + 记住查询条件。dbx-pro **完全没有筛选能力**，只有一个孤儿测试 `src/test/filter-bar.test.js` 在模拟已删除的 `Canvas.tsx` / `FilterBar.tsx`。 | 「筛选」是本次投入产出比最高的增项：纯前端、不新增数据通道、不放开出站白名单，直接决定看板从「能看」到「能用」。列为 M1 主体。 |
| 6 | Quick BI 的数据集是「数据源 → 建模 → 数据处理 → 高级配置 → 管理 → 组合」六段流水线，本质是**把 SQL 从用户手上收走**。而 dbx-pro 的 AI 链路（`send-context.ts`）明确要求 AI 「先写聚合 SQL 再查」并原样带上 SQL。 | dbx-pro **不自建数据集编辑器**（那等于自研 BI 语义层）。但**应该把生成产物时用的 SQL 持久化为可复用的数据集** —— 复用而不是替换用户的第一手表达。 |
| 7 | Quick BI 的图表目录是 45 种；dbx-pro 的 `ChartItem.type` 是 8 种 Chart.js 原生类型。 | 45 种里只有约 8 类是**独立几何表达**，其余是地图投影（7）、表格（4）、指标卡类、高级统计图形。正确做法是**扩表现力 + 留自定义逃生口**，而不是枚举 45 个类型名。M2 处理。 |
| 8 | Quick BI 有完整权限体系（组织 3 角色 + 空间 4 角色，映射固化）、开放平台（AccessKey + ticket 免登嵌入）、健康巡检、血缘分析、审计日志。 | 前四项**属于非目标**：本地单用户插件没有账号主体、没有发布面、没有托管域名。但「血缘」的轻量版（产物 → 源连接/表/SQL）在本地成立且有价值，已作为 M3（`0.4.0`）交付。 |
| 9 | Quick BI 的产物生命周期是「保存 → 保存并发布 → 下线 → 删除」+ 协同授权抢锁（作者断网或 3 小时无编辑未保存时他人可无锁接管）。 | 单用户场景下发布/抢锁不成立。但「产物自身的 schema 版本」这件事必须做 —— 当前 `visualizations.json` 连版本迁移都没有，且有 `MAX_VISUALIZATIONS = 20` 的静默截断。M0 处理。 |
| 10 | Quick BI 的「智能小Q / AIPro」已把自然语言问数做成第一方能力；dbx-pro 的 AI 链路（对话 → SQL → 图表 → 产物）方向一致。 | **不让 BI 模块自建 AI 通道**，继续复用 `ctx.agent` + `dbx_query_full` + `dbx_chart_collection`。编辑与筛选是 UI 行为，不回灌 AI。 |

---

## 1. 问题陈述

### 1.1 现状：名字与形态不匹配

「BI 数据资产」在 dbx-pro 里已经存在（`visualization-gallery.tsx:74`、`workbench-top-bar.tsx:150`、`send-context.ts:122-123`），但它的实际能力是**图表打包器 + 产物下载器**，与「数据资产」这个名字暗示的东西差着一整层。

三个硬约束：

1. **产物是死字符串。** `Visualization.html` 由 `dbx_chart_collection` 一次性拼出（`chart-shell.ts` 38 行 + `chart-defaults.ts` 34 行 + `themes/dashboard.css` 12 行 / `themes/screen.css` 15 行）。生成之后没有局部修改入口。
2. **没有筛选。** 没有查询控件、没有条件级联、没有「记住查询条件」。用户拿到看板后唯一能做的交互是滚动和 hover tooltip。
3. **没有数据来源这一层。** 数据获取完全外置给 AI：`send-context.ts` 要求 AI ①判断是否该写聚合 SQL ②用 `dbx_query_full` 取数 ③转 `charts[]` ④调宿主 `render_chart` 预览 ⑤调 `dbx_chart_collection` 打包落库。SQL 存进了 `Visualization.sql`，但 UI 从不展示，也不复用。

另外三个实现层面的观察：

4. **存储是单文件、无版本迁移、有静默上限。** `visualization-store.ts`（145 行）：`STORE_PATH = "visualizations.json"`、`STORE_SCHEMA_VERSION = 1`、`MAX_VISUALIZATIONS = 20`，超出即截断丢弃；`normalize()` 丢弃没有 `id` 的条目。
5. **画廊是只读卡片墙。** `visualization-gallery.tsx`（360 行）：搜索（标题/表名/连接）、按 `type` 过滤（all/dashboard/screen）、卡片网格用图表类型图标做占位缩略图（**刻意不加载 iframe**）、动作只有 预览 / 下载 HTML / 新窗口打开 / 交给 AI 修改 / 删除 / 清空。
6. **旧流水线的残骸还在。** `src/test/filter-bar.test.js`（4.4 KB）测的是已删除的 `Canvas.tsx` + `FilterBar.tsx` 里的过滤逻辑 —— 即 ADR-0007 描述的「Canvas 单一事实源」在代码里已经不存在，而它的测试还在跑。

一句话：**这个模块缺的不是图表类型，是「数据来源」和「交互面」。**

### 1.2 需求拆解

| 诉求 | 现状 | 差距性质 |
|------|------|---------|
| 「生成一个看板，能筛选、能改」 | 生成 ✅ / 筛选 ❌ / 局部改 ❌ | **缺交互层**，不是缺数据通道 |
| 「数据变了，看板跟着变」 | ❌ 产物是静态 HTML 快照 | 缺**数据绑定**：产物引用的是结果，不是查询 |
| 「一个连接上的多个表拼到一个看板」 | 部分 ✅（AI 可多次查询后合并 `charts[]`） | 缺**数据集**这层的显式表达 |
| 「把看板给别人看」 | ✅ 下载 HTML / 新窗口打开（内联 Chart.js，离线可用） | 已够；不需要嵌入 / 分享体系 |
| 「权限、协作、发布审批」 | ❌ | **不适用**：单用户本地插件 |
| 「像 Quick BI 那样的 45 种图表」 | 8 种 Chart.js 类型 | 缺表现力，但**不是缺类型名** |

### 1.3 必须回答的六个硬问题

任何方案在落地前都要能明确回答以下六问，否则会在实现中期炸开：

1. **可编辑性的边界**：产物应该是「可再编辑的结构」还是「一次性 HTML」？两者能否共存、谁是事实源？
2. **筛选发生在哪一层**：重跑 SQL，还是过滤已取回的数据？聚合口径会不会因此改变？
3. **数据集要做多重**：只做 SQL + 结果，还是要建模 / 计算字段 / 数据集组合？
4. **存储怎么演进**：`visualizations.json` v1 → v2 怎么迁移？`MAX_VISUALIZATIONS = 20` 要不要放开？落盘原始行会不会撑爆宿主存储？
5. **AI 与 BI 的分工**：谁生成图表结构？AI 生成错了谁修？编辑结果要不要回灌 AI？
6. **旧残骸怎么处理**：`filter-bar.test.js` 这类孤儿测试是删、是留、还是复活？

---

## 2. 上游 Quick BI 的对象模型（2026-10-09 文档实测）

### 2.1 对象模型层级

```text
组织 (Organization)
└── 工作空间 (Workspace)          ← 权限、发布、协作、血缘的挂载点
    ├── 数据源 (Data Source)      ← 含 API 型在内的众多种类
    ├── 数据集 (Dataset)          ← 数据源与可视化之间的中间环节
    ├── 仪表板 (Dashboard)        ← 磁贴式布局，近 40 种图表
    ├── 电子表格 (Workbook)       ← 仅高级版 / 专业版群空间
    ├── 数据大屏 (Data Screen)    ← 像素级自由画布，多图层 / 图层组 / 轮播
    ├── 数据门户 (BI Portal)      ← 菜单栏式的资源集合
    ├── 数据填报 (Form)           ← 零代码在线采集，仅专业版 / 高级版
    └── 自助取数 / 即席分析 / 探索分析
```

关键点：**Quick BI 的一切都挂在工作空间上**。dbx-pro 是本地单用户插件，没有主体、没有发布面，因此这一层**不被移植**。

### 2.2 六种分析模式

| 模式 | 形态 | dbx-pro 对应 |
|------|------|-------------|
| 仪表板 | 磁贴布局，近 40 种图表 | ✅ `type: "dashboard"` |
| 数据大屏 | 像素级自由画布，多图层 / 图层组 / 轮播；页面最多 10 页 | ✅ `type: "screen"`（自动 Grid，非自由画布） |
| 电子表格 | Excel 式在线设计器，400+ 函数，复杂中国式报表 | ❌ 不做 |
| 数据门户 | 菜单栏式资源集合 | ❌ 不做 |
| 自助取数 | 大数据量导出 | ⚠️ 已被「结果网格 + 导出」覆盖 |
| 即席分析 | 拖拽式即时探索 | ⚠️ 已被「AI 对话 + 结果网格」覆盖 |

> 注：电子表格仅高级版与专业版群空间可用（专业版自带，高级版需单独增购）；IE 从 5.4.1 起不再适配。这些都说明它是面向「企业报表体系」的重型能力，与本地插件场景不同源。

### 2.3 数据集流水线（六段）

```text
数据源
  → 创建数据集（拖表 或 自定义 SQL；单数据集表 + SQL 数量 ≤ 100）
  → 构建模型（关系模型 / 物理模型 / 其他建模）
  → 数据处理（计算字段 / 分组维度 / 过滤 / 系统内置函数）
  → 高级配置（基础属性 / Quick 引擎 / 权限管控 / 问数配置）
  → 数据集管理（跨空间复制 / 预览页 / 文件夹）
  → 数据集组合（主辅数据集）
```

**这条流水线的本质是把 SQL 从用户手上收走** —— 它面向不写 SQL 的业务人员。dbx-pro 的入口恰恰就是 SQL 编辑器，所以立场相反：SQL 是用户的第一手表达，AI 只是帮写。因此 dbx-pro **不自建数据集编辑器**，但**把产物用的 SQL 当成数据集**。

### 2.4 图表目录（45 种，实测清单）

线图 / 面积图 / 柱图 / 环形柱状图 / 条形图 / 瀑布图 / 组合图 / 饼图 / 交叉表 / 明细表 / 趋势分析表 / 多维分析表 / 色彩地图 / 气泡地图 / 仪表盘 / 雷达图 / 分面散点图 / 气泡图 / 散点图 / 指标拆解树 / 漏斗图 / 指标看板 / 指标趋势图 / 指标关系图 / 矩形树图 / 玫瑰图 / 词云图 / 热力图 / 对比漏斗图 / 来源去向图 / 热力地图 / 符号地图 / 飞线地图 / 动态条形图 / 时间轴 / 进度条 / 桑基图 / 排行榜 / 翻牌器 / 楼宇热力图 / 弧线图 / 子弹图 / 箱形图 / 直方图 / 旭日图。

按**几何本质**归类，只有约 8 类是独立表达：

| 类别 | 数量 | 说明 |
|------|------|------|
| 独立几何表达（线 / 柱 / 条 / 饼环 / 雷达 / 散点 / 气泡 / 漏斗） | ~8 | dbx-pro 的 8 种 Chart.js 类型已覆盖主要部分 |
| 地图投影 | 7 | 依赖地理底图，与离线插件矛盾 |
| 表格（交叉表 / 明细表 / 多维分析表 / 趋势分析表） | 4 | 是**表格**，属结果网格的职责，不是 `ChartItem` |
| 指标卡类（指标看板 / 指标趋势图 / 指标关系图 / 翻牌器 / 进度条 / 子弹图 / 时间轴 / 排行榜） | ~8 | 是**单值 / 多值展示**，可用极简 Chart.js 配置或纯 DOM 表达 |
| 高级统计（箱形图 / 直方图 / 旭日图 / 桑基图 / 来源去向图 / 词云图 / 热力图 / 动态条形图 / 弧线图 / 矩形树图 / 玫瑰图 / 瀑布图 / 组合图 / 指标拆解树 / 对比漏斗图 / 分面散点图） | ~16 | 需要额外渲染能力，按需评估 |

### 2.5 查询控件（筛选）

实测要点：

- **生效模式**：拖拽字段自动生成，或自定义设置
- **快捷添加**：同数据集时自动关联所有图表；**跨数据集不会自动关联**，必须切自定义模式
- **6 种条件类型**：日期选择（9 种时间粒度 + 4 种区间类型 + 快捷区间）、数值输入框（求和 / 无聚合 + 锁定筛选条件）、文本输入框（单条件 / 或条件 / 且条件 + 匹配语法）、下拉列表（自动解析 / 单个数据集 / 手工输入；显示上限 1000）、树形下拉（≤ 10 层；单选 / 多选；点击 / 预先查询）、复合查询
- **条件级联配置**、**查询条件组**（同组内只有一个条件生效）
- **记住查询条件**（报表级 / 组织级）
- **跨数据集 / 数据集组合**（主辅数据集）+ 占位符同名传递
- 卡片看板侧还有「查询条件带入」与「筛选值记录」（非日期条件记录收藏瞬间的取值；日期条件每次进入自动更新，不记录上次）

### 2.6 权限模型

- 组织层：组织管理员 / 权限管理员 / 普通用户 + 自定义组织角色（建议管理员各 1~3 人）
- 空间层：空间管理员 / 空间开发者 / 空间分析师 / 空间查看者 + 自定义空间角色
- **角色 → 权限的映射是固化的，不可修改**
- 另有行级 / 列级权限、水印、作品管控、导出控制、IP 白名单

### 2.7 生命周期与协同

`保存` → `保存并发布 / 重新发布`（可选空间级作品发布审批：选择审批人 + 申请理由；空间管理员发布无需审批）→ `下线` → `删除`。
分享（私密链接 / 公开链接）、协同授权（**抢锁机制**：作者 A 正常保存退出则 B 无需抢锁；A 断网或 3 小时无编辑未保存则 B 无需抢锁即可接管并覆盖；A 正在编辑则 B 需抢锁，可选是否同步 A 的最新改动）。

### 2.8 开放平台

`开放集成(开放 API) / 嵌入分析 / 数据服务 / 自定义扩展 / 开放统计`。

嵌入三步：**开通嵌入 → HTTPS 取 `accessTicket`（`/openapi/ac3rd/ticket/create`）→ 拼接免登 URL**。
基础方案 vs 增强方案：绑定用户（owner / 千人千面）、访问次数（10 万 / 不限）、水印（不支持 / 支持）、有效时长（≤ 240 分钟 / 自定义）、全局参数与区块嵌入（不支持 / 支持）、跳转次数（1 次 / 任意次）。
访问控制靠**组织识别码（AccessKey = Access Key ID + AccessKey Secret）**；更新 AccessKey 会让已嵌入报表无法访问。

### 2.9 运维与治理

- **健康巡检**：用量规格 / 查询性能 / 任务调度 / 组织配置 / 资源使用 五类明细；状态分「异常（≥90%）/ 提醒（75–90%）/ 正常」
- **血缘分析**：组织级（图 + 列表）/ 空间级（仅图）；门禁角色为空间管理员 / 组织管理员 / 智能运维；**仅分析已发布的资源**；可下钻到仪表板组件与电子表格区块粒度；结果可导出 Excel
- 审计日志、资源回收站、模板市场

---

## 3. 候选方案

### 方案 A：原地增强 —— 给现有产物加「结构 + 筛选」

保留 `ChartItem[]` 作为唯一数据形状，在产物级新增筛选与 SQL 展示，画廊从「卡片墙」升级为「卡片墙 + 编辑器抽屉」。

**优点**：数据模型零破坏；`chartItems` 已经存了结构；筛选纯前端；`html` 仍可原样作为「导出快照」。
**缺点**：筛选只能过滤**已取回的数据**，改不了聚合口径（除非重新取数，而那需要 SQL —— 但 SQL 只是产物级的一个字符串，不携带列信息）；`html` 与 `chartItems` 两份事实源的漂移问题继续存在。

### 方案 B：引入「数据集」中间层（**主线**）

把「一次查询 + 它的列 / 行 / 筛选」抽象成一个轻量数据集：

```ts
DatasetSpec {
  id, title,
  connection, table, sql,
  columns[], rows[], rowCount,
  fetchedAt
}
```

- 产物 `Visualization` **引用**一个或多个 `DatasetSpec`
- 「重新取数」= 重跑 `DatasetSpec.sql` → 更新 `rows` → 所有引用它的图表自动刷新
- `html` 降级为**导出产物**（导出时才生成），不再是存储的事实源
- 筛选有明确落点：数据集级（过滤 `rows`）+ 图表级（不改变数据，只改变表现）

**优点**：解决「数据变了看板跟着变」；SQL 从字符串变成可复用资产；`html` 漂移问题消失；筛选有落点且语义清晰（数据集级筛选 + 完整行数提示）。
**缺点**：需要 `visualizations.json` v1 → v2 迁移；`rows` 落盘会显著增大存储（需要行数上限 + 列裁剪）；AI 链路要改（不再只产 `charts[]`，也要产 `DatasetSpec`）。

### 方案 C：全量对齐 Quick BI 对象模型

引入组织 / 工作空间 / 数据集编辑器 / 权限体系 / 发布流程 / 报表嵌入 / 数据门户。

**优点**：能力上限最高，概念上与上游一致。
**缺点**：dbx-pro 是**本地单用户插件**，没有账号体系 —— 权限、协作、发布、嵌入全是空转。数据集编辑器等于自研一个 BI 语义层，工作量远超收益。嵌入还需要放开 `plugin.json` 的 `network.allowedHosts`（当前只有 3 个发布资产域名）并依赖托管服务端 —— 那是一次独立的安全决策。

> **明确不做。**

### 方案 D：不做本地模型，全部交给宿主 `render_chart`

把 BI 模块退化为「宿主对话里图表的收藏夹」，只存 `ChartItem[]`，预览靠宿主。

**优点**：代码最少，没有存储演进问题。
**缺点**：产物无法离线查看、无法导出为独立文件、无法在无对话时打开；`visualization-store.ts`（145 行）、`html-export.ts`（38 行）、`chart-runtime.ts`（39 行，内联 Chart.js 运行时）这些投入全部作废。

> **不采纳。** 但它的一个前提值得肯定：AI 生成的图表应当在对话里先看到（`render_chart`）—— 这一点 ADR-0005 已确立，本次不改。

### 方案 E：接外部 BI 引擎（Apache Superset / Metabase / Grafana）

**优点**：表现力与能力上限由引擎决定，插件只做嵌入式壳。
**缺点**：与 ADR-0008 的结论直接冲突 —— 该 ADR 明确「这一层不该由插件内置实现，而应由用户选择并替换」，且这些引擎本身就是服务端应用，会把「本地单用户插件」变成「两个系统 + 一套部署」。

> **登记为远期可选，不进本次范围**（M4 只做评估，不交付）。

---

## 4. 决策

> **M0 修数据模型的下限（schema 迁移 + 上限 + 清理孤儿测试）；M1 走方案 B 的减法版（`DatasetSpec` 作为产物的数据来源，`html` 降级为导出产物）并补上筛选；M2 扩图表表现力；M3 做轻量血缘。方案 C / D / E 明确不做。四条已全部交付（`0.1.16` → `0.4.0`）。**

理由：

1. **差距的根因是「产物没有数据来源」，不是「图表类型不够」。** 45 种图表里只有约 8 类是独立几何表达，而 `ChartItem.type` 的 8 种 Chart.js 类型已覆盖其主要部分。真正缺的是：产物拿到数据之后**没有任何可再交互的面**。
2. **`html` 与 `chartItems` 已经是两份事实源，漂移一定会发生。** `generateHtml()` 把 `charts` 内联进 HTML 字符串之后，两者再无同步机制；任何「局部改一个图表」的需求都会暴露这条缝隙。方案 B 把它们收敛为一份（`chartItems` + `datasets`），`html` 退化为导出时的派生物。
3. **筛选是投入产出比最高的增项。** 纯前端、不需要新数据通道、不需要放开出站白名单、直接决定看板从「能看」变成「能用」。而 Quick BI 查询控件的复杂度（条件级联、跨数据集、查询条件组、树形下拉）远超本地场景所需 —— 只取「字段级等值 / 范围筛选 + 多图表共享」这一层。
4. **数据集编辑器不做，「SQL 即数据集」才是本地场景的正确抽象。** Quick BI 把 SQL 收走是因为它面向不写 SQL 的业务人员；dbx-pro 的入口就是 SQL 编辑器。把 `Visualization.sql` 提升为 `DatasetSpec.sql` 是**复用**而不是**替换**用户已有的表达方式。
5. **权限 / 协作 / 嵌入 / 门户不是「暂缓」，而是「不适用」。** 单用户本地插件没有主体、没有发布面、没有托管域名。硬做只会增加不产生价值的代码面与安全面。
6. **孤儿测试必须先清。** `src/test/filter-bar.test.js` 在测试已被 ADR-0007 删除的 `Canvas.tsx` / `FilterBar.tsx` 逻辑 —— 它会给出「筛选已有实现」的错误印象，也会在新筛选设计中被误当成既有契约。

### 4.1 落地形态（M1）

`src/domain/chart-contract.ts` 新增（示意，最终以类型定义为准）：

```ts
export interface DatasetSpec {
  id: string;
  title: string;
  connection: string;
  table: string;
  sql: string;
  columns: string[];
  /** 落盘前按上限裁剪；完整行数见 rowCount */
  rows: Record<string, unknown>[];
  /** SQL 完整结果行数（可能大于 rows.length） */
  rowCount: number;
  fetchedAt: number;
}

export interface ChartFilter {
  /** 字段名，必须来自 DatasetSpec.columns */
  column: string;
  /** 等值集合；空集合等价于不过滤 */
  values?: (string | number | boolean)[];
  /** 数值 / 日期范围 */
  min?: number | string;
  max?: number | string;
}

export interface Visualization {
  // …既有字段保留
  /** 导出时才生成；不再是存储的事实源 */
  html?: string;
  /** 新增：数据来源 */
  datasets?: DatasetSpec[];
  /** 新增：产物级筛选 */
  filters?: ChartFilter[];
}
```

`visualizations.json` 升到 `{ schemaVersion: 2, items: [...] }`；读路径同时接受 v1（v1 条目升级为「只读快照」：保留 `html` + `chartItems`，不尝试反推 `datasets`）。

> **实施修正（M0，2026-10-09）**：版本号只放在**文档外壳**上，`Visualization` 不加逐条 `schemaVersion`。逐条探测版本没有消费者（判定只读快照只看文档外壳是否为裸数组），加上去只是推测性字段。v1 条目改写为打 `readonlySnapshot?: boolean` 标记。见 `src/domain/visualization-doc.ts`。

一次典型流程：

```text
用户在表上右键 → 可视化 → 生成看板
  → AI 写聚合 SQL → dbx_query_full 取数
  → 产出 DatasetSpec(lce) + ChartItem[]
  → 存 visualizations.json（schemaVersion 2）

用户打开「BI 数据资产」→ 点开产物
  → 详情抽屉：数据集列表 + SQL 展示 + 筛选面板
  → 改筛选 → 前端过滤 DatasetSpec.rows → 图表重绘（不重跑 SQL）
  → 点「重新取数」→ 重跑 DatasetSpec.sql → 更新 rows → 全部图表刷新
  → 点「导出」→ 此刻才生成 html → 内联 Chart.js 运行时 → 下载
```

---

## 5. 与现有架构的接口点

以下路径均为**本仓库实测存在**的代码，行数为 2026-10-09 实测值。

| # | 路径 | 行数 | 与 BI 数据资产的关系 |
|---|------|------|---------------------|
| 1 | `src/domain/chart-contract.ts` | 35 | `ChartItem`（8 种 Chart.js 类型 + `data` / `options?` / `title?` / `description?` / `height?`）与 `Visualization`（`title` / `type: dashboard\|screen` / `connection` / `table` / `html` / `chartItems` / `sql?` / `createdAt?`）。文件头注明「旧 Canvas 规则引擎 / preset 模板 / inferLayout 已移除」。**方案 B 在此新增 `DatasetSpec` / `ChartFilter`，`html` 改可选** |
| 2 | `src/features/visualization/visualization-store.ts` | 145 | `visualizations.json`；`STORE_SCHEMA_VERSION = 1`；`MAX_VISUALIZATIONS = 20` 且**超出静默截断**。模块级单例 + `useSyncExternalStore`（所有 hook 实例共享一份列表）；`persist()` 用 `writeChain` 串行化；`hydrate()` 只读一次且「本地已改则优先本地」；`normalize()` 丢弃非对象 / 空 id 条目。**M0 的迁移点在这里** |
| 3 | `src/tools/dbx-chart-collection.ts` | 244 | 唯一的图表工具。`CHARTJS_CDN = chart.js@4.4.1`；`charts` 上限 12（handler 与 `generateHtml` 双重 trim）；`normalizeChartData()` 修 AI 常见错格式（裸数组 → labels+datasets；`data.rows` → labels+datasets + 8 色板）；`validateChartData()` 校验失败时渲染**可见错误卡片**而不是静默白屏；`generateHtml()` 拼 `buildHtmlHead` + defaults + Grid；handler 末尾 `saveVisualizationToStore()` + `showVisualizationPreview()`。**M1 增加可选 `datasets` 输入，并把 `html` 改为导出时生成** |
| 4 | `src/features/visualization/components/visualization-gallery.tsx` | 360 | 「BI 数据资产」主视图（标题见 `:74`）。搜索标题 / 表名 / 连接；`type` 过滤；`VisualizationCard` 用 `CHART_ICON_MAP`（Chart.js 类型 → lucide 图标）做占位缩略图、**刻意不加载 iframe**（网格列数按图表数 1 / 2 / 3 自适应）；溢出菜单 = 新窗口打开 / 下载 HTML / 交给 AI 修改 / 删除；清空用**两次点击内联确认**（宿主 webview 中 `confirm()` 是静默 no-op，带 3 s 计时）。**M1 在此接入详情抽屉与筛选面板** |
| 5 | `src/features/visualization/components/visualization-tab.tsx` | 103 | iframe `srcDoc` 预览 —— v0.0.103 起的唯一预览形态。**M1 改为渲染 `chartItems` + `filters`，iframe 仅保留「精确预览导出效果」** |
| 6 | `src/features/visualization/chart-shell.ts` | 38 | `buildHtmlHead({title, chartJsCdn, isScreen})` + `getShellCss(isScreen)`，通过 `themes/*.css?raw` 内联主题 CSS。**保留给导出路径** |
| 7 | `src/features/visualization/chart-defaults.ts` | 34 | `getChartDefaultsScript(isScreen)` = `CHART_RUNTIME_GUARD`（`Chart` 未定义时显示可见错误框并 throw）+ 主题 defaults（`themes/chart-defaults-dashboard.js` 56 行 / `themes/chart-defaults-screen.js` 54 行）。**UI 内渲染必须应用同一份 defaults，否则 iframe 内外视觉不一致** |
| 8 | `src/features/visualization/themes/dashboard.css` / `themes/screen.css` | 12 / 15 | 主题 CSS 极薄。UI 内渲染若不能直接复用，需要把这两份提升为可共享的 token |
| 9 | `src/features/visualization/visualization-bridge.ts` | 38 | `setPreviewCallback` / `setSaveCallback` / `showVisualizationPreview` / `saveVisualizationToStore`；工具 → UI 通知靠这套注册回调解耦（**单例回调，多实例会互相覆盖**） |
| 10 | `src/features/visualization/visualization-gallery-view.tsx` | 82 | 画廊视图装配层 |
| 11 | `src/shared/utils/chart-runtime.ts` | 39 | `withEmbeddedChartJs()` 把产物 HTML 里的 Chart.js CDN `<script>` 替换为内联 `src/vendor/chart.umd.js`（**幂等**，历史产物也会被修复，无需迁移数据）。**导出路径必须继续走它** |
| 12 | `src/shared/utils/html-export.ts` | 38 | Data URL 导出（刻意不用 Blob URL：规避 popup blocker + Blob 生命周期回收导致的空白页）；`safeFilename()` 保留中文；`downloadHtml()` / `openHtmlInNewTab()`。**M1 不变** |
| 13 | `src/shared/vendor/chart.umd.js` | — | 随插件打包的 Chart.js 运行时。**UI 内渲染应直接 import 这一份，确保与导出产物同版本** |
| 14 | `src/tools/dbx-query-full.ts` | 147 | `dbx_query_full`（自动分页拼页，默认 `maxRows = 2000`，绕过 MCP `execute_query` 的 1000 行截断）。**「重新取数」直接复用，不新增数据通道** |
| 15 | `src/tools/register-tools.ts` | 21 | 只注册 `dbx_query_full` + `dbx_chart_collection` 两个 Agent 工具。**M1 不改**（编辑与筛选是 UI 行为，不是新的 Agent 工具） |
| 16 | `src/shared/ai/send-context.ts` | 260 | AI 工作流提示词（双路径）：①先判断是否该写聚合 SQL ②`dbx_query_full` 取数 ③转 `charts[]` ④宿主 `render_chart` 原生卡片预览 ⑤`dbx_chart_collection` 打包存 BI 数据资产。**M1 补上 `datasets` 传参说明** |
| 17 | `src/features/database-workspace/components/workbench-top-bar.tsx` | 175 | 顶部「BI 数据资产（看板/大屏）」入口按钮 + 数量角标（`:150`）。**M1 不变** |
| 18 | `src/test/dbx-chart-collection.test.js` | 11 KB | 覆盖 `normalizeChartData` / `validateChartData` / `generateHtml`。**M1 必须扩充 datasets 分支与向后兼容用例** |
| 19 | `src/test/filter-bar.test.js` | 4.4 KB | **孤儿测试**：模拟已删除的 `Canvas.tsx` + `FilterBar.tsx` 的跨源过滤逻辑。**M0 删除或改写成新筛选契约** |
| 20 | `src/test/stores.test.js` | 4.2 KB | 存储层测试。**M0 补 v1→v2 迁移用例** |
| 21 | `src/test/chart-runtime.test.js` | 3.7 KB | `withEmbeddedChartJs` / `escapeScriptContent`。**M1 复用，不改语义** |
| 22 | `src/index.tsx` | 209 | 插件装配入口：`registerActivityTab` / `registerWorkspaceView` / `registerInputAction` / `registerTools` / `ensureEngineStarted`，`contain: layout style paint` 的根隔离（ADR-0007 §5）。**本 ADR 不改它** |
| 23 | `plugin.json` | 131 | 权限已含 `storage.read` / `storage.write` / `fs.write` / `shell.openExternal` / `network.fetch`；`network.allowedHosts` = 3 个发布资产域名。**本次不需要新增权限，也不需要放开出站** |
| 24 | `adr-0005-dashboard-vs-bigscreen-ai-generation.md` | 16 KB | 定下 dashboard = 浅色企业看板 / screen = 深色数据大屏的意图分裂、12 列 Grid、骨架屏流式渲染、LayoutSpec 不含视觉属性。**本次沿用，不改** |
| 25 | `adr-0007-unified-visualization-pipeline.md` | 9.4 KB | 定下「Canvas 单一事实源」与 CSS 隔离。**其 Canvas 实现已被移除 —— 本 ADR 是它的第二次修订** |
| 26 | `design.md` | 392 | 第 350 行原是 `- [ ] 添加数据可视化功能` —— **已过期**（可视化能力早已存在并有 4 篇 ADR）。**M0 已修正为完成项 + 指向本 ADR** |

---

## 6. 六个硬问题的当前答案

| # | 问题 | 方案 B 下的答案 | 遗留风险 |
|---|------|----------------|---------|
| 1 | 可编辑性边界 | `chartItems` + `datasets` 是可编辑事实源；`html` 只在导出时生成 | 旧产物（只有 `html`、没有 `datasets`）无法局部编辑 → 迁移时标记为「只读快照」并在 UI 上标明 |
| 2 | 筛选在哪一层 | **默认前端**：过滤 `DatasetSpec.rows`，不重跑 SQL，聚合口径不变。「重新取数」才重跑 SQL | 筛选后的行数与完整行数不一致 → 必须显式标注「筛选后 N 行 / 全部 M 行」 |
| 3 | 数据集做多重 | 只做 `DatasetSpec`（sql + rows + columns + filters）。**不做**建模 / 计算字段 / 分组维度 / 数据集组合 | 用户会期待计算字段 → 明确写「计算字段请在 SQL 里写」，并在文档里给例子 |
| 4 | 存储演进 | v2：`{ schemaVersion: 2, items }`；v1 自动升级为只读快照；`MAX_VISUALIZATIONS` 20 → 100 且截断时**明确提示** | 100 个产物 × 落盘 rows 可能到几十 MB → 需要行数上限（2000）+ 列裁剪；超大结果只存 sql 不存 rows |
| 5 | AI 与 BI 分工 | AI 只产结构与 SQL；**编辑与筛选是 UI 行为**，不回灌 AI | AI 生成的 SQL 可能不合法 → 重新取数失败必须原样透传错误文本并落到 `classifyError` 的既有码 |
| 6 | 旧残骸 | 删除 `filter-bar.test.js`（它测的是不存在的代码）；`src/shared/services/infer-schema.ts` 另行确认引用后处理 | 若有未发现的引用，删除会断测试 → M0 先全仓 `grep` 确认 |

---

## 7. 非目标（明确不做）

- ❌ **不做组织 / 工作空间 / 角色 / 权限体系**。本地单用户插件没有主体。
- ❌ **不做发布 / 协同授权 / 抢锁 / 作品发布审批**。
- ❌ **不做报表嵌入与 ticket 免登**。需要放开 `network.allowedHosts`，且依赖托管服务端。
- ❌ **不做数据门户 / 电子表格 / 数据填报 / 数据服务（生成 API）**。
- ❌ **不做数据集编辑器**（建模、计算字段、分组维度、数据集组合、Quick 引擎）。
- ❌ **不做地图类图表**（7 种）。需要地理底图，与离线可用的产物矛盾。
- ❌ **不做健康巡检 / 审计日志 / 资源回收站 / 模板市场**。
- ❌ **不改 `dbx_chart_collection` 的工具 id 与既有参数名**（`charts` / `type` / `title` / `layout` / `connection_name` / `sql` 保持稳定），只做增量。
- ❌ **不改 ADR-0005 的 12 列 Grid 与 dashboard / screen 主题分裂**。
- ❌ **不新增 Agent 工具**。编辑与筛选是 UI 行为。
- ❌ **不引入新的服务进程**。服务端仍是单个 `dbx-engine`（`host-node`）。
- ❌ **不让 BI 模块自建 AI 通道**。继续复用 `ctx.agent` + `dbx_query_full` + `dbx_chart_collection`。

---

## 8. 风险

| 风险 | 影响 | 缓解 |
|------|------|------|
| 落盘 `rows` 让 `visualizations.json` 膨胀 | 宿主存储写入 / 读取变慢 | 行数上限（2000，与 `dbx_query_full` 默认一致）+ 列裁剪 + 超大结果只存 sql 不存 rows |
| v1 → v2 迁移写坏存量产物 | 用户丢失已有看板 | 迁移**只读不删**：v1 条目升级为「只读快照」（保留 `html` + `chartItems`），不尝试反推 `datasets` |
| 筛选后的图表与「完整结果」口径混淆 | 用户基于错误结论决策 | UI 显式区分「筛选后 N 行 / 全部 M 行」；`rowCount` 与 `rows.length` 分开存储与展示 |
| UI 内渲染与 iframe 预览视觉不一致 | 用户导出后发现与自己看到的不同 | UI 内直接 import `vendor/chart.umd.js` 并复用 `chart-defaults`；导出走同一条路径 |
| 删除 `filter-bar.test.js` 误伤其它引用 | 测试红 / 漏删 | M0 先全仓 `grep` 引用，确认无生产代码依赖后再删；`infer-schema.ts` 单独判定 |
| `MAX_VISUALIZATIONS` 20 → 100 | 截断逻辑仍在，只是阈值变大 | 截断时 `notify` 明确提示，而不是静默丢弃；不改 `slice` 语义 |
| 方案 B 让 AI 链路变复杂 | AI 生成失败率上升 | `dbx_chart_collection` 的 `datasets` 保持**可选**：不传就退回旧行为（只存 html + chartItems） |
| 大结果集落盘后宿主 `storage.write` 超时 | 产物保存失败 | 写入前做体积估算；超阈值自动降级为「只存 sql，不存 rows」，并在 UI 上提示 |
| 方案 B 的复杂度被低估 | 里程碑滑期 | M1 明确拆成「先落模型（不改 UI）+ 再补 UI」两刀，模型先上、UI 后跟；M0 与 M1 之间不并行 |

---

## 9. 里程碑

### M0 —— 修下限（1–2 天）

目标：在**不改任何 UI 行为**的前提下，把存储与测试的地基修正，让 M1 有安全网。

- [x] `visualizations.json` 升到 `schemaVersion: 2`；读路径同时接受 v1，v1 条目标记为「只读快照」（`readonlySnapshot`）—— `src/domain/visualization-doc.ts`
- [x] `MAX_VISUALIZATIONS` 20 → 100；截断时 `notify` 提示，而不是静默丢弃
- [x] 处理孤儿测试 `src/test/filter-bar.test.js`（全仓确认无生产引用后删除；筛选语义在 M1 的 `dataset-filter.test.js` 里对真实实现重写）
- [x] 确认 `src/shared/services/infer-schema.ts`：**无生产引用，但保留** —— 它推断的列角色（时间/度量/维度）正是 M1 筛选面板选择控件形态的依据，M1 接上消费者
- [x] 修正 `design.md` 的过期路线项
- [x] 迁移用例没有放进 `stores.test.js`，而是新增 `src/test/visualization-doc.test.js`（纯函数层，不依赖 React 与 store 单例）：v1 裸数组 / v2 文档 / 无法识别输入 / 混合可信度条目 / 往返不丢
- [x] 产出：一页「BI 数据资产现状与迁移说明」—— `docs/plans/bi-data-assets-m0-notes.md`

### M1 —— 方案 B 减法版 + 筛选（主体）

**第一刀：模型先落，UI 不动**

- [x] `src/domain/chart-contract.ts` 增加 `DatasetSpec` / `ChartFilter`；`Visualization.html` 改可选，新增 `datasets?` / `filters?`
- [x] 新增 `src/domain/dataset-spec.ts`：`DatasetSpec` 的规范化与裁剪（行数上限、列裁剪、体积估算、体积降级）
- [x] 新增 `src/domain/dataset-filter.ts`：纯函数筛选求值（实现为 `applyFilters(rows, columns, filters)`，比原计划多一个 `columns` 入参，用来判断字段是否存在），空筛选等价于不过滤，字段不在 `columns` 里则跳过
- [x] `dbx_chart_collection` 增加**可选** `datasets` 输入；不传时保持旧行为（向后兼容，`dbx-chart-collection.test.js` 有专门断言）
- [x] `html` 从「存储时生成」改为「导出时生成」（带 `datasets` 时不落库 `html`），导出继续走 `withEmbeddedChartJs()`
- [x] 测试：`src/test/dataset-spec.test.js`、`src/test/dataset-filter.test.js`、`src/test/chart-source.test.js`；扩充 `dbx-chart-collection.test.js`

**第二刀：UI 跟上**

- [x] 新增 `src/features/visualization/components/visualization-detail-drawer.tsx`：产物详情（数据集列表 + SQL + 筛选面板 + 重新取数 + 按当前筛选导出）
- [x] 新增 `src/features/visualization/components/dataset-summary-list.tsx`：数据集 / SQL / 行数展示
- [x] 新增 `src/features/visualization/components/dataset-filter-panel.tsx`：字段级筛选（等值 + 范围，控件形态由 `infer-schema.ts` 的列角色决定，M0 保留的推断逻辑在这里接上消费者）
- [x] 新增 `src/features/visualization/components/chart-item-renderer.tsx` + `chart-grid.tsx`：UI 内直接渲染 Chart.js（`chart-runtime-browser.ts` 加载 `vendor/chart.umd.js` + 复用 `chart-defaults`）
- [x] 新增 `src/features/visualization/hooks/use-dataset-refetch.ts`：重新取数的异步状态机（复用 `executeServerPage`，与 `dbx_query_full` 同一条取数通道）
- [x] 画廊卡片点击打开详情抽屉；筛选变化后图表重绘且**不发起新的数据库查询**（纯函数重算，RTL 接线测试盯住数据源变化）
- [x] 显式标注「筛选后 N 行 / 已载入 M 行」（RTL 测试断言了该行）
- [x] `send-context.ts` 的 AI 工作流补上 `datasets` 传参说明（三条提示词路径均已补）
- [x] 测试：筛选过滤逻辑（纯函数）、详情抽屉的 RTL 接线测试（`visualization-detail-wiring.test.js`）、「不带 datasets 的旧调用仍可用」（工具契约 + DOM 两处断言）、主题一致性（`chart-theme-parity.test.js`）

### M2 —— 图表表现力

**实现方式：自研片段渲染器，不引入任何 Chart.js 插件**

- [x] 在 8 种 Chart.js 类型基础上评估补齐 —— 结论：**纳入漏斗 `funnel`、箱形图 `boxplot`、指标卡 `metric`**；**桑基 `sankey` 与词云 `wordcloud` 评估后不实现**（理由见下方「不实现项」）
- [x] 指标卡类（单值 / 多值展示）用纯 DOM 表达，不强行塞进 Chart.js：`metric` 渲染成自适应卡片网格，`datasets[0]` 是大字数值，`datasets[1..]` 作为口径对照行并驱动 Δ
- [x] 表格类（明细表 / 交叉表）评估是否纳入 `ChartItem.type` —— **不纳入**：明细是结果网格的职责，塞进产物等于把结果网格复制一份，还得自带分页 / 排序 / 虚拟滚动
- [x] 留下「自定义渲染器」逃生口：`src/features/visualization/figures/figure-registry.ts` 的 `FIGURE_RENDERERS` 登记表就是扩展点 —— 加一个 `(item, context) => string` 的纯函数并登记，即刻同时获得 UI 与导出两条路径；**不接受 Agent 传入裸 HTML / SVG**（那会绕过全部转义）
- [x] 新增 9 个文件（`src/features/visualization/figures/`）：`figure-palette` / `figure-text` / `figure-options` / `figure-context` / `figure-series` / `funnel-figure` / `metric-figure` / `boxplot-figure` / `figure-registry`
- [x] 渲染器签名统一为 `(item: ChartItem, context: FigureContext) => string`，返回**卡片正文片段**（不含 `.chart-card` / `<h3>`）；UI 与导出消费同一个字符串（`figure-dispatch.test.js` 断言 UI 注入结果与 `renderFigure()` 输出逐字相等）
- [x] 片段自带全部几何：样式内联在 `style="…"`，主题差异由 `FigureContext.isScreen` 决定的调色板带下来；片段里没有 `<style>`、没有 `var(--…)`，所以断网、脚本被掐断时依然可见
- [x] 配色不再有两份：8 色 `SERIES_COLORS` 从 `dbx-chart-collection.ts` 移到 `figures/figure-palette.ts`，原处改为导入，色值一字未改
- [x] `options.figure` = `{ unit, digits, showDelta, showPercent, min, max }`，只由 `readFigureOptions()` 一处校验读取（`digits` 钳在 0..6）；它不会被交给 Chart.js，原生类型传了也只是被忽略的未知键
- [x] 导出路径：`buildChartArea` 在 `isFigureType(chart.type)` 时只 push 片段并 `return` —— 不生成 `new Chart(...)`、不放 `<canvas>`
- [x] UI 路径：`ChartGrid` 三分支分派（数据非法 → 错误卡 / figure → `FigureItemRenderer` / 原生 → `ChartItemRenderer`）；新增 `figure-item-renderer.tsx` 用 `dangerouslySetInnerHTML` 注入同一段片段
- [x] 未注册类型给出可见降级卡（「当前版本不支持该图表类型：xxx」+ 已注册类型清单），不再掉进 Chart.js 得到一个白画布
- [x] `"funnel"` 加入 `SINGLE_SERIES_TYPES`（漏斗就是一条链路，只读 `datasets[0]`）；`"metric"` **刻意不加** —— `datasets[1..]` 是它的口径对照，被裁掉就没有 Δ
- [x] `send-context.ts` 三条提示词路径（结果集 / 看板 / 大屏）补齐 metric / funnel / boxplot 与 `options.figure` 的选用原则；大屏的「核心指标」明确指到 `metric`，不再让它当单值柱状图
- [x] 测试：`figure-render.test.js`（32 项：注册表与分派 / 三种渲染器的数据契约与降级 / 全部文本经 `escapeHtml`）、`figure-dispatch.test.js`（6 项：UI 分派 + UI↔导出逐字一致）、`dbx-chart-collection.test.js` 扩充（+9：enum 只增不改 / 三种类型不出 canvas / 混合页面 / 大屏调色板 / 错误卡优先级 / 离线导出）、`chart-source.test.js` 扩充（+1：funnel 单序列、metric 不裁 series）、`send-context.test.js` 扩充（+3：三处指引存在且合同行逐字一致）

**不实现项与理由（M2 的评估结论）**

- **桑基图**：分层布局与连线路径得自己写（Chart.js 无原生支持，`chartjs-chart-sankey` 也不在随插件打包的那份 UMD 里），跨层标签避让是独立工作量。价值主要是流向探索，先不做。
- **词云**：需要排版 / 碰撞检测库 + 中文分词与字形测量，收益（探索性展示）不抵体积与依赖成本。
- **地图类图表**：见 §7 非目标第 7 条 —— 需要省 / 市级地理边界数据（数 MB 级）+ 投影计算，与「产物是一份自包含离线 HTML」的成本模型直接冲突。
- **表格类**：见上，归结果网格。

### M3 —— 轻量血缘

- [x] 产物 → 源连接 / 表 / SQL / 生成时间 的展示（本地版本，不做 Quick BI 的图分析）—— `src/domain/visualization-lineage.ts`（纯函数，无 React / 无宿主依赖）+ `src/features/visualization/components/visualization-lineage-panel.tsx`（纯 props）+ 详情抽屉接线（`visualization-detail-drawer.tsx`）。表按 **(连接, 表名) 成对**标识、不做大小写折叠：PostgreSQL 会把未加引号的标识符折叠成小写，而 Linux 上的 MySQL 默认区分大小写，「宁可漏配也不错配」；新产物以 `datasets[]` 为唯一权威来源，只有旧格式快照才退回产物顶层真实记录的 `connection` / `table`（记录到的线索，不是反推）；时间按本地 `YYYY-MM-DD HH:mm` 格式化
- [x] 「哪些产物引用了这张表」反查（扫描 `DatasetSpec.connection + table`）—— `findArtifactsByTable(items, target, excludeId)`：按同样的 (连接, 表名) 对匹配，**排除产物自己**，数据源是 `useVisualizationStore()` 的 `visualizations`（只读展示，不在反查里做跳转）

### M4 —— 远期评估（非本次交付）

- [ ] 评估方案 E（外部 BI 引擎）是否值得做
- [ ] 评估产物导出为 PDF / 图片（Quick BI 支持 Excel / 图片 / PDF）
- [ ] 评估「产物快照对比」（数据变化前后）

> **本轮（0.4.0）评估结论：三项都不做，理由各自独立。**
>
> - 方案 E（外部 BI 引擎）：与「产物自包含、数据不出本机、取数走本机引擎」的成本模型冲突；只有当需要**服务端共享**看板时才成立，本轮没有这个场景。
> - PDF / 图片导出：需要先定下分页 / 打印样式与「断网单文件 HTML」这个唯一交付形态的关系，属于新增一种交付物，不是本轮补充。
> - 产物快照对比：前提是持久化**多份历史快照**（现在只存最后一份 `datasets`），这是存储模型变更，必须单独一轮并配迁移方案。

---

## 10. 验收标准

### M0

- [x] 存量 v1 `visualizations.json` 在升级后**不丢条目**，且能正常预览（`visualization-doc.test.js` + `stores.test.js`）
- [x] 达到 100 条上限时用户看到明确提示，而不是静默少一条
- [x] `src/test/filter-bar.test.js` 的处置有明确结论（删除或改写成新契约），并说明依据（已删除：全仓无生产引用；筛选语义在 `dataset-filter.test.js` 对真实实现对重写）
- [x] 全量测试通过（`npm test` in `abilities/plugins/dbx-pro`）—— 0.1.16：640 项，`# fail 0`

### M1

- [x] 生成产物后，能在详情抽屉里看到它用了哪条 SQL、哪些列、多少行
- [x] 改筛选条件后图表立即重绘，且**没有发起新的数据库查询**（筛选是纯函数重算，RTL 测试断言了重绘后的数据源）
- [x] 点「重新取数」后数据更新，图表反映新数据；失败时错误文本原样可见
      > 0.4.0 勾选依据：新增的真实连接门控集成测试 `src/test/bi-live-postgres.test.js`（真 PostgreSQL + 真引擎 + 真连接）的子测试③ —— 先向表里插一行，再驱动真实 `useDatasetRefetch` 钩子，断言重取后数据反映新值。该用例在本机连不上 PostgreSQL 时自跳过，所以这条勾选只对跑过的环境成立；不用它替代方案 §4 的手动清单。
- [x] 导出的 HTML 在**断网**环境下依然渲染（`withEmbeddedChartJs()` 内联随插件打包的 Chart.js v4.4.1，测试断言导出结果里已无 CDN 依赖）
- [x] UI 内看到的图表与导出 HTML 的图表视觉一致（同一份 `vendor/chart.umd.js` + `chart-defaults`；`chart-theme-parity.test.js` 逐条比对两套主题的卡片外观）
- [x] 不带 `datasets` 的旧调用（AI 只传 `charts[]`）仍然工作（工具契约 + 旧产物 DOM 两处断言）
- [x] 既有 8 种绘制路径回归测试通过

### M2

- [x] 新增图表类型有独立测试，且不影响既有类型 —— `figure-render.test.js`（32）盯纯函数与降级、`figure-dispatch.test.js`（6）盯 UI 分派与 UI↔导出逐字一致；`dbx-chart-collection.test.js` 断言 `enum` 前 8 位一字未改、原生 8 种仍然出 `<canvas>` 与 `new Chart(`
- [x] 地图类图表明确记录为不实现及其原因 —— 理由在 §7 非目标第 7 条与 §9 M2 的「不实现项」（地理边界数据体积与自包含离线单文件的成本模型冲突）；同一处也记了桑基 / 词云 / 表格类的评估结论
- [x] 全量测试通过（`npm test` in `abilities/plugins/dbx-pro`）—— 0.3.0：759 项，`# pass 758` / `# fail 0` / `# skipped 1`（沿用既有那 1 项 skip）；对比 0.2.0 的 708 项，新增 51 项全部落在 figure 相关测试里

### M3

- [x] 详情抽屉里能看到产物的来源（连接 → 表、SQL 行数 / 已载入行数、生成时间），旧格式快照如实说「只有表信息，没有取数 SQL」
- [x] 能反查出「还有哪些产物读了同一张表」，结果**不含产物自己**，也不跨连接误配 —— `src/test/visualization-lineage.test.js`（14 项：纯函数 10 / 面板文案 3 / 抽屉接线 1，接线用例挂的是真实抽屉与真实 store）
- [x] 全量测试通过（`npm test` in `abilities/plugins/dbx-pro`）—— 0.4.0：781 项，`# pass 780` / `# fail 0` / `# skipped 1`；对比 0.3.0 的 759 项，新增 22 项（M3 血缘 14 项 + 真实连接门控集成 3 项 + `stores.test.js` 存储用例 2 项 + `execute-server-page` 回归 3 项）

### 通用

- [x] 未修改 `plugin.json` 的 `permissions` 与 `network.allowedHosts`（整个 M1 里 `plugin.json` 只改了 `version`）
- [x] 未新增 Agent 工具
- [x] 未引入组织 / 空间 / 权限 / 发布概念
- [x] `ChartItem.type` 只增不改（旧值语义不变）
- [x] 既有 SQL 工作台 / 结果网格 / 导出能力零回归（0.2.0：708 项测试，`# fail 0`）
- [x] 插件版本按内容变更提升，并同步 `plugin.json` / `ability.json` / `package.json` / 锁文件 / `.astravia/marketplace.source.json` 中的 `dbx-pro` 条目（`0.1.16` → `0.2.0`）
- [x] 同一条规则在 M2 / M3 继续执行：`0.2.0` → `0.3.0`、`0.3.0` → `0.4.0`（每轮提升一次，不是每个 commit 一次）；0.4.0 这一轮同时把展示层文案对齐到新能力（`detail.json` / `detail.zh.json` 重写 + 市场卡片简介与标签更新）
- [x] 0.4.0 全链路：`npm run check` 无错误；`npm test` 781 项 / `# fail 0`；构建产出 `release/dbx-pro-0.4.0.astraviapkg`（29 个运行文件）；市场内容测试 59/59

---

## 附录 A：Quick BI 文档调研清单（2026-10-09）

`help.aliyun.com/zh/quick-bi/` 的 HTML 站是 SPA、`sitemap.xml` 返回 404，但 `robots.txt` 指向 `/llms.txt` —— 该文件是一份 1126 篇的 Markdown 文档索引，是本次调研的入口。正文经由 `www.alibabacloud.com/help/zh/quick-bi/…` 镜像获取（阿里云主站对批量抓取会返回 WAF challenge 页）。

已读全文的文档（按结论分组）：

**对象模型与界面**
- `gui-elements-in-the-quick-bi-console-1.md` — 控制台五大区：我的看板 / 企业门户 / 工作台 / 开放平台 / 组织管理
- `overview-of-workspace-management.md` — 空间 4 预置角色；**角色 → 权限映射固化**
- `role-permissions.md` — 组织 3 角色 + 权限管理员 + 空间 4 角色 + 自定义角色
- `overview-of-data-analysis.md` — 数据分析 = 数据辅助决策的最后一公里；仪表板近 40 种图表

**数据集**
- `overview-of-data-modeling-1.md` — 六段流水线
- `create-a-dataset.md` — 5 个创建入口；**单数据集表 + SQL ≤ 100**
- `data-process.md`、`advanced-configuration.md`、`data-set-management.md`

**仪表板 / 大屏**
- `overview-of-dashboard-creation.md` — 磁贴式布局；12 步创建流程；三大区域
- `overview-of-the-data-visualization-ui.md` — 大屏编辑器 7 个区域；组件库 8 类；页面最多 10 页
- `create-a-dashboard-2.md` — 管理图表 15 项操作；预览态 9 项功能
- `manage-dashboards.md` — 生命周期、分享 / 公开、协同授权**抢锁机制**
- `create-charts.md` — **45 种图表完整清单**
- `data-visualization-2.md`、`dashboard.md`

**查询控件**
- `create-a-filter-bar.md` — 生效模式 / 快捷添加 / 自定义 / 条件级联 / 条件组；6 种条件类型全文
- `filter-bar.md` — 查询控件全清单

**数据应用**
- `pinboard.md` — 卡片看板；查询条件带入；筛选值记录
- `subscriptions.md`、`metrics.md`、`downloads.md`、`ad-hoc-query.md`
- `overview-of-workbooks.md` — 电子表格；400+ Excel 函数；仅高级版 / 专业版
- `overview-of-forms.md` — 数据填报；基础 7 + 高级 11 + 布局控件
- `data-service.md` — 数据服务（生成 API）；仅专业版

**开放平台 / 嵌入**
- `overview-of-the-open-service-1.md` — 开放平台五大块；AccessKey 组织识别码
- `basic-scheme-for-report-embedding.md` — 三步嵌入；基础 vs 增强方案对比表

**运维 / 治理**
- `health-check.md` — 5 类明细 + 阈值
- `lineage-analysis.md` — 组织级 / 空间级；**仅分析已发布资源**
- `data-security.md` — 水印 / 作品管控 / 行列权限 / 导出控制 / IP 白名单

**未读（判定为非关键）**：数据源支持清单与各数据源能力对照表（19 KB / 18 KB）、增强方案嵌入安全细节（23 KB）、仪表板导出（9 KB）、数据集与表关联（5 KB）、数据分析入门（5.7 KB）、审计日志（6.3 KB）。这些都属于「具体配置项与运维手册」，不影响本 ADR 的架构结论。

---

## 附录 B：开放问题与复核命令

开放问题：

1. `src/shared/services/infer-schema.ts` 是否与已删除的 Canvas 可视化流水线有关联？（决定 M0 的清理范围）
2. AI 生成的 `DatasetSpec.sql` 是否总是可重跑？需要多少条真实样本才能有信心？
3. 落盘 `rows` 的真实体积上限是多少？（需要实测一个真实产物：2000 行 × N 列的 JSON 大小）
4. 宿主 `storage.write` 对单文件大小是否有硬上限？

复核命令：

```bash
cd abilities/plugins/dbx-pro

# 1) 确认孤儿测试没有生产引用
grep -rn "filter-bar\|FilterBar" src/ --include=*.ts --include=*.tsx

# 2) 现状行数（本 ADR §5 的数字来源）
wc -l src/domain/chart-contract.ts src/features/visualization/*.ts \
      src/features/visualization/*.tsx \
      src/features/visualization/components/*.tsx src/tools/*.ts

# 3) 存储 schema 与上限
grep -n "STORE_SCHEMA_VERSION\|MAX_VISUALIZATIONS\|STORE_PATH" \
      src/features/visualization/visualization-store.ts

# 4) 确认 html 与 chartItems 的双事实源
grep -n "html" src/tools/dbx-chart-collection.ts

# 5) 确认没有第二处图表工具注册
grep -rn "dbx_dashboard\|dbx_screen\|dbx_chart_collection" src/

# 6) 「BI 数据资产」在代码里的全部出现位置
grep -rn "BI 数据资产" src/
```

---

## 附录 C：Quick BI 契约原文摘录

摘录用于把结论钉在可复查的原文上，避免下一轮再被「看起来像」的说法带偏。

1. **数据集是中间环节** —— `overview-of-data-modeling-1.md`：

   > 「数据集是数据源和可视化分析之间的中间环节。」

2. **一个数据集的容量上限** —— `create-a-dataset.md`：

   > 「一个数据集中的数据表和自定义 SQL 的数量不能超过 100 个。」

3. **仪表板的布局形态** —— `overview-of-dashboard-creation.md`：

   > 「仪表板采用磁贴式布局……」

4. **角色权限映射固化** —— `overview-of-workspace-management.md`：

   > 空间角色与其权限的对应关系是固化的，用户不能修改。

5. **查询控件的跨数据集限制** —— `create-a-filter-bar.md`：

   > 快捷添加时，同一数据集内的字段会自动关联所有图表；跨数据集时不会自动关联，需要切换为自定义模式。

6. **嵌入基础方案的能力上限** —— `basic-scheme-for-report-embedding.md`：

   > 基础方案：绑定用户为报表 owner 且不可改；每个 Ticket 最多访问 10 万次；不支持水印；有效时长最大 240 分钟；不支持全局参数与区块嵌入；仅支持一次跳转。

7. **血缘只分析已发布资源** —— `lineage-analysis.md`：

   > 「仅分析已发布的资源。」

8. **电子表格的版本门槛** —— `overview-of-workbooks.md`：

   > 电子表格仅高级版和专业版群空间可用；专业版自动包含，高级版需单独增购。

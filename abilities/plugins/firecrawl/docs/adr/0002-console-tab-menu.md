# ADR-0002：让端点决定控制台的标签页

- 状态：**Proposed**（2026-10-18 提案，本轮不实施）
- 日期：2026-10-18
- 相关：[`0001-firecrawl-integration-mode.md`](0001-firecrawl-integration-mode.md)、[`../plans/0001-firecrawl-connector.md`](../plans/0001-firecrawl-connector.md)

## 1. 问题

控制台现在有 8 个固定标签页：

```text
Artifacts · Pages · Links · Media · Issues · Console · Chat · History
```

它们按**产物的种类**切分，而不是按**这一轮实际调用了哪些端点**切分。后果是：

- 一次 `firecrawl_scrape` 只产生一页内容，`Links`、`Media`、`Issues` 常年空白，用户点进去只看到
  空状态；而 `Pages` 与 `Artifacts` 里都是同一页的两种切片。
- `firecrawl_map` 只回 URL 清单，控制台没有专属落点，结果被塞进 `Pages`，与"已抓取的页面"混在
  一起 —— 一个没有正文的页面和一个有正文的页面长得一样。
- `firecrawl_agent` 有独立的运行轨迹（`GET /v2/agent/{id}/trace`），但面板里没有位置，只能读
  Agent 的最终回答。
- 额度、队列、仍在跑的 crawl（`/v2/team/credit-usage`、`/v2/team/queue-status`、`/v2/crawl/active`）
  完全没有界面，只能靠 Agent 调用 `firecrawl_account` 问一次。
- 面板宽度约 420 px，8 个标签已经需要横向滚动；再往里加只会更难找。

真正的问题不是"标签太少"，而是**标签的划分维度选错了**。

## 2. 决策

**标签页由"这一轮打开过哪些端点"决定，而不是由产物种类决定。**

### 2.1 端点 → 标签页

| 端点 | 出现条件 | 标签页 | 内容 |
| --- | --- | --- | --- |
| `POST /v2/crawl`、`GET /v2/crawl/{id}` | 有一次 crawl 运行 | **Live** | 蜘蛛图、逐页到达、真实百分比与 `next` 续页 |
| `GET /v2/crawl/active` | 打开面板即探测一次 | **Live**（顶部一行） | "上游还有 N 个爬取在跑" + 一键接管 |
| `POST /v2/map` | 调用过 map | **Sources** | URL 清单（无正文），与已抓页面分开两种行 |
| `GET /v2/crawl/{id}` 的 `links` / 页面 URL | 有任意页面 | **Sources** | 抓取图 + 站点结构，链接不是正文 |
| `scrapeOptions.formats` 的结果 | 有任意页面 | **Artifacts** | 按类型分组的产物架（Markdown / 链接 / 图片 / 视频 / 音频 / JSON / 文档） |
| `/v2/scrape`、`/v2/batch/scrape` 任务 | 有对应的非 crawl 任务 | **Jobs** | batch、monitor、`jobErrors`、取消 |
| `GET /v2/team/queue-status`、`/v2/team/credit-usage` | 面板打开时读一次 + 每轮运行结束刷新 | **Jobs**（底部额度条） | 今日额度、队列深度、并发上限 |
| `GET /v2/agent/{id}`、`GET /v2/agent/{id}/trace` | 调用过 agent | **Agent** | 按 `producerSequence` 排的步骤流 + 最终答案 |
| `POST /v2/parse` | 解析过本地文档 | **Artifacts**（`document` 分组） | 页数/表数、文本预览 |
| 上游错误、`ROBOTS` 拒绝、`next` 续页 | 运行时 | **Live**（行内）+ **Diagnostics** | 逐条原因，不进主流程 |
| 会话读写 | 永远是 | **Chat** | 与 Agent 的双向交互 |
| 归档（`ctx.storage`） | 有历史运行 | **History** | 按时间回放，产物可再次取用 |

### 2.2 标签页集合与出现规则

**常驻 4 个**（任何时刻都在）：

```text
Live · Artifacts · Chat · History
```

**按端点条件出现**（最多再加 3 个，总数上限 7）：

```text
Sources   ← 有过 map，或本轮抓取 >1 个域
Jobs      ← 有过 batch / monitor，或存在上游活跃任务
Agent     ← 调用过 firecrawl_agent
```

**不再单列的**：

- `Pages` 与 `Links` 合并进 `Sources`：同一个 URL 的"已抓 / 仅清单 / 被拒"是三种行状态，
  不是三个标签页。
- `Media` 合并进 `Artifacts`：媒体是产物的一种，不是另一种页面。
- `Issues` 合并进 `Live` 的行内提示 + `Diagnostics`（见 2.3）。
- `Console` 降级为 **Diagnostics**，只在有失败或被拒页面时出现，不再是常驻标签。

### 2.3 保留一个"原始日志"出口

失败必须可追。`Diagnostics` 只在 `failed > 0 || denied > 0` 时出现，内容是原始事件流
（请求、状态码、上游 `error` 字符串、`next` 续页游标）。它不是一个"看热闹"的标签，
而是一个**出问题时才出现的证据面板**。

### 2.4 视觉与交互约束

- 标签条继续用 `overflow-x-auto`；上限 7 个后，420 px 下不再需要滚动（当前 8 个需要）。
- 出现的标签**不重排已有标签的位置**：固定顺序 `Live · Sources · Artifacts · Jobs · Agent · Chat · History`，
  条件不满足时留空位而不是挤动。
- 动画仍然只在 Live 且可见时运行；`Agent` 的步骤流用同一条 `--animate-fc-*` 脉冲，表示"还在走"。
- 不新增权限：`/team/*` 与 `/crawl/active` 都走已有的 `network.fetch`。

## 3. 与被否决方案的区别

| 方案 | 否决理由 |
| --- | --- |
| 继续加标签（9、10 个） | 420 px 下横向滚动成为主要交互，找不到东西的概率上升；空白标签仍然存在 |
| 全部塞进一个滚动长页 | 爬取进行时最需要的是"现在到哪了"，长页把实时状态推出视口 |
| 按工具名分标签（scrape / crawl / map …） | 用户不按工具名思考；一次 crawl 会同时产生 map、scrape、crawl 三种结果 |
| 用 `Tabs` 换成下拉菜单 | 状态（还在跑 / 有失败）无法在折叠态表达 |

## 4. 后果

- 空标签消失，用户在任意一次运行里看到的标签都对应真实存在的内容。
- 需要把当前 `pages-tab` / `links-tab` / `media-tab` / `issues-tab` 的内容重组为
  `sources-tab` 与 `artifacts-tab` 的内部视图 —— 这是**结构性改动**，涉及 store 的 `documents`
  与 `artifacts` 两组投影，风险高于本轮的其他修改。
- 需要新增 `GET /v2/team/queue-status`、`/v2/team/credit-usage`、`/v2/crawl/active` 三个只读探测，
  已在 `client.ts` 实现，但尚无界面消费。
- `agent` 的 trace 已经能读（`client.agent.trace`，按 `producerSequence` 排序），只差一个渲染位置。

## 5. 本轮不实施

这份 ADR 只记录提案。本轮（0.3.3）**不动标签页结构**：

- 8 个标签保持现状；
- 新增能力只落在已有标签内：`firecrawl_account` 走 `tool.account.label` 的调用卡片，
  `agent.trace` 走 `firecrawl_agent` 的返回文本；
- 理由是重组标签会同时改动 `inspector-panel.tsx`、`crawl-run-store.ts` 的投影层和 5 个测试文件，
  与"只改插件侧、可回滚"的约束冲突。

## 6. 重新评估的触发条件

1. 端到端真机验收后，用户仍表示"找不到 map 的结果"或"看不到 agent 在做什么"。
2. `firecrawl_account` 的调用被频繁手动触发（说明额度需要一个常驻读数）。
3. 面板宽度被宿主放宽到 560 px 以上（可以重新考虑 8 个以上标签）。

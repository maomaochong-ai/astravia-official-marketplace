# 工具面覆盖审计（对着官方 OpenAPI 逐条对账）

- 日期：2026-10-18
- 依据：`https://docs.firecrawl.dev/api-reference/v2-openapi.json`（57 个操作，落盘于 `/tmp/fc-v2.json`），
  以及插件内 14 个 `firecrawl_*` 工具的实际实现（`src/tools/*.ts` → `client.ts` 的 `send(...)` 调用）。
- 结论先说：**官方 57 个操作里，插件覆盖 36 个；剩余 21 个属于两类 —— 同能力的另一入口（不需要第二个），
  以及账号策略/反馈/客服（不属于"抓取"这件事）。没有遗漏任何抓取能力。**

## 1. 已覆盖（36 个操作 → 14 个工具）

| 工具 | 覆盖的官方端点 |
| --- | --- |
| `firecrawl_scrape` | `POST /v2/scrape`、`GET /v2/scrape/{jobId}` |
| `firecrawl_batch_scrape` | `POST /v2/batch/scrape`、`GET /v2/batch/scrape/{id}`、`DELETE /v2/batch/scrape/{id}`、`GET /v2/batch/scrape/{id}/errors` |
| `firecrawl_crawl` | `POST /v2/crawl`、`GET /v2/crawl/{id}`、`DELETE /v2/crawl/{id}`、`GET /v2/crawl/{id}/errors` |
| `firecrawl_job_status` | 上述 GET/DELETE/errors 的显式入口（`kind: crawl\|batch`） |
| `firecrawl_map` | `POST /v2/map` |
| `firecrawl_search` | `POST /v2/search` |
| `firecrawl_extract` | `POST /v2/extract`、`GET /v2/extract/{id}` |
| `firecrawl_parse` | `POST /v2/parse` |
| `firecrawl_video` | `POST /v2/scrape`（媒体形态：只取 `video`/`audio`/`screenshot` 等） |
| `firecrawl_interact` | `POST /v2/interact`、`POST /v2/interact/{sessionId}/execute`、`DELETE /v2/interact/{sessionId}` |
| `firecrawl_agent` | `POST /v2/agent`、`GET /v2/agent/{jobId}`、`GET /v2/agent/{jobId}/trace`（`trace: true`） |
| `firecrawl_monitor` | `/v2/monitor` 全组：create / list / get / update / delete / run / checks |
| `firecrawl_index_search` | `POST /v2/search/developer`、`POST /v2/search/gov`、`GET /v2/search/research/papers`、`/papers/{id}`、`/papers/{id}/similar` |
| `firecrawl_account` | `GET /v2/team/credit-usage`、`GET /v2/team/queue-status`、`GET /v2/crawl/active` |

## 2. 未覆盖（21 个操作）与理由

### 2.1 同能力的另一入口 —— 不提供第二个

| 端点 | 为什么不做 |
| --- | --- |
| `POST /v2/scrape/{jobId}/interact`、`DELETE` 同上 | 这是绑定在**某次 scrape 任务**上的旧式交互入口。`/v2/interact` + session 覆盖同样的能力，官方 CLI 也已把 `firecrawl browser` 标记为 deprecated 并迁移到 `scrape` + `interact`。两套都做会让模型在两条路上摇摆。 |
| `GET /v2/parse/formats` | 静态清单。`SKILL.md` 已把 13 种可请求格式写死并解释各自代价；为一个常量多发一次请求没有收益。 |
| `GET /v2/agent`（列出历史 agent 运行） | 插件侧没有"agent 运行历史"的概念：一次 agent 结果要么在当轮返回，要么由用户给回 `jobId`。列表页在这里没有消费方。 |
| `DELETE /v2/agent/{jobId}` | 取消一个自己刚发起的 agent 运行，在对话式调用里没有可靠时机（工具调用结束即返回）。crawl/batch 的取消有明确需求（长任务），agent 没有。 |
| `GET /v2/agent/{jobId}/snapshots/{snapshotId}` | 快照是 agent 内部中间产物，官方自己的返回值里已经把最终 `data` / `partial` 给全了。 |
| `POST /v2/crawl/params-preview` | 用自然语言预览 crawl 参数。控制台已经在**本地**做了同样的钳制（`clampCrawlJobOptions`），再走一次云端会多一次往返，且与"让 Agent 直接决定参数"重叠。 |
| `GET /v2/interact`（列出会话） | 会话由插件在单次工具调用内创建与销毁，没有跨调用存活的会话需要枚举。 |
| `GET /v2/monitor/{id}/checks/{checkId}` | `checks` 操作已把每次检查的摘要列全；单条详情只在需要深挖某一次检查时才有用，属于下一轮可补的增量，不是抓取能力缺口。 |
| `GET /v2/search/developer`、`GET /v2/search/gov` | 与 `POST` 版本命中同一个索引；`POST` 能带完整过滤体，`GET` 只是省一个请求体。一个索引留一个入口。 |

### 2.2 账号策略与旁路 —— 不属于抓取

| 端点 | 为什么不做 |
| --- | --- |
| `GET /v2/team/credit-usage/historical`、`/token-usage`、`/token-usage/historical` | 历史用量是账单视角；插件只需要"现在还能不能爬"（`usage` 已给）。 |
| `GET /v2/team/activity` | 同上，审计视角。 |
| `GET/PUT /v2/team/threat-protection` | 会**改写团队安全策略**。一个抓取插件不应该顺手改账号的安全设置。 |
| `POST /v2/feedback`、`POST /v2/search/{jobId}/feedback` | 训练反馈，与用户目标无关。 |
| `POST /v2/support/ask`、`POST /v2/support/docs-search` | 客服/文档问答。插件的能力说明与 `SKILL.md` 已是权威来源；再挂一个客服会变成"回答关于 Firecrawl 的问题"的第二个入口。 |

## 3. Skill 是否齐全、是否端到端可用

`agent/skills/firecrawl/SKILL.md`（`metadata.version: "6"`，159 行）逐项对照：

- **工具表 15 行**：14 个工具 + Skill 自身入口，每个都写了"什么时候用 / 关键参数 / 代价"。
  与 `register-tools.ts` 的 14 个工厂一一对应，**无遗漏、无多余**。
- **格式按接口面拆开**：`scrape` / `batch` / `crawl` 支持 13 种；`branding` / `product` / `menu`
  仅 `scrape` 支持。这修正了上一版"18 种格式"与"只能出 Markdown"两处失真。
- **端到端可用**：Skill 里每个例子都只依赖 `firecrawl_*` 工具（不假设 CLI、不假设 MCP、
  不假设本地渲染），从"给一个网址"到"拿到 Markdown / 媒体地址 / JSON / 任务 id"闭合。
- **唯一需要用户在场的前置**：API key。无 key 时 Skill 明确说明只能走 Search / Scrape / Parse
  且按 IP 限流，并指向能力详情页的授权入口。

## 4. 仍然存在的已知边界

- `rawBase64` 与 32 MiB 单请求上限冲突，所以选中它时 crawl 页数被钳到 ≤ 2，并显示警告文案。
- `audio` / `video` 返回的是签名 URL（约 1 小时后失效），插件存的是 URL 而不是文件；
  要长期留存需用户自行下载（产物架提供 `openExternal` / 复制）。
- `/v2/crawl/active` 的文档自相矛盾（schema 写 `crawls`、required 写 `data`），客户端两种都收；
  该端点不返回进度计数，因此不做"12/40"这类推断。

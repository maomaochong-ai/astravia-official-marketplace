# 官方接入面调研：Firecrawl 的四种调用方式

本文把 docs.firecrawl.dev 上分散在 Introduction / MCP / CLI / API Reference 里的信息收拢成一份
事实清单：Firecrawl 到底提供哪几种接入方式、它们各自把请求送到哪里。**决策与取舍**不在这里，
见 [`../adr/0001-firecrawl-integration-mode.md`](../adr/0001-firecrawl-integration-mode.md)。

- 上游文档：<https://docs.firecrawl.dev/introduction>
- MCP：<https://docs.firecrawl.dev/mcp-server>
- CLI：<https://docs.firecrawl.dev/cli>
- Claude Code 快速接入：<https://docs.firecrawl.dev/quickstarts/claude-code>

## 1. 抓取流程：谁在执行抓取

Firecrawl 是托管服务，**抓取、渲染、反爬、格式转换都发生在它的服务器上**。客户端（REST / MCP /
CLI / SDK）只负责提交 URL 和取回结果，本地不产生 HTML、不跑浏览器、不解析 PDF。

一次 `scrape` 的完整链路：

```text
URL + 选项
   │  POST /v2/scrape（JSON）
   ▼
Firecrawl 云端
   ├─ 代理池 / 反爬策略
   ├─ 无头浏览器：执行 JS、滚动、等待 waitFor、执行 actions
   ├─ 抽取：主内容识别、去除 base64 图片
   └─ 格式转换：markdown / html / links / json / screenshot / attributes …
   │  200 { success, data: { markdown, metadata, … } }
   ▼
调用方
```

长任务（`crawl`、`batch/scrape`、`extract`、`monitor`）不是一次 HTTP 就结束，而是：

```text
POST /v2/crawl            → { id }
GET  /v2/crawl/{id}       → { status: scraping|completed|failed|cancelled,
                              completed, total, creditsUsed, expiresAt, data: [...] }
GET  /v2/crawl/{id}/errors → 被拒绝/失败的 URL 与原因
DELETE /v2/crawl/{id}     → 取消
```

`data` 单次最多返回 10 MB，超出的部分通过响应里的 `next` 游标翻页；`total` 只统计成功进入队列的
页面，失败页不在其中，必须读 `/errors` 才能拿到。`crawl` 的 `maxDiscoveryDepth` 是**链接跳数**，
不是页数上限；想多抓页应该提高 `limit`。

`interact` 有两条入口，上游当前主推后者：

- `POST /v2/scrape/{id}/interact`：在既有 scrape 任务的浏览器会话上继续点击/填表；
- `POST /v2/interact` 建独立会话 → `POST /v2/interact/{sessionId}/execute` 用 Node / Python / Bash
  驱动 → `DELETE /v2/interact/{sessionId}` 关闭。

两者都在云端执行，插件本身不跑浏览器。`agent` 同理：`POST /v2/agent` 起任务，
`GET /v2/agent/{jobId}` 取结果，模型（`spark-2` / `spark-1-pro` / `spark-1-mini`）在 Firecrawl 侧运行。

所有请求共用一套认证与配额：

| 形态 | 认证 | 能力边界 |
| --- | --- | --- |
| 无 Key（keyless） | 无 | 仅 Search / Scrape / Parse，按 IP 限流，有每日上限 |
| API Key | `Authorization: Bearer fc-…` | 全量接口，按套餐计费，`402` = 额度不足、`429` = 限流 |
| OAuth | 浏览器登录后由 MCP 客户端持有 | 与 Key 等价的完整工具面，适合交互式客户端 |

因此「本地引擎」在架构上没有位置：插件里再实现一遍浏览器、PDF 解析和 robots 判定，只是把
Firecrawl 已经做完的事重做一遍，而且结果一定更差。

## 2. 官方提供的四种接入方式

### 2.1 REST API v2（本文采用的运行时）

```bash
curl -s -X POST "https://api.firecrawl.dev/v2/scrape" \
  -H "Content-Type: application/json" \
  -d '{"url":"https://firecrawl.dev","formats":["markdown","html"]}'
```

插件实际使用的端点：

| 端点 | 用途 |
| --- | --- |
| `POST /v2/scrape` | 单页抓取，含 `actions` / `waitFor` / 各种 `formats` |
| `POST /v2/parse` | multipart 上传本地文件（PDF/DOCX/XLSX/…），上游做 OCR 与转换 |
| `POST /v2/batch/scrape` | 已知 URL 列表，异步 job |
| `POST /v2/crawl` | 站点爬取，异步 job |
| `GET /v2/crawl/{id}`、`/errors`、`DELETE` | 进度、失败原因、取消 |
| `POST /v2/map` | 只列 URL，不抓内容 |
| `POST /v2/search` | 先搜索，可带 `scrapeOptions` 直接抓结果 |
| `POST /v2/extract`、`GET /v2/extract/{id}` | 结构化抽取，异步 job |
| `POST/GET/PATCH/DELETE /v2/monitor…` | 定期检查，含 `/run`、`/checks` |
| `GET /v2/team/credit-usage` | 余额 |
| `POST /v2/interact`、`/execute`、`DELETE /{id}` | 独立浏览器会话，代码在云端执行 |
| `POST /v2/agent`、`GET /v2/agent/{id}` | 检索智能体，跨页面作答 |
| `POST /v2/search/developer`、`/gov`、`GET /v2/search/research/papers…` | 精选索引（开发者 / 政府 / 论文） |
| `POST /v2/scrape/{id}/interact` | 复用抓取会话做点击/填表（与独立会话能力重叠，本插件未封装） |

优点：一次 HTTPS 调用即可，无额外进程、无额外下载；Key 放在宿主凭据库；`self-hosted` 只需把
endpoint 换成 `http://localhost:3002`。

### 2.2 托管 MCP

| 形态 | 配置 | 说明 |
| --- | --- | --- |
| OAuth | `{"type":"http","url":"https://mcp.firecrawl.dev/v2/mcp-oauth"}` | 不需要 Key，客户端弹浏览器登录并授权团队 |
| API Key | `https://mcp.firecrawl.dev/v2/mcp` + `Authorization: Bearer fc-…` | 无人值守场景 |
| Keyless | 同上，不带 header | 仅 Search / Scrape / Parse |

Claude Code 的官方接入就是第一条：

```bash
claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp-oauth
# 然后在会话里输入 /mcp，选择 firecrawl 完成浏览器登录
```

本地 MCP（`npx firecrawl-mcp` 一类）只在需要本地进程或连自建实例时使用，要求 Node.js ≥ 22。

MCP 暴露的是**工具面**，不是新的抓取能力：每个工具最终仍然调用上一节的 REST 端点。

### 2.3 CLI

```bash
npx -y firecrawl-cli@latest init --all --browser   # 安装 + 登录 + 给各编码 Agent 装 skills
npm install -g firecrawl-cli                       # 或者只装 CLI

firecrawl login --browser
firecrawl --status
firecrawl https://example.com --only-main-content
firecrawl search "web scraping tutorials" --limit 10 --pretty
firecrawl --api-url http://localhost:3002 scrape https://example.com   # 自建实例
```

- 未配置 Key 时，受支持的命令回退到 keyless 免费额度（按 IP 限流）。
- 主要命令：`scrape`（默认 markdown）、`search`、`crawl`、`map`、`interact`、`agent`、
  `credit-usage`、`login/logout/view-config`、`--status`。
- 官方按平台发布**自包含二进制**（Bun 编译，`firecrawl-{darwin,linux}-{x64,arm64}.tar.gz`、
  `firecrawl-windows-x64.exe.zip`，每个 30–43 MB），npm 包只是安装入口。
- CLI 是**一次性命令**：执行、打印、退出。当前命令集合（`scrape` / `search` / `crawl` / `map` /
  `interact` / `agent` / `credit-usage`）里没有常驻 HTTP 服务模式。

### 2.4 SDK

`firecrawl`（Node）/ `firecrawl-py`（Python）只是 REST 的薄封装，插件运行时是浏览器渲染进程，
引入 SDK 只会多一层打包体积，没有收益。

## 3. 与本仓库的关系

上述四种接入面如何映射到宿主机制、最终选了哪一条，记在
[`../adr/0001-firecrawl-integration-mode.md`](../adr/0001-firecrawl-integration-mode.md)；
由此产生的改造步骤记在 [`../plans/0001-firecrawl-connector.md`](../plans/0001-firecrawl-connector.md)。

## 4. 端点对照表（2026-10-18）

以 `v2-openapi.json`（OpenAPI 3.0.0，title `Firecrawl API v2`）为准，逐条列出覆盖情况。
「工具」列写的是 Agent 工具名；空白表示不对应工具，原因写在同一行的备注里。

| 端点 | 工具 | 备注 |
| --- | --- | --- |
| `POST /v2/scrape` | `firecrawl_scrape` | 18 种 `formats`、`actions`、`question`/`highlights` 全部透传 |
| `POST /v2/parse` | `firecrawl_parse` | multipart 上传本地文件 |
| `GET /v2/parse/formats` | — | 纯元数据查询，UI 里没有需要它的位置 |
| `POST /v2/batch/scrape` | `firecrawl_batch_scrape` | |
| `POST /v2/crawl` | `firecrawl_crawl` | `perPage.formats` 由控制台勾选 |
| `GET /v2/crawl/{id}`、`/errors`、`DELETE` | `firecrawl_job_status` / `firecrawl_crawl` | |
| `GET /v2/crawl/active`、`GET /v2/crawl/params-preview` | — | 参数预览与活动列表由控制台自己的 store 提供 |
| `POST /v2/map` | `firecrawl_map` | |
| `POST /v2/search` | `firecrawl_search` | |
| `POST /v2/search/developer` | `firecrawl_index_search` | `index: "developer"` |
| `POST /v2/search/gov` | `firecrawl_index_search` | `index: "gov"` |
| `GET /v2/search/research/papers`、`/papers/{id}`、`/papers/{id}/similar` | `firecrawl_index_search` | `index: "research"` |
| `POST /v2/extract`、`GET /v2/extract/{id}` | `firecrawl_extract` | |
| `POST /v2/interact`、`/execute`、`DELETE` | `firecrawl_interact` | 代码在沙箱执行，不回显到控制台 |
| `POST /v2/agent`、`GET /v2/agent/{id}` | `firecrawl_agent` | `wait:false` 返回 jobId，后续轮询 |
| `POST /v2/scrape/{id}/interact` | — | 与独立会话能力重叠；一条路径足够 |
| `POST/GET/PATCH/DELETE /v2/monitor…`、`/run`、`/checks` | `firecrawl_monitor` | `checks` 只在创建/更新时可读回 |
| `GET /v2/team/credit-usage` | — | 能力页与连接条直接读取余额，不需要工具入口 |
| `GET /v2/team/usage`、`/team/token-usage` | — | 团队运营报表，控制台不是计费面板 |
| `POST /v2/feedback`、`/search/feedback` | — | 上游质量反馈，与用户任务无关 |
| `POST /v2/support/ask` | — | 上游客服入口 |
| `POST /v2/x402/…`（按次付费） | — | 需要钱包签名，桌面端不管理私钥 |
| `find_tools` / Alexandria | — | 返回 Firecrawl 自家工具图谱与第三方集成元数据，不是页面数据；桌面连接器的工具表是静态的 |
| webhook CRUD、threat-protection、team admin | — | 账号配置面，用户在上游控制台完成 |

「未封装」不是遗漏，而是三条边界：① 返回的不是页面内容的接口；② 与现有工具重复的接口；
③ 账号/计费/客服配置。新增端点时先判断它落在哪一条，再决定是否补工具。

- 官方文档原文整理：[`claude-code.md`](./claude-code.md)
- 文档索引：[`README.md`](./README.md)

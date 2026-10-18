# Firecrawl连接器

在 Astravia 里读取网页，并把爬取过程画成一只在页面结构里行走的蜘蛛。默认拿到 Markdown，同一次调用也可以要 HTML、链接、截图、图片、视频与音频地址、摘要或按 schema 的 JSON——返回什么取决于你要的格式，而不是只有正文。每个请求都由
[Firecrawl](https://docs.firecrawl.dev) 执行——本插件不再自带任何抓取引擎。

```text
Agent 工具  ──►  请求体  ──►  Firecrawl API v2  ──►  Markdown / 媒体地址 / JSON / 任务状态
控制台      ──►  POST /v2/crawl ──►  GET /v2/crawl/{id}  ──►  蜘蛛图 + 页面
```

## 接入 Firecrawl 的三种方式

Firecrawl 不止一种集成面，宿主对每种都有对应机制。本插件用的是真正传输数据的那一种：

| 方式 | 是什么 | 为什么采用 / 不采用 |
| --- | --- | --- |
| **REST API v2** | `https://api.firecrawl.dev`（或自建实例），用 API Key 走 HTTPS | **已采用。** 请求由宿主发出（`ctx.network.request`），没有 CORS、没有额外进程，Key 留在宿主凭据库。覆盖面最全：scrape、parse、map、crawl、batch、search、extract、monitor。 |
| **MCP 服务器** | `https://mcp.firecrawl.dev/v2/mcp`、`/v2/mcp-oauth`（登录）或无 Key | **不内嵌。** OAuth 变体不需要密钥，技术上可以声明；但它会把工具重复成 `mcp_plugin-firecrawl-*`，绕开控制台与运行记录，并把登录态放进宿主 MCP 设置里，插件无法查看或注销。偏好这种工具面的话，请直接在 MCP 客户端里添加。 |
| **CLI** | `npx -y firecrawl-cli@latest …`，或由宿主通过 `providers.cli` 安装的 30–43 MB 独立二进制 | **不封装。** CLI 是同一批端点的第二个客户端：能力完全相同，却多一次下载和一次进程启动。请在终端使用；完整推理见 [docs/adr/0001-firecrawl-integration-mode.md](docs/adr/0001-firecrawl-integration-mode.md)，上游事实见 [docs/search/official-surfaces.md](docs/search/official-surfaces.md)。 |

因此「用哪个引擎」不再是设置项：只有一条路径，Key 只影响速率与额度。

## 连接账户

免密钥可用，但 Firecrawl 在这种模式下只提供 Search、Scrape、Parse，且速率更低。账户卡片挂在能力详情页，
整个授权过程不必离开 Astravia：

1. 点「打开 firecrawl.dev」，浏览器打开官方 API Key 页面；登录并创建 Key。
2. 粘贴到卡片里，点「校验并保存」。
3. 插件先用这个候选 Key 调 `GET /v2/team/credit-usage`。只有上游认可的 Key 才会写进宿主密钥库；
   被拒绝的 Key 如实报错，原有凭据保持不变。
4. 卡片随后显示套餐额度、剩余额度与重置日期。「断开连接」会删除密钥并回到免密钥模式。

控制台的连接条通过「授权」按钮到达同一页面，并额外接受自建实例端点。

## 插件提供什么

| 扩展点 | 说明 |
| --- | --- |
| 活动面板 `crawl.console` | 连接条（端点 / API Key）+ 蜘蛛面板（页面结构 / 链接拓扑）+ Artifacts / Pages / Links / Media / Issues / Console / Chat / History 八个标签页，另有每页输出类型勾选。未开始时保持静止；运行时逐页显示收录、拒绝原因，以及找到的每个媒体地址。抓到的页面同时按类型上架（Markdown、链接、图片、视频、音频、JSON、解析出的文档），最近几次运行留在磁盘上，产物可再次打开 |
| `firecrawl_crawl` 的工具调用插槽 | Agent 发起的爬取在对话里显示成一张卡片：运行时是实时页数，结束后是工具原文，一键打开同一对话对应的控制台 |
| 输入框下方 `ui.slot.input-action`「Firecrawl」 | 打开时以最大宽度挂载面板，并把爬取指令注入下一条提示；关闭时卸载 |
| `firecrawl_scrape` | 单页 → 你要的格式：`markdown`、`html`、`rawHtml`、`links`、`screenshot`（可整页）、`images`、`summary`、`json`、`audio`、`video`、`media`、`branding`、`product`、`menu`、`attributes`、`changeTracking`、`rawBase64`，以及 `question` / `highlights` |
| `firecrawl_batch_scrape` | 已知 URL 列表，真正的上游任务：`wait: false` 返回 id，交给 `firecrawl_job_status` 轮询 |
| `firecrawl_crawl` | 有界爬取：`limit`、`maxDepth`、作用域、include/exclude、sitemap 三态、`prompt`、`webhookUrl`、`maxAge` 与 `scrapeOptions` |
| `firecrawl_map` | 由 sitemap 与页面链接汇总 URL 清单，最多 5000 条 |
| `firecrawl_search` | 网页搜索，支持来源、分类、域名过滤与时间范围 |
| `firecrawl_extract` | 跨一个或多个 URL 的 schema 抽取 |
| `firecrawl_account` | 读取额度、队列深度与仍在运行的爬取任务。花钱之前先看额度，或用来找回超出标签页生命周期的任务 id |
| `firecrawl_parse` | **本地**文档 → Markdown：PDF、DOCX、XLSX、PPTX 等，上传到 `/v2/parse`（≤20 MB）。URL 走 `firecrawl_scrape`。 |
| `firecrawl_video` | 用 `scrape` 的 `video` / `audio` 格式取页面媒体地址（含 HLS/DASH 清单），返回带签名的 URL；本地不做转码 |
| `firecrawl_job_status` | 查看、等待或取消 crawl/batch 任务 |
| `firecrawl_interact` | 在 Firecrawl 沙箱里开一个有状态的浏览器会话：`create` 拿 id，`execute` 用 Node / Python / Bash 驱动页面，`stop` 关闭。代码不在本地运行，也不会回显到控制台 |
| `firecrawl_agent` | 受 `maxCredits` 约束的跨页检索：`prompt` 加可选 `schema`，轮询 `GET /v2/agent/{id}` 直到完成或触到额度（此时标记为部分结果）。`trace: true` 会附上已有运行的步骤日志 |
| `firecrawl_index_search` | 一个工具、三类语料：`developer`（文档 / issue / PR / readme）、`gov`、`research`（论文搜索、读单篇、沿引用扩展） |
| `firecrawl_monitor` | 创建、列出、修改、立即运行、查看与删除定时监控（`scrape` / `crawl` / `search` 目标，cron 或间隔调度） |
| Skill `firecrawl`（`agent/skills/firecrawl/`） | 让 Agent 知道何时用哪个工具，如何如实报告上限与上游错误 |

面板与工具共用同一份 run store，所以 Agent 发起的爬取会在面板里动起来，而不是悄无声息地跑完。
控制台目标会跟随对话：在聊天里粘贴一个网址，面板在任何工具调用发生前就先采用它。
两个方向都是通的：Agent 发起的爬取会点亮面板，产物上的「问 AI」则把摘要送回同一段对话。

## 无 Key 可用，Key 带来什么

托管 API 接受不带 Key 的请求，只是速率限制更低，所以装好即可用。在连接条里填入 Key 会提高吞吐，
并消耗你的额度。

- **端点**：留空即 `https://api.firecrawl.dev`；自建实例写 `http://localhost:3002`。
- **API Key**：写入宿主凭据保险库，不落设置文件、不进日志、不作为工具参数。留空提交保留原 Key；
  清空保险库条目即删除。
- **速率与额度按原样报告**：`429` 译为「触发速率限制」，`402` 译为「额度不足」，`401`/`403`
  译为「API 拒绝了这个 Key」。

## 页面是怎么抓的

`scrape` 把 `formats`、`onlyMainContent`、`waitFor`、`timeout`、动作序列、`proxy`、`parsers`、
`location` 与 `maxAge` 原样发给上游。抓取、JavaScript 渲染与 Markdown 转换都由 Firecrawl 完成，
这里拿到的是最终文档。

- **PDF / DOCX / XLSX / PPTX** 以 multipart 走 `/v2/parse`（单文件上限 20 MB）；已经发布在网址上的
  文件直接走 `scrape`。
- **`rawBase64`** 必须作为唯一格式请求；插件会收拢格式列表，而不是让上游报错。
- **`audio` / `video`** 返回约一小时后失效的签名 URL。`firecrawl_video` 只报告地址，不串流、不拼接分片、
  不解密。
- **`attributes`** 接受 `["a@href", "h2", ".price@data-price"]` 这类选择器，每个选择器返回一组去重值。
- **自定义请求头**会转交上游，这也是需要请求头的页面能正常读取的原因。

## 限制

这些是真实边界，Agent 被要求如实报告而不是猜测。

- **没有本地兜底。** API 不可达时工具以传输原因失败（`timed-out`、`host-not-allowed`、
  `response-too-large`），不会改为自己抓取。
- **不做 DRM 绕过。** 受保护的流会被如实标为受保护；插件没有解密分片的代码，API 也不会返回解密后的媒体。
- **不突破登录墙、付费墙与验证码。** 爬取会报告内容稀薄或被拦截的结果；`proxy` 是上游的住宅出口路由，
  不是本插件自建的绕过手段。
- **没有本地调度器。** `firecrawl_monitor` 与异步任务都在上游，插件只负责调用。
- **没有本地缓存。** `maxAge` 与 `changeTracking` 是上游能力——插件只发送参数，不保存页面副本。
- **`robots.txt`** 默认生效。`ignoreRobotsTxt` 只用于用户自己的站点。

## 行为边界

- **深度（`maxDepth`）= 从起始 URL 出发的链接跳数**，不是 URL 路径层级。`0` 只读起始页。控制台里同一
  字段显示为 `maxDiscoveryDepth`，那是 API 的叫法。
- **`limit` 限制抓取页数**。达到上限时控制台会说明，而不是暗示站点只有这些页面。
- **控制台提交的 `POST /v2/crawl` 请求体与 Agent 工具完全相同**，手动发起与 Agent 发起的爬取行为一致。
- **页面由上游分页返回。** store 每次 tick 最多续读 20 页，大爬取会先显示首屏再持续补全。
- **被拒绝与失败的页面来自 `/v2/crawl/{id}/errors`**，按上游消息分类：robots 拒绝记为 `deny`，其余记为
  `fail`。

## 开发

```bash
npm install
npm run check        # tsc --noEmit
npm test             # vitest，happy-dom
npm run build        # 本地预检；dist/ 与 release/ 不提交
```

`npm install` 需要能解析 `@astravia-org/*` 开发依赖，市场构建会临时把它们指向本地宿主检出。

目录结构遵循 [docs/plugin-project-structure.md](../../../docs/plugin-project-structure.md)：

```text
src/domain/firecrawl/   类型、传输契约、REST 客户端、爬取选项、文档整形
src/features/           控制台 UI：store、hooks、组件
src/runtime/            插件上下文、宿主传输、连接配置（设置 + 凭据库）、对话监听
src/tools/              Agent 工具注册与「参数 → 请求体」翻译
src/index.tsx           装配：标签页、工具、输入动作、卸载
agent/skills/           Agent Skill
locales/                文案（en、zh）
```

上游归属与许可见 [NOTICE.md](NOTICE.md)。

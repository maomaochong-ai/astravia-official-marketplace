# Firecrawl（Astravia 插件）

在 Astravia 里把网页变成 Markdown，并把爬取过程画成一只在页面结构里行走的蜘蛛。同一批工具由两个引擎回答：

- **本地引擎**：抓取、JavaScript 渲染、PDF/DOCX/XLSX 文本、正文提取、`robots.txt` 判定与广度优先爬取都在
  插件内完成，网络与浏览器出口走宿主权限。不需要 Key，也不需要服务端。
- **Firecrawl API 引擎**：同样的工具调用发给 [Firecrawl v2 API](https://docs.firecrawl.dev)（api.firecrawl.dev
  或自建实例），OCR、反爬代理、托管任务队列与定时监控直接用上游能力，不再自行重写。

`engine: "auto"`（默认）在配置了端点或 Key 时走 API，否则走本地。每个工具还接受单次调用的 `engine` 参数，
可临时覆盖全局设置。两个引擎下工具名、参数与回答形状完全一致。

## 插件提供什么

| 扩展点 | 说明 |
| --- | --- |
| 活动面板 `crawl.console` | 引擎条（模式 / 端点 / API Key）+ 蜘蛛面板（页面结构 / 链接拓扑两种视图）+ Console / Pages / Elements 三个标签页。未开始时保持静止；运行时逐页显示收录、拒绝及原因，以及找到的每个媒体地址 |
| 输入框下方 `ui.slot.input-action`「Firecrawl」 | 打开时以最大宽度挂载面板，并把爬取指令注入下一条提示；关闭时卸载 |
| `firecrawl_scrape` | 单页 → Markdown，可选 `html` / `rawHtml` / `links` / `screenshot` / `media` / `images` / `json` / `summary` / `extract` / `answer` / `highlights` / `attributes` / `rawBase64` / `changeTracking` |
| `firecrawl_batch_scrape` | 已知 URL 列表。API 引擎下是真正的任务：`wait: false` 返回 id，交给 `firecrawl_job_status` 轮询 |
| `firecrawl_crawl` | 同站有界爬取：深度、页数、作用域、include/exclude、sitemap 三态、`prompt`、`webhookUrl`、`maxAge` 与 `scrapeOptions` |
| `firecrawl_map` | 由 sitemap 与页面链接汇总 URL 清单，最多 5000 条 |
| `firecrawl_search` | 网页搜索，支持分类、来源、域名过滤与时间范围 |
| `firecrawl_extract` | 跨一个或多个 URL 的 schema 抽取 |
| `firecrawl_parse` | 文档 → Markdown：PDF、DOCX、XLSX 及其宏变体，来自 URL 或本地路径 |
| `firecrawl_video` | 下载未加密的视频/音频流：HLS 播放列表、DASH 清单或直链，缺清单时从页面里发现 |
| `firecrawl_job_status` | 查看、等待或取消上游 crawl/batch 任务 |
| `firecrawl_monitor` | 创建、列出、修改、立即运行、查看与删除定时监控（`scrape` / `crawl` / `search` 目标，cron 或间隔调度）。仅 API 引擎 |
| Skill `firecrawl`（`agent/skills/firecrawl/`） | 让 Agent 知道何时用哪个工具，如何如实报告上限与 `robots.txt` 拒绝 |

面板与工具共用同一份 run store，所以 Agent 发起的爬取会在面板里动起来，而不是悄无声息地跑完。
控制台目标会跟随对话：在聊天里粘贴一个网址，面板在任何工具调用发生前就先采用它。

## 配置 API 引擎

打开爬虫控制台，用顶部的引擎条：

- **模式**：`auto`（配置即走 API）、`API`、`local`。
- **端点**：留空即 `https://api.firecrawl.dev`；自建实例写 `http://localhost:3002`，无需 Key。
- **API Key**：写入宿主凭据保险库，不落设置文件、不进日志、不作为工具参数。留空提交保留原 Key；清空保险库条目即删除。

没有端点也没有 Key 时插件完全本地运行——这也是 API 被视为增强而非前提的原因。

## 页面是怎么抓的

`render: "auto"`（默认）先读静态 HTML，只有在文档看起来由前端渲染、正文短于 320 字符，或请求截图时才升级
到浏览器会话。`render: "static"` 永不开浏览器；`render: "browser"` 始终走浏览器并优先取渲染后文本。

- **PDF** 按文档解析（文本层 + 页数），不会被当成二进制拒绝。
- **DOCX / XLSX** 走手写的 OOXML 读取器：标题、列表项、加粗片段与表格都转成 Markdown，每个工作表一段。
- **`text/markdown`** 原样透传。
- **其他二进制**明确拒绝并给出原因，而不是返回空页面。
- **媒体地址**从 `img`、`video`、`audio`、`source` 及 `og:video*` / `og:audio` meta 采集，按页面 URL 解析为绝对地址并去重。
- **自定义请求头**由 HTTP 抓取发送。宿主浏览器 API 不能设置请求头，所以浏览器渲染走的是这份快照：通过
  `data:` URL 加载并注入指向原地址的 `<base>`——Cookie 与需要凭据的子资源不会随之重放。

## 与上游 Firecrawl 的能力对照

插件内已实现：Markdown / HTML / raw HTML / 链接 / 截图 / 媒体 / 图片 / raw base64 / `attributes` 的 scrape，
按 schema 的 JSON 抽取，带深度、页数、作用域、include/exclude、sitemap 三态（`include` / `only` / `skip`）与 robots
的 crawl，整轮爬取后统一回答的 `prompt`，把摘要 POST 出去的 `webhookUrl`，sitemap 发现，带搜索的 `map`，
带分类的网页搜索，经宿主浏览器的 JS 渲染（可用持久登录 profile），PDF/DOCX/XLSX 文本，scrape/batch/crawl 上的
`maxAge` 缓存复用与 `changeTracking`，自定义请求头，提示注入告警，HLS/DASH 分片下载，以及完整的 Firecrawl API 第二引擎。

交给 API 引擎而不是自行重写的：OCR、反爬/隐身代理、托管任务队列（`firecrawl_job_status`）、定时监控。

以简化形式实现：

- **浏览器渲染**能拿到文本、截图与无障碍快照。插件 API 没有 `evaluate` / `outerHTML`，因此拿不到*渲染后*的
  HTML 树：浏览器渲染页面的元素结构由文本推导，不是 DOM。
- **DASH** 支持带 `$Number$` 的 `SegmentTemplate`（含 `$RepresentationID$` / `$Bandwidth$` 与 `SegmentTimeline`）。
  其他寻址方式的清单会明确报「不支持」，不会默默拼出一个坏文件。
- **搜索**默认使用 DuckDuckGo 的 HTML 端点（无需 Key），而不是付费搜索提供方。

## 限制

这些是插件的真实边界，Agent 被要求如实报告而不是猜测。

- **不做 DRM 绕过、不做解密、不拼接加密媒体分片。** 使用 Widevine / PlayReady / FairPlay，或 HLS
  `#EXT-X-KEY` 里 `METHOD=AES-128` / `SAMPLE-AES`，或 MPD 含 `ContentProtection` 的页面，只读取其公开的文本
  部分。`firecrawl_video` 会报告保护类型并停止，不会尝试破解——这是法律边界，不是待办事项。**未加密的
  HLS/DASH 分片会真实下载并拼接。**
- **`blob:` Media Source 流**只存在于播放页面里，被标记为受保护流，没有可下载的文件。
- **加密或混淆内容会直接从 Markdown 里缺失。** 需要登录、付费墙 Cookie 或验证码才能渲染的页面，只会得到
  内容稀薄或被拦截的结果，插件不会尝试突破这些限制。
- **没有本地调度器与本地任务队列。** 插件 API 不允许插件注册后台任务，所以 `firecrawl_monitor` 与异步任务
  队列属于 API 引擎；本地 `batch_scrape` 仍在一次调用里读完 URL，没有可轮询的 id。
- **`maxAge` 缓存需要 `storage.read` / `storage.write`。** 未授权时每次都真实抓取，`changeTracking` 每次都报「新」。
- 扫描版 PDF 本地没有 OCR：整页图片不会产出文本——这正是 API 引擎补上的部分。
- `robots.txt` 始终生效。`ignoreRobotsTxt` 只用于用户自己的站点，插件不会自造绕过方式。

## 行为边界

- **深度 = 从起始 URL 出发的链接跳数**，不是 URL 路径层级。`maxDepth: 0` 只读起始页。
- **`limit` 限制抓取页数**，达到即停；被拒绝的链接会报告，不会静默丢弃。
- **作用域**由起始 URL 推出：目录 URL 覆盖其子树；文档 URL 放宽到所在目录；其余覆盖自身及其子级。
- **准入顺序固定**：外部站点 → 反向爬取 → 深度 → 排除 → 包含 → 社交平台 → 文件类型 → `robots.txt` → 重复，
  第一条命中的规则就是报告的原因。
- **默认遵守 `robots.txt`**。拒绝不会被绕过。
- 站内声明 sitemap 时先做播种。`sitemap: "only"` 把 sitemap 当作全部待爬队列且不再展开链接；`"skip"` 则完全忽略 sitemap。
- **提示注入扫描**匹配已知的指令覆盖话术并作为 warning 报告，从不改写页面内容。
- **请求头会先脱敏**，再进入控制台快照或 webhook 载荷。

## 开发

```bash
npm install
npm run check        # tsc --noEmit
npm test             # vitest，happy-dom
npm run build        # 本地预检；dist/ 与 release/ 不提交
```

`npm install` 需要能解析 `@astravia-org/*` 开发依赖，市场构建会临时把它们指向本地宿主检出。

目录结构遵循 [docs/plugin-project-structure.md](../../../docs/plugin-project-structure.md)：
`src/domain/backend` 上游 REST 客户端与类型、`src/domain` 纯逻辑与单测（PDF / OOXML / 媒体流 / 元素采集）、
`src/features` 控制台 UI、`src/runtime` 上下文/网络/上游门控/对话监听、`src/tools` 工具注册（本地与上游实现）、
`src/index.tsx` 装配、`agent/skills` Skill、`locales` 文案。

上游归属与第三方许可见 [NOTICE.md](NOTICE.md)。

# Firecrawl（Astravia 插件）

在 Astravia 里把网页变成 Markdown，并把爬取过程画成一只在页面结构里行走的蜘蛛。不需要 API Key，
也不依赖 Firecrawl 服务端：抓取、JavaScript 渲染、PDF 文本抽取、正文提取、`robots.txt` 判定与
广度优先爬取都在插件内完成，网络与浏览器出口走宿主权限。

## 插件提供什么

| 扩展点 | 说明 |
| --- | --- |
| 活动面板 `crawl.console` | 蜘蛛面板（页面结构 / 链接拓扑两种视图）+ Console / Pages / Elements 三个标签页。未开始时保持静止；运行时逐页显示收录、拒绝及原因，以及找到的每个媒体地址 |
| 输入框下方 `ui.slot.input-action`「Firecrawl」 | 打开时以最大宽度挂载面板，并把爬取指令注入下一条提示；关闭时卸载 |
| Agent 工具 `firecrawl_scrape` / `firecrawl_crawl` / `firecrawl_map` / `firecrawl_search` / `firecrawl_extract` | 单页、同站有界爬取、URL 清单、网页搜索、按 schema 抽取 |
| 输出格式 `media` | 页面标记里所有图片 / 视频 / 音频地址，HLS/DASH 播放列表会被标注 |
| Skill `firecrawl`（`agent/skills/firecrawl/`） | 让 Agent 知道何时用哪个工具，如何如实报告上限与 `robots.txt` 拒绝 |

面板与工具共用同一份 run store，所以 Agent 发起的爬取会在面板里动起来，而不是悄无声息地跑完。
控制台目标会跟随对话：在聊天里粘贴一个网址，面板在任何工具调用发生前就先采用它。

## 页面是怎么抓的

`render: "auto"`（默认）先读静态 HTML，只有在文档看起来由前端渲染、正文短于 320 字符，或请求截图时
才升级到浏览器会话。`render: "static"` 永不开浏览器；`render: "browser"` 始终走浏览器并优先取渲染后文本。

- **PDF** 按文档解析（文本层 + 页数），不会被当成二进制拒绝。
- **`text/markdown`** 原样透传。
- **其他二进制**明确拒绝并给出原因，而不是返回空页面。
- **媒体地址**从 `img`、`video`、`audio`、`source` 及 `og:video*` / `og:audio` meta 采集，按页面 URL
  解析为绝对地址并去重。

## 与上游 Firecrawl 的能力对照

插件内已实现：Markdown / HTML / raw HTML / 链接 / 截图 / 媒体 的 scrape，按 schema 的 JSON 抽取，
带深度、页数、作用域、include/exclude、sitemap 播种与 robots 的 crawl，sitemap 发现，带搜索的 `map`，
网页搜索，经宿主浏览器的 JS 渲染，PDF 文本，提示注入告警。

以简化形式实现：

- **浏览器渲染**能拿到文本、截图与无障碍快照。插件 API 没有 `evaluate` / `outerHTML`，因此拿不到
  *渲染后* 的 HTML 树：浏览器渲染页面的元素结构由文本推导，不是 DOM。
- **搜索**默认使用 DuckDuckGo 的 HTML 端点（无需 Key），而不是付费搜索提供方。

未实现的部分（设计或平台边界）见下节。

## 限制

这些是插件的真实边界，Agent 被要求如实报告而不是猜测。

- **不做 DRM 绕过、不做解密、不拼接加密媒体分片。** 使用 Widevine / PlayReady / FairPlay 或加密
  HLS/DASH 的页面，只读取其公开的文本部分。插件不破解内容保护，也不会把加密切片拼起来——这是法律
  边界，不是待办事项。
- **媒体只枚举，不下载。** 播放器只会给出文件地址或播放列表及其分片地址。`blob:` Media Source 流被
  标记为受保护流：它只存在于播放页面里，不是一个可下载文件。视频/音频字节始终不会被抓取。
- **加密或混淆内容会直接从 Markdown 里缺失。** 需要登录、付费墙 Cookie 或验证码才能渲染的页面，
  只会得到内容稀薄或被拦截的结果，插件不会尝试突破这些限制。
- 不支持代理/反检测配置，不支持 `maxAge` 缓存复用、webhook 投递、批量接口、变更追踪、
  branding/product/menu 抽取，也不做移动端视口模拟。
- 扫描版 PDF 没有 OCR：整页图片不会产出文本。
- `robots.txt` 始终生效。`ignoreRobotsTxt` 只用于用户自己的站点，插件不会自造绕过方式。

## 行为边界

- **深度 = 从起始 URL 出发的链接跳数**，不是 URL 路径层级。`maxDepth: 0` 只读起始页。
- **`limit` 限制抓取页数**，达到即停；被拒绝的链接会报告，不会静默丢弃。
- **作用域**由起始 URL 推出：目录 URL 覆盖其子树；文档 URL 放宽到所在目录；其余覆盖自身及其子级。
- **准入顺序固定**：外部站点 → 反向爬取 → 深度 → 排除 → 包含 → 社交平台 → 文件类型 → `robots.txt` → 重复，
  第一条命中的规则就是报告的原因。
- **默认遵守 `robots.txt`**。拒绝不会被绕过。
- 站内声明 sitemap 且 `maxDepth >= 1` 时，先做 sitemap 播种再走第一跳。
- **提示注入扫描**匹配已知的指令覆盖话术并作为 warning 报告，从不改写页面内容。

## 开发

```bash
npm install
npm run check        # tsc --noEmit
npm test             # vitest，happy-dom
npm run build        # 本地预检；dist/ 与 release/ 不提交
```

`npm install` 需要能解析 `@astravia-org/*` 开发依赖，市场构建会临时把它们指向本地宿主检出。

目录结构遵循 [docs/plugin-project-structure.md](../../../docs/plugin-project-structure.md)：
`src/domain` 纯逻辑与单测（含 PDF、元素采集）、`src/features` 控制台 UI、`src/runtime` 上下文/网络/对话监听、
`src/tools` 工具注册、`src/index.tsx` 装配、`agent/skills` Skill、`locales` 文案。

上游归属与第三方许可见 [NOTICE.md](NOTICE.md)。

# Firecrawl（Astravia 插件）

在 Astravia 里把网页变成 Markdown，并把爬取过程画成一张能看懂的蜘蛛网。不需要 API Key，
也不依赖 Firecrawl 服务端：抓取、正文提取、`robots.txt` 判定与广度优先爬取都在插件内完成，
网络出口走宿主的网络权限。

## 插件提供什么

| 扩展点 | 说明 |
| --- | --- |
| 活动面板 `crawl.console` | 有动画的蜘蛛面板 + 控制台流。未开始时保持静止；运行时逐页显示收录、拒绝及原因 |
| 输入框下方 `ui.slot.input-action`「Firecrawl」 | 打开时以最大宽度挂载面板，并把爬取指令注入下一条提示；关闭时卸载 |
| Agent 工具 `firecrawl_scrape` / `firecrawl_crawl` / `firecrawl_map` | 单页转 Markdown、同站有界爬取、URL 清单 |
| Skill `firecrawl`（`agent/skills/firecrawl/`） | 让 Agent 知道何时用哪个工具，如何如实报告上限与 `robots.txt` 拒绝 |

面板与工具共用同一份 run store，所以 Agent 发起的爬取会在面板里动起来，而不是悄无声息地跑完。

## 行为边界

- **深度 = 从起始 URL 出发的链接跳数**，不是 URL 路径层级。`maxDepth: 0` 只读起始页。
- **`limit` 限制抓取页数**，达到即停；被拒绝的链接会报告，不会静默丢弃。
- **作用域**由起始 URL 推出：目录 URL 覆盖其子树；文档 URL 放宽到所在目录；其余覆盖自身及其子级。
- **准入顺序固定**：外部站点 → 反向爬取 → 深度 → 排除 → 包含 → 社交平台 → 文件类型 → `robots.txt` → 重复，
  第一条命中的规则就是报告的原因。
- **默认遵守 `robots.txt`**。`ignoreRobotsTxt` 只用于用户自己的站点，拒绝不会被绕过。
- 站内声明 sitemap 且 `maxDepth >= 1` 时，先做 sitemap 播种再走第一跳。
- **只处理静态 HTML**：需要 JavaScript 或登录的页面会很薄；`text/markdown` 直接透传；
  二进制文件明确拒绝并给出原因，而不是返回空页面。
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
`src/domain` 纯逻辑与单测、`src/features` 控制台 UI、`src/runtime` 上下文与网络、`src/tools` 工具注册、
`src/index.tsx` 装配、`agent/skills` Skill、`locales` 文案。

上游归属与第三方许可见 [NOTICE.md](NOTICE.md)。

# 调研资料索引（docs/search）

这里放**事实**：官方文档怎么说、端点与参数是什么、官方推荐的接入命令是什么。
不放结论——结论在 [`../adr`](../adr)，落地步骤在 [`../plans`](../plans)。

| 文件 | 内容 | 来源 |
| --- | --- | --- |
| [`claude-code.md`](./claude-code.md) | `quickstarts/claude-code` 全文整理：Claude connector、Claude Code 的 MCP OAuth 接入、四类能力、其它连接模式、literature research、排错 | <https://docs.firecrawl.dev/quickstarts/claude-code> |
| [`official-surfaces.md`](./official-surfaces.md) | 抓取流程（谁在真正执行抓取）、REST v2 端点表、托管 MCP 三种认证、CLI 命令与发行形态、SDK 定位 | `/introduction`、`/mcp-server`、`/mcp-server/keyless`、`/cli`、`/rate-limits` |

相关的落地文档：

- 决策（选哪种方式、为什么不全部封装）：[`../adr/0001-firecrawl-integration-mode.md`](../adr/0001-firecrawl-integration-mode.md)
- 改造方案（分阶段步骤与验收）：[`../plans/0001-firecrawl-connector.md`](../plans/0001-firecrawl-connector.md)

## 关键事实速查

| 事实 | 值 |
| --- | --- |
| Cloud API | `https://api.firecrawl.dev`（自建默认 `http://localhost:3002`） |
| 托管 MCP（OAuth） | `https://mcp.firecrawl.dev/v2/mcp-oauth` |
| 托管 MCP（Key / Keyless） | `https://mcp.firecrawl.dev/v2/mcp` |
| 创建 API Key | <https://www.firecrawl.dev/app/api-keys> |
| 撤销 MCP 授权 | <https://www.firecrawl.dev/app/settings?tab=mcp> |
| CLI 引导 | `npx -y firecrawl-cli@latest init --all --browser` |
| CLI 二进制体积 | 每平台 30–43 MB（Bun 自包含） |
| 本地 MCP 要求 | Node.js ≥ 22 |
| Keyless 能力 | 仅 Search / Scrape / Parse，按 IP 限流 |
| 错误语义 | `401` 密钥无效、`402` 额度不足、`429` 速率/并发超限 |
| 并发上限 | Free 2 / Hobby 5 / Standard 25 / Growth 50 / Scale 100+ |

## 维护约定

- 官方页面有 `.md` 版本（例如 `https://docs.firecrawl.dev/cli.md`），抓取时优先用它，比解析 HTML 干净。
- 记录**抓取日期**；参数表变化时先改这里，再回看 ADR 是否仍然成立。
- 命令与 URL 一律保留原文，不做翻译或改写；解释用中文写在命令之外。

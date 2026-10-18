# Firecrawl in Claude & Claude Code（官方快速接入页整理）

> 原文：<https://docs.firecrawl.dev/quickstarts/claude-code>
> 页面标题：**Firecrawl in Claude & Claude Code** — "Search the web and read pages from Claude or
> your Claude Code session."
> 抓取日期：2026-10-18。原文的 HTML 组件（CardGroup / Note / iframe 按钮）在这里改成等价文字，
> 命令、URL、参数保持原样。

页面开头给了一个前提：**两条路径都是可选的，只需要连接你要用的那一个。**

```text
Choose the setup for the app you use. Both paths are optional; you only need to connect the one you want to use.
```

## 1. Optional: Add to Claude

官方给出的入口是一个一键安装按钮，指向 Claude 的 connector 目录：

```text
https://claude.ai/directory/connectors/firecrawl
```

按钮文案：**Add to Claude ↗**。

步骤（原文）：

1. Open the Firecrawl connector using the button above.
2. Connect your Firecrawl account and approve access when prompted.
3. Start a new Claude conversation, enable Firecrawl, and ask it to search or read a page.

示例提示词：

```text
Use Firecrawl to search for the latest Next.js release notes and summarize the sources.
```

这一步是 **Claude.ai 网页端/桌面端**的托管 connector，认证由 Claude 与 Firecrawl 之间的 OAuth
完成，不涉及本仓库的插件。它说明了一件重要的事：Firecrawl 的官方首选接入方式是
**浏览器登录授权**，不是让用户手工粘贴密钥。

## 2. Optional: Set up Claude Code

原文：

```text
Connect Claude Code through the hosted MCP server. Run the command below, then sign in through your browser.
```

### 2.1 Add Firecrawl

```bash
claude mcp add --transport http firecrawl https://mcp.firecrawl.dev/v2/mcp-oauth
```

原文专门加了一句提醒，因为很多人会把这个 URL 当网页打开：

```text
`https://mcp.firecrawl.dev/v2/mcp-oauth` is a client configuration value, not a page to open directly in a browser.
```

也就是说：这是 **MCP 客户端的配置值**（Streamable HTTP 传输 + OAuth 授权码流程），
浏览器登录是由客户端在读到 `401` 后自己发起的。

### 2.2 Sign in and verify

```text
Enter `/mcp` in Claude Code, choose `firecrawl`, and complete the browser sign-in. Start a new Claude Code session if you changed an existing Firecrawl connection.
```

```text
Confirm that only one `firecrawl` server is active, then try:
```

```text
Search for the latest Next.js release notes and summarize the sources.
```

```text
Scrape https://firecrawl.dev and explain what it does.
```

要点：`/mcp` 是 Claude Code 的 MCP 管理面板；OAuth 完成前工具列表是空的；如果之前配过同名
server，会出现两个 `firecrawl` 条目，必须删掉旧的再重连。

## 3. What you can do

原文用四张卡片列能力，链接到各自的特性页：

| 能力 | 说明（原文） | 文档 |
| --- | --- | --- |
| **Search** | Find current information and read the content of relevant results. | <https://docs.firecrawl.dev/features/search> |
| **Scrape** | Turn URLs into clean markdown or structured data. | <https://docs.firecrawl.dev/features/scrape> |
| **Interact** | Navigate, click, and fill forms to reach the data you need. | <https://docs.firecrawl.dev/features/interact> |
| **Alexandria** | Discover structured data tools, inspect inputs and pricing, then run them through Firecrawl. | <https://docs.firecrawl.dev/features/alexandria> |

`Alexandria` 是 Firecrawl 的结构化数据工具目录（可查输入与价格，再通过 Firecrawl 执行），
在本仓库的插件里没有对应封装；`Interact` 对应 `POST /v2/scrape/{id}/interact`。

## 4. Other connection modes

原文列了三条，并给了各自的前提：

- **Keyless MCP** — "Try keyless MCP for Search, Scrape, and Parse without an account or key."
  → <https://docs.firecrawl.dev/mcp-server/keyless#try-keyless>
- **API key** — "Configure an API key for unattended use. **Keep the secret outside agent chat and
  use an environment-variable reference.**"
  → <https://docs.firecrawl.dev/mcp-server/keyless#add-an-api-key>
- **Local MCP** — "Run MCP locally only when you need a local process or a self-hosted Firecrawl
  API. **The local package requires Node.js 22 or newer.**"
  → <https://docs.firecrawl.dev/mcp-server/local>

这三条对应三种不同的部署现实：

| 模式 | 端点 | 认证 | 前提 |
| --- | --- | --- | --- |
| Keyless | `https://mcp.firecrawl.dev/v2/mcp` | 无 | 仅 Search / Scrape / Parse，按 IP 限流 |
| API key | `https://mcp.firecrawl.dev/v2/mcp` | `Authorization: Bearer fc-…` | 需要自建 Key，适合无人值守 |
| OAuth | `https://mcp.firecrawl.dev/v2/mcp-oauth` | 浏览器登录 + 授权团队 | 交互式客户端 |
| Local | stdio 或本地 Streamable HTTP | 自己配 Key / 连自建实例 | Node.js ≥ 22 |

## 5. Optional: literature research

```bash
npx skills add firecrawl/skills@firecrawl-research-index
```

原文："For paper and literature work, the research-index skill routes those queries to the
`firecrawl_research_*` tools and the Research Index instead of general web search."

这条命令值得注意：**官方把"给编码 Agent 安装 skill"当成一等公民**（`npx skills add …`），
本仓库的插件走的也是同一条路——`agent/skills/firecrawl/SKILL.md` 随包分发，由宿主注册。

## 6. Troubleshooting

| 症状 | 原文处置 |
| --- | --- |
| **A Firecrawl server already exists** | `claude mcp remove firecrawl`，只添加一次目标连接，然后开新会话。 |
| **The browser does not open** | 输入 `/mcp`，选中 `firecrawl`，从客户端里主动发起认证。 |
| **The server shows `401`** | 通过 `/mcp` 重新登录；**不要**把 API key 粘贴进对话或 OAuth URL。 |

`401` 这一条是官方对"密钥别进聊天记录"的明确表态。插件里的对应做法是：Key 只写进宿主凭据库
（`ctx.secrets`），不出现在工具参数、日志或界面回显里。

## 7. 这一页没有说、但实现必须知道的事

从同站其它页面补齐（详见 [`official-surfaces.md`](./official-surfaces.md)）：

- **创建 Key 的页面**：<https://www.firecrawl.dev/app/api-keys>（来自 `/mcp-server/keyless`）。
- **撤销 MCP 授权**：<https://www.firecrawl.dev/app/settings?tab=mcp>（来自 `/mcp-server`）。
- **Keyless 的准确边界**："Keyless MCP is rate limited and exposes Search, Scrape, and Parse.
  Add an API key to unlock the full tool surface or higher limits." —— 与本插件 README 的表述一致。
- **额度与并发按套餐**：`429` 表示超出速率或并发；并发数 Free=2、Hobby=5、Standard=25、
  Growth=50、Scale/Enterprise=100+（来自 `/rate-limits`）。
- **本地 MCP 的形态**：官方仓库 `firecrawl/firecrawl-mcp-server`，stdio 或 Streamable HTTP，
  仅在你需要本地进程或自建 API 时使用。

## 8. 与本仓库的关系

本仓库的插件不走 MCP：它在插件进程内直接用 REST v2（`ctx.network.request` + 宿主凭据库），
并把官方"浏览器授权"的体验搬到**能力详情页**——用户在能力页点一下就会打开
<https://www.firecrawl.dev/app/api-keys> 完成登录/创建 Key，粘贴回来立刻校验并显示套餐额度。
决策见 [`../adr/0001-firecrawl-integration-mode.md`](../adr/0001-firecrawl-integration-mode.md)。

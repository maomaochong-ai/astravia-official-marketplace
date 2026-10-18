# ADR-0001：Firecrawl 连接器的接入方式

- 状态：**Accepted**（2026-10-18 修订 §6）
- 日期：2026-10-18
- 决策者：Firecrawl 连接器维护者
- 相关：[`../search/claude-code.md`](../search/claude-code.md)、[`../search/official-surfaces.md`](../search/official-surfaces.md)、[`../plans/0001-firecrawl-connector.md`](../plans/0001-firecrawl-connector.md)

## 1. 问题

Firecrawl 官方同时提供 REST API v2、托管 MCP、CLI 和 SDK 四种接入面。
需要回答三件事：

1. 桌面插件用哪一种作为**运行时**？
2. 要不要把多种方式**一起封装**，让用户自己选（"多引擎"）？
3. Keyless 只覆盖 Search / Scrape / Parse 且按 IP 限流，用户如何在不离开桌面应用的前提下
   完成官方授权、解锁完整能力？

同时有一个硬约束：**不再自研抓取引擎**。抓取、渲染、反爬、PDF/OCR、格式转换都由 Firecrawl
云端完成，插件只做参数、编排和呈现。

## 2. 背景事实

### 2.1 四种接入面的真实关系

| 面 | 端点 | 执行位置 | 认证 |
| --- | --- | --- | --- |
| REST v2 | `https://api.firecrawl.dev/v2/*` | Firecrawl 云端 | `Authorization: Bearer fc-…`（可缺省） |
| 托管 MCP | `https://mcp.firecrawl.dev/v2/mcp`（Key/Keyless）、`…/v2/mcp-oauth`（登录） | Firecrawl 云端 | Bearer / OAuth / 无 |
| CLI | 本地一次性进程，打到同一个 REST | 本地进程 + 云端 | `firecrawl login` 或 `FIRECRAWL_API_KEY` |
| SDK | 进程内库，打到同一个 REST | 本地库 + 云端 | Key |

**它们不是四种引擎，是同一后端的四个客户端。** CLI 与 MCP 的每一次调用，最终都落到 REST 的
`/v2/scrape`、`/v2/search`、`/v2/crawl` 上。

### 2.2 宿主提供的机械路径

| 宿主机制 | 权限 | 能做什么 | 不能做什么 |
| --- | --- | --- | --- |
| `ctx.network.request` | `network.fetch` | 任意 HTTP（含 multipart 上传），不受 CORS 限制 | 单请求 32 MiB、超时 ≤300 s |
| `ctx.secrets` | `secrets.read/write` | 存本插件自己的密钥 | 不能跨插件读 |
| `ctx.ui.openExternal` | `shell.openExternal` | 用系统浏览器打开 http/https | 不接受自定义 scheme |
| `ctx.ui.registerAbilityDetailSlot` | `ui.slot.ability-detail` | 在**能力详情页**挂一块自绘 UI | 只在该页打开时存在 |
| `agent.mcpServers` | `agent.mcp.control` | 声明式接入 MCP server（含 OAuth、`type:"service"`） | 工具面归宿主，插件看不到调用 |
| `providers.cli` + `ctx.cliProviders.run` | 需在 `plugin.json` 声明 `commands` + 用户启用 | 受管执行上游 CLI 二进制 | execFile 语义，无 shell；每次调用一个进程 |
| `providers.services` + `agent.mcpServers{type:"service"}` | `agent.mcp.control` | 托管常驻二进制、分配回环端口、健康检查后挂 MCP | 只适用于**自带服务端**的项目 |

### 2.3 参考插件 `cli-proxy-api` 的原理

它把开源项目 CLIProxyAPI 整合成插件的做法可以拆成五步：

1. `plugin.json` 的 `providers.services[]` 声明 `runtime.kind = "managed-binary"`、按平台的
   `artifacts[{url, sha256, archive, destination}]`、`credentials`、配置模板、`process.args`、
   `health: {path: "/v1/models", credentialId: "api-key"}`；
2. 宿主负责下载、校验摘要、解压、生成凭据、拉起进程、轮询健康端点；
3. `agent.mcpServers` 里用 `{type: "service", serviceId, path: "/mcp"}` 把**已经 ready 的服务**
   挂成 MCP 工具面；
4. 插件自己的 UI 只做三件事：安装进度、配置、状态；
5. 插件不代理任何请求——数据面走宿主与本地服务之间的回环连接。

这套模式的**前提**是：上游本身是一个常驻、监听端口、有健康端点的服务。CLIProxyAPI 满足；
Firecrawl 不满足（CLI 一次性执行、MCP 是远端 HTTP、没有本地可托管的进程）。

## 3. 选项

### A. 只封装 REST v2（插件内直接调用）

插件用 `ctx.network.request` 直接调 `/v2/*`，Key 存 `ctx.secrets`，端点可配（自建实例）。

### B. 只接托管 MCP

`plugin.json` 声明 `agent.mcpServers`（OAuth 变体不需要密钥，可直接声明），工具由宿主注入。

### C. 通过 `providers.cli` 封装 CLI

宿主安装 30–43 MB 平台二进制，每次工具调用 `ctx.cliProviders.run("firecrawl", [...], {env})`，
解析 stdout。

### D. `providers.services` 托管常驻服务

只在 Firecrawl 提供"本地常驻 HTTP 服务"时成立。

### E. 全部封装（多模式并存，用户可选）

A + B + C 同时提供，设置页切换"用哪个引擎"。

## 4. 决策

**采用 A，并把官方授权流程内嵌到能力详情页；不做 E；B、C 只作为终端侧的替代路径写进文档。**

具体形态：

1. **REST v2 是唯一运行时。** 所有 10 个 `firecrawl_*` 工具、控制台、运行记录、分页文档、
   额度显示共用同一个客户端。
2. **能力详情页提供官方授权入口。** `ui.slot.ability-detail` 挂一块 UI：
   - 一键打开 <https://www.firecrawl.dev/app/api-keys>（登录 / 注册 / 创建 Key 都在这一页）；
   - 粘贴 Key → 立即用 `GET /v2/team/credit-usage` 校验 → 通过才写入 `ctx.secrets`；
   - 显示套餐与剩余额度，提供"断开连接"（删除凭据）。
   - 控制台的连接栏保存 Key 时复用同一条校验路径：凭据只有一个写入口，第二个入口不会绕过校验。
3. **不合并多种接入方式。** B/C 的用法作为文档保留，用户想在终端里用就直接用官方命令。

## 5. 理由

### 5.1 为什么不是 B（托管 MCP）

| 代价 | 具体表现 |
| --- | --- |
| 工具面重复 | 宿主注入的名字是 `mcp_plugin-firecrawl-firecrawl_scrape`，与插件自己的 `firecrawl_scrape` 并存，两套描述会各自漂移 |
| 产品层失效 | 控制台的蜘蛛图、Pages/Media/Inspector、运行记录、额度统计都挂在插件自己的工具与 store 上；走 MCP 就绕过了它们 |
| 认证割裂 | OAuth 会话存在宿主的 MCP 设置里，插件既看不到也撤销不了；用户报"没权限"时插件无从判断 |
| 参数受限 | MCP 工具面由上游定义，无法复用本插件已经打磨的默认值（25 页 / 深度 2 / 只取主内容） |

### 5.2 为什么不是 C（CLI）

1. **能力零增益**：CLI 是同一批端点的第二个客户端。
2. **成本实在**：每平台 30–43 MB 二进制，或 `npm i -g`；每次调用一个进程。
3. **观测退化**：stdout 是给人看的文本（`--pretty` 带颜色），要重新解析成结构化结果，
   等于把已经有的 JSON 客户端再写一遍。
4. **跨平台面变大**：四个平台的摘要、版本、路径都要维护，且本插件当前零依赖。

### 5.3 为什么不是 D

`providers.services` 需要上游提供常驻服务与健康端点。Firecrawl 的 CLI 没有 `serve` 模式，
MCP 是远端 `https://mcp.firecrawl.dev`——没有本地进程可托管，`health.path` 无从填起。
把远端 MCP 硬塞进 `type:"service"` 会被清单校验拒绝，也是概念错配。

### 5.4 为什么不是 E（全部封装）

| 维度 | 多模式并存的实际后果 |
| --- | --- |
| 用户认知 | 设置里多一个"引擎"开关，但三条路径结果完全相同，用户无法据此做有意义的判断 |
| 一致性 | 三种传输的错误语义不同（HTTP 状态 / MCP 错误对象 / 进程退出码），控制台要写三套归类 |
| 测试面 | 每种模式都要覆盖 10 个工具 × 成功/失败/超时，测试量约三倍 |
| 迭代速度 | 上游任一协议变动都要改三处，且容易只改一处 |
| 收益 | 零。没有一种模式能提供另一种做不到的能力 |

历史教训就写在这次重构里：上一版正是"本地引擎 + 云端引擎"双模式，结果两套抓取逻辑
（约 1.3 万行含测试）互相拖累，本地引擎的产出还不如云端。**能力相同就不要给选择。**

### 5.5 为什么授权必须内嵌

Keyless 的官方边界是"仅 Search / Scrape / Parse，按 IP 限流"。用户撞上 `429` 时，如果他
必须自己去搜"Firecrawl API key 在哪申请"，这条链路就断了。官方在 Claude 侧的做法是
浏览器 OAuth 一跳完成；桌面插件没有 OAuth 客户端资质（Firecrawl 未对第三方开放授权服务器），
所以取等价路径：**跳到官方页面完成登录与建 Key，回到能力页粘贴并即时校验**。
用户感知是"点一下 → 浏览器授权 → 回来就好了"，且凭据只进宿主密钥库。

## 6. 后果

**正面**

- 一条传输、一套错误分类、一套测试；插件零运行时依赖。
- 全部页面级能力可用：scrape / parse / batch / crawl / map / search / extract / video / monitor / credits，
  以及 2026-10-18 修订后补入的 interact / agent / index search（见 6.1）。
- 自建实例只需改 endpoint，不需要另一条代码路径。
- 授权在能力页闭环，凭据不落入插件存储、工具参数或日志。

**负面 / 放弃**

- 没有 OAuth 一键授权：用户仍需在浏览器里复制一次 Key（Firecrawl 未开放第三方 OAuth）。
- `POST /v2/scrape/{id}/interact`（在 scrape 任务上接着交互）仍未封装 —— 取而代之的是独立的
  `/v2/interact` 会话（见 6.1），两者上游能力重叠，保留一条路径即可。
- 断网即不可用：没有本地缓存或离线队列。
- 站点级 robots 由上游执行，插件不能覆盖。

**重新评估的触发条件**

- Firecrawl 开放第三方 OAuth 客户端注册 → 把能力页的"粘贴 Key"换成标准授权码 + PKCE。
- Firecrawl 提供带健康端点的本地服务 → 重新评估 D（`providers.services` + `type:"service"`）。
- 官方 MCP 工具面出现 REST 没有的能力 → 重新评估 B，并以"单一工具面"为前提设计去重。

### 6.1 修订（2026-10-18）：补入 interact、agent 与索引检索

原判断是"`interact` 与 `agent` 不封装"，理由是它们更像浏览器自动化，与"把网页读成文本"的
定位不同。核对 `v2-openapi.json` 与官方 MCP 工具面后，这个理由不再成立：

- 官方 MCP 把 `firecrawl_interact`、`firecrawl_agent` 与页面读取并列为主力工具；
- REST v2 有完整的 `/v2/interact`、`/v2/interact/{sessionId}/execute`、`DELETE /v2/interact/{sessionId}`，
  以及 `/v2/agent`、`GET /v2/agent/{jobId}`；
- 用户真实遇到"要先登录才能读"和"我说不出网址但想知道答案"这两类任务，缺了它们只能手工绕开。

于是补三个工具（`firecrawl_interact`、`firecrawl_agent`、`firecrawl_index_search`），并保持
§4 的边界不变：**代码执行发生在 Firecrawl 沙箱，插件不在本地跑浏览器，也不实现抓取**。

由此带来的新约束，写进实现而不是文档里：

| 约束 | 落地 |
| --- | --- |
| interact 的代码可能含密钥 | 不回显到控制台日志，只在工具结果里返回 stdout/stderr |
| 会话是有状态资源 | 工具无隐藏状态：`create` 返回 id，后续调用显式传入；`stop` 释放 |
| sessionId 会被拼进 URL | 严格正则 `^[A-Za-z0-9_-]{1,128}$` + `encodeURIComponent` |
| agent 按额度计费 | `maxCredits` 透传；额度耗尽的返回标为 partial 而不是失败 |
| 索引检索与网页搜索混淆 | 单工具带 `index: developer\|gov\|research`，描述里点明不是通用搜索 |

仍未封装，且判定为**不属于连接器职责**：`find_tools`/Alexandria（返回 Firecrawl 自家工具图谱，
不是页面数据）、feedback、团队成员用量管理、support/ask、webhook CRUD、`/v2/parse/formats`。
理由逐条记在 [`../search/official-surfaces.md`](../search/official-surfaces.md) 的对照表里。

## 7. 对"重复造轮子"的回答

插件里现在没有任何抓取、渲染、解析、反爬代码：

- HTML → Markdown、JS 渲染、等待条件、代理与反爬、PDF/OCR：全部由 Firecrawl 云端完成；
- 插件保留的是**编排层**：参数校验、job 轮询与取消、分页拉取、失败归类、控制台呈现、
  凭据与端点管理、Agent 工具描述。

这正是"不重复造轮子"的边界：轮子是抓取，不是产品体验。

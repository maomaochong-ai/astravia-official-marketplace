# 改造方案 0001：Firecrawl 连接器

- 来源决策：[`../adr/0001-firecrawl-integration-mode.md`](../adr/0001-firecrawl-integration-mode.md)
- 状态：**实施完成，待真机验收**（阶段 0–4 已落地并通过自动化门禁，阶段 5 见 §5）
- 版本：插件 `0.4.1`（0.4.0 → 0.4.1：产物货架、历史持久化、Agent 工具卡片）

## 0. 目标与非目标

**目标**

1. 插件内**不存在**任何抓取、渲染、解析、反爬实现；能力全部来自 Firecrawl 云端。
2. 只有一个运行时：REST v2，经 `ctx.network.request` 发出。
3. 用户在**能力详情页**即可完成官方授权（跳转官网 → 粘贴 Key → 即时校验 → 显示额度）。
4. 产品名称统一为 **Firecrawl Connector / Firecrawl连接器**。

**非目标**

- 不自建爬虫、不做本地 HTML/Markdown 转换、不跑无头浏览器。
- 不把 REST / MCP / CLI 三种传输同时封装（见 ADR §5.4）。
- 不实现 Firecrawl 未开放的第三方 OAuth。

## 1. 阶段划分

### 阶段 0 — 删除自研引擎（已完成）

| 动作 | 对象 |
| --- | --- |
| 删除 | `src/domain/{ai,crawl,html,media,parse,pdf,render,scrape,search}/`、`src/domain/{denial,events,url}.ts` |
| 删除 | `src/runtime/{ai,browser-session,scrape-cache}.ts`、`src/types/` |
| 删除 | 16 个只服务本地引擎的测试文件 |
| 重命名 | `domain/backend/rest.ts` → `domain/firecrawl/client.ts`；`domain/backend/types.ts` → `domain/firecrawl/types.ts`；`runtime/upstream.ts` → `runtime/config.ts`；`engine-bar.tsx` → `connection-bar.tsx`；`tools/upstream-tools.ts` → `tools/request-bodies.ts` |
| 清理 | `dependencies` 清零；权限从 24 项降到 14 项；locales 删除 `engine.*`、`console.render.*` |

验收：`rg -i "cheerio|turndown|jsdom|puppeteer|playwright"` 在 `src/` 无命中；`npm run check` 通过。

### 阶段 1 — 领域与运行时重写（已完成）

```text
src/domain/firecrawl/
  types.ts       上游返回类型、FirecrawlError、客户端接口
  transport.ts   Transport 抽象 + TransportError（timed-out / host-not-allowed / response-too-large / transport-failed）
  client.ts      12 个端点、重试与退避、错误归类（401/402/429）
  options.ts     控制台的 CrawlJobOptions、上下界、请求体构造
  documents.ts   文档 → Markdown / 文本导出
  profile.ts     抓取结果摘要（标题、字节数、链接数）
src/runtime/
  config.ts      endpoint + API key（ctx.secrets）+ 账户状态
  http-client.ts ctx.network.request → Transport
  conversation-watch.ts  从对话里取 URL 作为控制台目标
```

验收：`test/client.test.ts` 以假 `Transport` 断言请求体，不触网。

### 阶段 2 — 控制台改为上游 job 驱动（已完成）

- `CrawlRunStore.start()`：`POST /v2/crawl` → `GET /v2/crawl/{id}` 轮询（`TICK_MS = 2 500`）→
  跟随 `next` 分页拉取 → `/errors` 归类拒绝原因 → `DELETE` 取消。
- `adopt(jobId, target)`：Agent 用 `firecrawl_crawl` 发起的 job 也能在蜘蛛图上播放。
- 保留原有视觉：蜘蛛图、Pages、Media、Inspector、对话标签。

验收：`test/crawl-run-store.test.ts` 用假客户端覆盖提交/轮询/分页/取消/失败五条路径。

### 阶段 3 — 授权闭环（本次实施）

| # | 动作 | 文件 |
| --- | --- | --- |
| 3.1 | `FirecrawlConfig` 增加账户状态与方法：`connect(key)`（先校验后落库）、`disconnect()`、`refreshAccount()`、`account` | `src/runtime/config.ts` |
| 3.2 | 新增能力详情页授权面板：状态、跳转官网、粘贴 Key、额度、断开 | `src/features/setup/ability-setup-slot.tsx` |
| 3.3 | 注册 `ui.registerAbilityDetailSlot({abilityId: "firecrawl"})`，新增权限 `ui.slot.ability-detail` | `src/index.tsx`、`plugin.json` |
| 3.4 | 控制台连接栏增加"在 Firecrawl 授权"入口，Keyless 状态直接可点 | `connection-bar.tsx` |
| 3.5 | 授权相关文案（en/zh） | `locales/{en,zh}.json` |

设计要点：

- **先校验后保存**：`connect()` 用候选 Key 调 `GET /v2/team/credit-usage`，成功才写 `ctx.secrets`；
  失败时保留原凭据并 `ctx.ui.notify({ error: true })`。
- **不做假 OAuth**：桌面端没有回调地址，Firecrawl 也未开放第三方客户端注册。授权入口 = 官方
  建 Key 页面 + 一次校验，用户感知是"点一下 → 浏览器登录 → 回来粘贴 → 看到额度"。
- **Keyless 仍是合法起点**：未配置时全部读取路径可用（Search / Scrape / Parse 与部分 crawl），
  面板只提示边界，不拦截。

验收：`test/config.test.ts` 覆盖"无效 Key 不落库"与"有效 Key 写入并可断开"；
`test/ability-setup.test.tsx` 覆盖面板在 keyless / keyed 两种状态下的渲染与按钮行为。

### 阶段 4 — 命名统一（本次实施）

| 位置 | 之前 | 之后 |
| --- | --- | --- |
| 市场卡片 `name` | `Firecrawl Web Crawler` | `Firecrawl Connector` |
| 市场卡片中文名 | `Firecrawl 网页爬取` | `Firecrawl连接器` |
| `locales/en.json` `name` | `Firecrawl` | `Firecrawl Connector` |
| `locales/zh.json` `name` | `Firecrawl 网页抓取` | `Firecrawl连接器` |
| 技能展示名 | `Firecrawl` | `Firecrawl Connector` |
| README 标题 | `Firecrawl Web Crawler` | `Firecrawl Connector` |

保持不变的**身份**：`slug` / `plugin.json.id` / 包目录 / 工具前缀 `firecrawl_` / 凭据键
`firecrawl.apiKey`。改名只动展示层，不动安装身份与配置契约（`configVersion` 不升）。

### 阶段 5 — 文档（已完成）

```text
docs/search/README.md                 调研索引 + 事实速查
docs/search/claude-code.md            quickstarts/claude-code 全文整理
docs/search/official-surfaces.md      抓取流程 + 四种接入面
docs/adr/0001-…-integration-mode.md   决策：REST 单一运行时，授权内嵌
docs/plans/0001-…-connector.md        本文
```

### 阶段 6 — 控制台可视化与产物复用（本次实施）

目标：一次爬取的过程与结果都在插件内闭环，并且能与宿主 AI 双向交互；**不修改宿主仓库**，
只使用宿主已公开的插槽与 Agent 会话接口。

| # | 动作 | 文件 |
| --- | --- | --- |
| 6.1 | 文档 → 类型化产物（markdown / links / images / media / json / document），按字节计量并设上限 | `src/domain/firecrawl/artifacts.ts` |
| 6.2 | 每次运行把产物与摘要写入 `ctx.storage`，最多保留 6 次运行，恢复/删除都可逆 | `src/features/crawler-console/services/run-archive.ts` |
| 6.3 | store 累积产物与"到达事件"，运行结束持久化，启动时载入历史 | `services/crawl-run-store.ts` |
| 6.4 | 检查器新增 **Artifacts** 与 **History** 两个标签，产物按类型筛选、预览、复制/下载/打开 | `components/artifacts-tab.tsx`、`components/history-tab.tsx` |
| 6.5 | 蜘蛛图：类型图例、沿边回流的数据包动画、蜘蛛随新页面弹动 | `components/spider-web-panel.tsx`、`src/style.css` |
| 6.6 | Agent 工具调用在对话里显示为一张卡片（实时页数 + 一键打开控制台） | `components/crawl-tool-call.tsx` |
| 6.7 | "问 AI"：把产物摘要作为提示词发给当前会话，无会话时回退到输入框 | `src/runtime/ai-bridge.ts`、`artifacts-tab.tsx` |

设计要点：

- **与宿主 AI 的交互是双向的**：AI 通过 `firecrawl_*` 工具发起爬取 → 工具卡片把用户带回控制台；
  用户在控制台点"问 AI"→ 产物摘要回到同一会话。两条路都走宿主公开接口，不读宿主内部状态。
- **产物按类型而不是按页面**：同一页面的 Markdown、链接、图片分开成行，用户可以直接复用其中一类。
- **持久化用 `ctx.storage`，不用 `fs.write`**：路径相对插件命名空间，索引文件是唯一事实源，
  记录损坏时降级为空列表而不是让面板崩掉。
- **动画仍只写 className**：新增 `--animate-fc-lunge` / `--animate-fc-packet` 与嵌套 `@keyframes`，
  不引入全局选择器；`prefers-reduced-motion` 由 `motion-safe:` 前缀保证。

验收：`test/artifacts.test.ts`、`test/run-archive.test.ts`、`test/crawl-tool-call.test.tsx`，
以及 `test/crawl-console.test.tsx` 中的产物货架与历史空态用例。

## 2. 文件职责（改造后）

| 路径 | 职责 |
| --- | --- |
| `src/domain/firecrawl/transport.ts` | 与宿主网络层的唯一接缝 |
| `src/domain/firecrawl/client.ts` | 12 个端点、重试、错误归类 |
| `src/domain/firecrawl/options.ts` | 控制台选项与 crawl 请求体 |
| `src/domain/firecrawl/documents.ts` | 文档导出（Markdown / 文本） |
| `src/runtime/config.ts` | endpoint、凭据、账户状态（授权） |
| `src/tools/*-tool.ts` | 10 个 Agent 工具，各自一个文件 |
| `src/features/crawler-console/**` | 控制台：连接栏、控制栏、蜘蛛图、各标签页、运行 store |
| `src/features/setup/ability-setup-slot.tsx` | 能力详情页授权面板 |
| `src/domain/firecrawl/artifacts.ts` | 文档 → 类型化产物 + 上限与计量 |
| `src/features/crawler-console/services/run-archive.ts` | 运行归档（`ctx.storage`，索引为事实源） |
| `src/features/crawler-console/components/{artifacts,history}-tab.tsx` | 产物货架与历史面板 |
| `src/features/crawler-console/components/crawl-tool-call.tsx` | 对话内的爬取卡片（工具调用插槽） |
| `src/runtime/ai-bridge.ts` | 控制台 → 宿主 Agent 的唯一出口 |

## 3. 验证矩阵

| 命令 | 覆盖 | 期望 |
| --- | --- | --- |
| `npm run check` | tsc 全量 | 0 error |
| `npm test` | 12 个测试文件 / 91 项 vitest | 全绿 |
| `npm run build` | MF 远程 + 打包 | 产出 `.astraviapkg` |
| `node scripts/marketplace.mjs check`（仓库根） | 源码索引校验 | Validated |
| `node --test tests/*.test.mjs`（仓库根） | 市场内容回归 | 0 fail |
| `node scripts/marketplace.mjs build`（仓库根） | 生成 gh-pages 站点 | exit 0 |

手工验收：桌面端「能力 → 添加市场源」安装本仓库 → 打开 Firecrawl 能力页 → 点"授权" →
浏览器登录并创建 Key → 粘贴 → 看到套餐与额度 → 控制台可用。

## 4. 风险与回滚

| 风险 | 处置 |
| --- | --- |
| 官网授权页 URL 变更 | 集中在 `AUTHORIZE_URL` 常量，一处修改；ADR 记录来源 |
| 用户 Key 权限不足（团队只读） | 校验失败时保留原凭据，提示上游原文，不静默回退到 keyless |
| 额度查询端点对 keyless 返回 401 | 只在有 Key 时展示账户区块；keyless 显示"未连接" |
| 阶段 0 的删除不可逆 | 全部改动在 `main` 之前的普通 PR 中，用 git 历史回滚；不改写已有发布版本 |

## 5. 完成定义

- [x] 阶段 3 与阶段 4 的代码与文案全部落地
- [x] 自动化门禁全绿（见 §3：`npm run check` / `npm test` 91 项 / `npm run build` → `release/firecrawl-0.4.1.astraviapkg` / 仓库 `check` / `node --test` 62 项）
- [ ] 能力页授权在真实桌面客户端走通一次（需人工：安装 → 打开能力页 → 跳官网取 Key → 粘贴 → 看到额度）
- [x] README / SKILL / detail 与新命名、新授权流程一致
- [ ] 真机上确认产物货架与历史在重启后仍在（需人工：跑一次 crawl → 重启客户端 → 历史里恢复该运行）

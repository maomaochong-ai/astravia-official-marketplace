# ADR-0016：技能库以上游 `/api/skills*` 为源，用 MCP 工具代理而不复制文档

- 状态：已接受（2026-10-28）
- 相邻：ADR-0002（工具集与授权边界）、ADR-0012（服务端模块切分）、ADR-0008（前端由 shim 承载）

> 证据等级沿用 `README.md` 的约定。本文的 **Observed（源码）** 指在本机上游检出里读到并核对了行号；
> 本机没有跑起画布后端与登录会话，所以「接口实际返回什么」一律是 Inferred。

## 背景：画布有 73 个内置技能，插件一个都没有

上游把技能库编进后端二进制：`backend/builtin/` 有 73 个技能目录 + `embed.go`，
`//go:embed all:*` 把它们塞进 `embed.FS`，再由 `backend/internal/skills` 建库、对外经
`backend/internal/handler/skills.go` 的 `/api/skills*` 暴露。Observed（源码）：
`skills_builtin.go` 的 `builtinSkillFiles = builtinAssets.FS`、`EnsureBuiltinSkills` 的
「读 SKILL.md → 解析元数据 → 比对 ContentHash → 变了才写新版本」流程。

插件的 MCP 面在此之前**完全不知道技能存在**：`grep -i skill server/src` 只命中
`canvas-node-contract.ts` 里的节点类型名 `skill`（`NODE_SCHEMAS.skill = { fields: ["skillId","config"] }`）。
也就是说画布 UI 里能挑技能，Agent 只能靠人肉把技能正文粘进上下文。

## 决策 1：代理，不复制

不做「把 73 份 SKILL.md 抄进插件、或者打包成 73 个 scene/skill 载荷」。

| 理由 | 具体代价（如果反过来做） |
| --- | --- |
| 内容已经在用户机器上 | 技能随后端载荷一起下载安装，插件再存一份就是同一份字节存两遍（`影视剧作工坊` 一个包就是 246 个文档） |
| 版本只有一个真相 | 上游升级技能是换 `contentHash`；插件内副本会与后端不同步，且没有任何东西会提示「该更新了」 |
| 授权不重做一遍 | `/api/skills*` 走画布的会话与可见性规则（`visibleSkill`：未公开返回 `Forbidden("该技能未公开")`）。复制必须自己重建这套判定 |
| 交付物可控 | 73 个包合计远超插件制品预算；而工具面只是一层投影 |

所以插件只提供**读取与挑选**的能力：工具是视图，正文仍由后端发。技能包清单与分类分布见
`docs/open-ai-canvas-builtin-skills.md`。

## 决策 2：八个工具，一条工具管一件事

工具数从 20 增到 28。逐个对应上游端点，不做「万能 `skills` 参数分派」：

| 工具 | 上游 | 为什么必须单独存在 |
| --- | --- | --- |
| `list_skills` | `GET /api/skills` | 唯一能做「我不知道叫什么，先看看」的入口；带 `search`/`tag`/`sort` |
| `get_skill` | `GET /api/skills/:id` | 拿到 `SKILL.md` 正文（`instruction`）——Agent 真正要执行的内容 |
| `list_skill_files` | `GET /api/skills/:id/files` | 复杂技能的知识在 `cards/`、`references/` 里（`喜剧-mechanics` 68 个文档），只看入口会漏 |
| `read_skill_file` | `GET /api/skills/:id/file?path=` | 按需读一个文档，不必把整包塞进上下文 |
| `search_skill_files` | `GET /api/skills/:id/search?q=` | 大包里定位一段话；上游限 50 条命中、关键词 1–120 rune |
| `list_added_skills` | `GET /api/skills/added` | 「我装过哪些」是选技能的强先验，也是幂等检查点 |
| `set_skill_added` | `POST`/`DELETE /api/skills/:id/add` | 唯一写操作；不写就只能读，用户还得回浏览器点 |
| `list_skill_presets` | `GET /api/skills/presets` | 把「帮我做个短视频」这类自然语言场景映射到 skillId 集合，是模糊请求的首选入口 |

`set_skill_added` 是**唯一**的写动作，而且可逆（加/取消）。没有做创建、修改、删除、同步、
like——那些是内容生产，入口留在画布 UI；Agent 替用户发一份技能上去，权限与归属都说不清。

## 决策 3：传输端口注入，不让模块互相 import

`server/src/canvas-skill-library.ts` 只声明 `CanvasApiPort { request(method, pathname, body?) }`，
由 `mcp-protocol-server.ts` 在装配点传入 `{ request: rawCanvasApi }`，类型 `ToolResult` 走
`import type`（编译期擦除）。

后果：`catalog → library → protocol → catalog` 这个环不存在。若让技能模块直接 import
`rawCanvasApi`，esbuild 能打包，但模块图里就出现循环，`check:service-layout` 的职责切分随即失效，
单测也没法用一个假端口喂入固定响应。

## 决策 4：列表做字段投影，正文默认截断

`SkillItem` 有三十多个字段（`versionId`、`contentHash`、`sourceUrl`、`sourceCommit`、`ownerUid`、
`effectiveUser`、`showcaseMedia`…）。对「挑一个技能」有用的只有十来个，所以 `list_skills` /
`list_added_skills` / `set_skill_added` 一律经 `projectSkill()` 投影；正文与包内文件走专用工具。

`get_skill` 默认把 `instruction` 截到 20000 字符，并回 `instructionChars` /
`instructionTruncated` / `note`。Observed（源码）：最大的内置 `SKILL.md` 接近 4.6 万字节，
全量返回一次就吃掉可观上下文；截断是显式的，`note` 直接指向 `read_skill_file`，不静默丢内容。

## 决策 5：会话缺失与「技能不存在」分开报

`/api/skills/presets` 无会话即可访问（handler 注释：公开只读的市场元数据），其余端点都要
`currentUser`。`rawCanvasApi` 在没有 `SESSION_TOKEN` 时直接返回 `{status: 401, code: "canvas-login-required"}`。
技能层把它翻成「没有画布会话，先在浏览器登录」这类英文错误，而不是让 401 冒泡成
「技能不存在」——后者会把用户引向错误的方向（去搜技能名）。

## 决策 6：顺手修掉一个真缺陷——`/__canvas/tools` 在后端就绪后失效

写工具分组断言时才发现：`stable-origin-binding.ts` 里 `servePreparation` 只在 `!goPort`
（后端未就绪）时被调用，而 `/__canvas/tools` 就长在它里面。后端一旦就绪，这条路径落到
`serveWebAsset` 的 SPA 回退，返回 `index.html`。

- Observed（源码）：`stable-origin-binding.ts` 的 `if (!goPort) { servePreparation(...) }`，
  以及紧随其后的 `if (!isApiPath(pathname) && serveWebAsset(...))`。
- Observed（运行）：修前 `verify-mcp-tools.mjs` 走到 `/__canvas/tools` 时 JSON 解析报
  `Unexpected token '<', "<!doctype "... is not valid JSON`。
- 修法：把整个 `/__canvas` 前缀认成 shim 自己的运维面（`ownsCanvasRoute = pathname === "/__canvas" ||
  pathname.startsWith("/__canvas/")`），不再跟着后端是否就绪开关。它本来就不是后端路由；
  ADR-0017 的 `update-check` / `upgrade` 也挂在这一面下面。

这不是为测试让路：就绪后工具面板拿到 HTML，是用户可见的「工具列表刷不出来」。

## 后果与代价

- 工具声明必须同时落三处（`MCP_TOOLS`、`MCP_TOOL_GROUPS`、`handleMcpToolCall`）。漏第三处会落到
  `Unknown tool`；漏第二处不会报错，只会静默变成 `other` 分组——所以 `verify-mcp-tools.mjs`
  现在同时断言「8 个技能工具都在 `skills` 分组」和「没有任何工具落在 `other`」。
- 插件与上游 `/api/skills*` 的查询参数耦合（`page`/`pageSize`/`scope`/`tag`/`sort`/`q`/`path`）。
  上游改名就会断；缓解手段是假后端按路径回显查询串，把「参数到底送出去没有」变成可断言的形状。
- 插件不认识技能内容本身。技能正文里的工具名、表单交互（如「表单交互生成微表情提示词」）
  属于画布前端能力，经 MCP 只能读到文字。
- `skill` 节点类型（`{ skillId, config }`）与技能库是两条路：前者是画布图上的执行节点，后者是
  知识入口。本轮**没有**把 `list_skills` 的结果与节点 `skillId` 做交叉校验——见「未做的事」。

## 被否决的选项

| 选项 | 否决理由 |
| --- | --- |
| 把 73 份 SKILL.md 打进插件 | 重复存储、与后端版本不同步；单个 `影视剧作工坊` 就 246 个文档 |
| 只做一个 `skills` 工具靠 `action` 分派 | 声明式工具列表是 Agent 的发现面，一个万能工具等于没有 schema 提示 |
| 让 Agent 直接读后端文件系统 | 技能在 `embed.FS` 里，运行时并不以散文件存在；绕过会话等于绕过可见性 |
| 顺手把 `like`/`sync`/`create` 也暴露 | 内容生产与归属判定在画布 UI 更合适；写入面越小越好 |
| `get_skill` 默认返回全文 | 单次就能吃掉上下文；截断 + 指向 `read_skill_file` 更可控 |
| 沿用上游中文错误文案 | 既有 MCP 面是英文（`task_id is required`、`Unknown tool: x`），混排会让调用方难以匹配 |

## 证据边界

- **Observed（源码）**：`backend/builtin/` 的 73 个技能目录与 `embed.go`；`skills_builtin.go` 的
  落库流程；`handler/skills.go` 的全部路由与 `presets` 免登录；`skills_presets.go` 的
  `skillPresetScenes` / `skillPresetEvidence`；`skill_packages_files.go` 的 512KB 预览上限与
  50 条搜索上限；插件侧 `canvas-skill-library.ts`、`mcp-tool-catalog.ts`、`mcp-protocol-server.ts`、
  `stable-origin-binding.ts` 的改动行。
- **Observed（运行）**：`node scripts/verify-mcp-tools.mjs` → `65/65 passed`（含工具数 28、
  8 个技能工具的分组断言、匿名会话断言、9 条技能行为断言）；`npm test` 全绿。
- **Inferred**：真实画布上 73 个技能的 `skillId` 与目录名映射（按 `metadata.skillId` 优先、
  目录名作 slug 的规则推出；本机没有登录会话）；`GET /api/skills` 真实分页默认值与 `categories`
  的实际返回形状（按 handler 与 `normalizeSkillListRequest` 推出）。
- **NOT RUN**：在真实画布里 `list_skills` → `get_skill` → 按技能正文执行一次的端到端；
  `set_skill_added` 对真实用户「我的」列表的实际影响。

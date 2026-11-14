# Strix 插件 · 开发说明

工作目录就是本目录，所有命令在这里执行。上游引擎是 [usestrix/strix](https://github.com/usestrix/strix)，本插件把它的 **界面** 搬进标签页；模型、循环与工具调用都归宿主，插件只提供沙箱、工具面与窗口（ADR `strix-0003`）。

## 命令

```bash
npm install
npm run typecheck       # tsc --noEmit，全量类型检查
npm test                # vitest：界面、事件投影、桥接客户端、服务层纯函数
npm run build:service   # src/service/*.ts -> dist/service/main.mjs（esbuild 单文件）
npm run stamp-service   # 改了服务后重算工件摘要
npm run build           # vite build + build:service（顺序：先清空 dist，再写服务）
npm run check           # typecheck + test + 服务冒烟
```

仓库级：`node scripts/marketplace.mjs check`、`node --test tests/*.test.mjs`。

## 界面是什么

参考项目 `strix/interface/tui`（Bubble Tea）有两屏，本插件按原样复刻：

| 上游 | 本插件 | 文件 |
|---|---|---|
| `setup.go:setupBody` 启动页 | 启动列：词标、tagline、圆角输入面板、面板内的模型行、反馈日志、`enter launch scan / ctrl+c quit / vX` | `features/scan-console/components/launch-screen.tsx` |
| `view.go:mainView` 扫描页 | 左列轨迹 + 状态行 + 输入框，右侧沙箱/目标/问题三个圆角盒 | `features/scan-console/components/scan-screen.tsx` |
| `render/registry.go` 工具块 | `→ Using tool <name>` + 参数 + `✓ Done / ✗ Failed / ● In progress...` | `features/scan-console/components/trace-block.tsx` |
| `render/chat.go` 聊天气泡 | `▍ You:` 与普通正文 | `trace-block.tsx` |
| `setup.go:banner` 词标 | 同一段 ASCII，逐行补齐宽度后居中 | `strix-wordmark.tsx` |
| `render/styles.go` 调色板 | `style.css` 里的 `--sx-*` 变量 | `style.css` |

界面刻意 **不** 用宿主主题变量：这一屏就是终端里的 `strix`，换成本地配色的卡片就不像它了。只有 `astra-strix-*` 类名，不碰宿主 class。

## 只有一个 AI：宿主会话（不要退回两套）

上游用自己那份 `STRIX_LLM` + key 跑 agent loop。这里**不跑**：宿主 agent 已经通过
`agent.mcpServers` 拿到这 26 个 `strix_*` 工具，它就是循环。插件只做窗口与操作面。

| 方向 | 来源 | 用法 |
|---|---|---|
| **输入** | `ctx.conversation.sendPrompt` / `createSession` | 启动列与输入框的每句话都交给宿主会话（没有活跃会话时先按当前 cwd 建一个）；发不出去就 `log.sendFailed`，不自己开工 |
| **输出：会话侧** | `ctx.conversation.on(...)` | 只接 `turn-start` / `turn-end`（running/idle 与轮次分隔）与 `tool-call-*`（哪个 `strix_*` 被调）。**`message-*` 的文字不进面板**（ADR 0007） |
| **输出：服务侧** | `/api/events`（`client.events`） | `strix_exec` 的命令、退出码、耗时、输出尾巴——只有持有容器的一侧知道 |
| **事实** | `GET /api/state` | 每次工具结束/轮次结束重读 findings、计划、覆盖、笔记、沙箱 |

切分规则在 `domain/conversation-projection.ts`：带证据的命令从服务画，其余工具从会话画，
`isServiceNarrated()` 是唯一开关（`exec_command` → `strix_exec` 的映射也在这里）。宿主名
可以带前缀（`mcp__strix__strix_exec`），按最后一个 `strix_*` 段比对。

要点：

- **插件里不存在模型调用**：没有 `ctx.ai.chat`、没有第二份系统提示词、没有私有 messages。
  `agent/strix-agent.ts` / `agent/system-prompt.ts` 已删，不要再写回来。
- **方法论走提示词，不走模型**：`locales/*.json#prompt.instructions` 随每一轮发出，
  写清工具分组、取证顺序、以及「工具表里没有 `strix_*` 时如实说明并停下，不许手搓替代」。
- **模型标签只读 `conversation.model`**：`provider/id` 拆开就是名字，连 `ai.models.list`
  都不叫（权限已移除）。
- **工作目录来自 `conversation.cwd`**：它就是宿主 agent 在干活的目录，也是沙箱挂的目录。
- **没有插件侧子智能体**：需要并行分工就用宿主自己的 subagent，共享同一个沙箱与台账。
- 工具目录只有一份：`agent/strix-tools.ts` 的 `STRIX_TOOL_SPECS`（33 个，全部 `handler: "service"`）；
  服务端启动时校验 handler 齐备。与上游的逐项对照写在 ADR `strix-0006`：
  - 已补齐：`strix_exec` 的 `background`/`tty`、`strix_write_stdin`、`strix_shell_sessions`、
    `strix_kill_session`、`strix_patch`、`strix_view_image`、`strix_think`、`strix_scope`。
  - 有意不补：`agents_graph`（子智能体需要有人跑模型——那是宿主）、`web_search`（宿主有）、
    `wait_for_user`（宿主就是那个等待）、Caido 专用読み（统一走 `strix_proxy` action）。
- **改文件用 `strix_patch`，不要用 heredoc**：引号、`$`、反斜杠会被 shell 吃掉。
  锚点（`@@`）在文件里不唯一时**报错而不是猜**，宁可让模型重试，不能改错函数。

所以一次扫描不需要第二份凭据，也没有第二份对话。

## 分层

| 位置 | 职责 |
|---|---|
| `src/index.tsx` | 只做装配：activity tab + input action，并用 `useActiveConversation()` 把标签页绑到当前会话 |
| `src/runtime.ts` | `strix-bridge` 生命周期（`ctx.services`）：声明 → 安装 → 启动 → 就绪 |
| `src/runtime-contract.ts` | 宿主桥接的最小类型边界 |
| `src/agent/strix-tools.ts` | 工具 schema 与轨迹文案（工具名 → 一行摘要）；**全部是服务侧工具** |
| `src/domain/conversation-projection.ts` | 两条事件流 → 一条轨迹：工具命名、服务名映射、行构造与证据回填 |
| `src/domain/engagement.ts` | 胶囊是否开着（模块层，标签页重挂不失忆） |
| `src/domain/assessment-presence.ts` | 「评估是否已开」的判定：沙箱/发现/计划/笔记/覆盖/威胁模型 |
| `src/domain/bridge-client.ts` | 对服务的客户端：state / report / stop / callTool / SSE |
| `src/domain/launch-request.ts` | 启动提示词的解析（目标 vs 方法），对齐 `setup.go:submitSetupPrompt` |
| `src/domain/model-label.ts` | `provider/model` 拆分与展示格式化 |
| `src/domain/host-sync.ts` | 宿主→插件的只读通道：模型标签、工作目录名 |
| `src/features/scan-console/` | 两屏 UI、状态机、轨迹块、词标、错误边界 |
| `src/features/findings/` | 问题列表与展开详情 |
| `src/service/main.ts` | 受管服务入口：MCP 工具面 + `/api/*` + SSE |
| `src/service/sandbox.ts` | 容器生命周期与命令执行 |
| `src/service/docker.ts` | docker CLI 封装（run/exec/rm/pull） |
| `src/service/skills.ts` | 从已安装引擎读取技能库 Markdown |
| `src/service/findings.ts` | 发现项台账、Markdown 报告、SARIF 导出 |
| `src/service/notes.ts` | 评估笔记（增删改查） |
| `src/service/todo.ts` | 计划清单，排序与面板一致 |
| `src/service/coverage.ts` | 测试面覆盖记录 + 威胁模型 |
| `src/service/sarif.ts` | SARIF 2.1.0（CI 里注解 PR） |
| `src/service/paths.ts` | 唯一的数据目录解析：环境变量，否则 `~/.astravia/plugin-data/strix` |
| `dist/service/main.mjs` | 上面这些的打包产物（生成物，随包发布，不进 Git） |
| `agent/skills/` | 上游 9 个对外技能，原样拷贝 |

## 决策与理由

1. **全仓 TypeScript，生成物在 `dist/`。** 服务端没有 Python 层：沙箱走 docker CLI，技能从已安装的 `strix-agent` 包里读 Markdown。宿主只认 JavaScript 入口，`scripts/build-service.mjs` 用 esbuild 打成 `dist/service/main.mjs`，并拒绝产物目录出现 `.py`。
2. **界面照抄，模型借用。** 复刻启动页与扫描页的排版、文案与配色（包括词标与 `enter launch scan` 这行提示），差异只有一处：模型那行显示的是宿主模型，而不是 `STRIX_LLM`。
3. **插件里没有 loop。** 宿主 agent 是唯一会推理的一侧（ADR strix-0003）；服务是无状态的容器管理者，面板是窗口。之前那份 `strix-agent` loop 已删：它需要模型，而多一份模型就是多一套结论。
4. **工具目录只有一份。** `STRIX_TOOL_SPECS` 同时供给 MCP 面与 `/api/tool`，服务端启动时校验「声明的都接上了」，缺一个 handler 直接起不来。
5. **失败不弹给用户，交给模型。** 工具抛错变成 `isError` 的 tool result 回到宿主 agent 手里，让它换一条路；面板不帮它收尾。
6. **服务声明全部工件。** 宿主 `resolve()` 拒绝启动未经 `install()` 写入的运行时，`install()` 要求 payload 与 `platform.artifacts` 一一对应并校验 SHA-256。
7. **就绪语义。** `/api/health/ready` 一旦监听就回 200，细节放 body：非 2xx 会被宿主当成进程坏掉并重启。
8. **数据目录只有一个出口。** 所有存储走 `service/paths.ts`：宿主给了 `ASTRAVIA_SERVICE_DATA_DIR` 就用它，否则 `~/.astravia/plugin-data/strix`——绝不用进程 cwd（上一版在 checkout 里跑服务，把 `notes/`、`todos/` 写进了插件目录）。
9. **技能是插件内部实现。** `skillPresentation.defaultVisibility: "hidden"`：9 个技能仍随 `agent.skillPaths` 加载、agent 可调用，但能力中心、命令菜单与 Skill 选择器里只有 **Strix 的名字和图标**。

## 改动时注意

- 改了 `src/service/` 就要 `npm run build:service && npm run stamp-service`：宿主安装的运行时摘要来自 `stamp`，入口是 `dist/service/main.mjs`。`npm run build` 会做前者，后者需要单独跑。
- 改了插件运行内容（`src/`、清单、技能）就要抬版本，并同步 `plugin.json`、`ability.json`、`package.json`、锁文件、`.astravia/marketplace.source.json`。
- 不要手写 `dist/service/main.mjs`：它是生成物。
- 提交前跑 `npm run check`；`typecheck` 是硬门槛，不要靠 `@ts-nocheck` 绕过。
- `detail.json` 的 `showcase` 文案必须短：宿主用固定高度卡片 + `line-clamp-3` 渲染。
- 图标是上游官方位图（`docs/logo/strix.png`），不要用相似的 Iconify 图形替代。
- 视觉改动请在真实浏览器里核对：`src/style.css` 逐像素对应终端观感，改颜色/间距前先看一眼启动页。
- 清单里**不要再写 `providers.cli`**：宿主 `arePluginCliProvidersReady()` 一旦不满足就会丢掉这整条 agent 贡献（技能 + MCP 服务器一起丢），而命令行不是本插件的依赖——技能库有 `agent/skills/library/tooling/` 的随包副本。
- `agent.mcpServers` 的 `type: "service"` 只有在服务就绪时才会物化成工具（`resolveServiceMcp` 返回 undefined 就跳过），所以 `activate()` 里必须先 `runtime.ensureReady()`；否则先建的会话永远看不到 `strix_*`。
- 面板的屏幕由服务里的事实决定（`domain/assessment-presence.ts`），不是「组件看过消息没有」：宿主已经跑过一轮时面板必须直接进扫描屏。
- **面板不画对话正文**（ADR 0007）：`TraceEntry.kind` 只有 `tool` / `say` / `note`，`message-*` 事件显式 return。要加回文字先读 0007——两个可滚区域就是用户抱怨的那份冗余。
- **台账面板必须可检查**（ADR 0008）：一行只有标题就是装饰。笔记可展开取正文（`strix_note_get`），
  覆盖超上限要写“还有 N 行”；计划/覆盖/笔记的**写入归 agent**，面板只读。
- **运行记录永远贴在底部**（`features/scan-console/scroll-stick.ts`）：贴底时跟随新行；读者
  往上滚了不抢回，只显示“N 条新消息”。改滚动行为前先读那两个文件，不要在组件里另写一套。
- **投递顺序：先发、后建、最后交给宿主**（1.0.4）。`sendPrompt` 在宿主的新会话页也能发（宿主自己按当前目录建会话），
  所以不要先 `createSession`——那会把"拿不到 cwd"变成一次假的"你没打开目录"。只有发送真的失败才建会话；
  连 cwd 都拿不到时用 `ctx.conversation.insertText` 把话交回宿主输入框。
- **会话目录要兜底**（1.0.3）：发送/新建会话时用 `conversation.cwd ?? ctx.fileExplorer.getWorkspaceRoots()[0]?.path`。
  只认 conversation.cwd 会误报"先在宿主里打开一个工作目录"，而用户明明已经打开了（需要 `workspace.read`）。
- **首屏输入框以下是两列**（1.0.4）：`grid-template-columns: 5.2em minmax(0, 1fr)`，标签列 / 值列。
  不要在单行上加自己的缩进——那正是“参差不齐”的来源；模型只画一次。
- **首屏整块留 px 上限，不要用 ch**（1.0.5）：CJK 等宽下 `1ch ≈ 13px`，`72ch` 就是 940px，
  一块就把面板撑满，两侧没留白就永远看着“没居中”。整块 `min(680px, 100%)` + `margin: auto`；
  头部（wordmark + 标语）居中，**行保持左对齐**（居中的 logo + 左对齐的内容是唯一不别扭的组合）。
- **行首不要挂装饰圆点**（1.0.5）：`●` / `○` 只给状态（桥接就绪、工具进行中、todo 状态）。
  模型名、环境名前不加点。文案里也不要用括号补充说明（`容器（docker）` → `容器`），
  括号里的信息要么单独成为标签，要么放进状态行。
- **切屏条件不要掺胶囊状态**（1.0.5）：`turn-start` 只问一句“用户按过返回首屏吗”。
  旧实现还要 `isStrixEngaged()`，胶囊没开就停在首屏，看起来像“发出去了面板没反应”。
  `deliver` 成功自己也切屏并销 pin——用户按的是“开始”，不是“继续看首屏”。
- **环境下拉要有自己的底色**：它压在磷光绿背景上，透明背景会让字看不清；`option` 也要单独设色。
- **工具行必须家族化**（ADR 0009）：新增工具要在 `features/scan-console/tool-presentation.ts` 登记字形/色调/是否可展开；未登记落到 generic（上游同名回落），`tool-presentation.test.ts` 守着覆盖率。不要再回到“一个通用块画 35 个工具”——那是上一轮与上游最大的界面差距。
- **外观口径（ADR 0011）**：磷光是 `.astra-strix-term.astra-strix-phosphor` 的变量覆盖，不要直接把背景写成黑色；
  `--sx-red` 只给失败、`--sx-amber` 只给进行中，其余一律绿。首屏数据流用固定字符集（禁止 `Math.random()`），
   `prefers-reduced-motion` 下必须静止。扫光只在状态带（6 格）与 running 的工具行（4 格）出现，且用 keyframes 不用 JS 计时器。
- **工作单元面板只列沙箱会话**（ADR 0010）：不要把宿主子智能体画进来——宿主有自己的面板，插件只能观察启停。
- 界面对照基线是上游 TUI（`strix/interface/tui/internal/app/view.go`）；对照原型在仓库 `docs/prototypes/strix-panel-vs-tui.html`，相似度用 `tools/ui-parity.mjs` 复算。

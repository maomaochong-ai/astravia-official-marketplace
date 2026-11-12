# Strix 插件 · 开发说明

工作目录就是本目录，所有命令在这里执行。上游引擎是 [usestrix/strix](https://github.com/usestrix/strix)，本插件把它的 **界面** 搬进标签页，模型则用宿主的。

## 命令

```bash
npm install
npm run typecheck       # tsc --noEmit，全量类型检查
npm test                # vitest：界面、agent loop、桥接客户端、服务层纯函数
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

## 模型从哪来（宿主 → 插件）

上游用自己那份 `STRIX_LLM` + key；这里全部来自宿主，三条通道各有唯一来源：

| 通道 | 来源 | 用法 |
|---|---|---|
| **模型** | `useActiveConversation().model`（`provider/id`），没有时回退 `ctx.ai.listModels().defaultModel` | 直接传给 `ctx.ai.chat({ modelKey })`，并在启动页那句 `● <name> · <provider>` 上显示 |
| **工作目录** | `useActiveConversation().cwd` | 作为 `strix_sandbox_start` 的 `localSources` 挂进 `/workspace/<name>`，启动日志写明挂载了哪个目录 |
| **对话侧工具调用** | `ctx.conversation.on(...)` 的 `tool-call-start/end` | 用户在聊天里让宿主 agent 调 `strix_*` 时，这些调用会同步出现在插件轨迹里（按工具名过滤，别的 MCP server 不会混进来） |

都靠权限 `agent.session.read`。纯函数在 `domain/host-sync.ts`（`resolveModel` / `strixToolName` / `hostToolCall` / `workspaceLabel`），有单测。

要点：

- **对话的模型优先**，即使它不在 `listModels()` 的文本模型列表里——宿主是权威，标签从 key 拆。
- 聊天里换模型，插件顶部跟着换（`conversation-changed` → 重新解析）。
- `ctx.ai.chat()` 是真 loop，在 `agent/strix-agent.ts`；`chat` 无状态，转写由插件持有并整轮重放。
- 工具目录只有一份：`agent/strix-tools.ts` 的 `STRIX_TOOL_SPECS`。每个 spec 标明 `handler: "service" | "plugin"`，服务端只认领 `service` 那一半并在启动时校验 handler 齐备；插件侧（`think` / `ask_user` / `spawn` / `wait` / `view_agents` / `finish`）在 loop 里直接回答，因为它们要模型或要界面。
- 宿主 agent 走 MCP 时看到的是同一批 `service` 工具；插件自己的 loop 走 `POST /api/tool`。两条路到达同一个沙箱与同一份发现台账。

所以一次扫描不需要第二份凭据，也不会产生第二份对话。

## 分层

| 位置 | 职责 |
|---|---|
| `src/index.tsx` | 只做装配：activity tab + input action，并用 `useActiveConversation()` 把标签页绑到当前会话 |
| `src/runtime.ts` | `strix-bridge` 生命周期（`ctx.services`）：声明 → 安装 → 启动 → 就绪 |
| `src/runtime-contract.ts` | 宿主桥接的最小类型边界 |
| `src/agent/strix-agent.ts` | agent loop：模型轮次、工具执行、失败回灌、上限与中止 |
| `src/agent/strix-tools.ts` | 工具 schema 与轨迹文案（工具名 → 一行摘要） |
| `src/agent/system-prompt.ts` | Strix 的作业姿态：授权范围、证据优先、只有沙箱能执行命令 |
| `src/domain/bridge-client.ts` | 对服务的客户端：state / report / stop / callTool / SSE |
| `src/domain/launch-request.ts` | 启动提示词的解析（目标 vs 方法），对齐 `setup.go:submitSetupPrompt` |
| `src/domain/model-label.ts` | `provider/model` 拆分与默认模型选择 |
| `src/domain/host-sync.ts` | 宿主→插件三通道：模型解析、工作目录名、宿主工具调用→轨迹行 |
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
3. **agent loop 在插件里，不在服务里。** 服务是无状态的容器管理者；loop 需要模型，而模型只有渲染进程侧的 `ctx.ai` 有。loop 放渲染层还让"停止"能立刻中断下一次模型调用。
4. **工具目录只有一份。** `STRIX_TOOL_SPECS` 同时供给 MCP 面与 `/api/tool`，`handler` 字段决定由谁回答；服务端启动时校验“声明的都接上了”，缺一个 handler 直接起不来。
5. **失败不终止。** 工具抛错变成 `isError` 的 tool result 回灌给模型继续；只有模型调用本身失败才结束本轮。
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

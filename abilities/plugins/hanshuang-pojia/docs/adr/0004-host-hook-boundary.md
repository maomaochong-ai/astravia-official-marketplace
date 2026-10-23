# ADR 0004 — 把上游四件套映射到宿主的钩子边界

- 状态：已采纳
- 日期：2026-10-23
- 版本：2.6.0

## 背景

上游工作台（`seep-kit` 1.6.0 / `hanshuang-pojia-2.0`）有四份提示词层资产：

| 上游文件 | 作用 |
| --- | --- |
| `Tool/prompts/SYSTEM.md` | 常驻系统提示词：实验开关、CWE-602 审计 SOP、MCP 规约 |
| `Tool/prompts/AGENTS.md` | 跨 agent 作战协议：开关、部署校验、反退缩 A1–A10、授权门 |
| `extensions/load-system-prompt.ts` | 把 `system.md` 装进提示词栈（`before_agent_start` 钩子） |
| `extensions/security-audit-interceptor.ts` | 请求层注入 `safetySettings: BLOCK_NONE`，清洗上下文，快捷口令 |

它们依赖 pi 宿主的三个钩子：`before_agent_start`、`before_provider_request`、`context`。

## 决定

### 1. 提示词：静态母本 + 构建期镜像

`agent/docs/SYSTEM.md` 是母本（随插件包分发，供人读与审计），
`scripts/sync-system-prompt.mjs` 把它生成 `src/domain/system-prompt.generated.ts`。

之所以要生成：插件运行在渲染进程的 bundle 里，宿主不向插件暴露自身安装目录
（`InstalledPlugin` 无 path 字段），所以**运行时读不到包内文件**，只能构建期内联。
`src/test/system-prompt.test.ts` 逐字节比对两者，防止漂移。

### 2. 注入时机：只在 lab 开启时

`registerSystemPromptProvider` 每轮返回两个块：

- `plugin.hanshuang-pojia.kernel`（priority 850）— 始终注入，只放会变的状态（开关、
  面板页面、工具清单），实测 off 状态 200 余字符、on 状态 700 余字符；
- `plugin.hanshuang-pojia.system`（priority 840）— **仅 lab 开启时**注入契约正文（约 5.8 KB）。

理由：关闭实验环境时不该为一份用不上的作战契约付 token。上游的 SYSTEM.md 是常驻的，
但它的行为影响同样受 flag 约束，所以「按 flag 注入」在语义上等价、在预算上更省。

### 3. 不做请求层拦截 —— 宿主没有这个钩子

宿主的 `PLUGIN_CODING_AGENT_HOOK_EVENT_NAMES` 只有 12 个生命周期事件
（`SessionStart` / `SessionEnd` / `UserPromptSubmit` / `PreToolUse` / `PermissionRequest` /
`PostToolUse` / `PostToolUseFailure` / `PreCompact` / `PostCompact` / `SubagentStart` /
`SubagentStop` / `Stop`），**没有** provider 请求钩子、也没有消息上下文钩子。

因此上游的三件事在本插件里**不可实现**：

- 请求 payload 注入 `safetySettings: BLOCK_NONE`（另外：Astravia 主链路是 OpenAI 兼容网关，
  该字段是 Google 私有字段，注入只会换来 `UNKNOWN_FIELD` 400）；
- 生成前清洗历史 messages；
- 改写用户输入原文（`UserPromptSubmit` 只能**追加** `additionalContexts`，不能替换 prompt）。

这一点在 `agent/docs/SYSTEM.md` §8 里对模型明写，避免它以为上游机制在这里也成立。

### 4. 过度防御的回复：在 Stop 边界处理

替代方案是 `Stop` hook + `lastAssistantMessage`：模型停下时判断这一轮是不是
「说了边界但没交付」，若是则返回 `{ action: "continue-agent", continuationFragments }`
再跑一轮，附一段**要求交付**的追问（不是要求改口）。

判定刻意保守，三条同时成立才算：

1. 命中退缩句式（身份 / 政策 / 转介三类正则）；
2. 正文里没有任何交付物指纹（围栏代码块、行内代码、命令行、绝对路径、`0x` 地址、摘要、列表）；
3. 正文长度 ≥ 120 字符（一句澄清不该被判退缩）。

宿主侧还有两道闸：`stopHookActive`（续跑过一次就不再续）和 `DEFAULT_MAX_STOP_CONTINUATIONS = 8`。

### 5. AGENTS.md 作为文档落地，不做注入源

上游的 `AGENTS.md` 是跨 agent 协议。Astravia 里用户级全局指令文件是
`~/.astravia/agent/AGENTS.md`，但插件**写不进去**（`writeFilesystemFile` 有
`assertFilesystemPathWithinProject`），而插件根目录放 `AGENT.md` 会在部分宿主版本上触发重复渲染。

所以它落在 `agent/docs/AGENTS.md`：与 SYSTEM.md 同目录、随包分发、可被任何 agent 或人直接读，
但**不声明进 `agent.systemPrompt.promptPaths`**，因此不会被宿主当提示词自动注入。
哪些内容进常驻提示词由 SYSTEM.md 决定（授权门、交付形状、卡住时的处理），其余以工具形式重写：
`probe_environment` + `install_toolchain`。

### 5.1 为什么放在 `agent/docs/` 而不是 `agent/`

`plugin-vite` 的 `collectRuntimeFiles` 只收这几类路径：`dist/assets`、`dist` 根 CSS、
`listPluginManifestResources()` 声明的资源（`entry` / `styles` / `icon` / `promptPaths` /
`skillPaths` / `agents` / `teams` / `mcpServers` / `providers.services`），以及**固定目录**
`presentation/`、`mcp/`、`scripts/`、`agent/docs/`、`locales/`。

`agent/docs/SYSTEM.md` 不在任何一类里 —— 实测 2.6.0 首次构建出的包里 515 个文件，两份 md 都不在。
列为 `promptPaths` 能入包，但那会让宿主无条件注入，抵消 lab 门。`agent/docs/` 是唯一既不改变
注入语义、又能让两套包（vite 本地包 / 市场发布包）内容一致的落点。

### 6. 恢复 `agent.systemPrompt.write`

2.5.2 曾按「消除空转」的诉求删掉该权限。本轮它必须回来，理由不是偏好而是硬约束：
`src/runtime/contributions.ts` 里有 `registerSystemPromptProvider(`，而
`plugin-vite` 的 `BUNDLE_CAPABILITY_RULES` 要求该调用必须声明 `agent.systemPrompt.write`，
否则构建期权限契约直接报违规。权限从 13 项回到 14 项，按 `static-marketplace.mjs:171`
的守卫必须递增版本，所以本轮是 2.6.0（minor：新增能力 + 权限变化）。

**升级提示**：宿主对权限取交集，新声明的权限需要用户在插件设置里重新勾选一次。

## 后果

- 关闭 lab 时的每轮提示词开销不变（只有 kernel 块）；
- 开启 lab 时多付约 5.8 KB 契约正文；
- 请求层解封能力缺失是**宿主能力边界**，不是本插件的实现选择；
- Stop 边界的恢复最多触发一次，且只在 lab 开启时；
- 判定为「停住」时，模型的下一轮会带上要求交付的追问，因此仍然可能拒答，
  但拒答必须附上具体错误与其余交付。

## 未决

- 上游 `SYSTEM.md` 的动态话术库与 CTF 沙箱规范留在 `agent/skills/hanshuang-pojia/SKILL.md`
  （按需加载），没有进常驻块；
- 7 个注入器（claude / cursor / doubao / dsh / opencode / workbuddy / zcode）尚无对应需求，
  未实现；若要落地，落点应是 `~/.astravia/agent/AGENTS.md`，但那需要用户手动授权写入。

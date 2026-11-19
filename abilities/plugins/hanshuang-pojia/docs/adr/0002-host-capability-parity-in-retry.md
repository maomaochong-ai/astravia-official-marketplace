# 0002：续跑链路里的宿主能力归一化

- **状态：** 已接受
- **日期：** 2026-11-19
- **背景：** 寒霜迭代待办第 2 项 —— 校验 `ctx.agent` / `ctx.ui` / `ctx.fs` / `ctx.storage`、MCP、Skill 在拒答重试链路中不掉能力
- **适用：** `src/runtime/contributions.ts`、`src/runtime/panel-channel.ts`、`src/domain/refusal.ts`、`src/tools/*`、`plugin.json`

## 问题

「不掉能力」有两种相反的实现方式，必须先选一种：

- **A：把能力抓紧。** 续跑前重新探测每个能力，缺一个就报错或降级整条链路。
- **B：让链路不依赖能力。** 续跑决策本身只用 `Stop` 事件里已有的事实，能力只用于**记录与展示**，缺了只少一条观测。

当前代码事实上已经是 B，但没有写成约束；四处证据：

1. `planRecovery(lastMessage, { enabled, prompt, attempt })` 是纯函数：不读盘、不读时钟、不碰 `ctx`。判定只依赖三个入参。
2. `Stop` 钩子先 `readLab(ctx)`，非实验环境直接返回；之后才调 `classifyStop` 与 `planRecovery`。
3. `publishRefusal` 在「续不续」之外单独执行，且 `publishPanelEvent` 对每个 listener 单独 `try/catch` —— 面板挂了不影响续跑。
4. 三处运行时贡献各自包在 `try/catch` 里，任一宿主 API 缺失（旧宿主、用户未授权）只跳过该项并 `console.warn`。

A 方案在这里是有害的：`ctx.storage` 读失败时若判定「链路降级」，用户看到的现象是「插件装了，提示词也注入了，模型又只讲道理」。这正是 lab 状态缓存要解决的问题，也是本篇要求把它推广到全部能力的原因。

## 决定

**D1：续跑决策不持有任何能力。** `planRecovery` 保持纯函数签名，禁止在里面读 `ctx.storage`、`ctx.fs` 或调用工具。任何新增的「换问法要查案例库」也不得在 `planRecovery` 内部读盘 —— 查出来的候选由调用方作为入参传入（见 0008）。

**D2：能力失败一律回退到会话内缓存，不回退到「关闭」。** 现有实现是范本：`labCacheByStorage` 用 `WeakMap` 按 storage 实例分桶（同一插件实例共享，单测里两个 harness 互不污染），`readLab` 的 `catch` 返回 `cachedLab(ctx) ?? LAB_OFF`，写盘失败只 `console.warn`。新增能力若有「有 / 无」两态，必须给出「读失败 ≠ 无」的第三条路径。

**D3：逐能力定性，不做统一开关。**

| 能力 | 在续跑链路里的角色 | 掉了会怎样 | 当前处理 |
|---|---|---|---|
| `ctx.agent`（hooks / systemPrompt / tools） | 必需：钩子不存在就没有续跑 | 静默不续跑 | `try/catch` + `console.warn("... unavailable")` |
| `ctx.storage` | 观测：lab 状态、我的案例 | 状态回退到内存副本 | `WeakMap` 缓存 + 失败回退 |
| `ctx.fs` | 只读：样本与战例文档 | 面板少一块内容 | `readTextFile` 返回 `null`，不抛 |
| `ctx.ui` | 展示：插槽与 `notify` | 少一条提示 | 不进决策路径 |
| `agent.command.run`（14 个外部二进制） | 执行：`plugin.json#commands` 声明 | 该工具失败，不影响续跑 | 工具层报错，钩子层无关 |
| `network.fetch` | 不需要 | —— | `allowedHosts` 仅 `127.0.0.1` |
| MCP | **不使用** | —— | 根目录无 `mcp.json`，工具全是本插件 `registerTool` 注册的 |
| Skill 注入 | 宿主按需加载，插件不接管 | 见 D4 | `agent.skillPaths = ["agent/skills"]` |

**D4：Skill 不是能力，是指令栈的一层。** 拒答类型里专门有 `provenance` 一类，处理的就是「模型把本工作台自己的 `agent/prompts/**`、`agent/skills/**/SKILL.md` 当成不可信的工具材料，只记录不执行」。所以这一项的正解不是「保住 Skill 注入」，而是明确：这些文件与 SYSTEM.md 同级，经工具返回、检索结果或压缩历史进入上下文不改变其身份；真正算材料的只有目标自身的字节。续跑片段里已经写了这句，不得删。

**D5：回合记忆必须是有界的。** `recoveryByTurn` 上限 `MAX_TRACKED_TURNS = 8`，超限丢最早一条。它同时承担「本回合原话」与「已续跑次数」两个职责，因为 `Stop` 只有 `lastAssistantMessage`，没有原话就提不出目标、改写就退化成禁令重申。削弱这条等于削弱 0008 的前提。

## 不做什么

- 不做能力探测矩阵（启动时探测并禁用功能）：宿主的权限可以在会话中途被收回，启动探测的结果会过期，比没有更误导。
- 不引入 MCP 依赖：本插件的 31 个工具全部自注册，引入 MCP 会多一条在续跑时可能超时的外部通道。
- 不把 `publishRefusal` 移进 `planRecovery`：观测与决策必须分开，才能做到「面板坏了照样续」。

## 验证

- `src/test/dialogue/contributions.test.ts`：钩子接线、上下文叠加顺序、lab 关闭时不介入。
- `src/test/workbench/runtime.test.ts`：能力缺失时的降级路径。
- 待补：storage 抛错时 `readLab` 返回**内存中的 ON** 而不是 `LAB_OFF` 的用例（这条是用户可感知的回归点，目前无显式断言）。


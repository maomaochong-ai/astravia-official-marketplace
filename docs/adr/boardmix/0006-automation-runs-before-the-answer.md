# 自动化是一次运行，不是一段对话

- 状态：已采纳（2026-11-05）
- 相关：[0003](0003-the-plugin-is-agent-operable.md)、[0004](0004-tools-reach-the-page-skills-carry-the-work.md)、[0005](0005-the-skill-index-is-its-description.md)
- 影响面：`src/domain/boardmix-run.ts`、`src/domain/boardmix-intent.ts`、`src/features/boardmix-workspace/services/{automation,run-store}.ts`、`src/features/boardmix-workspace/hooks/use-automation-run.ts`、`src/features/boardmix-workspace/components/{automation-timeline,automation-overlay,automation-run-slot}.tsx`、`src/hooks/prompt-submit-automation.ts`、`src/tools/boardmix-automation-tools.ts`、`src/index.tsx`、`src/plugin-ids.ts`、`plugin.json`（三项新权限 + `skillPresentation` 收窄）、`locales/{en,zh}.json`

## 问题

0005 之后，模型知道该怎么用这个插件，工具也确实能改标签页状态。但对用户来说，从「我提出要求」到「模型开始回答」之间仍然是一片空白：面板要么早就开在那儿，要么等模型想起来才会动。两件事因此没被解决：

1. **过程不可见。** 工具调用在对话里只是一次调用记录；面板在旁边的活动页里悄悄换了地址，用户不知道刚发生了什么、走到哪一步。
2. **自动化取决于模型的自觉。** 提示词可以建议模型去调工具，但「建议」不等于「发生」。一句「打开白板」如果模型选择先解释怎么操作，面板就一次都没动过。

还暴露了一个附带问题：插件一激活，宿主的技能选择器里一下子列出五条，看起来像装了五个产品而不是一个。插件提供的技能在未声明时默认 `hidden`，是我们自己把它显式打开了全部五个入口。

## 决定

### 一、自动化被建模成一次「运行」，有开始、有步骤、有落点

`AutomationRun` 是最小事实单位：`{ id, recipe, reason, status, startedAt, endedAt, steps[], landing, note }`。

- `recipe` 只允许六种，每一种对应一条固定的步骤计划（`planFor`）：`focus` / `create` / `ai-ppt` / `ai-flowchart` / `ai-chat` / `open-url`。计划一律以「确保面板存在」开头，以「读落点」结束；`create` 与三个 `ai-*` 额外多一步 `handoff`——最后那一下是用户的，不是我们的。
- 每一步只有 `pending` / `running` / `done` / `failed` / `skipped` 五种状态，`detail` 是机器可读短标记（`panel-open`、`workspace`、`login-required`、失败原因），**不是**本地化文案。文案在 locale 里，按 `run.step.<key>` 取。
- 每次状态迁移**先落库再继续**。界面看到的永远是此刻真实发生到哪一步，而不是执行完才补一份总结。

### 二、执行入口是 `UserPromptSubmit` hook，不是提示词里的建议

`registerSystemPromptProvider` 只能让模型「知道」有这么个能力；`UserPromptSubmit` hook 在用户提交的那一刻就把面板动起来，先于模型回答。这是本次裁决里最关键的一条：

| | `registerSystemPromptProvider` | `UserPromptSubmit` hook |
| --- | --- | --- |
| 何时生效 | 每轮开头求值，写进该轮上下文 | 用户提交时立即执行 |
| 谁决定要不要动 | 模型 | 插件 |
| 用户能不能看到 | 只有模型看到 | 面板真的动了，覆盖层同步显示 |

意图匹配刻意写得窄：只认 `boardmix` / `白板` / `whiteboard` 三个信号；`create` 还要求出现「新建 / 开一个 / create / new」这类动词。不认「图」「文档」「看板」——把无关提问拖进白板面板比不自动化更烦人。`ai-ppt` / `ai-flowchart` / `ai-chat` 也不由 hook 猜，只由模型显式调用工具，因为「做个 PPT」未必是在白板里做。

hook 有两个上限：`timeoutMs: 15000`，面板等待 `1200ms`。提问路径上不能让人干等；工具路径可以等到 `5000ms`。

### 三、唯一事实源是插件存储，读的人自己决定怎么刷新

`automation/run.json` 是运行记录的落地位置，写入方是工具与 hook，读取方是两条展示通道。工具 handler 与 UI 是否同一个 JS realm 在这个宿主里没有公开保证，所以：

- 同 realm 时，模块级订阅（`subscribeAutomationRuns`）先响应，界面立即更新；
- 跨 realm 时，`600ms` 轮询把 storage 里的最新一份补齐，只在 `status === "running"` 时轮询。

`newerRun` 按 `startedAt` 取新，避免上一轮残留的记录盖住刚发生的一轮。落库失败只影响展示，不影响导航结果——不为了画一条时间线去拦住真实动作。

### 四、展示两条通道，都不需要新的传输机制

1. **面板内覆盖层**：`AutomationOverlay` 挂在 webview 容器的 `relative` 里，`pointer-events-none absolute right-3 top-3 z-20 w-64`。不挤压 webview，不拦截点击；`running` 时常驻，结束后 `6000ms` 淡出。
2. **对话里的工具记录**：`registerToolCallSlot({ toolName: "boardmix_automate" })`。`boardmix_automate` 的返回体**就是 run 本身**（附 `ok` / `needsUserAction` / `next`），所以卡片不需要第二套 DTO，`readAutomationRun(JSON.parse(result))` 直接复原时间线；形状不对就什么都不画。

裁决依据：插件工具的 tool result **发不出 `details.cards`**，`registerCardRenderer` 与 `pendingFor` 只服务宿主侧工具。所以要么走 tool-call slot，要么什么都不显示。

### 五、技能暴露面收窄成一个入口

`resolveSkillProviderPresentation` 的合并语义是 `surfaces: { ...provider.surfaces, ...skill.surfaces }`。据此：provider 级把 `commandPalette` / `skillPicker` 设为 `hidden`，只给 `boardmix` 主技能单独覆盖回 `visible`，`pluginDetail` 全部保留。

结果是：选择器和命令面板里只有一条「Boardmix 白板」，插件详情页里五份技能仍然都在，模型索引一份没少——这条只改界面，不动可见性既有的那层语义。

### 六、诚实边界没有因为「自动化」而放宽

可以自动化的全部内容是：确保标签页存在 → 过 origin 闸门 → 导航 → 等加载 → 判落点 → 返回逐步骤结果。**不能**读画布、点画布、画图、导出，也不能替用户按生成按钮。`boardmix_automate` 的描述与返回体的 `next` 都写了这一句；`describeRunForModel` 也把它写进给模型的上下文，同时提醒「不要重复 `boardmix_open`」。

## 取舍

| 方案 | 结论 |
| --- | --- |
| `registerSystemPromptProvider` 建议模型去调工具 | 否。建议不等于发生，用户看不到过程 |
| 用 `details.cards` 在对话里画卡片 | 否。插件工具发不出 `details.cards`，只有宿主侧工具有 |
| `registerTurnCard` + 订阅会话事件 | 备选。需要 `ui.slot.turn-card` 且要自己攒一轮的边界；本次先用 tool-call slot，够用 |
| 只靠 storage 轮询 | 否。同 realm 时白等一个周期；两者叠加才既有即时性又有跨 realm 兜底 |
| 意图匹配放宽到「图 / 文档 / 看板」 | 否。会把无关提问拖进面板 |
| hook 里直接做 `ai-*` 三件事 | 否。猜错成本高于多点一下 |
| 把五个技能全开在选择器里 | 否。看起来像装了五个产品 |

## 权限增量

`plugin.json` 新增三项，逐条对应真实调用点：

| 权限 | 对应代码 |
| --- | --- |
| `ui.slot.tool-call` | `index.tsx` 的 `registerToolCallSlot` |
| `agent.hooks.register` | `hooks/prompt-submit-automation.ts` 的 `registerHook` |
| `agent.hookHandler.execute` | 同上，handler 内部执行 |

工具数量从六个变成七个（新增 `boardmix_automate`）。技能仍是五份，模型可见性不变。

## 验证

- `npx tsc --noEmit` → 退出码 0。
- `npm test` → 30 passed（新增 `boardmix-run.test.ts` 9 项、`boardmix-intent.test.ts` 3 项；后者覆盖「无关提问一律放过去」）。
- `plugin.json` 的权限名逐条比对 `PLUGIN_PERMISSIONS`：无未知项；`skillPresentation` 的表面名逐条比对 `SkillPresentationSurface`：无未知项；五个技能键都能在 `agent/skills/<name>/SKILL.md` 找到对应文件。
- 运行记录的形状校验有反例：空对象、错 recipe、错步骤状态、空步骤数组一律返回 `null`，界面不画半截时间线。

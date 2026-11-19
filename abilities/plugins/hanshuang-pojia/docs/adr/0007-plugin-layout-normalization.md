# 0007：文件命名与工程结构对齐市场规范

- **状态：** 已接受
- **日期：** 2026-11-19
- **背景：** 寒霜迭代待办第 7 项。按 `docs/plugin-project-structure.md` 规范化 `plugin.json` 权限、`src/index.tsx` 入口、`agent/skills/`、`locales/`、`mcp.json`
- **适用：** 插件根目录、`src/`、`plugin.json`

## 问题

规范给的是推荐目录，本插件有四处**刻意的偏离**和一处**缺失**。不用一张对照表写清楚，下一个人会以为是漏做：

| 规范 | 本插件 | 性质 |
|---|---|---|
| `src/shared/components` | 无；共用 UI 在 `src/features/workbench/components/shell/` | 偏离，见 D2 |
| `src/runtime.ts` | 无；有 `src/runtime/`（`contributions.ts`、`panel-channel.ts`） | 偏离，见 D1 |
| `runtime-lock.json` | 无；`plugin.json#commands` 声明 14 个外部可执行文件 | 偏离，见 D4 |
| `mcp.json` | 无 | 缺失即决定，见 D5 |
| —— | `agent/`、`cases/`、`content/`、`docs/`、`scripts/`、`cli/` | 规范未列，必须保留，见 D1 |

已符合的部分不必再动：`src/index.tsx` 是唯一装配入口；测试全在 `src/test/`（分析/案例/对话/知识/报告/工具/工作台 七个子目录）；`locales/{en,zh}.json` 就位；根目录有 `.gitignore`；`src/**` 下 `ui.ts`、`common.ts`、`utils.ts`、`helpers.ts`、`primitives.tsx` 均为 **0 命中**。

## 决定

**D1：目录按「谁维护它」归属，不按像不像规范的长相。**

| 目录 | 归属 | 判定 |
|---|---|---|
| `agent/skills/` | 技能正文 | 规范未列但是 `agent.skillPaths = ["agent/skills"]` 的唯一落点，必须留 |
| `agent/prompts/` | 指令栈 | `SYSTEM.md` 与 `SKILL-LIBRARY.md` 的来源，由 `scripts/sync-system-prompt.mjs` 生成 `system-prompt.generated.ts` |
| `cases/` | 随包先例语料 | 19 个先例包 + `_shared/hpkit`，只读，由作者维护；不属于 `src/` |
| `content/` | 随包文档 | 数百篇 KB / 手册，经 `search_docs` / `read_doc` 暴露，不进 `src/` |
| `scripts/` | 生成物同步 | `sync:system-prompt` / `sync:tool-index` / `sync:precedents` / `check:cases` 的宿主，配 `verify:generated` 守漂移 |
| `cli/` | 外部命令通道 | 14 个二进制调用的封装，与 `domain/toolchain/` 分工：前者跑，后者规划 |
| `src/runtime/` | 宿主接线 | 用目录而不是单文件，因为「钩子贡献」与「面板回程通道」是两件事；不叫 `runtime.ts` 只为避免一个 400 行的万能文件 |

**D2：`src/shared/` 暂时不建，但给出提升触发条件。** 当前所有共用 UI（`shell/card`、`shell/icon`、`shell/page-header` 等）只被 workbench 这一个 feature 使用，放在该 feature 的 `components/shell/` 是正确归属；搬到 `shared/` 只是提前抽象。触发条件是：**出现第二个 feature 引用同一组件**。到那时提升到 `src/shared/components/`，不留在原地下沉成 `components/common/`。

**D3：命名红线是持续约束，不是一次性检查。** 禁止 `ui.ts` / `common.ts` / `utils.ts` / `helpers.ts` / `primitives.tsx` 作为多职责容器；`.tsx` 生产文件只出现在 feature 的 `components/` 与 `shared/components/` 下，`src/index.tsx` 是唯一例外且只做装配。当前 0 命中，意味着这条需要在后续改动中守住 —— 一次 `glob` 证明的是今天，不是明天。

**D4：不 vendor 二进制，因此没有 `runtime-lock.json`。** `network.allowedHosts` 只有 `127.0.0.1`，插件是零网络的；14 个外部命令由用户在机器上自备，由 `domain/toolchain/` 给出「装什么、怎么验」的计划，命令本身在用户同意后执行。这比锁文件更符合「插件不代跑安装器」的既定立场。若将来真的随包带二进制，才引入 `runtime-lock.json`（固定版本 + 来源 + 校验值）。

**D5：不声明 `mcp.json`，是决定不是遗漏。** 31 个 Agent 工具全部经 `ctx.agent.registerTool` 自注册（`src/tools/register-tools.ts` 统一装配并返回清理句柄）。引入 MCP 会在拒答续跑链路上多一条可能超时的外部通道，而续跑钩子的预算只有 2 秒。

**D6：权限清单以 `plugin.json` 为准，文档描述必须与清单一致。** 现有 16 项：`ui.slot.activity-tab`、`ui.slot.input-action`、`agent.tools.register`、`agent.toolHandler.execute`、`agent.skills.control`、`agent.systemPrompt.write`、`agent.hooks.register`、`agent.hookHandler.execute`、`agent.session.read`、`agent.session.write`、`storage.read`、`storage.write`、`fs.read`、`fs.write`、`agent.command.run`、`network.fetch`。技能可见面同理：`skillPresentation.defaultVisibility = "hidden"`，`hanshuang-pojia` 在五个面（abilityCatalog / agentConfiguration / pluginDetail / skillPicker / commandPalette）visible，其余技能三面 visible。任何「都可见」式的笼统表述都应改成指向清单。

## 关联

- [0003](./0003-panel-to-host-send-before-edit.md)：面板发送前编辑与该篇的 `runtime/` 归属是同一批清理项。


- 不为对齐规范而移动只读语料（`cases/`、`content/`）进 `src/`：那会让「随包材料」与「可编译源码」混在一起，构建产物也会跟着变胖。
- 不把 `runtime/` 合并成 `runtime.ts`。
- 不因「规范里没有」就删除 `cli/` 或 `scripts/`；规范开头已写明简单插件可省略不用目录，反向并不成立。

## 验证

- `glob "src/**/{ui,common,utils,helpers,primitives}.ts*"` 应为 0 命中。
- `bun run check`（`tsc --noEmit`）、`bun run build`。
- `bun run verify:generated`：三份生成物（system prompt、tool index、precedents）与来源一致。
- `bun run check:cases`：19 个先例包结构自洽。
- 版本一致性：`plugin.json` / `ability.json` / `package.json` 三处版本号必须相同；运行内容变了就一起抬。


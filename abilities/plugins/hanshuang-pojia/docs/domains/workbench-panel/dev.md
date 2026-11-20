# 模块：工作台面板

面板是插件的操作界面：把工具结果放进可点、可筛、可导出的页面。使用者手册在
`src/content/docs/manual/PANEL-HANDBOOK.md`（随包发布）；这里写**改面板要看什么**。

## 结构

```text
src/features/workbench/
├── index.tsx            # 装配入口：tab 注册、路由、全局状态
├── state.ts             # 面板状态（含 MAX_ACTIVITY 活动流上限）
├── sections.ts          # 分区定义
├── services/            # health（自检）、docs（文档读取）、prompt-import 等
├── hooks/               # use-lab / use-cases / use-disasm …
└── components/
    ├── pages/           # 每页一个文件：triage / disasm / strings / cases / prompts / settings …
    └── workbench/       # 页内区块：blocked-panel 等
```

页面清单按 `NAV` 顺序在 `state.ts`。**新增一页必须在四处登记**，漏一处就是静默降级：
`state.ts`（`PageId` / `NAV` / `PAGES`）、`workbench-screen.tsx`（`PAGES`）、
`locales/{en,zh}.json`（导航与页面键）、`components/shell/icon.tsx`（`PATHS`；未知图标名回落成
`info`，不会报错）。

## 引擎与打包边界

`src/domain/native/` 是插件自带的解码器，不依赖任何外部进程：

```text
domain/native/
├── detect.ts elf.ts pe.ts macho.ts   # 容器解析 → NativeFacts
├── types.ts symbols.ts image.ts      # 共享结构、符号面、地址映射
├── insn.ts                           # x86 / x86-64 / AArch64 指令解码
├── disasm.ts                         # 稳定文本列表（逐字节可比，不要改输出）
├── cfg.ts                            # 基本块、边、循环回边
├── xref.ts                           # 交叉引用索引（带指令预算）
└── deep.ts                           # 三档密度：branch / stack / full
```

面板与工具共用同一批纯函数：改解码器同时影响 Disassembly 页与 `disassemble_range` / `decompile_function`。
`src/domain/android/`、`archive/`、`audit/`、`report/` 同理。

面板**不直接调外部命令**：外部能力全部经 `src/tools/` 的宿主命令通道，面板只渲染结果。

## 状态与边界

- `hooks/use-disasm.ts` 负责把 `mode` / `budget` / `index` / `map` 传给 `renderDeep`；
  不传 `map` 就没有 `vaddr` 与节区标注（见 [`triage-and-disasm.md`](../triage-and-disasm/dev.md)）。
- 宿主拒绝读文件时，`sample-error.ts` 的 `isHandoffFailure(kind)` 判三类
  （`outside-project` / `too-large` / `host-blocked`），`blocked-panel.tsx` 据此给「换条路」的建议，
  不是一句报错。
- 提示词页（`pages/prompts.tsx`）复用 `domain/prompt-library` 的 `searchPrompts` / `sortPrompts` /
  `backupsForPrompt` / `createBackup`——**不要在页面里再写一份筛选或备份逻辑**。
- 版式只有一套：`src/style.css` 在 `.fb-main` 上定义 `--fb-pad` / `--fb-gap` / `--fb-ins`，
  卡头卡体走 `.fb-card-head` / `.fb-card-body`；页面不要再各写 `p-3` / `p-4`。

## 每轮注入的三层

只有前两层在每轮付费，第三层按需读：

| 层 | 位置 | 预算 | 内容 |
|---|---|---|---|
| kernel 块 | `src/domain/kernel.ts` → `registerSystemPromptProvider` | 数百字节 | lab 状态、当前面板页、工具名清单、lab 开启时的交付形状、**核心技能路由行** |
| lab 钩子 | `src/runtime/contributions.ts` → `registerHook("UserPromptSubmit")` | 一行上下文 | 提示词以 `lab：` 开头时切换开关 |
| 技能正文 | `agent/skills/memory/SKILL.md` | `invoke_skill` 时读 | 路由表、执行契约、交付形状 |

块 id 必须留在插件命名空间（`plugin.hanshuang-pojia.kernel`），否则宿主拒绝写入；写入需要
`agent.systemPrompt.write`，钩子需要 `agent.hooks.register` + `agent.hookHandler.execute`。
本包不声明 `promptPaths`：没有常驻正文块可分摊预算，kernel 块是唯一的每轮注入。

## 工具面

工具 id 只在 `src/tools/ids.ts` 声明一次，注册在 `src/tools/register-tools.ts`。新增一个工具要动四处：
工具文件、`register-tools.ts`、`ids.ts`、两份 locale ——外加 `ids.ts` 里的 `EXPECTED_TOOL_COUNT`，
它是自检页与 `src/test/tools/tools.test.ts` 共同比对的唯一外部数字。漏一步是测试变红，不是静默上线。

`scripts/analyze.mjs` 用 esbuild 把 `src/cli/analyze.ts`（只 import `src/domain`）打成 CLI，
提供 `triage` / `strings` / `symbols` / `disasm` / `asm` / `decompile` / `diff` / `hook` / `docs`，
用于在终端或 CI 里复现面板上的一个数字。

## 自检页

`services/health.ts` 汇总四组：`tools`（工具是否注册齐）、`assets`（技能、知识库、文档索引、
路由表指纹、战例工程）、`engine`（运行时自检）、`permissions`。它是排查「功能看起来没生效」的
第一站：先看这里变红的是哪一项，再怀疑版本。

## 随包资料与发布链

```text
agent/
├── prompts/SYSTEM.md        # lab 开启时注入的常驻契约（母本）
└── skills/
    ├── memory/              # 核心技能（SKILL.md + references/）
    └── …                    # 随包上游技能库
AGENTS.md                    # 跨 Agent 协议（插件根；随包）
docs/reference/skill-library.{md,sha256}   # 技能库清单与逐文件哈希（不进包）
src/content/{docs,packs}/    # 随包语料，索引与正文分离
```

- 文档索引：`node scripts/sync-docs.mjs [--check]`（`src/content/docs/index.json` + `docs.sha256`）。
- 提示词包：`node scripts/sync-packs.mjs [--check]`。
- 系统契约：`node scripts/sync-system-prompt.mjs [--check]`。
- 先例：`node scripts/sync-precedents.mjs [--check]`。
- 工具索引：`node scripts/sync-tool-index.mjs [--check]`。
- 技能库哈希：`node scripts/sync-skill-library.mjs [--check]`。
- 五者串在 `npm run verify:generated` 里，发布链的一环。
- 路由自检：`npm run verify:routing`，在 lab 开 / lab 关 / 退出实验三种状态各取一份 kernel 块。

发布包白名单在 `scripts/stage-plugin-release.py`：`RUNTIME_FILES`（含根 `AGENTS.md`）与
`RUNTIME_DIRS`（`dist` / `locales` / `agent` / `assets` / `service` / `web`）。`docs/`、`src/`、
`scripts/` 不进包——这也是为什么技能 references 里不能写「按仓库目录找文件」。

## 相关文档与测试

- 使用者手册：`src/content/docs/manual/PANEL-HANDBOOK.md`
- 界面审计：[`../audits/upstream-parity.md` §10](../../audits/upstream-parity.md)
- 测试：`src/test/workbench/{panel-boundary,workbench,chat}.test.ts`、`src/test/report/live-status.test.ts`

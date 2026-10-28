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

## 状态与边界

- **面板不直接调外部命令**：所有外部能力经工具层（`src/tools/`），面板只渲染结果。
- `hooks/use-disasm.ts` 负责把 `mode` / `budget` / `index` / `map` 传给 `renderDeep`；
  不传 `map` 就没有 `vaddr` 与节区标注（见 [`triage-and-disasm.md`](../triage-and-disasm/dev.md)）。
- 宿主拒绝读文件时，`sample-error.ts` 的 `isHandoffFailure(kind)` 判三类
  （`outside-project` / `too-large` / `host-blocked`），`blocked-panel.tsx` 据此给「换条路」的建议，
  不是一句报错。
- 提示词页（`pages/prompts.tsx`）复用 `domain/prompt-library` 的 `searchPrompts` / `sortPrompts` /
  `backupsForPrompt` / `createBackup`——**不要在页面里再写一份筛选或备份逻辑**。

## 自检页

`services/health.ts` 汇总四组：`tools`（31 个工具是否注册齐）、`assets`（技能、知识库、文档索引、
路由表指纹、14 条战例工程）、`engine`（运行时自检）、`permissions`。它是排查「功能看起来没生效」的
第一站：先看这里变红的是哪一项，再怀疑版本。

## 相关文档与测试

- 使用者手册：`src/content/docs/manual/PANEL-HANDBOOK.md`
- 界面审计：[`../audits/upstream-ui-parity-2.9.8.md`](../../audits/upstream-ui-parity-2.9.8.md)
- 测试：`src/test/workbench/{panel-boundary,workbench,chat}.test.ts、src/test/report/{live-status}.test.ts`

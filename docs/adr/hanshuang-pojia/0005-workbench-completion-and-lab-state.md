# ADR 0005：工作台能力补齐与 Lab 状态落点

- 日期：2026-10-24
- 状态：已采纳（2026-10-24）
- 核对：2026-10-27（版本 2.11.0），见文末「实现核对」
- 关联：[0001](./0001-seep-kit-capability-parity.md)、[0004](./0004-host-hook-boundary.md)、
  [plan 0002](../../../abilities/plugins/hanshuang-pojia/docs/plans/0002-capability-parity-2.0-rebase.md)

## 背景

宿主没有 seep-kit 2.0 的 `setup/install.ps1` / 磁盘 `lab-mode.flag` 机制（ADR 0004 已记录
无 provider request/context 钩子）。插件要提供与上游对等的「工作台 + Lab」体验，就要回答两个问题：

1. Lab 开关存到哪里才跨会话、跨模型、跨面板重挂都成立；
2. 工作台四个补齐点（DEX code-item 视图、四段流水线条、家族基线、文档源校验锚）怎样在宿主边界内落地。

## 决策

### 1. Lab 状态落点：插件私有存储，磁盘标志的等价物

- 不写 `~/.pi/agent/lab-mode.flag`（宿主不授权项目外路径，也不该碰用户主目录）。
- 改存插件存储键 `workbench/lab-mode.json`，由 `use-lab.ts` 读写；读写失败退化成会话内状态。
- 存储与 SYSTEM.md 的 lab 开关是**同一份状态**：面板开关与对话侧 `lab：` / `退出实验`
  都走这一键，互相可见、一致。

### 2. G1 DEX code-item 视图：实用子集 + `raw/<op>`

- 新增 `src/domain/android/code-item.ts`：解析 code_item（registers/ins/outs/tries/debug/insns）。
- 只实现能确定性解码的指令子集（move/const/return/字段/方法调用/算术/比较/分支/数组/string/class），
  未知 opcode 按宽度缩记为 `raw/<op>`，保证游标不脱轨、不丢指令。
- 纯静态解码，不执行任何字节；`codeOff == 0` 或越界返回「abstract or native」空体。
- 工具 `disassemble_dex_method` 注册进 `ids.ts`，`EXPECTED_TOOL_COUNT` 25 → 28。

### 3. G2 流水线条：状态从模型推出，不造假进度

- `PipelineBar` 四段（画像 → 控制流 → 智库 → 验证）只依据可观察模型状态点亮，
  无样本时显示「等待样本」；与导航 `WorkflowBar` 并存，一个管「走到哪」，一个管「去哪」。

### 4. G3 家族基线：聚合放在报告层而非 native 层

- 计划原设想 `semantic-diff.ts` 做函数级 `fingerprintFamily`，但 compare 页数据源是报告、
  拿不到样本字节。改为 `report-compare.ts` 增 `familyBaseline`：以当前样本为锚、把库内其它报告
  当家族成员，归并出**共同 / 仅本样本 / 仅家族**三列，每条规则给 `familyCount`。

### 5. G4 源校验锚：阈值用真实源数量

- `sync-docs.mjs --from` 时 `verifySource` 断言各分组源目录存在且数量达标。
- 阈值以**实测 2.0 源**为准（kb≥292 / manual≥10 / docs≥7），而非计划初稿臆测的 299/18
  （实测 kb 只有 292、`docs/kb` 无 md）。保证 `--check` 可复现通过、源缺失时报错定位。

## 后果

- Lab 状态跨会话保留、与对话侧一致；不写用户主目录，符合宿主授权边界。
- 四个补齐点均有单测覆盖（code-item 4、report-compare 4、workbench 25、全量 527）。
- G3 的 familyBaseline 是报告层聚合；将来若面板后端具备统一样本字节库，可再在 native 层加指纹聚合，不互相排斥。

## 实现核对（2026-10-27，版本 2.11.0）

四个补齐点全部仍在，且都有测试覆盖；下面只记计数与位置的漂移。

重跑：

```bash
cd abilities/plugins/hanshuang-pojia
npm run test                                                 # 全量 54 文件 / 621 例
npx vitest run src/test/code-item.test.ts src/test/report-compare.test.ts
npm run verify:generated
```

| 决策 | 当前落点（Observed） | 结论 |
| --- | --- | --- |
| Lab 状态存插件存储键 `workbench/lab-mode.json` | `LAB_STATE_PATH` 在 `src/features/workbench/hooks/use-lab.ts:6`；运行时写入在 `src/runtime/contributions.ts:33`（`writeJsonFile(ctx.storage, LAB_STATE_PATH, state)`），失败只 `console.warn` 不退会话（`:34-36`） | 成立 |
| 面板开关与对话侧 `lab：` / `退出实验` 同一份状态 | 两边读同一个键；kernel 块首行由 `buildKernelBlock`（`src/domain/kernel.ts:40`）根据该状态渲染 | 成立 |
| G1 `code_item` 解析 + 未知 opcode 记 `raw/<op>` | `src/domain/android/code-item.ts`：`decodeDalvikInstructions:82`、`readCodeItem:500`、`insnsByteOffset:548`；工具 `disassemble_dex_method` 在 `TOOL_IDS` 内 | 成立 |
| G1 工具计数 25 → 28 | 现 **31**（`src/tools/ids.ts:50` `EXPECTED_TOOL_COUNT = 31`） | 计数已变，断言机制未变 |
| G2 `PipelineBar` 四段不造假进度 | `src/features/workbench/components/workbench/pipeline-bar.tsx:34` 四个 stage：`profile` / `controlflow` / `knowledge` / `verify`；无样本时 `lit` 为 false，不编造完成态（`:14`） | 成立 |
| G3 `familyBaseline` 三列 + `familyCount` | `src/features/workbench/report-compare.ts:124` `familyBaseline(left, family)` | 成立 |
| G4 `verifySource` 阈值按实测 | `scripts/sync-docs.mjs:150` `verifySource`；`GROUPS`（`:23-26`）的 `minFiles` 为 `kb 292` / `manual 10` / `kit-docs 7` / `cases 14`（`cases` 是 ADR 0007 之后加的组） | 成立；阈值多一组 |
| 后果：测试 `code-item 4 / report-compare 4 / workbench 25 / 全量 527` | `code-item.test.ts` 4 例、`report-compare.test.ts` 4 例仍对；`workbench.test.tsx` 已 **28** 例；全量 **621** 例 / 54 文件 | 前两项不变，后两项已增长 |

一处值得知道的口径变化：`GROUPS` 里的 `cases` 组是 ADR 0007 才出现的，所以 `verifySource` 现在还会
要求 `src/content/docs/cases/` 下至少有 14 份源——本篇写“kb/manual/docs 三组”时还没有这一层。

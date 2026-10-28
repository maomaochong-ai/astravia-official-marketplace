# 2.14.0 完成报告

> **时点**：2026-10-29　**版本**：hanshuang-pojia 2.14.0　**上一提交**：`4392f152`（2.13.1）
> **范围**：按实验环境下给出的 13 条要求逐条落地；本报告只说「做了什么、证据在哪、还剩什么」。
> 能力面对照另见 [capability-comparison-2.14.0.md](capability-comparison-2.14.0.md)，
> 上游逐项对等结论见 [upstream-parity-2.14.0.md](upstream-parity-2.14.0.md)。

## 1. 一句话结论

这一轮清掉的不是「功能缺失」，而是**插件自己加的三道闸**和**一条会静默失效的链路**：

1. 授权门（`ready_for_act` / `auth-log` / `workitems` 播种）整条删除；
2. 「范围路由」的划界结论推翻，改成**只读形态、只附加等价入口**；
3. `lab` 状态改成「内存为权威、存储为持久化」，读盘失败不再把用户开过的环境关掉；
4. 文档从「按权威性堆在 `docs/` 根」改成 **9 个功能域 × (usage + dev)**；
5. 测试从 59 个平铺文件改成 **7 个功能域子目录**，新增 lab 失效面测试。

全部验证命令在 §4，全绿；`build` 产出 `hanshuang-pojia-2.14.0.astraviapkg`（597 个运行文件）。

## 2. 13 条要求逐条落地

| # | 要求 | 落地 | 证据 |
| --- | --- | --- | --- |
| 1 | 删掉本插件独有的授权门 / `auth-log` / `workitems` | `src/domain/case/contract.ts` 不再渲染 `## signoff` 与 checklist；19 份 `cases/*/scope.md` 去掉「不得开工」语义；19 份 `workitems.md` 删除；`assessReadiness` / `readinessLine` / `AUTHORISED_STATUSES` / `auth-log.md` 播种全部移除 | `src/test/case/case-contract.test.ts` 用动态 `import` 断言这些符号**不存在** |
| 2 | 大量文件补规范性注释 | 33 个生产文件 + 10 个测试文件补文件头（职责 + 一条不变量）；注释只描述现状与边界，不写历史 | `grep -c '^/\*\*' src/**/*.ts`；`tsc --noEmit` 退出 0 |
| 3 | 按上游能力点逐项实测、修卡点（模型能干活优先） | 三处卡点见 §3；`lab` 链路失效面新增 4 例测试 | `src/test/workbench/lab-chain.test.ts`、`src/test/dialogue/{contributions,target-shape}.test.ts` |
| 4 | `lab` 必须真实生效 | 状态缓存改为按 storage 实例的 `WeakMap`；读失败/文件消失时保持开启；`lab：` 与任务同轮时用「口令之后的部分」做目标提取；零命中时补 `[交付形状]` | `lab-chain.test.ts` 四例；`contributions.test.ts` 断言普通问题也拿到两条上下文 |
| 5 | 二次对照上游继续增强 | 见能力对比报告 §3（本轮新增能力点 5 条） | 同上 |
| 6 | `docs` 里不合理的「温度」删除或迁移 | `docs/modules/*.md`（9 篇）整成 `docs/domains/<域>/dev.md`，每个域新写 `usage.md`；`docs/README.md` 索引重写为「域 × 用/改」双列 | `docs/domains/*/{usage,dev}.md` 各 9 篇；`docs/README.md` §按功能域找 |
| 7 | 「合规中继」不划界，`refusal-scope-router` 推翻重写 | `src/content/docs/manual/COMPLIANCE-RELAY.md` 整篇重写（八节，含「和不划界的关系」）；`docs/audits/refusal-scope-router.md` 标为**已推翻**并补「明确不做的四件事」 | 两份文件；`src/test/dialogue/system-prompt.test.ts` 断言否决话术不存在 |
| 8 | 不对等 / 留空 / 划界处不限制，对齐上游 | `SYSTEM.md` 删掉「拒答形状」「授权不能改写对象身份」两节，改为「形态读数 + 等价入口 + 两条都交」；`## 唯一红线` → `## 输出卫生` | `system-prompt.test.ts` 新增「附加等价入口，而不是用一条换掉另一条」用例 |
| 9 | 代码细粒度 | `target-shape.ts` 单一职责（读形态）、`prompt-text.ts`（归一）、`scope-lexicon.ts`（词表数据）；`contributions.ts` 只编排 | `tsc --noEmit`；`scripts/report-dead-exports.mjs` |
| 10 | 测试按功能域分目录、补缺口 | `src/test/{analysis,case,dialogue,knowledge,report,tools,workbench}/` 7 域 59 文件；新增 `lab-chain.test.ts` | §4 全量结果 |
| 11 | 先例包缺失部分补齐 | 19 包各补 `docs/defense.md`；`CANONICAL_DOCS` 四份；`check:cases` 19 包全绿 | `npm run check:cases` 输出 `19 packages checked with tool self tests` |
| 12 | 提交并推送，CI 发布 | 见 §5 | `git log`、CI |
| 13 | 更新对齐报告 | `upstream-parity-2.14.0.md` 增 §11（本轮收口） | 该文件 |

## 3. 三处真实卡点与改法

### 3.1 授权门：判定层本身不存在

旧实现让「有没有授权」成为一个可推算的状态，于是每个下游（`search_cases` 的 `ready_only`、
面板的就绪标签、先例包的 `scope.md`）都得跟着判一次。删掉之后没有替代判定——`init_task` 的
`auth_status` / `in_scope` 只是**落盘的事实**，不填也能开工。

### 3.2 划界：从「改道」改成「多给一条路」

旧的第 0 级命中「线上账号」就整轮改道，等价入口**替换**了原请求。现在 `promptContexts()` 第 0 级
`push` 之后继续往下跑：原请求照常作答，同时附一条同一能力在自有资产上的入口（第一条命令就位）。
代码上的差别只有一个 `return` 被去掉，行为上的差别是「一条路」变成「两条路」。

### 3.3 `lab` 静默失效

`readLab()` 原来在存储读失败时无条件返回 `LAB_OFF`，而写入失败还会把状态弄丢：现象是
「插件装了、提示词也注入了，模型下一轮又只讲道理」。改法：

- 状态缓存**按 storage 实例**存 `WeakMap`（模块级变量会把一个会话开的环境漏到另一个，测试里立刻可见）；
- 读盘失败 / 文件消失 → 沿用缓存，不当作关闭；
- 写盘失败 → 先写内存，UI 与后续轮次照常按新状态跑；
- `lab：逆向 sample.apk` 这种同轮写法，目标提取用 `command.rest`，口令本身不进目标；
- 一句话都没命中时补 `[交付形状]`——不命中的永远是大多数。

## 4. 验证矩阵（全部实跑）

| 命令 | 结果 |
| --- | --- |
| `npx vitest run` | **59 文件 / 711 例全通过** |
| `npx tsc --noEmit` | 无输出，退出 0 |
| `node scripts/sync-system-prompt.mjs --check` | `system prompt in sync` |
| `node scripts/sync-skill-library.mjs --check` | `skill library ok: 171 files` |
| `node scripts/check-precedent-package.mjs --all --no-tools` | `19 packages checked (tools skipped)` |
| `npm run check:cases` | `19 packages checked with tool self tests` |
| `node scripts/marketplace.mjs check` | `Validated source entries for astravia-official-marketplace` |
| `node scripts/marketplace.mjs build` | `Prepared 13 new packages; distribution changed: true`（本插件 597 个运行文件） |
| `node --test tests/*.test.mjs` | **79 例全通过**（构建之后跑） |

初版曾出现 `src/test/report/assessment.test.ts` 在并行跑时偶发失败：原因是工具写 `reports/`、断言仍写
`report/`，两边对目录名的约定没统一。已按「代码、先例、文档一律 `reports/`」修正，改动后连续三次全量
运行均全绿，不再是噪声。

## 5. 提交与发布

- 提交内容：本插件 `src/` `agent/` `cases/` `docs/` `README` `CONTEXT.md` 与三份身份文件；
  不含 `dist/`、`release/*.astraviapkg`、`.marketplace-build/`。
- 版本：`plugin.json` / `package.json` / `ability.json` / 源目录条目均 **2.14.0**；
  `bump` 报告「没有停在已发布版本上」，说明 2.14.0 尚未发布、无需再抬。
- 发布由 CI 在合入后构建 `.astraviapkg` 并推进 `gh-pages`；本分支推送本身不产生发布。

## 6. 仍然保留的不对等（有意）

| 项 | 为什么不对齐 |
| --- | --- |
| `Tool/mcp/`（235 MB）、`Tool/upstream/`（65 MB） | 第三方二进制与整棵上游树；插件用原生 31 工具覆盖同一能力，搬进来只会多一处版本漂移 |
| `setup/*.ps1` 安装器 | 插件由市场安装；`probe_environment` + `install_toolchain` 给的是安装命令 |
| 14 条战例工程的 233 个目标特定产物 | 在别的机器上不可执行；骨架只带方法、证据门、构建脚本 |
| 39 个路由目标 | 上游也只有 5 份能力，缺口是「39 个目标 ≈ 5 份内容」 |
| `manifest-summary` 独立入口、截图 OCR | P2，收益低于维护成本；现有工具已覆盖需求 |

## 7. 下一步（若要继续）

1. 真机核对：在 Desktop 面板里走一遍「lab：→ 提问 → 拿到命令」与「面板自检四组数字」；
2. 若 2.14.0 已发布后再动运行内容，用 `node scripts/marketplace.mjs bump --slug hanshuang-pojia --apply`；
3. 形态识别的漏判（正则级）只在「少给一条入口」上体现，补法永远是往 `scope-lexicon.ts` 加词，
   不改判定代码。

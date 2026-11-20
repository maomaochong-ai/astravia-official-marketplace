# 0011：field 级先例的落成条件，与判断层命中率的度量口径

- **状态：** 已接受
- **日期：** 2026-11-20
- **背景：** 两个悬空项：20 个先例包里 `field` 级为 0；`plan_next_step` 只测过形式没测过命中率。
- **适用：** `cases/*/case.json` 的 `completeness`、`docs/contract/case-library.md`、`src/test/case/next-step-hitrate.test.ts`

## 问题

### 1. `field` 为空不是待办，是缺证据

`completeness` 三档：`sketch`（形状）、`worked`（方法 + 工具 + 防御）、`field`（有真实目标的过程记录）。
现状 `sketch` 1 / `worked` 19 / `field` 0。

`field` 不能靠写出来：它要求的是**别人能独立复核的一次真实评估**。把这个值填上去只需要一行改动，
但那样做等于把「我读过类似案例」冒充成「我做过这个目标」——这是本仓库最不该有的那类失真。

### 2. 命中率没有基准就等于没有指标

`plan_next_step` 上一轮只断言了「每一步都有否证与退路」。形式合格与判断正确是两件事：
每条计划都可以写得漂亮，同时全部指错方向。

## 决定

### D1：`field` 由证据清单决定，不由人声明的档位决定

一个先例包升为 `field`，必须同时具备 `docs/` 下三份材料，缺一即拒绝：

| 材料 | 内容要求 | 为什么必须有 |
|---|---|---|
| `docs/timeline.md` | 真实时间线：每条带日期与动作，不是「先后顺序」的抽象描述 | 时间线是「真的做过」与「想了一遍」之间最难伪造的差别 |
| `docs/evidence.md` | 原始字节级证据：偏移、原始字节、改后字节、命令与退出码 | 复核者不用信结论，可以自己重跑 |
| `docs/closing.md` | 结案记录：结论、残余风险、交付物清单、回滚验证 | 没有回滚验证的评估只是半次 |

并且 `case.json` 里 `completeness: "field"` 时，`auth.status` 必须是 `granted` 且 `evidence_of_auth` 非空——
`field` 意味着动过真目标，这一点不能只在正文里提一句。

### D2：校验器把这条变成硬失败，不靠自觉

`scripts/check-precedent-package.mjs` 增加一条：`completeness === "field"` 时要求上面三份文件存在且各自
≥ 1200 字符（少于这个量级的「时间线」通常只有五条概括）。当前 20 个包全部是 sketch/worked，
所以这条规则此刻不拦任何东西——它的作用是**挡住第一次越级**。

### D3：命中率用人工标注表度量，分母与判分口径都写死

`src/test/case/next-step-hitrate.test.ts` 的基准表 16 条，覆盖六条规则 + 两种兜底：

- **判分口径**：命中 = 期望步骤是计划里的**首步**；兜底等于没命中（除非期望就是兜底）；
- **阈值 0.9**：表里每条都是确定性映射，正常应 1.0；留 0.1 只容忍「多规则同时命中时的顺序之争」，
  不给漏判留空间；
- 另两条断言：多规则时壳优先；每条 plan 的 `action.tool` 必须是真实存在的工具 id
  （防止计划指向一个不存在的动作——这是这类判断层最常见的退化）。

表是**人工标注**的，不是从实现里反推的：先写「这种情况下人会先做什么」，再跑实现比对。
标注来源是 `docs/audits/case-tools-intake.md` 的规则族划分与 20 个包各自的第一步。

### D4：命中率提升靠加规则，不靠调阈值

真出现漏判时，正确动作是往 `next-step.ts` 加一条规则（并在基准表里加一行标注意图），
不是把阈值调低、也不是往表里删掉那条难例。阈值变化必须同时改本条 ADR。

## 不做什么

- **不预填 `field`**：三个包看起来「最像现场」（`payload-chain` 有链条、`proxy-dll-license-state-machine`
  有状态机、`cardkey-online-runtime-patch` 有在线校验），但它们依然没有真实目标的书面材料。
- **不做自动评级**：用「有 tools / 字数 / 文档数」推 `completeness` 会把 `worked` 全升成 `field`。
- **不把命中率当成模型能力**：这一层是纯规则；命中率低说明规则写漏，不说明模型差。
- **不给 `plan_next_step` 加「置信度」以外的打分**：现在三档（strong / weak / fallback）够用，
  再细就是伪精确。

## 验证

| 项 | 现状 |
|---|---|
| `plan_next_step` 首步命中率 | **16/16 = 1.000**（`vitest run src/test/case/next-step-hitrate.test.ts`） |
| 多规则优先级 | 通过（APK 同时命中壳/签名/导出组件时，壳在最前） |
| 工具 id 真实性 | 通过（15 个真实 id 的白名单比对） |
| `field` 门槛 | **未触发**：当前 20 包无 `field`，规则只等第一次越级；`check-precedent-package --all` 仍 0 问题 |

待补（写成缺口，不是计划）：

- **真实样本上的命中率未测**：16 条是标注表，不是线上分布。要测后者，需要一批已完成的真实评估
  报告，逐条比对「人当时的第一步」与「plan 给的第一步」——那需要历史案卷，目前 `field` 为 0，
  恰好也说明这份数据还不存在。
- **规则与报告的耦合**：规则按 `ruleId` 家族匹配。若以后新增规则族（例如 `archive.*` 之外的新前缀），
  需要同步加规则，否则会静默兜底。

## 关联

- [0010](0010-injection-target-matrix.md)：`field` 分级同属「契约搬、产物不搬」的判断。
- `docs/audits/case-tools-intake.md`：规则族与先例第一步的来源。
- `docs/contract/case-library.md`：包契约本体，`completeness` 与三份 `field` 材料的校验在
  `scripts/lib/precedent-package.mjs`。

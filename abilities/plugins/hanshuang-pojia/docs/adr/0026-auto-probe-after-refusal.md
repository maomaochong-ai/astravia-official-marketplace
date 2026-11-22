# 0026：拒绝之后自动跑梯度，并让表格跟着对话走

- **状态：** 已接受
- **日期：** 2026-11-22
- **背景：** 用户要求「启用插件后在宿主对话里，模型拒绝某些问题时，宿主对话要按插件的梯度机制自动去检测、自己拿到策略、自己继续发送；这些对话在梯度表里要实时更新」。
- **适用：** `domain/auto-probe.ts`、`runtime/contributions.ts`、`runtime/panel-channel.ts`、`features/workbench/hooks/use-live-probe.ts`、`components/prompts/probe-refusal-card.tsx`

## 现状（改之前）

`Stop` hook 里只有一件事：`classifyStop()` 判定这一轮是否以拒绝收尾 → `planRecovery()` 换一种问法**续一句**。
它能让这一轮继续，但拿不到「第几档开始拦、是内容还是句式、同端点还有哪些档能过」——用户仍要自己打开梯度卡片、自己点一遍、自己等结果。

## 决定

### D1 拒绝之后先自动派一次梯度，再考虑续跑

`planAutoProbe()`（`domain/auto-probe.ts`）：
- 用**被拒的那句原话**作目标，`targetClassOf()` 判类别，`ladderFor()` 生成四档；
- 产出交给 agent 的续跑片段：档位名 + 「调用 `probe_refusal`，gradient 用这几档原句」+「结论必须来自实际返回」+ 末尾附 `<probe-report>` 块；
- 片段里带上宿主模型 id（模块级 `lastHostModelId`，provider 每轮更新）。

**顺序是先要数据，再要那一句**：`Stop` 的 `continuationFragments` 里自动梯度排在改写之前。

### D2 节流：同一轮只派一次，且与改写计数分离

- `MAX_CONTINUATIONS_PER_TURN = 3` 是**改写链**的上限；
- 自动梯度只 1 次（`markAutoProbe` 单独计数）。一张表就够看出第几档开始拦，多测只是烧用户自己的额度。
- 幂等键 `auto-probe:<class>:<原话前 120 字>`：换一句就是新目标，允许再派；同一句重复拒绝不会重复派。

### D3 不该自动测的两种情况

| 情况 | 为什么不派 |
|---|---|
| 没有原话（`Stop` 时拿不到用户那句） | 没有目标，「第几档」无从谈起 |
| 静默拦截（HTTP 200 空正文） | 没有可判定内容，四档只会全落 `empty`，测了也没有信息 |

两者都返回 `null`，`Stop` 于是退回原来的改写续跑或什么都不做。

### D4 面板要说「谁在测」

`publishRefusal()` 增加可选 `autoProbe: { targetClass, rungs }`。面板订阅 `refusal` 事件：
- 有 `autoProbe` → 表格上方显示「已按「站点/账号权益」自动测 4 档 —— 结果回来后本表自动更新」，附「取结果」按钮；
- 没有 → 清掉状态条（免得挂着上一次的）；
- 对话里出现新的 `<probe-report>` 块后，状态条自动消失（数据已经到了）。

### D5 表格的数据来源优先级不变

`<probe-report>`（对话）> `probe.json`（工具记录）> 空。自动梯度只是**多了一个派发者**，数据通道没变——所以 D2/D3 的判据仍然成立，不需要新的写盘路径。

## 不做什么

- **不让插件自己发模型请求。** 端点与凭据在对话侧；面板/主进程持有它们就是开一个新的旁路（ADR 0021 D2 不变）。
- **不在 `Stop` 里直接写 `probe.json`。** 写盘只由 `probe_refusal` 一个入口负责，避免两处写同一份记录。
- **不给自动梯度加「失败重试」。** 一次就够；重试会与改写链抢同一个 `max-stop-continuations` 预算。
- **不自动把结论写进案例库。** 沉淀仍是用户显式动作（ADR 0005）。

## 验证

| 用例 | 钉住什么 |
| --- | --- |
| `src/test/workbench/auto-probe.test.ts`（7 条） | 类别化四档进片段；片段要求 `<probe-report>` 与「结论来自实际返回」；带模型 id；同一轮不重复派；无原话不派；静默拦截不派；换一句换键且类别跟着变 |
| `src/test/workbench/lab-chain.test.ts` | lab 关闭时整条拒绝链不介入（本轮不变） |
| `src/test/workbench/type-scale.test.ts` | 新增状态条没有引入第八档字号（本轮被它拦下一次 `text-[10px]`） |
| `node scripts/report-unused-locale.mjs zh.json --strict` | 新增 2 键全部被引用 |

待补：`Stop` hook 的端到端（真拒绝 → 自动派 → 工具返回 → 表格更新）需要真端点与真宿主；当前由 `planAutoProbe` 的纯函数用例 + 面板事件订阅覆盖。

## 关联

- 0019 / 0025：lab 门控与注入机制（本 ADR 的派发仍受 `lab.enabled` 约束）
- 0021 / 0024：措施留档、目标感知改写、实时对照
- 0026 之后，「模型拒绝 → 自动测 → 表更新 → 改写再发」构成闭环，但**判定仍只有 `probe_refusal` 一个权威**

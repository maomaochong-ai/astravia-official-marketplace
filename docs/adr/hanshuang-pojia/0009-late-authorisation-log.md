# ADR 0009 — 授权晚到：`auth-log.md` 与「回报落盘门禁」

- 状态：已接受（2026-10-27 落地于 2.12.0）
- 取代：不取代任何一篇；补充 [0006](./0006-case-contract-v2-and-precedent-library.md) 的 D2 与 D4
- 影响：`src/domain/case/contract.ts`、`src/domain/case/library.ts`、`src/domain/toolchain/workspace.ts`、
  `src/tools/case/init-task.ts`、`docs/contract/case-library.md`

## 1. 背景：一条比上游更严的规则，严错了地方

0006 的 D4 规定 `ready_for_act` 是**推导值**：

```text
ready_for_act = auth.status === "granted"
              ∧ in_scope 非空
              ∧ (network_profile !== "offline" ∨ 存在离线样本)
```

并且明确**不**接受把 `ready_for_act` 当参数传进来。这条规则的严格度需要和上游比一次，因为它的实际代价
比它看上去大。

**上游的实际做法**（`case-init.ps1`，单次调用）：脚本接收 `-AuthStatus`、`-InScopeAssets`、
`-NetworkProfile`、`-Sample` 这些**事实**，自己算出 `ready_for_act`，写进 `scope.md` 的 `## signoff`，再把
同一句结论打印出来。它同样没有 `-ReadyForAct` 开关——门禁在上游也不是入参。所以「推导、不传参」不是本
插件加码，而是与上游同级。

真正比上游严的是另外两件事：

1. **读端重算**。上游只在写入那一刻算一次，之后谁读 `- ready_for_act:` 就信谁；本插件的 `search_cases`、
   面板与 `init_task` 的回读都从 `scope.md` + `auth-log.md` 重新推导（0006 D2 补充）。这让「手改一行
   `ready_for_act: true`」不再是提权手段——这是好事。
2. **写入端只写一次**。`scope.md` 由 `writeOnce` 保护，第二次 `init_task` 不会改写它。这条本身也是 0006 的
   决策（范围是快照，不是可变配置），但它和上面第 1 条叠加后产生了一个死胡同：

```text
案例以 pending 建立  →  scope.md 记下 pending  →  scope.md 永不被重写
                    →  读端永远重算出 not ready  →  这个案例永远不能开工
```

现场的操作者只能新建一个案例来表达「授权到账了」，代价是丢掉 timeline、证据编号与已写的笔记。
这不是严格，这是把严格用在了错误的对象上：**范围**是开工前的快照，**授权**是一个可以晚到的事件。

### 一处已存在的不诚实（Observed）

旧实现在新建案例被跳过时，仍然按**内存里的 brief** 回报门禁：

```ts
const readiness = assessReadiness(brief);          // 来自入参
await writeOnce(fs, scopePath, scopeMarkdown(brief)); // 磁盘上没变
return { …, readiness };                            // 回报 ready，磁盘上 not ready
```

`init_task` 的返回值下方原本还写着「A second init_task call with auth_status=granted + in_scope keeps the
existing scope.md」——它确实保住了 `scope.md`，却**没有**让门禁打开，并且**同时**报了一个磁盘上并不存在的
`ready`。工具说谎的方向恰好是操作者最关心的那一侧。

## 2. 决策

### D1 `ready_for_act` 仍是推导值，永不作为入参（重申 0006 D4）

`assessReadiness` 的入参只有 `authStatus` / `inScope` / `networkProfile` / `sample` 四个事实。
`init_task` 的 schema 保持 `additionalProperties: false`，误传 `ready_for_act` 是硬报错而不是被忽略——
静默忽略会让人以为设置生效了。

### D2 授权晚到走 `auth-log.md`，`scope.md` 仍然只写一次

新增案例文件 `auth-log.md`，append-only，按块读：

```text
# Authorisation log — <case>

## 2026-10-27T12:00:00.000Z | granted
- basis: ticket SEC-1042
- evidence: jira/SEC-1042
```

- 块头是 `## <iso> | <status>`，字段沿用 `- key: value`，与 `scope.md`、`timeline.md` 同一套解析习惯。
- **最后一块生效**；没有 `status` 的块被跳过继续往前找，而不是猜（一个读不懂的记录不得打开门禁）。
- 只有 `status` 与当前生效值**不同**时才追加：重复调用不制造噪声，也不伪造一个「刚授权」的时间戳。
- 追加的同时向 `timeline.md` 追加一条 `kind = "auth"` 的事件：授权变更是事件，必须留在时间线上。

### D3 `init_task` 回报的永远是落盘后的门禁

`scope.md` 已存在时，`readiness` 由 `scope.md` + `auth-log.md` 重新推导；只有本次真的写出了 `scope.md`
才用 brief 推导。这条把上面那处不诚实直接删掉。

### D4 读端只有一个解析器

`parseAuthLog` 放在 `src/domain/case/library.ts`，与 `parseScope` 并列；`scanCases`（`search_cases` 与面板共用）
与 `init_task` 的回读都只走它。两套解析器迟早会漂，而漂的那一套会让面板和工具对同一个案例给出相反结论。
`record_case_note` 只写笔记、不回报门禁，因此不在此列。

### D5 范围不因此可变

`auth-log.md` 只承载「谁在什么时候授权了」。`in_scope`、`out_of_scope`、`network_profile` 仍来自
`scope.md`，改动仍然要开新案例。这条是 D2 的边界，也是它不违反 0006 D1 的原因。

## 3. 被否掉的方案

| 方案 | 否决理由 |
| --- | --- |
| 让 `ready_for_act` 作为入参 | 等于让调用方自己投票决定能不能开工。上游也没有这个开关，没有放宽的理由 |
| 允许重写 `scope.md` | 「当时授权了什么」失去凭据。授权晚到和范围变化是两件事，用一个可变文件同时表达两件事就都表达不清 |
| 授权变更就新建案例 | 丢掉 timeline、证据编号与笔记；现场不可能为了补一张工单重开评估 |
| 把授权修订塞进 `scope.md` 的 `## auth` 段 | 需要重写正文，与「写一次」直接冲突。上游读端会忽略未知节，但本插件的读端正是那个会重算的人，自欺没有意义 |
| 在日志里用 `ready_for_act: true` 直写结论 | 把推导值落盘就回到了「手改一行即可提权」的老问题。日志只存事实，结论每次重算 |

## 4. 后果

- 一个 `pending` 案例可以在不丢历史的前提下开工：`init_task(name, auth_status: "granted", auth_basis: …)`。
- 工具、面板、`search_cases` 对同一案例的门禁结论一致，因为来源同一份字节与同一个解析器。
- 代价是多一个文件、多一条时间线事件；`caseDocs` 的根文档列表会多出一项（沿用现有列文件逻辑，无需改 UI）。
- 尚未解决：`denied` 之后再次 `granted` 会追加第二块，读端取最后一块——这是有意为之，撤销与重申都表达得出来。

## 5. 实现核对（2026-10-27，2.12.0）

| 决策 | 落点 |
| --- | --- |
| D1 | `src/domain/case/contract.ts#assessReadiness`（四事实入参）；`src/tools/case/init-task.ts` `additionalProperties: false` |
| D2 | `src/domain/case/contract.ts#authLogHeader` / `#authRecordMarkdown`；`src/domain/toolchain/workspace.ts#recordAuthAmendment` |
| D3 | `src/domain/toolchain/workspace.ts#initTaskWorkspace`（`scopeWritten` 分支 + 落盘回读） |
| D4 | `src/domain/case/library.ts#parseAuthLog`，被 `#readCase` 调用 |
| D5 | `recordAuthAmendment` 只读 `scope.md` 的范围字段，不写 |

可重跑：

```bash
cd abilities/plugins/hanshuang-pojia
npx vitest run src/test/case-library.test.ts src/test/toolchain.test.ts
# 关注三条用例：last block wins / opens a pending case once authorisation is appended
# / reports the gate on disk, not the one the caller asked for
```

## 6. 与上游的关系

上游没有 `auth-log.md`，也没有读端重算；它的 `scope.md` 就是一次声明加一次结论。本 ADR **不**声称上游
支持晚到授权——它不支持。这里是本插件在保留上游「门禁是推导值」这一点的同时，为上游单次脚本无法表达的
真实情况（工单后补）加的一条追加式通道；读端忽略未知节的上游工具仍能读这个目录。

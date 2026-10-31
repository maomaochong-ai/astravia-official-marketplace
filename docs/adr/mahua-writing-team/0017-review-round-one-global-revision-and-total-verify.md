# ADR 0017：审查轮修复——并发基线收成全局 revision、pointerDrift 改成能成功的指令、验签补全函数性

- 状态：已接受（2026-10-29，随 0.1.0）
- 决策对象：`src/application/studio-service.ts`、`src/domain/novel-progress.ts`、
  `src/entitlement/credential.ts`、`src/plugin-context.ts`、
  `src/entitlement/{entitlement-gate,trusted-keys}.ts`、
  `test/{studio-service,chapter-state,entitlement}.test.ts`
- 修订：ADR 0005 §并发（基线粒度）、ADR 0001（`reason.pointerDrift` 的含义）、
  ADR 0004（验签必须对任意输入都有结论）
- 相关：ADR 0007（门禁名单与执行点分离）、ADR 0015 §2.3（词表豁免）、ADR 0016（空态与字号）

## 1. 背景

ADR 0014–0016 把改名、第二轮能力对齐与书架/阅读页再对齐落进了代码，`check` 与 139 条测试全绿。
按用户要求做一轮两轴审查（Standards：是否守本仓库与插件的既有纪律；Spec：是否真的做到了
ADR 里写下的东西），目标包含僵尸代码。审查不看"测试绿不绿"，只看**测试没覆盖到的判定分支**，
因此这一轮查出来的四个问题全部在绿色测试之外。

## 2. 决策

### 2.1 乐观并发基线从一个 Map 收成一个字段

原实现是 `private readonly revisions = new Map<string, string>()`，按 `book.id` 缓存上次
`commit()` 返回的 revision。它看起来比"一个字段"更精细，实际是错的：

- `PluginStorageApi.commit()` 的语义是**一次发布整个插件命名空间的一个 revision**，
  `ManuscriptStorage` 的实现也只有一个 `revision` 计数器（`rev-${n}`）。基线是插件级的，
  不是书级的；
- 于是"先写 B 再写 A"会给 A 递上一个 B 写完之后已经过期的基线，`save()` 直接报
  `revision-conflict`——一次完全合法的交替写作被判成冲突。

改成 `private revision: string | undefined`，7 处写路径统一读写同一个字段，并在字段上留注释
说明"按书缓存会造假冲突"。回归测试
`does not invent a conflict when two books take turns writing` 钉住这条：
两本书各自 `acceptBrief` 之后再来回写，必须返回 `ok`。

已知取舍写在注释里，不藏：会话第一次写之前 `this.revision` 是 `undefined`，第一次写不带基线，
因此"另一个会话恰好在这一刻写过"不会被这条机制发现。要消除它得先用一次读拿到基线，
而宿主对空路径列表 `readSnapshot([])` 的行为无法在本地验证，所以本轮不做（见 §4.1）。

### 2.2 `reason.pointerDrift` 必须是一条能成功的指令

路由规定：进度指针落在已提交章上时，发给 engine `commit-chapter` 并附 `reason.pointerDrift`。
但这条指令原本**永远不可能成功**：

1. `commitChapter` 对 `status === "committed"` 一律 `fail("chapter N is already committed")`；
2. `finalizeBook` 之前的最后一次提交把指针留在末章（`currentChapter: hasMore ? n + 1 : n`）；
3. `reopenBook` 只改 `phase` 与 `targetChapters`，不动指针。

三件事接起来就是一个死锁：完本 → 重开 → 路由发 `commit-chapter(末章)` → 提交守卫拒绝 →
路由再发同一条。测试 `test/novel-flow.test.ts` 只断言了路由**会发** `reason.pointerDrift`，
没断言收到它的一方**能做成**，所以缺陷一直不出现在红灯里。

两处修，方向相反但互补：

- `commitChapter`：遇到已提交的章，只要指针还落后（`currentChapter <= n`）且未到
  `targetChapters`，就只把指针推到 `n + 1` 并返回 `ok`——不重算 `committedCount`，不改阶段。
  指针已经在前面（重复提交）或已到目标章数时仍然 `fail`，计数守卫不被削弱。
- `reopenBook`：重开时把指针抬到 `committedCount + 1`，顺带让 `checkpoint.draftingStarted`
  记在新指针上。重开的语义本来就是"从没写的那一章接着写"，指针停在已提交章是错的。

两条回归测试在 `test/chapter-state.test.ts`：
`repairs a pointer that fell behind a committed chapter without counting twice`、
`reopens a finished book at the first unwritten chapter`（后者还断言重开后路由给的是
`outline-chapter`，不是 `pointerDrift`）。

### 2.3 凭证解码必须是全函数

`decodeToken` 在 `JSON.parse` 之后直接调用 `canonicalClaims(claims)`，而规范化里有一句
`[...claims.entitlements].sort()`。只要载荷里 `entitlements` 是数字、`null` 或对象，
展开就抛 `TypeError`；`verifyEntitlement` 没有 `try`，异常会一路穿到
`EntitlementGate.load()`——`load()` 在插件启动时被调用，结果是**贴错一张凭证 → 整个插件起不来**，
而不是"凭证无效"。

修法是在规范化之前加形状判定 `isClaimsShape()`（`v === 1`、五个字符串字段、
`entitlements` 是字符串数组），不满足就返回 `null`，由既有路径给出
`{ status: "invalid", reason: "malformed-token" }`。测试
`treats a wrongly typed claim as malformed instead of throwing` 同时断言 `not.toThrow()`
与 `status === "invalid"`——只断言后者的话，实现先抛出再被谁吞掉也能过。

不在 `verifyEntitlement` 外面包 `try` 当兜底：兜底会让"意料之外的抛出"变成静默通过，
问题下一次还在这里（ADR 0004 的 fail-closed 要求的是有结论，不是有兜底）。

### 2.4 僵尸代码：删三个、用一个、删一个函数

审查扫出五个在插件内零引用的导出，逐个定性而不是一刀切删：

| 符号 | 位置 | 处置 | 理由 |
| --- | --- | --- | --- |
| `encodeBase64Url` | `src/entitlement/credential.ts` | 删 | 签名侧只在离线签发脚本里用，包内没有签发路径；留着是给"以后可能要签"占位 |
| `looksLikeCredential` | `src/entitlement/entitlement-gate.ts` | 删 | 激活页改为直接调 `verifyEntitlement` 并读结构化 `reason`，前缀嗅探成了第二套判定 |
| `CURRENT_KEY_ID` | `src/entitlement/trusted-keys.ts` | 删 | `trustedKeys()` 已经把整张信任锚表交出去了，再导一个当前 keyId 是重复事实 |
| `peekStudioRuntime` | `src/plugin-context.ts` | 删 | 与 `getStudioRuntime` 只差"缺运行时是否抛错"；没人调用它就意味着没人愿意静默拿到 `null` |
| `ArbitrationRecord` | `src/domain/novel-types.ts` | **改用上，不删** | 与 service 里两处内联 `JSON.stringify({ at, scenario, question, decision, rationale })` 形状重复。`arbitrate` 与 `reviseOutline` 改用 `const record: ArbitrationRecord = {…}` 再序列化，类型与写盘结构从此由编译器对齐 |

`ArbitrationRecord` 的处置是这一轮唯一"不删"的：僵尸类型的价值不在于它被 import，
而在于它能让**重复的形状**只剩一个来源。删掉它，两处内联字面量仍然各自演变。

### 2.5 领域词表豁免与正则转义的实测结论

ADR 0015 §2.3 决定把前提小标题的别名表拆到 `src/domain/premise-vocabulary.ts`，
并在「领域层不含自然语言」的守卫上按文件名精确豁免。这一轮补上两条实测：

- 守卫剥注释但不剥正则字面量，所以 `splitCast` 的分隔符与标题正则里的全角标点会被算成
  "领域层出现自然语言"。修法不是放宽守卫，而是把正则里的全角码点改写成 `\uFF1A` / `\u3001` /
  `\uFF0C` / `\uFF1B` / `\uFF0F`——源码里不再出现实际全角字符，语义不变。
- 豁免只有一行 `SOURCE_FILES.filter((file) => … && file !== VOCABULARY)`，注释写明
  "新增豁免请改这一行，不要改成通配"。宁可每次都改守卫，也不让一次通配把整类问题放过去。

## 2.5 第二轮：路由指令的可执行性

前一轮修的是「路由发了一条做不到的指令」（`reason.pointerDrift`）。同一类问题还有两处，只有在
把「路由 → 领域函数」接成一个驱动循环后才暴露——因为旧测试分别验证「路由发对了」和「领域函数写对了」，
从没验证「前者发的东西后者能办成」。

驱动循环放在 `test/instruction-drivability.test.ts`：取 `routeNovel(state)` → 按 `task` 分派到
对应领域函数 → 断言 `ok` → 一直跑到没有指令。同一指令连发两次就判失败（那就是死循环的形状）。

- **新书第一步就走不下去**（观察所得）：`acceptBrief` 后 `phase = planning`、`volumes = []`。
  旧的 `nextUnplannedArc(chapters, volumes)` 在弧表为空时返回 `null`，路由因此发
  `outline-chapter`，而 `saveChapterOutline` 要求章节落在已规划的弧内 → 第一轮就报
  `chapter 1 is not covered by any planned arc`。修法：弧表为空单独判一次，发 `plan-arc`
  并附新键 `reason.noArcYet`。
- **规划阶段的重复发令**（观察所得）：弧已存在但弧内还没有章纲时，旧逻辑会再发一次
  `plan-arc`，架构师二次落弧直接撞 `arc a1 overlaps an existing arc`。修法：规划阶段只做两件事
  ——铺弧、写章纲。弧在、章纲缺 → `outline-chapter`；章纲齐了 → 返回 `null`，等作者自己按
  「开始写作」（界面动作，映射 `startDrafting`），路由不替人做「什么时候开头」这个决定。
- **指针落在弧外**（观察所得）：完本重开到第 4 章、而弧只盖到第 3 章时，路由照旧发
  `outline-chapter`，同样被弧覆盖校验拒。修法：`planning` 与常规分支都在查章之前先问一次
  `arcForChapter(volumes, progress.currentChapter)`，不在弧内就发 `plan-arc`（新键
  `reason.arcUncovered`，参数 `{{chapter}}`）。重开后补弧成了可执行的一步，而不是让人去猜。

三条修完之后同一个驱动循环可以从 `briefing` 一路跑到 `completed`（含完本 → 重开到 4 章 → 再完本），
任何一步做不到都会红。删掉的东西：`nextUnplannedArc`（被上面三条取代，已成僵尸）、
`reason.allArcsPlanned` 与 `reason.arcUnplanned`（不再有产出点）。


## 3. 后果

- `studio-service.ts` 的 7 处写路径共用一个基线，交替写两本书不再产生假冲突；
  代价见 §2.1 记录的"首次写无基线"。
- 完本重开这条路径从"必死循环"变成可走通：重开 → 指针在 `committedCount + 1` →
  路由给 `plan-arc`（指针在弧外时先补弧）→ `outline-chapter` → 继续写。`pointerDrift`
  保留为脏数据修复通道，且**可执行**。
- 凭证解析对任意字符串都有结论：`missing` / `invalid` / `expired` / `active` 四态之一，不抛。
- 插件内零引用导出从 5 个降到 0 个；`ArbitrationRecord` 由"声明"变成"两处写盘结构的唯一定义"。
- 测试从 136 条增到 **143 条**，10 个文件全绿；`tsc --noEmit` 无错。

## 4. 不做什么

1. **不给乐观并发加"首次写先播种基线"**：需要 `readSnapshot([])`，它的行为在宿主里无法本地验证；
   拿一个未经验证的行为当并发基础，比承认这半格缺口更糟。
2. **不给 `verifyEntitlement` 加 try/catch 兜底**：见 §2.3，兜底会把异常变成静默通过。
3. **不改 `resolveBook()` 的"省略 bookId 就用最近更新的书"**：这是 ADR 0007/0009 里
   工具面故意留的便利——智能体通常只知道"当前这本书"。视图侧的写操作一律显式传
   `book?.id`，歧义只可能出现在智能体省略参数时，而那时 `listBooks()` 的最近更新排序是确定的。
   要收紧就得让每个写工具都多一次"先查有哪些书"的往返，收益不抵成本。
4. **不加"语言包里不许有无用 key"的反向守卫**：`task.*` / `phase.*` / `status.*` / `worker.*`
   走模板字面量动态拼接（13 处），反向扫描会把它们全报成死键，最终只能加一长串豁免，
   比没有守卫更差。正向守卫继续钉"路由产出集合 ⊆ 语言包集合"。
5. **不让路由替作者决定「开始写作」**：`planning` 阶段章纲齐备后返回 `null` 而不是新增
   `start-drafting` 任务。开文是人的决定，界面已有这个按钮；把别离点挪进路由会让
   「自动跑到底」成为默认行为。

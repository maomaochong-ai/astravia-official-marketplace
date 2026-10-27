# ADR 0006：案例契约 v2 与战例库

- 日期：2026-10-27
- 状态：已采纳（2026-10-27）
- 核对：2026-10-27（版本 2.11.0），见文末「实现核对」
- 关联：[0001](./0001-seep-kit-capability-parity.md)、[0002](./0002-external-process-bridge.md)、
  [0005](./0005-workbench-completion-and-lab-state.md)

## 背景

上游 seep-kit 2.0 把「案例（case）」当作一等对象，由两处载体共同构成：

1. **契约层** — `Tool/scripts/case-init.ps1`：建 `scope.md`（授权状态/授权依据/授权证据、in scope、
   out of scope、network profile、deliverables、constraints、signoff）+ 只追加的 `timeline.md` +
   `workitems.md`（WI 表 + 覆盖清单）+ `evidence/`、`notes/`、`report/` 三个目录；带三档预设，
   并算出一个 `ready_for_act` 门禁——未记录授权就不许开工。
2. **语料层** — `Tool/cases/`：14 个只读的**可复现发布包**（`README.txt` + `docs/reverse-engineering.md`
   + `docs/algorithm.md` + `src/` + `build.ps1` + `SHA256SUMS.txt`），项目 N 另有
   `.agents/notes/{implemented,rejected}/<分类>/<日期>-<slug>.md` 的决策记录。

语料层的作用不是「藏着 14 个成品」，而是**先例检索**：遇到「某个商业软件的授权校验」时，
agent 能指向同类案例，复用技术链、引用结论、避开已被否掉的路径。契约层保证「先例之所以可引用」
——因为每一份都写了授权、范围、时间线和证据编号。

本地插件对这两层都不对等：

- `init_task` 只建 `samples/` `exports/` `reports/` 与一份 README，没有授权记录、没有范围声明、
  没有只追加时间线、没有工作项、没有证据编号、没有预设、没有就绪门；
- `search_docs` 只能检索随包文档，无法检索**操作者自己的案例**；
- 没有决策记录约定；
- 面板没有案例页。

`docs/audits/upstream-parity-audit-2.9.3.md` 把这一行写成「任务管理 | `case-init.ps1` | `init_task`,
`write_assessment_report` | ✅」，是**误判**：文件建出来了不等于契约对等，那份审计也通篇没提
`Tool/cases/`。本文是对该行的补正。

两条既有决策不动，本文不推翻它们：

- **ADR 0001 §2.3**：`Tool/cases/` 14 个工程不随包分发（体积 + 敏感度 + 含 `.dll`/`.jar` 制品）。
- **ADR 0002 D17**：`init_task` 不建 `patches/` 制品目录。

因此本文的口径是：**缺的不是语料，是契约与检索。** 把上游案例机制对齐，但不搬运二进制。

## 决策

### D1 目录与文件名逐字对齐 `case-init.ps1`

```text
<root>/<case>/
├── scope.md         # 九节声明：授权、范围、网络、交付物、约束、签核（写一次）
├── timeline.md      # 只追加的事件块
├── workitems.md     # 八列 WI 表 + 覆盖清单
├── README.md        # 接续说明（原有，文案按 ready/未 ready 分两套）
├── samples/         # 受检字节（原有）
├── exports/         # 反编译/反汇编/字符串导出与复现脚本（原有）
├── report/          # 评估报告（**单数**，上游即此名）
├── evidence/        # 证据条目 E-001…
└── notes/           # 案例内工作笔记
```

早期版本用的是 `reports/`；对齐上游时改成 `report/`。这是**有意**的破坏性改名：案例要被上游脚本、
上游案例包和操作者的习惯读同一套路径，多一个 `s` 就让两边对不上。

`report/` 不被索引读取（`readCase` 只数 `evidence/` 与 `.agents/notes/`），所以旧案例里已经存在的
`reports/` 不会报错也不会被当成新目录；新案例一律写进 `report/`。`samples/exports` 语义不变，
`evidence/` 与 `notes/` 只承载契约与证据索引。决策记录不放在 `notes/`，见 D9。

### D2 `scope.md` 九节，逐节对齐 `case-init.ps1`

| 节 | 内容 |
|---|---|
| `## meta` | case_id、created、operator、project_root、primary_skill、primary_id、lead_role、specialist_roles、hint、preset |
| `## auth` | 状态四值、依据、授权证据，以及一行 `MUST NOT proceed if status != granted` |
| `## in_scope` | 资产缩进列表、surfaces、activities |
| `## out_of_scope` | 资产、activities |
| `## network_profile` | 四值 mode + notes，外加本插件的 `- offline_sample:`（见 D4） |
| `## deliverables` | report / field_journal / diagrams / timeline + `- planned:` |
| `## constraints` | timebox / stealth / data_handling / rules |
| `## signoff` | `ready_for_act` + 五项 checklist + blockers |
| `## ops_refs` | 本插件内真实可读的方法论文档 id |

未提供的一节渲染为显式空值（`[]` / `(not provided)`），**不给默认结论**（与 ADR 0002 D19 同源）。
`scope.md` 一旦写出就不再改写（要改就新建案例）；这与上游「scope 是开工前的声明」一致。

#### D2 补充：`## network_profile` 里多一行，是为了让读端能重算门禁

上游的 `ready_for_act` 只在写入时算一次，读端不相信自己算的结果。本插件的 `search_cases` 与面板都要
**从文件反推**就绪度，而离线档案的就绪判据包含「有样本」（D4），所以 `## network_profile` 下额外写
`- offline_sample: <path|(none)>`。这是对上游格式的**加法**：上游读端忽略未知行，本插件读端据此重算。

### D3 三档预设自带授权状态，但不带资产

| 预设 | 别名 | auth_status | auth_basis | network profile |
|---|---|---|---|---|
| `offline-sample` | `own-sample` / `local-sample` | `granted` | `own_system` | `offline` |
| `ctf-public` | `ctf` | `granted` | `ctf_public` | `authorized_target_only` |
| `own-system` | `lab-only` | `granted` | `own_system` | `lab_only` |

预设**会**写授权（这是上游 `case-init.ps1` 的实际行为，早期本文写成「预设不填授权」是错的）。
它**不带** `in_scope`：凭空写一条资产会把门禁点亮而实际什么也没纳入范围。资产只来自调用方的
`target` / `sample` / `in_scope`，三者去重后写进 `## in_scope`。

预设有两条纪律：

- **只有调用方显式命名预设时**才套用它的授权；裸调 `init_task` 保持上游默认的 `pending` + `offline`。
- 未知预设直接报错并列出可选项，不静默退化成默认档——静默降级会让一份授权案例看起来像没授权。

### D4 `ready_for_act` 由三条判据算出，入参不能绕过

```text
auth.status === "granted"
∧ in_scope 非空
∧ (network_profile !== "offline" ∨ 存在离线样本)
```

与上游逐字一致。第三条是容易写反的一条：离线档案**必须有样本**，否则「离线」意味着没有任何受检对象，
门却亮着。`sample` 因此成为 `ReadinessInput` 的一部分（读端从 D2 补充里的 `offline_sample` 行取）。

判据是**正向**枚举，不是排除法：`auth_status` 只认 `granted`；`network_profile` 只认四个合法值，
手写的 `scope.md` 里写了别的词，结果不是「看起来像放行」而是多一条阻断项。实现见
`domain/case/contract.ts` 的 `AUTH_STATUSES` / `NETWORK_PROFILES`。

工具**不接受** `ready_for_act` 入参——就绪门是推导值，不是声明值。

### D5 案例名用上游正则语义 + 本插件的中文放宽

上游正则的实质是：首字符字母数字、长度有上限、拒绝路径分隔符与 `.`/`..`、拒绝尾随点与空格、
拒绝通配符。本插件保留这些拒绝项（它们防的是路径穿越与 shell 元字符），但**允许 Unicode 字母**
（`safeTaskName` 既有行为，中文案例名是常态）。上限 64（`MAX_NAME_CHARS`）：案例里还要再套
`evidence/E-###-<slug>.md` 与 `.agents/notes/<status>/<category>/<date>-<slug>.md`，名字太长会把
Windows 的路径总长吃掉。

### D6 `timeline.md` 只追加块，`workitems.md` 八列定格

每次追加一个 `## <iso> | <role> | <kind>` 块，块内固定字段：`action` / `command_or_ref` / `result_summary` /
`artifacts` / `evidence_ids` / `decision_delta` / `carry_forward_refs` / `next`。与上游 `case-init.ps1` 的
时间线块同形，所以两边的日志可以并排读。

`workitems.md` 固定八列 `| ID | title | role | targets | surface | status | evidence | notes |`，状态收敛为
`todo` / `in_progress` / `done` / `dropped`，`WI-001` 恒为「Establish scope and auth」的 bootstrap 行。
自由文本表格会让「做了多少」不可统计，向上游的 `## Coverage` 清单也就无从算起。

### D7 案例索引：扫 `cases/` 与 `work/` 下的 `scope.md`

`search_cases` 在项目根（或指定 `root`）下只找两种目录：`cases/` 与 `work/`，其直接子目录若含
`scope.md` 即为一个案例。**不递归全库**：全库扫描在 monorepo 上代价不可控，而案例目录的位置
恰好是约定好的。最多 200 个案例，超出截断并在结果里说明。

排序按命中权重（案例名 6 / in-scope 资产 3 / 预设与交付物 1 / 就绪 +1），同分按名字字典序。
每个结果给「为什么命中」，不给一个无法复核的分数。

### D8 先例有三源，工具只给 id 与命中理由

1. **本机案例** — `search_cases` 扫出来的 `CaseRecord`；
2. **随包实战记录** — `kb/field_journal_*` 与 `kb/*/techniques/*`，用 `search_docs` / `read_doc` 读；
3. **上游语料** — 不随包（D10），需要时由操作者自行挂载。

工具不复制正文。`search_cases` 返回路径与理由，正文由 `read` 或 `read_doc` 读——一份 300 行的
`docs/algorithm.md` 塞进工具返回值只会把上下文挤掉。

### D9 决策记录走 `.agents/notes/{implemented,rejected}/<分类>/<日期>-<slug>.md`

与项目 N 的约定逐字对齐：`status` 决定一级目录，`category` 是二级目录（`architecture` /
`feature` / `testing` / `process`…），文件名 `<YYYY-MM-DD>-<slug>.md`。`record_case_note` 负责
建目录与写文件，已存在则拒绝覆盖（`overwrite` 可显式放开）。

放在案例内 `.agents/notes/` 而不是 `notes/`：上游把决策记录当作**跨案例可移植的方法论**，
`.agents/` 是 agent 侧约定目录，拷走案例时它可以跟着走，也可以被单独聚合。

### D10 语料仍不随包，`init_task` 自己就是模板

重申 ADR 0001 §2.3。不额外维护一份「案例模板目录」：`init_task` 的产物就是模板，维护第二份
必然漂移。上游 `Tool/cases/*` 里的 `dist/version.dll`、keygen、代理 DLL 一律**不搬**——那是
第三方厂商制品，进了市场包既有体积问题也有分发问题。

### D11 面板加「Cases」页，只读

页面读的是同一份索引（`bridge.readTextFile` + `readDir`），展示：案例名、预设、授权状态、
就绪门、in-scope 条目数、证据条目数、工作项完成度、最近更新。选中项按**路径**标识，不按名字：
`cases/demo` 与 `work/demo` 是两个案例，名字相同不是同一个。**页面不写盘**——建案例、追加
时间线、写决策记录都走 Agent 工具，面板只负责「现在有什么、还差什么」。

### D12 随包先例语料：只发方法，不发制品

`cases/` 下随包发布若干先例包（当前 5 个），每包固定四份可读文档 + 一份元信息：

```text
cases/<slug>/
├── case.json      # slug/title/summary/signals/preset/fieldNotes/docs
├── README.md      # 适用信号 + 工作形状 + 陷阱 + 必须能拿出的证据
├── scope.md       # 完整的九节模板，`auth.status` **恒为 pending**
├── workitems.md   # 八列 WI 表（bootstrap 行 + 该形状的固定步骤）
└── docs/method.md # 方法：顺序、判据、不该做什么
```

三条纪律：

1. **不含样本字节、密钥、偏移、第三方制品**。上游 `Tool/cases/*/src`、`dist/*.dll`、keygen、代理 DLL
   依旧不搬（ADR 0001 §2.3 未推翻）。本插件的先例写「先做什么、怎么判断、什么时候停」。
2. **随包 `scope.md` 写 `pending`**。随包语料不是操作者的授权；复制后必须重跑 `init_task` 记录自己的
   授权与范围。这条由测试守着（断言每份 `scope.md` 的 `- status: pending` 与 `- ready_for_act: false`）。
3. **`fieldNotes` 只能引用真实存在的文档 id**。生成器与测试各拦一次——「凭记忆写文档 id」是本仓库
   最常见的假引用。

### D13 先例编译进 `src/domain/case/precedents.generated.ts`

`.astraviapkg` 只带构建产物，`cases/` 目录不会跟着发布；而面板要在没有文件系统的读端展示先例。
所以 `scripts/sync-precedents.mjs` 把每个包的正文内联成字符串常量，与 `sync-docs` / `sync-tool-index`
同一套路。`--check` 校验生成物与源目录一致，并挂在 `bun run verify:generated` 上；
`cases/` 是唯一事实源，生成物不得手改。

### D14 先例与本地案例分两个结果段，工具与面板各有一套入口

`search_cases` 默认同时返回本地案例与先例（`library: false` 关掉先例）。两者**分开报告**：
先例的命中只说明「这个方法适合你现在的信号」，不说明「这个项目里做过这个目标」。面板的 Cases 页
同理，先例单独一张表，且每行都标 `scope pending`。命中权重：信号 6 / 标题与摘要 3 / 方法正文 1。

## 后果

- 工具 28 → 30：新增 `search_cases`、`record_case_note`；`init_task` 扩展入参并保持向后兼容
  （只传 `name` 的旧调用得到完整目录 + README + `scope.md`（`pending`）+ 阻塞项，而不是「看起来已就绪」）。
- 新增领域模块 `src/domain/case/{contract,library,journal,precedents}.ts` 与生成物
  `precedents.generated.ts`；面板新增 `cases` 页（16 → 17 页）与 `precedents` 表，`USAGE.md` 的页面计数同步。
- 目录结构改造（同期落地，不属于本 ADR 的决策但在同一次发布里）：`agent/skills/` 分出
  `safe-skills/` 存放通用技能，根层只留与破甲直接相关的四本；`src/tools/` 按上游工具工程体系拆成
  `apk/ case/ env/ knowledge/ lib/ native/ report/` 七类。
- 两个落地细节在实现后回写进本 ADR：D4 的判据改成正向枚举（未知词与 `pending` 同等关门）；
  D7 的「匹配分」与「排序分」拆开（`CaseHit.matched` 只算查询词，ready 加分不把不相关案例拉回结果集）。
- 版本 2.9.9 → 2.10.0（案例契约与面板）→ 2.11.0（先例库与目录结构）；`configVersion` 保持 2——变的是
  工具入参、目录契约与随包语料，插件**设置模式**没改。
- 新增测试：契约渲染与就绪门、名称校验、索引解析与排序、决策记录路径、先例包完整性与真实引用。
- D5 的 64 ↔ 上游 80 是有意偏离，不再当作待办；它省下的是 `evidence/E-###-<slug>.md` 与
  `.agents/notes/<status>/<category>/<date>-<slug>.md` 两层文件名的 Windows 路径预算。

## 未采纳

| 方案 | 不采纳的理由 |
|---|---|
| 把 `Tool/cases/` 14 个工程搬进插件包 | 体积（含二进制制品）+ 第三方厂商制品分发 + 敏感度；ADR 0001 §2.3 已判 |
| 建 `patches/` 制品目录 | 与 ADR 0002 D17 冲突；案例语料里确有 `dist/*.dll`，但本插件只索引元信息，不复制制品 |
| 复刻 `case-init.ps1` 的 PowerShell 形态 | 插件没有 PowerShell 运行时；对齐**行为**，形态用 TypeScript |
| 让 `ready_for_act` 作为入参传入 | 声明值会被随手传 `true`，门禁就失效了；必须是推导值 |
| 递归扫描整个项目找 `scope.md` | 在 monorepo 上代价不可控；案例位置本就是约定（`cases/`、`work/`） |
| 把先例包做成「可开工的案例」 | 随包语料不是操作者的授权；`scope.md` 一律 `pending`，复制后重跑 `init_task` |
| 先例命中与本地案例混在同一个列表里 | 两者证明力不同：「方法适用」与「本项目做过」混排会让人把先例读成自有经验 |
| 让 `cases/` 目录直接随 `.astraviapkg` 发布 | 打包只含 `dist`；且先例要在没有文件系统的读端展示，正文必须内联 |

## 实现核对（2026-10-27，版本 2.11.0）

本篇是当前案例层的基准文档：下面每行都能在代码里找到落点，且没有一条被后来的 ADR 取代——ADR 0007 改的是
D10 的表述（文本可以搬），ADR 0008 加的是 `tools/` 与 `scaffold_case`，两者都不推翻本篇的门禁与命名。

重跑：

```bash
cd abilities/plugins/hanshuang-pojia
npm run test              # 含 case-contract / case-library / case-tools / case-precedents
npm run verify:generated  # 报 "precedents ok: 19 packages"
node scripts/check-precedent-package.mjs --all
```

| 决策 | 当前落点（Observed） | 结论 |
| --- | --- | --- |
| D1 目录逐字对齐 `case-init.ps1`（`report/` 单数） | `src/tools/case/init-task.ts:51-58` 写死 `samples/exports/report/evidence/notes` + `scope.md`/`timeline.md`/`workitems.md` | 成立 |
| D2 `scope.md` 九节 + `- offline_sample:` | `src/domain/case/contract.ts` 按顺序输出 `## meta` / `## auth` / `## in_scope` / `## out_of_scope` / `## network_profile` / `## deliverables` / `## constraints` / `## signoff` / `## ops_refs`（`:244`–`:307`）；`- offline_sample:` 在 `:277` | 成立 |
| D3 三档预设自带授权 | `CASE_PRESETS`（`contract.ts:114` 起）：`own-system` / `ctf-public` 与 `offline-sample` 均 `authStatus: "granted"`，其余字段各自不同 | 成立 |
| D4 `ready_for_act` 只能是推导值 | `AUTHORISED_STATUSES = ["granted"]`（`contract.ts:200`）；就绪对象 `ready: boolean` + `blockers`（`:182`/`:221`）；`init_task` 入参无 `ready_for_act`，只有 `auth_status` / `preset` 等 | 成立 |
| D5 `MAX_NAME_CHARS = 64`（上游 80） | `contract.ts:23`，超长在 `:30` 处 `trim`/`slice` 后报错，不静默截断 | 成立 |
| D6 `timeline.md` 只追加 + `workitems.md` 表 | `journal.ts` 的条目头为 `## <iso> \| <role> \| <kind>`（`contract.ts:318`）；`library.ts:146` 只读表格行、`cells.length < 6` 跳过、第六列为 `status` | 成立；代码只要求 ≥6 列，不校验“八列”这个模板细节 |
| D7 `search_cases` 只扫 `cases/` 与 `work/` | `CASE_NAMESPACE_DIRS = ["cases", "work"]`（`library.ts:55`）、`MAX_CASE_DIRECTORIES = 200`（`:56`）、截断计数 `:245` | 成立 |
| D8 先例三源 | `src/domain/case/precedents.ts:1` 引 `SHIPPED_PRECEDENTS`（`precedents.generated.ts`），本地案例与随包先例分开排名，不混一个列表 | 成立 |
| D9 决策记录落在 `.agents/notes/{implemented,rejected}/<分类>/<日期>-<slug>.md` | `journal.ts:3-6` 注释写死路径；`DecisionStatus = "implemented" \| "rejected"`（`:19`）、`DECISION_STATUSES`（`:20`）、标题无字母数字时报 `:41` | 成立 |
| D10 语料不随包 | **已被 ADR 0007 D2 改写**：不搬制品，但文本（方法摘要 + 原文走查）随包 | 已取代 |
| D11 面板 Cases 页只读 | `src/features/workbench/components/pages/cases.tsx`；`PageId` 含 `"cases"`（`state.ts:8`），`hooks/use-workbench.ts:340` 只在当前页是 cases 时拉数据 | 成立 |
| D12 随包先例包只发方法、`scope.md` 恒 `pending`（当时 5 个） | 现 **19** 个（`npm run verify:generated` → `precedents ok: 19 packages`；`precedents.generated.ts` 446 KB）；`check-precedent-package.mjs --all` 19 包全过 | 成立，计数已变 |
| D13 编译进 `precedents.generated.ts` | `scripts/sync-precedents.mjs`；`npm run verify:generated` 的第三条 `--check` 就是它 | 成立 |
| D14 两个结果段（先例 / 本地） | `search-cases.ts:18` `library?: boolean`、`:20` `precedent?: string`；权重 `SIGNAL_WEIGHT = 6` / `TITLE_WEIGHT = 3`（`precedents.ts:21-22`） | 成立 |
| 后果：工具 28 → 30 | 现 **31**（`src/tools/ids.ts:50`） | 计数已变 |
| 后果：页面 16 → 17 | `PageId` 17 项（`state.ts:8`） | 成立 |
| 后果：`src/domain/case/` 四文件 | 现 **6** 个：`contract.ts` / `journal.ts` / `library.ts` / `precedents.ts` / `precedents.generated.ts` / `scaffold.ts` | 多两个 |
| 后果：`src/tools/` 拆七类 | 现七个分类目录：`apk` / `case` / `env` / `knowledge` / `lib` / `native` / `report`（+ `ids.ts` / `register-tools.ts`） | 成立 |
| 背景：文档 309 篇 | 现 340 篇（`kb` 292 / `manual` 11 / `kit-docs` 7 / `cases` 30） | 计数已变 |

一处表达上的坑：本篇 D6 把 `workitems.md` 写成“八列”，而解析器只依赖“≥6 列、第六列是状态”。改模板列顺序会静默
把 `surface` 读成 `status`，而不会报错——这一条值得将来补一条断言，现在没人守。


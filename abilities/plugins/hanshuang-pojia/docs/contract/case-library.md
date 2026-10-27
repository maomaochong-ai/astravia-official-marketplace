# 案件契约与战例库

> 面向改这份代码的人。决策依据见 [ADR 0006](../../../../../docs/adr/hanshuang-pojia/0006-case-contract-v2-and-precedent-library.md)（案例契约）与 [ADR 0007](../../../../../docs/adr/hanshuang-pojia/0007-case-corpus-layer.md)（语料层）；
> 用户视角的操作步骤见 [USAGE.md](../../USAGE.md)；界面逐页说明见随包手册
> [PANEL-HANDBOOK.md](../../src/content/docs/manual/PANEL-HANDBOOK.md)。

上游 `seep-kit 2.0` 把案例当一等对象，由 `Tool/scripts/case-init.ps1`（契约）与 `Tool/cases/`
（14 个可复现发布包＝先例）共同构成。本插件对齐的是**机制**：契约由 `init_task` 逐节产出，先例由
两处提供——操作者自己目录里的真实案例（`search_cases`），以及随包发布的方法级先例包（`cases/`）。
上游那 14 个工程本身不随包（ADR 0001 §2.3）。

## 一、目录契约

```text
<root>/<case>/
├── scope.md         # 九节声明：授权、范围、范围外、网络姿态、交付物、约束、签署、引用（写一次）
├── timeline.md      # 只追加的事件块
├── workitems.md     # 八列 WI 表 + 覆盖清单
├── README.md        # 接续说明（ready / 未 ready 两套文案）
├── auth-log.md      # 授权晚到时的追加记录（只在授权变更时出现）
├── samples/         # 受检字节
├── exports/         # 反编译 / 反汇编 / 字符串导出与复现脚本
├── report/          # 评估报告（单数，与上游同名；write_assessment_report 落这里）
├── evidence/        # 证据条目 E-001…，README.md 写编号约定
└── notes/           # 案例内工作笔记
```

**判定规则**：`cases/` 与 `work/` 的**直接子目录**里存在 `scope.md` 才算案件。没有声明就没有案件——
一份样本躺在 `samples/` 里不构成可引用的先例。

为什么只扫两层：全库递归在 monorepo 上代价不可控，而案例位置本来就是约定。上限 200 个目录，
超出部分计入 `truncated`，索引会明说结论不完整，而不是静默截断。

## 二、`scope.md` 的九节

| 节 | 内容 | 未提供时 |
|---|---|---|
| `## meta` | `case_id`、`created`、`operator`、`project_root`、`primary_skill`、`primary_id`、`lead_role`、`specialist_roles`、`hint`、`preset` | 写 `(not provided)` / `[]` |
| `## auth` | `status`（`pending` / `granted` / `denied` / `unknown`）、`basis`、`evidence_of_auth`、`MUST NOT proceed` 行 | `pending` + `(not provided)` |
| `## in_scope` | `- assets:` 缩进列表、`surfaces`、`activities` | `[]` |
| `## out_of_scope` | `- assets:` 缩进列表、`activities` | `[]` |
| `## network_profile` | `mode`（四值）、`offline_sample`、`notes` | `offline` + `(none)` |
| `## deliverables` | `report` / `field_journal` / `diagrams` / `timeline` + `- planned:` | 布尔默认 + `[]` |
| `## constraints` | `timebox`、`stealth`、`data_handling`、`- rules:` | `(not provided)` |
| `## signoff` | `ready_for_act` 推导结果、五项 checklist、`blockers` | 总是写出 |
| `## ops_refs` | 本插件内真实可读的方法论文档 id | 总是写出 |

`scope.md` 写一次不再改写。要改范围就开新案例——在旧声明上改，等于让「当时授权了什么」失去凭据。

**授权晚到**走 `auth-log.md`，不走 `scope.md`（ADR 0009）。范围是开工前的快照，授权却是个事件：工单可能在
案例已建好后才开。日志只追加、按块读，**最后一块的 `status` 生效**，没有 `status` 的块被跳过而不是猜测。
`init_task` 第二次带 `auth_status` 进来时写这一块并同步追加一条 `auth` 时间线事件；状态没变就不写。

```text
# Authorisation log — <case>

## 2026-10-27T12:00:00.000Z | granted
- basis: ticket SEC-1042
- evidence: jira/SEC-1042
```

`## network_profile` 里的 `offline_sample` 是对上游格式的**加法**：上游只在写入时算一次门禁，
本插件的索引与面板要**从文件反推**，而离线档案的就绪判据包含「有样本」（见第三节）。

## 三、就绪门

```text
ready_for_act = auth.status === "granted"
              ∧ in_scope 非空
              ∧ (network_profile !== "offline" ∨ 存在离线样本)
```

第三条是最容易写反的一条：离线档案**必须有样本**，否则「离线」意味着没有任何受检对象，门却亮着。
`assessReadiness` **不接受** `ready` 入参——门禁是推导值。`search_cases` 与面板都会**重新推导**，
不信任 `scope.md` 里写的 `- ready_for_act:` 行（手改那一行不会让一个未授权的案例变得可动）。
`init_task` 回报的门禁同样来自磁盘：`scope.md` 已存在时读 `scope.md` + `auth-log.md` 重算，
不按内存里传进来的 brief 回报（旧实现会因此报出一个磁盘上并不存在的 `ready`）。

三条判据都是**正向枚举**，不是排除法。手写的 `scope.md` 写了别的词（`status: yes`、`profile: lan`），
结果不是「看不大对但能用」而是多一条阻断项——未知词与 `pending` 一样把门关着。

结论渲染成一句话带理由（`readinessLine`），不是裸布尔：`ready_for_act: no — authorisation not
recorded (auth_status=pending); no in-scope assets declared`。

## 四、三档预设

| 预设 | 别名 | auth_status | auth_basis | network profile |
|---|---|---|---|---|
| `offline-sample` | `own-sample` / `local-sample` | `granted` | `own_system` | `offline` |
| `ctf-public` | `ctf` | `granted` | `ctf_public` | `authorized_target_only` |
| `own-system` | `lab-only` | `granted` | `own_system` | `lab_only` |

预设**会**写授权状态（这是上游的实际行为），但**不带资产**：凭空写一条 `in_scope` 会把门点亮而实际
什么都没纳入范围。资产只来自 `target` / `sample` / `in_scope`，去重后写进声明。

两条纪律：只有调用方**显式命名预设**时才套用它的授权（裸调 `init_task` 保持 `pending` + `offline`）；
未知预设硬失败并列出可选项——静默退化成默认档会让一份授权案例看起来像没授权。

`network_profile` 也接受上游的四个别名：`lab` → `lab_only`、`authorized` / `auth` →
`authorized_target_only`、`offline_only` → `offline`。

## 五、四个工具

| 工具 | 做什么 | 不做什么 |
|---|---|---|
| `init_task` | 建五个目录 + 四份文件 + `evidence/README.md`，写九节声明、播种 WI（`WI-001` 恒为 bootstrap）、写首个 timeline 块 | 不下载样本、不生成报告 |
| `search_cases` | 扫 `cases/` `work/`，按查询排序，回路径 / 命中理由；默认再附上随包先例（`library: false` 关掉），有工具时多一行 `- tools:` | 不回正文（正文用 `read`） |
| `scaffold_case` | 把先例包的 `tools/` 与共享 `hpkit` 落盘（默认 `<cwd>/<slug>`），回确切命令行 | 不执行任何脚本、不覆盖已有文件（除非 `overwrite`）、不改授权门 |
| `record_case_note` | 写 `.agents/notes/{implemented,rejected}/<分类>/<日期>-<slug>.md`，追加 timeline | 不建案例（案例不存在就报错并指向 `init_task`） |

名称校验 `assertCaseName` 在上游正则语义上放宽了 Unicode（中文案例名是常态），但仍拒绝路径分隔符、
`..`、通配符、尾随点与空格；上限 64 字符（`MAX_NAME_CHARS`，上游 80），因为下面还要套
`evidence/E-###-<slug>.md` 与 `.agents/notes/<status>/<category>/<date>-<slug>.md` 两层文件名。

## 六、先例检索

两个源，分开报告：

1. **本机案例** — `search_cases` 扫 `cases/` `work/`。排序权重：案例名命中 6 / in-scope 资产命中 3 /
   预设与交付物命中 1 / 就绪 +1，同分按名字字典序。有查询时**只返回命中项**——就绪加分作用在排序上，
   不会把不相关的案例拉回结果里。
2. **随包先例** — `cases/<slug>/` 的 19 个方法级先例包（5 个本插件自写 + 14 个由上游案例派生）。
   权重：信号 6 / 标题与摘要 3 / 方法正文 1。
   命中只说明「这个方法适合你现在的信号」，不说明「这个项目里做过这个目标」，所以工具把它排在
   本地案例之后单独成段，面板也是单独一张表。

第三个源是**随包实战记录**（`kb/field_journal_*`、`kb/*/techniques/*`），用 `search_docs` / `read_doc`
读，不参与 `search_cases` 的排序——它们没有案例形状，混进来只会稀释命中。

### 随包先例包

```text
cases/<slug>/
├── case.json      # slug / title / summary / signals / preset / fieldNotes / caseDocs / source / docs
├── README.md      # 适用信号 + 工作形状 + 陷阱 + 必须能拿出的证据
├── scope.md       # 完整九节模板，auth.status **恒为 pending**
├── workitems.md   # 八列 WI 表（bootstrap 行 + 该形状的固定步骤）
├── docs/method.md # 方法：顺序、判据、不该做什么
├── docs/<topic>.md  # 可选：补丁纪律、协议表等案例专属内容
└── tools/         # 可执行层：manifest.json + <entry>.py + 共享 hpkit/


src/content/docs/cases/<slug>/<topic>.md   # 案例原文（中文，文档库一组，惰性加载）
```

四条纪律：

1. **不含样本字节 / 密钥 / 端点 / 第三方制品**；**含**补丁偏移、AOB 特征码、补丁字节表、
   协议字段与算法常量——它们是派生地址而非样本字节（ADR 0007 D2）。
2. 随包 `scope.md` 写 `pending`：随包语料不是操作者的授权，复制后重跑 `init_task`。
3. `fieldNotes` 与 `caseDocs` 只能引用真实存在的文档 id（生成器与测试各拦一次）。
4. 写了 `source`（由上游某案派生）就必须写 `caseDocs`：只转述、不留原文指针的包不算语料。
5. 每个包至少一个 `tools/` 工具，且 `--self-test` 必须退 0（ADR 0008 D4）；工具与 `cases/_shared/hpkit/`
   的源码由 `vite.config.ts` 发布到 `dist/assets/cases/**`，不内联进 JS。

4. 写了 `source`（由上游某案派生）就必须写 `caseDocs`：只转述、不留原文指针的包不算语料。

正文分两层：方法摘要内联进 `src/domain/case/precedents.generated.ts`（`.astraviapkg` 只带构建产物，
`cases/` 不随包发布）；案例原文放 `src/content/docs/cases/`，由 `caseDocs` 指向，`read_doc` 取全文——
这样 350 KB 叙事不会膨大主 JS chunk。`--check` 挂在 `bun run verify:generated` 上。

正文由 `scripts/sync-precedents.mjs` 内联进 `src/domain/case/precedents.generated.ts`：`.astraviapkg`
只带构建产物，`cases/` 目录不会跟着发布。`--check` 挂在 `bun run verify:generated` 上。

## 七、决策记录

```text
.agents/notes/implemented/<category>/<YYYY-MM-DD>-<slug>.md
.agents/notes/rejected/<category>/<YYYY-MM-DD>-<slug>.md
```

`status` 决定一级目录，`category` 是二级（`architecture` / `feature` / `testing` / `process`…）。
已存在就拒绝覆盖，`overwrite` 才放开：先例的价值在于不被悄悄改写。放在 `.agents/` 而不是 `notes/`，
是因为它被视为**跨案例可移植的方法论**——拷走案例时能跟着走，也能被单独聚合。

## 八、测试
| 文件 | 覆盖 |
|---|---|
| `src/test/case-contract.test.ts` | 名称校验、预设解析（含授权与别名）、就绪门三判据、九节渲染、WI 播种 |
| `src/test/case-library.test.ts` | `scope.md` 回读、就绪重算（含离线样本写回）、`auth-log.md` 最后一块生效与无状态块跳过、授权晚到后门禁重开、证据与笔记计数、200 上限、排序与过滤、索引文本 |
| `src/test/case-journal.test.ts` | 笔记路径、拒绝覆盖、timeline 追加、目录创建 |
| `src/test/case-tools.test.ts` | 两个工具端到端（内存 fs）：索引输出、命中排序、越界根、覆盖与缺案例报错、先例库开关 |
| `src/test/case-precedents.test.ts` | 先例包完整性、真实引用、`pending` 纪律、无制品、排序与空态 |
| `src/test/case-scaffold.test.ts` | `hpkit` 模块清单与磁盘一致、`scaffold_case` 写入集合与命令顺序、读取真实工具字节、未执行声明 |
| `src/test/toolchain.test.ts` | `init_task` 建出的目录/文件集合与声明内容、「scope.md 写一次」、授权晚到只写日志与时间线、回报顺序与磁盘一致 |
| `src/test/workbench.test.tsx` | 案例页：扫描、就绪标签、详情展开、先例表 |

## 九、明确不做

- **不 vendor `Tool/cases/` 的 14 个工程**：`dist/*.dll`、keygen、代理 DLL 一律不收（ADR 0008 §2.3）。
  **但文本收**——14 案已按「先例方法 + 原文走查」双层落地，见下节与 ADR 0007。
- **不搬密钥、盐值、卡密、端点、样本哈希**；**搬偏移与特征码**：补丁 RVA、AOB、补丁字节表、
  协议字段表是派生地址而非样本字节，去掉它们先例就只剩口号（ADR 0007 D2）。
- **不把先例包做成「可开工的案例」**：随包语料不是操作者的授权。
- **不建 `patches/` 制品目录**（ADR 0002 D17）。
- **不复刻 PowerShell 形态**：插件没有 PowerShell 运行时，对齐行为而非形态。
- **面板不写盘**：建案例、追加时间线、写笔记都走工具，页面只读。

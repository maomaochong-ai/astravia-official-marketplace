# ADR 0007：案例语料层——上游 14 案以「先例 + 原文」双层落地

- 日期：2026-10-27
- 状态：已采纳（2026-10-27）
- 核对：2026-10-27（版本 2.11.0），见文末「实现核对」
- 关联：[0001](./0001-seep-kit-capability-parity.md)、[0006](./0006-case-contract-v2-and-precedent-library.md)、
  [../contract/case-corpus.md](../../../abilities/plugins/hanshuang-pojia/docs/contract/case-corpus.md)

## 背景

ADR 0006 把上游 `Tool/cases/` 的**契约层**做对了（`scope.md` 九节、`workitems.md`、预设、就绪门），
但把**语料层**整块留在了门外：D10 重申「语料不随包」，D12 只允许先例包写方法级描述，并明确
「不含偏移」。结果是先例机制跑得很顺，但它检索的是 5 个自己写的形状，上游那 14 个真正打过的案例
一篇都没进来。

这正是「机制有了、内容没有」的形态。ADR 0001 的愿景是**能力对等**，不是「有同名工具」。
语料层的价值不是那 5.4 MB 的工程，而是 1.7 MB 的文本里那些**判定式、补丁表、否证记录**：
「无 ASLR + RWX 段 = 免脱壳」「改条件跳转而不是改返回值」「A/B/C 对照才定最小补丁集」。
这些恰恰是最容易被"脱敏"脱没的部分——去掉偏移和特征码，剩下的只是一段心得。

## 决策

### D1 语料分两层，正文不进任何 JS 分块

```text
cases/<slug>/                       先例包（随包，编译期内联进 precedents.generated.ts）
├── case.json                       身份 + 信号 + 指针（caseDocs / source）
├── README.md   scope.md   workitems.md   docs/method.md     四份规范文档
└── docs/<topic>.md                 可选：案例专属文档（补丁纪律、协议表…）

src/content/docs/cases/<slug>/<topic>.md     案例原文（随包，纯文本，惰性加载）
```

理由：把 14 案约 350 KB 正文内联进 `precedents.generated.ts` 会让主 JS chunk 同步膨胀
（gzip 后约 120 KB），而文档库本来就是分离文件、按需 fetch、零 JS。所以正文走文档库，
先例包只留方法与指针。新增 `cases` 文档组不需要改构建（`vite.config.ts` 的
`hanshuang-pojia-runtime-resources` 对 `src/content/docs/**` 做通用 `walk`）。

> **2026-10-27 补记（ADR 0008，初拟编号 ADR 001）**：`cases/<slug>/tools/` 是可执行层，**不内联**。它由
> `vite.config.ts` 另行 `emitFile` 到 `dist/assets/cases/**` 以真实文件发布，再由 `scaffold_case`
> 落盘后执行——脚本不在磁盘上就无法运行。两层分工不变：正文讲当时怎么判断，工具跑当时算了什么。

### D2 修正 D10：搬文本，不搬制品

ADR 0001 §2.3 与 ADR 0006 D10 的禁令，**范围收窄到制品与样本字节**，不再覆盖派生信息：

| 类别 | 处置 |
| :--- | :--- |
| `.dll` / `.jar` / `.exe` / `.zip` / `.png` / `dist/` / keygen 二进制 | 不收（D10 原意不变） |
| 密钥、盐值、卡密、令牌、私钥、真实端点 | 不收（安全边界不变） |
| 真实产品名、公司名、客服信息、带用户名的绝对路径、机器名 | 脱敏为 `项目X` / `<AUTH-SRV>` |
| 样本哈希 | 只保留占位形式 `<实测哈希>` |
| **补丁偏移、RVA、AOB 特征码、补丁字节表、协议字段表、算法常量** | **收**（本轮修正） |

最后一行是本文的关键修正。偏移与特征码是**派生地址**，不是样本字节：它描述「去哪看、改哪几个位」，
没有它就只剩一句「改条件跳转」。ADR 0006 D12 的「不含偏移」把语料降级成了口号，本文撤回该限制。

### D3 修正 D12：`docs` 契约由「恰好四份」放宽为「四份前缀 + 追加」

原测试用 `toEqual` 断言恰好四份文档，这使「补丁全表」「协议结构」这类案例专属内容无处可放。
改为：`docs` 必须**以四份规范文档开头且顺序一致**，其后允许任意案例专属文档。
生成器、单包校验器、测试三处同步——测试由 `toEqual` 改为 `slice(0,4)` 比对。

`scope.md` 纪律不变：随包恒 `pending` / `ready_for_act: false`。

### D4 溯源强联动：有 `source` 就必须有 `caseDocs`

先例包新增两个可选字段：

```json
"caseDocs": ["cases/<slug>/<topic>"],                 // 文档库 id，read_doc 可直接取
"source":  { "library": "seep-kit 2.0", "entry": "Tool/cases/项目J" }
```

`source` 表示这份先例由上游某案派生；`caseDocs` 指向它的原文。
校验规则：**写了 `source` 就必须写 `caseDocs`**。只转述、不留原文指针的包不算语料——
读者无法验证转述是否忠实，而这正是「阉割」最容易发生的地方。

### D5 单一校验器：`scripts/lib/precedent-package.mjs`

整树生成器（`sync-precedents.mjs`）与单包 CLI（`check-precedent-package.mjs`）共用一份校验逻辑，
使并行编写单包的人在整树尚未完成时也能自检：

```bash
node scripts/check-precedent-package.mjs <slug>     # 单个
node scripts/check-precedent-package.mjs --all      # 全部
```

校验项：`schemaVersion`、slug 与目录一致、title/summary 非空、`signals` 非空、`preset` 合法、
`fieldNotes` 与 `caseDocs` 指向真实文档、`docs` 前缀顺序、每篇正文 > 200 字符、
不泄漏绝对用户路径、包内禁扩展名、`source`/`caseDocs` 联动。

### D6 `signals` 必须是具体标识，且不得抢占既有排名断言

- 禁用含 `license` 子串的 signal：`rankPrecedents("license")[0]` 必须仍是 `client-auth-gate`。
- 禁用 `kerberoasting`（已有专属包）。
- signal 应是工具名、算法名、文件格式、API 名或具体术语，允许中文（如「卡密」）。
- 保留断言：`pinning → android-ssl-pin-bypass`、`license → client-auth-gate`、
  `upx → elf-packed-loader`、`webpack → js-sign-chain`。

这条不是洁癖：`rankPrecedents` 按分数排序、同分按 slug 字母序，多一个 `license` 变体就会
把 `aob-…` 顶到第一位，让「一次命中」的检索变成噪音。

### D7 语言分工：摘要是英文，原文保留中文

四份规范文档与案例专属文档用英文（与既有 5 包、`search_cases` 输出一致，agent 侧统一读一种语言）；
`src/content/docs/cases/` 的原文保留中文原貌。不做英文重译，避免补丁表与协议表在翻译中漂移。

## 影响

- 先例包 5 → 19；文档库 309 → 约 339 篇（14 案 × 2 篇左右）。
- `README.md`、`vite.config.ts` 注释、`USAGE.md` 里的文档计数需要跟着改。
- `cases/README.md` 表格与 `docs/contract/case-library.md` 第九节「明确不做」需要按 D2 改写。
- 版本 `2.10.0 → 2.11.0`。

## 不做

- 不搬上游 `src/`、`dist/`、`build.ps1`、`SHA256SUMS.txt`。
- 不把先例包做成可开工的案例（授权仍是操作者的事）。
- 不为语料新增运行时依赖、不改 `search_docs` 的检索路径。

## 实现核对（2026-10-27，版本 2.11.0）

本篇的两层结构（包内契约 + 文档库原文）在 2.11.0 原样成立，校验器、断言与计数均可重跑。
ADR 0008 随后在包内加了 `tools/` 可执行层，但它不动本篇的文档契约。

重跑：

```bash
cd abilities/plugins/hanshuang-pojia
node scripts/check-precedent-package.mjs --all   # 19 包 + 每个工具的 --self-test
npm run verify:generated                       # precedents ok: 19 packages
npm run test                                   # 含 src/test/case-precedents.test.ts
find src/content/docs/cases -name '*.md' | wc -l  # 30
```

| 决策 | 当前落点（Observed） | 结论 |
| --- | --- | --- |
| D1 语料两层：包内契约文档 + 文档库原文 | 包内四份：`README.md` / `scope.md` / `workitems.md` / `docs/method.md`；深读原文在 `src/content/docs/cases/<slug>/` | 成立 |
| D2 不搬制品，但文本收 | `cases/<slug>/` 下只有 `.md` / `case.json` / `tools/*.py`，无 `.dll`/`.exe`/`.ps1`；`docs/contract/case-library.md:177` 「**但文本收**」 | 成立 |
| D3 `docs` 契约 = 四份固定前缀 + 可追加 | `scripts/lib/precedent-package.mjs:19` `CANONICAL_DOCS`，`:201` 按序前缀比对，`:204` 去重 | 成立（用“前缀比对”而非 `slice(0,4)`） |
| D4 `source` 与 `caseDocs` 强联动 | `precedent-package.mjs:240-248`：有 `source` 就必须有非空 `caseDocs`，否则报 `a derived package must point at its caseDocs` | 成立 |
| D5 单一校验器 | `npm run check:cases` → `node scripts/check-precedent-package.mjs --all`；阈值 `CASE_DOC_MIN_CHARS:33` / `TOOL_MIN_BYTES:36` | 成立 |
| D6 `signals` 不得抢占既有排名断言 | 四条断言仍钉在 `src/test/case-precedents.test.ts:128-131`（pinning / license / upx / webpack）；`case-tools.test.ts:166` 仍要求 `android-ssl-pin-bypass` 入选 | 成立 |
| D7 摘要是英文、原文保留中文 | `cases/client-auth-gate/docs/method.md` 英文；`src/content/docs/cases/client-auth-gate/entitlement-decision.md` 中文，4,463 字符（> 3,000 阈值） | 成立 |
| 影响：先例包 5 → 19 | 19（`verify:generated` 输出） | 成立 |
| 影响：文档 309 → 约 339 | 现 **340**（14 案 × 2 篇的估算偏低，实际多出 1 篇） | 成立，数字略差 |

一个值得记下的实现细节：`caseDocs` 的 id 是**相对 `src/content/docs` 的路径**（如 `cases/client-auth-gate/entitlement-decision`），
而 `docs` 的 id 是**包内相对路径**。两者基准不同，写错时校验器分别报 `caseDocs id has no document`（`:230`）
与 `doc listed but missing`（`:212`），不会混。


# ADR 007：案例语料层——上游 14 案以「先例 + 原文」双层落地

- 日期：2026-10-27
- 状态：已采纳
- 关联：[0001](./0001-seep-kit-capability-parity.md)、[0006](./0006-case-contract-v2-and-precedent-library.md)、
  [../contract/case-corpus.md](../contract/case-corpus.md)

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

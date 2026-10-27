# 案例语料编写契约

面向在本仓库补齐先例语料的人与 AI。规则来自 [ADR 0007](../../../../../docs/adr/hanshuang-pojia/0007-case-corpus-layer.md)；
[case-library.md](./case-library.md) 讲机制，本文只讲**怎么交一个合格的包**。

一个案例落地成**两份东西**：

```text
cases/<slug>/                              先例包：方法摘要（英文）
├── case.json
├── README.md
├── scope.md
├── workitems.md
├── docs/method.md
└── docs/<topic>.md                        可选，案例专属

src/content/docs/cases/<slug>/<topic>.md   案例原文（中文，1–3 篇）
```

## 1. 身份字段

`case.json`（**tab 缩进**，与本目录其它文件一致）：

```json
{
	"schemaVersion": 1,
	"slug": "<目录名，逐字一致>",
	"title": "One line, what the case proves",
	"summary": "One or two sentences: the shape of the target and the decisive fact.",
	"signals": ["cardkey", "卡密", "ws2_32"],
	"preset": "offline-sample",
	"fieldNotes": ["kb/field_journal_precedent-auth", "kb/field_journal_precedent-reverse"],
	"caseDocs": ["cases/<slug>/<topic>"],
	"source": { "library": "seep-kit 2.0", "entry": "Tool/cases/项目X" },
	"docs": ["README.md", "scope.md", "workitems.md", "docs/method.md", "docs/<topic>.md"]
}
```

- `preset`：`offline-sample`（默认）| `ctf-public` | `own-system`。
- `fieldNotes`：只允许引用已存在的文档 id（`kb/field_journal_precedent-auth`、
  `kb/field_journal_precedent-reverse` 是最常用的两条）。
- `caseDocs`：文档库 id，**必须**与 `src/content/docs/cases/<slug>/` 下的文件名对应。
- `source.entry` 用上游目录名（`项目A`…`项目N`），这是溯源，不是展示名。
- `docs`：前四项固定且顺序不变，之后可追加本案例专属文档。

## 2. 四份规范文档写什么

**`README.md` — 适用信号 / 工作形状 / 陷阱 / 证据清单**

- `## When this package applies`：什么条件下该走这条路；不适用时指向哪个包（交叉链接）。
- `## Shape of the work`：5–8 步，每步一句"该产生什么事实"，不写命令。
- `## Traps that cost real time`：真实踩过的坑，每条说清后果。
- `## Evidence this package expects you to produce`：读者最后必须拿得出的东西。
- 末尾 `## Reading further` 指回 `docs/` 与 `caseDocs`。

**`scope.md` — 九节模板，授权恒为 pending**

照抄 `cases/cardkey-online-runtime-patch/scope.md` 的结构（`## meta` `## auth` `## in_scope`
`## out_of_scope` `## network_profile` `## deliverables` `## constraints` `## signoff` `## ops_refs`），
必含 `- status: pending` 与 `- ready_for_act: false`。`hint` 一行写清这个形状的关键判据。
`network_profile.mode` 按 preset 取 `offline`（`offline-sample`）/ `unrestricted_lab`（`ctf-public`）/
`offline`（`own-system`）。

**`workitems.md` — 八列 WI 表 + 覆盖清单**

`| ID | title | role | targets | surface | status | evidence | notes |`，8–12 行，`WI-001` 恒为
「Establish scope and auth」。`## Coverage` 与 `## Refs` 照模板保留。

**`docs/method.md` — 顺序、判据、不该做什么**

不写偏移、不写密钥。写「先看什么决定路线」「什么现象说明走错了」「什么时候停」。
判据要可操作：能落到一条命令、一次观察或一次对照实验上。

**`docs/<topic>.md` — 案例专属**

补丁纪律与补丁表、协议字段表、算法结构、脱敏后的工具链。**这里放偏移和特征码**
（ADR 0007 D2），但地址必须是「教学值 + 现场重新定位的方法」，不要让人照抄偏移。

## 2.1 `tools/` — 可执行层

包里的 `tools/manifest.json` + `tools/*.py` 是「再来一次」的部分：文本回答该看什么，脚本把能机检的
那几步真的算一遍。每包至少一个工具，ADR 0008 D4 要求它用代码生成的合成样本自证可跑。

`manifest.json`（校验器逐字段查）：

| 字段 | 约束 |
| :--- | :--- |
| `schemaVersion` | `1` |
| `slug` | 与包目录名逐字一致 |
| `runtime` | `python`（默认）或 `node` |
| `platforms` | `["any"]`；只在真调 Win32 时才写 `["win32"]` |
| `tools[]` | `id` 匹配 `^[a-z][a-z0-9_]*$` 且唯一；`entry` 扩展名与 `runtime` 对应 |
| `tools[].purpose` | ≥ 20 字符，说清楚它产出什么事实 |
| `tools[].args` | 示例参数，用 `<value>` 占位 |
| `tools[].selfTest` | 必含 `--self-test` |

脚本纪律：

- Python 3.9+ 标准库，零第三方依赖，纯 ASCII；解释器由 `ASTRAVIA_PYTHON` 覆盖。
- `import hpkit` 取共享原语（`cli` `pe` `scan` `patch` `dex` `fixtures`）；源码树布局下用
  `cases/_shared` 回退，scaffold 布局下命中同目录的 `tools/hpkit/`。
- 入口 `sys.exit(cli.run(main, self_test))`，`--self-test` 走合成样本，退出码 0。
- 必须真算：打印写死的示例结论、或断言恒真是缺陷。
- 不写绝对路径、不连网、不碰真实样本；工具只读输入，只输出报告与（显式要求时）补丁副本。


## 3. 案例原文写什么

`src/content/docs/cases/<slug>/<topic>.md`，中文，保留上游的技术事实与结构化细节：

- 首行 `# <标题>`（导航树用它作标题）。
- 明确标注证据等级：`[observed]` / `[inferred]` / `[unverified]`。
- 保留上游的**否证与限制**章节（「未验证项」整节必须留）——那是可信度所在，不是可删的附录。
- 桌面端渲染纯 Markdown，表格与代码块正常显示。

篇幅：每篇 ≥ 3000 字符；总量以「读者能照着重做一遍判定」为准。

## 4. 脱敏（逐项过一遍）

| 必须处理 | 处理方式 |
| :--- | :--- |
| 真实产品名 / 公司名 / 客服信息 | 换成上游已有的 `项目X` 称谓 |
| 带用户名的绝对路径（`D:\Users\…`）、机器名 | 删除或换成 `<workdir>` |
| 端点、域名、IP | `<AUTH-SRV>:4001` 这类占位 |
| 密钥、盐值、卡密、令牌、私钥、证书 | **删除**（示例输入如「任意卡密 `123456`」可保留） |
| 样本哈希 / SHA256 | `<实测哈希>` |
| 制品与样本字节（`.dll` `.jar` `.exe` `.zip` `.png` `.db`） | 不收；说明"归档里有、本仓库不带" |
| 补丁偏移 / RVA / AOB / 补丁字节 / 协议字段 / 算法常量 | **保留** |
| 上游自带的免责声明 | 不必搬；我们的边界由 `scope.md` 与 ADR 0007 表达 |

上游 14 案已做过一轮脱敏，但**不能假定干净**：项目 M 的标题就直写真实产品名，并给出
`D:\Data\<Product>\<Product>.exe` 与 `<product>.jar` 的构建号。逐案复核。

## 5. signals 纪律

- 每个包 8–12 个，必须是**具体标识**：工具名、算法名、文件格式、API 名、宿主语言、壳名。
- **不得含 `license` 子串**（会抢走 `client-auth-gate` 的首位）。用 `cardkey` / `activation` /
  `entitlement` / `isPro` 等具体词。
- 不得含 `kerberoasting`。
- 中文 signal 允许且有用（「卡密」「壳」），但至少一半要是英文技术词。
- 写完自检：`node --test src/test/case-precedents.test.ts` 里的四条排名断言必须仍绿。

## 6. 自检

```bash
node scripts/check-precedent-package.mjs <slug>   # 单包：结构、长度、caseDocs、禁扩展名、指针、tools 静态校验
python3 cases/<slug>/tools/<entry> --self-test    # 单工具：合成样本自证，退出码 0
node scripts/check-precedent-package.mjs --all    # 全量 + 逐工具真跑（发布前必跑）
node --test src/test/case-precedents.test.ts      # 排名与契约
```


`✓ cases/<slug> docs=N (+M) caseDocs=K` 说明结构与指针都过了；正文质量它管不了。

## 7. 并行编写时的边界

多人（或多个 agent）同时补包时：

- **只写** `cases/<你的 slug>/` 与 `src/content/docs/cases/<你的 slug>/`；
- **不要运行** `node scripts/sync-docs.mjs`（`index.json`、`docs.sha256`、`assets.json` 是整树产物，
  并发写会互相覆盖）；
- **不要运行** `node scripts/sync-precedents.mjs`（同上）；
- **不要改**共享文件：`src/test/*.test.ts` 的计数、`cases/README.md` 的表、
  `docs/adr/hanshuang-pojia/*`（仓库根，不在插件内）、`scripts/*`、`locales/*`；`cases/_shared/**` 也是共享的，新原语由集成者加，
  不自己往里面塞。
- 整树生成与集成由一个人在全部包落地后统一执行。

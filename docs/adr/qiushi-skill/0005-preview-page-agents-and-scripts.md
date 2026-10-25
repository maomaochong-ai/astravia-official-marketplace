# ADR-0005：补全介绍页、agents 与 scripts，并让内部路由真正可解析

## 状态

已接受。补充 [ADR-0004](./0004-single-skill-with-internal-routing.md)（单技能包 + 内部路由）而不推翻它：**形态不变，仍是 1 条面板条目**；本 ADR 只修「路由是否真能解析」「展示用什么承载」「`agents/` 与 `scripts/` 放什么」「`upstream.json` 该不该变成脚本」四件事。

[ADR-0002](./0002-upstream-fidelity-and-content-boundaries.md) 的逐字节保真继续有效：本 ADR 不修改任何下游 `GUIDE.md` 与参考文件，路由可解析性在入口层解决。

上游基线不变：`HughYau/qiushi-skill` `2.0.0`（commit `5ace7173b2d71fa7848c56a29f74b39d611c6cb3`）。

> **已被 [ADR-0007](./0007-filename-ledger-and-preview-entry.md) 取代（2026-10-25）**：下游正文的文件名改回与上游一致的 `SKILL.md`，重复注册改由 `references/skills/.ignore` 阻断。本文记录的是当时的决定与理由，正文不再追改。

## 背景

ADR-0004 把 11 个平级条目收敛成 1 个包后，有三个问题没被回答，另有一份文件的性质待定。

**一、入口正文「相对本文件所在目录」，宿主里没有这个信息。** 面板与 `skills.query` 暴露的字段只有 `name` / `alias` / `description` / `source` / `type`（Observed：`skills.query` 返回 130 条，字段就这些，没有安装路径）；`invoke_skill` 也只回正文，不回目录。也就是说模型拿到路由表时，**并不知道 `references/skills/...` 该从哪个前缀开始拼**。仓内已有先例把它写死：`kali-linux` 的 `SKILL.md` 第 16 行定义 `$SKILL` 为「本文件所在目录」，第 259 行要求自行解析成绝对路径；`docx` 则直接用 `references/xxx.md` 相对写法。安装器会把整个包复制到 `~/.astravia/skills/<slug>/`（Observed：`~/.astravia/skills/pdf/` 下 `agents/`、`assets/`、`references/` 与 `SKILL.md` 同级齐备），所以「包内相对路径」在安装后依然成立，缺的只是**根在哪**这一句话。

**二、`workflows` 的引用对象在本包里改了名。** 上游 `skills/workflows/SKILL.md` 出现三类标识：裸 slug（`investigation-first` 等）、斜杠命令（`/contradiction-analysis`）、以及「回到 `arming-thought` 路由表」（Observed，该文件第 23–27、29–33、37–45、51–58 行）。本包里入口叫 `qiushi-skill`，下游统一叫 `GUIDE.md`，`commands/` 与 `arming-thought` 目录都不存在。按 ADR-0002 我不能改这份正文，于是**不解决就无法兑现「被引用即可抵达」**。

**三、介绍页与两类目录资产没进包。** 上游 `docs/index.html`（32 KB）是给人类看的图文介绍，`docs/assets/` 提供它引用的两幅字标图；`agents/` 提供两个可派遣角色。当前包只搬了方法论正文，用户在面板里看不到任何「这是什么」的直观说明，也没有可派遣的调查员与审查员。

**四、`upstream.json` 是不是该改成脚本。** 它现在是一份 24 条文件映射 + 6 条改动声明的台账，没有任何消费者：CI 不读、测试不读、宿主不读。

## 决策

### 1. 在入口定义 `$SKILL`，并用别名表把上游标识映射到本地路径

`SKILL.md` 顶部新增一段「这份正文在哪」：`$SKILL` = 本文件所在目录，市场安装后的默认位置写全（`~/.astravia/skills/qiushi-skill/`），并给一条不依赖绝对路径的定位法（按 `**/qiushi-skill/references/skills/*/GUIDE.md` 找）。路由表保持「一行一个 `references/skills/<slug>/GUIDE.md`」不变。

同时新增一张三行别名表，专门消解上游标识在本包里的改名：

| 上游写法 | 本包对应 |
| --- | --- |
| `arming-thought` | 本文件（入口） |
| `/<slug>`（如 `/contradiction-analysis`） | `references/skills/<slug>/GUIDE.md` |
| 裸 slug | 同上 |

理由：`workflows` 的模式步骤全是裸 slug，`arming-thought` 的替身就是本文件。这张表让两处旧写法都能落到真实文件，而不必改动任何一份 GUIDE。

### 2. `workflows` 作为「组合模式」保留，但它不是第二个入口

结论先说：**能生效，但只在被读到时生效**。它是 10 份 GUIDE 之一，作用是固定「几件武器接力的顺序、每步交接物、终止条件」；一旦 `workflows/GUIDE.md` 被读入，它内部的裸 slug 靠决策 1 的别名表解析。不把它提升为第二个技能条目，原因是它会重新引入 ADR-0004 已经否掉的并列关系，且它的选择表首行就写着「都不符 → 回到入口路由表」，本质上仍是入口的下游。

配套加一条纪律：**路由命中必须真的 `read` 对应文件并在回答里体现其步骤，不得凭记忆复述**——这是第二跳唯一的失效点，宿主不会替模型保证它。

### 3. 介绍页改造成离线自足版，用脚本作为点击入口

- 位置：`assets/preview/index.html`，两幅字标图放同目录（`qiushi.png`、`shishiqiushi.png`），页面内引用 `./qiushi.png` 这类同目录相对路径，保证离线双击可开。
- 移除内容（都是上游自身的分发信息，不是方法论）：Google Analytics `gtag`、Google Fonts 外链、Trendshift/Shields/Star-History 徽章与图表、GitHub 仓库与 Discussions 链接、`npx qiushi-skill` 与 `/plugin marketplace add` 安装段、"给仓库加星" CTA、`docs/platforms.md` 摘要。字体回落到系统宋体栈。
- 替换内容：品牌改为「求是方法论 / Qiushi Methodology」；安装方式换成 Astravia 能力市场流程（添加市场源 → 安装 → 「技能/场景」里点开）；补一段「面板只有一条，方法按需读取」的说明，让页面描述与实际形态一致。
- 不打包 `docs/assets/tangping_editorial_perspective.md`：它是带外链的社区案例文，与新页面里被移除的案例区同源，不属于方法论正文。
- 点击入口：Astravia 的详情区块只接受 `http(s)` 链接与包内图片，**没有本地 HTML 入口**（Observed：`tests/marketplace.test.mjs` 第 22 行的 block 白名单无 html 类型，`links[].href` 只放行 http/https）。因此入口做成 `scripts/open-preview.sh` / `open-preview.ps1`：用户在对话框里说一句「看介绍页」，助手执行脚本用默认浏览器打开本地文件。详情页以步骤文字写明这条路径，不宣称存在原生 HTML 预览。

### 4. `agents/` 原样保留两个角色，改成可派遣的说明而非宿主自动发现

保留 `agents/investigator.md`、`agents/self-critic.md` 两个文件名与职责（只读调查产出「事实/推断/未知」；新鲜上下文审查，逐条附证据与改进）。两处适配：

- 去掉 `model: inherit`（本宿主没有这个语义），换成一句派遣建议：调查类走 `explorer`（只读）、审查类走 `general`。
- 正文里的 `skills/criticism-self-criticism/review-checklist.md` 改成 `$SKILL/references/skills/criticism-self-criticism/review-checklist.md`，与包内实际布局一致。

诚实边界：本宿主的子 agent 类型来自内置注册表，**不会扫描技能包里的 `agents/` 自动注册**。所以这两个文件的作用是「角色简报 + 输出模板」：主 agent 读它，把内容作为任务描述交给 `spawn_agent`。这一点写进 `README.md`，不假装是自动发现。

### 5. 新建 `scripts/`，放两个自检脚本与两个打开脚本

| 文件 | 用途 | 为什么必要 |
| --- | --- | --- |
| `scripts/verify-package.mjs` | 离线自检：路由表每一行的目标存在、GUIDE 内相对链接不悬空、`detail.json` 引用的图片存在、`upstream.json` 记录的文件齐全 | 「自动路由」是否成立的可验证判据，不依赖网络与宿主 |
| `scripts/sync-upstream.mjs` | 消费 `upstream.json`：按台账钉住的 commit 从上游逐字节取文件核对（`--verify`），或把上游原文同步进包内（`--sync`）；`--upstream <目录>` 回退到本地检出 | 把「24 条映射」从死数据变成可执行核对，且不要求克隆整个仓库 |
| `scripts/open-preview.sh` / `.ps1` | 用默认浏览器打开 `assets/preview/index.html`，路径按脚本自身位置解析 | 决策 3 的点击入口 |

### 6. `upstream.json` 保留为数据，行为移进脚本

评估结论：**不把它改写成脚本**，但给它补上消费者。

- 它是审计台账：上游 commit、版本、许可、逐文件映射、逐处改动理由。这类内容的价值在于「可被人和测试直接读、可 diff」，写成代码后每条记录都变成分支与字符串，可读性反而下降，且测试无法在不解包的情况下断言。
- 它唯一的问题是没人读。补 `scripts/sync-upstream.mjs` 后，台账成为脚本的输入：核对时逐条比对，同步时逐条复制；`scripts/verify-package.mjs` 另做一次「记录的文件是否都还在」的闭合检查。
- 反过来的做法（把映射写成 `const FILES = [...]`）不采用：那等于用手写代码替换 JSON，审计时还得读代码执行路径。

## 兼容和迁移

- 包版本从 `2.0.0` 提升到 `2.1.0`（新增 `assets/preview/`、`agents/`、`scripts/`，入口 `SKILL.md` 增段，GUIDE 与参考文件一个字节未动）；`configVersion` 保持 `1`（配置契约没变）。
- 已安装过 `2.0.0` 的用户按市场更新即可；新增文件都是增量，没有删除项。
- 面板条目数不变：仍是 1 条 `qiushi-skill`。
- `assets/preview/index.html` 与两幅图必须被 git 追踪（内容测试用 `git ls-files` 校验详情资源）。
- 介绍页与 `detail.json` 都不引用上游仓库地址；`meta.repository` / `meta.docs` 仍指向官方市场仓库，这是本包自身出处，不是上游分发信息。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| 改 GUIDE 正文，把 `arming-thought`、`/xxx` 直接替换成本地路径 | 违背 ADR-0002 的逐字节保真；且每次同步上游都要重做一遍替换，易漂移 |
| 加第二个入口技能 `workflows` | 重新制造并列关系，与 ADR-0004 的结论冲突 |
| 把介绍页做成 `detail.json` 的 `showcase`/`image` 区块 | 只能承载图片与伪造对话，无法承载长文图文页；且用户要的是可打开的原页 |
| 在详情页放 `file://` 链接指向包内 HTML | 测试与桌面端只放行 http/https，方案不可行 |
| 打包 `tangping_editorial_perspective.md` 并在页面加入口 | 内容是带外链的社区时评，不是方法论；与"不留上游分发信息"的取向冲突 |
| 把 `upstream.json` 改成 `upstream.mjs` | 事实记录变成可执行代码，审计与 diff 成本上升，收益只是少一个 JSON 文件 |
| 用宿主文件名约定让 `agents/` 被自动发现 | 本宿主没有技能包内 agent 自动注册机制，宣称即虚假承诺 |

## 验证

1. `node scripts/marketplace.mjs check` 无异常。
2. `node scripts/marketplace.mjs build` 退出码 0，产物里 `site/abilities/skills/qiushi-skill/` 含 `assets/preview/`、`agents/`、`scripts/`。
3. `node --test tests/*.test.mjs` 全绿。
4. 包内跑 `node scripts/verify-package.mjs`：10 条路由目标全部命中、0 悬空链接、0 缺失图片。
5. `node scripts/sync-upstream.mjs --verify --upstream <本地上游路径>`：22 份 GUIDE/参考文件全部 `same`。
6. 路由可解析性人工复核：按别名表把 `workflows` 正文出现的裸 slug 与 `arming-thought` 各映射一次，全部落到存在的文件。
7. 介绍页离线可用：断网双击 `assets/preview/index.html`，两幅字标图正常显示，无控制台外链请求。

## 落地结果（Observed，2026-10-25）

1. 新增 8 个文件：`assets/preview/index.html` 与两幅字标图、`agents/investigator.md`、`agents/self-critic.md`、`scripts/open-preview.sh`、`scripts/open-preview.ps1`、`scripts/verify-package.mjs`、`scripts/sync-upstream.mjs`。入口 `SKILL.md` 只在「怎么用这些正文」一节扩写；十份 `GUIDE.md` 与十二份参考文件零改动。
2. `node scripts/marketplace.mjs check` → `Validated source entries for astravia-official-marketplace`。
3. `rm -rf .marketplace-build && node scripts/marketplace.mjs build` → `✓ built in 13.34s`、`Prepared 13 new packages; distribution changed: true`；产物 `site/abilities/skills/qiushi-skill/` 含 `agents/`（2 份）、`assets/preview/`（3 份）、`scripts/`（4 份），索引里 qiushi 为 `('skill','qiushi-skill','2.1.0')`。
4. `node --test tests/*.test.mjs` → `# tests 69 / # pass 69 / # fail 0`，与 ADR-0004 记录下降后的基线一致。
5. 包内 `node scripts/verify-package.mjs` → 全部通过（0 处问题）：路由目标 10 条、台账 24 条、介绍页本地资源 2 处、角色简报 2 份；顶层文档里的 6 处仓库路径被列为提示而非错误（安装后不落地，运行时不会被跟随）。
6. `node scripts/sync-upstream.mjs --verify --upstream …/qiushi-skill` → `same 23 / diff 0 / missing 0`，入口按设计跳过。已知偏差：本 ADR「验证」第 5 条写的 22 份未计入 `LICENSE`，实测 23 份（10 GUIDE + 12 参考 + LICENSE）。
7. `PATH` 里放一个 `open` 桩后跑 `./scripts/open-preview.sh`：解析出 `assets/preview/index.html` 的绝对路径并交给系统打开器，退出码 0。介绍页全文 `grep -c http` 为 0，无任何外部请求。
8. 核对过程暴露的两处实现缺陷已修：`verify-package.mjs` 原先把 `README`/`NOTICE` 里的仓库路径（`docs/adr/...`）也算悬空，并把 `agents/` 下的路径按同目录解析（应为技能根目录）；改后按「运行时会跟随的文档才严格」分档，行内代码只认带 `/` 的路径。
9. `detail.json` / `detail.zh.json` 的计数口径改为「入口纪律 + 十份规程」：原先写「十一种方法」，把入口原则也算成了一种方法；并补「看图文介绍页」「需要角色时派一个」两项说明。

## 落地结果（第二轮，Observed，2026-10-25）

用户验收提出两处返工，均已完成：

10. **核对不再要求本地上游检出。** 原实现只接受 `--upstream <检出目录>`，等于要求每个人先 `git clone` 一次上游；这不是可接受的默认路径。改为按台账钉住的 40 位 commit 逐文件取字节：`api.github.com/repos/<owner>/<repo>/contents/<path>?ref=<sha>`（`Accept: application/vnd.github.raw`）为主，`raw.githubusercontent.com` 为备，6 并发，30 秒超时。`--upstream` 保留给离线与非 GitHub 上游。分支名或 tag 直接拒绝（`revision 必须是 40 位 commit`），否则「逐字节比对」会变成对着漂移目标的假比较；限流（403/429）时提示设 `GITHUB_TOKEN` 而非静默改判。本机实测：`--verify` → `same 23 / diff 0 / missing 0 / failed 0`，`exit=0`；`--revision main` → 拒绝，`exit=1`；`--upstream <本地检出>` 仍得 `same 23`。
11. **介绍页图片不显示。** 定位：`qr`/`字标` 两张 PNG 以同目录相对路径 `./qiushi.png`、`./shishiqiushi.png` 引用；文件本身无问题（Chromium 渲染能出笔画，红色像素存在），失效点是页面被单独拷走或被内嵌视图按 `blob:`/`data:` 打开时拿不到同级文件。修法：两张图内联为 `data:image/png;base64,…`（合计约 48 KB），并补 `width`/`height`、`height:auto` 与一段 1.2 秒兑底，避免观察器不回报时内容停在 `opacity:0`。验证：把 `index.html` 单独放进 `.scratch/iso/`（目录里没有任何图片）后用 Chromium 渲染，首页仍出字标笔画；`verify-package.mjs` 新增内联图校验（base64 解码非空、PNG 签名匹配），输出「内联图 2 张、同目录资源 0 处」，`exit=0`。
12. 随之更新的文案：`README.md` / `README.zh.md` / `NOTICE.md` / `upstream.json.adaptations` 不再说「against a local checkout」，改为「按固定 commit 取文件，不克隆」；本 ADR 决策 5 的脚本表同步改口径。

# ADR-0006：台账位置、README 口径与包内测试

## 状态

已接受（2026-10-25）。补充 ADR-0005 未覆盖的三处：`upstream.json` 该放在哪、README 该写成什么口径、包里要不要有 `tests/`。

> **决策 1 已被 [ADR-0007](./0007-filename-ledger-and-preview-entry.md) 取代（2026-10-25）**：`upstream.json` 移到 `scripts/`。其余三条继续有效。

## 背景

验收时提出三个问题，都指向同一件事：这个包现在按自己的习惯长，而不是按「本仓库其他技能怎么长」和「上游怎么说」来长。

1. `upstream.json` 该放包根、`agents/` 还是 `scripts/`？
2. `README.md` / `README.zh.md` 除开与本项目不匹配的部分，介绍内容应尽量与上游一致 —— 上游那份把「怎么用」讲清楚了，改写等于把用户能照着做的东西丢掉。
3. 上游有 `tests/`，本包没有。

存量事实（Observed，`ls abilities/skills/*/`）：

- `upstream.json` 出现在 4 个技能里 —— `cloudflare`、`workers-best-practices`、`wrangler`、`zhihu-search`，**全部在包根**。`docx` / `xlsx` 的同类元数据叫 `_meta.json`，也在包根。
- `agents/` 只有 `pdf` 有，内容是一份 `openai.yaml` 接口元数据，与溯源无关。
- `scripts/` 在各包里都是可执行脚本，没有一处放数据文件。
- 上游 `tests/` 有 4 个文件：`validate.sh`、`validate.ps1`、`validate.test.mjs`、`cli-install.test.mjs`。前两个校验 `.claude-plugin/`、hooks、commands、安装 CLI —— 这些在本包里被 ADR-0002 判定为不分发。

## 决策

### 1. 台账留在包根，不进 `agents/` 也不进 `scripts/`

`upstream.json` 描述的是「这个包与上游的关系」：仓库、commit、24 条逐文件映射、改造清单。它不属于某个子系统，而是整包的属性，和 `ability.json` 同级。三条理由：

- 与仓库既有 4 个例子一致，读者不必为这个包记一条例外；
- `scripts/sync-upstream.mjs` 以包根为基址解析 `upstream.json`，测试也按同一路径读，移动目录只是把路径散到两处；
- `agents/` 是角色简报目录，`scripts/` 是可执行文件目录。把只读数据塞进任何一个，都会让「这个目录放什么」失去判据。

同时把 `runtime` 的语义写清楚。原来是 `{"kind":"text-only","network":false}`，容易被读成「这个包里没有任何需要网络的东西」，而维护脚本确实要联网：

```json
"runtime": {
  "kind": "text-only",
  "network": false,
  "note": "Installed skill: plain Markdown, never calls the network. scripts/sync-upstream.mjs is maintenance-only and does fetch the pinned commit."
}
```

`network: false` 说的是**装好的技能**；脚本是维护工具，与运行时无关。这句话写进数据里，比写在文档里更不容易被漏读。

### 2. README 以上游同名文件为底本改写，不另写一篇精简版

「原汁原味」的判据不是版式，是**用户能不能照它学会怎么用**。上游 `README.md` / `README.en.md` 里有这些值得原样留下的东西：

- 两句引语与开篇定位（「你的 AI 不应该是一个唯唯诺诺的工具」）；
- 「为什么需要这个」的五条痛点 —— 它解释的不是功能，是要解决的问题；
- 「这不是什么」—— 明确「不是政治宣传、不是人格蒸馏」，这是使用前提，不是免责话术；
- 方法结构图与三层分组；
- 九大思想武器表（核心要义 / 原著出处 / 适用场景）—— 用户靠这张表决定该用哪件；
- 每份规程的五段结构说明（用 / 不用、操作规程、输出模板、纪律、交接）；
- 支撑文件说明（原著依据、subagents、参考速查）；
- 灵感来源、原著引用说明、许可与结尾声明。

必须换掉的是**发行渠道**，因为它对本包不成立：`npx qiushi-skill`、Claude Code 的 `/plugin marketplace add`、各宿主目录清单、`docs/platforms.md`、徽章、Trendshift、Star History、Discussions 与社区案例外链。替换成 Astravia 的三步安装、本地自检命令与上游同步说明。

因此 `README.md` / `README.zh.md` 是**改写**而非**新写**：章节顺序照上游，介绍段落照上游，只在「安装」「使用方式」「项目结构」「自检」四处按本包形态重写，并新增「上游同步」与「未收录的部分」两节交代差异。

### 3. 新增 `tests/`，但不迁移上游的 `validate.sh` / `validate.ps1`

新增 3 份测试，`node:test` + `node:assert`，零依赖、离线、不装宿主即可跑：

| 文件 | 责任 |
| --- | --- |
| `tests/package.test.mjs` | 入口身份与包版本一致；十份规程齐全且被路由表逐条指向；`references/` 下不得有 `SKILL.md`（形态回归闸门）；十二份参考文件存在；台账每条映射都有落地文件，`references/` 每个文件都有台账条目；`detail` 区块类型与链接合法；名称不带类型后缀；`LICENSE` / `NOTICE` 齐备 |
| `tests/preview.test.mjs` | 介绍页零外部引用、无 `@import` 外链；两张图内联为有效 PNG；无 `HughYau` / `github.com` / star-history / trendshift / gtag / `npx` 残留；原始图片仍随包分发 |
| `tests/upstream-sync.test.mjs` | 台账结构（24 条、`sourcePath`、`license`）；`--print` 不需要本地检出；分支名/tag 被拒绝；非 GitHub 仓库要 `--upstream`；脚本只用 `node:` 内置模块、源码里不再出现 clone 路径 |

不迁移 `validate.sh` / `validate.ps1`：它们的一半检查项（`.claude-plugin/`、hooks、commands、`package.json` 版本一致性）对应本包不存在的东西，搬过来只能改成空跑。

**分层**：`scripts/verify-package.mjs` 面向「能不能装」（路由可解析、资源落地、台账可查），`tests/` 面向「包本身是否自洽」（身份、形态、口径）。两者都不联网，都可以在 CI 与本机跑。

**`tests/` 不进分发包**：`scripts/static-marketplace.mjs:12` 的排除表里有 `test` / `tests`，构建时整目录跳过（与仓库其他包一致）。所以测试只在源码仓库里跑；装好的包里没有 `tests/`，两份 README 的结构图也据此标注。相应地，`verify-package.mjs` 对缺失的 `tests/` 只记一条状态（「未附带 tests/（分发产物按仓库规则排除该目录）」），不判为错误 —— 否则随包分发的自检脚本会在合法布局上误报。

### 4. `sync-upstream.mjs` 增加 `--repository`，默认值不变

`--repository <url>` 用来核对同一 commit 的镜像或 fork。默认仍取台账里的地址，所以日常命令不变；这一条让「非 GitHub 上游」从硬失败变成可选路径，也便于测试在离线下覆盖该分支。

## 兼容和迁移

- 包版本 `2.1.0` → `2.2.0`：新增 `tests/`、改写两份 README、台账补 3 条改造声明、`runtime` 补 `note`。`configVersion` 保持 `1` —— 配置契约没变。
- 安装形态不变：仍然是 `~/.astravia/skills/qiushi-skill/` 一个目录。`tests/` 只存在于源码仓库，构建器按规则排除，装好的包里没有它，宿主不会因此多注册任何条目。
- `upstream.json` 路径不变，外部脚本若读它不需要改；`runtime.note` 是新增可选字段，旧读取方忽略即可。
- 十份规程与十二份参考文件**零改动**，`--verify` 仍应报 `same 23 / diff 0`。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| `upstream.json` 放 `scripts/` | 它是数据，不是脚本；`scripts/` 的判据是「能执行的东西」，混进去以后没人知道何时读到它 |
| `upstream.json` 放 `agents/` | `agents/` 是角色简报目录，把溯源塞进去会让人以为它是某个 agent 的定义 |
| 删掉台账，把仓库与 commit 写成脚本常量 | 24 条映射是给人看的对照表，写进代码后无法审阅；也破坏了与既有 4 个技能的一致 |
| README 保持此前的精简版 | 用户明确要求上游口径；精简版只说了「这个包长什么样」，没说「为什么要用它、怎么用」 |
| 直接 `cp` 上游 README，只改安装段 | 会把 `npx`、`/plugin marketplace`、各宿主目录、star 图带进来，等于给用户一份装不上的说明 |
| 迁移上游 `validate.sh` / `validate.ps1` | 检查对象有一半在本包不存在，剩下的已由 `tests/` 与 `verify-package.mjs` 覆盖 |
| 把 `tests/` 放到仓库根 `tests/` 下 | 包内测试应随包分发，且要能单独 `cd` 进包运行；仓库根 `tests/` 已有自己的职责 |

## 验证

1. `cd abilities/skills/qiushi-skill && node --test tests/*.test.mjs` → `21 tests / 21 pass / 0 fail`。
2. `node scripts/verify-package.mjs` → 路由目标 10、台账 24、介绍页内联图 2、角色简报 2、包内测试 3，`结果：全部通过（0 处问题）`。
3. `node scripts/sync-upstream.mjs --print` → `映射 24 条`，第二行标注「不克隆」。
4. `node scripts/sync-upstream.mjs --verify --revision main` → 拒绝，退出码 1，提示需 40 位 commit。
5. `node scripts/sync-upstream.mjs --verify --repository https://gitlab.com/a/b` → 拒绝，退出码 1，提示改用 `--upstream`。
6. `node scripts/sync-upstream.mjs --verify` → `same 23 / diff 0 / missing 0`，退出码 0（十份规程与参考文件未被本轮改动波及）。
7. 仓库根：`node scripts/marketplace.mjs check` 通过；`node scripts/marketplace.mjs build` 后分发产物**不含** `tests/`（构建器按目录名排除，符合仓库规则）；`node --test tests/*.test.mjs` 仍 69/69。
8. 两份 README 中不再出现 `npx qiushi-skill`、`/plugin marketplace add`、`trendshift`、`star-history`、`docs/platforms.md`；「为什么需要这个」「这不是什么」「九大思想武器」「灵感来源」「原著引用说明」仍在上游对应位置。

## 落地结果（Observed，2026-10-25）

1. `upstream.json` 未移动，仅补 `runtime.note` 与 3 条 `adaptations`（README 口径、tests 来源、`--repository`），现为 24 条映射 + 12 条改造声明。
2. `README.md`（12756 B）/ `README.zh.md`（13117 B）按上游章节重写；剔除项实测：`grep -c "npx qiushi-skill\|plugin marketplace\|star-history\|trendshift" README*.md` = 0。
3. `tests/` 三份共 292 行（含注释与空行），21 个用例；首次运行 19/21，两处失败暴露的是测试自身的假设错误，不是包的问题 —— 入口 `description` 是块标量（`description: |`），朴素解析读成 `"|"`；`workflows` 上游没有 `original-texts.md`，参考文件应为 9 份原著依据 + 3 份速查而非 10+3。修正解析器与清单后 21/21。
4. `verify-package.mjs` 增加 `tests/` 状态行（源码树报「包内测试 3 份」，分发产物报「未附带」，均不判错）。
5. 版本 `2.1.0` → `2.2.0` 三处同步：`SKILL.md:3`、`ability.json:5`、`.astravia/marketplace.source.json`。
6. `marketplace.mjs check` 通过，`build` 成功（`distribution changed: true`）。产物里**没有** `tests/`：`scripts/static-marketplace.mjs:12` 的排除表含 `tests`，这是仓库统一规则，不是本包疏漏；据此把 `verify-package.mjs` 的 tests 检查改为状态提示，避免随包自检在合法布局上误报。仓库根 `node --test tests/*.test.mjs` 69/69。

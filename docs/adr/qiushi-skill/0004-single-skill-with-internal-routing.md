# ADR-0004：qiushi-skill 以「单技能包 + 内部路由」形态进入官方能力市场

## 状态

已接受，**取代 [ADR-0001](./0001-qiushi-skill-as-ability-bundle.md) 的决策 1、3、6**，并修订 [ADR-0003](./0003-official-icon-and-skill-activation.md) 决策 5 中「面板出现 11 条技能」的预期。

[ADR-0002](./0002-upstream-fidelity-and-content-boundaries.md) 的保真原则继续有效，但容许的编辑面从「只补 `version`」收敛为「身份字段 + 路由目标」两类，逐处列在决策 3 与决策 4。

> **已被 [ADR-0007](./0007-filename-ledger-and-preview-entry.md) 取代（2026-10-25）**：下游正文的文件名改回与上游一致的 `SKILL.md`，重复注册改由 `references/skills/.ignore` 阻断。本文记录的是当时的决定与理由，正文不再追改。

上游基线不变：`HughYau/qiushi-skill` `2.0.0`（commit `5ace7173b2d71fa7848c56a29f74b39d611c6cb3`）。

## 背景

ADR-0001 把上游 `skills/` 下的 11 个目录当成了 11 个产品，做出「集合包 + 11 个成员技能、面板 11 条」的决定。这个判断把**实现细节当成了产品边界**，与上游实际使用方式不符：

1. 上游是一个 Claude Code / Cursor **插件**，`1 个 plugin（qiushi-skill）` 里带 11 个技能目录（Observed：`.claude-plugin/plugin.json` 只有 `name` / `description`，`.claude-plugin/marketplace.json` 的 `plugins[0].source` 是仓库根 `./`）。
2. 11 个目录里只有 `arming-thought` 是入口。它自己不含任何具体方法论操作规程，正文第三段就是一张「你遇到的情况 → 调用哪个技能」的分派表，10 个下游技能各占一行（Observed：`skills/arming-thought/SKILL.md` 第 22–33 行）。
3. 因此上游的可观察行为是：**用户装一个东西，提问后由入口判断该用哪件武器**。11 个目录是入口路由表的下游端点，不是 11 个并列的产品。
4. 宿主的技能面板与 ADR-0001 的假设不同（Observed）：
   - 一条面板条目 = `~/.astravia/skills/<name>/SKILL.md`，**正文按需加载**，未加载时上下文里只有 `name` + `description`；
   - 安装器复制整个包目录，子目录与文件原样保留（`~/.astravia/skills/cloudflare` 66 个子目录 330 个文件、`zhihu-search` 含 `references/`，都是市场安装结果）；
   - 官方技能规范明确允许包内 `references/`，并要求在正文里用相对路径按需引用（Observed：`create-skill` 系统技能「Add `scripts/`, `references/`, or `assets/` only when genuinely required」）。
5. 原实现的实际后果（对照上游）：
   - 面板 11 条平级条目彼此没有入口关系，`arming-thought` 只是恰巧叫「武装思想」的一条；模型要在 11 条 description 里自行挑选，上游那张分派表退化成装饰；
   - 安装要勾 11 次，与上游「装一个插件」不一致；
   - 11 条 description 常驻上下文，成本是单条的 11 倍。

一句话：**上游是「一个入口 + 十件武器」，原实现做成了「十一个并列武器」。**

## 决策

### 1. 形态：1 个技能包 `qiushi-skill`，入口正文 + `references/` 子方法论

包路径 `abilities/skills/qiushi-skill/`，`type: "skill"`。市场 1 张卡，面板 1 条。

- 包根 `SKILL.md`：上游 `arming-thought` 正文，承担「总原则 + 路由表 + 调用纪律 + 指令优先级」。
- `references/skills/<slug>/`：10 个下游方法论的正文与它们各自的参考文件，逐目录还原。

集合包与 11 个成员包全部撤销（决策 5）。

### 2. 路由语义翻译成宿主动作：`调用 x` → 读 `references/skills/x/GUIDE.md`

宿主没有跨技能「调用」原语。等价动作是：用 `read` 打开该文件，把它当作当前任务的操作规程执行。入口表格第三列因此从技能名改为文件路径，其余文字（情况描述、调用纪律 3 条、指令优先级）逐字不动。

入口额外补一节「如何加载下游方法」，写明：一次只读一个；读完按它的步骤做，不要把正文整段复述给用户；上游技能名与文件路径的对应关系见表格。

### 3. 子方法论文件命名 `GUIDE.md`，放在与上游同名的目录里

`references/skills/contradiction-analysis/GUIDE.md`，同目录还有 `original-texts.md`、`contradiction-types-reference.md`。

两个理由：

- **不改名成 `SKILL.md`**：任何递归扫描的实现都可能把嵌套的 `SKILL.md` 再注册成一条技能，形态会退回 11 条。`GUIDE.md` 对所有发现机制都是普通文本。
- **不拍平到单文件**：10 个下游正文里有 11 处指向同目录参考文件的相对链接（`[original-texts.md](original-texts.md)` 等）。保留目录结构后，这些链接一个字都不用改，保真面最小。

### 4. 身份与触发面

- frontmatter `name: qiushi-skill`，与 slug、目录名逐字一致（仓库校验强制）。
- `description` 重写：覆盖「求是方法论 / 实事求是 / 该用哪件武器」与常见提问面，并说明按需读取 `references/skills/<slug>/GUIDE.md`。这是唯一允许改写的说明性文字，理由见决策 3——单入口必须自己说清能干什么，否则触发面只剩上游那句「入口与总原则」。
- 保留上游原句「被派遣执行单一具体任务的子 agent 直接跳过」，它在单包形态下仍然成立（子 agent 通常不加载本技能）。

### 5. 删除 11 个成员包与集合包，清单改为 1 条技能条目

移除 `abilities/skills/{arming-thought,contradiction-analysis,…}` 共 11 个目录与 `abilities/bundles/qiushi-skill/`；`.astravia/marketplace.source.json` 里 `type: "bundle"` + `config.members` 的条目换成一条 `type: "skill"`，`source.path` 指向 `abilities/skills/qiushi-skill`。

市场条目总数不变（25 条既有 + 1 条新增）。

### 6. 展示资源随包走

集合包原有的 `ability.json`、`detail.json`、`detail.zh.json`、`README.md`、`README.zh.md`、`NOTICE.md`、`upstream.json`、`assets/icon.png`、`assets/logo.png` 平移到技能包根目录；`ability.json` 承接展示名、简介、分类、标签与图标，`detail` 仍指向包内两份详情文件。

`detail.json` / `detail.zh.json` 的 11 项 feature-grid 保留——它现在是「这个包里有什么」，比原先「这个集合包含哪些成员」更贴切。

### 7. 版本仍取 `2.0.0`、`configVersion` 仍取 `1`

形态变化不改变内容契约：正文与参考文件的内容哈希未变。尚未发布，没有存量安装需要迁移，因此不借形态调整抬版本。

## 兼容和迁移

- **无迁移负担**：本次改动发生在本能力首次发布之前（Observed：`~/.astravia/open-marketplaces/sources.json` 只有官方源，本仓库构建产物未上传 gh-pages，本机 `~/.astravia/skills/` 下没有任何 qiushi 目录）。若形态先发布再收敛，用户就得多卸载 11 条，本 ADR 正是为了避免产生这种存量。
- **与 `~/.claude/skills` 并存**：本机该目录已有同名 11 个技能，宿主会一并扫描。市场安装后两者互不覆盖，面板里「求是方法论」只有 1 条、Claude 那 11 条仍在；用户可停用其一（ADR-0003 决策 5 的判据仍适用）。
- **上游同步方式不变**：钉住 commit、正文逐字节比对（ADR-0002 决策 7），只是比对目标从 11 个 `SKILL.md` 变成 1 个 `SKILL.md` + 10 个 `GUIDE.md`。

## 备选方案

**A. 维持 ADR-0001 的集合包 + 11 成员。** 面板没有入口、安装要勾 11 次、上下文成本 11 倍，且与上游「一个插件」的用法不一致。否决。

**B. 只装入口，10 个下游不落地。** 入口路由表点名的文件不存在，模型读到空，路由变成幻觉来源。否决。

**C. 把 11 份正文拼成一个 `SKILL.md`。** 约 62 KB 正文一次全量加载，违背宿主「正文按需、参考按需」的分层；单次触发成本约为现在的 11 倍。否决。

**D. 改造成插件，用 `plugin.json#agent.skillPaths` 携带 11 个技能目录。** 宿主对 `skillPaths` 下每个含 `SKILL.md` 的目录同样注册为独立技能，面板依旧是 11 条，还多背一个插件生命周期；上游的 `hooks/`、`commands/` 也不因此获得宿主等价物。否决。

**E. 单一入口 + 关键词路由表（不落地子正文，改写成浓缩版）。** 会篡改上游正文并丢失操作规程细节，等于重写方法论。否决。

## 验证

```bash
cd astravia-official-marketplace
node scripts/marketplace.mjs check
node scripts/marketplace.mjs build
node --test tests/*.test.mjs

# 1) 入口路由表必须逐行指向真实文件（10 行，0 缺失）
grep -o 'references/skills/[a-z-]*/GUIDE.md' abilities/skills/qiushi-skill/SKILL.md | sort -u | while read f; do
  test -f "abilities/skills/qiushi-skill/$f" || echo "MISSING $f"
done

# 2) 子目录与上游逐目录对应，正文无改动（除入口自身）
ls abilities/skills/qiushi-skill/references/skills | wc -l    # 期望 10

# 3) 市场清单只剩 1 条 qiushi 条目，且类型是 skill
python3 -c "import json;d=json.load(open('.astravia/marketplace.source.json'));print([(a['slug'],a['type']) for a in d['abilities'] if 'qiushi' in a['slug']])"

# 4) 构建产物把 references 一起带上
ls .marketplace-build/site/abilities/skills/qiushi-skill/references/skills | wc -l
```

判据：

1. `check` 无异常；`build` 退出码 0；`node --test` 全绿（基线由 80 降为 69：11 个成员包各自的用例随包一并消失）。
2. 入口 `SKILL.md` 里 10 条路由全部命中真实文件，无 `MISSING`。
3. `.marketplace-build/site/abilities/skills/qiushi-skill/` 下同时存在 `SKILL.md`、`ability.json`、`detail.json`、`detail.zh.json`、`LICENSE`、`NOTICE.md`、`upstream.json`、`assets/`、`references/skills/`（10 个目录）。
4. 构建产物的市场索引里 `qiushi-skill` 类型为 `skill`、条目总数与改动前一致。
5. 安装后对话框「技能 / 场景」只出现 1 条「求是方法论」；点开正文能看到路由表，「读 `references/skills/…/GUIDE.md`」中的路径在安装目录里真实存在（`~/.astravia/skills/qiushi-skill/references/skills/…`）。

## 落地结果（Observed，2026-10-25）

1. `node scripts/marketplace.mjs check` → `Validated source entries for astravia-official-marketplace`。
2. `node scripts/marketplace.mjs build`（清空 `.marketplace-build` 后重跑）→ 退出码 0，`Prepared 13 new packages; distribution changed: true`，索引 `marketplaceVersion` 为 `2026.10.25-1`。
3. `node --test tests/*.test.mjs` → `# tests 69 / # pass 69 / # fail 0`。
4. 入口路由表 10 行的目标文件全部存在；产物 `site/abilities/skills/qiushi-skill/references/skills/` 有 10 个目录，包内共 33 个文件。
5. 索引里 `qiushi-skill` 只有 1 条、`type` 为 `skill`、`version` 为 `2.0.0`；条目总数仍为 26。
6. 10 份 `GUIDE.md` 与 12 份参考文件对上游 `skills/<slug>/` 逐字节一致（`diff -q` 全部相同）；入口 `SKILL.md` 的差异仅限 `NOTICE.md` 列出的四处。
7. 未完成：面板级安装验证（第 5 条判据）需要市场发布到 `gh-pages` 或在应用内手动加源，本地无法自动化。

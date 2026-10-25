# ADR-0002：上游内容保真范围与同步流程

## 状态

已接受，改动面已被 ADR-0004 收窄。适用于单技能包 `abilities/skills/qiushi-skill/`。原文的 11 个成员包形态已于 ADR-0004 移除：本决策 2（frontmatter 只补 `version`）与决策 3（正文逐字节不改）仍成立，但入口 `SKILL.md` 因合并需要还改了 `name`、`description`、路由目标并新增一节，逐处改动见包内 `NOTICE.md`。

## 背景

1. 上游 11 份 `SKILL.md` 的 frontmatter 只有 `name` 和 `description` 两个字段，没有 `version`（Observed：`awk` 抽取 11 份 frontmatter 的结果）。
2. 市场的技能校验强制要求 `version`：`scripts/static-marketplace.mjs` 比对 `SKILL.md` frontmatter 的 `name === entry.slug`、`version === identity.version`、`description` 非空。缺 `version` 会在 `check` 阶段直接失败。
3. 上游 `description` 已经是「中文一段 + `English:` 一段」的双语形式，两类触发词各自完整（Observed：11 份 frontmatter 均为此结构）。中文段承担中文请求的触发，`English:` 段承担英文请求。
4. 9 个技能的正文用相对链接引用同目录参考文件：`[original-texts.md](original-texts.md)`、`[contradiction-types-reference.md](contradiction-types-reference.md)`、`[review-checklist.md](review-checklist.md)`、`[phase-assessment-guide.md](phase-assessment-guide.md)`，共 12 份文件、9 个技能带引用（`arming-thought`、`workflows` 不引用）。
5. 上游的非技能资产与 Astravia 的模型不对应：
   - `hooks/hooks.json` 注册 `SessionStart`，`hooks/session-start` 在会话开始时把 `arming-thought/SKILL.md` 全文注入上下文（Observed：脚本读取 `skills/arming-thought/SKILL.md` 并做 JSON 转义输出）。
   - `commands/*.md` 是 10 个 slash command 的薄包装，正文即「读取并遵循 `skills/<name>/SKILL.md`」加输出要求（Observed：`commands/contradiction-analysis.md`）。
   - `agents/investigator.md`、`agents/self-critic.md` 是子代理提示词，含 `model: inherit` 与调用纪律。
   - `bin/qiushi-skill.mjs` 是安装/校验 CLI。
6. 市场安装器复制整个包目录（Observed：`~/.astravia/skills/zhihu-search` 内保留 `references/`、`upstream.json`、`NOTICE.md`），因此包内的相对链接只要文件同目录存在就成立。
7. 上游许可证是 MIT，`Copyright (c) 2026 qiushi-skills contributors`，作者字段为 `HughYau`。
8. 仓库对上游来源能力的既有做法是 `upstream.json`（记录 `repository` / 40 位 `revision` / `license` / `files` 映射 / `adaptations`）+ `NOTICE.md`（署名与改动声明），见 `abilities/skills/zhihu-search`。

## 决策

### 1. 正文逐字节保留，只补一个 `version` 字段

`SKILL.md` 除 frontmatter 追加 `version: 2.0.0` 外，与上游对应文件逐字节一致：引用格言、纪律条款、输出模板、相对链接、`交接` 小节里的下游技能名全部不改。

理由：正文是这套方法论的核心资产，也是用户认这个上游的原因。二次改写会让每次上游更新都变成人工合并，且改写引入的偏差无法被 diff 发现。相对链接只在同目录文件缺失时才失效，而包内会带上全部参考文件（决策 3）。

### 2. 描述沿用上游双语文本，市场卡片另写英文简介

- `SKILL.md` 的 `description`：保持上游原样（中文 + `English:`），不改写、不拆分。它同时是模型的路由依据，双语并存比市场语言切换更贴近实际用法——用户可能用中文提问、让英文模型判断。
- 市场卡的 `name` / `description`（`ability.json` 与清单条目）：按仓库规范写英文，中文放 `detail.i18n.zh`。卡片简介是目录页的展示文案，与 `SKILL.md` 里的触发描述是两个用途，允许不同措辞，但不能与技能实际做法相矛盾。

### 3. 12 份参考文件随包复制

`original-texts.md`（9 份）、`contradiction-types-reference.md`、`review-checklist.md`、`phase-assessment-guide.md` 原样进入对应技能目录，不改内容、不合并。它们是 `SKILL.md` 里相对链接的落点，也是「原著依据」这一说法的支撑材料。

### 4. 不迁移 hooks / commands / agents / bin

| 上游资产 | Astravia 现状 | 处理 |
| --- | --- | --- |
| `hooks/session-start`（会话开始注入 `arming-thought`） | 宿主没有 SessionStart 注入点，技能无法在会话开始时自动把正文塞进上下文 | 不迁移。替代是靠 `arming-thought` 的描述触发（上游描述本就写「在每次新的顶层会话开始时加载一次」），并在集合包详情页明写「需要入口技能时先点它」 |
| `commands/*.md`（10 个 slash command） | 宿主没有用户可注册的 slash command 通道 | 不迁移。命令体本身只是「读取并遵循某技能 + 输出要求」，用户直接点名技能即可达到同样效果 |
| `agents/investigator.md`、`agents/self-critic.md` | 技能包不能注册子代理；这需要插件级能力 | 不迁移。`investigation-first` 与 `criticism-self-criticism` 的正文已包含同等纪律，主线可直接执行 |
| `bin/qiushi-skill.mjs` | 安装、校验由市场与宿主完成 | 不迁移 |

这些取舍要**明说**，不能靠「已整合」暗示这些能力也存在：没有自动注入，就意味着用户需要在会话开头自己提到入口技能，面板里点一下也算提到。

### 5. 新增文件的固定集合，且只增不改

每个成员目录在上游文件之外只增加市场要求的文件：`ability.json`、`detail.json`、`detail.zh.json`、`LICENSE`、`NOTICE.md`、`upstream.json`。不新建 `README.md`（集合包已承担导览），不改 `SKILL.md` 结构。

`ability.json` 里 `type`/`slug`/`version` 必须与目录身份一致；`icon` 由 ADR-0003 决定；`category` 与 `categoryI18n` 全库一致（`Productivity` / 效率）。

### 6. 署名与许可随包落地

`LICENSE` 为上游 MIT 全文逐字复制；`NOTICE.md` 写明上游仓库、commit、版本、版权行、以及「正文未改动，仅补 version 字段与市场展示资源」这句改动声明；`upstream.json` 记录机器可读的溯源：

```json
{
  "repository": "https://github.com/HughYau/qiushi-skill",
  "revision": "5ace7173b2d71fa7848c56a29f74b39d611c6cb3",
  "version": "2.0.0",
  "license": "MIT",
  "files": { "SKILL.md": "skills/<slug>/SKILL.md", "references/original-texts.md": "skills/<slug>/original-texts.md" },
  "adaptations": ["SKILL.md frontmatter 追加 version 字段", "…"],
  "runtime": "纯文本技能，无网络、无脚本执行"
}
```

`files` 只列实际存在的映射，不写空条目。

### 7. 上游同步流程

1. 取上游新 commit 与版本号，更新 `upstream.json.revision` / `version`。
2. 用上游文件覆盖 `SKILL.md` 与参考文件，再补 `version` 字段。
3. 正文有变化 → 成员包与集合包同步升版本（版本号跟上游 release，见 ADR-0001 决策 4）；只有 `NOTICE`/`upstream.json` 变化 → 不升版本，因为分发内容未变。
4. 跑 `node scripts/marketplace.mjs check`、`build` 与 `node --test tests/*.test.mjs`。
5. 与上游逐文件 diff 一次，确认差异只有 `version` 那一行。

## 兼容和迁移

- 上游 2.0.0 的 11 个技能全部纳入，不做取舍，因此 `arming-thought` 的路由表与 `workflows` 的模式 1–4 指名的下游技能在本市场内均存在，不会出现「教模型调用不存在的技能」。
- 上游若新增技能：在 `config.members` 追加一条并新建目录，集合包版本提升；删除技能属于破坏性变更，需要同时提升 `configVersion`（成员集合是配置契约的一部分）。
- 已有的 `~/.claude/skills` 同名技能不被覆盖，二者并存（细节见 ADR-0003）。

## 备选方案

**A. 把 11 份正文改写成 Astravia 风格的单文件技能（英文为主）。** 等于重写上游，格言与纪律条款会被稀释，且失去逐字节 diff 的能力；上游一更新就要重新人肉合并。否决。

**B. 只保留 `SKILL.md` 摘要、丢掉引用文件。** 正文里的相对链接会指向不存在的文件，模型读到链接后无法跟进；`原著依据` 变成不可核对的声明。否决。

**C. 把 `hooks/session-start` 的内容塞进 `arming-thought/SKILL.md`。** 注入脚本的作用是「会话开始时把入口技能全文放进上下文」，而宿主本来就把已启用技能的 `SKILL.md` 提供给模型——重复注入只会浪费上下文预算（插件提示词预算 12 KB，技能虽不受此限，但重复文本没有收益）。否决。

**D. 用插件的 `agent.registerTool` 复刻 `investigator` / `self-critic` 子代理。** 技术上可行，但需要另写一个插件工程并维护两套分发通道，收益只是一个可选的分派动作。本 ADR 记为后续可选项，不在本次范围内。否决（本次）。

## 验证

```bash
# 1) 逐文件与上游比对，差异只允许 version 一行
for s in arming-thought contradiction-analysis practice-cognition investigation-first \
         mass-line criticism-self-criticism protracted-strategy concentrate-forces \
         spark-prairie-fire overall-planning workflows; do
  echo "== $s"
  diff <(sed '/^version:/d' abilities/skills/$s/SKILL.md) \
       <(cat /Users/zhugeyue/Desktop/project/bigdate/github-source-code/qiushi-skill/skills/$s/SKILL.md)
done

# 2) 参考文件与上游逐字节一致
for f in original-texts.md contradiction-types-reference.md review-checklist.md phase-assessment-guide.md; do
  find abilities/skills -name "$f" -exec sh -c 'cmp -s "$1" "/Users/zhugeyue/Desktop/project/bigdate/github-source-code/qiushi-skill/skills/$(basename $(dirname $1))/$2" || echo "DIFF $1"' _ {} "$f" \;
done

# 3) frontmatter 身份与校验链
node scripts/marketplace.mjs check
node --test tests/*.test.mjs
```

判据：

1. 步骤 1、2 无输出（无差异），即正文与参考文件保真。
2. `check` 通过，说明每份 `SKILL.md` 的 `name`/`version`/`description` 与 `ability.json`、清单条目三方一致。
3. 11 个目录内 `LICENSE`、`NOTICE.md`、`upstream.json` 齐备，`upstream.json.revision` 为 40 位且等于上表基线 commit。
4. 集合包详情页不出现「自动注入」「无需点名」这类与决策 4 相反的表述（人工复核）。

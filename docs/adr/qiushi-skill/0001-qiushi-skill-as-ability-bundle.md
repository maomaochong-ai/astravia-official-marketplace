# ADR-0001：qiushi-skill 以「集合包 + 成员技能」形态进入官方能力市场

## 状态

已接受，但决策 1、3、6 已被 [ADR-0004](./0004-single-skill-with-internal-routing.md) 取代——市场形态从「集合包 + 11 成员」改为「单技能包 + 内部路由」。本文保留作为演进记录，不要按它重建包结构。

上游基线为 `HughYau/qiushi-skill` 版本 `2.0.0`（commit `5ace7173b2d71fa7848c56a29f74b39d611c6cb3`）。

本 ADR 只决定市场形态、成员拆分方式与安装后的可见性判据。内容保真与上游同步策略见 [ADR-0002](./0002-upstream-fidelity-and-content-boundaries.md)，官方图标、多语言与激活校验见 [ADR-0003](./0003-official-icon-and-skill-activation.md)。

## 背景

上游是一个面向 Claude Code / Cursor 的多技能方法论仓库，不是 Astravia 插件，也不是单个技能。把它接进官方市场之前，先确认双方的事实：

1. 上游 `skills/` 下有 11 个目录，每个目录一份 `SKILL.md`：`arming-thought`、`contradiction-analysis`、`practice-cognition`、`investigation-first`、`mass-line`、`criticism-self-criticism`、`protracted-strategy`、`concentrate-forces`、`spark-prairie-fire`、`overall-planning`、`workflows`。合计 23 个文件、732 行 `SKILL.md`、62 KB 正文，其中 9 个技能各带 1–2 份随正文引用的参考文件（`original-texts.md`、`contradiction-types-reference.md`、`review-checklist.md`、`phase-assessment-guide.md`，共 12 份）。
2. 上游的技能之间是**互相点名调用**的关系：`arming-thought` 是入口路由，`workflows` 用四个模式串起其余技能，每个技能正文的「交接」小节直接写下游技能名（如 `concentrate-forces`）。拆开任意一个都会让引用悬空。
3. 上游除技能外还有四类非技能资产：`hooks/hooks.json`（`SessionStart` 触发 `hooks/run-hook.cmd session-start`）、`commands/*.md`（10 个 slash command）、`agents/investigator.md` 与 `agents/self-critic.md`（子代理提示词）、`bin/qiushi-skill.mjs`（安装/校验 CLI）。这些全部是 Claude Code 宿主概念。
4. Astravia 宿主的技能面板按「一次扫描一个技能目录」的方式工作：安装态落在 `~/.astravia/skills/<slug>/`，登记在 `~/.astravia/skills-manifest.json`，每条含 `{name, version, installedAt, source, enabled, type, alias, marketDescription}`。`alias` 取市场卡名称，`marketDescription` 取市场卡简介（Observed：`~/.astravia/skills/zhihu-search` 的安装结果与清单条目一致）。
5. 宿主同时扫描 `~/.claude/skills`，因此同名的 Claude 技能与市场技能在会话的技能清单里可能并列出现；市场安装的判据仍是 `~/.astravia/skills` 与清单（Observed：本机 `~/.claude/skills/arming-thought` 存在且已被宿主加载）。
6. 市场源 `.astravia/marketplace.source.json` 要求 `schemaVersion: 3`；`scripts/static-marketplace.mjs#sourceCatalog` 对每条目的校验是「`slug` + `source.path` + `ability.json`/`SKILL.md` 身份一致」，集合包的 `config.members` 若带 `source.path` 会作为独立包一起校验（Observed：`entries()` 把 bundle 的路径成员展平进校验序列）。
7. 带 `source.path` 的集合包成员属于 v2 解析，需要 Desktop `0.5.49` 及以上；本源 `minAppVersion` 已是 `0.5.59`，无需为提高兼容性额外动作（Observed：`.astravia/marketplace.source.json`）。
8. 仓库已有三个集合包先例（`zhihu-research`、`shimo`、`cloudflare-developer-platform`），它们的共同做法是「一个集合包上架 + 成员按需独立安装」，`zhihu-search` 同时被顶层注册和集合包引用也是允许的。

## 决策

### 1. 形态：1 个集合包 + 11 个路径引用成员，成员不单独上架

市场里只出现一张卡 `qiushi-skill`，`type: "bundle"`；`config.members` 列出 11 条 `{type: "skill", slug, source: {path}}`，指向 `abilities/skills/<slug>`。成员不做顶层注册。

理由：

- 面板语义要求 11 个技能分别可见、可单独点开，只有「11 个独立技能包」能满足——一个 `SKILL.md` 再怎么合并也只是面板里的一条。
- 市场语义要求用户面对的是一个方法体系，而不是 11 张互不相干的卡片；集合包正好把「一次安装、整体呈现」和「逐条加载」放在一起。
- 成员不顶层注册还有一个实际收益：11 个方法论技能的卡片简介都要双语重复写一遍，全部堆在发现页只会挤掉真正独立的工具能力；集合包详情页一次讲清体系，比 11 张卡各自讲一句更准确。

### 2. 成员身份沿用上游技能名，不改 slug

11 个成员 slug 与上游目录名逐字一致（`arming-thought` … `workflows`），`SKILL.md` frontmatter 的 `name` 保持上游值。宿主按 slug 建目录、按 `name` 索引，改名会让用户已有的 `~/.claude/skills` 版本与市场版本无法对应，也会让技能正文里的互相引用失效。

市场卡展示名另起：`arming-thought` → `Arm the Thinking` / 武装思想，其余同理。展示名不含「技能 / 插件 / 套装」与 `skill` 等类型后缀（仓库测试强制），slug 不动。

### 3. 每个成员包自洽，引用文件随目录安装

成员包内固定六类文件：`SKILL.md`（上游正文）、`ability.json`（目录元信息）、`detail.json` / `detail.zh.json`（双语详情）、`LICENSE`（上游 MIT 全文）、`NOTICE.md`（出处与改动声明）、`upstream.json`（revision 与文件映射），以及上游自带的参考文件。

理由是安装器复制的是整个包目录（Observed：`~/.astravia/skills/zhihu-search` 内含 `references/`、`NOTICE.md`、`upstream.json`）。`SKILL.md` 里「原著依据：[original-texts.md](original-texts.md)」这类相对链接只有在同目录文件一并落地时才成立。

### 4. 版本号跟随上游 release

11 个成员包与集合包统一取 `2.0.0`，与上游 `package.json.version` 对齐；`configVersion` 取 `1`。上游正文不变就不递增版本——市场构建对非插件内容按版本复用已发布字节（`prepareMarketplace` 的 `reuse` 分支），无意义地抬版本只会让所有人重下一次 60 KB 文本。

上游发布新版本时，成员与集合包同步提升，并在 `upstream.json.revision` 记录新 commit（流程见 ADR-0002 决策 7）。

### 5. 分类与标签：并入既有 `Productivity`

11 个成员与集合包统一 `category: "Productivity"`、`categoryI18n: {zh: "效率", en: "Productivity"}`，与市场内既有条目逐字一致（测试要求同分类译名一致）。标签取方法论词汇（`methodology`、`reasoning`、`planning`、`review`、`workflow` 等），中文覆盖另写。

不新开 `Thinking` 分类：客户端的分组图标与排序按既有分类维护，新增分类只为一个来源服务，收益小于成本。

### 6. 集合包本身不复制内容

`abilities/bundles/qiushi-skill/` 只放展示资源（`ability.json`、`detail.json`、`detail.zh.json`、`README.md`、`README.zh.md`、`NOTICE.md`、`assets/`）。方法论文本只存在于 `abilities/skills/*`，集合包不再存一份。仓库校验允许集合包自带 `source.path` 指向纯展示目录，这也正是 `zhihu-research` 的做法。

## 兼容和迁移

- 新增条目只增不改：不触碰任何既有能力的 slug、版本与 `source.path`，市场版本由 CI 按内容哈希生成，本次仅因新增分发内容而递增。
- v2 成员解析要求 Desktop ≥ `0.5.49`，本源已有 `minAppVersion: 0.5.59`，低版本客户端会整体拒绝本源并沿用旧缓存，不会看到半成品条目。
- 已装过 `~/.claude/skills` 版本的用户：市场安装写入 `~/.astravia/skills`，两者互不覆盖；技能清单按名称并列，用户可自行停用其一（`enabled` 字段）。
- 不迁移 `hooks/`、`commands/`、`agents/`、`bin/`：Astravia 没有 SessionStart 钩子与 slash command 注册点，迁移只能是空壳。理由与替代做法见 ADR-0002 决策 4。

## 备选方案

**A. 11 个技能各自顶层上架。** 面板效果与本方案等价，但发现页会出现 11 张简介高度相似的方法论卡片，且用户无法一次装齐；同时每个成员都要单独维护市场排序与分类。否决。

**B. 合并成一个大技能（单个 `SKILL.md`）。** 面板里只剩 1 条，直接违反「逐个可见、逐个点击」的需求；单文件还会让 11 套操作规程共用一个触发描述，路由判断必然退化。否决。

**C. 移植成 plugin，用插件携带技能目录。** 宿主插件确实可以随包分发资源，但本仓库的技能安装走市场技能通道（`~/.astravia/skills` + 清单），走插件就要自己实现扫描与登记，等于在宿主已有能力旁边再写一套。上游的 `hooks/`、`commands/` 也不因此获得宿主等价物。否决。

**D. 只挑 3–4 个「最有用」的技能上架。** 会切断 `arming-thought` 的路由表与 `workflows` 的四条模式：它们点名的下游技能不在，技能正文就在教模型调用不存在的技能。否决。

## 验证

```bash
cd astravia-official-marketplace
node scripts/marketplace.mjs check          # 身份、路径、frontmatter 校验
node scripts/marketplace.mjs build          # 生成 .marketplace-build/site
node --test tests/*.test.mjs                # 内容回归（含成员展示资源、双语、图标可追踪）

# 构建产物里应能看到 12 个包（1 集合包 + 11 成员），成员目录含 SKILL.md 与参考文件
ls .marketplace-build/site/abilities/skills | grep -E 'arming-thought|workflows'
python3 -c "import json;d=json.load(open('.marketplace-build/site/.astravia/marketplace.json'));print([a['slug'] for a in d['abilities'] if a['type']=='bundle'])"
```

判据：

1. `check` 无异常，`build` 输出的 `publication.json` 中 `packages` 不包含技能包（技能是非插件内容，直接复制而非打包）。
2. `.marketplace-build/site/abilities/skills/arming-thought/` 下同时存在 `SKILL.md`、`ability.json`、`detail.json`、`detail.zh.json`、`LICENSE`、`NOTICE.md`、`upstream.json`。
3. `node --test` 全绿，其中 `bundles resolve distinct, separately installable packages` 与逐条 `package identity and bilingual presentation resources` 用例覆盖 11 个成员。
4. 在 Desktop「能力 → 添加市场源」加入本源后，发现页只多出 1 张卡；展开详情的成员勾选安装后，对话框「技能 / 场景」面板出现 11 条可点击技能（激活校验见 ADR-0003）。

# ADR-0008：README 首屏、会话注入与跨平台接入

## 状态

已接受（2026-10-25）。本 ADR 推翻两处旧决策：

- **取代 ADR-0002 决策 4 中关于 `hooks/` 的那一半。** 当时的否决前提是「宿主没有 SessionStart 注入点」（ADR-0002 决策 4 表格第一行）。本轮从宿主产物中取得反证，前提不成立，结论随之失效。`commands/` 与 `bin/` 的结论保留，但理由重写为「宿主没有斜杠命令注册点」与「安装/卸载已由市场与随包脚本承担」，不再表述为「这些资产没有价值」。
- **取代 ADR-0005 中「不打包 `docs/assets/tangping_editorial_perspective.md`」一条。** 当时按「社区时评不是方法论」排除；本轮判定它是**矛盾分析法的实操样本**，按案例收进包内，并把「是否代表本项目」写成显式声明而不是靠不打包来回避。

ADR-0001 决策 3 里「这些全部是 Claude Code 宿主概念」的判断，只对 `commands/` 与 `bin/` 继续成立。

## 背景

### 一、README 首屏是空的

两份 README（`README.md` 204 行、`README.zh.md` 207 行）在包根，是用户安装后在文件管理器里第一眼看到的东西。当前状态（Observed：`grep -n "<img\|!\[" README.md README.zh.md` 无命中）：

- 没有任何图片。字标 `assets/logo.png`（3118×1376）、首屏实拍 `assets/preview/preview-hero.png`（1188×669）、书法图 `assets/preview/shishiqiushi.png` 都在包里，README 一张都没引用。
- 没有指向图文介绍页的入口。`assets/preview/index.html` 只在目录树注释和 `./scripts/open-preview.sh` 两处被间接提到（README.md:152、177），前者是结构说明，后者要求读者先会跑脚本。
- 方法结构图是 mermaid `graph TD`（README.md:40–49、README.zh.md:36–45）。mermaid 在多数 Markdown 渲染器里由宿主决定对齐，GitHub 与本地编辑器多为左对齐，与上下文的居中版式不齐。

### 二、「安装后其他平台也能用」这件事被高估了一半

ADR-0002 把上游 `hooks/`、`commands/`、`bin/` 一并排除，理由写在决策 4 的表格里。本轮重新读宿主产物，结论需要分三层拆开。

**宿主确实有 SessionStart 注入引擎（Observed）。** 在 `/Applications/Astravia.app/Contents/Resources/app.asar` 中检出：

- `EVENT_NAMES` 数组包含 `"PreToolUse"`、`"PostToolUse"`、`"SessionStart"`、`"SessionEnd"`、`"UserPromptSubmit"`、`"SubagentStart"`、`"Stop"` 等，与 Claude Code 的事件名一致。
- `SessionStart` 的 matcher 输入来自 `request.source`，即 `startup` / `clear` / `compact` —— 与上游 `hooks.json` 里 `"matcher": "startup|clear|compact"` 逐字对应。
- 输出解析器读 `wire.hookSpecificOutput?.additionalContext`（`SessionStart`、`SubagentStart`、`UserPromptSubmit`、`PreToolUse` 分支都读），并有 `fromUniversal(wire)` 兼容层把 `additional_context` 之类的通用字段折叠进来。
- hook 配置来源包含四类目录：`join(astraviaHome, ".codex")/hooks.json`、`join(astraviaHome, ".claude")/settings.json`、项目级 `.codex/hooks.json`、项目级 `.claude/settings.json` 与 `.claude/settings.local.json`；另有判定「路径以 `/hooks/hooks.json` 结尾即视为插件来源」的分支，以及 `$CLAUDE_PLUGIN_ROOT` / `$CLAUDE_PLUGIN_DATA` / `$CLAUDE_PROJECT_DIR` 的占位符展开。
- 技能自身也能贡献 hook：`readSkillInvocationDocument` 取 `frontmatter.hooks`，`createSkillHookContribution` 以 `CLAUDE_CODE_HOOK_PROFILE_ID` 注册，并把 `CLAUDE_PLUGIN_ROOT` 与 `CLAUDE_SKILL_DIR` 都设成该技能的 `baseDir`。

**所以「宿主没有 SessionStart 注入点」这句话是错的。** 准确的说法是：Astravia 没有任何**安装时自动写进用户 hook 配置**的机制，技能包里的 `hooks/hooks.json` 只有在被当作插件来源扫描时才会生效，而技能安装通道（`~/.astravia/skills`）不保证这一条。

**斜杠命令确实没有对应物（Observed）。** `discoverCustomCommands`、`customCommands`、`promptCommands`、`"/commands"` 四个探测词在 asar 中命中数均为 0；仅有的 `slashCommand` 命中是主题色键 `chat.slashCommandForeground` 之类，属 UI 配色。结论：Astravia 不扫描任何 `commands/*.md`。

**`bin/` 的实质是「复制 + 清单」（Observed）。** `bin/lib/install.mjs` 全程不联网：`normalizePath` / `assertManagedTarget` / `copyAsset` / `writeManifest` / `removeManagedEntries` / `installTarget` / `uninstallTarget`，落一份 `.qiushi-skill-install.json` 记录受管路径，卸载只删清单内条目。`bin/lib/detect-platform.mjs` 用 `markers`（`~/.claude`、`~/.cursor`、`~/.codex`、`~/.config/opencode`、`~/.openclaw`、`~/.hermes`、`~/.nanobot`）做存在性探测，`getPlatformCatalog()` 返回 7 个目标，全部 `mode: "copy"`。这套东西不依赖任何 Claude Code 扩展点，本身就是可移植的 —— 缺的只是本包的目录布局与它假设的 `skills/` 不同。

### 三、两份上游文档的性质不同

- `docs/platforms.md`（42 行）是**分发说明**：`npx qiushi-skill` 用法、7 个平台的目标目录表、各平台原生安装入口（`/plugin marketplace add`、`openclaw plugins install`、`hermes skills list`）。它描述的上游发行渠道在本包全部不成立（ADR-0006 已把这类内容从 README 清掉），但它对「哪个平台把 skills 放哪」的映射仍然准确，可以直接复用。
- `docs/assets/tangping_editorial_perspective.md`（106 行）是一篇用矛盾分析法解读「躺平」舆论的长评，带 10 条公开报道与统计数据的外链。它不是方法论正文，是**方法论被用在一个真实争议上的完整推演**：摆事实 → 找主要矛盾 → 区分矛盾性质 → 把网民表达读成群众路线的反馈 → 落到实践检验。ADR-0005 以「社区时评」为由排除，等于把手艺样本和手艺本身一起扔了。

## 决策

### 1. README 首屏加官方字标与预览入口

两份 README 顶部统一成同一版式：

```html
<p align="center">
  <img src="assets/logo.png" alt="Qiushi Methodology" width="620">
</p>
```

字标下方紧跟预览入口，用首屏实拍做可点击缩略图，并在文字里给出两条真能走通的路（本地双击、或跑脚本）：

```html
<p align="center">
  <a href="assets/preview/index.html"><img src="assets/preview/preview-hero.png" alt="Illustrated introduction" width="720"></a>
</p>

**[Open the illustrated introduction →](assets/preview/index.html)** — double-click the file, or run `./scripts/open-preview.sh`.
```

三条约束：

- 用 `assets/logo.png`，不用 `assets/icon.png`。后者是 1024×1024 白底市场图标（ADR-0003 的产物），放进正文只会在窄栏里变成一大块白。
- 只引用包内相对路径，不引入任何外链图片。
- 缩略图与字标都用 `<p align="center">` 居中，与下文居中的结构图对齐。

### 2. 方法结构图改为居中的矢量图，mermaid 源码折叠保留

`<div align="center">` 包 mermaid 在 GitHub 上不可靠：mermaid 代码块被 HTML 容器包住后通常不再被渲染器接管，结果是居中显示一段源码。所以不用拼渲染器行为，直接把图做成资源：

- 新增 `assets/diagram/method-structure.svg`（英文）与 `assets/diagram/method-structure.zh.svg`（中文），手写 SVG，五层纵向流程：精神底色 → 总原则 → 第一层哲学基座 → 第二层工作方法 → 第三层战略战术。图上文字与正文小节标题逐字一致。
- README 用 `<p align="center"><img src="assets/diagram/method-structure.svg" alt="Method structure" width="560"></p>` 引用。
- 原 mermaid 源码不删，移进 `<details><summary>Mermaid source</summary>` ——维护者要改图时有起点，读者默认看不到。
- SVG 只用 `<rect>`、`<text>`、`<path>`、`<marker>`，不引外部字体、不嵌脚本，主题色取 `#8a1f1f`（与字标同一色系）与 `#333`。

### 3. 上游仓库外链收敛到 NOTICE.md

ADR-0006 已经规定「不留上游分发信息」。README 正文目前把 `https://github.com/HughYau/qiushi-skill` 写在开头介绍段里（README.md:5、README.zh.md:9），口径上仍是「本包 repackage 了那个仓库」。改为：

- 正文不再嵌仓库 URL，写作「the upstream project this package derives from」。
- 出处、许可证、逐文件修改清单继续留在 `NOTICE.md`（MIT 的署名义务在那里履行，不受 README 措辞影响）。
- 「Inspiration」小节里的 `obra/superpowers` 链接保留 —— 那是对第三方的致谢，不是分发渠道。

另外按本项目口径改写两处不符实际的说法：介绍段不再说「one entry text plus ten playbooks」这种把形态讲成上游形态的话，改为直接说明「安装后只有一条条目，十份正文在包内按需读取」；「Install」步骤补上 `~/.astravia/skills/qiushi-skill` 的落点。

### 4. `hooks/` 纳入包内，注入路径改为 `references/skills/`

新增 `hooks/hooks.json`、`hooks/run-hook.cmd`、`hooks/session-start`、`hooks/session-start.ps1` 四件，来源是上游同名文件，逐字保留执行逻辑，只改一处：

```diff
-SKILL_PATH="${PLUGIN_ROOT}/skills/arming-thought/SKILL.md"
+SKILL_PATH="${PLUGIN_ROOT}/SKILL.md"
```

`.ps1` 版本同理。`hooks.json` 保持标准文件名与 `${CLAUDE_PLUGIN_ROOT}/hooks/run-hook.cmd session-start` 这条命令不变 —— 改名会让「整个目录复制到 Claude Code 插件目录」这条路径失效。

命名保持 `hooks.json` 还有一个副作用需要写明：宿主有「路径以 `/hooks/hooks.json` 结尾即视为插件来源」的判定（Observed），若它把已安装技能包也扫进来，会话启动就会注入 `arming-thought` 全文。**这正是本决策想要的效果**，但也意味着不能同时再在 `SKILL.md` frontmatter 里声明 `hooks:` —— 两条通道叠加会注入两遍。本包只走文件通道，入口 `SKILL.md` 的 frontmatter 保持三字段（`name` / `description` / `version`），不新增 `hooks` 键。

不承诺的部分也写清楚：Astravia 没有「安装时替你写用户 hook 配置」的机制，所以**注入是否发生取决于宿主是否把技能包当插件来源扫描**。这一条只能靠装完之后看会话启动上下文验证，不能靠读源码断言。README 与 `PLATFORMS.md` 都按「若宿主未扫描，技能仍会在被点名或被描述匹配时加载」来写，不作过度承诺。

### 5. `commands/` 纳入包内，定位为可移植入口资产

新增 `commands/` 与 10 份上游同名 `.md`，只改正文里的目标路径：

```diff
-读取并遵循 `skills/contradiction-analysis/SKILL.md`。
+读取并遵循 `$SKILL/references/skills/contradiction-analysis/SKILL.md`。
```

`$SKILL` 在 `PLATFORMS.md` 里定义为「安装后的包目录」，与入口 `SKILL.md` 里已经定义的 `$SKILL` 是同一个记号。

Astravia 内这十份不生效（宿主不扫 `commands/`，Observed）。它们服务于两件事：一是复制到 Claude Code / Cursor / OpenCode 之后是真的斜杠命令；二是给维护者一份「每个方法的最小调用模板」，改入口路由时对照。

### 6. `bin/` 不迁移，替代为 `scripts/install-platforms.mjs`

上游 CLI 的价值是「把资产复制到各平台目录并留清单」，不是 CLI 本身。本包不搬 `bin/`（9081 B 的命令行 + 3 个 lib，一半代码在处理 `npx` 包名与 GitHub 坐标），改写一个零依赖脚本：

- `scripts/platforms.json`：目标清单，每项含 `id`、`label`、`markers`（探测用）、`userPaths`、`projectPaths`、`assets`（`skills` / `commands` / `hooks` 的组合）。
- `scripts/install-platforms.mjs`：
  - `--list` 打印目标表与探测结果；
  - 默认 `--scope user`，`--scope project` 写当前目录；
  - `--target <id>`，省略时只处理探测到的平台；
  - 复制 `references/skills/*` 十个目录（每个自带 `SKILL.md`，天然符合各平台「一目录一技能」），按 `assets` 追加 `commands/` 与 `hooks/`；
  - 写 `.qiushi-skill-install.json`（`version: 1`，条目排序），`--uninstall` 只删清单内路径，拒绝删清单外文件；
  - 全程不联网，不执行 `npm`/`npx`。
- 安全边界照抄上游的纪律：目标路径必须由 `platforms.json` 算出且落在该平台根目录内；已存在但不在清单里的目录不覆盖，只报告冲突。

`--target astravia` 也列进清单，指向 `~/.astravia/skills`，但标注为「通常不需要：市场安装已经做过」——防止有人手动复制一份造成双份条目。

### 7. `docs/platforms.md` → `PLATFORMS.md` / `PLATFORMS.zh.md`

内容重写而不是搬运：

- 删掉 `npx qiushi-skill`、`/plugin marketplace add`、`openclaw plugins install`、`hermes skills list` 这些本包不存在的发行渠道指令。
- 保留「每个平台把 skills 放哪」的映射表，但来源改为 `scripts/platforms.json`，并注明本包用 `scripts/install-platforms.mjs` 落地。
- 新增三节：Astravia 自身的安装与注入现状（含「注入取决于宿主是否扫描包内 `hooks/hooks.json`」的如实表述）、无 Node.js 时的 `cp -R references/skills/*`、卸载方式。
- 中英各一份，默认英文，中文覆盖，与 README 的双语结构一致。

### 8. `tangping_editorial_perspective.md` 作为案例纳入

- 落点 `references/cases/tangping-editorial-perspective.md`，**逐字保留**，不改写、不删外链、不加编者按。
- 同目录新增 `references/cases/README.md`，写四件事：这份文本是什么（第三方评论）、为什么在包里（矛盾分析法的完整推演样本）、不代表谁（不代表本包与 Astravia 的立场，事实与判断均由原作者负责）、怎么读（先看它如何摆事实，再看它如何找主要矛盾，最后看它如何落到实践检验）。
- `NOTICE.md` 增一节披露来源与性质。
- 不放进 `detail.json` / `detail.zh.json`，不在市场详情页展示，不做任何引流。

`references/cases/` 下没有 `SKILL.md`，因此不会被宿主注册成技能条目；这一点由 `verify-package.mjs` 的隔离清单继续保证。

### 9. 版本与发布

包版本 `2.3.0` → `2.4.0`（新增 hooks / commands / PLATFORMS / 案例 / 脚本，属功能新增）。`configVersion` 保持 1（配置契约没变）。`marketplaceVersion` 不手工写，由 CI 在 `gh-pages` 分配。

## 兼容和迁移

- **已安装的 2.3.0**：升级后多出 `hooks/`、`commands/`、`PLATFORMS.md`、`references/cases/`、`scripts/install-platforms.mjs`、`assets/diagram/`。没有删除任何文件，`references/skills/` 布局不变，`SKILL.md` 的路由表与别名表不变 —— 旧引用继续可用。
- **条目数量**：`references/cases/` 与 `commands/` 都不含 `SKILL.md`，面板仍然只多 1 条。`references/skills/.ignore` 的 `*/SKILL.md` 规则继续精确覆盖 10 份。
- **hook 重复注入风险**：若用户此前按旧 README 的说法在 `~/.astravia/.claude/settings.json` 里手写过 SessionStart，升级后可能双份。缓解写进 `PLATFORMS.md`：先在配置里搜 `qiushi`，有就删掉自建那条。
- **旧 ADR**：ADR-0002 决策 4 与 ADR-0005 的排除条目各加一行「已被 ADR-0008 取代（2026-10-25）」，原文不追改。

## 备选方案

- **A. README 用 `<div align="center">` 包 mermaid。** 否决：GitHub 的 mermaid 渲染在 HTML 容器内不触发，读者看到的会是源码块，比左对齐更糟。
- **B. 把结构图做成 PNG。** 否决：需要额外截图与 OCR 复核流程，且缩放后文字发虚；SVG 手写一次即可维护，还能跟随主题。
- **C. 在入口 `SKILL.md` frontmatter 里声明 `hooks:`。** 否决：与文件通道叠加会注入两遍；且该通道在技能被 `invoke_skill` 激活时才登记，`SessionStart` 早已触发，收益为负。
- **D. 由 `install-platforms.mjs` 顺手写 `~/.astravia/.claude/settings.json`。** 否决：写用户全局配置属于「安装器改环境」，超出脚本职责；`PLATFORMS.md` 给出手写步骤，让用户自己决定。
- **E. 直接搬 `bin/`，改包名为本仓库。** 否决：它一半代码在解析 `npx` 包名与 GitHub 坐标，而本包的安装来自市场；搬过来等于维护一套用不上的发行逻辑。
- **F. `commands/` 只留 README 说明不复制正文。** 否决：`commands/*.md` 每份 400 B 左右，正文即「读取并遵循某技能 + 输出要求」，是给其他宿主的现成资产，省略反而要使用者自己写。
- **G. `tangping` 案例继续不打包，或只留摘要。** 否决：摘要会削弱它作为「推演样本」的价值，而不打包则让 ADR-0005 的判断继续掩盖一个可用样本；逐字保留 + 明确声明是风险更小的做法。

## 验证

1. `node scripts/marketplace.mjs check` 通过；`.astravia/marketplace.source.json` 中 `qiushi-skill` 的 `version` 为 `2.4.0`。
2. `node scripts/marketplace.mjs build` 产出 `.marketplace-build/site/abilities/skills/qiushi-skill`，包内含 `hooks/`、`commands/`、`PLATFORMS.md`、`references/cases/`、`assets/diagram/`，且不含 `tests/`。
3. 根 `node --test tests/*.test.mjs` 全绿。
4. 包内 `node scripts/verify-package.mjs`：路由 10、台账条目数与 `upstream.json` 一致、内联图 2、内层正文 10 份均被 `.ignore` 覆盖、`hooks/` 四件齐全且 `SKILL_PATH` 指向 `references/skills/`、`commands/` 十份且都指向 `$SKILL/references/skills/`。
5. 包内 `node --test tests/*.test.mjs` 全绿，新增断言：README 两份都引用 `assets/logo.png`、`assets/preview/preview-hero.png`、`assets/diagram/method-structure*.svg`，且都包含 `assets/preview/index.html` 链接。
6. `node scripts/sync-upstream.mjs --verify --upstream <本地检出>`：`references/skills/` 下 23 条仍逐字节一致；`hooks/`、`commands/`、`PLATFORMS.md`、`references/cases/` 作为改编产物登记进 `upstream.json.adaptations`，不参与逐字节比对。
7. `node scripts/install-platforms.mjs --list` 能打印目标表与探测结果；对 `~/.astravia` 与 `~/.claude` 的探测结果与手工 `ls` 一致；`--target` 缺省时不会写入未探测到的平台。
8. 视觉：`assets/diagram/method-structure.svg` 在浏览器打开后五层文字完整、无溢出；`preview/index.html` 与两份 README 的图片路径全部存在（`node -e` 校验相对路径可达）。

## 落地结果（Observed，2026-10-25）

1. **README 两份首屏**：`assets/logo.png` 宽 620、`preview-hero.png` 宽 720，均以 `<p align="center">` 居中；字标下方紧跟「Open the illustrated introduction」链接指向 `assets/preview/index.html`，并给出双击与 `./scripts/open-preview.sh` 两条路径。
2. **结构图**：新增 `assets/diagram/method-structure.svg` 与 `method-structure.zh.svg`，各 5 个方框（底线 + 总原则 + 三层）、9 个方法标签，`width="560"` 居中引用；mermaid 源码折叠进 `<details>`，图与源可对照。
3. **外链收敛**：`grep -c "github.com/HughYau"` 在 `README.md` / `README.zh.md` / `PLATFORMS.md` / `PLATFORMS.zh.md` / `SKILL.md` 五处均为 0；出处与修改清单集中在 `NOTICE.md`。
4. **hooks/**：`hooks.json` / `run-hook.cmd` / `session-start` / `session-start.ps1` 四件就位，`SKILL_PATH` 指向包根 `SKILL.md`（`arming-thought` 的替代品，`references/skills/` 下没有这个目录），`SKILL.md` frontmatter 仍为三字段、未加 `hooks` 键。
5. **commands/**：10 份就位，正文统一为 `$SKILL/references/skills/<name>/SKILL.md`。
6. **bin/ 替代**：`scripts/platforms.json` 列 8 个目标（`claude-code`、`cursor`、`codex`、`opencode`、`openclaw`、`hermes`、`nanobot`，加 `astravia` 自身），`scripts/install-platforms.mjs` 支持 `--list` / `--target` / `--scope` / `--uninstall` / `--dry-run`，全程零依赖零联网。`--list` 实测：7 个目标标 `[detected]`（本机存在对应目录），`openclaw` 与 `nanobot` 标 `[ ]`。
7. **PLATFORMS**：`PLATFORMS.md` 与 `PLATFORMS.zh.md` 就位，已剔除 `npx` / `/plugin marketplace add` / `openclaw plugins install` / `hermes skills list` 四类本包不成立的指令。
8. **案例**：`references/cases/tangping-editorial-perspective.md` 逐字保留（106 行、11827 B，与上游同 sha256），`references/cases/README.md` 写清来源、用途、立场边界与读法；未进入 `detail.json`。
9. **版本**：`2.3.0` → `2.4.0`（`ability.json`、`SKILL.md` frontmatter、`.astravia/marketplace.source.json` 三处同步），`configVersion` 保持 1。
10. **验证链**：`marketplace.mjs check` 通过 → `build` 产出含新增目录的包 → 根测试 69/69 → 包内 `verify-package.mjs` 0 问题（台账新增「27 条逐字节 + 16 条已改造」双计数）→ 包内测试 30/30（新增 hooks、commands、落点表、案例、README 插图五条）。
11. **宿主 hook 的边界已写进文档**：`PLATFORMS.md` 明确「注入是否发生取决于宿主是否把技能包当插件来源扫描」，`SKILL.md` 不作「安装即注入」的承诺。

12. **发布**：提交 `33951f4d` 推送后，`Publish ability marketplace` 运行 `40169265511` 的 build 与 publish 两个 job 均 success；gh-pages 生成 `chore(marketplace): 发布 2026.10.25-1`（`d0f9debd`），索引里 `qiushi-skill` 为 `2.4.0`、`category` 为 `Productivity`，`assets/diagram/`、`hooks/`（四件，含 `run-hook.cmd` 与两个 `session-start`）、`references/cases/` 均已落到分发目录。
13. **本地整链 build 未跑完**：该命令会在每个 plugin 上依次 `npm ci`/`build`/`test`，本次在本机跑到第 13 个插件时被人未提交改动拖慢而中止（`dbx-pro` 的 `vite build` 产出 100 MB，`rea` 单次打包数分钟），与本次改动无耦合；`check`、根测试、包内自检与包内测试均独立通过，站点侧的权威构建由 CI 的 build job 完成并通过。

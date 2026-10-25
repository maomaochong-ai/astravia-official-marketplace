# 来源与许可声明

本技能包收录的方法论文本来自开源项目 **qiushi-skill**：

- 仓库：https://github.com/HughYau/qiushi-skill
- 版本：2.0.0（commit `5ace7173b2d71fa7848c56a29f74b39d611c6cb3`）
- 许可：MIT，Copyright (c) 2026 qiushi-skills contributors（全文见本包 `LICENSE`）

## 文本改动

上游把十一种方法论拆在 `skills/<name>/SKILL.md` 里，由 Claude Code 插件机制注册成十一个技能；本包合并为一个 Astravia 技能，内部按路由表读取。逐处改动如下：

1. `SKILL.md`（本包入口）对应上游 `skills/arming-thought/SKILL.md`：
   - frontmatter `name` 由 `arming-thought` 改为包 slug `qiushi-skill`，`version` 改为本包版本；
   - `description` 重写为单入口的触发描述（上游那句「入口与总原则」在单包形态下不足以触发）；
   - 路由表第三列由「调用 `<skill>`」改为指向 `references/skills/<name>/SKILL.md` 的链接；
   - 新增「怎么用这些正文」一节：定义 `$SKILL` 根目录、给出上游标识（`arming-thought`、斜杠命令、裸 slug）到本包路径的对照、要求命中即读；
   - 其余正文（总原则四条硬规则、路由表第一二列、调用纪律三条、指令优先级）逐字未改。
2. 其余十种方法论正文，逐字节原样保存在 `references/skills/<name>/SKILL.md`，文件名与上游一致。宿主会递归走安装目录、把每个 `SKILL.md` 当成一条独立技能，因此同目录放了一份 `references/skills/.ignore`（规则 `*/SKILL.md`）把它们排除在技能发现之外；宿主在每层目录读 `.gitignore` / `.ignore` / `.fdignore` 并按该层路径加前缀，`scripts/verify-package.mjs` 会检查这份清单仍覆盖全部十份正文。核对方式：`node scripts/sync-upstream.mjs --verify`（按台账钉住的 commit 逐个取文件，不克隆仓库；离线时可加 `--upstream <检出目录>`）。
3. 上游 `SKILL.md` 里指向同目录参考文件的相对链接（`[original-texts.md](original-texts.md)` 等）保持原样：参考文件与正文仍在同一目录下。

## 角色简报改动

`agents/investigator.md`、`agents/self-critic.md` 取自上游 `agents/`，职责与输出格式保留，三处适配：

- 删除 frontmatter 的 `model: inherit`（Astravia 无该语义），改为正文「怎么派遣」一段，说明用哪类子 agent 承担；
- 正文中的 `skills/<name>/<file>.md` 路径改为 `references/skills/<name>/<file>.md`，并注明相对技能根目录；
- 增补「这是角色简报、不是宿主自动注册的 agent」这一说明，避免使用者误以为装包即出现两个子 agent。

## hooks / commands 改动

上游 `hooks/` 四件与 `commands/` 十份原样收录，各改一处路径：

| 上游 | 本包 | 改动 |
| --- | --- | --- |
| `hooks/hooks.json` | `hooks/hooks.json` | 未改：`SessionStart`、matcher `startup\|clear\|compact`、命令经 `run-hook.cmd` |
| `hooks/run-hook.cmd` | `hooks/run-hook.cmd` | 未改：sh / cmd polyglot，Windows 优先 `pwsh`、再 `powershell`、回退 `bash`/`sh` |
| `hooks/session-start` | 同名 | `SKILL_PATH` 由 `${PLUGIN_ROOT}/skills/arming-thought/SKILL.md` 改为 `${PLUGIN_ROOT}/SKILL.md` |
| `hooks/session-start.ps1` | 同名 | 同上，`$skillPath` 指向包根 `SKILL.md` |
| `commands/<name>.md` × 10 | 同名 | 正文「读取并遵循 `skills/<name>/SKILL.md`」改为 `references/skills/<name>/SKILL.md` |

注入目标是包根 `SKILL.md`：上游那份 `arming-thought` 在本包里就是入口，`references/skills/` 下没有同名目录。`SKILL.md` 的 frontmatter 保持三字段，没有加 `hooks` 键——宿主的技能级 hook 只在技能被显式调用时登记，与 `hooks/hooks.json` 这条文件通道重复。`scripts/verify-package.mjs` 会实跑 `hooks/session-start` 并检查输出里带路由表，路径改错会被当场发现。

## 介绍页改动

`assets/preview/index.html` 以上游 `docs/index.html` 为底本重写，只保留方法论内容与视觉语言：

- 删除上游分发信息与外部依赖：Google Analytics、Google Fonts 外链、GitHub 徽章与 Star History 图表、仓库 / Discussions / 公众号 / 第三方项目链接、`npx` 与 `/plugin marketplace` 安装段、加星号召、Pages 部署说明；
- 重写安装段为 Astravia 流程（添加市场源 → 安装 → 面板点开），补说明单条条目与按需读取的形态；
- 补第十份操作规程（工作流组合）与每份正文的实际路径；
- 改为纯离线页面：样式内联、系统字体回退；两张字标图内联为 `data:` URI，页面拷到任何位置（或不带同级图片）都能正常显示，也避免内嵌预览视图按相对路径取图失败；
- 引入动画时会补一条 1.2 秒兜底：观察器不回报也会把内容显出来，不留 `opacity:0` 的空白；
- 副标题与三段说明按本包形态重写。
- 收录上游 `docs/assets/tangping_editorial_perspective.md` 为 `references/cases/tangping-editorial-perspective.md`，逐字节未改（SHA-256 `08a22a9f67cef82604e1294b7592f961512a298b3f58b8fc84accd5466b41347`）；它是第三方案例，声明写在 `references/cases/README.md`，不进市场详情页。

## 新增脚本

`scripts/` 为本仓库新增，上游 `bin/` 的行为在这里重新实现：

| 脚本 | 作用 |
| --- | --- |
| `open-preview.sh` / `open-preview.ps1` | 用默认浏览器打开 `assets/preview/index.html` |
| `verify-package.mjs` | 离线自检：路由目标、正文相对链接、展示层资源、台账、内层隔离、hooks、commands、落点表、案例与结构图 |
| `sync-upstream.mjs` | 消费 `scripts/upstream.json`，按固定 commit 逐字节核对或同步（不克隆；`--upstream` 可改用本地检出） |
| `install-platforms.mjs` + `platforms.json` | 把包复制到其他宿主约定目录：`--list` / `--target` / `--scope` / `--uninstall` / `--dry-run`，写 `.qiushi-skill-install.json`，只删自己写过的条目 |

`install-platforms.mjs` 对应上游 `bin/qiushi-skill.mjs` 与 `bin/lib/detect-platform.mjs`，`platforms.json` 是那份目录表的静态化。差别在于：上游解析 `npx` 包名和 GitHub 坐标，本包只复制手上的文件，不联网、无依赖。

## 包内测试

`tests/` 参照上游 `tests/` 的做法新增，但检查对象不同：上游校验的是插件体系（`.claude-plugin/`、hooks、commands、安装 CLI），本包校验的是市场条目本身。

| 文件 | 校验 |
| --- | --- |
| `tests/package.test.mjs` | 入口身份与包版本一致、十份规程齐全且被路由表逐条指向、十份正文都叫 `SKILL.md` 且被 `references/skills/.ignore` 覆盖、十二份参考文件存在、台账每条映射都有落地文件、`detail` 区块类型与链接合法 |
| `tests/preview.test.mjs` | 介绍页零外部引用、两张图内联为有效 PNG、无上游标识残留、原始图片仍随包分发 |
| `tests/upstream-sync.test.mjs` | 台账结构、`--print` 不需要本地检出、分支名被拒绝、非 GitHub 仓库要求改用 `--upstream`、脚本只用内置模块 |

运行：`node --test tests/*.test.mjs`（离线，无第三方依赖）。上游的 `validate.sh` / `validate.ps1` 未迁移：它们的一半检查项（hooks、commands、`.claude-plugin`）在本包里不存在。

## 图形资源

包内 `assets/icon.png`、`assets/logo.png` 均来自上游项目标识 `assets/logo_main.png`：

- 来源：https://github.com/HughYau/qiushi-skill/blob/5ace7173b2d71fa7848c56a29f74b39d611c6cb3/assets/logo_main.png
- 改动：等比缩放并置于白底方形画布中央（`icon.png`），或仅转换文件格式（`logo.png`）。未裁切、未改色、未重绘。
- `assets/preview/qiushi.png`、`assets/preview/shishiqiushi.png` 为上游 `docs/assets/` 原文件，未改动。
- `assets/preview/preview-hero.png` 是本仓库对宣传页首屏的实拍截图，用于市场详情页的预览入口；不是示意图，也没有重绘任何标识。
- `assets/diagram/method-structure.svg` 与 `method-structure.zh.svg` 是本仓库按上游 README 的 Mermaid 结构图重绘的矢量图：五层方框、主题色取自同一份宣传页。Mermaid 源码保留在 README 的 `<details>` 里，图与源可以互相对照。

## 未收录的上游资产

上游 `bin/`（安装 CLI）不进入本包：它要解析 npm 包名与 GitHub 坐标，这两个东西在本包里都不存在，也无法在不联网的前提下工作。它的「复制 + 清单 + 拒绝覆盖非自己写入的路径」行为由 `scripts/install-platforms.mjs` 按 `scripts/platforms.json` 重新实现。上游 `docs/platforms.md` 重写为 `PLATFORMS.md` / `PLATFORMS.zh.md`，删掉 `npx`、插件市场命令与各宿主原生安装器，改指本包脚本。

`hooks/` 与 `commands/` 现在**是**收录的：宿主的会话启动引擎确实读 `hooks/hooks.json`，此前「没有对应扩展点」的判断已被实证推翻，取舍记录在 `docs/adr/qiushi-skill/0008-readme-hooks-and-platform-portability.md`，它推翻了 `0002` 决策 4 中关于 hooks 的那一半与 `0005` 关于 tangping 的那条。`0004` 的单技能形态不受影响。

市场展示文件（`ability.json`、`detail.json`、`detail.zh.json`）、`assets/preview/`、`assets/diagram/`、`agents/`、`scripts/`、`tests/`、`PLATFORMS.md` / `PLATFORMS.zh.md` 与溯源文件（`scripts/upstream.json`、本文件）为本仓库新增。`README.md` / `README.zh.md` 以上游同名文件为底本改写：保留「为什么需要这个」「这不是什么」「方法结构」「九大思想武器」「支撑文件」「灵感来源」「原著引用说明」等介绍段落与引语，替换掉上游的分发与安装方式（npm CLI、Claude Code marketplace、各宿主目录）、徽章与 star 图表、社区案例外链，并补上本包的安装、自检与上游同步三段。

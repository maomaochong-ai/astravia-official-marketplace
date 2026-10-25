# ADR-0007：正文文件名、台账位置与详情页的预览入口

## 状态

已接受（2026-10-25）。推翻 ADR-0004 与 ADR-0005 中「子正文改名为 `GUIDE.md`」的决策，推翻 ADR-0006 决策 1「台账留在包根」。另外两件事不是推翻，是补齐：详情页缺一个看得见的预览入口，演示对话的文字被容器裁掉。

## 背景

验收提出五点，其中两点直接与既有 ADR 冲突：

1. 十份正文与上游 `skills/<slug>/SKILL.md` 逐字节相同，只有文件名不同（`GUIDE.md`）。技能开发规范要求同名，改回 `SKILL.md`；但必须解决「包里任何 `SKILL.md` 都可能被递归扫描、再注册成一条独立技能」。
2. `upstream.json` 应移到 `scripts/`——本仓库其他技能的根目录只有固定的几个 json（`ability.json`、`detail.json`、`README.md`、`SKILL.md`、`LICENSE`），台账混在里面不像同一类东西。
3. 装好之后，市场能力页面上应该有能点到宣传页 `assets/preview/index.html` 的入口；同时演示对话里不能出现文字被圆角容器遮住、看不全。
4. 「技能/场景」列表在激活后是不是只有求是这一条。
5. 递增版本号，由 CI 自动发布到市场。

第 3、4 点先要弄清宿主的实际行为，不能凭感觉改。

## 决策

### 1. 正文改回 `SKILL.md`，用 `references/skills/.ignore` 阻断递归注册

宿主发现技能的入口是内部的 `loadSkillsFromDirInternal(dir, source, includeRootFiles, signal, ignoreMatcher, rootDir)`：

- 递归遍历目录；子目录调用时 `includeRootFiles = false`，即**任意深度**的 `SKILL.md` 都会被收成一条技能；
- 跳过以 `.` 开头的条目与 `node_modules`；
- 进入每层时调用 `addIgnoreRules`，读该层的 `.gitignore` / `.ignore` / `.fdignore`，每行规则自动加上「该层相对 root 的路径」前缀；
- 遍历时对每个条目算相对 root 的 posix 路径，`matcher.ignores(相对路径)` 命中就 `continue`。

所以只要在正文所在层放一份忽略清单、写 `*/SKILL.md`，十条内层 `SKILL.md` 就落在发现之外，而入口那份 `SKILL.md`（包根，不在 `references/skills/` 下）不受影响（Observed，源码；端到端待安装验证，见「验证」第 7 条）。

选 `.ignore` 而不是 `.gitignore`：`.gitignore` 里的 `*/SKILL.md` 会让 git **连带不再追踪**这十份正文，包内容直接少十个文件。`.ignore` 只被宿主的发现逻辑读取，git 不认它。

`.ignore` 本身不进台账——它是本仓库新增件，上游没有对应物。`verify-package.mjs` 新增第 6.5 节：遍历 `references/` 下所有 `SKILL.md`，逐条要求被清单命中，漏一条就失败并指名是哪份。

### 2. 台账移到 `scripts/upstream.json`

`upstream.json` 是 `sync-upstream.mjs` 唯一消费的数据，两者同目录。包根因此只剩身份与展示文件，与另外四个技能（`cloudflare`、`workers-best-practices`、`wrangler`、`zhihu-search`）的根目录构成一致。

ADR-0006 决策 1 的理由是「台账是数据不是脚本，放 `scripts/` 会让人以为它能执行」。这条理由在只有四个既有技能做样本时成立；实际看根目录构成，判据不是「能不能执行」，而是「是不是身份/展示文件」。台账两者都不是，它跟着消费者走更不容易被误当元数据。

代价是路径变更必须同步到所有读取方：`sync-upstream.mjs` 的 `ledgerPath`、`verify-package.mjs`、`tests/package.test.mjs`、`tests/upstream-sync.test.mjs`，以及 `NOTICE.md` 与两份 README。

### 3. 详情页给宣传页一个看得见的入口

`detail` 的区块白名单里没有 `html`，`links` 只接受 `http:` / `https:`，所以没法在能力页面上直接嵌这份本地页面，也没法给一个 `file://` 链接。能用的只有 `image` 和 `steps`：

- `image`（新增）：`assets/preview/preview-hero.png`，1200×681，就是那份页面的首屏实拍，不是示意图。前后各有一块 `image`（先是字标，然后才是页面），读的人先看到它长什么样。
- `steps`（改写）：把原来那句「让助手跑 `scripts/open-preview.sh`」换成确切路径 `open ~/.astravia/skills/qiushi-skill/assets/preview/index.html`，并保留包内脚本作为备选。

中英两版同步。首屏截图用 ego-browser 打开 `file://` 直接截，视口 1200 宽，不缩放、不裁切。

### 4. showcase 文案按容器容量定上限，并写成测试

`chat-thread` 模板的容器是 `h-44`（176px）+ `overflow-hidden`，assistant 气泡另加 `line-clamp-3`；其余五个 `showcase` 模板也都是 `h-44` + `overflow-hidden`。原来那条约 300 字符的回复必然被裁，这不是渲染 bug，是内容超了容器。

改法不是放宽容器（宿主 UI 不归包管），而是把文案压到容器能装下的长度：英文 155 字符、中文 56 字，完整解释移到 `steps` 块。同时把上限写进 `tests/package.test.mjs`（英文 170 / 中文 80），下次改文案越界会直接失败，而不是等到界面上发现字少了半行。

### 5. 面板条目数只核对事实，不替用户动手

`agents-user` 这一来源在宿主里对应 `~/.agents/skills`，不是 `~/.claude/skills`（后者只作为 hook 配置目录出现在别处）。本机 `~/.agents/skills/` 现有 11 个与上游同名的方法论目录（`arming-thought`、`contradiction-analysis`、`practice-cognition` 等），它们是各自独立的技能目录，且内部链接相对上游仓库结构，装在这里是断开的状态。

结论：激活后**不是**只有求是这一条——面板会是「1 条 `qiushi-skill`」加「11 条散件」。要让面板只剩一条，得清掉那 11 个目录，那是用户主目录，不在本包的职责与授权范围内。本 ADR 只记录事实，处置留给用户。

### 6. 版本 `2.3.0`，发布由 CI 决定

包版本 `2.2.0` → `2.3.0`（`SKILL.md:3`、`ability.json:5`、`.astravia/marketplace.source.json` 三处同步），`configVersion` 保持 `1`——配置契约没变。

`marketplaceVersion` 不手工写。`publish-marketplace.yml` 在 push 到 `main` 时触发（另有 `workflow_dispatch`），先 `node scripts/marketplace.mjs check`，再用钉住的 tooling commit 构建、上传制品、推进 `gh-pages`。本地 `build` 只证明产物可生成、`distribution changed: true`。

## 兼容和迁移

- 安装形态不变：仍是 `~/.astravia/skills/qiushi-skill/` 一个目录，宿主只多认一个 `.ignore` 文件，不产生新条目。
- 十份正文与十二份参考文件**零改动**，`--verify` 仍应报 `same 23 / diff 0`。改的只是文件名与它们的引用路径（入口路由表、别名表、台账 `files` 键）。
- 已装 `2.2.0` 的用户升级到 `2.3.0`：多出 `references/skills/.ignore` 与 `assets/preview/preview-hero.png`，少一个包根 `upstream.json`。旧版本已装好的目录里残留的 `GUIDE.md` 不会被新版读取，但因为 `2.2.0` 分发时正文是 `GUIDE.md`、`2.3.0` 是 `SKILL.md`，安装器按整目录覆盖，不会两份并存。
- 台账路径变化对外部脚本是破坏性的；本仓库内四个读取方已同步。
- `.ignore` 依赖宿主在发现阶段读取它。若某个宿主构建不读忽略文件，会出现十条重复条目——`verify-package.mjs` 只能校验清单存在且覆盖完整，不能证明宿主行为，这一条得靠安装一次实测。

## 备选方案

| 方案 | 否决理由 |
| --- | --- |
| 继续保持 `GUIDE.md` | 与上游不同名，维护者每次对照上游都要换算；技能规范也要求正文同名 |
| 用 `.gitignore` 而不是 `.ignore` | git 会连带忽略十份正文，分发包直接缺内容 |
| 安装后由脚本改名 | 宿主行为不可控，且源码树与运行树不一致，自检无法覆盖 |
| 把正文挪到包目录外，靠绝对路径引用 | 技能安装只复制包目录，挪出去就丢了 |
| 详情页里嵌 iframe / 自定义 HTML | `detailBlockTypes` 白名单没有 `html`；`links` 只允许 http(s) |
| 把宣传页做成一张长图塞进 `image` | 长图在详情页里会被压成看不清的缩略图，首屏反而更准 |
| 只压文案，不写测试 | 下次改文案会重新踩同一个坑，且没人记得 `h-44` 这个约束 |
| 手工写 `marketplaceVersion` | 与仓库规则冲突，该值由 CI 分配 |
| 顺手清理 `~/.agents/skills/` 里那 11 条 | 那是用户主目录，与本包分发无关，未经授权不动 |

## 验证

1. `cd abilities/skills/qiushi-skill && node --test tests/*.test.mjs` → 23 个用例全绿（新增 showcase 长度与预览入口两条）。
2. `node scripts/verify-package.mjs` → 路由 10、台账 24、介绍页内联图 2、内层正文 10 份均被隔离、角色简报 2、包内测试 3，`结果：全部通过（0 处问题）`。
3. `node scripts/sync-upstream.mjs --verify` 当天被 GitHub API 限流（HTTP 403，六份文件 failed）；改用 `--verify --upstream <本地检出>`（同一份钉住的 commit）→ `same 23 / diff 0 / missing 0 / failed 0`。另抽查 `cmp -s references/skills/practice-cognition/SKILL.md 上游/skills/practice-cognition/SKILL.md` → 相同。
4. 仓库根：`node scripts/marketplace.mjs check` 通过；`node --test tests/*.test.mjs` 69/69。
5. `node scripts/marketplace.mjs build` → 产物含 `references/skills/.ignore`、`assets/preview/preview-hero.png`，不含 `tests/`。
6. 目录自检：`find references -name SKILL.md | wc -l` = 10；`cat references/skills/.ignore` 含 `*/SKILL.md`。
7. 端到端（待授权）：装一次后 `astravia action run skills.query '{"operation":"list"}'`，`qiushi` 相关条目应为 1 条而不是 11 条。

## 落地结果（Observed，2026-10-25）

1. 十份 `references/skills/<slug>/GUIDE.md` → `SKILL.md`，用 `git mv`，内容未动；`references/skills/.ignore` 内容为注释两行加 `*/SKILL.md`。
2. `upstream.json` → `scripts/upstream.json`；`sync-upstream.mjs` 的 `ledgerPath`、`verify-package.mjs`、两份测试、`NOTICE.md`、两份 README 全部同步。
3. `verify-package.mjs` 新增第 6.5 节并实测输出「内层正文 10 份，均被忽略清单隔离」。
4. `detail.json` / `detail.zh.json` 各 8 块（原 7 块，新增首屏 `image`）；showcase 回复英文 155 字符、中文 56 字。
5. `assets/preview/preview-hero.png` 由 ego-browser 打开 `file://` 截取，1200×681、168367 B；同步修掉页面正文里「十一份操作规程」的旧口径（应为十份）。
6. 包内测试新增两条用例后 23/23；其中「references/ 里每个文件都有台账条目」这条最初把 `.ignore` 判成缺台账，已加 `LOCAL_ONLY` 白名单。
7. 版本 `2.3.0` 三处同步；`marketplace.mjs check` 通过，根 `node --test tests/*.test.mjs` 69/69。
8. 面板事实：`~/.agents/skills/` 含 11 个上游同名目录（`source: agents-user`），`~/.claude/skills/` 不被本宿主扫描；`astravia action` 的 action server 当前未运行（`~/.astravia/action-server.json` 缺失），面板列表无法在线复核。`~/.astravia/skills/` 里没有 `qiushi-skill`——本机尚未安装，市场侧的 `gh-pages` 仍是旧版本。
9. 构建产物核对：包根只有 `ability.json`、`detail.json`、`detail.zh.json`；`references/skills/.ignore`、`assets/preview/preview-hero.png`、`scripts/upstream.json` 均在产物中；内层 `SKILL.md` 10 份；无 `tests/`。
10. 未提交、未推送：CI 发布链路已确认（push `main` → `publish-marketplace.yml`），但触发需要一次提交与推送，尚未获得授权。

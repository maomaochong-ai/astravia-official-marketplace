# ADR-0003：官方图标、双语文案与安装后的技能激活判据

## 状态

已接受，但决策 5 中「面板出现 11 条」的预期已被 [ADR-0004](./0004-single-skill-with-internal-routing.md) 修订为 1 条。图标来源与派生规则不变。

上游基线 `HughYau/qiushi-skill` `2.0.0`（commit `5ace7173b2d71fa7848c56a29f74b39d611c6cb3`）。形态见 [ADR-0001](./0001-qiushi-skill-as-ability-bundle.md)（形态部分已由 ADR-0004 取代），内容保真见 [ADR-0002](./0002-upstream-fidelity-and-content-boundaries.md)。

## 背景

1. 上游仓库只有两张可用图形资产，都是**横排字标**，没有方形图标：
   - `assets/logo_main.png`：3118×1376，913 KB，被 `README.md` 首图直接引用（`width=400`），内容为深色字标「丢掉幻想，准备斗争 / 求是 / skill」（Observed：OCR 与 96px 缩略图的像素分布，白底、内容集中在画面中部横条）。
   - `docs/assets/qiushi.png`：427×248，11 KB，是同一标识的缩小版（文档内嵌用）。
   - `docs/assets/shishiqiushi.png`：1060×291，横幅。
2. 仓库规范要求「有官方品牌或应用图标的能力必须用官方位图，禁止拿 Iconify 里看起来像的图形凑数」，同时卡片图标在客户端按小尺寸方块渲染。
3. 仓库测试对展示资源有两类硬约束：`detail.json` 里的 `image.src` 不支持 `solar:`；`icon` 与 detail 引用的资源必须被 `git ls-files` 追踪，否则 `assertTrackedPresentationResource` 失败（Observed：`tests/marketplace.test.mjs`）。
4. 名称有禁用词：`ability.name` 与所有 `detail.i18n.*.name` 不得匹配 `/\b(?:mcp|skill|plugin|bundle)\b|技能|插件|套装/iu`。上游仓库名 `qiushi-skill` 直接做展示名会被测试拦下。
5. 分类必须 `category` + `categoryI18n.zh/en` 成对出现，且同一 `category` 在全库使用一致的译名（Observed：`tests/marketplace.test.mjs` 的同分类一致性断言）。既有映射里 `Productivity` ↔ `效率`。
6. 宿主安装后：技能落在 `~/.astravia/skills/<slug>/`，清单条目 `enabled: true`，`alias` 取市场卡名称、`marketDescription` 取市场卡简介（Observed：`~/.astravia/skills-manifest.json` 中 `zhihu-search`、`pdf` 两条）。对话框「技能 / 场景」面板按清单与目录逐条列出。
7. 宿主同时扫描 `~/.claude/skills`，本机该目录已存在同名 `arming-thought` 等 11 个技能（Observed）。实测 `skills.query` 的 `list` 结果里这 11 个 slug 全部来自该目录，`source` 为 `agents-user`、无 `alias`。市场安装不写那个目录，但面板可能同时看到两份。

## 决策

### 1. 图标：用官方字标派生方形图标，不裁剪、不改色、不重绘

- `assets/icon.png`（1024×1024）：把 `assets/logo_main.png` 的**完整画面**等比缩放到宽 896 后居中放到 1024×1024 白底画布上；白底取自原图四角实测颜色 `rgb(255,255,255)`（Observed：BMP 抽样四角均为 255/254）。只做缩放与留白，不裁掉任何笔画、不改色调、不叠加描边或阴影。
- `assets/logo.png`：官方原图转成真正的 PNG（原文件扩展名是 `.png` 但内容为 JPEG），不做任何像素改动，供详情页 `image` 块以原始横幅比例展示。
- 11 个成员技能**不各自配图**，统一复用同一份官方标识：它们是同一方法体系的组成，独立配图反而制造不存在的品牌差异。

这样处理的代价要说清楚：官方标识是横排字标，放进方形画布后在小尺寸下可辨识度有限。这是「必须用官方图」这条规则的直接结果，接受它，而不是靠自绘一个方形徽标来「优化」。

### 2. 展示名与卡片文案：英文为默认，中文整体覆盖

- 集合包：`name: "Qiushi Methodology"`，`detail.i18n.zh.name: "求是方法论"`。
- 11 个成员卡：`Arm the Thinking / 武装思想`、`Contradiction Analysis / 矛盾分析`、`Practice and Cognition / 实践认识`、`Investigate First / 调查研究`、`Mass Line / 群众路线`、`Criticism and Self-Criticism / 批评与自我批评`、`Protracted Strategy / 持久战略`、`Concentrate Forces / 集中兵力`、`Spark a Prairie Fire / 星火燎原`、`Overall Planning / 统筹兼顾`、`Workflow Patterns / 工作流组合`。
- 所有展示名都避开「技能 / 插件 / 套装 / skill」等类型词：`qiushi-skill` 只作为 slug 存在，不进任何 `name` 字段。
- 简介写「用户能得到什么」，不复述上游口号；每条 1 句，中英各一份。

### 3. 分类：并入 `Productivity` / `效率`

集合包与 11 个成员统一 `category: "Productivity"`、`categoryI18n: {"zh": "效率", "en": "Productivity"}`。不新开 `Thinking`、`Methodology` 之类分类：新增分类要客户端有对应图标与排序位，为一个来源开新组不划算（同 ADR-0001 决策 5）。

### 4. 详情页结构：集合包讲体系，成员讲单件

| 载体 | blocks |
| --- | --- |
| 集合包 `detail.json` / `detail.zh.json` | `hero`（体系定位）→ `image`（官方横幅 `assets/logo.png`）→ `feature-grid`（11 个方法论各一条，`solar:` 图标）→ `steps`（安装 → 在面板打开入口 → 按需调用）→ `showcase`（`chat-thread`，中文覆盖用中文示例）→ `callout`（信息：没有会话自动注入，需点名入口；上游 MIT，正文未改） |
| 成员 `detail.json` / `detail.zh.json` | `hero`（一句话价值）→ `feature-grid`（3 条：用它的场景 / 它输出什么 / 什么时候不该用，取自上游 `用 / 不用` 小节）→ `showcase`（`chat-thread` 示例） |

中文版是同构整体替换（`detail.i18n.zh.path`），不混排英文块。示例回复是「说明预期流程」的写法，不冒充真实执行结果。

### 5. 激活语义：安装即本地启用，无需在线校验

用户要求的「进入对话框技能 / 场景后能看到处于已特权状态、离线验证后的技能」，在 Astravia 的实现里对应下面这组可观测事实，而不是某个授权开关：

1. 集合包安装时，11 个技能包各自解到 `~/.astravia/skills/<slug>/`，目录内含 `SKILL.md` 与全部参考文件。
2. `~/.astravia/skills-manifest.json` 为每个 slug 写入 `enabled: true`、`type: "skill"`、`source: "market"`、`alias`（市场卡名）、`marketDescription`。
3. 技能是纯文本资产：不联网、不执行脚本、不读远端配置，断网状态下加载与会话内调用行为不变——这就是「离线可用」的实际判据。
4. 面板可见性只取决于 1–2 两项：目录在、清单 `enabled` 为真。没有单独的「解锁」步骤，也没有需要先完成的授权授权流程。

据此，验收不看界面上的某个徽标，而是查清单与目录（见验证一节）。

### 6. 与 `~/.claude/skills` 同名技能并存

市场安装不触碰 `~/.claude/skills`。两处同名技能同时存在时，宿主的呈现方式（并列两条 / 按名称去重后只留一条）**未经验证**，本 ADR 记为 Assumed，并在验证第 4 步实测记录。若出现遮蔽，处理方式是让用户在会话面板停用其中一份，而不是改名——改名会破坏与上游的对应关系（ADR-0001 决策 2）。

安装前实测（Observed）：对话框面板已经能按这 11 个 slug 列出条目，但展示的是 `~/.claude/skills` 的原文 `name` 与长 `description`，没有 `alias`。安装后应当变成带 `alias` 的市场条目（名称如 “Arm the Thinking”）；两份是否共存需按验证第 4 步确认。

## 兼容和迁移

- 图标与详情都是新增展示资源，不影响任何既有能力的解析路径；非插件内容按版本复用，本次新增包此前未发布，走首次发布路径。
- `assets/icon.png`、`assets/logo.png` 与各成员的 `detail*.json` 必须随源码提交（`git ls-files` 要能看到），否则构建出的详情会缺图。
- 旧客户端（`< 0.5.59`）整体拒绝本源并沿用旧缓存，不会出现半张卡。

## 备选方案

**A. 用 `solar:` 图标充当卡片图标。** 违反仓库「有官方标识必须用官方位图」的规则，且这个方法体系确有官方标识。否决。

**B. 裁掉字标两侧留白做成近方形。** 会让字标在小尺寸下更满、更清晰，但裁剪属于对官方图的再构图，与「不重绘、不改动品牌资产」冲突。否决，保留完整画面。

**C. 自绘一个方形徽标（例如取「求」字做图形）。** 属于自行生成近似商标，明确禁止。否决。

**D. 11 个成员各配一张图。** 上游没有对应资产，只能自造，且会暗示 11 个独立品牌。否决。

**E. 在详情页加 `markdown` 块直接把上游 README 贴进来。** 那是开发者向的安装说明，与「详情是产品介绍」的规范冲突；技术细节通过 `meta.repository` 链接到上游。否决。

## 验证

> 下方命令写于 11 个成员包时期，路径已由 ADR-0004 取代（现为单一包 `abilities/skills/qiushi-skill/`）。图标与激活语义的判据不变，路径请按 ADR-0004「验证」节替换。

```bash
cd astravia-official-marketplace

# 1) 展示资源被追踪、图标可解码、尺寸正确
git ls-files abilities/bundles/qiushi-skill abilities/skills/arming-thought | grep -E 'icon|logo|detail' 
sips -g pixelWidth -g pixelHeight -g format abilities/bundles/qiushi-skill/assets/icon.png

# 2) 名称禁用词与分类一致性由测试覆盖
node --test tests/marketplace.test.mjs

# 3) 构建并检查产物
node scripts/marketplace.mjs check && node scripts/marketplace.mjs build

# 4) 安装后激活判据（在 Desktop 市场安装集合包后执行）
python3 - <<'PY'
import json, os
m = json.load(open(os.path.expanduser('~/.astravia/skills-manifest.json')))
slugs = ["arming-thought","contradiction-analysis","practice-cognition","investigation-first",
         "mass-line","criticism-self-criticism","protracted-strategy","concentrate-forces",
         "spark-prairie-fire","overall-planning","workflows"]
for s in slugs:
    e = m.get(s)
    print(s, bool(e), e and e.get('enabled'), e and e.get('alias'),
          os.path.exists(os.path.expanduser(f'~/.astravia/skills/{s}/SKILL.md')))
PY
```

判据：

1. `icon.png` 为 PNG、1024×1024；`logo.png` 为 PNG 且宽高比 3118:1376。
2. 禁用词测试通过：集合包与 11 个成员的 `name`、`detail.i18n.*.name` 都不含 `skill`/`技能` 等。
3. 第 4 步输出 11 行，每行四个 `True` 加对应 `alias`（市场卡名称）。
4. 打开对话框「技能 / 场景」面板，能按 `alias` 找到并点开 11 个技能；与 `~/.claude/skills` 同名项的呈现（并列或去重，Assumed）在此步记录实测结果。
5. 断网后重开面板，11 条仍在、仍可点开——这是「离线可用」的实测判据。

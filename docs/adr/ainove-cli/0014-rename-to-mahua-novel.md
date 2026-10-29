# ADR 0014：插件更名为「麻花小说 / Mahua Novel」——只改展示身份，不动工程身份

- 状态：已接受（2026-10-29，随 0.1.0）
- 决策对象：一切**给人看**的名字位：市场目录条目、`plugin.json` 的 `%plugin.name%`、侧栏视图标签、
  智能体与团队名、工具 `label`、`detail.json` / `README.md` 标题
- 相关：ADR 0009（能力对齐，工具面不变）、ADR 0010（自足断言按 `novelwright-` 前缀判定）

## 1. 背景

这个插件从 0.0.1 起叫 Novelwright。名字是英文自造词，中文界面上没有对应的说法——
中文用户看到的侧栏、目录卡片、工具调用行全是英文名，与「用中文写小说的作者」这件事对不上。

用户的要求是把展示名统一成**「麻花小说」，英文直译**。

难点不在改名，而在**改到哪一层为止**。这个仓库里 `novelwright` 同时是：

| 出现位置 | 是什么 | 能不能改 |
| --- | --- | --- |
| 市场 `slug` / `plugin.json` 的 `id` | 安装身份、升级与卸载的依据 | **不能** |
| 31 个工具 id `novelwright_*` | 模型与宿主白名单里的契约 | **不能** |
| 智能体 id `novelwright-architect` 等 | 清单引用、ADR 0010 的跨插件断言 | **不能** |
| `books/<id>/…` 存储路径、`entitlement.json` | 已安装用户的稿件位置 | **不能** |
| `%plugin.name%`、视图标签、智能体名、工具 `label` | 界面上读到的那几个字 | **要改** |

## 2. 决策

### 2.1 展示名：中文「麻花小说」，英文 Mahua Novel

英语名取「麻花」的拼音 + Novel，不用意译（fried dough twist 无意义），也不另造词。
一个能力在两种语言下只有一个名字，不提供第三种叫法，不做别名。

### 2.2 只改展示位，工程身份一个字不动

改动的九个位置：

1. `locales/zh.json` → `plugin.name`、`view.studio.label`、`studio.title` = 麻花小说
2. `locales/en.json` → 同三处 = Mahua Novel
3. `agent.*.name`、`team.studio.name` → `Mahua Novel Architect / Writer / Editor / Arbiter / Studio`
4. 工具 `label` 前缀 `Novelwright: ` → `Mahua Novel: `（31 处，模型与用户在工具调用行看到的就是它）
5. `detail.json` / `detail.zh.json` 的 hero 文案里作为主语出现的旧名
6. `README.md` / `README.zh.md` 标题与首段
7. 市场源 `.astravia/marketplace.source.json` 条目的 `name` 与 `detail.i18n.zh.name`
8. `ability.json` 的版本随本轮一起抬（见 0015/0016）
9. `CONTEXT.md` 词汇表里作为产品名的条目

**不改**：`slug`、`id`、工具 id、智能体 id、存储路径、权限名、`agent/` 下的 id 引用。
理由是改 id 的代价落在已安装用户身上（配置失联、工具白名单失效），而收益只是"看起来一致"。

### 2.3 代码注释与 ADR 里的 Novelwright 保留

`src/domain/novel-types.ts` 的头注释、ADR 0001–0013 里出现的 Novelwright 是**工程身份**，
不是产品名。回头把它们一起改掉，只会让历史记录与当时代码对不上。

### 2.4 名称不带类型后缀

「麻花小说」本身已经是产品名，不再写成「麻花小说插件 / Mahua Novel Studio Plugin」。
`plugin.description` 保持描述性文字，承担「这是什么」的职责。

## 3. 后果

- 中文用户的侧栏、目录卡片、工具行读到的都是「麻花小说」；英文用户读到 Mahua Novel。
- 已安装用户的稿件、凭证、工具白名单全部不受影响——这是本次唯一不能出错的地方。
- 出现一处**名字两套**的中间状态：文档里叫 Novelwright，界面里叫麻花小说。这是自觉的取舍，
  与 §2.3 同一条理由。

## 4. 不做什么

1. **不改 slug 做"真更名"**：需要迁移存储路径与凭证文件，属于破坏性变更，收益是零。
2. **不保留旧名做别名**：`Novelwright` 不再出现在任何展示位；一个能力两个名字会让人以为装了两个。
3. **不给智能体单独起中文花名**（如「架构师·阿构」）：ADR 0002 已定角色名即职责名，
   花名会让成员胶囊与团队清单对不上。

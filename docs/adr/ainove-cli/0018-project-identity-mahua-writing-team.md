# 0018 — 工程身份改为 mahua-writing-team，侧栏拆成「麻花小说网」与「麻花写作团队」

- 状态：已接受（2026-10-29）
- 取代：ADR 0014 的名称部分（0014 的其余结论继续有效）

## 背景

ADR 0014 把插件显示名从「著书匠」改成「麻花小说」，slug、工具 ID、团队 ID 都没动，那是当时最小改动的做法。
现在产品面变了：

1. 工程名与目录名要跟产品名对齐，`novelwright` 这个名字在代码、市场 slug、构建产物里到处出现，
   找人改一个文案要翻五处身份文件；
2. 侧边栏要出现两个名字：独立项叫「麻花小说网」，团队叫「麻花写作团队」。0014 里两者都叫「麻花小说」，
   在会话里点了团队之后看到的名字和侧栏项一模一样，用户分不清「我现在是在跟团队说话还是在看作品库」。

## 决策

### 1. 工程身份（一次性改到底）

| 位置 | 旧 | 新 |
| --- | --- | --- |
| 目录 | `abilities/plugins/novelwright/` | `abilities/plugins/mahua-writing-team/` |
| `plugin.json#id` | `novelwright` | `mahua-writing-team` |
| `package.json#name` | `@astravia-marketplace/novelwright` | `@astravia-marketplace/mahua-writing-team` |
| `moduleFederation.remoteName` | `novelwright` | `mahua_writing_team` |
| 市场 slug | `novelwright` | `mahua-writing-team` |
| 配置版本 | `configVersion: 1` | 不变（配置契约没变） |

`remoteName` 用下划线：它与 `content-creation` 的 `content_creation` 同规矩，模块联邦的远端名要能当标识符用，
带连字符在产物里要多一层引号处理，没必要。

### 2. 显示名

| 面 | 中文 | 英文 |
| --- | --- | --- |
| 插件（市场卡片、独立侧栏项、页头） | 麻花小说网 | Mahua Novels |
| 团队（会话里可 @ 的团队） | 麻花写作团队 | Mahua Writing Team |
| 团队视图标题（`view.studio.label`） | 麻花小说网 | Mahua Novels |

「小说网」是作品库这一侧的名字，「写作团队」是人这一侧的名字。两个名字之后不再混用：
凡是出现在作品列表、书页、阅读页上的，都是「麻花小说网」；凡是出现在成员条、@ 提及、团队描述里的，都是「麻花写作团队」。

### 3. 同一轮一并改掉的其它 id

- **智能体 id**：`novelwright-architect` → `mahua-architect`（writer / editor / arbiter 同理）。
  `mentionHandle`（`architect` / `writer` / `editor` / `arbiter`）不动——它是用户在输入框里打的 @，与产品名无关。
- **团队 id**：`novelwright-studio` → `mahua-studio`。它与视图 id `studio` 对齐，保留这个尾巴有解释成本低的好处。
- **工具 ID**：`novelwright_*` → `mahua_*`，33（本轮后 35）个工具全改。工具 ID 会直接出现在宿主的工具列表
  与模型上下文里，留着旧前缀就是留一处与产品名冲突的名字。
- **存储路径与存储键**：`books/`、`chapters/`、`reviews/`、`decisions/`、`entitlement.json` **不变**。
  存储布局是账本的形状，与产品名无关。
- **视图 id**：`studio` / `activation` 不变。它们是路由键，不是名字。
- **`minAppVersion`**：身份改动不引入新的宿主 API。

### 4. 工具 ID 一并改名

`novelwright_read_chapter` → `mahua_read_chapter`，33（本轮后 35）个工具全改。
理由：工具 ID 会直接出现在宿主的工具列表与模型上下文里，留着 `novelwright_` 就是留着一处与产品名冲突的旧名字。
代价是旧对话里记录的工具名失效——这个插件从未发布（gh-pages 的 `marketplace.json` 里没有它），没有真实用户受影响。

### 5. 版本

`0.1.0 → 0.2.0`。身份、工具面、agent 目录、界面都变了，按 `AGENTS.md` 的「运行内容变化必须抬版本」处理。
五份身份文件（`plugin.json`、`package.json`、`package-lock.json`、`ability.json`、`.astravia/marketplace.source.json`）同一步改完。

## 后果

- 旧 slug `novelwright` 从市场源里消失，不保留别名：从未发布，没有安装记录需要迁移。
- `test/manifest-guards.test.ts` 里所有硬编码的 `novelwright` 都要跟着改；这几条守禁是本轮改名的安全网
  （工具前缀、插件自足、`agent` 成员只指本插件）。
- 迁移脚本不存在也不该存在：改名是一次性的源码动作，不是运行时迁移。

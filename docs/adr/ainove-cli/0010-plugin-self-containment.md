# ADR 0010：插件自足——不跨插件引用任何实体

- 状态：已接受（2026-10-29，随 0.0.1）
- 决策对象：`abilities/plugins/novelwright`
- 相关：ADR 0002（智能体与团队）、仓库规范 [`docs/plugin-project-structure.md`](../../plugin-project-structure.md)

## 1. 背景

宿主把每个插件当成**独立安装单元**：单独启停、单独升级、单独卸载，权限与存储按 `pluginId` 隔离。
市场里 13 个插件之间没有任何运行时依赖，也没有「装 A 才有 B」的机制。因此任何跨插件的实体引用
（引用别的插件的智能体、团队、工具，或假设别的插件已装）都会在用户只装本插件时直接断掉，
而且断在运行时、断得没有报错。

## 2. 决策

### 2.1 只引用自己声明的东西

- 团队 `members[]` 只用 `agent` 指向**本插件** `agent.agents` 里声明的 id（`novelwright-*`），
  或用 `role` 指向宿主内置角色。二者恰好写一个。
- 不出现 `plugin:<otherId>:<agentId>` 形式的引用；不假设 `dbx-pro`、`hanshuang-pojia` 等已安装。
- 工具 id 一律 `novelwright_` 前缀，不注册通用名（`save_chapter`、`context` 之类），避免与别的插件撞名。

### 2.2 由守卫而不是自觉保证

`test/manifest-guards.test.ts` 有两条常驻断言：

1. 团队成员的 `agent` 必须是同清单 `agents[]` 里的 id（同时覆盖「恰好一个 agent / role」）；
2. 清单原文里不得出现 `plugin:<id>:` 形态，且所有 `"id"` 值要么是 `novelwright`，要么以 `novelwright-` 开头。

再加一条权限白名单断言：`permissions` 必须**精确等于**本插件实际用到的那 10 项（`ui.slot.workspace-view`、
`ui.slot.new-session-context`、`ui.slot.tool-call`、`agent.tools.register`、`agent.toolHandler.execute`、
`agent.session.read`、`agent.session.write`、`storage.read`、`storage.write`、`workspace.read`）。
后两项槽位权限是 ADR 0011 加了新会话卡片与工具行内渲染之后才出现的——**加一次界面就要多加一次权限**，
这正是这条断言要防的那种无声扩张：多申请一项会红，少申请一项运行期会抛。

### 2.3 展示层也不互相引用

`ability.json` / `detail.json` 里的图标、图片、链接只用本包内资源或 https 地址，不引用别的插件包内文件。
市场解析器会把包目录作为边界：越界引用在构建期就失败，但即便能通过，那也是把两个插件的发布绑在一起。

## 3. 被否决的方案

| 方案 | 否决理由 |
| --- | --- |
| 复用 `dbx-pro` / `qiushi-skill` 的智能体或工具 | 用户只装本插件时全部失效；且把两个插件的版本绑死 |
| 把共享逻辑抽成一个公共插件 | 市场没有「依赖插件」概念，装不上就是全盘不可用 |
| 用 `abilities` 之类的字段引用外部能力包 | 该字段语义是「本插件的工具可见性范围」，不是跨插件依赖 |

## 4. 后果

- 本插件可以单独安装、单独升级、单独卸载，装完即用，不要求用户再装别的什么。
- 代价是**复用只能靠复制或抽库**：真正的共性逻辑若要共享，应该走仓库级发布流程（各自打包），
  而不是运行时互引。
- 三份守卫让「顺手引用一下隔壁」这类改动在测试阶段就失败，而不是等用户报「点了没反应」。

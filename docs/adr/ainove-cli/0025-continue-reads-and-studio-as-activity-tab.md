# ADR 0025：继续阅读只翻页；工作台从侧边栏移到活动面板标签

- 状态：已接受（2026-10-30）
- 决策对象：`abilities/plugins/mahua-writing-team/src/features/library/components/BookDetail.tsx`、
  `src/studio-tab.ts`、`src/index.tsx`、`plugin.json#permissions`
- 取代：ADR 0003 §1 表格的选型结论、§2.1、§2.2、§2.3；ADR 0008 §2.1 的「侧边栏导航位」部分
- 依据：宿主 `apps/desktop/src/renderer/domains/plugins/runtime/plugin-ui-context.ts`
  （`registerActivityTab` 的实现与权限校验）、`domains/activity-panel/registry/useActivityTabDefinitions.tsx`
  （`scope_use` 过滤与 `%catalogKey%` 解析）、`domains/activity-panel/registry/resolve-activity-tabs.ts`
  （`initiallyVisible` 与「可添加插件面板」池）

## 1. 背景

两条来自真实使用的报告，都是「界面做了不该做的事」，不是「界面缺了什么」。

**1.1 点「继续阅读」会把消息发进对话框。** 书页主按钮写的是 `book.continueAt`（「继续阅读 ·
第 N 章」），绑的却是 `onContinue`；而在 `StudioWorkspaceView.tsx` 里 `onContinue` 是
`void startHandoff()`，落到 `use-agent-handoff.ts` 的 `ctx.conversation.sendPrompt`。所以一次
「我想接着读」的操作，副作用是往宿主对话里插一条 prompt、可能连带起一个会话。同一页的
`book.read`（「读这一章」）才是翻阅读页的那颗，可它是次级按钮。

**1.2 侧边栏那一格是用户的，不是插件的。** ADR 0003 §1 当时的对照表把 `registerActivityTab`
判为「绑定当前对话的侧边面板，宽约 400–600px，不适合：作品是跨会话、跨项目的」，于是选了
`registerWorkspaceView`。实际使用暴露了三个错误：

- 「跨会话」说的是**数据**要落 Plugin Storage（ADR 0005 仍然成立），不等于**界面**必须是整页路由。
  一本书的看板在 400–600px 里读得下，书架与书库的栅格也早已按窄面板折过（ADR 0020 §3、§4）。
- 侧边栏是稀缺导航位，宿主限 5 个置顶位；写作工作台常驻在里面，就是把用户真正在用的入口挤进
  「更多」。
- ADR 0003 §2.2 让插件接管宿主页头（`setWorkspaceViewHeader`），代价是页头与窗口拖拽区、macOS
  红绿灯让位耦合。标签没有宿主页头，这份耦合本来就不需要。

活动面板本来就有一层「+ → 可添加插件面板」的池子（`resolve-activity-tabs.ts` 的
`availablePlugins`）：插件先入池，用户需要时加成一枚标签，不要时点减号收起。这比「装完就多一格
侧边栏」更符合宿主的导航经济。

## 2. 决策

### 2.1 主按钮只翻页，要对话的那一步单独成按钮

- 主按钮 = `book.continueAt` → `onOpenChapter(book.progress.currentChapter)`：打开阅读页，跳到
  路由给出的那一章。没有副作用，重复点也不会往对话里塞东西。
- 次级按钮 = `action.handoffContinue`（「在对话里继续」）→ `onContinue`：这才是对话桥。它在
  `handoffBusy` 时 disabled，与指令卡里的同名动作是同一个回调。
- `book.read` 从书页移除（与主按钮重复），语言包里一并删掉。`action.copyManuscript` 原本在宿主
  页头，随 §2.3 搬进书页顶栏，与成员条、凭证胶囊同一行。
- `test/manifest-guards.test.ts` 钉住这条：`book.continueAt` 必须挨着 `onOpenChapter(current)`，
  `onContinue` 必须挨着 `action.handoffContinue`。

### 2.2 工作台是一枚活动面板标签，不是侧边栏入口

- `src/studio-tab.ts`：`ctx.ui.registerActivityTab({ id: "studio", label: "%view.studio.label%", … })`。
  `component` 仍是 `StudioWorkspaceView`，所以路由、服务层、门禁一行没动。
- `scope_use: ["conversation", "project"]`，与 `novel-tools.ts` 的 `SCENARIOS` 同一口径。这个字段
  fail-closed：不声明场景，标签在任何会话里都不出现。
- `initiallyVisible: false`：**入池不上栏**。用户从「+ → 可添加插件面板」自己加，符合「不要在
  侧边栏占位」的诉求；想让它默认出现，把这一行改成 `true` 即可，其余不动。
- `retention: "warm"`：切走再切回，路由（看到哪本书、读到哪一章）还在。
- 标签图标用 React 节点（`createElement("span", { className: "icon-[solar--book-2-linear] h-4 w-4" })`）：
  `plugin.iconUrl` 只对图片图标有值，清单里的 `solar:` class 不会自动变成标签图标。

### 2.3 删掉页头桥接与 `activation` 视图

- 不再调 `setWorkspaceViewHeader`（`StudioWorkspaceView` 里那段 `useEffect` 整块删除），
  `getStudioRuntime()` 因此不再需要在视图里取。`studio.title` / `studio.header.title` 两个键同步删除。
- `activation` 工作区视图与 `ACTIVATION_VIEW_ID` 删除。未激活时同一个标签渲染 `ActivationPanel`
  （ADR 0024 §6 的「同一块面板显示凭证事实 + 动作」），所以「凭证过期 = 插件消失」这个 ADR 0003
  §2.1 试图用两个视图互斥解决的问题，现在由「标签恒在」直接消解。
- `plugin.json#permissions`：`ui.slot.workspace-view` → `ui.slot.activity-tab`，其余 11 项不动。
  清单保持字典序，`test/manifest-guards.test.ts` 断言的权限集合同步。
- 条目 `minAppVersion` 抬到 `0.5.60`（活动面板标签与 `ui.slot.activity-tab` 权限在该版本线上可用；
  0.5.59 无 tag 可核，不拿它当承诺）。

## 3. 不做

- 不保留「侧边栏 / 标签页」双入口开关。两个入口指向同一份状态，只会让「关掉哪个」变成一个新问题。
- 不做 `openActivityTab` 自动弹出。加不加是用户的动作，装完就抢占标签栏与「装完就占侧边栏」是同一个错。
- 不把阅读页改成宿主对话的附件。阅读需要行宽与字号档，对话气泡给不了（ADR 0013 §2.2 仍然成立）。
- 不为「继续阅读」保留一个 `sendPrompt` 的旁路（例如按住 Shift 才发消息）。按钮文案写的是读，就只读。

## 4. 后果

- **正面**：书页主按钮零副作用；侧边栏少一格；页头不再被插件接管，与拖拽区/红绿灯解耦；
  `src/` 少一个视图文件与一个 id 模块；「未激活没入口」这一类死路从结构上不再可能出现。
- **代价**：默认不上栏，用户装完要多一步「+ → 添加」。README 两份、`detail.json` 两份、`CONTEXT.md`
  的「装完看到什么」都改成这条路，否则用户会以为插件没装上。
- **测试锚点**：`test/manifest-guards.test.ts` 新增四条（无 `registerWorkspaceView` 且无
  `setWorkspaceViewHeader`、`scope_use` 与 `initiallyVisible: false`、图标是 iconify class、
  主按钮打开阅读页）；权限集合断言由 `ui.slot.workspace-view` 改为 `ui.slot.activity-tab`。
- **版本**：运行内容变化 → `0.3.0` → `0.4.0`（五份身份文件同步）。

> **补注（默认上栏，2026-10-30）**：§2.2 的 `initiallyVisible: false` 已改为 `true`。§2.2 自己写明
> 「想让它默认出现，把这一行改成 `true` 即可」，所以这是行使该条给出的开关，不是推翻决策本身。
>
> 触发它的是真实反馈：宿主活动面板的「+」不出现，标签既加不进来也看不见。读宿主 0.5.65 的代码
> 得到的是一组条件，任一条成立插件标签就没有入口：
>
> 1. `domains/activity-panel/hooks/useActivityPanelModel.ts:422-425` ——
>    `showTabPicker = !knowledgeHistory && cwd !== null && (restorableTabs.length > 0 ||
>    overflowTabs.length > 0 || availablePluginTabs.length > 0)`。三类全空时整枚按钮都不渲染；
>    「+」与向下箭头是两个图标，取决于 `availablePluginTabs` 是否为空
>    （`packages/theme-ui/src/activity/PluginTabPickerView.tsx:88-90`）。
> 2. `domains/activity-panel/registry/useActivityTabDefinitions.tsx:111-113` ——
>    `if (!enablePluginTabs || pluginScenario === undefined) return [...builtins]`。`pluginScenario`
>    由 `currentScenarioAtom` 供，该原子为 `null` 表示「新建会话页 / 尚未加载」
>    （`shared/store/plugin-atoms.ts:401-406`）。
> 3. 同一文件 `:115-120` —— `tab.scope_use?.includes(pluginScenario)`，即 §2.2 的 fail-closed 过滤。
> 4. `domains/conversation/components/SessionViewerPage.tsx:119 / :123` —— 只读历史会话页传
>    `enablePluginTabs={false}`。
>
> 顺手排除了三个先前怀疑的方向：`plugin.json#permissions` 确有 `ui.slot.activity-tab`；
> `src/` 里没有任何 `openActivityTab` 调用（不存在「被自动上栏、池子因此为空」）；
> `resolve-activity-tabs.ts:39-41` 的
> `isPluginTabOnBar = explicitTabVisibility(...) ?? def.initiallyVisible !== false` 说明缺省本来就上栏，
> 是我们主动把它压进了条件化的池子。
>
> 结论：入口不押在宿主条件化的「+」上。默认上栏，`removable: true` 保留——用户点减号收起时会写下
> 显式 `false`，标签回到池子，那时「+」必定出现。图标仍由插件自己的
> `<span className="icon-[…]">` 提供（宿主 `apps/desktop/src/renderer/styles.css:15-28` 明写插件声明的
> icon class 不在宿主 Tailwind 扫描范围，省略会得到不可见图标）。
>
> 同步修改：`src/studio-tab.ts`、`src/index.tsx` 注释、`AGENTS.md`、两份 README、`detail.json` /
> `detail.zh.json` 的安装步骤、`test/manifest-guards.test.ts` 的守卫断言。版本 `0.4.6` → `0.4.7`。

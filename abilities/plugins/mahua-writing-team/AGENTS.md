# 麻花小说网（Mahua Novels）插件工程

在这个目录里开发。命令都作用于最近的 `plugin.json`。

```bash
npm install
npm run check      # tsc --noEmit
npm test           # vitest
npm run build      # dist/ + release/mahua-<version>.astraviapkg
npm run validate   # 用宿主自己的清单解析器校验 plugin.json
```

依赖来自 `file:../../../.tooling/open-astravia/packages/plugins/*`（这几个包不在公共 registry）。
手册用 `npx astravia-plugin-cli docs` 查，别硬编码 `node_modules` 路径。

## 三条不可让步的架构约束

1. **进度只由 `src/domain/novel-flow.ts` 计算。** `routeNovel(state)` 是纯函数，只返回
   `worker / task / chapter / reasonKey`，不返回工具 id、不读存储、不取时间。任何"下一步"的判断
   如果不在这个函数里，就是错的。
2. **写操作只有 `StudioService` 一个入口。** 工具和视图都调它，门禁（`requireEntitlement`）在
   服务层判一次。不要在工具或组件里直接碰仓储或门禁。
3. **领域层不出自然语言。** 失败与理由都是 key（`reason.*` / `checkpoint.*` / `error` 码），
   `ctx.i18n.t` 或 `useTranslation` 负责变成人话。账本里的 `checkpoints` 只存 `noteKey` + 参数，
   不存句子——存了句子，换语言就得迁移已写好的稿件。新增文案必须同时进 `locales/en.json` 与
   `locales/zh.json`，否则 `test/manifest-guards.test.ts` 会失败。

## 目录职责

| 目录 | 放什么 | 不放什么 |
| --- | --- | --- |
| `src/domain/` | 状态机与纯函数 | IO、时钟、模型调用、文案 |
| `src/repository/` | 稿件账本，一次推进一次 `commit()` | 业务校验 |
| `src/entitlement/` | 离线验签与门禁 | 网络请求、身份绑定 |
| `src/application/` | `StudioService`：唯一写入口 | JSX、工具注册 |
| `src/tools/` | 36 个 Agent 工具的薄适配器（读 12 / 写 24），按弧分文件：`reading-` / `foundation-` / `outline-` / `chapter-` / `ledger-tools.ts`，`register-novel-tools.ts` 只做总装 | 状态转移逻辑 |
| `src/application/tool-*.ts` | 工具共用的 schema 片段与输出整形 | 具体工具注册 |
| `src/scenarios.ts` | `scope_use` 的唯一口径 | 场景判断逻辑 |
| `src/features/<feature>/` | 视图、hooks、`components/` | 直接读写存储 |
| `src/features/shared/components/` | 跨 feature 的基础组件，一文件一组件 | 万能容器文件 |

封面是算出来的，不是画出来的：`features/library/components/DefaultCover.tsx` 用 `coverVariant(book.id)`
挑母题与层次，同一本书每次一样、不同的书不一样（ADR 0020 §4）。不要换成位图或网络图片。

`agent/` 是**包**而不是散文件（ADR 0019）：`prompts/`（`routing.md` 路由提示 + `team-workflow.md` 团队
流水线 + `briefs/` 两份成员任务书）、`skills/novel-craft/` 与 `skills/longform-continuity/`（各带一份
`SKILL.md` 与 `references/`）、`styles/`、`voice.md`；`plugin.json` 用 `agent.systemPrompt.promptPaths` 与
`agent.skillPaths` 引用它们，技能默认 `hidden`——它们是团队内部按需加载的，不是侧栏里的另一排入口。工艺库**不**在运行时
读盘——`npm run references` 把它编成 `src/reference/library.generated.ts`（ADR 0012），改完 `.md` 必须重跑，
否则 `mahua_reference` 给出的还是旧文本。
`CONTEXT.md` 是双语领域词汇表：加字段改词先改它，再改代码——词不一致比代码不一致更难查。

## 对话桥

视图里**没有输入框**。工作台只显示状态与下一步；真正写小说发生在宿主对话里（ADR 0008）。
视图内分五层（ADR 0013 / 0020 / 0026）：书架（封面网格）→ 书库（文字台账，列按宽度收起）→ 书页（页头 + 弧带 + 指令 + 目录 + 账本入口）→ 阅读页（工具条 + 正文 + 评审栏 + 底栏）→ 伏笔账本（台账 + 决策日志 + 一致性），
路由是 `src/features/library/hooks/use-library-route.ts` 里的视图内 state，不写宿主路由、不写存储。

- 唯一允许调用 `ctx.conversation` 的文件是 `src/features/studio/hooks/use-agent-handoff.ts`，
  守卫 `test/manifest-guards.test.ts` 钉死这一点。别在别的组件里另开一个会话。
- 投进对话的话术必须来自 catalog（`studio.handoff`），参数取自同一个 `routeNovel(book)`：
  界面上写的下一步和模型看到的必须是同一条。
- 没有工作区根目录时不发消息，直接提示 `studio.handoffNoWorkspace`——会话没有 cwd 等于把账本写到
  用户找不到的地方。

## 运行台事件流（ADR 0027 §1 修订）

运行台中上栏是真事件，来源只有一处：`src/live-feed-hooks.ts` 的 `ctx.agent.registerHook`
（`PreToolUse` / `PostToolUse` / `PostToolUseFailure` / `SubagentStart` / `SubagentStop`，权限
`agent.hooks.register` 与 `agent.hookHandler.execute`）。

- **钩子只读**：handler 一律返回 `undefined`，不改工具入参、不拦调用。想改变行为就去改工具，别改流。
- **不写 `toolNames`**：插件工具的 hostName 会被宿主加命名空间，猜错就是静默永不触发。
  所有工具事件都进来，在 `describe-tool-event.ts` 里按 `tool-catalog.ts` 过滤。
- **不推测归属**：插件工具不写「是哪位成员在写」；只有团队工具自带 `target` / `recipients` 才写其名。
- **流不是账本**：`console/feed.json` 是环形缓存（200 条），可一键清空；可恢复的事实只有
  `book.checkpoints`。两者在界面上分栏，不混排。
- **不编监控数据**：上下文占用、模型名、队列深度不在钩子载荷里，界面就不显示——不拿落盘字段充数。
- 文案 key 是拼出来的（`feed.tool.<name>`），通用 locale 守卫扫不到；
  `test/feed-describe.test.ts` 负责对账 `feedCatalogKeys()` 与两侧语言文件。

## 插件必须自足（ADR 0010）

不引用任何别的插件的实体：团队成员只写本清单里声明的 `mahua-*` id，工具 id 只带 `mahua_`
前缀，`permissions` 精确等于实际用到的那 15 项（含 hook 两项与两个面板 slot）。三份断言在
`test/manifest-guards.test.ts`。

## 入口形状（ADR 0025 §2）

工作台同时注册两处，形状与 `dbx-pro` 一致（ADR 0025 补注二）：

| 注册 | id | 权限 | 在宿主里长什么样 |
| --- | --- | --- | --- |
| `ctx.ui.registerActivityTab` | `mahua-studio` | `ui.slot.activity-tab` | 活动面板上的一枚标签 |
| `ctx.ui.registerWorkspaceView` | `mahua-studio` | `ui.slot.workspace-view` | 侧边栏插件 nav 里的一项 |

两处都在 `src/index.tsx` 装配，`StudioChrome` 右上角按 `viewId` 给双向跳转按钮
（`studio.openWorkspace` / `studio.openPanel`）。`setWorkspaceViewHeader` 仍然不调：工作区视图不接管
宿主页头，标题与动作都在组件自己身上。

- 为什么不能只注册标签：宿主里「已在栏上」与「在 + 可添加池」是互斥的两侧——
  `isPluginTabOnBar = explicitTabVisibility(...) ?? def.initiallyVisible !== false`，而 `availablePluginTabs`
  只收不在栏上的标签。`initiallyVisible: true` 一旦生效，用户在面板菜单里就永远找不到它。
  两条都要，只能双注册。
- 两个 `id` 与 `STUDIO_VIEW_ID` 保持一致，同一套 `scope_use: ["conversation", "project"]`（fail-closed，
  与 `src/scenarios.ts` 的 `SCENARIOS` 同一口径）。
- `initiallyVisible: true`：默认就上栏。用户点减号收起来后会留下显式 `false`，标签回到池子，
  这时「+」必定出现。取证与完整四条件见 ADR 0025 末尾补注。
- 凭证判断不在注册处：未激活时同一个组件渲染 `ActivationPanel`，所以两个入口从装上开始就一直在。

`test/manifest-guards.test.ts` 钉住入口形状（两处注册都在、无 `setWorkspaceViewHeader`、
有 `scope_use`、`initiallyVisible: true`）与权限集合（`ui.slot.workspace-view` 与
`ui.slot.activity-tab` 必须同时出现在 `plugin.json#permissions` 且已排序）。

## 已知的宿主约束

- 面板类 slot 不能用 `fixed`、超大 z-index、`createPortal(..., document.body)`。
- 标签 `icon` 用 React 节点（`createElement("span", { className: STUDIO_TAB_ICON })`），因为 `iconUrl` 只对图片图标有值；
  iconify class 靠 `@plugin "@iconify/tailwind4";` 生成 CSS，写错了标签栏是空格子且无报错。
- `src/style.css` 只导 `tailwindcss/theme.css` + `utilities.css`，**不写 `@theme`**：`plugin-vite` 会注入 `@astravia-org/plugin-sdk/tailwind-theme.css`。
- 菜单/视图 `label`、`description` 用 `%catalogKey%`；React 与工具侧用裸 key。
- 清单未知字段 fail-closed：用到 `members[].instructionsPath` 就必须 `pluginApiVersion: ^2.3.0`。
- 改了代码不 bump `version`，宿主不会重新加载。

## 改完一个版本的检查清单

- [ ] `npm run check` / `npm test` / `npm run build` / `npm run validate` 全绿
- [ ] 运行内容变了 → `node scripts/marketplace.mjs bump --slug mahua-writing-team --apply`（五份身份文件一起改）
- [ ] `ability.json` / `plugin.json` 的 `version` 与 `package.json` 一致
- [ ] 新增的 `reason.*`、`status.*`、`task.*`、`finding.*`、`activation.reason.*` 两侧语言文件都有
- [ ] 上游能力面有新增时，同步 `test/manifest-guards.test.ts` 的 `PARITY` 表与 ADR 0009 的矩阵
- [ ] 需要抬 `minAppVersion` 时同步 `.astravia/marketplace.source.json`

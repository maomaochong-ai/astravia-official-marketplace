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
| `src/features/workbench/components/` | 工作台七帧（`pages/`）与外壳（`shell/`），一文件一组件 | 直接读写存储、发指令 |
| `src/features/workbench/hooks/` | `use-studio-state`（只读快照）、`use-workbench-route`（帧内 state）、`use-team-reveal`、`use-translator`、`register-live-feed` | 业务规则 |
| `src/features/studio/live-feed/` | 事件流的文案与取值（`tool-catalog` / `describe-tool-event` / `use-live-feed`） | 状态、持久化 |
| `src/application/live-feed/` | `feed-types` / `feed-store`（环形 200 条）/ `feed-persistence` | JSX |

封面是算出来的，不是画出来的：`features/workbench/components/shell/Cover.tsx` 用 `coverSeed(seed)`
挑层次与母题，同一本书每次一样、不同的书不一样（ADR 0020 §4）。不要换成位图或网络图片。

`agent/` 是**包**而不是散文件（ADR 0019）：`prompts/`（`routing.md` 路由提示 + `team-workflow.md` 团队
流水线 + `briefs/` 两份成员任务书）、`skills/novel-craft/` 与 `skills/longform-continuity/`（各带一份
`SKILL.md` 与 `references/`）、`styles/`、`voice.md`；`plugin.json` 用 `agent.systemPrompt.promptPaths` 与
`agent.skillPaths` 引用它们，技能默认 `hidden`——它们是团队内部按需加载的，不是侧栏里的另一排入口。工艺库**不**在运行时
读盘——`npm run references` 把它编成 `src/reference/library.generated.ts`（ADR 0012），改完 `.md` 必须重跑，
否则 `mahua_reference` 给出的还是旧文本。
`CONTEXT.md` 是双语领域词汇表：加字段改词先改它，再改代码——词不一致比代码不一致更难查。

## 对话桥

视图里**没有输入框**，也没有派活按钮。工作台只显示状态与下一步；真正写小说发生在宿主对话里（ADR 0008）。
七帧（`src/features/workbench/workbench-pages.ts`）：书架 `shelf` → 书库 `library` → 书页 `book` →
阅读 `reader` → 伏笔账本 `ledger` → 运行台 `console` → 激活 `activation`；
路由是 `src/features/workbench/hooks/use-workbench-route.ts` 里的帧内 state，不写宿主路由、不写存储。
`console` / `activation` 是 bare 帧：收起左栏、不渲染同步带。

- 唯一允许碰 `ctx.conversation` 的文件是 `src/features/workbench/hooks/use-team-reveal.ts`，
  守卫 `test/manifest-guards.test.ts` 钉死这一点。宿主没有「聚焦侧栏对话」的 API，所以这里只能
  `insertText("")` 点亮输入条 + 一条 `team.hint` 提示：**只把视线送过去，不带指令**。
- 单向同步：侧栏对话 → 落盘 → 工作台读到新状态。`WorkbenchScreen` 只订阅事件流里的落盘事件，
  到了就 `refresh()` 重读仓储；界面从不反向写信箱，也没有「提交本章」这类按钮。
- 卡片上写的下一步来自 `routeNovel(book)` 的 key（`reason.*`），与模型看到的是同一条判断。

## 运行台事件流（ADR 0027 §1 修订）

运行台中上栏是真事件，来源只有一处：`src/features/workbench/hooks/register-live-feed.ts` 的
`ctx.agent.registerHook`
（`PreToolUse` / `PostToolUse` / `PostToolUseFailure` / `SubagentStart` / `SubagentStop`，权限
`agent.hooks.register` 与 `agent.hookHandler.execute`）。

- **钩子只读**：handler 一律返回 `undefined`，不改工具入参、不拦调用。想改变行为就去改工具，别改流。
- **不写 `toolNames`**：插件工具的 hostName 会被宿主加命名空间，猜错就是静默永不触发。
  所有工具事件都进来，在 `describe-tool-event.ts` 里按 `tool-catalog.ts` 过滤。
- **不推测归属**：插件工具不写「是哪位成员在写」；只有团队工具自带 `target` / `recipients` 才写其名。
- **流不是账本**：`console/feed.json` 是环形缓存（200 条），可一键清空；可恢复的事实只有
  `book.checkpoints`。两者在界面上分栏，不混排。
- **不编监控数据**：上下文占用与队列深度不在钩子载荷里，界面就不显示——不拿落盘字段充数。
  模型名与耗时是宿主真实交付的字段（`event.model`、`toolUseId` 配对出的 `ms`），可以显示。
- 文案 key 是拼出来的（`feed.tool.<name>`），通用 locale 守卫扫不到；
  `test/feed-describe.test.ts` 负责对账 `feedCatalogKeys()` 与两侧语言文件。

## 插件必须自足（ADR 0010）

不引用任何别的插件的实体：团队成员只写本清单里声明的 `mahua-*` id，工具 id 只带 `mahua_`
前缀，`permissions` 精确等于实际用到的那 12 项（含 hook 两项与标签一枚 slot）。三份断言在
`test/manifest-guards.test.ts`。

## 入口形状（ADR 0025 补注三）

工作台**只注册一处**：活动面板上的一枚标签。

| 注册 | id | 权限 | 在宿主里长什么样 |
| --- | --- | --- | --- |
| `ctx.ui.registerActivityTab` | `mahua-studio` | `ui.slot.activity-tab` | 活动面板上的一枚标签，就是工作台本体 |

- **为什么撤掉工作区视图**：用户要的是「标签页菜单里那一个麻花界面」。宿主里「已在栏上」
  （`initiallyVisible: true`）与「在 + 可添加池」互斥，同一套界面注册两处，用户反而会在菜单里
  看到两个同名入口、或在「+」里再找到一份。一个界面只留一枚入口。
- `registerToolCallSlot` / `registerNewSessionContext` 也一并撤掉（ADR 0011 作废）：对话里不再插入
  插件自己的卡片，团队的时间流统一进运行台。
- `scope_use: ["conversation", "project"]`，与 `src/scenarios.ts` 的 `SCENARIOS` 同一口径（fail-closed）。
- `initiallyVisible: true`：默认就上栏。用户点减号收起来后会留下显式 `false`，标签回到池子，
  这时「+」必定出现。取证与完整四条件见 ADR 0025 末尾补注。
- 全屏形态走 `ctx.ui.setActivityPanelWidth("max")`，首次挂载时拉满一次；窗口条上的按钮可来回切
  回 760px。不做 `fixed`、不 `createPortal`。
- 凭证判断不在注册处：未激活时同一枚标签渲染 `ActivationPage`，所以入口从装上开始就一直在。

`test/manifest-guards.test.ts` 钉住入口形状（只有标签一处注册、无 `setWorkspaceViewHeader`、
有 `scope_use`、`initiallyVisible: true`、`component: WorkbenchScreen`）与权限集合
（`ui.slot.*` 恰好只有 `ui.slot.activity-tab` 一项，且 `permissions` 已排序）。

## 已知的宿主约束

- 面板类 slot 不能用 `fixed`、超大 z-index、`createPortal(..., document.body)`。
- 标签 `icon` 用 React 节点（`createElement("span", { className: STUDIO_TAB_ICON })`），因为 `iconUrl` 只对图片图标有值；
  iconify class 靠 `@plugin "@iconify/tailwind4";` 生成 CSS，写错了标签栏是空格子且无报错。
- `src/style.css` 只导 `tailwindcss/theme.css` + `utilities.css`，**不写裸 `@theme`**：`plugin-vite` 会注入 `@astravia-org/plugin-sdk/tailwind-theme.css`。工作台另有一段 `@theme inline { … }`（ADR 0006 补注）：它只把取值内联成本插件的工具类、不向 `:root` 发射变量，并且**不重声明宿主占用的 `--color-*` 名**（改名表写在文件头：`card→raised`、`muted→ink-soft`、`accent→cinnabar`、`success→pass`、`danger→fail`）。
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

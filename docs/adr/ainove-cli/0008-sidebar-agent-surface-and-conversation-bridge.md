# ADR 0008：像宿主侧边栏智能体那样工作——工作区视图 + 对话桥

- 状态：已接受（2026-10-29，随 0.0.1）
- 决策对象：`abilities/plugins/novelwright`
- 前置：ADR 0002（智能体与团队由清单声明）、ADR 0003（工作区视图为主界面）

## 1. 背景

宿主的「智能体」不是插件能自己画的页面，而是宿主既有的一条链路：

| 环节 | 宿主位置 | 本质 |
| --- | --- | --- |
| 侧边栏导航项 | `apps/desktop/src/renderer/domains/project/components/sidebar/useSidebarModel.ts` 的 `BUILTIN_NAV_ITEMS` | 导航项是**宿主数据**，插件不能往里塞一项 |
| 导航渲染 | `packages/theme-ui/src/sidebar/SidebarNavigation.tsx` | 只消费上面那份模型 |
| 智能体定义 | 插件清单 `agent.agents` → 宿主编译成 `AgentBlueprint`，id 形如 `plugin:<pluginId>:<agentId>` | 声明即注册，宿主负责实例化（`@astravia/agent-team` 的 `parsePluginBlueprintId`） |
| 智能体对话界面 | SDK `ctx.conversation` + `useActiveConversation()` | 会话是宿主的，插件只能往里投话 |

所以「做成侧边栏智能体」在插件能力边界内的正解只有两条：**导航位由 `registerWorkspaceView` 提供**、
**对话由宿主承担**。插件不能伪造一个 `/agents` 入口，也不该自己写一个聊天框——那会得到一份和宿主
行为不一致、且拿不到上下文/工具回调的副本。

## 2. 决策

### 2.1 工作区视图 = 侧边栏入口；对话 = 宿主的智能体界面

> **本节「侧边栏入口」部分已由 ADR 0025 §2.2 取代**：工作台是活动面板的一枚标签
> （`initiallyVisible: false`，从「+ → 可添加插件面板」自己加），不再 `registerWorkspaceView`。
> 「视图内不实现输入框」仍然成立。

- `STUDIO_VIEW_ID` 注册为 workspace view，占一个侧边栏导航位，就是插件名在侧边栏出现的位置（ADR 0003）。
- 视图内**不实现输入框**。视图回答「现在到哪了、下一步是什么」；真正写小说发生在宿主对话里，
  由 ADR 0002 声明的 `novelwright-*` 智能体调用 `novelwright_*` 工具完成。

### 2.2 对话桥：一个 hook，一个出口

`src/features/studio/hooks/use-agent-handoff.ts` 是插件里唯一调用 `ctx.conversation` 的地方
（`test/manifest-guards.test.ts` 用守卫钉住这件事）。

```
点击「在对话里开工 / 继续推进」
  ├─ 已有活动会话（useActiveConversation().id）→ sendPrompt()
  └─ 没有 → ctx.fileExplorer.getWorkspaceRoots()[0] → conversation.createSession(root) → sendPrompt()
```

- 投进去的话术来自 catalog（`studio.handoff`），把 `routeNovel(book)` 的结果翻成一句人话：
  书名、阶段、下一格任务、章号。因此**对话里看到的下一步与工作台上看到的是同一个 `routeNovel`**。
- `createSession` 默认导航到对话页 —— 这一步顺带完成了「点侧边栏 → 落到智能体界面」的观感，
  而这是宿主自己的导航，不是插件模拟出来的。
- 没有工作区根目录时**不发**，直接提示 `studio.handoffNoWorkspace`：会话必须有 cwd，
  随便挑一个目录等于把账本写到用户找不到的地方。
- 发送失败（`receipt.status === "failed"`）或抛异常都出 toast，不抛给 React —— 视图里抛异常只会白屏。

### 2.3 新增的三个权限与其理由

| 权限 | 因为 |
| --- | --- |
| `agent.session.read` | `useActiveConversation()` 读会话状态（有没有会话、是否在流式输出） |
| `agent.session.write` | `createSession` / `sendPrompt` |
| `workspace.read` | `getWorkspaceRoots()` 取会话 cwd |

清单里不放更多权限：桥只做「投一句话」，不读消息流、不订阅事件、不申请附件。

## 3. 被否决的方案

| 方案 | 否决理由 |
| --- | --- |
| 在视图里内嵌自制聊天框，直接把 prompt 交给模型 | 插件拿不到宿主的流式渲染、工具回调、消息历史与取消语义；得到的是一个更差的并行实现 |
| 往宿主侧边栏 `BUILTIN_NAV_ITEMS` 注册新导航项 | 那是宿主源码里的常量，插件 API 没有这个口子；能改就说明拿错了权限 |
| 用 `insertText` 往输入框塞草稿，让人自己按发送 | 半自动：用户还得理解「按一下才能开始」。`sendPrompt` 已经是正式接口，没有理由退一步 |
| 每次点击都 `createSession` | 每次点都开一个新会话，作品上下文被切碎；有活动会话时必须接着聊 |

## 4. 后果

- 插件在侧边栏的可见性、对话的渲染、流的取消全部由宿主负责，插件只维护「下一步是什么」这一个事实。
- 代价是**插件无法控制对话界面的样子**。这是有意的：宿主界面一致性比插件视觉自由更重要。
- 若宿主未来移除 `ctx.conversation.sendPrompt`，桥的失效点是单文件单调用，修补面有界。

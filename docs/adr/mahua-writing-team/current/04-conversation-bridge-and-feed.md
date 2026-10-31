# 04 · 对话侧与活动流

> 现行文本。归并自 [0008](../0008-sidebar-agent-surface-and-conversation-bridge.md)（会话桥部分，侧栏导航已废）
> 与 [0027](../0027-shell-layer-console-and-rail-degradation.md)（运行台）。
> 2026-10-31 按 0.4.19 核对：事件流是真事件，不是样板。

## 一句话

不造聊天界面。工作台只做三件事：把下一步递进对话、把光标送回输入区、把已发生的事读出来。

## 现行规矩

1. **对话是宿主的**。插件不渲染消息列表、不抢输入条、不写自己的聊天历史。
   任何「在这里再做一个输入框」的念头都违反这条。
2. **递下一步**：`mahua_next_instruction` 的结果可以一键交给对话（`studio.handoff*`），
   这样作者不必复制粘贴键名。交付失败要说清失败原因，不是静默。
3. **焦点归位**：SDK 没有「聚焦会话」的 API，`insertText("")` 会清空用户草稿，因此不用它。
   唯一诚实的做法是找到最后一块可见的 `.input-card` 里的 `[contenteditable]` 并 `focus()`；
   拿不到就退化成一句提示（`rail.revealTeam` 那条路径）。
4. **活动流只读**。hook handler 一律返回 `undefined`（继续），绝不改工具入参、不拦调用。
   运行台呈现的是**已发生的落盘事实与工具事件**，不是运行时内部状态。
5. **事件来源唯一**：宿主工具生命周期 → `registerConsoleFeed` → `consoleLogStore` →
   `useConsoleTimeline` → 运行台。中间任何一环都不许自己造事件。
6. **落章卡片只报告**。它在消息列表底部说「本章已落盘」，点开只是看运行台流水，
   不发起任何动作。

## 代码落点

| 事 | 文件 |
| --- | --- |
| hook 接线 | `src/features/workbench/hooks/register-console-feed.ts` |
| 事件存储 | `src/application/console-log/{console-log-event,console-log-store,console-log-storage}.ts` |
| 视图模型 | `src/features/workbench/console-timeline/{use-console-timeline,tool-event-description,tool-catalog}.ts` |
| 焦点归位 | `src/features/workbench/hooks/use-team-reveal.ts` |
| 落章卡片 | `src/studio-turn-card.ts`、`components/StudioTurnCard.tsx` |

## 代价与边界

- 事件流拿的是宿主公开的 hook 事件，字段由宿主决定；宿主改协议就得跟着改
  `tool-event-description.ts`，这是外部依赖，不是我们能定的。
- 上下文占用量、token 计数这类运行时内部数字**不渲染**：拿不到准数就不摆一个假仪表盘。
- 焦点归位依赖宿主的 `.input-card` 类名。它变了会静默退化成提示，不会抛错。

## 怎么验证

```bash
cd abilities/plugins/mahua-writing-team
npx vitest run test/component-wiring.test.tsx
grep -rn "return undefined" src/features/workbench/hooks/register-console-feed.ts | wc -l   # handler 只放行
```

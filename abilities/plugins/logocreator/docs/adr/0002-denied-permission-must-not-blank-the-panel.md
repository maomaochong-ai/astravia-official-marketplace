# 0002 — 权限被拒不能让整个面板变成错误页

- 状态：已采纳
- 日期：2026-11-22
- 版本：0.7.1
- 相关：0001（面板身份与 tab 可靠性）

## 背景

0.7.0 上线后，用户装好看到的第一屏是：

```
LogoCreator 面板没能渲染
历史、备注或图像设置里有读不出来的数据。先点重试；仍不行就清掉这个插件的存储再打开。
Plugin permission denied: agent.session.read
```

一句话概括：**一个权限缺失被放大成整个 tab 不可用。**

## 真因

`useNotesHandoff` 在 `useEffect` 里订阅会话事件：

```ts
const handle = getPluginContext().conversation.on((event) => …)
```

宿主的 `ctx.conversation.on` 需要 `agent.session.read`（`plugin-host-apis.ts:58` 的 `permissions.require`），
而 0.6.x 的 `plugin.json` 没有声明它 —— **升级不会自动授予新权限**，所以老用户装上 0.7.0 必然被拒。

被拒时抛错，位置在 effect 里。React 把 effect 的错误交给最近的错误边界，
而 0.7.0 刚给面板套上了错误边界 —— 于是边界忠实地把这条消息画成了整屏错误页。

顺带一句：这条订阅本身**不是必需的**。`useActiveConversation()` 是纯 hook，读同一个宿主 store，
不需要任何权限，返回值本来就是响应式的。

## 决策

### D1 声明权限

`plugin.json` 增加 `agent.session.read`（与 `agent.session.write` 相邻）。新安装直接可用。

### D2 订阅可降级

`useNotesHandoff` 改成：

- 顶层先调 `useActiveConversation()`（无权限要求），得到 `{id, cwd, isStreaming}`；
- 订阅放在 `try/catch` 里，成功则用事件推送覆盖（粒度到 turn），失败则只留一条 console 警告；
- 两种情况共用同一个 `conversation` 值，`blocked` / `needsSession` 的判据不变。

于是"没有该权限"退化成"少了 turn 级实时性"，而不是"面板打不开"。

### D3 激活期主动说清楚

`activate` 里先查权限：没有就不注册订阅，并打一行可操作的日志 ——
`agent.session.read not granted: … re-authorise the plugin`。不静默、不抛错。

### D4 错误页的文案要能指向权限

`panel.crashHint` 补一句：如果错误里写着 `permission denied`，去「设置 → 能力 → 插件」重新授权。
之前那句只说"数据读不出来"，遇到权限问题会把用户引向错误的修法。

## 后果

- 老版本升级上来、权限未重新授予的用户，面板照常打开；
- 面板的错误页从此只在真的渲染失败时出现，并给出可执行的两个方向（数据 / 权限）；
- `panel-chrome.test.ts` 增加三条：清单里有该权限、订阅被拒时降级而非冒泡、激活期有告警。

## 不做什么

- **不在 effect 里静默吞掉所有异常**：只吞这一条订阅，其它异常仍交给边界 ——
  否则"面板什么都不显示也不报错"会重新出现；
- **不把 `agent.session.read` 当作可选能力继续不声明**：内部确实用它（笔记交接要知道会话在不在跑），
  声明它比绕开它诚实。

## 验证

| 项 | 结果 |
| --- | --- |
| `tsc --noEmit` | 通过 |
| `vitest run`（插件） | 32 文件 / 234 条通过（本轮 +3） |
| `panel-chrome.test.ts` | 权限已声明、`.on` 在 try 内且有回退、激活期告警 |
| 实机：升级后打开 tab | **NOT RUN**（工作区无可用 Desktop） |

实机验收：装 0.7.1（或从 0.6.x 升级且**不**重新授权）→ 打开 tab → 面板应正常渲染；
「备注 → 交给对话」在没有 `agent.session.read` 时仍应可用（只是少了 turn 级实时状态）。

# ADR 0027：范围、预算、shell 会话也按会话分区

- **状态：** 已接受
- **日期：** 2026-11-17
- **背景：** 插件 strix 1.7.2；用户报告「宿主和插件的会话和任务没有隔离，多个目标混在一起」
- **补充：** [ADR 0015](adr-0015-ledgers-are-per-conversation.md)（台账按会话分区）只覆盖了发现、笔记、计划、覆盖四本账

## 问题

ADR 0015 把「谁的事实归谁」定清楚了，但只覆盖台账。服务进程仍是**一个**，另外三样东西还是全局：

| 状态 | 原来的形状 | 用户看到的现象 |
|---|---|---|
| 范围 | 一份 `scope.json` | A 声明 `a.test`、B 声明 `b.test` → **两个面板都列出两个目标**，报告的「In scope」段也是并集 |
| 预算 | 一个计数器 | A 跑了 40 次工具 → 切到 B，B 立刻被报「预算已用尽」，而 B 一次都没调 |
| shell 会话 | 一张全局表 | A 起的 `msfconsole` 出现在 B 的工作单元栏；B 的 `/api/shells/stop` 会把 A 的扫描一起杀掉 |

这三样都不是「机器的事实」，而是「那一次评估的事实」，和台账同一粒度。范围尤其严重：它是报告里"测了什么"的依据，混起来等于两份评估共享一个边界。

## 决定

1. **范围按会话分文件**：`scope/<slug>-<hash8>.json`，slug 由会话 id 生成（id 里有 `/`、`:` 等，不能直接当文件名），哈希保证不撞。
2. **预算按会话记账**：`Budget` 持有 `Map<会话, {toolCalls, findings, startedAt}>`。上限仍是用户偏好（一份），用量是评估的（按会话）。`reset(key)` 只归零那一个会话，`setLimits` 对所有会话生效但不动已有用量。
3. **shell 会话记归属**：`ShellSessions.start({ conversation })`，`SessionView.conversation` 随行返回。列表按会话过滤；`ownedBy(id, key)` 给写 stdin / kill 做归属校验。
4. **`/api/state` 只给本会话的**：`sessions.list(sessionId())`、`scope.snapshot(sessionId())`、`budget.snapshot(sessionId())`。
5. **`/api/shells/stop` 只收拾本会话**：停止键打的是自己那一轮，不能顺手杀掉另一个目标还在跑的扫描。
6. **旧文件搬一次**：升级后第一个来问范围的会话继承旧的 `scope.json`，之后旧文件清空、副本留档 `scope.legacy.json`，标记文件 `.legacy-adopted.json` 保证不再猜第二次。

## 已知边界

- **仍只有一个沙箱**（宿主按 plugin id 起一个 service runtime）。沙箱开着时 `sessionId()` 以主人为准：A 的评估在跑，此刻发来的写操作算 A 的——包括范围。这条是 ADR 0015 的延续，不是这次要改的。要按会话彻底分开，得让宿主支持一个会话一个服务进程。
- **工作单元表**是不持久化的：服务退出即清空，与沙箱同一契约。
- **`/api/shells/stop` 现在停不到别人的会话**：这是修复，也意味着「一键清空所有残留」不再是一颗按钮能做的事——那时得分别在各自会话里按。

## 验证

- `test/target-isolation.test.ts`（12 项）：A 的目标不出现在 B；边界与端口同理；在 B 删 A 的目标无效；两个会话各一个文件；会话 id 不安全时文件名仍安全且不撞；旧 `scope.json` 只被搬一次且只搬给第一个来问的会话；A 的花费不算到 B 头上；新沙箱只归零自己；改上限对所有会话生效但抹不掉用量；shell 列表按会话过滤；`ownedBy` 拒绝冒充；已结束的会话仍保留归属。
- 真机：A 声明 `a.test`、B 声明 `b.test`，两个面板各只显示自己那一条；`/api/state` 的 `sessions` 在 B 里为空。

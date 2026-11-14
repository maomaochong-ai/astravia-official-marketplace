# strix-0015 — 台账与会话：一个沙箱，多个会话，谁的事实归谁

- **Status:** Accepted
- **Date:** 2026-11-15
- **Context:** 插件 strix 1.0.6；用户报告「在不同的会话中启用插件后，插件的数据出现串会话现象」
- **Supersedes:** [0014](strix-0014-panel-instances-and-navigation.md) 第 3 条的末句（"多会话共享一个沙箱与一份台账"）

## 问题

服务进程只有一个 `Sandbox`，而台账键原来是 `sandbox.status().sessionId`。于是：

1. 在 A 会话开了沙箱；
2. 切到 B 会话，agent 调 `strix_file_finding` → 写进 **A 的台账**；
3. B 的面板从 `/api/state` 拿到 A 的容器、A 的 sessionId、A 的台账。

用户看到的是"数据串了"。这不是前端缓存，前端按 conversationId 存快照一直是分开的。

## 三个候选

| 做法 | 能不能 | 代价 |
|---|---|---|
| 一个会话一个服务进程 | 不能 | 宿主按 plugin id 起一个 service runtime，插件无法再要一个 |
| 工具调用自带 conversationId | 不能 | 宿主的 `ConversationEvent` 与工具入参都不带会话 id；MCP 端也拿不到 |
| **面板注册当前会话，服务据此分区** | 能 | 依赖"同一时刻只有一个活动轮次"这个前提 |

## The decision

1. **面板是会话的唯一知情人**：`POST /api/conversation { conversationId }`，每次读取状态前先声明。
2. **台账键的优先级**（`sessionId()`，顺序即语义）：
   `sandbox.conversation` → 已注册的会话 → `sandbox.sessionId` → `"default"`。
   沙箱开着就以它的主人为准：评估在跑的时候操作者可能切到别的会话看，**那不代表这一轮的命令
   该写进新台账**。没有沙箱时才看注册值，最后一个才是给命令行独立运行留的。
3. **归属写在开沙箱那一刻**：`strix_sandbox_start` 把当时的会话 id 记进 `SandboxStatus.conversation`。
   "这是谁的容器"不能在读取时猜。
4. **面板只画自己的状态**：`refresh()` 比对 `state.sandbox.conversation` 与自己的 id；
   不一致就不采纳沙箱、台账、发现、会话列表。环境探测（docker 在不在）是全局事实，仍然采纳。
5. **顶层 `conversationKey` 只是信息**：它是刚注册的那个 id，拿它做归属判定等于自己跟自己比。

## 已知边界

- **仍是一个沙箱**。B 会话想看自己的现场，得在 B 里 `strix_sandbox_start`；在那之前 B 显示的是
  自己的空快照与"没有会话"，不是 A 的容器——这是诚实的，而不是共享。
- **升级后旧台账不再可见**：旧文件按 sandbox session id 命名（`findings/<id>.json`），
  新键是会话 id。没有迁移：那时两个会话的数据本来就混在一个文件里，迁移只能猜。旧文件留在
  `plugin-data/strix/` 下，用户想看仍然能打开。
- **不是安全边界**。它防的是"看到别人的现场"，不是防恶意插件读文件——两者不在一个层面上。

## 验证

- 真机：起服务，A 注册 + 写一条 finding → `aFindings=["A 的问题"]`；B 注册 → `bFindings=[]`；
  B 再写一条 → A 读回仍是 `["A 的问题"]`，B 的没进去。
- `src/test/conversation-isolation.test.ts`：键的优先级顺序、开沙箱时记归属、
  refresh 以沙箱主人为判据、跨会话重绑。

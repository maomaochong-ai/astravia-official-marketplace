# ADR 0028：胶囊按会话记，团队会话不自动开面板

- **状态：** 已接受
- **日期：** 2026-11-17
- **背景：** 插件 strix 1.7.3；用户报告「每次打开宿主会话，strix 自动打开了」
- **修正：** [ADR 0020](adr-0020-two-kinds-of-conversation-one-boundary.md)「团队总是跟随」那一条

## 问题

两处叠加，表现成「每开一个会话，面板自己跳出来」：

1. **胶囊是模块级布尔**。`setStrixEngaged` / `isStrixEngaged` 只有一个全局位：在 A 里把
   胶囊打开过一次之后，此后**任何**会话的 `turn-start` 都读到「这一轮交给了 Strix」。
   切换会话不清、退出插件不清、reload 也不清。
2. **团队会话被无条件跟随**。ADR 0020 的理由是「团队没有胶囊可开，缺席不是拒绝」，于是
   `shouldFollowTurn("team", false)` 返回 `true`。团队会话是宿主里最常打开的一种，结果
   就成了「每次打开宿主会话都弹出来」。

这两条都是「把一次决定当成长期偏好」：胶囊是**那个会话这一刻**的决定。

## 决定

1. **胶囊按会话记**：`engagedIn: Set<会话 id>`。`isStrixEngaged(id)` 只回答这一个会话。
2. **新会话页的胶囊记成 pending**：此时还没有 id，`conversation-changed` 到达时由
   `claimPendingEngagement(id)` 归到它名下，只归一次。
3. **团队会话不自动跟随**：没有胶囊 = 这一轮没交给 Strix。团队面板本来就是只读的，
   要看的人自己点开。
4. **重新激活时清空**：宿主 reload 后胶囊回到「未开」（`defaultActive: false`），我们若
   还记着上一个会话开着，两边就分叉了。
5. `shouldFollowTurn(shape, engaged)` 的答案就是 `engaged`；`shape` 留在签名上让调用处
   读得懂，团队会话的排除由「它没有胶囊」在构造上完成。

## 已知边界

- **面板一旦被带出来，它自己不会缩回去**：胶囊关掉时我们调 `setActivityTabVisible(false)`，
  但那是用户的动作。自动跟随时不主动关别人的标签页。
- **`lastSeenConversation()` 仍保留**：cwd 未知时给 `openActivityTab` 兜底，它只影响抽屉
  落在哪个工作区，不再影响"开不开"。

## 验证

- `test/engagement-scope.test.ts`（5 项）：A 的胶囊不会让 B 也算开着；关一个不影响另一个；
  新会话页开/关都能接到第一个出现的会话；重新激活清空。
- `test/turn-focus.test.tsx`：团队会话的轮次**不再**调 `open`；在 A 开胶囊后切到 B，
  B 的轮次也不调 `open`。
- `test/conversation-shape.test.ts`：`shouldFollowTurn("team", false) === false`。

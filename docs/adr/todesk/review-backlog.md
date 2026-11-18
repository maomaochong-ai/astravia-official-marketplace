# 审查遗留项（未修，记录在案）

来源：两轴独立审查（固定点 `e584a423` → `8fc5a74d`，Standards 轴 + Spec 轴各一个子代理）。
0.4.16 只修了两个被判 **violated** 的缺陷，其余按用户要求记录不修。

## 已修（0.4.16）

| 项 | 位置 | 修法 |
| --- | --- | --- |
| 残留会话缺时间判据：`IsConnected` 是快照，正在用的会话也会被判残留 | `domain/remote-readiness.ts` | 加 `stale-session` 的时间条件（默认 12 小时，`now` / `staleAfterMs` 可注入）；近期连接的会话不报；无连接时间的行按残留处理并注明"时间未知" |
| 自启 remedy 的「同上」悬空 | `domain/autostart.ts` | 两个分支共用一个完整路径常量，不再跨分支引用 |

## 待办 A：结构（Standards 轴硬违规）

| # | 位置 | 问题 | 候选做法 |
| --- | --- | --- | --- |
| A1 | `src/agent/tool-runtime.ts` | `docs/plugin-project-structure.md` 的目录树里没有 `src/agent/`；它把 `tools/` 的例外情况指向 `features/<f>/services/` | 二选一：① `src/domain/tool-gate.ts`（闸门是领域策略）+ 注册留在 `tools/`；② `src/features/tooling/services/tool-runtime.ts`。倾向 ①，因为 `remote-contract.ts` 已有"宿主桥最小类型"的先例 |
| A2 | `src/domain/access-fixes.ts` | 十个中文菜单路径属于用户可见副本，却放在 `domain/`，绕过了 `locales/` | 改为 locales 键（`fix.access.tempPassword` 等），tool 层按当前语言渲染；`zh`/`en` 各补 10 键 |
| A3 | `src/test/autostart.test.ts` 等 | 文档示例把测试与模块同目录，插件把测试都放 `src/test/` | 要么一次性迁移全部测试到模块旁边，要么在插件 README「开发」里写明这条有意偏离。后者便宜 |

## 待办 B：气味（判断项）

| # | 位置 | 气味 | 最小修法 |
| --- | --- | --- | --- |
| B1 | `scripts/preflight.mjs` | **Duplicated Code**：11 个工具 id、`TODESK_DIRS`、`-status` 三条正则各抄了一份 | 加一条 parity 测试断言字面量等于 `agent/tool-runtime.ts` 导出的 id；路径与正则改成从 `dist/` 或 `src/` 引用 |
| B2 | `src/agent/tool-runtime.ts:20-30` | **Divergent Change**：工具 id 是工具契约，却由"跑命令"的模块持有 | 随 A1 一起把 id 挪回 `tools/` |
| B3 | `src/domain/device-store.ts` | **Speculative Generality**：`ResolutionX?` / `ResolutionY?` 声明后从未读取（真实值恒为 `-1`） | 删两行 |
| B4 | `src/domain/device-store.ts` `num()` | **Mysterious Name**：名字没说"非有限值返回 null" | 改名 `toFiniteNumber` |
| B5 | `src/domain/remote-readiness.ts` | 同一函数里 `(input.devices ?? [])` 与 `if (input.devices && …)` 两种写法 | 统一成一种；本模块的全部意义就是"null ≠ 空" |
| B6 | `src/domain/client-posture.ts` | `import` 顶在文件头注释之前，注释读起来像在解释 import | import 挪到注释之后 |
| B7 | `src/domain/device-store.ts` `describeDevice()` | **Data Clumps**：手抄 `LastSessionProfile` 六个字段名 | 加字段要改两处；用显式映射或直接展开 |

## 待办 C：文档一致性（Spec 轴）

| # | 位置 | 问题 |
| --- | --- | --- |
| C1 | `docs/adr/todesk/adr-0013-…md` §一 | 判据被写成"仍被客户端标记 `IsConnected`"，漏了"最后连接时间已久"这半条——0.4.16 已按完整判据实现，ADR 文本要跟上 |
| C2 | 同上 验证表 | 写的是 94 项测试，0.4.16 起是 96 项 |
| C3 | 同上 §四 | 审查只列了 3 项；完整结论是 3 硬违规 + 6 判断项 + Spec 2 violated（本文件即差额） |

## 待办 D：已知局限（不是 bug，别当 bug 修）

- `IsConnected` / `RecentConnectTime` 是客户端写下的快照，ToDesk 不提供实时会话状态；`establish`、`stale-session` 都只能当旁证。
- 会话内功能（隐私屏、禁用被控键鼠、文件传输、打印、多屏、画质/带宽）无 CLI，只指路。
- 本机 `devlist` 里 `Mac-B0L7Z7` 行自 11-17 起一直是 `connected=true`。0.4.16 之后它会被判为残留会话并给出修法——这是正确行为，不是新 bug。

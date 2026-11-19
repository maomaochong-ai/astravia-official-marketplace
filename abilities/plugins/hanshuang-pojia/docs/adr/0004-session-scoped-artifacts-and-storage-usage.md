# 0004：产物按会话隔离，存储占用可见

- **状态：** 已接受
- **日期：** 2026-11-19
- **背景：** 寒霜迭代待办第 4 项。三条要求：每会话 `sessionId` 绑定产物前缀；`ctx.storage` 在面板显示大小/文件数/可清空；跨会话默认不可见，除非显式「沉淀到我的案例」
- **适用：** `src/domain/storage-layout.ts`、`src/features/workbench/hooks/use-workbench.ts`、`src/features/workbench/components/pages/settings.tsx`、`src/features/workbench/bridge.ts`

## 问题

此前路径散在多个 hook 里，其中提示词库用的是裸键（`prompt-library` / `prompt-backups`），而设置页展示的是 `workbench/prompt-library.json` —— **页面写的落点和真实落点不是同一个文件**，用户照页面上的路径去清，清不掉。这是「存储可见」这件事必须先解决的底层问题，否则显示的是假地址。

## 决定

**D1：三个作用域是产品决定，不是实现细节。**

| 作用域 | 装什么 | 换会话 | 换项目 |
|---|---|---|---|
| `session` | 本次对话里的草稿 | **看不见** | —— |
| `workspace` | 本工作区的产物（样本库、我的案例） | 同工作区的会话共享 | **看不见** |
| `plugin` | 用户偏好与收藏（设置、提示词库、实验环境开关） | 共享 | 共享 |

`session` 这一行要读准：作用域、路径、键生成规则都已经在 `storage-layout.ts` 里定义，但 `index.tsx` 只接入了 `settings` / `library` / `cases` 三个键，**`drafts` 目前没有任何读写方**。已经生效的隔离是 `workspace` 与 `plugin` 两档；`session` 档是「已定义、未接线」。

路径形状：`workbench/sessions/<会话键>/<file>.json`、`workbench/workspaces/<工作区键>/<file>.json`、`workbench/<file>.json`。

**D2：键 = 可读前缀 + 32 位 FNV-1a。** 只取可读前缀会让 `/a/b` 与 `/a_b` 撞进同一个目录；只用哈希则人看不懂自己那份数据在哪。FNV 在这里不是安全哈希，防的是路径折叠，`storage-layout.test.ts` 专门盯着这条。

**D3：宿主没给会话 id 时不猜。** `sessionKey(null)` 返回 `"unsessioned"`，草稿进独立分区。宁可让用户看到「这个会话的草稿」是空的，也不要把 A 会话的草稿端到 B 会话面前。

**D4：占用如实报，不估算。** 面板按 `usagePrefixes`（三个真实目录段）分别问宿主 `stateUsage(prefix)`，返回 `{files, bytes}`；宿主存储不可用时返回 `null`，与「真的空」的 `{files:0, bytes:0}` 严格区分 —— 这个区分是 `bridge.ts` 的契约，不能合并成一种「没有」。

**D5：清理只给四种范围，不做逐文件勾选。** `pathsToClear(cwd, "session" | "workspace" | "all")`，并且每一项都要带上 `legacyPath`（历史真实存在过的旧位置：`workbench/library.json`、`workbench/cases.json`、裸键 `prompt-library`、`prompt-backups`）。会话作用域必须带当前 `sessionId`，否则会去清一个不存在的分区。

**D6：跨会话可见只有一条路 —— 用户显式沉淀。** 没有「自动把别的会话的产物并进来」的实现，也不打算加。产物引用 `artifactRef` 必须落在工作区内（项目相对路径或工作区产物路径），不得写入临时目录或用户主目录的绝对路径，否则「工作区隔离」在元数据层就已经破了。

## 不做什么

- 不做「一键导出全部会话」。跨会话合并的唯一合法形态是「沉淀到我的案例」，多一条导出通道等于多一个绕过隔离的口子。
- 不在设置页做逐文件勾选删除：文件名的语义只有代码知道，让用户勾选等于把内部结构当接口。
- 不用估算值（例如「约 12 KB」）填充占用；宁可显示「存储不可用」。

## 验证

现有：`src/test/workbench/storage-layout.test.ts` 覆盖 workspace/plugin 分文件、目录键不撞、Windows 正反斜杠、键的文件名安全、清理范围（只清产物不动偏好、全清含旧位置）。

**已知缺口（必须补）：** `sessionKey` 与 `session` 作用域目前**零测试覆盖** —— `grep -r "sessionKey" src/test` 无命中。后果是「串会话」这条产品约束没有任何自动防线。至少要三条：

1. 两个不同 `sessionId` 得到不同的 `drafts` 路径；
2. `sessionId` 为 `null` 时落进 `unsessioned`，且不等于任何真实会话的键；
3. `pathsToClear(cwd, "session", sessionId)` 不动 workspace 与 plugin 的路径。


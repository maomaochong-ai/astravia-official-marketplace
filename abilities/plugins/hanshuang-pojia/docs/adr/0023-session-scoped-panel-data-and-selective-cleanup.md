# 0023：面板数据按会话隔离，清理可按条目选

- **状态：** 已接受
- **日期：** 2026-11-22
- **背景：** 两条来自实际使用的反馈，都需要推翻 0004 里的一项决定。
  一是在两个会话之间切换时，面板里仍是上一段的报告与上一次的探测结论（「串会话」）；
  二是清理只有三档范围，用户想删掉某几项、保留其余。
- **适用：** `domain/storage-layout.ts`、`features/workbench/bridge.ts`、`hooks/{use-library,use-workbench}.ts`、`components/pages/settings.tsx`、`index.tsx`
- **取代：** 0004 的作用域表（`library` 由 workspace 改为 session）与 D5（禁止逐条清理）

## 问题

### 一、`session` 作用域只接了草稿

0004 定义了三个作用域，但只有 `drafts` 用了 `session`，且当时**没有任何读写方**。真正被写的是：

| 数据 | 0004 的作用域 | 实际后果 |
| --- | --- | --- |
| 报告库 `library` | workspace | 同项目的两个会话共享 → 打开面板看到上一段对话的报告 |
| 探测记录 `probe` | 插件级扁平文件 | 上一段的探测结论一直在，看不出它属于别的对话 |
| 宿主模型快照 `host-model` | 插件级扁平文件 | 同上：换模型/换会话后仍显示旧快照 |

「串会话」不是观感问题：探测记录描述的是**那次对话用的是哪个 provider/模型**，把它端到另一次对话面前，用户会按错误的前提去读结果。

### 二、清理只能整档清

0004 D5 拒绝逐文件勾选，理由是「文件名的语义只有代码知道，让用户勾选等于把内部结构当接口」。这条理由对**路径**成立，对**语义条目**不成立。

## 决定

### D1 作用域重划：谁产生就归谁

| 数据 | 作用域 | 换会话 | 换项目 |
| --- | --- | --- | --- |
| 草稿 `drafts` | session | 看不见 | 看不见 |
| 报告库 `library` | **session**（原 workspace） | **看不见** | 看不见 |
| 探测记录 `probeRecord` | **session**（新增） | 看不见 | 看不见 |
| 宿主模型 `hostModel` | **session**（新增） | 看不见 | 看不见 |
| 我的案例 `cases` | workspace | 共享 | 看不见 |
| 设置 / 提示词库 / 备份 / lab | plugin | 共享 | 共享 |

跨会话可见只有一条路，仍是 0004 D6：用户显式「沉淀到我的案例」。

### D2 旧的扁平文件不回落，只作为清理目标

`workbench/probe-refusal.json`、`workbench/host-model.json`、`workbench/library.json` 没有会话身份。读它等于把 A 会话的结果端给 B —— **宁可让用户看到一次空**。它们仍出现在设置页的占用列表里，以便被删掉（否则永远占地方，用户还以为会话里那份还在）。

> 与 0004 里 `cases` 的 legacy 回落不同：`cases` 是工作区产物，旧路径与新路径属于同一个工作区主体，回落的语义是可判定的。

### D3 清理：范围 + 条目，两种都留

- **条目式**：每行一个复选框，行是**一件事**（本次会话的报告 / 我的案例 / 提示词库 …），不是文件名；「清理选中（n）」只删勾中的，「全选 / 取消」一键处理。
- **范围式**：`session` / `workspace` / `all` 保留 —— 它回答另一种问题（「这一档全清」），并且要走 `pathsToClear` 补 legacy。

两种入口共用 `bridge.removeState(paths)`；`clearPaths` 与 `clearStorage` 分开，是为了不在一个函数里既展开 legacy 又接收已展开的路径。

### D4 `sessionId` 进入 bridge 签名

`library` / `probeRecord` / `hostModel` 都改为接收 `sessionId`。`useLibrary` 因此排在 `useChat` 之后（session id 来自 chat 状态），`cwd` 与 `sessionId` 任一变化都重读。

## 不做什么

- **不按会话过滤 `cases`。** 案例是显式沉淀，跨会话共享是它的用途。
- **不自动迁移旧的扁平文件到某个会话。** 没有会话身份的文件，迁移就是猜。
- **不做逐文件勾选。** 界面上的行是语义条目；目录结构与文件名仍不是接口。
- **不删 `pathsToClear` 的范围语义。** 两条入口回答不同问题，合并会丢掉其中一个。

## 验证

| 用例 | 钉住什么 |
| --- | --- |
| `src/test/workbench/storage-layout.test.ts` | 三样数据按会话分文件；换项目不换文件；无会话 id → `unsessioned`；范围清理不跨档 |
| `src/test/workbench/probe-custom-ladder.test.ts` | 自定义梯度必须带进简报、按句判定、措施只给被拦的档 |
| `src/test/workbench/chat.test.ts` | `createSession(cwd, { navigate: false })` —— 发到对话时不再抢焦点 |
| `node scripts/check-layout.mjs --strict` | 清理行的复选框不撑破窄面板 |
| `node scripts/report-unused-locale.mjs zh.json --strict` | 新增 4 键全部被引用 |

待补：条目式清理的端到端（真实删除 + 占用刷新）未自动化，宿主存储需真环境。

## 关联

- 0004：本 ADR 取代其作用域表与 D5，其余（键生成、占用如实报、沉淀通道）仍然有效
- 0009：启动与每轮预算（Markdown 分窗渲染同属「不让 UI 拖死主线程」）
- 0021：拒答措施的留档（本 ADR 让它随会话走）

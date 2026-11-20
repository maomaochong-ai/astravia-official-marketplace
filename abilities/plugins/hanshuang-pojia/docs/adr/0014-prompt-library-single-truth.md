# 0014：提示词库的一份真相与一条动作规范

- **状态：** 已接受
- **日期：** 2026-11-20
- **背景：** 提示词页的「已激活」可以是一句界面在说谎 —— 卡片写着激活、注入块用的却是默认契约。同一轮还发现这个侧栏与产品其他三处对破坏性动作、弹窗键盘的做法都不一样。
- **适用：** `src/domain/prompt-library.ts`、`hooks/use-prompt-library.ts`、`hooks/use-dialog-behavior.ts`、`components/prompts/**`、`components/pages/prompts.tsx`

## 问题

### 一、激活状态有两份

| 存放位置 | 谁写 | 谁读 |
|---|---|---|
| `PromptLibrary.activeId` | `activatePrompt` / `deactivateAll` | `getActivePrompt` → 注入块 |
| `PromptItem.active` | 同上（同时写） | 卡片徽标、`sortPrompts` |

两处都在持久化里，加载时各自归一化、互不校正。一次旧版本写入或一次「导入别人的备份文件」就能造出 `activeId: null` 而某条 `active: true` 的组合：卡片显示「已激活」，注入块回落到 `DEFAULT_INJECT_BODY`。界面上没有任何地方能把这两件事对上。

### 二、四类动作各有各的做法

| 动作 | 提示词页（改前） | 其他页面 |
|---|---|---|
| 删除 | 原生 `confirm()` | 活动页「清空」行内武装、注入页 6 秒武装 |
| 弹窗关闭 | 只能点遮罩 | 文档预览、活动载荷：Esc + `role="dialog"` + 焦点回收 |
| 搜索命中 | 命中正文也在卡片上不显示 | 文档页给 snippet |
| 破坏性按钮悬停 | 删除按钮变绿（`risk-low`） | 风险色表里「低」= 安全 |

## 决定

### D1 `activeId` 是唯一真相，`item.active` 由它派生

`reconcileActive(library)` 在**加载后立即**跑一次：`activeId` 有效就只留它；它丢了但有条目自称激活，就采信那一条；它指向不存在的条目就清空。`item.active` 从此只是派生字段。

### D2 停用要说出后果

停用的实际效果是把注入正文换成 `DEFAULT_INJECT_BODY`。卡片上先显示一句「停用后注入正文回到默认契约」，再要一次确认 —— 不做静默切换。

### D3 破坏性动作只用一种形态：行内武装

删除改用「点一次变确认、5 秒收回」。核心不是好看，而是 `confirm()` 会阻断渲染进程，且在沙箱化 webview 里可能恒返回 false —— 那时删除看起来完全失效。

### D4 弹窗行为抽成 `useDialogBehavior`

Esc 关闭、`role="dialog"` + `aria-modal`、打开聚焦、关闭还焦。三个提示词弹窗接上；文档预览与活动载荷已各自实现同样的逻辑，后续可迁移（不在本轮范围内，避免同时改三条链路）。

编辑器额外一条：有未保存修改时，关闭（遮罩 / ✕ / 取消 / Esc）先弹内联确认，再决定丢弃。

### D5 搜索必须能解释自己

`searchPromptHits` 返回 `{ prompt, snippet }`：命中在名称/描述时 `snippet` 为 null；只命中正文时给一段 ±42 字的上下文，卡片上标注「正文」。`searchPrompts` 保留为它的薄包装。

### D6 页头只留三个控件

「系统契约」并进导入菜单的第三组（预制模板 / 本地文件 / 系统契约）。三者是同一件事：往库里加一条只读条目。合并后页头从四个控件降回三个（分段 / 导入 / 新建），窄面板不再换行成两三行 —— 而页头已经没有可见标题，那一行只剩按钮。

## 不做什么

- **不删 `PromptItem.active` 字段。** 它仍在持久化结构里（旧数据要能读），只是不再被当作真相；删字段会让旧库读进来后判不出谁激活过。
- **不给停用做「撤销」。** 停用不是破坏性的（正文没丢），只需要说清后果；做撤销反而要求保留上一份激活状态，多一份状态就多一次分叉机会。
- **不把三个提示词弹窗改成共用组件。** 它们的头部、主体、底部差异比共性大；共用只会造出一个带五个 boolean 的组件。共用的是行为，不是外观。
- **不改文档预览与活动载荷弹窗的现有实现。** 它们已经正确；为了让 `useDialogBehavior` 多一个调用方去动两条能跑的链路，风险大于收益。
- **不把字数统计改成「词数」。** CJK 没有词边界，`{{count}} 字符` 是能算准的那个量。

## 验证

已有：

| 用例 | 钉住什么 |
|---|---|
| `src/test/workbench/prompt-library.test.ts`（4 + 2 条） | `reconcileActive` 三种分叉与空库；`searchPromptHits` 只在正文命中时给 snippet |
| `src/test/workbench/prompt-sidebar.test.tsx`（5 条） | 唯一真相、正文命中可见、两次点击删除且不调原生 `confirm`、停用确认、Esc 与脏关闭 |
| `src/test/panel-ux-regressions.test.ts` | 系统契约入口已并入导入菜单且仍会自禁用 |
| `scripts/check-layout.mjs --strict` | 裁切写法与三条样式契约 |
| `scripts/report-unused-locale.mjs --strict`（zh + en） | 961 键 0 未用、键集一致 |

待补：

- `useDialogBehavior` 尚未被文档预览与活动载荷采用（D4 已说明原因）。
- 卡片里长英文名（无空格/连字符）的横向溢出未实测，只加了 `fb-wrap`。

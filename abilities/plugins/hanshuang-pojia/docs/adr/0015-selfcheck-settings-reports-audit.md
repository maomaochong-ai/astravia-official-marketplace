# 0015：三个「体检型」侧栏的共同缺陷——把状态当文案、把重渲染当刷新、把删除当随手可得

- **状态：** 已接受
- **日期：** 2026-11-20
- **背景：** 自检、设置、报告三个侧栏各自都「能跑」，但同一类毛病在三处各犯一遍：状态值直接当文字输出、副作用跟着渲染而不是跟着意图、破坏性动作只靠一个红按钮。
- **适用：** `components/pages/{selfcheck,settings,reports}.tsx`、`hooks/use-dialog-behavior.ts`

## 问题

| 现象 | 机制 | 证据 |
|---|---|---|
| 面板在流式输出时会反复读取 `reports/` | 报告页 effect 依赖 `[model]`，而 `useWorkbench` 每次渲染返回新对象 → 父级每重渲染一次就重发一次 `listReports` | 用一条任务事件把父级推重渲染，`listReports` 调用次数 1 → 2 |
| 中文界面里出现 `pass` / `warn` / `fail` | `HealthRow` 直接渲染 `entry.status`，没有走 `t()` | `selfcheck.tsx` 旧行 `>{entry.status}<` |
| 工具清单每帧 7000 次比较 | 35 个工具 × `activity.entries.find(...)`（上限 200 条），无索引 | `selfcheck.tsx` 旧行 `model.activity.entries.find(...)` |
| 调用时间可能显示错 | 对 ISO 串 `slice(11,19)` 取的是 UTC 时刻，不是本地时刻 | 同上 `calledAt.at.slice(11, 19)` |
| 一键清空全部存储 | 三个清理按钮直接 `void clear(...)`，最狠那个还带风险色；「重置全部设置」同理 | `settings.tsx` 旧清理行 |
| 规则 id 被截断 | `truncate` 用在标识符上：读不全、也复制不了 | `settings.tsx` 旧行 `truncate … {rule.id}` |
| 报告四节用 `check` 图标 | 这四项是「报告应有的结构」，不是「已验证通过」；check 在别处一律表示通过 | `reports.tsx` 旧行 `<Icon name="check" …/>` |
| 工作区报告预览无 Esc、无 `role="dialog"` | 与文档预览、活动载荷、提示词弹窗已经统一的做法不一致（第四处） | `reports.tsx` 旧预览块 |
| 页头「清理」作用于当前评估，却常驻两个 tab | 在「样本库」视图里看到它，会以为要清列表 | `reports.tsx` 旧页头 |

## 决定

### D1 副作用跟着「意图」而不是跟着「渲染」

报告页的 `listReports` 改成「挂载读一次 + ref 取最新函数」，依赖留空。
判据不是「有没有死循环」（组件自己 setState 不会推动父级），而是**一次会话里白跑几十上百次 IO**。

### D2 状态值是文案，不是数据

一切展示给人看的状态都过 `t()`：`selfcheck.status.{pass,warn,fail}`。
原始枚举留在 `data-*` 属性里给测试与样式用，不出现在可见文本里。

### D3 派生数据先建索引

「这个工具本次调过没有、几点调的」在 `useMemo` 里建一次 `Map`；逐行 `find` 是 O(n×m)。
同一个 `useMemo` 必须放在早退之前 —— hook 数量不能随分支变化（这一条被本轮的 `Rendered more hooks than during the previous render` 亲测过）。

### D4 破坏性动作只有一种形态：行内武装

设置页的三档清理与「重置全部设置」全部改成「点一次变确认、5 秒收回」，与活动页清空、提示词删除同一套。
原生 `confirm()` 一律不用：它阻断渲染进程，样式也跟不了主题。

### D5 标识符不截断

`rule.id` 这类机器标识符改用 `fb-wrap`：截断后既读不全，也没法复制去搜索。

### D6 图标的语义必须与它在别处的含义一致

`check` 在面板里一律表示「通过」。报告四节是待办结构，改成序号。

### D7 弹窗行为只剩一处实现

工作区报告预览抽成 `WorkspacePreview` 组件并接 `useDialogBehavior`：Esc / `role="dialog"` / 焦点回收。
抽组件不是为了复用外观，而是因为 hooks 不能写在 `path ? … : null` 的条件分支里。

### D8 页头动作跟随当前视图

「清理当前评估」只在报告视图、且有报告时出现。

## 不做什么

- **不把三个页面的卡片样式抽成共用组件。** 它们的卡头、密度、交互都不同；共用只会造出一个带一堆 flag 的外壳。
- **不给自检加「定时自动重跑」。** 自检是用户主动发起的体检，自动重跑会让「结果是什么时候的」变得不可知。
- **不把 `storageUsage` 改成缓存读取。** 占用必须逐项问宿主：缓存会让「清了但没少」看起来像成功。
- **不在报告页加自动刷新 `reports/` 列表。** 目录变化是对话侧的副作用，面板轮询会与 `D1` 的结论自相矛盾；需要刷新时重进页面。
- **不迁移文档预览与活动载荷到 `useDialogBehavior`。** 它们已各自正确，本轮不动能跑的链路。

## 验证

已有：

| 用例 | 钉住什么 |
|---|---|
| `workbench.test.tsx` → `selfcheck / settings / reports sidebars`（4 条） | 父级重渲染不重发 `listReports`（曾用旧依赖验红：2 ≠ 1）、清空需两次点击、重置需确认、状态徽标已本地化 |
| `panel-ux-regressions.test.ts` → `destructive actions share one confirmation shape`（2 条） | 三个页面都不出现原生 `confirm`；都有武装状态与超时收回 |
| `scripts/check-layout.mjs --strict` | 裁切写法与样式契约 |
| `scripts/report-unused-locale.mjs --strict`（zh + en） | 967 键 0 未用、键集一致 |

待补：

- 「工具清单 7000 次比较」的耗时未量测，只按复杂度改掉了实现。
- 调用时间本地化的跨时区行为未实测（jsdom 用宿主时区）。

## 关联

- 0009：入口体积与每轮预算（同属「不做无谓工作」）
- 0010：注入目标矩阵（工具链探测的入口归属）
- 0012：布局契约（标识符不截断与它同源）
- 0014：提示词库的一份真相（破坏性动作形态的第一处）

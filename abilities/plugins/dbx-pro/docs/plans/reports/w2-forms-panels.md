# 工作流 2 · §3.7 F 表单 / 设置 / 下载 / 面板 —— 改造报告

范围：`abilities/plugins/dbx-pro`（F1–F5）。约束：只动本工作流自有文件与 feature CSS；不动 `src/index.tsx`、`src/style.css`、`src/shared/**`、`src/domain/**` 及其他工作流的文件。

状态：F1–F5 的实现与样式已落地，`npx tsc --noEmit` 通过。运行时几何探针（`harness/` + agent-browser）与设计画布视觉比对未在本工作流执行，见「未验证项」。

## 1. 改动文件清单

| 文件 | 改动 |
| --- | --- |
| `src/features/database-workspace/styles/connection-editor.css` | 修掉第 13 行多余 `}`；追加 F1 字段体系：`.dbx-field-section(+__head)`、`.dbx-field-grid`、`.dbx-field-row`、`.dbx-field(+--full)`、`__label/__req/__hint(.is-warning)`、`input/select.dbx-form-input` 高度 32、`.dbx-switch-row`、`.dbx-switch`（36×20，14px 滑块）、`.dbx-schema-chips/.dbx-schema-chip(.active)`、`.dbx-field-advanced` |
| `src/features/database-workspace/components/connection-fields.tsx` | 重写表单：基础 / 高级 / 其他 三段，双列网格，host\|port 同行，SSL 开关，只读 / 生产 / mongodb 兼容开关，Schema chips（默认折叠，`showSchemas` 展开），连接超时 / 查询超时，URL 参数，备注，密码显隐（24px `.dbx-iconbtn`） |
| `src/features/database-workspace/components/connection-editor-flow.tsx` | 配置步页脚：`保存` → `保存并连接`（`icon-[lucide--plug-zap]`）；保留 测试连接 / 测试横幅 / 取消。删除改造残留的旧按钮行 |
| `src/features/database-workspace/styles/sheet-modal.css` | `.dbx-modal-backdrop` 与 `.dbx-sheet-backdrop` 去掉 `backdrop-filter: blur(2px)`；追加 `.dbx-dialog` 弹窗壳（520 宽、`rounded-sheet`、标题条 44、正文 16 内边距、页脚 56、`.dbx-dialog--wide` 640、页脚控件 `min-height: 32`） |
| `src/features/database-workspace/styles/ai-dialog.css` | F2：`.dbx-ai-dialog` 宽 520；标题条 44（`padding: 0 12px`）；页脚 56（`padding: 0 12px`）；页脚 `.dbx-btn` `min-height: 32` |
| `src/features/database-workspace/styles/panels.css`（新建，~540 行） | F5 壳：`.dbx-popover(+head/__meta/body/foot/row/sep/input)`；F4：`.dbx-download-shelf/-head/-cols/-row/-name/-progress/-bar(+is-done/is-error/is-warning)/-pct/-cell/-state/-actions/-foot`（表头 6 列 `1fr 200 150 110 140 132`，弹出态压缩为 `1fr 148 76`）；F3：`.dbx-settings-search`、`.dbx-settings-nav(+__group)`、`.dbx-settings-content-header`（44）、`.dbx-setting-list`、`.dbx-setting-row(+__text/__label/__hint/__control)`（44）、`.dbx-number-control(+__unit)`、`.dbx-segmented(+__item)`、`.dbx-settings-footer(+__note)`（48） |
| `src/features/database-workspace/components/cell-detail-dialog.tsx` | F2 壳：`dbx-dialog`（role/aria/`stopPropagation`，`maxHeight: 70vh`）+ `.dbx-dialog__head`（info 图标 / 列名 / 类型 chip / 关闭）+ `.dbx-dialog__body bg-surface-sunken`（NULL 或 `<pre>`）+ `.dbx-dialog__foot`（复制 / 关闭）。分类与复制逻辑未变 |
| `src/features/database-workspace/components/write-confirm-dialog.tsx` | F2 壳：`dbx-dialog border-danger/40`（role `alertdialog`）+ `.dbx-dialog__head`（shield-alert / 标题 / 连接 chip）+ `.dbx-dialog__body--flush bg-surface-sunken`（SQL，`maxHeight: 240`）+ `.dbx-dialog__foot justify-end`（取消 / 执行）。Esc 行为保留 |
| `src/features/database-workspace/components/export-progress-dialog.tsx` | F2 壳：`dbx-dialog` + `.dbx-dialog__head`（标题 / 最小化-关闭）+ `.dbx-dialog__body space-y-4` + `.dbx-dialog__foot justify-end gap-2.5`。进度、回调、`inFlight` 守卫均未变 |
| `src/features/database-workspace/components/export-tasks-popover.tsx` | F4/F5：面板改为 `dbx-popover`（`left/top` 夹逼、宽度 `min(92vw, 30rem)`）；`.dbx-popover-head`（下载图标 / 后台任务 / 「N 项 · M 个进行中」）；`.dbx-popover-body max-h-[19rem]`；任务行改 3 列（状态图标 + 名称/状态堆叠 / 进度条 + 百分比 / 操作按钮组），状态文案抽为 `statusText`；`.dbx-popover-foot`（展开其余 / 收起 / 清除已完成）。触发器进度环与角标逻辑未变 |
| `src/features/database-workspace/components/settings-panel.tsx` | F3：头部加 `.dbx-settings-search`（224×28，按关键词过滤左侧分类，命中即切换）；导航 `dbx-settings-nav`（176 宽，分组标题）；内容区加 44px `.dbx-settings-content-header`；设置行改 `.dbx-setting-list` + `.dbx-setting-row`（44，仅行间分隔线）；数字项统一 `.dbx-number-control` + 单位后缀（秒/行/条）；`多语句默认视图`、`执行计划默认视图` 改 `.dbx-segmented`；页脚 48 新增「恢复默认设置」（从头部迁出）/「设置已保存在本机」/「完成」。所有 handler、`PageSizeField` 提交语义、`clampInt` 未变 |
| `src/features/database-workspace/services/db-type-badge.ts`（新增，未跟踪） | 被 `connection-editor-flow.tsx` 引用，**保留** |

未触碰（其他工作流或禁改）：`index.tsx`、`style.css`、`shared/**`、`context-menu.tsx`、`connection-tree*`、`connection-node.tsx`、`page-size-menu.tsx`、`result-*`、`sql-editor*`、`split-layout.tsx`、`horizontal-split.tsx`、`workbench-top-bar.tsx`、`grid-hscroll.tsx`、`dbx-primitives.css`。（上列为本工作流当初的禁改清单；`workbench-top-bar.tsx` 是插件自有顶栏，第四轮已在其中挂载下载入口，见 §5）

## 2. 偏差表

| # | 设计稿（§3.7 / 帧） | 现状实现 | 处理 / 理由 |
| --- | --- | --- | --- |
| W2-1 | F1 高级区「SSL 模式（require）」独立字段 | SSL 开关 + URL 参数占位 `sslmode=require` | `DbConnection` 无 sslmode 字段；不新增配置键以免与引擎契约脱节 |
| W2-2 | F1「默认查询上限 1000 行」 | 未实现 | 无对应持久化字段；新增即伪造设置项，登记为待补契约 |
| W2-3 | F1 顶部「只读连接 / 生产环境」为禁用式输入 | 移入「高级」并改为开关 | 输入禁用无法表达语义；开关是插件既有交互（对齐结果面板的「只读连接」chip 语义） |
| W2-4 | F2 scrim 76% 无模糊 | `.dbx-modal-backdrop` 与 `.dbx-sheet-backdrop` 均移除 `blur(2px)` | 统一各模态遮罩，避免同一界面两种模糊；已在计划 §7 之外的本地登记 |
| W2-5 | F2 写确认弹窗正文为单一内容区 | SQL 在 `.dbx-dialog__body--flush` 内；生产环境横幅与危险提示横幅仍位于标题条与正文之间 | 收口时保持结构最小改动；功能与信息未丢失，后续可折进正文 |
| W2-6 | F3 行高/密度、NULL 显示、复制含表头、表头固定、自动列宽、双击编辑、大文本编辑器、截断长度、数字右对齐 | 未实现 | `WorkbenchSettings` 无对应键，属数据层缺口，不能只做界面 |
| ~~W2-7~~ | ~~F4 底部停靠下载货架（6 列：`1fr/200/150/110/140/132`）~~ **已订正（见 §5）** | 现为底部通栏货架 `export-tasks-shelf.tsx`（6 列全宽），顶栏只留入口 `export-tasks-trigger.tsx` | 原判据「宿主只提供顶栏按钮」不成立：货架挂在与 `<SplitLayout>` 同级的 `database-workspace.tsx` 根列上，与三栏并列、通栏；原 popover 已删除 |
| ~~W2-8~~ | ~~F4「大小」列~~ **已订正（见 §5）** | 已实现：`ExportTask.bytesExported/bytesTotal` + 序列化器字节计数（`result-export.ts`）→ runner `onProgress` 透传 → `result-grid.tsx` 写入 | 运行中显示已写出字节；xlsx 与「总字节」受序列化时机限制，见 §5 与计划 §7 D-18 |
| ~~W2-9~~ | ~~F4 页脚 h-6（24）~~ **已订正（见 §5）** | 现为货架页脚 `.dbx-download-foot`（24px、12px 字号、左右分栏） | 容器从弹出面板页脚回到设计稿的货架页脚 |
| W2-10 | F5 六个弹层场景：导入 / 导出 / 每页 N 行 / 拉取 Schema / 单元格右键 / 连接表单展开面板 | 仅「导出」由本工作流实现，其余共用 `.dbx-popover*` 壳 | 导入与拉取 Schema、连接表单展开面板在 `connection-tree-toolbar.tsx`（禁改）；「每页 N 行」在 `page-size-menu.tsx`（另一工作流已改）；单元格右键在 `shared/components/context-menu.tsx`（禁改）。壳已就位，接线属各自归属方 |
| W2-11 | F5 越界翻向 | 仅 `left/top` 夹逼（含右边界与视口宽度） | 上下翻转需先测量面板高度再定位，本轮未实现；登记为后续项 |
| W2-12 | F5 / `panels.tsx` 的浮层 → 表信息 | `table-info-panel.tsx` 仍是右侧抽屉，不重构 | 设计稿无对应浮层帧；仅保留 token 一致。`ai-assistant-panel.tsx` 为整侧栏，形态差异大，跳过 |
| W2-13 | F3 搜索框未规定过滤对象 | 过滤左侧分类导航；若当前分类被过滤掉则自动落到首个命中项 | 保持单一搜索入口，避免同时过滤设置项造成「搜到却看不到」 |
| W2-14 | F1 Sheet 920×700 | `--dbx-conn-dialog-w` 920 / `height: min(700px, calc(100% - 2rem))` | 与大屏窄宽的降级一致，未改数值 |
| W2-15 | F2 `⌘↵` 保存 | 未新增快捷键 | 现有弹窗快捷键仅 Esc；新增全局快捷键需宿主键位表，登记为后续项 |

## 3. 验收与自检

- `npx tsc --noEmit`：**EXIT 0**（含本工作流全部文件；此前 `connection-editor-flow.tsx` 的 JSX 收尾错误已修复）。
- 硬编码颜色自检：`connection-editor.css` / `panels.css` / `sheet-modal.css` / `ai-dialog.css` / `table-info.css` 中 `#hex`、`rgb()/rgba()/hsl()` 命中 **0**（全部走 `--dbx-*` token）。
- `font-display`：自有样式与组件命中 **0**。
- `git status --short` 中本工作流自有路径：`cell-detail-dialog.tsx`、`connection-editor-flow.tsx`、`connection-fields.tsx`、`export-progress-dialog.tsx`、`export-tasks-popover.tsx`、`settings-panel.tsx`、`write-confirm-dialog.tsx`、`ai-dialog.css`、`connection-editor.css`、`sheet-modal.css`、`panels.css`（新）、`services/db-type-badge.ts`（新）；其余 ` M`/`??` 条目均属其他工作流，未触碰。

## 4. 未验证项

1. 无头几何探针（`harness/` + agent-browser，1440×900 实测 `getBoundingClientRect()` / `getComputedStyle()`）未运行——本工作流禁跑 `npm run build` / `npm test`，几何数值未实测，仅按帧规格与 CSS 对齐。
2. 设计画布未做视觉比对（`.notes.json` 无法读取，注记按帧内文字推断）。
3. ~~`export-tasks-popover.tsx` 重写后缩进略有不齐~~ —— 该文件已在第四轮删除（面板拆为底部货架 + 顶栏入口，见 §5）。
4. `text-destructive` 在宿主主题中的映射未验证（`export-progress-dialog.tsx` 既有用法，未改动）。
5. `table-info.css` 的 token 一致性仅做静态确认，未做视觉核对。

## 5. 订正：用户反馈「后台任务导出面板没有对齐设计稿」（第四轮）

反馈原文只有一句「后套任务导出面板没有对齐设计稿」，判据取设计稿帧 `frames/downloads.tsx`（F4 下载后台）。本工作流上一轮的 W2-7 / W2-8 / W2-9 三条偏差本轮全部偿还；改动落点与验证记录写在 `../ui-conformance-v0.4.2.md` §10，剩余偏差登记为该文件 §7 的 D-18…D-22。

| 文件 | 改动 |
| --- | --- |
| `src/features/database-workspace/components/export-tasks-shelf.tsx`（新增） | 底部通栏货架：头部（`下载后台` + 状态点「N 个进行中」/记录数 + `清空已完成` + 收起）、6 列列头与任务行、空态、页脚（说明 + 「已完成 N 个 · 合计 X」）；未结束的排在最前 |
| `src/features/database-workspace/components/export-tasks-trigger.tsx`（新增） | 顶栏入口：常驻按钮 + 进度环（只统计已知总数的在跑任务，封顶 99%）+ 计数角标（9+ 截断）+ 失败红点；开合语义 `aria-haspopup` / `aria-expanded` |
| `src/features/database-workspace/components/export-tasks-popover.tsx`（删除） | 面板形态与 popover 壳解耦，文件名不再表达职责（原 popover 形态废弃） |
| `src/features/database-workspace/components/database-workspace.tsx` | 货架作为 `<SplitLayout>` 的**同级兄弟**挂在根列上（设计稿里它盖住连接树下方整幅宽度）；新增 `downloadsOpen` 开合状态，默认收起 |
| `src/features/database-workspace/components/workbench-top-bar.tsx` | 挂 `ExportTasksTrigger`，透传 `downloadsOpen` / `onToggleDownloads`（本文件属插件自有顶栏，非宿主 `shared/**`） |
| `src/features/database-workspace/state/export-tasks-store.ts` | `ExportTask` 增加 `bytesExported?` / `bytesTotal?` |
| `src/features/database-workspace/services/result-export.ts` | `ChunkedTextExport` 增加 `bytes()`：懒计数（每段只 `TextEncoder.encode` 一次），不复制内容、不改 7 处 `parts.push` |
| `src/features/database-workspace/services/export-all-runner.ts` | `onProgress?(rows, bytes)` 透传字节数（保持行数为第一参数，既有回调签名不受影响） |
| `src/features/database-workspace/components/result-grid.tsx` | 写入 `bytesExported`（0 视为未知不写）与 `bytesTotal`（组包完成后） |
| `src/features/database-workspace/services/format-bytes.ts`（新增） | `formatBytes`：1000 进制（与系统文件管理器一致），未知 / NaN / 负数写「—」 |
| `src/features/database-workspace/styles/panels.css` | 货架对齐设计稿：头部 gap 10 / 标题 14px、列头与行 gap 12、字号 11→12、行区滚动上限 264px，新增 `.dbx-download-dot`（共享 `.dbx-status-dot` 无 accent 档）、`-source`、`-task`、`-empty*`、`-foot__note/__summary`、`-head__actions`、`.dbx-count-badge.dbx-export-count--attention` |
| `src/test/format-bytes.test.js`（新增） | `formatBytes` 的 4 组边界用例（未知 / <1000 / 进制进位 / 单位封顶） |

**顺带修掉的两个既有缺陷**：`.dbx-export-count--attention`（琥珀态角标）在此前**从未定义**，顶栏在「只剩等待保存 / 未保存」时不变色，本轮补上；`.dbx-popover-empty*` 至今未定义（空态无样式），`.dbx-popover*` 壳已无消费者，按 F5 复用预期**保留并登记**，未删。


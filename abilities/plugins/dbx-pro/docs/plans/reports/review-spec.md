# 规格符合性复查（Spec 轴）

> 审查对象：`abilities/plugins/dbx-pro` 未提交改动（固定点 `HEAD` = `fe35b1b2`，比较方式 `git diff HEAD` + 7 个未跟踪新增文件）。
> 规格来源：`docs/plans/ui-conformance-v0.4.2.md`（§1 目标 / §3.1–3.8 面销项 / §7 偏差登记 / §8 用户 20 项清单）、只读设计稿 `dbx-pro.astravia-design`、参考实现 `github-source-code/dbx`。

## (a) 规格要求但缺失 / 部分完成

1. **版本未提升** — 规格：`ui-conformance-v0.4.2.md:16`（本次目标版本 `0.4.2`，「必须提升能力版本」）；现状：`plugin.json:5`、`ability.json:5`、`.astravia/marketplace.source.json:645` 仍为 `0.4.1`，`package.json:3` 与其锁文件仍为 `0.4.0`。仓库惯例把提版放在发布步骤（`docs/plans/api-data-access-m2-notes.md:117`），属有意延后，由 todo 9 销项。
2. **F1 / F3 / F4 的部分项** — 「默认查询上限 1000 行」「设置面板 9 项」「导出任务大小列」未实现（`ui-conformance-v0.4.2.md:124/126/127`，理由为 `WorkbenchSettings` / `ExportTask` 数据层缺口）。已在 §3 以 `[~]` 内联标注并指向 W2 报告；原文 §7 表未收录，与「逐条登记」措辞存在口径差异。**已由根代理在 §7 表后补一行口径说明收口。**

## (b) 越界新增

无。改动全部落在 `abilities/plugins/dbx-pro/**`（含 7 个未跟踪新文件），宿主零改动，符合 §8 第 5 条；测试期望重钉属插件内行为，§9 已记录。

## (c) 看似完成实则不符

1. **第 15 项「全部统一为 BI」** — 界面已改（`src/features/visualization/components/visualization-gallery.tsx:150`、`src/tools/dbx-chart-collection.ts:335`），但**对外能力详情文案**仍写「BI 数据资产」/「BI data assets」（`detail.zh.json:24,46`、`detail.json:24,46`）；§8 第 15 项落点原本未含 detail 文件。**已由根代理修复**并补进该行落点。
2. **第 14 项菜单缺口** — 设计稿连接 / 库 / 表分别为 19 / 25 / 26 项，插件落 8 / 11 / 18 项；省略的 20+ 项逐条登记原因（`docs/plans/reports/w1-connection-tree.md:70-91`），符合「不出 disabled 假条目」，**无未登记遗漏**。

## 既未实现也未登记为偏差的设计稿元素

无。D-1…D-16（`ui-conformance-v0.4.2.md:181-196`）、W1 菜单省略表、§3 内联项均已登记。

## 已核实到位（抽查）

第 1 / 2 / 3 / 4 / 6 / 8 / 9 / 10 / 11 / 12 / 13 / 14 / 16 / 17 / 18 / 19 / 20 项与 §3.1–3.8 的对应落点均能在源码中找到接线：`sql-editor.tsx` 的 `⌘↵` 已是真按钮；`history-panel.tsx` 搜索真实过滤、收起与顶栏共用状态；`.dbx-conn-nav` 与 `.dbx-settings-nav` 两处均为 `gap: 4px`；`.dbx-nav-item.is-active` 取 `--dbx-panel`；`database-icons.ts:60` 有 `sqlserver` 图标。

## 残余风险与未验证项

- 未做渲染后几何实测与截图比对（§7 D-11 已声明的残余风险）。
- 版本号与对外详情文案是本轴唯一的实质缺口，前者的销项时机由发布步骤决定。

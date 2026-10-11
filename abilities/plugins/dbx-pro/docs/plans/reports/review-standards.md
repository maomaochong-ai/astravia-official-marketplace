# 代码规范复查（Standards 轴）

> 审查对象：`abilities/plugins/dbx-pro` 未提交改动（固定点 `HEAD` = `fe35b1b2`，比较方式 `git diff HEAD` + 6 个未跟踪新增文件；另有 1 个新增模块经审查后删除，见下）。
> 规范来源：仓库根 `AGENTS.md`、`abilities/plugins/dbx-pro/AGENTS.md`、`docs/plugin-project-structure.md`、`design.md`，外加 Fowler《重构》第 3 章坏味道基线。
> 硬违反 vs 坏味道：**坏味道一律标注为疑似（judgement call）**，规范原文优先。

## 一、明文规范违反

**无硬违反。** 逐条核对：目录/职责拆分（`docs/plugin-project-structure.md`「文件名必须表达职责，不要使用 `ui.ts`/`utils.ts` 作为多职责容器」）——本轮 7 个新文件均为单一职责且名字达意；`tools/` 仅放 `registerTool`（`src/tools/*` 保持原样）；宿主代码零改动（`git status` 全部落在 `abilities/plugins/dbx-pro/**`）；无写死色值、无 `font-display`（D-7）、无死按钮（D-16）——均一致。

> 「基础组件一个文件只放一个组件」这一条**不作为本轮发现**：仓库既有实现普遍如此（`settings-panel.tsx` 单文件 10 个组件），属既有惯例；本轮改动的多组件文件（`connection-tree-toolbar.tsx`、`history-panel.tsx` 等）里的次要组件都是**改动前就存在**的局部子组件。

## 二、坏味道基线命中（均为疑似）

1. **Duplicated Code** — `connection-tree-rail.tsx:29-49` 与 `connection-tree-toolbar.tsx:83-101` 两个 `handleImportFile` 形状相同（`file.text()` → `importConnectionsFromText` → 空结果告警 → 汇总告警），且 rail 的注释 `:13` 自认「与工具栏同一个导入实现」。建议抽成 `connection-transfer.ts` 的一个 `importFromFile(file)`。**本轮未改**：两处措辞已分叉，`alert()` 是既有惯例，改动收益低于回归风险。
2. **Speculative Generality / 死代码** — 新增 `services/db-type-badge.ts` 全仓零调用方（徽标两处都渲染 `DatabaseTypeIcon`）。**已修复**：文件删除（§7 D-17）。
3. **Speculative Generality / 死变量** — `visualization-gallery.tsx` 内 `chartCount` 的消费者被本轮改动删除后未同步删声明。**已修复**：声明删除。
4. **Primitive Obsession** — `kind?: string`（JSDoc 已枚举 `read / write / ddl`）在 `state/workbench-types.ts` 与 `domain/connection-config.ts` 各存一份；同一语义用 `string` 承载，建议收敛为联合类型。

## 三、明确无发现的类别

- **Mysterious Name / Feature Envy / Message Chains / Middle Man / Refused Bequest**：无发现。
- **Data Clumps / Repeated Switches / Shotgun Surgery / Divergent Change**：本轮新增代码未见新增站点（DB 类型元数据分散为**既有**格局，非本轮引入）。
- **工具已强制项**：`npm run check`（`tsc --noEmit`）已覆盖类型与语法，本报告不重复 lint/格式化类条目。
- **注意**：`tsconfig.json` **未开 `noUnusedLocals` / `noUnusedParameters`**，且仓库无 eslint / format 脚本 —— 未使用的导出、未使用的局部变量都不会被现有门禁拦住（上面第 2、3 条即由此漏网；用 `npx tsc --noEmit --noUnusedLocals --noUnusedParameters` 反查可复现）。

# ADR-0004: 查询结果网格工具栏功能完善

## 状态
v0.0.85 已实施（刷新按钮、列导航、列头右键菜单、底栏增强）
v0.0.86 已实施（可视化 rows→data 映射、分页上限对齐 dbx 1M）
v0.0.87 进行中（loadAll 可停止、overlay 位置、列导航闪退修复）

## 背景

dbx-pro 插件的查询结果网格工具栏已实现基础功能，但与 dbx 桌面壳相比仍有部分功能缺失。本文档分析差异并给出实施决策。

### 当前实现状态

**顶部工具栏（双排设计）**：
- 第一排：复制、行号显示切换、排序清除、表属性、双排/单排切换、AI 分析结果
- 第二排：WHERE 条件输入、ORDER BY 条件输入、应用按钮

**底部分页栏**：
- 左侧：行数统计、刷新总计按钮、提示标签、状态显示
- 右侧：每页行数选择器、分页控件（首页/上一页/页码输入/下一页/末页）、导出按钮

**右键菜单**：
- 单元格：查看详情、复制（多种格式）、按值筛选、复制筛选条件、导出全部、复制全部

---

## 1. 功能差异分析

### 1.1 顶部工具栏缺失功能

| 功能 | dbx 桌面壳 | dbx-pro 插件 | 优先级 | 实施难度 | 决策 |
|------|-----------|-------------|--------|---------|------|
| **刷新按钮** | ✅ 有（RefreshCcw） | ❌ 无 | P1 | 低 | **实施** |
| **自动刷新** | ✅ 有（时钟图标，可选间隔） | ❌ 无 | P3 | 中 | **暂缓** |
| **列导航** | ✅ 有（Columns3，搜索跳转） | ❌ 无 | P2 | 中 | **实施** |
| **新增行** | ✅ 有（Plus，快速/批量） | ❌ 无 | P2 | 高 | **暂缓** |
| **删除行** | ✅ 有（Trash2） | ❌ 无 | P2 | 高 | **暂缓** |
| **行列转置** | ✅ 有（Rows3） | ❌ 无 | P3 | 中 | **暂缓** |
| **SQL 预览** | ✅ 有（Eye） | ❌ 无 | P3 | 低 | **暂缓** |
| **提交变更** | ✅ 有（Save） | ❌ 无 | - | - | **不适用** |
| **回滚变更** | ✅ 有（RotateCcw） | ❌ 无 | - | - | **不适用** |
| **地理图层预览** | ✅ 有（Map） | ❌ 无 | - | - | **不适用** |

**说明**：
- "提交变更"和"回滚变更"不适用于 dbx-pro，因为插件的写操作走独立的确认流程，不支持事务编辑模式
- "地理图层预览"需要 geometry 类型支持，当前插件不支持空间数据类型
- "新增行"和"删除行"需要可编辑网格支持，当前插件的单元格编辑功能尚未完成

### 1.2 底部分页栏缺失功能

| 功能 | dbx 桌面壳 | dbx-pro 插件 | 优先级 | 实施难度 | 决策 |
|------|-----------|-------------|--------|---------|------|
| **SQL 预览区** | ✅ 有（中间区域显示 SQL） | ❌ 无 | P2 | 低 | **实施** |
| **执行时间显示** | ✅ 有（QueryTimingDetails） | ❌ 无 | P2 | 低 | **实施** |
| **选区统计** | ✅ 有（求和/平均/单元格数/行数） | ❌ 无 | P3 | 中 | **暂缓** |
| **加载全部按钮** | ✅ 有（ChevronsDown） | ❌ 无 | P2 | 低 | **实施** |
| **影响行数显示** | ✅ 有（rowsAffected） | ❌ 无 | P2 | 低 | **实施** |

### 1.3 右键菜单缺失功能

| 功能 | dbx 桌面壳 | dbx-pro 插件 | 优先级 | 实施难度 | 决策 |
|------|-----------|-------------|--------|---------|------|
| **列头右键菜单** | ✅ 有 | ❌ 无 | P1 | 中 | **实施** |
| └ 复制列名 | ✅ | ❌ | P1 | 低 | **实施** |
| └ 列详情 | ✅ | ❌ | P2 | 中 | **实施** |
| └ 数据库端排序 | ✅ | ❌ | P2 | 中 | **实施** |
| └ 当前页排序 | ✅ | 部分（仅客户端排序） | P2 | 低 | **完善** |
| └ 过滤子菜单 | ✅ | ❌ | P2 | 中 | **实施** |
| └ 列可见性/冻结 | ✅ | ❌ | P3 | 高 | **暂缓** |
| **单元格菜单增强** | ✅ | 部分 | - | - | - |
| └ 设为 NULL | ✅ | ❌ | P3 | 中 | **暂缓** |
| └ 批量编辑 | ✅ | ❌ | P3 | 高 | **暂缓** |
| └ 生成值 | ✅ | ❌ | P3 | 中 | **暂缓** |
| └ 网格快照 | ✅ | ❌ | P3 | 中 | **暂缓** |
| **行菜单** | ✅ | ❌ | P3 | 高 | **暂缓** |
| └ 克隆行 | ✅ | ❌ | P3 | 中 | **暂缓** |
| └ 恢复行 | ✅ | ❌ | P3 | 中 | **暂缓** |
| └ 删除行 | ✅ | ❌ | P3 | 中 | **暂缓** |

---

## 2. 实施决策

### 2.1 P1 优先级（立即实施）

#### 2.1.1 刷新按钮

**位置**：顶部工具栏第一排左侧，复制按钮之前

**设计**：
- 图标：`icon-[lucide--refresh-cw]`
- 加载中：`icon-[lucide--loader-2]` 旋转动画
- 功能：重新执行当前 SQL，回到第一页
- 快捷键：`Mod+R`（需要确认不与宿主冲突）

**实现要点**：
- 复用 `runTabSql` 函数，传入 `pageIndex: 0`
- 加载中状态与 `pageLoading` 同步

#### 2.1.2 列头右键菜单

**触发区域**：列头 `<th>` 元素

**菜单项**：
1. 复制列名（`icon-[lucide--copy]`）
2. 复制所有列名（`icon-[lucide--copy]`）
3. 列详情（`icon-[lucide--table-properties]`）— 打开列信息弹窗
4. 分隔线
5. 数据库端升序排序（`icon-[lucide--database]`）— 服务端 ORDER BY ASC
6. 数据库端降序排序（`icon-[lucide--database]`）— 服务端 ORDER BY DESC
7. 分隔线
8. 当前页升序排序（`icon-[lucide--arrow-up]`）— 客户端排序
9. 当前页降序排序（`icon-[lucide--arrow-down]`）— 客户端排序
10. 清除排序（`icon-[lucide--eraser]`）— 仅已排序时可用
11. 分隔线
12. 按此列过滤（子菜单）
    - 等于...
    - 不等于...
    - 包含...
    - 不包含...
    - 小于...
    - 大于...
    - 为空
    - 不为空
    - 清除过滤

**实现要点**：
- 列头添加 `onContextMenu` 事件处理
- 数据库端排序通过 `buildFilteredSql` 包装 SQL 实现
- 过滤子菜单通过输入框预填充 + 自动应用实现

### 2.2 P2 优先级（后续实施）

#### 2.2.1 列导航按钮

**位置**：顶部工具栏第一排中间区域

**设计**：
- 图标：`icon-[lucide--columns-3]`
- 功能：点击弹出 Popover，可搜索并跳转到指定列
- 适用场景：列数较多时快速定位

**实现要点**：
- Popover 内显示列列表，支持搜索过滤
- 点击列名后横向滚动到该列
- 当前列高亮显示

#### 2.2.2 底部分页栏增强

**新增元素**：

1. **SQL 预览区**（中间区域）
   - 显示当前执行的 SQL（截断）
   - 点击复制完整 SQL
   - Hover 显示完整 SQL tooltip

2. **执行时间显示**（左侧区域）
   - 显示查询执行耗时
   - 格式：`123ms` 或 `1.2s`

3. **影响行数显示**（左侧区域）
   - 写操作后显示影响的行数
   - 格式：`N rows affected`

4. **加载全部按钮**（右侧区域，末页按钮之后）
   - 图标：`icon-[lucide--chevrons-down]`
   - 功能：循环加载所有页直到末页
   - 适用场景：快速浏览全部数据

### 2.3 P3 优先级（暂缓实施）

以下功能暂缓实施，原因如下：

| 功能 | 暂缓原因 |
|------|---------|
| 自动刷新 | 需要定时器管理，增加复杂度，使用场景有限 |
| 新增行/删除行 | 需要完整的可编辑网格支持，当前单元格编辑未完成 |
| 行列转置 | 使用场景有限，可通过 SQL 实现 |
| SQL 预览 | 底部 SQL 预览区已可满足需求 |
| 选区统计 | 需要多选支持，当前仅支持单选 |
| 列可见性/冻结 | 实现复杂，需要列状态管理 |
| 设为 NULL/批量编辑/生成值 | 需要完整的可编辑网格支持 |
| 网格快照 | 使用场景有限 |
| 行菜单（克隆/恢复/删除） | 需要可编辑网格支持 |

---

## 3. 实施计划

### 3.1 第一阶段：P1 功能（预计 2-3 天）

1. **刷新按钮**
   - 修改 `result-grid.tsx`，在工具栏第一排左侧添加刷新按钮
   - 复用 `runTabSql` 函数

2. **列头右键菜单**
   - 修改 `result-grid.tsx`，在列头添加 `onContextMenu` 事件
   - 实现菜单项构建逻辑
   - 实现数据库端排序（通过 `buildFilteredSql`）
   - 实现过滤子菜单

### 3.2 第二阶段：P2 功能（预计 2-3 天）

1. **列导航按钮**
   - 新增 `ColumnNavigator` 组件
   - 实现 Popover 搜索和跳转逻辑

2. **底部分页栏增强**
   - 添加 SQL 预览区
   - 添加执行时间显示
   - 添加影响行数显示
   - 添加加载全部按钮

### 3.3 第三阶段：测试与优化（预计 1-2 天）

1. 功能测试
2. 性能优化
3. 文档更新

---

## 4. 技术细节

### 4.1 刷新按钮实现

```typescript
// result-grid.tsx
function handleRefresh(): void {
  if (!sql || !connectionName || pageLoading) return;
  void runTabSql(activeTabId, sql, undefined, { mode: "server", pageIndex: 0 });
}

// 工具栏
<button
  type="button"
  onClick={handleRefresh}
  disabled={pageLoading}
  className="dbx-toolbar-btn"
  title="刷新 (Mod+R)"
>
  <span className={pageLoading ? "icon-[lucide--loader-2] h-3.5 w-3.5 animate-spin" : "icon-[lucide--refresh-cw] h-3.5 w-3.5"} />
  <span className="dbx-toolbar-btn-label">刷新</span>
</button>
```

### 4.2 列头右键菜单实现

```typescript
// result-grid.tsx
function openColumnMenu(e: React.MouseEvent, col: string): void {
  e.preventDefault();
  e.stopPropagation();
  
  const items: ContextMenuEntry[] = [
    {
      type: "item",
      label: "复制列名",
      icon: "icon-[lucide--copy]",
      onClick: () => void navigator.clipboard.writeText(col).catch(() => {}),
    },
    {
      type: "item",
      label: "复制所有列名",
      icon: "icon-[lucide--copy]",
      onClick: () => void navigator.clipboard.writeText(colList.join(", ")).catch(() => {}),
    },
    { type: "separator" },
    {
      type: "item",
      label: "数据库端升序排序",
      icon: "icon-[lucide--database]",
      onClick: () => applySortByColumn(col, "asc", "server"),
    },
    {
      type: "item",
      label: "数据库端降序排序",
      icon: "icon-[lucide--database]",
      onClick: () => applySortByColumn(col, "desc", "server"),
    },
    { type: "separator" },
    {
      type: "item",
      label: "当前页升序排序",
      icon: "icon-[lucide--arrow-up]",
      onClick: () => applySortByColumn(col, "asc", "client"),
    },
    {
      type: "item",
      label: "当前页降序排序",
      icon: "icon-[lucide--arrow-down]",
      onClick: () => applySortByColumn(col, "desc", "client"),
    },
    // ... 更多菜单项
  ];
  
  setMenu({ x: e.clientX, y: e.clientY, items });
}

// 列头
<th
  key={c}
  onContextMenu={(e) => openColumnMenu(e, c)}
  // ... 其他属性
>
```

### 4.3 底部分页栏增强

```typescript
// 左侧区域新增
<div className="flex min-w-0 flex-1 items-center gap-2">
  {/* 行数统计 */}
  <span className="shrink-0">
    {totalKnown ? "共 " : "已取回 "}
    <span className="font-medium text-foreground/80">{displayTotal}</span> 行
  </span>
  
  {/* 执行时间 */}
  {result?.elapsedMs !== undefined && (
    <span className="text-muted-foreground/60">
      {formatDuration(result.elapsedMs)}
    </span>
  )}
  
  {/* 影响行数 */}
  {result?.affectedRows !== null && result?.affectedRows !== undefined && (
    <span className="text-muted-foreground/60">
      {result.affectedRows} rows affected
    </span>
  )}
</div>

// 中间区域新增（SQL 预览）
<div className="flex min-w-0 flex-1 items-center justify-center">
  <span
    className="truncate text-[10px] text-muted-foreground/60 cursor-pointer hover:text-foreground/80"
    title={sql}
    onClick={() => void navigator.clipboard.writeText(sql ?? "").catch(() => {})}
  >
    {sql}
  </span>
</div>

// 右侧区域新增（加载全部按钮）
<button
  type="button"
  onClick={handleLoadAll}
  disabled={pageLoading || !hasNextPage}
  className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-[var(--dbx-hover)] hover:text-foreground disabled:opacity-30"
  title="加载全部"
>
  <span className="icon-[lucide--chevrons-down] h-3 w-3" />
</button>
```

---

## 5. 风险与约束

### 5.1 技术风险

1. **列头右键菜单与排序冲突**：列头左键点击已实现排序切换，需要确保右键菜单不干扰左键行为
2. **数据库端排序性能**：大表排序可能较慢，需要给用户反馈
3. **SQL 预览区空间**：底部分页栏空间有限，SQL 预览需要合理截断

### 5.2 兼容性约束

1. **宿主快捷键冲突**：`Mod+R` 可能与宿主快捷键冲突，需要测试
2. **非虚拟化 DOM**：列导航跳转需要横向滚动，性能可能受影响

### 5.3 功能约束

1. **可编辑网格**：新增行/删除行等功能需要完整的可编辑网格支持，当前不具备条件
2. **事务编辑**：提交/回滚功能需要事务编辑模式，与插件的写确认流程不兼容

---

## 6. 验收标准

### 6.1 刷新按钮

- [ ] 点击刷新按钮重新执行 SQL，回到第一页
- [ ] 加载中显示旋转动画
- [ ] 加载中按钮禁用
- [ ] 快捷键 `Mod+R` 可用（如不与宿主冲突）

### 6.2 列头右键菜单

- [ ] 列头右键弹出菜单
- [ ] 复制列名功能正常
- [ ] 数据库端排序功能正常（服务端 ORDER BY）
- [ ] 当前页排序功能正常（客户端排序）
- [ ] 过滤子菜单功能正常

### 6.3 底部分页栏增强

- [ ] SQL 预览区显示正确，点击可复制
- [ ] 执行时间显示正确
- [ ] 影响行数显示正确（写操作后）
- [ ] 加载全部按钮功能正常

---

## 7. 参考资料

- dbx 桌面壳源码：`/Users/zhugeyue/Desktop/project/bigdate/github-source-code/dbx/apps/desktop/src/components/grid/`
- dbx-pro 插件源码：`/Users/zhugeyue/Desktop/project/bigdate/source-code/astravia-official-marketplace/abilities/plugins/dbx-pro/src/features/database-workspace/components/result-grid.tsx`
- ADR-0002：查询网格导出参数与 dbx 桌面壳对齐分析
- ADR-0003：5 项待评估决策实施 + 设置面板对齐 dbx 桌面壳

---

## 8. 样式/主题问题诊断（v0.0.85 补充）

### 8.1 CSS @scope 隔离验证

**宿主机制**：`@astravia-org/plugin-vite` 的 `scopePluginCss()` 在构建时将插件所有 CSS 规则包进：
```css
@scope ([data-astravia-plugin-root="dbx-pro"]) { ... }
```
同时将 `:root` 选择器替换为 `:scope`。

**验证结论**（v0.0.85 构建 dist/style.css）：
- ✅ Tailwind Preflight（`*,:before,:after`）被正确包进 `@scope`
- ✅ 所有 `.dbx-*` 类规则被正确包进 `@scope`
- ✅ 插件 CSS **未覆盖**宿主核心变量（`--background`、`--foreground`、`--muted-foreground`、`--primary`、`--border`）
- ✅ 宿主 Electron 34（Chromium 132）原生支持 CSS `@scope`

**结论**：浅色主题侧边栏变灰**不是 CSS scope 泄漏导致**。实际根因需在 dev 环境中用 DevTools 确认。

### 8.2 CSS 变量定义位置

**当前做法**（style.css:15）：
```css
.dbx-root {
  --dbx-line: color-mix(...);
  --dbx-surface: color-mix(...);
  ...
}
```

**问题**：style.css 第 13 行注释写「不能用 `:scope`（会泄漏到宿主根节点）」——这是**过时的错误认知**。宿主 `scopePluginCss()` 会自动把 `:root` 替换为 `:scope`，而 `:scope` 在 `@scope([data-astravia-plugin-root=dbx-pro])` 内精确匹配插件根元素，比 `.dbx-root` 更稳定（不依赖 JSX 类名正确性）。

**决策**：保持 `.dbx-root` 不变（JSX 根元素同时有 `data-astravia-plugin-root="dbx-pro"` 和 `className="dbx-root"`，两者等价）；但修正 style.css 中的错误注释，避免误导后续维护者。

### 8.3 重载后样式丢失

**宿主机制**（plugin-loader.ts + plugin-style-loader.ts）：
- `loadPluginStyles()` 为插件创建 `<style>` 标签，通过 `@import` 注入 CSS
- deactivate 时 `dispose()` 删除插件创建的 `<style>` / `<link>` 标签
- reactivate 时重新调用 `loadPluginStyles()` 注入

**结论**：宿主有完整的 CSS 生命周期管理，重载样式丢失问题**不在宿主层面**。可能原因：
1. JSX 根元素类名丢失（插件 re-render 时忘记渲染 `className="dbx-root"`）
2. CodeMirror 等运行时动态样式注入绕过了宿主 scope

**决策**：本轮先修功能，样式丢失作为验证项——在 dev 环境中实际测试插件重载。

---

## 9. ResultGrid Props 缺口修复（v0.0.85 补充）

### 9.1 问题

`EditorTab.result` 状态中已有 `elapsedMs: number` 和 `affectedRows?: number | null`（workbench-types.ts:34-35），但：
1. `ResultGrid` Props 接口**未定义**这两个字段
2. `result-panel.tsx` 调用 `<ResultGrid>` 时**未传递**这两个值

导致 ADR-0004 §2.2.2 中「执行时间显示」和「影响行数显示」无法实施。

### 9.2 修复

**新增 Props**（result-grid.tsx Props 接口）：
```typescript
/** 查询执行耗时（ms）。来自 result.elapsedMs。 */
elapsedMs?: number;
/** 写 / DDL 的影响行数；SELECT 为 null。来自 result.affectedRows。 */
affectedRows?: number | null;
/** 刷新按钮回调：重新执行当前 SQL 并回到第一页。 */
onRefresh?: () => void;
/** 加载全部按钮回调：循环拉取所有页直到末页。 */
onLoadAll?: () => void;
```

**调用处补齐**（result-panel.tsx）：
```tsx
<ResultGrid
  ...
  elapsedMs={result.elapsedMs}
  affectedRows={result.affectedRows}
  onRefresh={() => {
    if (activeTab?.connectionName && sql) {
      void runTabSql(activeTab.id, sql, undefined, { mode: "server", pageIndex: 0 });
    }
  }}
  onLoadAll={() => { /* 循环 goToPage */ }}
/>
```

---

## 10. 实施变更清单（v0.0.85）

### 10.1 修改文件

| 文件 | 变更 |
|------|------|
| `result-grid.tsx` | 新增刷新按钮、列导航按钮、列头右键菜单、SQL预览区、执行时间、影响行数、加载全部按钮；新增 Props（elapsedMs、affectedRows、onRefresh、onLoadAll） |
| `result-panel.tsx` | 传递新增 Props 给 ResultGrid |
| `style.css` | 修正过时注释 |

### 10.2 新增文件

| 文件 | 用途 |
|------|------|
| `ColumnNavigator.tsx` | 列导航 Popover 组件（搜索 + 跳转） |

---

## 11. Bug 修复记录

### 11.1 v0.0.86 — 大屏预览崩溃 + 分页上限对齐

**大屏预览崩溃** "Cannot read properties of undefined (reading '0')":
- 根因：`visualization-tab.tsx` 用 `as RenderedChart[]` 强制类型断言，
  领域层 `Visualization.charts[].rows` 与渲染器 `RenderedChart.data` 字段名不匹配，
  运行时 `chart.data` 为 undefined
- 修复：显式做 `rows → data` 映射后传给 DashboardRenderer/ScreenRenderer，杜绝 `as` 掩盖的字段漂移

**分页上限对齐 dbx**:
- dbx 桌面壳：`MAX_RESULT_PAGE_SIZE = 1_000_000`
- dbx-pro 旧：`MAX_RESULT_PAGE_SIZE = 10_000`（10 × ENGINE_ROW_CAP）
- dbx-pro 新：`MAX_RESULT_PAGE_SIZE = 1_000_000`
- 默认页大小不变（100），下拉选项保持 `[50, 100, 500, 1000, 2000, 5000]` 扩展档位
- 引擎单次上限 ENGINE_ROW_CAP = 1000，超上限分块拼页逻辑不变
- 说明：dbx 结果表是虚拟滚动，本插件是非虚拟化 DOM，上限对齐后大页仍可能渲染卡顿，警告由 UI 层触发

### 11.2 v0.0.87 — loadAll 可停止 + overlay 位置 + 列导航闪退

**加载全部无法停止**:
- 根因：`result-panel.tsx` onLoadAll 循环没有检查 isRunning 状态；
  cancelExecution 只设置 `isRunning = false`，但 while 循环不知道要停止
- 修复：每次 `await goToResultPage` 前后各检查一次 `tab.isRunning`，
  被取消后 break 退出循环；停止按钮复用已有的 cancelExecution（会把 tab.isRunning 置为 false）

**取数中 overlay 不跟随视窗 + 停止不生效 + 白屏**:
- 根因：overlay 在 `scrollRef` 内部且 `absolute inset-0`，
  跟随内部滚动容器移动，遮罩层位置不正确
- 修复：把 overlay 移到 gridRootRef（relative 外层容器）内，
  用 `absolute inset-0` 覆盖整个网格区域（含工具栏 + 分页栏），
  不再跟随内部表格滚动

**列导航弹窗闪退**:
- 根因：`onBlur={() => setTimeout(() => setNavOpen(false), 150)}`
  竞态 — 点击按钮触发 blur 后虽然 setTimeout 延迟关闭，
  但 Popover 内交互（input autoFocus）与按钮 blur 存在冲突
- 修复：去掉 onBlur 方案，改用 click-outside 检测
  （document mousedown + navPopoverRef.contains），
  按钮添加 `onMouseDown={(e) => e.preventDefault()}` 阻止默认聚焦

---

## 12. dbx 完整工具栏按钮对比（DataGridToolbar.vue 深入分析）

### 12.1 dbx 顶部工具栏按钮顺序

```
RefreshCcw → AutoRefreshClock → [navigation slot] → Copy + Chevron → AddRow + Chevron
  → DeleteRow → Upload(Dropdown) → Rows3(转置) → TableProperties → Map(空间预览)
  → Eye(预览) → Save(提交) → RotateCcw(回滚)
```

### 12.2 逐项对比

| # | 功能 | dbx 图标 | dbx-pro | 状态 | 决策 |
|---|------|---------|---------|------|------|
| 1 | 刷新 | RefreshCcw + Loader2旋转 | ✅ RefreshCcw + Loader2 | OK | 已实施 v0.0.85 |
| 2 | 自动刷新 | DataGridAutoRefreshClock（时钟+间隔下拉） | ❌ 无 | 缺失 | **暂缓** — 增加定时器管理复杂度，使用场景有限 |
| 3 | 列导航 | navigation slot | ✅ Columns3 Popover | OK | 已实施 v0.0.85 |
| 4 | 复制数据 | Copy + Chevron（多种格式下拉） | ✅ Copy 多种格式 | OK | 原有 |
| 5 | 新增行 | Plus + Chevron（快速/批量下拉） | ❌ 无 | 缺失 | **暂缓** — 需要可编辑网格 |
| 6 | 删除行 | Trash2 | ❌ 无 | 缺失 | **暂缓** — 需要可编辑网格 |
| 7 | 导出数据 | Upload + DropdownMenu（顶栏） | ⚠️ 仅底栏有 Download | 缺失 | **对齐** — 顶栏也需要导出按钮（Upload 图标 + DropdownMenu），与底栏格式菜单同源 |
| 8 | 行列转置 | Rows3（active 高亮） | ❌ 无 | 缺失 | **暂缓** — 使用场景有限，可通过 SQL 实现 |
| 9 | 表属性 | TableProperties（active 高亮） | ✅ 有 | OK | 原有 |
| 10 | 空间预览 | Map | ❌ 无 | 缺失 | **不适用** — 不支持 geometry 类型 |
| 11 | 可视化预览 | Eye + Loader2（预览生成中） | ❌ 无 | 缺失 | **P3 后续** — 需要与 dbx-dashboard/dbx-screen 工具联动 |
| 12 | 提交变更 | Save + 待提交计数 | ❌ 无 | 缺失 | **不适用** — 写操作走独立确认流程，无事务编辑 |
| 13 | 回滚变更 | RotateCcw | ❌ 无 | 缺失 | **不适用** — 同上 |

### 12.3 dbx BusyOverlay 与 dbx-pro overlay 对比

| 维度 | dbx DataGridBusyOverlay | dbx-pro 取数中 overlay（v0.0.87） |
|------|------------------------|-----------------------------------|
| 位置 | 父容器 relative 外层 | ✅ 对齐：gridRootRef relative 外层 |
| 样式 | 卡片（圆角 + border + 阴影）+ pill 两种模式 | ✅ 对齐：遮罩 + toast |
| 进度条 | ✅ pageJumpProgress 时显示百分比进度条 | ❌ 缺失 — loadAll 循环时不知还剩多少页 |
| 停止图标 | Square（实心方块） | ✅ 对齐 |
| cancelling 状态 | ✅ 点击停止后按钮变 Loader2 旋转 + "stopping" 文案 | ❌ 缺失 — 只有"停止"按钮，点击中无反馈 |
| cancelDisabled | ✅ 防止重复点击 | ✅ — 通过 tab.isRunning = false 实现 |

**P3 后续**: 进度条 + cancelling 状态提升用户感知

---

## 13. 参考资料（新增）

- dbx 顶部工具栏：`github-source-code/dbx/apps/desktop/src/components/grid/DataGridToolbar.vue`
- dbx BusyOverlay：`github-source-code/dbx/apps/desktop/src/components/grid/DataGridBusyOverlay.vue`
- dbx Toolbar 状态机：`github-source-code/dbx/apps/desktop/src/lib/dataGrid/dataGridToolbar.ts`
- ADR-0002：查询网格导出参数与 dbx 桌面壳对齐分析
- ADR-0003：5 项待评估决策实施 + 设置面板对齐 dbx 桌面壳

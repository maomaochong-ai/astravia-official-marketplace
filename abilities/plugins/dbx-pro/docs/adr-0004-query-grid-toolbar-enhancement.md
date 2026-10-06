# ADR-0004: 查询结果网格工具栏功能完善

## 状态
待实施

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

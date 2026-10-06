# 可视化功能架构说明

## 目录结构

```
src/features/visualization/
├── components/
│   ├── charts/                       # 图表原子组件（recharts 封装 + KPI 卡片 + 数据表）
│   ├── dashboard-renderer.tsx        # 看板渲染器（读 DASHBOARD_PRESETS）
│   ├── screen-renderer.tsx           # 大屏渲染器（读 SCREEN_PRESETS）
│   ├── visualization-gallery.tsx     # 历史画廊（列表 + 过滤 + 下载/新开标签）
│   ├── visualization-tab.tsx         # 结果区里的可视化标签页
│   └── visualization-template-dialog.tsx  # 生成前的模板选择弹窗
├── presets/
│   ├── dashboard/presets.ts          # 看板预设模板（纯数据）
│   └── screen/presets.ts             # 大屏预设模板（纯数据）
├── visualization-bridge.ts           # 存储与 UI 的桥接层
├── visualization-gallery-view.tsx    # 画廊的独立视图容器
├── visualization-store.ts            # 可视化持久化存储
└── visualization.css                 # 本模块样式（.dbx-root 作用域内）
```

## 模块职责

### visualization-bridge.ts

**职责**：工具与 UI 的桥接层

- 定义 `Visualization` 类型
- 提供 `setPreviewCallback()` 注册 UI 回调
- 提供 `showVisualizationPreview()` 工具调用入口

**使用场景**：

- 工具（dbx-dashboard/dbx-screen）生成可视化后调用 `showVisualizationPreview()`
- UI 层（database-workspace）通过 `setPreviewCallback()` 注册接收回调

### visualization-store.ts

**职责**：可视化内容的持久化存储

- 使用 localStorage 存储可视化历史
- 提供 `useVisualizationStore()` Hook
- 支持添加、删除、清空操作
- 最多保存 20 条历史记录

### components/visualization-template-dialog.tsx

**职责**：生成前的模板选择弹窗（入口：连接树节点右键 → 可视化 → 生成企业看板 / 生成数据大屏；多选工具栏的「看板 / 大屏」按钮走的是发送到 AI 对话框，不经过这里）

- 按 `type` 从 `presets/` 取预设列表（看板 3 个 / 大屏 3 个）
- 选中后由调用方组装提示词并交给 AI 生成
- 布局约束：卡片必须**嵌套**在 `.dbx-modal-backdrop`（flex 居中）内部，不能作为它的兄弟节点 —— `.dbx-modal` 这类类名没有 CSS 规则，静态定位元素会绘在 `z-index: 200` 的遮罩之下而不可见（见 ADR-0002 §11.3）

### components/visualization-tab.tsx / visualization-gallery.tsx

**职责**：已生成可视化的展示

- `visualization-tab.tsx`：结果区的标签页容器，渲染看板/大屏并标出类型
- `visualization-gallery.tsx`：历史画廊，支持「全部 / 看板 / 大屏」过滤、下载 HTML、新标签打开、删除
- iframe 渲染 HTML 内容（样式隔离），`sandbox="allow-scripts"`

## 数据流

```
用户操作（右键菜单 / 多选工具栏 / AI 对话）
    ↓
选择模板（visualization-template-dialog）
    ↓
工具执行（dbx-dashboard / dbx-screen）生成 HTML
    ↓
生成 HTML + 调用 showVisualizationPreview()
    ↓
visualization-bridge 触发回调
    ↓
database-workspace 打开可视化标签页
    ↓
用户可下载 / 新窗口打开 / 全屏
```

## 与工具的关系

- **dbx-dashboard.ts**：企业看板生成工具
  - 调用 `showVisualizationPreview()` 通知 UI
  - 返回 HTML 内容和元数据
  - 模板枚举 `DashboardTemplate`：`kpi_overview` / `trend_analysis` / `data_profile`

- **dbx-screen.ts**：数据大屏生成工具
  - 调用 `showVisualizationPreview()` 通知 UI
  - 返回 HTML 内容和元数据
  - 模板枚举 `ScreenTemplate`：`data_command` / `business_intel` / `monitoring`

## 扩展性

- 新增可视化类型：扩展 `Visualization.type` 联合类型，并在 `presets/` 下补对应模板
- 新增模板：只需往 `presets/dashboard/presets.ts` 或 `presets/screen/presets.ts` 追加纯数据对象，两个 renderer 会自动渲染
- 新增存储后端：修改 `visualization-store.ts` 的实现
- 新增预览能力：扩展 `visualization-tab.tsx` / `visualization-gallery.tsx`

# 可视化功能架构说明

## 目录结构

```
src/features/visualization/
├── components/
│   └── visualization-preview.tsx    # 预览组件
├── visualization-store.ts           # 存储管理
└── visualization-bridge.ts          # 工具与 UI 桥接
```

## 模块职责

### 1. visualization-bridge.ts
**职责**：工具与 UI 的桥接层
- 定义 `Visualization` 类型
- 提供 `setPreviewCallback()` 注册 UI 回调
- 提供 `showVisualizationPreview()` 工具调用入口

**使用场景**：
- 工具（dbx-dashboard/dbx-screen）生成可视化后调用 `showVisualizationPreview()`
- UI 层（database-workspace）通过 `setPreviewCallback()` 注册接收回调

### 2. visualization-store.ts
**职责**：可视化内容的持久化存储
- 使用 localStorage 存储可视化历史
- 提供 `useVisualizationStore()` Hook
- 支持添加、删除、清空操作
- 最多保存 20 条历史记录

**使用场景**：
- 保存用户生成的看板/大屏
- 在历史记录面板中展示
- 支持重新打开已保存的可视化

### 3. components/visualization-preview.tsx
**职责**：可视化预览 UI 组件
- iframe 渲染 HTML 内容（样式隔离）
- 支持下载 HTML 文件
- 支持新窗口打开
- 支持全屏预览

**Props**：
- `html`: HTML 内容
- `title`: 标题
- `type`: 类型（dashboard/screen）
- `onClose`: 关闭回调

## 数据流

```
用户操作（右键菜单/AI 对话）
    ↓
工具执行（dbx-dashboard/dbx-screen）
    ↓
生成 HTML + 调用 showVisualizationPreview()
    ↓
visualization-bridge 触发回调
    ↓
database-workspace 接收并显示 VisualizationPreview
    ↓
用户可下载/新窗口打开/全屏
```

## 与工具的关系

- **dbx-dashboard.ts**：企业看板生成工具
  - 调用 `showVisualizationPreview()` 通知 UI
  - 返回 HTML 内容和元数据
  
- **dbx-screen.ts**：数据大屏生成工具
  - 调用 `showVisualizationPreview()` 通知 UI
  - 返回 HTML 内容和元数据

## 扩展性

- 新增可视化类型：扩展 `Visualization.type` 联合类型
- 新增存储后端：修改 `visualization-store.ts` 的实现
- 新增预览功能：扩展 `visualization-preview.tsx` 的 UI

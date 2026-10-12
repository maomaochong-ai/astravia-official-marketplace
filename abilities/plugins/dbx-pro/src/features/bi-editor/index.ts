/**
 * bi-editor — BI 工作台与画布编辑器。
 *
 * 目录结构：
 *   workbench/    — BI 工作台入口（资产导航、看板列表）
 *   canvas/       — 画布编辑器（看板 + 大屏）
 *   preview/      — 运行产物预览态
 *   agent/        — 智能体会话
 *   shared/       — 跨域共享（UI 组件、hooks）
 */

// 工作台入口
export { BiWorkspace } from "./workbench/bi-workspace";
export { BiWorkbench } from "./workbench/bi-workbench";

// 画布编辑器
export { BigscreenEditor } from "./canvas/canvas-editor";
export { BigscreenScreenEditor } from "./canvas/screen-editor";

// 预览态
export { DashboardView } from "./preview/dashboard-preview";

// 智能体
export { AgentWorkspace } from "./agent/agent-session";

// 共享 hooks
export { useBigscreenPages, type BigscreenPage } from "./shared/hooks/use-bigscreen-pages";
export { useRunlogs } from "./shared/hooks/use-runlogs";
export { useSharelinks } from "./shared/hooks/use-sharelinks";
export { useWorktreeStatus } from "./shared/hooks/use-worktree-status";
export { useCanvasExecution, type NodeResult } from "./canvas/hooks/use-canvas-execution";

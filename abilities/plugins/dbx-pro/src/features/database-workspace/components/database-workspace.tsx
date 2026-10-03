/**
 * WorkbenchPanel — dbx-pro 数据库工作台主面板。
 *
 * 三栏布局（参考 dbx 桌面壳）：
 * ┌─────────────┬──────────────────────────────┬─────────────┐
 * │  AppSidebar │      SqlEditorWorkspace     │ TableInspect │
 * │  连接管理    │  [TabBar]                   │  表详情       │
 * │  连接树      │  [SqlEditor]                │  连接卡片     │
 * │             │  [ResultGrid / StatusBar]   │             │
 * └─────────────┴──────────────────────────────┴─────────────┘
 *
 * 分割拖拽：div + pointer events 自己实现（不引外部依赖）。
 */

import { useCallback, useRef, useState, type JSX } from "react";
import { WorkbenchProvider, useWorkbench } from "./workbench-context";
import { ConnectionTree } from "./connection-tree";
import { TabBar } from "./tab-bar";
import { SqlEditor } from "./sql-editor";
import { ResultGrid } from "./result-grid";
import { TableInspector } from "./table-inspector";
import { ConnectionForm } from "./connection-form";
import { SettingsPanel } from "./settings-panel";
import { HistoryPanel } from "../../query-history/components/history-panel";
import { DEFAULT_SETTINGS } from "../../../domain/workbench-settings";

// ─── 拖拽分隔条 ───────────────────────────────────────────

interface DragState {
	/** "left" = 左栏/中栏之间；"right" = 中栏/右栏之间 */
	side: "left" | "right";
	startX: number;
	startPct: number;
}

function SplitLayout({ children, onDragStart }: { children: [JSX.Element, JSX.Element, JSX.Element]; onDragStart?: (side: "left" | "right") => void }): JSX.Element {
	const [leftPct, setLeftPct] = useState(18); // 左栏占比
	const [rightPct, setRightPct] = useState(20); // 右栏占比（剩余的）
	const dragRef = useRef<DragState | null>(null);
	const containerRef = useRef<HTMLDivElement>(null);
	const [dragging, setDragging] = useState<"left" | "right" | null>(null);

	const onPointerMove = useCallback((e: PointerEvent) => {
		const drag = dragRef.current;
		if (!drag || !containerRef.current) return;
		const rect = containerRef.current.getBoundingClientRect();
		const deltaPct = ((e.clientX - drag.startX) / rect.width) * 100;
		if (drag.side === "left") {
			const next = Math.max(8, Math.min(50, drag.startPct + deltaPct));
			setLeftPct(next);
			// 左栏扩大时，中栏缩小，右栏最小保留 15%
			const midPct = 100 - next - rightPct;
			if (midPct < 25) setRightPct(100 - next - 25);
		} else {
			const next = Math.max(8, Math.min(50, drag.startPct - deltaPct));
			setRightPct(next);
			const midPct = 100 - leftPct - next;
			if (midPct < 25) setLeftPct(100 - next - 25);
		}
	}, [leftPct, rightPct]);

	const onPointerUp = useCallback(() => {
		dragRef.current = null;
		setDragging(null);
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
		window.removeEventListener("pointermove", onPointerMove);
		window.removeEventListener("pointerup", onPointerUp);
	}, [onPointerMove]);

	function startDrag(side: "left" | "right", e: React.PointerEvent) {
		e.preventDefault();
		e.stopPropagation();
		const startPct = side === "left" ? leftPct : rightPct;
		dragRef.current = { side, startX: e.clientX, startPct };
		setDragging(side);
		document.body.style.cursor = "col-resize";
		document.body.style.userSelect = "none";
		window.addEventListener("pointermove", onPointerMove);
		window.addEventListener("pointerup", onPointerUp);
		onDragStart?.(side);
	}

	return (
		<div ref={containerRef} className="relative flex min-h-0 flex-1">
			{/* 左栏 */}
			<div
				className="min-h-0 overflow-hidden"
				style={{ width: `${leftPct}%`, flexShrink: 0 }}
			>
				{children[0]}
			</div>

			{/* 左分隔条 */}
			<div
				onPointerDown={(e) => startDrag("left", e)}
				className="group relative w-1 shrink-0 cursor-col-resize"
				style={{ backgroundColor: dragging === "left" ? "var(--foreground)" : "var(--dbx-line-soft)" }}
			>
				<div className="absolute inset-y-0 left-[-3px] right-[-3px]" />
			</div>

			{/* 中栏 */}
			<div className="min-w-0 min-h-0 flex-1 overflow-hidden">
				{children[1]}
			</div>

			{/* 右分隔条 */}
			<div
				onPointerDown={(e) => startDrag("right", e)}
				className="group relative w-1 shrink-0 cursor-col-resize"
				style={{ backgroundColor: dragging === "right" ? "var(--foreground)" : "var(--dbx-line-soft)" }}
			>
				<div className="absolute inset-y-0 left-[-3px] right-[-3px]" />
			</div>

			{/* 右栏 */}
			<div
				className="min-h-0 overflow-hidden"
				style={{ width: `${rightPct}%`, flexShrink: 0 }}
			>
				{children[2]}
			</div>

			{dragging && (
				<div className="pointer-events-none absolute inset-0 z-50 bg-transparent" />
			)}
		</div>
	);
}

// ─── 顶栏 ─────────────────────────────────────────────────

function TopBar({ onOpenConnectionForm, onOpenSettings }: { onOpenConnectionForm: () => void; onOpenSettings: () => void }): JSX.Element {
	const { state, refreshConnections, history, rightView, setRightView } = useWorkbench();
	const activeConn = state.activeConnectionName
		? state.connections.find((c) => c.name === state.activeConnectionName)
		: null;

	return (
		<header className="dbx-chrome flex h-9 shrink-0 items-center gap-2 px-3">
			{/* 左：Logo + 连接路径 */}
			<div className="flex min-w-0 flex-1 items-center gap-2">
				<span className="icon-[solar--database-bold] h-4 w-4 text-foreground opacity-80" />
				<span className="text-[12px] font-semibold text-foreground">dbx-pro</span>
				<span className="text-muted-foreground/50">/</span>
				{activeConn ? (
					<>
						<span
							className="flex h-5 w-5 items-center justify-center rounded text-[9px] font-bold"
							style={{ backgroundColor: "var(--dbx-surface-2)", color: "var(--foreground)" }}
						>
							{activeConn.db_type.slice(0, 2).toUpperCase()}
						</span>
						<span className="min-w-0 truncate text-[12px] text-foreground/80">{activeConn.name}</span>
						<span
							className="h-1.5 w-1.5 rounded-full"
							style={{ backgroundColor:
								(state.connectionStatuses[activeConn.name] ?? "idle") === "ok" ? "var(--success, #4ade80)"
								: (state.connectionStatuses[activeConn.name] ?? "idle") === "error" ? "var(--destructive)"
								: (state.connectionStatuses[activeConn.name] ?? "idle") === "running" ? "var(--warning, #fbbf24)"
								: "var(--muted-foreground)" }}
						/>
					</>
				) : (
					<span className="text-[11px] text-muted-foreground">未选择连接</span>
				)}
			</div>

			{/* 右：工具按钮（统一中性图标按钮，单一新增连接入口） */}
			<div className="flex shrink-0 items-center gap-1">
				<button
					type="button"
					onClick={() => setRightView(rightView === "history" ? "inspector" : "history")}
					title="查询历史"
					aria-expanded={rightView === "history"}
					className={`dbx-iconbtn ${rightView === "history" ? "is-active" : ""}`}
				>
					<span className="icon-[lucide--history] h-3.5 w-3.5" />
					{history.length > 0 && <span className="text-[10px]">{history.length}</span>}
				</button>
				<button
					type="button"
					onClick={() => { void refreshConnections(); }}
					title="刷新连接"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--refresh-cw] h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={() => onOpenSettings()}
					title="工作台设置"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--settings] h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={() => onOpenConnectionForm()}
					title="添加连接"
					className="dbx-cta"
				>
					<span className="icon-[lucide--plus] h-3.5 w-3.5" />
					连接
				</button>
			</div>
		</header>
	);
}

// ─── 结果面板（含状态栏） ──────────────────────────────────

function ResultPanel(): JSX.Element {
	const { state } = useWorkbench();
	const activeTab = state.tabs.find((t) => t.id === state.activeTabId) ?? state.tabs[0];
	const result = activeTab?.result;

	return (
		<div className="flex min-h-0 flex-1 flex-col bg-background">
			{/* 结果 / 错误视图 */}
			<div className="min-h-0 flex-1 overflow-hidden">
				{activeTab?.isRunning ? (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
						<span className="icon-[lucide--loader] h-6 w-6 animate-spin text-muted-foreground" />
						<p className="text-[12px]">执行中…</p>
					</div>
				) : result ? (
					result.ok ? (
						<ResultGrid
							columns={result.columns}
							rows={result.rows}
							totalRows={result.rowCount}
							connectionName={activeTab?.connectionName ?? undefined}
							sql={activeTab?.sql}
						/>
					) : (
						<div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
							<span className="icon-[lucide--alert-octagon] h-8 w-8 text-red-400" />
							<p className="text-[12px] font-medium text-red-400">执行失败</p>
							<pre className="max-h-[200px] max-w-full overflow-auto rounded-md bg-red-900/20 px-3 py-2 font-mono text-[11px] text-red-300 whitespace-pre-wrap">
								{result.error ?? "未知错误"}
							</pre>
						</div>
					)
				) : (
					<div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground/70">
						<span className="icon-[lucide--table] h-8 w-8 opacity-30" />
						<p className="text-[12px]">执行查询后显示结果</p>
					</div>
				)}
			</div>

			{/* 状态栏 */}
			<div className="flex h-6 shrink-0 items-center gap-2 px-3 text-[10.5px] text-muted-foreground" style={{ backgroundColor: "var(--dbx-surface)", borderTop: "1px solid var(--dbx-line-soft)" }}>
				{activeTab?.connectionName ? (
					<span className="flex min-w-0 items-center gap-1">
						<span className="icon-[lucide--database] h-3 w-3 shrink-0" />
						<span className="truncate">{activeTab.connectionName}</span>
					</span>
				) : (
					<span className="shrink-0">未绑定连接</span>
				)}
				<span className="text-muted-foreground/40">·</span>
				{activeTab?.isRunning && <span className="shrink-0 text-warning">执行中…</span>}
				{result?.ok && (
					<>
						<span className="shrink-0">
							<span className="font-medium text-foreground">{result.rowCount}</span> 行
						</span>
						<span className="text-muted-foreground/40">·</span>
						<span className="shrink-0">
							<span className="font-medium text-foreground">{result.elapsedMs}</span> ms
						</span>
						{result.note && (
							<>
								<span className="text-muted-foreground/40">·</span>
								<span className="truncate text-warning">{result.note}</span>
							</>
						)}
					</>
				)}
				{result && !result.ok && <span className="shrink-0 text-destructive">错误</span>}

				<span className="ml-auto flex min-w-0 items-center gap-2">
					{state.rightPanelTable && (
						<span className="flex min-w-0 items-center gap-1">
							<span className="icon-[lucide--table-2] h-2.5 w-2.5 shrink-0 text-success" />
							<span className="truncate">{state.rightPanelTable.tableName}</span>
						</span>
					)}
					{state.errorBanner && (
						<span className="flex min-w-0 items-center gap-1 text-destructive">
							<span className="icon-[lucide--alert-circle] h-3 w-3 shrink-0" />
							<span className="truncate">{state.errorBanner}</span>
						</span>
					)}
				</span>
			</div>
		</div>
	);
}

// ─── 中栏组合：TabBar + SqlEditor + ResultPanel ───────────

function SqlEditorWorkspace(): JSX.Element {
	return (
		<div className="flex h-full min-h-0 flex-col bg-background">
			<TabBar />
			<SqlEditor />
			<ResultPanel />
		</div>
	);
}

// ─── 右栏：结构 / 历史 切换 ──────────────────────────────

function RightPanel(): JSX.Element {
	const {
		settings,
		history,
		rightView,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
	} = useWorkbench();
	if (rightView === "history") {
		return (
			<HistoryPanel
				entries={history}
				limit={settings.historyLimit}
				onLoad={loadHistoryIntoEditor}
				onRerun={(entry) => void rerunHistoryEntry(entry)}
				onDelete={(id) => void removeHistory(id)}
				onClear={() => void clearAllHistory()}
			/>
		);
	}
	return <TableInspector />;
}

// ─── 主面板（Provider 外层） ──────────────────────────────

export function DatabaseWorkspace(): JSX.Element {
	return (
		<WorkbenchProvider>
			<DatabaseWorkspaceInner />
		</WorkbenchProvider>
	);
}

function DatabaseWorkspaceInner(): JSX.Element {
	const [connectionFormOpen, setConnectionFormOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const { settings, updateSettings, clearAllHistory, wipeAllData, refreshConnections } = useWorkbench();

	return (
		<div className="dbx-root relative flex h-full w-full min-h-0 flex-col bg-background text-foreground">
			<TopBar
				onOpenConnectionForm={() => setConnectionFormOpen(true)}
				onOpenSettings={() => setSettingsOpen(true)}
			/>
			<SplitLayout>
				{[
					<ConnectionTree key="left" />,
					<SqlEditorWorkspace key="mid" />,
					<RightPanel key="right" />,
				]}
			</SplitLayout>

			{connectionFormOpen && (
				<ConnectionForm
					onChange={() => { void refreshConnections(); }}
					onCancel={() => setConnectionFormOpen(false)}
				/>
			)}

			{settingsOpen && (
				<SettingsPanel
					settings={settings}
					onChange={(next) => void updateSettings(next)}
					onReset={() => void updateSettings({ ...DEFAULT_SETTINGS })}
					onClearHistory={() => void clearAllHistory()}
					onClose={() => setSettingsOpen(false)}
					onWipeData={() => {
						setSettingsOpen(false);
						void wipeAllData();
					}}
				/>
			)}
		</div>
	);
}

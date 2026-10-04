/**
 * 工作台顶栏 — 品牌 / 当前连接 / 工具按钮。
 *
 * 右侧四个动作：查询历史、刷新连接、工作台设置、添加连接（唯一新增入口）。
 */

import type { JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";

export interface WorkbenchTopBarProps {
	onOpenConnectionEditor: () => void;
	onOpenSettings: () => void;
}

export function WorkbenchTopBar({ onOpenConnectionEditor, onOpenSettings }: WorkbenchTopBarProps): JSX.Element {
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
					onClick={() => onOpenConnectionEditor()}
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

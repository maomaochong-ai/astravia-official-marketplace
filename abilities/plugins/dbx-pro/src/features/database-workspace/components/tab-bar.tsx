/**
 * TabBar — SQL 编辑器多 tab 栏。
 *
 * 支持：新建、关闭、切换、重命名（双击）、拖拽连接绑定状态显示。
 */

import { useState, type JSX } from "react";
import { useWorkbench } from "./workbench-context";

export function TabBar(): JSX.Element {
	const { state, dispatch } = useWorkbench();
	const [editingTabId, setEditingTabId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");

	function addTab() {
		const id = `tab-${Date.now().toString(36)}`;
		const maxIdx = state.tabs.reduce((max, t) => {
			const m = t.label.match(/^查询 (\d+)/);
			return m ? Math.max(max, Number(m[1])) : max;
		}, 0);
		const label = `查询 ${maxIdx + 1}`;
		dispatch({
			type: "addTab",
			tab: {
				id,
				label,
				connectionName: state.activeConnectionName,
				sql: "",
				isRunning: false,
			},
		});
	}

	function closeTab(id: string) {
		if (state.tabs.length <= 1) return;
		dispatch({ type: "closeTab", id });
	}

	function startRename(id: string, currentLabel: string) {
		setEditingTabId(id);
		setEditValue(currentLabel);
	}

	function commitRename() {
		if (editingTabId && editValue.trim()) {
			dispatch({ type: "renameTab", id: editingTabId, label: editValue.trim() });
		}
		setEditingTabId(null);
		setEditValue("");
	}

	return (
		<div className="flex h-8 shrink-0 items-center gap-px border-b border-border bg-background px-1">
			<div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
				{state.tabs.map((tab) => {
					const active = tab.id === state.activeTabId;
					const running = tab.isRunning;
					const connBadge = tab.connectionName
						? tab.connectionName.length > 10
							? tab.connectionName.slice(0, 9) + "…"
							: tab.connectionName
						: "未绑定";
					return (
						<div
							key={tab.id}
							onDoubleClick={() => startRename(tab.id, tab.label)}
							onClick={() => dispatch({ type: "setActiveTab", id: tab.id })}
							className={`group relative flex h-7 max-w-[180px] items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors cursor-pointer ${
								active
									? "bg-zinc-800 text-zinc-100 shadow-sm"
									: "text-muted-foreground hover:bg-zinc-800/60 hover:text-zinc-200"
							}`}
							title={tab.label}
						>
							<span className={`h-3 w-3 shrink-0 ${running ? "icon-[lucide--loader] animate-spin text-amber-400" : tab.result?.ok === false ? "icon-[lucide--alert-circle] text-red-400" : "icon-[lucide--file-code]"}`} />
							{editingTabId === tab.id ? (
								<input
									autoFocus
									value={editValue}
									onChange={(e) => setEditValue(e.target.value)}
									onBlur={commitRename}
									onKeyDown={(e) => {
										if (e.key === "Enter") { e.preventDefault(); commitRename(); }
										if (e.key === "Escape") { setEditingTabId(null); setEditValue(""); }
									}}
									className="min-w-[60px] max-w-[110px] rounded bg-zinc-900 px-1 text-[11px] text-zinc-100 outline-none ring-1 ring-blue-500"
									onClick={(e) => e.stopPropagation()}
								/>
							) : (
								<span className="min-w-0 flex-1 truncate font-medium">{tab.label}</span>
							)}
							<span className={`shrink-0 rounded px-1 text-[9px] ${tab.connectionName ? "bg-zinc-700/70 text-muted-foreground" : "bg-zinc-800 text-zinc-600"}`}>
								{connBadge}
							</span>
							{state.tabs.length > 1 && (
								<button
									type="button"
									onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
									className="ml-0.5 rounded p-0.5 text-zinc-500 opacity-0 transition-opacity hover:bg-zinc-600/50 hover:text-zinc-200 group-hover:opacity-100"
									title="关闭 tab"
								>
									<span className="icon-[lucide--x] h-3 w-3" />
								</button>
							)}
						</div>
					);
				})}
			</div>
			<button
				type="button"
				onClick={addTab}
				title="新建 tab"
				className="mx-1 flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
			>
				<span className="icon-[lucide--plus] h-3.5 w-3.5" />
			</button>
		</div>
	);
}

/**
 * TabBar — SQL 编辑器多 tab 栏。
 *
 * 支持：新建、关闭、切换、重命名（双击）。
 * 标签多时：每个标签固定 92–170px、不被压缩，条带横向滚动（细滚动条），
 * 避免多标签被挤成一团、连接名文字叠压。
 */

import { useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";

export function TabBar(): JSX.Element {
	const { state, dispatch } = useWorkbench();
	const [editingTabId, setEditingTabId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const [wrapTabs, setWrapTabs] = useState(false);

	function addTab() {
		const id = `tab-${Date.now().toString(36)}`;
		const maxIdx = state.tabs.reduce((max, t) => {
			const m = t.label.match(/^查询 (\d+)/);
			return m ? Math.max(max, Number(m[1])) : max;
		}, 0);
		dispatch({
			type: "addTab",
			tab: {
				id,
				label: `查询 ${maxIdx + 1}`,
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
		<div className="dbx-chrome flex shrink-0 items-center px-1" style={{ minHeight: wrapTabs ? undefined : 32 }}>
			<div
				className={wrapTabs ? "dbx-tab-wrap flex min-w-0 flex-1 items-center gap-0.5 flex-wrap" : "dbx-tab-scroll flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"}
			>
				{state.tabs.map((tab) => {
					const active = tab.id === state.activeTabId;
					const running = tab.isRunning;
					return (
						<div
							key={tab.id}
							onDoubleClick={() => startRename(tab.id, tab.label)}
							onClick={() => dispatch({ type: "setActiveTab", id: tab.id })}
							className={`group flex h-7 w-[var(--tabw)] shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-2 text-[11px] transition-colors ${
								active
									? "text-foreground"
									: "text-muted-foreground hover:text-foreground"
							}`}
							style={{
								["--tabw" as string]: "clamp(92px, 12vw, 170px)",
								backgroundColor: active ? "var(--dbx-surface-2)" : "transparent",
							}}
							title={tab.label}
						>
							<span className={`h-3 w-3 shrink-0 ${
								running
									? "icon-[lucide--loader] animate-spin text-warning"
									: tab.result?.ok === false
										? "icon-[lucide--alert-circle] text-destructive"
										: "icon-[lucide--file-code]"
							}`} />
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
									className="h-5 min-w-0 w-full rounded px-1 text-[11px] outline-none ring-1"
									style={{ backgroundColor: "var(--background)", color: "var(--foreground)", boxShadow: "0 0 0 1px var(--foreground)" }}
									onClick={(e) => e.stopPropagation()}
								/>
							) : (
								<span className="min-w-0 flex-1 truncate font-medium">{tab.label}</span>
							)}
						{/* 不再展示绑定的数据库信息，与 dbx 桌面壳一致 */}
						{state.tabs.length > 1 && (
								<button
									type="button"
									onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}
									className="ml-0.5 shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
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
				className="dbx-iconbtn mx-1 shrink-0"
			>
				<span className="icon-[lucide--plus] h-3.5 w-3.5" />
			</button>
			<button
				type="button"
				onClick={() => setWrapTabs((v) => !v)}
				title={wrapTabs ? "切换为单行滚动" : "切换为多行换行"}
				className={`dbx-iconbtn shrink-0 ${wrapTabs ? "is-active" : ""}`}
			>
				<span className="icon-[lucide--wrap-text] h-3.5 w-3.5" />
			</button>
		</div>
	);
}

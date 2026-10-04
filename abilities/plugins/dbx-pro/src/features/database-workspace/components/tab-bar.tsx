/**
 * TabBar — SQL 编辑器多 tab 栏。
 *
 * 支持：新建、关闭、切换、重命名（双击）。
 * 标签多时：每个标签固定 92–170px、不被压缩，条带横向滚动（细滚动条），
 * 避免多标签被挤成一团、连接名文字叠压。
 */

import { useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import { ContextMenu, type ContextMenuState } from "../../../shared/components/context-menu";

export function TabBar(): JSX.Element {
	const { state, dispatch } = useWorkbench();
	const [editingTabId, setEditingTabId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const [wrapTabs, setWrapTabs] = useState(false);
	const [menu, setMenu] = useState<ContextMenuState | null>(null);
	const [contextTabId, setContextTabId] = useState<string | null>(null);

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
		<>
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
							className={`group relative flex h-7 w-[var(--tabw)] shrink-0 cursor-pointer items-center gap-1.5 rounded-t-md px-2 text-[11px] transition-colors ${
								active
									? "border-b-2 border-foreground text-foreground"
									: "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
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
								<span
									className="min-w-0 flex-1 truncate font-medium"
									onContextMenu={(e) => {
										e.preventDefault();
										e.stopPropagation();
										setContextTabId(tab.id);
										const items = [
											{ type: "item" as const, label: "重命名", icon: "icon-[lucide--pencil]", onClick: () => startRename(tab.id, tab.label) },
											{ type: "item" as const, label: "复制名称", icon: "icon-[lucide--copy]", onClick: () => void navigator.clipboard.writeText(tab.label).catch(() => {}) },
											{ type: "separator" as const },
											{
												type: "item" as const,
												label: "关闭标签",
												icon: "icon-[lucide--x]",
												onClick: () => closeTab(tab.id),
												disabled: state.tabs.length <= 1,
											},
											{
												type: "item" as const,
												label: "关闭其他",
												icon: "icon-[lucide--x]",
												onClick: () => state.tabs.filter((t) => t.id !== tab.id).forEach((t) => closeTab(t.id)),
												disabled: state.tabs.length <= 1,
											},
											{
												type: "item" as const,
												label: "关闭全部",
												icon: "icon-[lucide--x]",
												danger: true,
												onClick: () => state.tabs.filter((t) => t.id !== tab.id).forEach((t) => closeTab(t.id)),
												disabled: state.tabs.length <= 1,
											},
										];
										setMenu({ x: e.clientX, y: e.clientY, items });
									}}
								>
									{tab.label}
								</span>
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
		{menu && <ContextMenu menu={menu} onClose={() => { setMenu(null); setContextTabId(null); }} />}
		</>
	);
}

/**
 * TabBar — SQL 编辑器多 tab 栏。
 *
 * 布局要点：
 * - 整行固定高 36px，滚动区与右侧操作按钮在同一交叉轴上 stretch / center，
 *   横向滚动条出现时右侧图标仍垂直居中，不上下错位；
 * - 标签只显示标题，不携带绑定数据库信息；标题用 flex-1 吃掉剩余宽度，关闭按钮贴紧右边缘；
 * - 右键菜单：执行、重命名、关闭、关闭其他、关闭右侧、关闭全部。
 * - 标签溢出支持「单行横向滚动 / 多行换行」切换。
 */

import { useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import { nextQueryLabel, nextTabId } from "../state/tab-ids";
import {
	ContextMenu,
	type ContextMenuState,
} from "../../../shared/components/context-menu";

export function TabBar(): JSX.Element {
	const { state, dispatch, runTabSql } = useWorkbench();
	const [editingTabId, setEditingTabId] = useState<string | null>(null);
	const [editValue, setEditValue] = useState("");
	const [wrapTabs, setWrapTabs] = useState(false);
	const [menu, setMenu] = useState<ContextMenuState | null>(null);

	function addTab() {
		const id = nextTabId();
		dispatch({
			type: "addTab",
			tab: {
				id,
				label: nextQueryLabel(state.tabs),
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

	function closeOthers(keepId: string) {
		for (const t of state.tabs) {
			if (t.id !== keepId) dispatch({ type: "closeTab", id: t.id });
		}
	}

	function closeToRight(anchorId: string) {
		const idx = state.tabs.findIndex((t) => t.id === anchorId);
		if (idx < 0) return;
		for (const t of state.tabs.slice(idx + 1)) {
			dispatch({ type: "closeTab", id: t.id });
		}
	}

	function closeAll() {
		// 先新建一个空白 tab，再关掉其余；reducer 不允许 0 个 tab。
		const oldIds = state.tabs.map((t) => t.id);
		addTab();
		for (const id of oldIds) dispatch({ type: "closeTab", id });
	}

	function startRename(id: string, currentLabel: string) {
		setMenu(null);
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

	function openMenu(e: React.MouseEvent, tab: (typeof state.tabs)[number]) {
		e.preventDefault();
		const idx = state.tabs.findIndex((t) => t.id === tab.id);
		setMenu({
			x: e.clientX,
			y: e.clientY,
			items: [
				{
					type: "item",
					label: "执行",
					icon: "icon-[lucide--play]",
					disabled: tab.isRunning || !tab.connectionName,
					onClick: () => void runTabSql(tab.id, undefined, undefined, { mode: "server" }),
				},
				{
					type: "item",
					label: "重命名",
					icon: "icon-[lucide--pencil]",
					onClick: () => startRename(tab.id, tab.label),
				},
				{ type: "separator" },
				{
					type: "item",
					label: "关闭",
					icon: "icon-[lucide--x]",
					disabled: state.tabs.length <= 1,
					onClick: () => closeTab(tab.id),
				},
				{
					type: "item",
					label: "关闭其他",
					icon: "icon-[lucide--square-x]",
					disabled: state.tabs.length <= 1,
					onClick: () => closeOthers(tab.id),
				},
				{
					type: "item",
					label: "关闭右侧标签",
					icon: "icon-[lucide--panel-right-close]",
					disabled: idx >= state.tabs.length - 1,
					onClick: () => closeToRight(tab.id),
				},
				{
					type: "item",
					label: "关闭全部",
					icon: "icon-[lucide--folder-x]",
					disabled: state.tabs.length <= 1,
					onClick: () => closeAll(),
				},
			],
		});
	}

	return (
		<div className="dbx-chrome flex shrink-0 items-stretch px-1" style={{ height: wrapTabs ? undefined : 36 }}>
			<div
				className={
					wrapTabs
						? "dbx-tab-wrap flex min-w-0 flex-1 flex-wrap content-start gap-0.5 py-1"
						: "dbx-tab-scroll flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto py-1"
				}
			>
				{state.tabs.map((tab) => {
					const active = tab.id === state.activeTabId;
					const running = tab.isRunning;
					return (
						<div
							key={tab.id}
							onContextMenu={(e) => openMenu(e, tab)}
							onClick={() => dispatch({ type: "setActiveTab", id: tab.id })}
							className={`group flex h-7 w-[var(--tabw)] shrink-0 cursor-pointer items-center gap-1 rounded-md pl-2 pr-1 text-[11px] transition-colors ${
								active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
							}`}
							style={{
								["--tabw" as string]: "clamp(92px, 12vw, 170px)",
								backgroundColor: active ? "var(--dbx-surface-2)" : "transparent",
							}}
							title={tab.label}
						>
							<span
								className={`h-3 w-3 shrink-0 ${
									running
										? "icon-[lucide--loader] animate-spin text-warning"
										: tab.result?.ok === false
											? "icon-[lucide--alert-circle] text-destructive"
											: tab.gallery
											? "icon-[lucide--images] text-primary"
											: tab.visualization
												? tab.visualization.type === "dashboard"
													? "icon-[lucide--layout-dashboard] text-primary"
													: "icon-[lucide--monitor] text-primary"
												: "icon-[lucide--file-code]"
								}`}
							/>
							{editingTabId === tab.id ? (
								<input
									autoFocus
									value={editValue}
									onChange={(e) => setEditValue(e.target.value)}
									onBlur={commitRename}
									onKeyDown={(e) => {
										if (e.key === "Enter") {
											e.preventDefault();
											commitRename();
										}
										if (e.key === "Escape") {
											setEditingTabId(null);
											setEditValue("");
										}
									}}
									className="h-5 min-w-0 flex-1 rounded px-1 text-[11px] outline-none"
									style={{
										backgroundColor: "var(--background)",
										color: "var(--foreground)",
										boxShadow: "0 0 0 1px var(--foreground)",
									}}
									onClick={(e) => e.stopPropagation()}
									onContextMenu={(e) => e.stopPropagation()}
								/>
							) : (
								<span className="min-w-0 flex-1 truncate font-medium">{tab.label}</span>
							)}
							{state.tabs.length > 1 && (
								<button
									type="button"
									onClick={(e) => {
										e.stopPropagation();
										closeTab(tab.id);
									}}
									onContextMenu={(e) => e.stopPropagation()}
									className="shrink-0 rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-muted hover:text-foreground group-hover:opacity-100"
									title="关闭 tab"
								>
									<span className="icon-[lucide--x] h-3 w-3" />
								</button>
							)}
						</div>
					);
				})}
			</div>

			{/* 右侧操作：self-center 保证滚动条出现时仍与标签垂直居中、不错位 */}
			<div className="flex shrink-0 items-center self-center">
				<button type="button" onClick={addTab} title="新建 tab" className="dbx-iconbtn">
					<span className="icon-[lucide--plus] h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={() => setWrapTabs((v) => !v)}
					title={wrapTabs ? "切换为单行滚动" : "切换为多行换行"}
					className={`dbx-iconbtn ${wrapTabs ? "is-active" : ""}`}
				>
					<span className="icon-[lucide--wrap-text] h-3.5 w-3.5" />
				</button>
			</div>

			{menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
		</div>
	);
}

/**
 * ConnectionTree — 左栏连接树主容器。
 *
 * 职责：
 * - 顶部工具栏（刷新、搜索过滤）
 * - 渲染 connection → table → column 递归节点
 * - 触发懒加载（通过 workbench-context）
 */

import { useState, type JSX } from "react";
import { useWorkbench, type TreeNode } from "./workbench-context";
import { ConnectionNode } from "./connection-node";

export function ConnectionTree(): JSX.Element {
	const { state, refreshConnections } = useWorkbench();
	const [query, setQuery] = useState("");
	const needle = query.trim().toLowerCase();

	// 初始化：连接列表加载完后，给每个连接创建一个 tree connection 节点，并设置 dbType
	const connectionNodes: TreeNode[] = state.connections.map((c) => ({
		key: `conn:${c.name}`,
		kind: "connection",
		label: c.name,
		dbType: c.db_type,
		hasChildren: true,
	}));

	// 过滤
	const visibleConnectionNodes = needle
		? connectionNodes.filter((n) => n.label.toLowerCase().includes(needle))
		: connectionNodes;

	function handleAddConnection() {
		void refreshConnections();
	}

	return (
		<div className="flex h-full flex-col bg-background">
			{/* 标题栏 */}
			<div className="flex h-8 shrink-0 items-center gap-2 border-b border-border px-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
				<span className="icon-[lucide--database] h-3 w-3" />
				连接
				{connectionNodes.length > 0 && (
					<span className="ml-auto rounded-full bg-zinc-800/70 px-1.5 text-[10px] font-medium text-muted-foreground">
						{connectionNodes.length}
					</span>
				)}
			</div>

			{/* 搜索 + 工具 */}
			<div className="shrink-0 border-b border-border/70 px-2 py-1.5">
				<div className="flex items-center gap-1 rounded-md bg-zinc-800/70 px-2 py-1">
					<span className="icon-[lucide--search] h-3 w-3 shrink-0 text-zinc-500" />
					<input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="过滤连接/表..."
						className="min-w-0 flex-1 bg-transparent text-[11px] text-zinc-200 outline-none placeholder:text-zinc-600"
					/>
					{query && (
						<button
							type="button"
							onClick={() => setQuery("")}
							className="shrink-0 text-zinc-500 hover:text-zinc-200"
						>
							<span className="icon-[lucide--x] h-3 w-3" />
						</button>
					)}
				</div>
			</div>

			{/* 操作按钮 */}
			<div className="flex shrink-0 items-center gap-1 border-b border-border/70 px-2 py-1">
				<button
					type="button"
					onClick={() => { void refreshConnections(); }}
					title="刷新连接"
					className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
				>
					<span className="icon-[lucide--refresh-cw] h-3 w-3" />
				</button>
				<button
					type="button"
					onClick={handleAddConnection}
					title="添加连接（通过连接表单）"
					className="flex h-6 w-6 items-center justify-center rounded text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
				>
					<span className="icon-[lucide--plus] h-3 w-3" />
				</button>
			</div>

			{/* 树内容 */}
			<div className="min-h-0 flex-1 overflow-y-auto px-1 py-1">
				{visibleConnectionNodes.length === 0 ? (
					<div className="flex flex-col items-center justify-center py-10 text-center">
						<span className="icon-[lucide--database] h-8 w-8 text-zinc-700" />
						<p className="mt-3 text-[11px] text-zinc-500">
							{query ? "无匹配" : "暂无连接"}
						</p>
						{!query && (
							<p className="mt-1 text-[10px] text-zinc-600">
								点右侧面板添加
							</p>
						)}
					</div>
				) : (
					visibleConnectionNodes.map((n) => (
						<ConnectionNode
							key={n.key}
							node={n}
							depth={0}
							connectionName={n.label}
						/>
					))
				)}
			</div>

			{/* 底部状态 */}
			<div className="flex shrink-0 items-center gap-1 border-t border-border px-3 py-1 text-[10px] text-zinc-600">
				{state.activeConnectionName ? (
					<>
						<span className="icon-[lucide--activity] h-2.5 w-2.5 text-emerald-500" />
						<span className="truncate">当前: {state.activeConnectionName}</span>
					</>
				) : (
					<span>未选择连接</span>
				)}
			</div>
		</div>
	);
}

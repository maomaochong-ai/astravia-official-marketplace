/**
 * 连接树标题工具条 — 左侧导入 / 导出 + 标题，右侧展开 / 收起 / 刷新 / 多选 / 折叠面板。
 *
 * 从 connection-tree.tsx 抽出，保持一个文件一个主组件；按钮行为全部由 props 注入。
 * 导入使用隐藏的 file input（webview 内无 Tauri 保存对话框，导出走 Blob 下载）。
 */

import type { JSX } from "react";
import { useConnectionTransfer } from "../hooks/use-connection-transfer";

export interface ConnectionTreeToolbarProps {
	connectionCount: number;
	selectionMode: boolean;
	/** 当前多选勾选数：落在设计稿第 2 行「已选 N」的位置。 */
	selectedCount: number;
	/** 搜索词（受控）：搜索框嵌进设计稿第 2 行，避免插件多占一行。 */
	query: string;
	onQueryChange: (value: string) => void;
	onExpandAll: () => void;
	onCollapseAll: () => void;
	onRefresh: () => void;
	onToggleSelectionMode: () => void;
	/** 导入完成后刷新树数据。 */
	onAfterTransfer: () => void;
	onCollapsePanel?: () => void;
}

/** 带原生 tooltip 的紧凑图标按钮（24px 正方形，v0.0.102 统一到 shared dbx-icon-btn）。 */
function TooltipButton({
	children,
	title,
	onClick,
	active,
}: {
	children: JSX.Element;
	title: string;
	onClick?: () => void;
	active?: boolean;
}): JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			title={title}
			className={`dbx-icon-btn ${active ? "dbx-icon-btn--active" : ""}`}
		>
			{children}
		</button>
	);
}

export function ConnectionTreeToolbar({
	connectionCount,
	selectionMode,
	selectedCount,
	query,
	onQueryChange,
	onExpandAll,
	onCollapseAll,
	onRefresh,
	onToggleSelectionMode,
	onAfterTransfer,
	onCollapsePanel,
}: ConnectionTreeToolbarProps): JSX.Element {
	const { fileInputRef, triggerImport, handleImportFile, handleExport } = useConnectionTransfer({
		onImported: onAfterTransfer,
		showErrorDetails: true,
	});

	return (
		<>
			{/* 第 1 行：设计稿 ConnectionTree 头部（h-9）—— 标题 + 连接数 + 右侧图标组 */}
			<div
				className="flex h-9 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3"
			>
				<span className="flex min-w-0 items-center gap-2 truncate">
					<span className="font-sans text-[14px] font-semibold tracking-tight whitespace-nowrap text-surface-foreground">连接</span>
					{connectionCount > 0 && (
						<span className="shrink-0 font-mono text-[12px] tabular-nums text-muted">{connectionCount}</span>
					)}
				</span>

				<div className="ml-auto flex shrink-0 items-center gap-0.5">
					<TooltipButton onClick={triggerImport} title="导入连接">
						<span className="icon-[lucide--folder-input] h-3 w-3" />
					</TooltipButton>
					<TooltipButton onClick={() => void handleExport()} title="导出连接（不含密码）">
						<span className="icon-[lucide--folder-output] h-3 w-3" />
					</TooltipButton>
					<TooltipButton onClick={onRefresh} title="刷新连接">
						<span className="icon-[lucide--refresh-cw] h-3 w-3" />
					</TooltipButton>
					{onCollapsePanel && (
						<TooltipButton onClick={onCollapsePanel} title="收起连接树">
							<span className="icon-[lucide--panel-left-close] h-3 w-3" />
						</TooltipButton>
					)}
				</div>
			</div>

			{/* 第 2 行：设计稿工具行（h-7）—— 展开/收起、多选；插件的搜索嵌进这一行，不再单独占行 */}
			<div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border px-2">
				<TooltipButton onClick={onExpandAll} title="展开已加载节点">
					<span className="icon-[lucide--chevrons-down-up] h-3 w-3" />
				</TooltipButton>
				<TooltipButton onClick={onCollapseAll} title="收起全部">
					<span className="icon-[lucide--chevrons-up-down] h-3 w-3" />
				</TooltipButton>
				<TooltipButton
					onClick={onToggleSelectionMode}
					title={selectionMode ? "退出多选" : "多选库 / 表（作为 AI 上下文）"}
					active={selectionMode}
				>
					<span className="icon-[lucide--square-check-big] h-3 w-3" />
				</TooltipButton>
				<div className="mx-1 flex h-5 min-w-0 flex-1 items-center gap-1 rounded-control border border-border bg-surface px-1.5">
					<span className="icon-[lucide--search] size-3 shrink-0 text-muted" />
					<input
						value={query}
						onChange={(e) => onQueryChange(e.target.value)}
						placeholder="过滤连接/表..."
						className="min-w-0 flex-1 bg-transparent text-[12px] text-surface-foreground outline-none placeholder:text-faint"
					/>
					{query && (
						<button
							type="button"
							onClick={() => onQueryChange("")}
							title="清空搜索"
							className="shrink-0 text-muted hover:text-surface-foreground"
						>
							<span className="icon-[lucide--x] size-3" />
						</button>
					)}
				</div>
				{(selectionMode || selectedCount > 0) && (
					<span className="shrink-0 font-mono text-[12px] tabular-nums text-faint">已选 {selectedCount}</span>
				)}
			</div>

			<input
				ref={fileInputRef}
				type="file"
				accept="application/json,.json"
				className="hidden"
				onChange={(e) => void handleImportFile(e)}
			/>
		</>
	);
}

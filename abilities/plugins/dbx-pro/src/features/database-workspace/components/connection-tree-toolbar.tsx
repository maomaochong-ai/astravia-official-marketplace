/**
 * 连接树标题工具条 — 左侧导入 / 导出 + 标题，右侧展开 / 收起 / 刷新 / 多选 / 折叠面板。
 *
 * 从 connection-tree.tsx 抽出，保持一个文件一个主组件；按钮行为全部由 props 注入。
 * 导入使用隐藏的 file input（webview 内无 Tauri 保存对话框，导出走 Blob 下载）。
 */

import { useRef, type JSX } from "react";
import {
	exportConnectionsFile,
	importConnectionsFromText,
} from "../services/connection-transfer";

export interface ConnectionTreeToolbarProps {
	connectionCount: number;
	selectionMode: boolean;
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
	onExpandAll,
	onCollapseAll,
	onRefresh,
	onToggleSelectionMode,
	onAfterTransfer,
	onCollapsePanel,
}: ConnectionTreeToolbarProps): JSX.Element {
	const fileInputRef = useRef<HTMLInputElement>(null);

	async function handleExport(): Promise<void> {
		try {
			const count = await exportConnectionsFile();
			if (count === 0) alert("暂无连接可导出");
		} catch (err) {
			alert(`导出失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	function triggerImport(): void {
		fileInputRef.current?.click();
	}

	async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
		const file = e.target.files?.[0];
		// 允许重复选择同一个文件：清空 value，下次 change 仍会触发。
		e.target.value = "";
		if (!file) return;
		try {
			const text = await file.text();
			const result = await importConnectionsFromText(text);
			if (result.total === 0) {
				alert("文件中没有可导入的连接（每条连接至少需要 name / db_type / host）");
				return;
			}
			onAfterTransfer();
			const summary = `导入完成：新增 ${result.imported} 个，更新 ${result.updated} 个，失败 ${result.failed} 个`;
			alert(result.failed > 0 ? `${summary}\n${result.errors.join("\n")}` : summary);
		} catch (err) {
			alert(`导入失败: ${err instanceof Error ? err.message : String(err)}`);
		}
	}

	return (
		<div
			className="flex h-9 shrink-0 items-center gap-1 px-2 text-[11px] font-medium text-muted-foreground"
			style={{ backgroundColor: "var(--dbx-surface)", borderBottom: "1px solid var(--dbx-line-soft)" }}
		>
			{/* 左：导入 / 导出（对齐 dbx 桌面壳，替换原数据库图标）+ 标题 */}
			<TooltipButton onClick={() => void handleExport()} title="导出连接（不含密码）">
				<span className="icon-[lucide--upload] h-3 w-3" />
			</TooltipButton>
			<TooltipButton onClick={triggerImport} title="导入连接">
				<span className="icon-[lucide--download] h-3 w-3" />
			</TooltipButton>
			<span className="flex min-w-0 flex-1 items-center gap-1 truncate">
				<span className="truncate">连接</span>
				{connectionCount > 0 && (
					<span className="shrink-0 text-[10px] text-muted-foreground/70">{connectionCount}</span>
				)}
			</span>

			{/* 右：树操作 */}
			<div className="flex shrink-0 items-center gap-0.5">
				<TooltipButton onClick={onExpandAll} title="展开已加载节点">
					<span className="icon-[lucide--chevrons-down-up] h-3 w-3" />
				</TooltipButton>
				<TooltipButton onClick={onCollapseAll} title="收起全部">
					<span className="icon-[lucide--chevrons-up-down] h-3 w-3" />
				</TooltipButton>
				<TooltipButton onClick={onRefresh} title="刷新连接">
					<span className="icon-[lucide--refresh-cw] h-3 w-3" />
				</TooltipButton>
				<TooltipButton
					onClick={onToggleSelectionMode}
					title={selectionMode ? "退出多选" : "多选库 / 表（作为 AI 上下文）"}
					active={selectionMode}
				>
					<span className="icon-[lucide--list-checks] h-3 w-3" />
				</TooltipButton>
				{onCollapsePanel && (
					<TooltipButton onClick={onCollapsePanel} title="收起连接树">
						<span className="icon-[lucide--panel-left-close] h-3 w-3" />
					</TooltipButton>
				)}
			</div>

			<input
				ref={fileInputRef}
				type="file"
				accept="application/json,.json"
				className="hidden"
				onChange={(e) => void handleImportFile(e)}
			/>
		</div>
	);
}

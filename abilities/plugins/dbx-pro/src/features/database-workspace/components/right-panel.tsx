/**
 * 右栏 — 查询历史面板或表信息面板。
 */

import type { JSX } from "react";
import { HistoryPanel } from "../../query-history/components/history-panel";
import { TableInfoPanel, type TableInfoSelection } from "./table-info-panel";
import { useWorkbench } from "../hooks/use-workbench";
import { buildQueryPrompt } from "../../../shared/ai/send-context";

interface RightPanelProps {
	historyVisible?: boolean;
	tableInfoSelection?: TableInfoSelection | null;
}

export function RightPanel({ historyVisible = false, tableInfoSelection = null }: RightPanelProps): JSX.Element {
	const {
		settings,
		history,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
	} = useWorkbench();
	
	function handleSendToAi(entry: typeof history[0]): void {
		const prompt = buildQueryPrompt(entry.connName, entry.sql);
		console.log("[RightPanel] 发送到 AI:", prompt);
	}
	
	// 如果显示了历史面板，则显示历史
	if (historyVisible) {
		return (
			<HistoryPanel
				entries={history}
				limit={settings.historyLimit}
				onLoad={loadHistoryIntoEditor}
				onRerun={(entry) => void rerunHistoryEntry(entry)}
				onDelete={(id) => void removeHistory(id)}
				onClear={() => void clearAllHistory()}
				onSendToAi={handleSendToAi}
			/>
		);
	}
	
	// 否则显示表信息面板（如果有选中表）
	if (tableInfoSelection) {
		return (
			<TableInfoPanel
				selection={tableInfoSelection}
				onClose={() => {
					// 关闭表信息面板
				}}
			/>
		);
	}
	
	// 默认显示空状态
	return (
		<div className="flex h-full items-center justify-center text-muted-foreground">
			<span className="text-[11px]">选择表查看详情</span>
		</div>
	);
}

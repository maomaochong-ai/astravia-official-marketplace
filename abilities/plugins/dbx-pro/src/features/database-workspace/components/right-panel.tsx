/**
 * 右栏 — 查询历史面板。
 * 表结构查看功能已迁移到查询网格顶部的"表属性"按钮。
 */

import type { JSX } from "react";
import { HistoryPanel } from "../../query-history/components/history-panel";
import { useWorkbench } from "../hooks/use-workbench";
import { buildQueryPrompt } from "../../../shared/ai/send-context";

export function RightPanel(): JSX.Element {
	const {
		settings,
		history,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
	} = useWorkbench();
	
	function handleSendToAi(entry: typeof history[0]): void {
		// TODO: 打开 AI 对话框并填充历史条目的 SQL
		const prompt = buildQueryPrompt(entry.connName, entry.sql);
		// 需要通过某种方式传递给 AI 对话框
		console.log("[RightPanel] 发送到 AI:", prompt);
	}
	
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
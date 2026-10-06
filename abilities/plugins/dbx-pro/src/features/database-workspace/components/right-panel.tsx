/**
 * 右栏 — 查询历史面板（唯一用途）。
 *
 * 由顶栏「查询历史」按钮控制开合；表属性在结果网格覆盖层中打开，不再占用右栏。
 */

import type { JSX } from "react";
import { HistoryPanel } from "../../query-history/components/history-panel";
import { useWorkbench } from "../hooks/use-workbench";
import { buildQueryPrompt } from "../../../shared/ai/send-context";
import { getConversation } from "../../../runtime-contract";

export function RightPanel(): JSX.Element {
	const {
		settings,
		history,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
	} = useWorkbench();

	function handleSendToAi(entry: { connName: string; sql: string }): void {
		// 填入宿主 AI 输入框，由用户确认后发送，避免误发。
		try {
			getConversation()?.insertText?.(buildQueryPrompt(entry.connName, entry.sql));
		} catch { /* 宿主会话不可用时静默忽略 */ }
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

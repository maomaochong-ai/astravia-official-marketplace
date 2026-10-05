/**
 * 右栏 — 查询历史面板。
 *
 * 表属性面板由查询网格内的覆盖层承载（结果工具栏"表属性"按钮），
 * 这里不再重复挂载，避免两套状态。
 */

import type { JSX } from "react";
import { HistoryPanel } from "../../query-history/components/history-panel";
import { useWorkbench } from "../hooks/use-workbench";
import { buildQueryPrompt } from "../../../shared/ai/send-context";
import { getConversation } from "../../../runtime-contract";

interface RightPanelProps {
	historyVisible?: boolean;
}

export function RightPanel({ historyVisible = false }: RightPanelProps): JSX.Element {
	const {
		settings,
		history,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
	} = useWorkbench();

	if (!historyVisible) {
		return (
			<div className="flex h-full items-center justify-center text-muted-foreground">
				<span className="text-[11px]">选择表查看详情</span>
			</div>
		);
	}

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

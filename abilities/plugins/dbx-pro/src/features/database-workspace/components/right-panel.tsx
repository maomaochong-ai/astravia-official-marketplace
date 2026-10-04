/**
 * 右栏 — 在表结构与查询历史之间切换。
 */

import type { JSX } from "react";
import { HistoryPanel } from "../../query-history/components/history-panel";
import { TableInspector } from "./table-inspector";
import { AiPanel } from "./ai-panel";
import { useWorkbench } from "../hooks/use-workbench";

export function RightPanel(): JSX.Element {
	const {
		settings,
		history,
		rightView,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
	} = useWorkbench();
	if (rightView === "ai") {
		return <AiPanel />;
	}
	if (rightView === "history") {
		return (
			<HistoryPanel
				entries={history}
				limit={settings.historyLimit}
				onLoad={loadHistoryIntoEditor}
				onRerun={(entry) => void rerunHistoryEntry(entry)}
				onDelete={(id) => void removeHistory(id)}
				onClear={() => void clearAllHistory()}
			/>
		);
	}
	return <TableInspector />;
}
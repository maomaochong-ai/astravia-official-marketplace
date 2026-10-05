/**
 * 右栏 — 查询历史面板。
 * 表结构查看功能已迁移到查询网格顶部的"表属性"按钮。
 */

import type { JSX } from "react";
import { HistoryPanel } from "../../query-history/components/history-panel";
import { useWorkbench } from "../hooks/use-workbench";

export function RightPanel(): JSX.Element {
	const {
		settings,
		history,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
	} = useWorkbench();
	
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
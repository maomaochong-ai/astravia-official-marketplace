/**
 * 右栏 — 历史 / AI 助手 切换面板。
 *
 * 原先是 HistoryPanel 独占，AI 助手以 overlay dialog 形式打开。
 * 现在统一收进右栏，通过顶栏按钮切换 view；SplitLayout 负责宽度。
 */

import type { JSX } from "react";
import { HistoryPanel } from "./history-panel";
import { useWorkbench } from "../hooks/use-workbench";
import { buildQueryPrompt } from "../../../shared/ai/send-context";
import { getConversation } from "../../../runtime-contract";
import { AiAssistantPanel } from "./ai-assistant-panel";

export type RightPanelView = "history" | "ai";

interface Props {
	view: RightPanelView;
	onCollapse: () => void;
	/** 切到另一视图 */
	onSwitchView: (v: RightPanelView) => void;
	/** AI 助手创建连接回调 */
	onCreateConnection: (config: {
		name: string;
		dbType: string;
		host: string;
		port: number;
		username: string;
		password: string;
		database?: string;
	}) => void;
}

export function RightPanel({ view, onCollapse, onSwitchView, onCreateConnection }: Props): JSX.Element {
	const {
		settings,
		history,
		loadHistoryIntoEditor,
		rerunHistoryEntry,
		removeHistory,
		clearAllHistory,
	} = useWorkbench();

	function handleSendToAi(entry: { connName: string; sql: string }): void {
		try {
			getConversation()?.insertText?.(buildQueryPrompt(entry.connName, entry.sql));
		} catch { /* 宿主会话不可用时静默忽略 */ }
	}

	const tabClass = (v: RightPanelView) =>
		`flex-1 cursor-pointer border-b-2 px-3 py-2 text-[12px] transition-colors ${
			view === v
				? "border-primary text-surface-foreground font-medium"
				: "border-transparent text-muted hover:text-surface-foreground"
		}`;

	return (
		<div className="flex h-full min-h-0 flex-col">
			{/* Tab bar — history / ai 切换 */}
			<div className="flex shrink-0 border-b border-border bg-surface-raised/60">
				<button type="button" className={tabClass("history")} onClick={() => onSwitchView("history")}>
					查询历史
				</button>
				<button type="button" className={tabClass("ai")} onClick={() => onSwitchView("ai")}>
					AI 助手
				</button>
				<button
					type="button"
					onClick={onCollapse}
					title="收起右栏"
					className="shrink-0 px-2 text-muted hover:text-surface-foreground"
				>
					<span className="icon-[lucide--panel-right-close] h-4 w-4" />
				</button>
			</div>

			{/* 视图内容区 — 独立滚动 */}
			<div className="min-h-0 flex-1 overflow-hidden">
				{view === "history" ? (
					<HistoryPanel
						entries={history}
						limit={settings.historyLimit}
						onLoad={loadHistoryIntoEditor}
						onRerun={(entry) => void rerunHistoryEntry(entry)}
						onDelete={(id) => void removeHistory(id)}
						onClear={() => void clearAllHistory()}
						onSendToAi={handleSendToAi}
						onCollapse={onCollapse}
					/>
				) : (
					<AiAssistantPanel
						onClose={onCollapse}
						onCreateConnection={onCreateConnection}
					/>
				)}
			</div>
		</div>
	);
}

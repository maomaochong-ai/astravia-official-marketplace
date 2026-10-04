/**
 * 数据库工作台 — 插件主面板的装配入口。
 *
 * 这里只做三件事：挂 Provider、按三栏布局摆放子面板、控制两个抽屉的开合。
 * 所有交互状态都在 hooks/，所有面板组件都在 ./components/。
 */

import { useState, useEffect, type JSX } from "react";
import { ConnectionTree } from "./connection-tree";
import { ConnectionEditorSheet } from "./connection-editor-sheet";
import { RightPanel } from "./right-panel";
import { SettingsPanel } from "./settings-panel";
import { SplitLayout } from "./split-layout";
import { SqlEditorWorkspace } from "./sql-editor-workspace";
import { WorkbenchProvider, useWorkbench } from "../hooks/use-workbench";
import { WorkbenchTopBar } from "./workbench-top-bar";
import { DEFAULT_SETTINGS } from "../../../domain/workbench-settings";

export function DatabaseWorkspace(): JSX.Element {
	return (
		<WorkbenchProvider>
			<DatabaseWorkspaceBody />
		</WorkbenchProvider>
	);
}

function DatabaseWorkspaceBody(): JSX.Element {
	const [connectionEditorOpen, setConnectionEditorOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [leftCollapsed, setLeftCollapsed] = useState(false);
	const [rightPanelVisible, setRightPanelVisible] = useState(true);
	const [fullscreen, setFullscreen] = useState(false);
	const { settings, updateSettings, clearAllHistory, wipeAllData, refreshConnections, dispatch, state, rightView, setRightView } = useWorkbench();

	useEffect(() => {
		if ((rightView === "ai" || rightView === "history") && !rightPanelVisible) {
			setRightPanelVisible(true);
		}
	}, [rightView, rightPanelVisible]);

	function newQueryTab() {
		const id = `tab-${Date.now().toString(36)}`;
		const maxIdx = state.tabs.reduce((max, t) => {
			const m = t.label.match(/^查询 (\d+)/);
			return m ? Math.max(max, Number(m[1])) : max;
		}, 0);
		dispatch({
			type: "addTab",
			tab: { id, label: `查询 ${maxIdx + 1}`, connectionName: state.activeConnectionName, sql: "", isRunning: false },
		});
	}

	return (
		<div
			className={`dbx-root relative flex h-full w-full min-h-0 flex-col bg-background text-foreground ${fullscreen ? "fixed inset-0 z-50" : ""}`}
		>
			<WorkbenchTopBar
				onOpenConnectionEditor={() => setConnectionEditorOpen(true)}
				onOpenSettings={() => setSettingsOpen(true)}
				onNewQuery={newQueryTab}
				onToggleAiPanel={() => {
					if (rightView === "ai") setRightView("inspector");
					else { setRightView("ai"); setRightPanelVisible(true); }
				}}
				aiPanelActive={rightView === "ai"}
				rightPanelVisible={rightPanelVisible}
				onToggleRightPanel={() => setRightPanelVisible((v) => !v)}
				fullscreen={fullscreen}
				onToggleFullscreen={() => setFullscreen((v) => !v)}
			/>
			<SplitLayout
				leftCollapsed={leftCollapsed}
				rightCollapsed={!rightPanelVisible}
				onToggleLeft={() => setLeftCollapsed((v) => !v)}
			>
				{[
					<ConnectionTree key="left" onCollapse={() => setLeftCollapsed(true)} onNewQuery={newQueryTab} />,
					<SqlEditorWorkspace key="mid" />,
					<RightPanel key="right" />,
				]}
			</SplitLayout>

			{connectionEditorOpen && (
				<ConnectionEditorSheet
					onChange={() => { void refreshConnections(); }}
					onCancel={() => setConnectionEditorOpen(false)}
				/>
			)}

			{settingsOpen && (
				<SettingsPanel
					settings={settings}
					onChange={(next) => void updateSettings(next)}
					onReset={() => void updateSettings({ ...DEFAULT_SETTINGS })}
					onClearHistory={() => void clearAllHistory()}
					onClose={() => setSettingsOpen(false)}
					onWipeData={() => {
						setSettingsOpen(false);
						void wipeAllData();
					}}
				/>
			)}
		</div>
	);
}
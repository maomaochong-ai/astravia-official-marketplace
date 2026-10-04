/**
 * 数据库工作台 — 插件主面板的装配入口。
 *
 * 这里只做三件事：挂 Provider、按三栏布局摆放子面板、控制两个抽屉的开合。
 * 所有交互状态都在 hooks/，所有面板组件都在 ./components/。
 */

import { useState, useEffect, useRef, type JSX } from "react";
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
	const workspaceRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (rightView === "history" && !rightPanelVisible) {
			setRightPanelVisible(true);
		}
	}, [rightView, rightPanelVisible]);

	useEffect(() => {
		function onFullscreenChange() {
			if (!document.fullscreenElement && fullscreen) {
				setFullscreen(false);
			}
		}
		document.addEventListener("fullscreenchange", onFullscreenChange);
		return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
	}, [fullscreen]);

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

	async function toggleFullscreen() {
		if (fullscreen) {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			}
			setFullscreen(false);
		} else {
			const el = workspaceRef.current;
			if (el?.requestFullscreen) {
				try {
					await el.requestFullscreen();
					setFullscreen(true);
				} catch {
					// Fullscreen API 不可用（如插件沙箱），回退 CSS 方案
					setFullscreen(true);
				}
			} else {
				setFullscreen(true);
			}
		}
	}

	return (
		<div
			ref={workspaceRef}
			className={`dbx-root relative flex h-full w-full min-h-0 flex-col bg-background text-foreground ${fullscreen ? "!fixed !inset-0 !z-[9999]" : ""}`}
		>
			<WorkbenchTopBar
				onOpenConnectionEditor={() => setConnectionEditorOpen(true)}
				onOpenSettings={() => setSettingsOpen(true)}
				onNewQuery={newQueryTab}
				rightPanelVisible={rightPanelVisible}
				onToggleRightPanel={() => setRightPanelVisible((v) => !v)}
				fullscreen={fullscreen}
				onToggleFullscreen={() => void toggleFullscreen()}
			/>
			<SplitLayout
				leftCollapsed={leftCollapsed}
				rightCollapsed={!rightPanelVisible}
				onToggleLeft={() => setLeftCollapsed((v) => !v)}
			>
				{[
					<ConnectionTree key="left" onCollapse={() => setLeftCollapsed(true)} />,
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
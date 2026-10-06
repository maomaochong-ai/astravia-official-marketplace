/**
 * 数据库工作台 — 插件主面板的装配入口。
 *
 * 这里只做三件事：挂 Provider、按三栏布局摆放子面板、控制两个抽屉的开合。
 * 所有交互状态都在 hooks/，所有面板组件都在 ./components/。
 */

import { useState, useEffect, useRef, type JSX } from "react";
import { ConnectionTree } from "./connection-tree";
import { ConnectionEditorSheet } from "./connection-editor-sheet";
import { AiAssistantPanel } from "./ai-assistant-panel";
import { RightPanel } from "./right-panel";
import { SettingsPanel } from "./settings-panel";
import { SplitLayout } from "./split-layout";
import { SqlEditorWorkspace } from "./sql-editor-workspace";
import { VisualizationPreview } from "../../visualization/components/visualization-preview";
import { WorkbenchProvider, useWorkbench } from "../hooks/use-workbench";
import { WorkbenchTopBar } from "./workbench-top-bar";
import { DEFAULT_SETTINGS } from "../../../domain/workbench-settings";
import { readSession, writeSession } from "../../../domain/workbench-session";
import { engineAddConnection } from "../../../shared/services/engine-client";
import { writeConfig } from "../../../domain/dbx-storage";
import { setPreviewCallback, type Visualization } from "../../visualization/visualization-bridge";

export function DatabaseWorkspace(): JSX.Element {
	return (
		<WorkbenchProvider>
			<DatabaseWorkspaceBody />
		</WorkbenchProvider>
	);
}

function DatabaseWorkspaceBody(): JSX.Element {
	const [connectionEditorOpen, setConnectionEditorOpen] = useState(false);
	const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [leftCollapsed, setLeftCollapsed] = useState(false);
	// 右栏只承载查询历史，默认收起。
	const [historyOpen, setHistoryOpen] = useState(false);
	const [fullscreen, setFullscreen] = useState(false);
	const [previewViz, setPreviewViz] = useState<Visualization | null>(null);
	const { settings, updateSettings, clearAllHistory, wipeAllData, refreshConnections, invalidateConnection, dispatch, state } = useWorkbench();
	const workspaceRef = useRef<HTMLDivElement>(null);

	// 注册可视化预览回调
	useEffect(() => {
		setPreviewCallback((viz) => {
			setPreviewViz(viz);
		});
		return () => {
			setPreviewCallback(null);
		};
	}, []);

	useEffect(() => {
		function onFullscreenChange() {
			if (!document.fullscreenElement && fullscreen) {
				setFullscreen(false);
			}
		}
		document.addEventListener("fullscreenchange", onFullscreenChange);
		return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
	}, [fullscreen]);

	// 恢复上次左栏折叠态（右栏历史为瞬时开关，不持久化展开态）。
	useEffect(() => {
		let alive = true;
		void readSession().then((s) => {
			if (!alive || !s) return;
			if (typeof s.leftCollapsed === "boolean") setLeftCollapsed(s.leftCollapsed);
		}).catch(() => { /* ignore */ });
		return () => { alive = false; };
	}, []);

	// 左栏折叠态变化时并入会话。
	useEffect(() => {
		void (async () => {
			const cur = (await readSession().catch(() => null)) ?? {
				activeConnectionName: null, activeTabId: null, tabs: [], expandedNodes: [],
			};
			await writeSession({ ...cur, leftCollapsed }).catch(() => { /* ignore */ });
		})();
	}, [leftCollapsed]);

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

	/** 切换查询历史右栏 */
	function toggleHistoryPanel(): void {
		setHistoryOpen((v) => !v);
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
			data-astravia-plugin-root="dbx-pro"
			className={`dbx-root relative flex h-full w-full min-h-0 flex-col bg-background text-foreground ${fullscreen ? "!fixed !inset-0 !z-[9999]" : ""}`}
		>
			<WorkbenchTopBar
				onOpenConnectionEditor={() => setConnectionEditorOpen(true)}
				onOpenSettings={() => setSettingsOpen(true)}
				onOpenAiAssistant={() => setAiAssistantOpen(true)}
				onNewQuery={newQueryTab}
				onToggleHistory={toggleHistoryPanel}
				historyOpen={historyOpen}
				fullscreen={fullscreen}
				onToggleFullscreen={() => void toggleFullscreen()}
			/>
			<SplitLayout
				leftCollapsed={leftCollapsed}
				rightCollapsed={!historyOpen}
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
					onChange={async (name) => {
						await refreshConnections();
						if (name) invalidateConnection(name);
					}}
					onCancel={() => setConnectionEditorOpen(false)}
				/>
			)}

			{aiAssistantOpen && (
				<AiAssistantPanel
					onClose={() => setAiAssistantOpen(false)}
					onCreateConnection={async (config) => {
						try {
							await engineAddConnection({
								name: config.name,
								dbType: config.dbType,
								host: config.host,
								port: config.port,
								username: config.username,
								password: config.password,
								database: config.database,
							});
							// 保存到本地存储
							await writeConfig({
								id: `conn-${Date.now()}`,
								name: config.name,
								db_type: config.dbType,
								host: config.host,
								port: config.port,
								username: config.username,
								password: config.password,
								database: config.database,
								schemas: [],
							});
							await refreshConnections();
						} catch (err) {
							console.error("[AI Assistant] 创建连接失败:", err);
						}
					}}
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

			{previewViz && (
				<VisualizationPreview
					html={previewViz.html}
					title={previewViz.title}
					type={previewViz.type}
					onClose={() => setPreviewViz(null)}
				/>
			)}
		</div>
	);
}
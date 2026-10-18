/**
 * 数据库工作台 — 插件主面板的装配入口。
 *
 * 这里只做两件事：按布局摆放子面板（三栏 + 底部「下载后台」货架），并控制各抽屉的开合。
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
import { WorkbenchProvider, useWorkbench } from "../hooks/use-workbench";
import { WorkbenchTopBar } from "./workbench-top-bar";
import { DriverManagerPage } from "./driver-manager-page";
import { ExportTasksShelf } from "./export-tasks-shelf";
import { DEFAULT_SETTINGS } from "../../../domain/workbench-settings";
import { patchSession, readSession } from "../../../domain/workbench-session";
import { engineAddConnection } from "../../../shared/services/engine-client";
import { writeConfig } from "../../../domain/dbx-storage";
import { THREE_PANE_MIN } from "../services/split-widths";
import { DRIVER_TAB_ID, GALLERY_TAB_ID, nextQueryLabel, nextTabId } from "../state/tab-ids";
import { getUi } from "../../../runtime-contract";
import { PLUGIN_VERSION } from "../../../domain/plugin-version";
import { useDetectedTheme } from "../../../shared/hooks/use-detected-theme";
import { useElementWidth } from "../../../shared/hooks/use-element-width";
import { applyPluginTheme } from "../../../shared/theme/plugin-theme";

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
	const [rightPanelView, setRightPanelView] = useState<"history" | "ai">("history");
	const [settingsOpen, setSettingsOpen] = useState(false);
	const [leftCollapsed, setLeftCollapsed] = useState(false);
	/** 会话恢复完成前不写盘：初始值写回去会覆盖磁盘上的真实折叠态。 */
	const [sessionHydrated, setSessionHydrated] = useState(false);
	// 右栏只承载查询历史，默认收起。
	const [historyOpen, setHistoryOpen] = useState(false);
	/** compact（容器装不下三栏）下左栏是抽屉，默认收起 */
	const [treeOverlayOpen, setTreeOverlayOpen] = useState(false);
	const [fullscreen, setFullscreen] = useState(false);
	/** 全屏模式：native = 浏览器 requestFullscreen；css = 插件沙箱 fallback */
	const [fullscreenMode, setFullscreenMode] = useState<"native" | "css">("native");
	// 底部「下载后台」货架默认收起，由顶栏下载入口开合（任务进度在顶栏环上已有反馈）。
	const [downloadsOpen, setDownloadsOpen] = useState(false);
	const { settings, updateSettings, clearAllHistory, wipeAllData, refreshConnections, invalidateConnection, dispatch, state } = useWorkbench();
	const workspaceRef = useRef<HTMLDivElement>(null);
	const theme = useDetectedTheme();
	// 宿主活动面板宽度可拖到 260px；三栏策略只在容器够宽时成立，判据必须是实测宽度。
	const rootWidth = useElementWidth(workspaceRef);
	const compact = rootWidth > 0 && rootWidth < THREE_PANE_MIN;

	// 容器变宽回到三栏后抽屉没意义，关掉避免下次变窄时残留展开态。
	useEffect(() => {
		if (!compact) setTreeOverlayOpen(false);
	}, [compact]);

	// 首屏加载完成 → 向宿主发送友好的成功通知（重载后确认 UI 渲染成功的第一手信号）
	useEffect(() => {
		try {
			getUi()?.notify({
				message: `dbx-pro v${PLUGIN_VERSION} 已就绪`,
				variant: "success",
			});
		} catch { /* 宿主不支持 notify 或运行时未就绪时静默忽略 */ }
	}, []);

	// 把主题写到插件根属性上（本元素就是插件根之一）。宿主切主题由
	// initPluginTheme 的 observer 同步；这里补的是面板后挂载的情况。
	useEffect(() => {
		applyPluginTheme();
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
			if (!alive) return;
			if (s && typeof s.leftCollapsed === "boolean") setLeftCollapsed(s.leftCollapsed);
		}).catch(() => { /* ignore */ }).finally(() => {
			if (alive) setSessionHydrated(true);
		});
		return () => { alive = false; };
	}, []);

	// 左栏折叠态变化时并入会话。只提交本写入方维护的字段：整份覆盖会抹掉
	// tab 自动保存与三栏宽度写入的结果。
	useEffect(() => {
		if (!sessionHydrated) return;
		void patchSession({ leftCollapsed }).catch(() => { /* ignore */ });
	}, [sessionHydrated, leftCollapsed]);

	function newQueryTab() {
		const id = nextTabId();
		dispatch({
			type: "addTab",
			tab: { id, label: nextQueryLabel(state.tabs), connectionName: state.activeConnectionName, sql: "", isRunning: false },
		});
	}

	/**
	 * 打开可视化产物画廊：作为插件内部标签页（与「新建查询」同栏），
	 * 已存在则激活，避免重复打开。绝不用 fixed/独立窗口遮挡宿主。
	 */
	function openGalleryTab(): void {
		const existing = state.tabs.find((t) => t.gallery === true);
		if (existing) {
			dispatch({ type: "setActiveTab", id: existing.id });
			return;
		}
		dispatch({
			type: "addTab",
			tab: {
				id: GALLERY_TAB_ID,
				label: "可视化产物",
				connectionName: null,
				sql: "",
				isRunning: false,
				gallery: true,
			},
		});
	}

	function openDriverTab(): void {
		const existing = state.tabs.find((t) => t.driver === true);
		if (existing) {
			dispatch({ type: "setActiveTab", id: existing.id });
			return;
		}
		dispatch({
			type: "addTab",
			tab: {
				id: DRIVER_TAB_ID,
				label: "驱动管理",
				connectionName: null,
				sql: "",
				isRunning: false,
				driver: true,
			},
		});
	}

	/** 切换查询历史右栏（打开并切到 history 视图） */
	function toggleHistoryPanel(): void {
		const open = !historyOpen && !aiAssistantOpen ? true : (historyOpen ? false : true);
		setHistoryOpen(open);
		setAiAssistantOpen(false);
		if (open) setRightPanelView("history");
	}

	/** 打开 AI 助手右栏（与历史面板共享同一容器） */
	function openAiAssistantPanel(): void {
		setRightPanelView("ai");
		setAiAssistantOpen(true);
		setHistoryOpen(true); // 让 SplitLayout 右栏保持展开
	}

	/** 右栏整体关闭（history 或 ai 任一打开时都收） */
	function collapseRightPanel(): void {
		setHistoryOpen(false);
		setAiAssistantOpen(false);
	}

	/** AI 助手创建连接回调 — 原 dialog 内联逻辑提升到顶层供 RightPanel 复用 */
	async function handleCreateAiConnection(config: {
		name: string; dbType: string; host: string; port: number;
		username: string; password: string; database?: string;
	}): Promise<void> {
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
	}

	async function toggleFullscreen() {
		if (fullscreen) {
			if (fullscreenMode === "native" && document.fullscreenElement) {
				await document.exitFullscreen();
			}
			setFullscreen(false);
		} else {
			const el = workspaceRef.current;
			if (el?.requestFullscreen) {
				try {
					await el.requestFullscreen();
					setFullscreenMode("native");
					setFullscreen(true);
				} catch {
					// Fullscreen API 不可用（如插件沙箱），回退 CSS 方案
					setFullscreenMode("css");
					setFullscreen(true);
				}
			} else {
				setFullscreenMode("css");
				setFullscreen(true);
			}
		}
	}

	return (
		<div
			ref={workspaceRef}
			data-astravia-plugin-root="dbx-pro"
			data-dbx-theme={theme}
			className={`dbx-root relative flex h-full w-full min-h-0 flex-col bg-background text-foreground ${fullscreen && fullscreenMode === "css" ? "!absolute !inset-0 !z-[9999]" : ""}`}
		>
			<WorkbenchTopBar
				onOpenConnectionEditor={() => setConnectionEditorOpen(true)}
				onOpenSettings={() => setSettingsOpen(true)}
				onOpenAiAssistant={openAiAssistantPanel}
				onOpenDriverManager={openDriverTab}
				onNewQuery={newQueryTab}
				onToggleHistory={toggleHistoryPanel}
				historyOpen={historyOpen || aiAssistantOpen}
				onOpenVisualizationGallery={openGalleryTab}
				visualizationCount={0}
				fullscreen={fullscreen}
				onToggleFullscreen={() => void toggleFullscreen()}
				downloadsOpen={downloadsOpen}
				onToggleDownloads={() => setDownloadsOpen((v) => !v)}
				compact={compact}
				onToggleConnections={compact ? () => setTreeOverlayOpen((v) => !v) : undefined}
				connectionsOpen={compact && treeOverlayOpen}
			/>
			<SplitLayout
				leftCollapsed={leftCollapsed}
				rightCollapsed={!(historyOpen || aiAssistantOpen)}
				onToggleLeft={() => setLeftCollapsed((v) => !v)}
				compact={compact}
				leftOverlayOpen={compact && treeOverlayOpen}
				onCloseLeftOverlay={() => setTreeOverlayOpen(false)}
				rightOverlayOpen={compact && (historyOpen || aiAssistantOpen)}
				onCloseRightOverlay={collapseRightPanel}
			>
				{[
					<ConnectionTree
						key="left"
						onCollapse={() => (compact ? setTreeOverlayOpen(false) : setLeftCollapsed(true))}
					/>,
					// 中间面板按 activeTab 类型切换：driver → DriverManagerPage，其余 → SqlEditorWorkspace
					(() => {
						const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
						if (activeTab?.driver) {
							return <DriverManagerPage key="mid" />;
						}
						return <SqlEditorWorkspace key="mid" />;
					})(),
					<RightPanel
						key="right"
						view={rightPanelView}
						onSwitchView={(v) => { setRightPanelView(v); setHistoryOpen(true); setAiAssistantOpen(true); }}
						onCollapse={collapseRightPanel}
						onCreateConnection={handleCreateAiConnection}
					/>,
				]}
			</SplitLayout>

			{/* 下载后台按设计稿通栏停靠在整块工作台底部（与三栏同级，不缩在中间栏内） */}
			{downloadsOpen && <ExportTasksShelf onCollapse={() => setDownloadsOpen(false)} />}

			{connectionEditorOpen && (
				<ConnectionEditorSheet
					onChange={async (name) => {
						await refreshConnections();
						if (name) invalidateConnection(name);
					}}
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
/**
 * 工作台顶栏 — 左：新建连接 / 新建查询 / AI 协助；右：查询历史 / 设置 / 全屏。
 *
 * 右栏只承载查询历史，「查询历史」按钮即右栏的唯一开关。
 * 表详情由查询网格工具栏的"表属性"按钮在结果区覆盖层中打开，不占独立栏位。
 */

import { useEffect, useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import { ExportTasksPopover } from "./export-tasks-popover";
import { engineHealth, ENGINE_NOT_READY } from "../../../shared/services/engine-client";

export interface WorkbenchTopBarProps {
	onOpenConnectionEditor: () => void;
	onOpenSettings: () => void;
	onOpenAiAssistant: () => void;
	onNewQuery: () => void;
	/** 切换查询历史右栏 */
	onToggleHistory: () => void;
	historyOpen: boolean;
	/** 打开可视化产物管理 */
	onOpenVisualizationGallery: () => void;
	visualizationCount: number;
	fullscreen: boolean;
	onToggleFullscreen: () => void;
}

export function WorkbenchTopBar({
	onOpenConnectionEditor,
	onOpenSettings,
	onOpenAiAssistant,
	onNewQuery,
	onToggleHistory,
	historyOpen,
	onOpenVisualizationGallery,
	visualizationCount,
	fullscreen,
	onToggleFullscreen,
}: WorkbenchTopBarProps): JSX.Element {
	const { history } = useWorkbench();
	// 引擎健康：unknown=未查询 / ready=绿 / starting=黄 / error=红
	const [engineState, setEngineState] = useState<"unknown" | "ready" | "starting" | "error">("unknown");

	// 组件挂载时查询一次引擎健康；失败指数退避（3次连续失败 → 停止轮询）
	useEffect(() => {
		let alive = true;
		let consecutiveFail = 0;
		let delay = 30_000; // 初始 30s
		let timer: ReturnType<typeof setTimeout> | null = null;

		const poll = async () => {
			if (!alive) return;
			try {
				await engineHealth();
				if (!alive) return;
				setEngineState("ready");
				consecutiveFail = 0; // 成功重置退避
				delay = 30_000;
			} catch (e) {
				if (!alive) return;
				const code = (e as { code?: string })?.code;
				if (code === ENGINE_NOT_READY) {
					setEngineState("starting");
				} else {
					setEngineState("error");
					consecutiveFail++;
					delay = Math.min(delay * 2, 5 * 60_000); // 指数退避：30s→60s→120s... 上限 5min
					// 连续 3 次硬失败后停止轮询（引擎可能被关闭，别无限 hammer）
					if (consecutiveFail >= 3) {
						return;
					}
				}
			}
			timer = setTimeout(poll, delay);
		};
		void poll();
		return () => {
			alive = false;
			if (timer) clearTimeout(timer);
		};
	}, []);

	// 引擎健康文案与指示点：对齐设计稿「状态点 + 12px 说明文字」
	const ENGINE_STATUS: Record<typeof engineState, { text: string; dot: string }> = {
		ready: { text: "引擎就绪", dot: "dbx-status-dot--ok" },
		starting: { text: "引擎启动中…", dot: "dbx-status-dot--warn animate-pulse" },
		error: { text: "引擎异常", dot: "dbx-status-dot--danger" },
		unknown: { text: "检测引擎中…", dot: "" },
	};
	const engine = ENGINE_STATUS[engineState];

	return (
		<header className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-surface-raised px-2">
			{/* 左：新建连接 / 新建查询 / AI 协助（对齐设计稿的标签化按钮） */}
			<button type="button" onClick={onOpenConnectionEditor} className="dbx-btn" title="新建连接">
				<span className="icon-[lucide--plus] h-3.5 w-3.5" />
				新建连接
			</button>
			<button type="button" onClick={onNewQuery} className="dbx-btn ghost" title="新建查询">
				<span className="icon-[lucide--square-pen] h-3.5 w-3.5" />
				新建查询
			</button>
			<button type="button" onClick={onOpenAiAssistant} className="dbx-btn ai" title="让 AI 协助连接数据库">
				<span className="icon-[lucide--sparkles] h-3.5 w-3.5" />
				AI 协助
			</button>

			<span className="mx-2 h-4 w-px shrink-0 bg-border" />

			{/* 引擎健康指示 —— 插件重载/引擎启动的第一手反馈；版本号在「设置 → 关于」查看 */}
			<span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
				<span className={"dbx-status-dot " + engine.dot} title={engine.text} />
				<span className="text-[12px] whitespace-nowrap text-muted">{engine.text}</span>
			</span>

			{/* 右：后台任务 / 查询历史 / BI 数据资产 / 设置 / 全屏。
			 * 设计稿的「工作台」导航项在本插件里没有对应目标（工作台就是本界面），故不再放一个空按钮。 */}
			<div className="ml-auto flex shrink-0 items-center gap-0.5">
				<ExportTasksPopover />
				<button
					type="button"
					onClick={onToggleHistory}
					title="查询历史（在右栏查看）"
					aria-expanded={historyOpen}
					className={"dbx-nav-item" + (historyOpen ? " is-active" : "")}
				>
					<span className="icon-[lucide--history] h-3.5 w-3.5" />
					查询历史
					{history.length > 0 && <span className="dbx-count-badge">{history.length}</span>}
				</button>
				<button
					type="button"
					onClick={onOpenVisualizationGallery}
					title="BI 数据资产（看板/大屏）"
					className="dbx-nav-item"
				>
					<span className="icon-[lucide--layout-dashboard] h-3.5 w-3.5" />
					BI 数据资产
					{visualizationCount > 0 && <span className="dbx-count-badge">{visualizationCount}</span>}
				</button>
				<button
					type="button"
					onClick={() => onOpenSettings()}
					title="工作台设置"
					className="dbx-nav-item"
				>
					<span className="icon-[lucide--settings-2] h-3.5 w-3.5" />
					设置
				</button>
				<button
					type="button"
					onClick={onToggleFullscreen}
					title={fullscreen ? "退出全屏" : "全屏"}
					className="dbx-icon-btn ml-0.5"
				>
					<span className={"h-3.5 w-3.5 " + (fullscreen ? "icon-[lucide--minimize-2]" : "icon-[lucide--maximize-2]")} />
				</button>
			</div>
		</header>
	);
}

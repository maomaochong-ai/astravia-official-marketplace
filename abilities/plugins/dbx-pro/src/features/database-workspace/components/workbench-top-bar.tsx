/**
 * 工作台顶栏 — 左：新建连接 / 新建查询 / AI 协助；右：查询历史 / 设置 / 全屏。
 *
 * 右栏只承载查询历史，「查询历史」按钮即右栏的唯一开关。
 * 表详情由查询网格工具栏的"表属性"按钮在结果区覆盖层中打开，不占独立栏位。
 */

import { useEffect, useState, type JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import { ExportTasksPopover } from "./export-tasks-popover";
import { PLUGIN_VERSION } from "../../../domain/plugin-version";
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

	return (
		<header className="dbx-chrome flex h-9 shrink-0 items-center gap-2 px-3">
			{/* 左：新建连接 / 新建查询 / AI 协助 */}
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={onOpenConnectionEditor}
					title="新建连接"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--plus] h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onNewQuery}
					title="新建查询"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--file-plus-2] h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onOpenAiAssistant}
					title="让 AI 协助连接数据库"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--sparkles] h-3.5 w-3.5" />
				</button>
			</div>

			<span className="flex-1" />

			{/* 版本号 + 引擎健康指示 —— 插件重载/引擎启动的第一手反馈 */}
			<div className="flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2 py-0.5 text-[10px] text-muted-foreground">
				<span
					className={`inline-block h-1.5 w-1.5 rounded-full ${
						engineState === "ready" ? "bg-emerald-500" :
						engineState === "starting" ? "bg-amber-500 animate-pulse" :
						engineState === "error" ? "bg-red-500" :
						"bg-slate-400"
					}`}
					title={
						engineState === "ready" ? "引擎就绪" :
						engineState === "starting" ? "引擎启动中…" :
						engineState === "error" ? "引擎异常" :
						"检测引擎中…"
					}
				/>
				<span className="font-mono tracking-tight">v{PLUGIN_VERSION}</span>
			</div>

			{/* 右：后台任务 / 查询历史 / 可视化产物 / 设置 / 全屏 */}
			<div className="flex shrink-0 items-center gap-1">
				<ExportTasksPopover />
				<button
					type="button"
					onClick={onToggleHistory}
					title="查询历史（在右栏查看）"
					aria-expanded={historyOpen}
					className={`dbx-iconbtn ${historyOpen ? "is-active" : ""}`}
				>
					<span className="icon-[lucide--history] h-3.5 w-3.5" />
					{history.length > 0 && <span className="ml-0.5 text-[10px]">{history.length}</span>}
				</button>
				<button
					type="button"
					onClick={onOpenVisualizationGallery}
					title="BI 数据资产（看板/大屏）"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--chart-bar] h-3.5 w-3.5" />
					{visualizationCount > 0 && <span className="ml-0.5 text-[10px]">{visualizationCount}</span>}
				</button>
				<button
					type="button"
					onClick={() => onOpenSettings()}
					title="工作台设置"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--settings] h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={onToggleFullscreen}
					title={fullscreen ? "退出全屏" : "全屏"}
					className="dbx-iconbtn"
				>
					<span className={`h-3.5 w-3.5 ${fullscreen ? "icon-[lucide--minimize-2]" : "icon-[lucide--maximize-2]"}`} />
				</button>
			</div>
		</header>
	);
}

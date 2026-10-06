/**
 * 工作台顶栏 — 左：新建连接 / 新建查询 / AI 协助；右：查询历史 / 设置 / 全屏。
 *
 * 右栏只承载查询历史，「查询历史」按钮即右栏的唯一开关。
 * 表详情由查询网格工具栏的"表属性"按钮在结果区覆盖层中打开，不占独立栏位。
 */

import type { JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";
import { ExportTasksPopover } from "./export-tasks-popover";

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
					title="可视化产物（看板/大屏）"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--layout-dashboard] h-3.5 w-3.5" />
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

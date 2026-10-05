/**
 * 工作台顶栏 — 左：新建连接 / 新建查询；右：历史 / 刷新 / 设置 / 全屏。
 *
 * 参考 dbx 桌面壳：不展示「dbx-pro + 当前连接」静态信息，中间交互靠图标。
 * 表详情功能已迁移到查询网格顶部工具栏的"表属性"按钮，此处不再重复。
 */

import type { JSX } from "react";
import { useWorkbench } from "../hooks/use-workbench";

export interface WorkbenchTopBarProps {
	onOpenConnectionEditor: () => void;
	onOpenSettings: () => void;
	onNewQuery: () => void;
	/** 切换右栏显示/隐藏 */
	onToggleRightPanel: () => void;
	rightPanelVisible: boolean;
	fullscreen: boolean;
	onToggleFullscreen: () => void;
}

export function WorkbenchTopBar({
	onOpenConnectionEditor,
	onOpenSettings,
	onNewQuery,
	onToggleRightPanel,
	rightPanelVisible,
	fullscreen,
	onToggleFullscreen,
}: WorkbenchTopBarProps): JSX.Element {
	const { refreshConnections, history } = useWorkbench();

	return (
		<header className="dbx-chrome flex h-9 shrink-0 items-center gap-2 px-3">
			{/* 左：新建连接 / 新建查询（纯图标，跟其它工具保持统一） */}
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
			</div>

			<span className="flex-1" />

			{/* 右：工具按钮（统一中性图标按钮） */}
			<div className="flex shrink-0 items-center gap-1">
				<button
					type="button"
					onClick={onToggleRightPanel}
					title={rightPanelVisible ? "隐藏右栏" : "显示右栏"}
					aria-expanded={rightPanelVisible}
					className={`dbx-iconbtn ${rightPanelVisible ? "is-active" : ""}`}
				>
					<span className="icon-[lucide--panel-right] h-3.5 w-3.5" />
				</button>
				<button
					type="button"
					onClick={() => { void refreshConnections(); }}
					title="刷新连接"
					className="dbx-iconbtn"
				>
					<span className="icon-[lucide--refresh-cw] h-3.5 w-3.5" />
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

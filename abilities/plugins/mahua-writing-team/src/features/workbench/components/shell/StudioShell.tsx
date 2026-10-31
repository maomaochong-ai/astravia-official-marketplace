import type { ReactNode } from "react";
import { StudioRail, type StudioRailProps } from "./StudioRail";
import { SyncBar } from "./SyncBar";
import { WindowChrome } from "./WindowChrome";
import type { WorkbenchPage } from "../../workbench-pages";

/**
 * 宿主窗口外壳：窗口栏 + 同步带 + 窄栏 + 一张圆角纸面。
 *
 * 面板之间靠 canvas 底透出来分隔，不用通栏的直角边框：主区是一张浮在 canvas 上的圆角纸，
 * 四周留出 12px 的托底。`bare` 时窄栏收起——运行台与激活页自己就是整张纸。
 * 高度一律 `h-full`（宿主面板给多高就用多高），不用 `h-screen`，那不是插件该占的东西。
 */
export function StudioShell({
	crumb,
	active,
	right,
	bare = false,
	sync,
	rail,
	children,
}: {
	crumb: string;
	active?: WorkbenchPage;
	right?: ReactNode;
	bare?: boolean;
	sync?: React.ComponentProps<typeof SyncBar>;
	rail?: StudioRailProps;
	children: ReactNode;
}) {
	return (
		<div className="flex h-full w-full flex-col bg-canvas font-sans text-ink antialiased">
			<WindowChrome crumb={crumb} right={right} />
			{sync !== undefined ? <SyncBar {...sync} /> : null}
			<div className="flex min-h-0 flex-1 gap-2 pl-2 pr-3 pb-3">
				{!bare && rail ? <StudioRail {...rail} active={active} /> : null}
				<main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-sheet bg-surface shadow-raise">
					{children}
				</main>
			</div>
		</div>
	);
}

import { useTranslator } from "../../hooks/use-translator";
import type { WorkbenchPage } from "../../workbench-pages";
import { pageTitleKey } from "../../workbench-pages";
import { StudioMasthead, type MastheadSync } from "./StudioMasthead";
import { StudioRail, type StudioRailProps } from "./StudioRail";

/**
 * 外壳：一条报头 + 一条纵向窄栏 + 一张圆角纸面。
 *
 * 从上到下只有这三层，每一层都贴到底：报头 `shrink-0`，窄栏与纸面同高，纸面自己
 * `overflow-hidden`。整页不滚动——滚动的永远是纸面内部某一张列表。这既是设计稿的
 * 版面纪律，也是宿主面板的硬约束：面板的高度由窗口决定，页面一旦自己长高，用户就
 * 得在两层滚动条之间来回找。
 *
 * 纸面与窄栏之间靠 canvas 底透出来分隔，不再用通栏直角边框：主区是一张浮在 canvas
 * 上的圆角纸，四周留 12px 托底。
 *
 * 窄到 640px 以下（活动面板拖到最小）时，托底的 12px 四周留白收成 8px、纸面圆角收小一档：
 * 宽度已经很紧，再留一圈装饰性空边，正文就只剩几行。阈值与窄栏自动收起是同一个值，
 * 这样"竖栏收成图标列"与"主区让出宽度"同时发生，不会一半收一半不收。
 *
 * 全屏那一档只改外层的定位（由 `WorkbenchSurface` 决定），这里只负责把报头变成可拖拽的
 * 标题栏、并让左侧让开 mac 的红绿灯——版面结构一点不变，所以两种形态之间不会跳。
 */
export function StudioShell({
	active,
	fullscreen = false,
	onToggleFullscreen,
	trafficLights = false,
	bare = false,
	sync,
	rail,
	children,
}: {
	active: WorkbenchPage;
	/** 当前是否已经是覆盖整窗的形态。 */
	fullscreen?: boolean;
	onToggleFullscreen?: () => void;
	/** 需要给系统窗口按钮让位（mac 全屏）。 */
	trafficLights?: boolean;
	/** 是否收起窄栏：激活页与运行台自己就是整张纸。 */
	bare?: boolean;
	sync?: MastheadSync;
	rail?: StudioRailProps;
	children: React.ReactNode;
}) {
	const t = useTranslator();

	return (
		<div className="@container flex h-full w-full flex-col overflow-hidden bg-canvas font-sans text-ink antialiased">
			<StudioMasthead
				section={t(pageTitleKey(active))}
				sync={sync}
				fullscreen={fullscreen}
				onToggleFullscreen={onToggleFullscreen}
				trafficLights={trafficLights}
			/>
			<div className="flex min-h-0 flex-1 items-stretch gap-2 pb-3 pl-2 pr-3 pt-3 @max-[640px]:gap-1.5 @max-[640px]:pb-2 @max-[640px]:pl-1.5 @max-[640px]:pr-2 @max-[640px]:pt-2">
				{!bare && rail ? <StudioRail {...rail} active={active} /> : null}
				<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-sheet bg-surface shadow-raise @max-[640px]:rounded-panel">
					{children}
				</main>
			</div>
		</div>
	);
}

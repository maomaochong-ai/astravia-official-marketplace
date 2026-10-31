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
 */
export function StudioShell({
	active,
	right,
	bare = false,
	sync,
	rail,
	children,
}: {
	active: WorkbenchPage;
	right?: React.ReactNode;
	/** 是否收起窄栏：激活页与运行台自己就是整张纸。 */
	bare?: boolean;
	sync?: MastheadSync;
	rail?: StudioRailProps;
	children: React.ReactNode;
}) {
	const t = useTranslator();

	return (
		<div className="@container flex h-full w-full flex-col overflow-hidden bg-canvas font-sans text-ink antialiased">
			<StudioMasthead section={t(pageTitleKey(active))} right={right} sync={sync} />
			<div className="flex min-h-0 flex-1 items-stretch gap-2 pl-2 pr-3 pb-3 pt-3">
				{!bare && rail ? <StudioRail {...rail} active={active} /> : null}
				<main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-sheet bg-surface shadow-raise">
					{children}
				</main>
			</div>
		</div>
	);
}

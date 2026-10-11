export const frame = { width: 1440, height: 1000, title: "BI · 看板产物（运行结果）" };

import Chip from "../components/Chip";
import IconButton from "../components/IconButton";
import CanvasTiles from "../components/editor/CanvasTiles";

/**
 * 运行产物 —— 节点图跑完之后真正给人看的那一屏。
 * 与编辑态共用同一份组件（CanvasTiles），差别只在 preview：没有选中框、
 * 没有尺寸标签、没有列辅助线，只剩数据本身。
 * 顶部换成看的人需要的东西：这是哪一页、什么时候跑的、要不要重跑。
 */

const PAGES = [
	{ name: "概览", active: true },
	{ name: "渠道明细", active: false },
	{ name: "城市分布", active: false },
];

export default function Dashboard() {
	return (
		<div className="flex h-full w-full flex-col overflow-hidden bg-background font-sans text-[14px] text-surface-foreground">
			<header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-surface-raised px-6">
				<IconButton icon="icon-[lucide--arrow-left]" title="返回工作台" />
				<span className="h-5 w-px shrink-0 bg-border" />
				<span className="truncate text-[15px] font-semibold text-surface-foreground">
					渠道经营看板
				</span>
				<Chip>产物</Chip>
				<span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-faint">
					运行于 10:24 · 1.2s · 由 6 个节点生成
				</span>

				<div className="ml-auto flex shrink-0 items-center gap-2">
					<div className="flex shrink-0 items-center gap-1">
						{PAGES.map((p) => (
							<span
								key={p.name}
								className={`flex h-7 shrink-0 items-center rounded-control border px-2.5 text-[12px] whitespace-nowrap ${
									p.active
										? "border-border bg-surface font-medium text-surface-foreground"
										: "border-transparent text-muted"
								}`}
							>
								{p.name}
							</span>
						))}
					</div>
					<span className="h-5 w-px shrink-0 bg-border" />
					<IconButton icon="icon-[lucide--refresh-cw]" title="重新运行" />
				</div>
			</header>

			<div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background p-6">
				<div className="relative min-h-0 w-full flex-1 rounded-card border border-border-strong bg-surface">
					<div className="relative grid h-full grid-cols-12 grid-rows-[80px_248px_216px_1fr] gap-3 p-4">
						<CanvasTiles preview />
					</div>
				</div>
			</div>
		</div>
	);
}

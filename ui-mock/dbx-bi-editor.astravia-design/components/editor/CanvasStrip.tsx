import Icon from "../Icon";
import IconButton from "../IconButton";

/**
 * 画布头 —— 画布自己的坐标系统：网格、吸附、缩放，加上这一页的调色板。
 * 节点式之后页码与列数让位给节点视角：列数由布局算法决定，人真正会调的是
 * 「网格 16 / 8 / 关」和「适配视图」——前者决定节点吸附到哪里，后者决定看不看得清。
 * 调色板留在这里，因为它仍然决定这一页所有 figure 取哪一组 series 颜色。
 */

const GRID = ["16", "8", "关"];

export default function CanvasStrip() {
	return (
		<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
			<Icon name="icon-[lucide--layout-dashboard]" className="size-3.5 shrink-0 text-muted" />
			<span className="text-[12px] font-semibold text-surface-foreground">概览</span>
			<span className="flex h-[18px] shrink-0 items-center rounded-chip bg-neutral-muted px-1.5 font-mono text-[10px] tabular-nums text-muted">
				第 1 / 3 页
			</span>
			<span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-faint">
				6 节点 · 5 连接
			</span>

			<div className="ml-auto flex shrink-0 items-center gap-2">
				<div className="flex items-center gap-1.5">
					<span className="text-[11px] text-faint">调色板</span>
					<button
						type="button"
						title="科技 / 政务 / 商务 / 自定义"
						className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[12px] text-surface-foreground"
					>
						<span className="flex shrink-0 items-center gap-0.5">
							<span className="size-2 rounded-full bg-series-1" />
							<span className="size-2 rounded-full bg-series-2" />
							<span className="size-2 rounded-full bg-series-3" />
							<span className="size-2 rounded-full bg-series-4" />
						</span>
						科技
						<Icon name="icon-[lucide--chevron-down]" className="size-3 text-faint" />
					</button>
				</div>
				<span className="h-5 w-px shrink-0 bg-border" />

				<div className="flex items-center gap-1.5">
					<span className="text-[11px] text-faint">网格</span>
					<div className="flex items-center rounded-control border border-border bg-surface p-0.5">
						{GRID.map((g) => (
							<span
								key={g}
								className={`flex h-6 items-center rounded-[4px] px-2 font-mono text-[12px] ${
									g === "16" ? "bg-accent-soft font-medium text-accent" : "text-muted"
								}`}
							>
								{g}
							</span>
						))}
					</div>
				</div>
				<span className="h-5 w-px shrink-0 bg-border" />

				<button
					type="button"
					className="flex h-7 shrink-0 items-center rounded-control px-2 text-[12px] text-muted hover:bg-neutral-muted hover:text-surface-foreground"
				>
					适配视图
				</button>
				<div className="flex items-center gap-0.5">
					<IconButton size="xs" icon="icon-[lucide--minus]" title="缩小" />
					<span className="w-9 text-center font-mono text-[11px] tabular-nums text-muted">
						100%
					</span>
					<IconButton size="xs" icon="icon-[lucide--plus]" title="放大" />
				</div>
			</div>
		</div>
	);
}

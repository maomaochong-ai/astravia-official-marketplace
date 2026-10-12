/**
 * canvas-strip.tsx — 画布头（页码 + 节点计数 + 调色板 + 网格 + 缩放）。
 *
 * 设计稿 CanvasStrip.tsx 的插件化版本。
 */

import { useState } from "react";

const GRID = ["16", "8", "关"];
const PALETTES: Record<string, string[]> = {
	科技: ["#00d4ff", "#f0c040", "#7ee8a2", "#ffa726"],
	政务: ["#ffd700", "#00d4ff", "#4169e1", "#87ceeb"],
	商务: ["#00bcd4", "#4dd0e1", "#b2ebf2", "#80deea"],
	自定义: ["#8ab8d0", "#ff8c00", "#4caf50", "#ff6b6b"],
};

interface Props {
	onPaletteChange?: (name: string) => void;
}

export function CanvasStrip({ onPaletteChange }: Props) {
	const [grid, setGrid] = useState("16");
	const [palette, setPalette] = useState("科技");
	const [zoom, setZoom] = useState(100);

	function cyclePalette() {
		const names = Object.keys(PALETTES);
		const i = names.indexOf(palette);
		const next = names[(i + 1) % names.length];
		setPalette(next);
		onPaletteChange?.(next);
	}

	return (
		<div className="flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
			<span className="icon-[lucide--layout-dashboard] size-3.5 shrink-0 text-muted" />
			<span className="text-[12px] font-semibold text-surface-foreground">概览</span>
			<span className="flex h-[18px] shrink-0 items-center rounded-control border border-border bg-surface px-1.5 font-mono text-[10px] tabular-nums text-muted">
				第 1 / 1 页
			</span>
			<span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-faint">
				0 节点 · 0 连接
			</span>

			<div className="ml-auto flex shrink-0 items-center gap-2">
				{/* 调色板 */}
				<div className="flex items-center gap-1.5">
					<span className="text-[11px] text-faint">调色板</span>
					<button
						type="button"
						onClick={cyclePalette}
						className="flex h-7 items-center gap-1.5 rounded-control border border-border bg-surface px-2 text-[12px] text-surface-foreground hover:border-border-strong"
						title="科技 / 政务 / 商务 / 自定义"
					>
						<span className="flex shrink-0 items-center gap-0.5">
							{PALETTES[palette].map((c) => (
								<span key={c} className="size-2 rounded-full" style={{ background: c }} />
							))}
						</span>
						{palette}
					</button>
				</div>
				<span className="h-5 w-px shrink-0 bg-border" />

				{/* 网格 */}
				<div className="flex items-center gap-1.5">
					<span className="text-[11px] text-faint">网格</span>
					<div className="flex items-center rounded-control border border-border bg-surface p-0.5">
						{GRID.map((g) => (
							<button
								key={g}
								type="button"
								onClick={() => setGrid(g)}
								className={`flex h-6 items-center rounded-[4px] px-2 font-mono text-[12px] ${
									g === grid ? "bg-accent-soft font-medium text-accent" : "text-muted"
								}`}
							>
								{g}
							</button>
						))}
					</div>
				</div>
				<span className="h-5 w-px shrink-0 bg-border" />

				{/* 缩放 */}
				<button type="button" className="flex h-7 shrink-0 items-center rounded-control px-2 text-[12px] text-muted hover:bg-surface hover:text-surface-foreground">
					适配视图
				</button>
				<div className="flex items-center gap-0.5">
					<button
						type="button"
						className="grid size-6 place-items-center rounded-control border border-border bg-surface text-muted hover:text-surface-foreground"
						onClick={() => setZoom((z) => Math.max(25, z - 10))}
					>
						<span className="icon-[lucide--minus] size-3" />
					</button>
					<span className="w-9 text-center font-mono text-[11px] tabular-nums text-muted">{zoom}%</span>
					<button
						type="button"
						className="grid size-6 place-items-center rounded-control border border-border bg-surface text-muted hover:text-surface-foreground"
						onClick={() => setZoom((z) => Math.min(300, z + 10))}
					>
						<span className="icon-[lucide--plus] size-3" />
					</button>
				</div>
			</div>
		</div>
	);
}

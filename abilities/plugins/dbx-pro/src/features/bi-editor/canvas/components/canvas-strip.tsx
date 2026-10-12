/**
 * canvas-strip.tsx — 画布头（页码/计数 + 视图控制）。
 *
 * 设计稿 CanvasStrip.tsx 的插件化版本：调色板、网格步长、适配视图、缩放
 * 都收在这一条上，画布本身只认受控 props，不再自己藏一份状态。
 * 缩放百分比由 NodeGraph 的 viewport 回传，这里只做展示与转发。
 */

import { useState, type JSX } from "react";
import { Icon } from "../../shared/components/ui/icon";
import { IconButton } from "../../shared/components/ui/icon-button";
import { CANVAS_PALETTES, DEFAULT_PALETTE_ID, paletteById, paletteSwatch, type CanvasPalette } from "../../shared/canvas-palettes";

export type GridStep = 0 | 8 | 16;

const GRID_STEPS: { step: GridStep; label: string }[] = [
	{ step: 16, label: "16" },
	{ step: 8, label: "8" },
	{ step: 0, label: "关" },
];

interface Props {
	nodeCount?: number;
	linkCount?: number;
	pageIndex?: number;
	pageCount?: number;
	palette?: CanvasPalette;
	onPaletteChange?: (id: string) => void;
	gridStep?: GridStep;
	onGridStepChange?: (step: GridStep) => void;
	scale?: number;
	onFitView?: () => void;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	onZoomReset?: () => void;
}

export function CanvasStrip({
	nodeCount = 0,
	linkCount = 0,
	pageIndex = 1,
	pageCount = 1,
	palette,
	onPaletteChange,
	gridStep = 8,
	onGridStepChange,
	scale = 1,
	onFitView,
	onZoomIn,
	onZoomOut,
	onZoomReset,
}: Props): JSX.Element {
	const [paletteOpen, setPaletteOpen] = useState(false);
	// palette 可能缺失，用默认兜底
	const resolvedPalette = palette ?? paletteById(DEFAULT_PALETTE_ID);

	return (
		<div className="relative flex h-11 shrink-0 items-center gap-2 border-b border-border bg-surface-raised px-3">
			<span className="icon-[lucide--layout-dashboard] size-3.5 shrink-0 text-muted" />
			<span className="text-[12px] font-semibold text-surface-foreground">概览</span>
			<span className="flex h-[18px] shrink-0 items-center rounded-control border border-border bg-surface px-1.5 font-mono text-[10px] tabular-nums text-muted">
				第 {pageIndex} / {pageCount} 页
			</span>
			<span className="font-mono text-[11px] tabular-nums whitespace-nowrap text-faint">
				{nodeCount} 节点 · {linkCount} 连接
			</span>

			<div className="ml-auto flex items-center gap-2">
				<span className="text-[11px] whitespace-nowrap text-muted">调色板</span>
				<button
					type="button"
					title={resolvedPalette.description}
					aria-haspopup="menu"
					aria-expanded={paletteOpen}
					onClick={() => setPaletteOpen((v) => !v)}
					className="flex h-6 shrink-0 items-center gap-1.5 rounded-control border border-border bg-surface px-1.5 text-[11px] text-surface-foreground hover:border-border-strong"
				>
					<span className="flex items-center gap-0.5">
						{[0, 1, 2, 3].map((i) => (
							<span
								key={i}
								className="size-2 rounded-full border border-border"
								style={{ background: paletteSwatch(resolvedPalette, i) }}
							/>
						))}
					</span>
					<span className="whitespace-nowrap">{resolvedPalette.label}</span>
					<Icon name="icon-[lucide--chevron-down]" className="size-3 text-muted" />
				</button>

				<span className="h-5 w-px shrink-0 bg-border" />

				<span className="text-[11px] whitespace-nowrap text-muted">网格</span>
				<div className="flex shrink-0 items-center gap-0.5 rounded-control border border-border bg-surface p-0.5">
					{GRID_STEPS.map(({ step, label }) => (
						<button
							key={label}
							type="button"
							title={step === 0 ? "关闭网格吸附（G 切换）" : `网格吸附 ${step}px（G 切换）`}
							onClick={() => onGridStepChange?.(step)}
							className={`flex h-5 min-w-6 items-center justify-center rounded-[4px] px-1.5 font-mono text-[10px] tabular-nums transition ${
								gridStep === step
									? "bg-accent-soft font-medium text-accent"
									: "text-muted hover:text-surface-foreground"
							}`}
						>
							{label}
						</button>
					))}
				</div>

				<span className="h-5 w-px shrink-0 bg-border" />

				<button
					type="button"
					title="适配视图（Home）"
					onClick={onFitView}
					className="flex h-6 shrink-0 items-center gap-1 rounded-control border border-border bg-surface px-2 text-[11px] text-surface-foreground hover:border-border-strong"
				>
					<Icon name="icon-[lucide--maximize]" className="size-3" />
					适配视图
				</button>

				<div className="flex shrink-0 items-center gap-0.5">
					<IconButton size="xs" icon="icon-[lucide--minus]" title="缩小" onClick={onZoomOut} />
					<button
						type="button"
						title="重置为 100%"
						onClick={onZoomReset}
						className="w-10 shrink-0 rounded-control font-mono text-[11px] tabular-nums text-muted hover:text-surface-foreground"
					>
						{Math.round(scale * 100)}%
					</button>
					<IconButton size="xs" icon="icon-[lucide--plus]" title="放大" onClick={onZoomIn} />
				</div>
			</div>

			{paletteOpen ? (
				<>
					<div className="fixed inset-0 z-20" onPointerDown={() => setPaletteOpen(false)} />
					<div
						role="menu"
						className="absolute top-[38px] right-3 z-30 w-[232px] overflow-hidden rounded-card border border-border bg-surface-raised py-1 shadow-popover"
					>
						{CANVAS_PALETTES.map((p) => (
							<button
								key={p.id}
								type="button"
								role="menuitemradio"
								aria-checked={p.id === resolvedPalette.id}
								onClick={() => {
									onPaletteChange?.(p.id);
									setPaletteOpen(false);
								}}
								className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-neutral-muted"
							>
								<span className="mt-[3px] flex shrink-0 items-center gap-0.5">
									{[0, 1, 2, 3].map((i) => (
										<span
											key={i}
											className="size-2 rounded-full"
											style={{ background: paletteSwatch(p, i) }}
										/>
									))}
								</span>
								<span className="min-w-0 flex-1">
									<span className="block text-[12px] font-medium text-surface-foreground">
										{p.label}
									</span>
									<span className="block text-[11px] text-muted">{p.description}</span>
								</span>
								{p.id === resolvedPalette.id ? (
									<Icon name="icon-[lucide--check]" className="mt-[3px] size-3 shrink-0 text-accent" />
								) : null}
							</button>
						))}
					</div>
				</>
			) : null}
		</div>
	);
}

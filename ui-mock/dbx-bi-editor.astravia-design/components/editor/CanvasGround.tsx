import type { ReactNode } from "react";

export type NodeLink = { x1: number; y1: number; x2: number; y2: number; tone: string; dashed?: boolean };
export type CanvasGroup = { x: number; y: number; w: number; h: number; label: string; count: number };

/** 连线路由：先水平离开插槽，再水平进入插槽，中间留出足够的弯。 */
export function linkPath(l: NodeLink) {
	const bend = Math.max(36, (l.x2 - l.x1) * 0.5);
	return `M ${l.x1} ${l.y1} C ${l.x1 + bend} ${l.y1}, ${l.x2 - bend} ${l.y2}, ${l.x2} ${l.y2}`;
}

type Props = { groups?: CanvasGroup[]; links?: NodeLink[]; children: ReactNode };

/**
 * 画布地面 —— 点阵、分组框与连线。所有节点式画面共用这一套地面，于是「右键加节点」
 * 「运行」「AI 生成」看上去是同一张画布的不同时刻，而不是几套长得像的界面。
 * 节点由调用方通过 children 摆到地面上；地面本身不含任何数据。
 */
export default function CanvasGround({ groups = [], links = [], children }: Props) {
	return (
		<div
			className="relative min-h-0 flex-1 overflow-hidden bg-background"
			style={{
				backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
				backgroundSize: "16px 16px",
			}}
		>
			{groups.map((g) => (
				<div
					key={g.label}
					className="absolute rounded-card border border-dashed border-border"
					style={{ left: g.x, top: g.y, width: g.w, height: g.h }}
				>
					<span className="absolute -top-[9px] left-2 flex h-[18px] items-center gap-1.5 rounded-chip border border-border bg-surface-raised px-1.5 text-[10px] whitespace-nowrap text-muted">
						{g.label}
						<span className="font-mono text-[9px] tabular-nums text-faint">{g.count}</span>
					</span>
				</div>
			))}

			<svg className="pointer-events-none absolute inset-0 h-full w-full">
				{links.map((l, i) => (
					<path
						key={i}
						d={linkPath(l)}
						fill="none"
						stroke={l.tone}
						strokeWidth={1.5}
						strokeDasharray={l.dashed ? "4 3" : undefined}
					/>
				))}
			</svg>

			{children}
		</div>
	);
}

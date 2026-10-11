/**
 * canvas-ground.tsx — 画布绝对定位容器（数据源节点 / 大屏节点都用）。
 *
 * 功能：
 *   · 绝对定位子组件（NodeCard 等）
 *   · 可选连线数组（每条 {x1,y1,x2,y2,tone,dashed?}）
 *   · 背景网格线
 */

import { type JSX, type ReactNode } from "react";

interface GroundLink {
	x1: number; y1: number; x2: number; y2: number;
	tone: string; dashed?: boolean;
}

export function CanvasGround({ links = [], children, className = "" }: {
	links?: GroundLink[]; children: ReactNode; className?: string;
}): JSX.Element {
	return (
		<div className={`relative h-full w-full overflow-hidden bg-background ${className}`}>
			{/* 网格线背景 */}
			<svg className="pointer-events-none absolute inset-0 h-full w-full text-faint/10" preserveAspectRatio="none">
				<defs>
					<pattern id="grid-24" width="24" height="24" patternUnits="userSpaceOnUse">
						<path d="M24 0 L0 0 0 24" fill="none" stroke="currentColor" strokeWidth="0.5" />
					</pattern>
				</defs>
				<rect width="100%" height="100%" fill="url(#grid-24)" />
			</svg>

			{/* 连线 */}
			<svg className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none">
				{links.map((l, i) => {
					const midX = (l.x1 + l.x2) / 2;
					return (
						<path
							key={i}
							d={`M ${l.x1} ${l.y1} C ${midX} ${l.y1}, ${midX} ${l.y2}, ${l.x2} ${l.y2}`}
							fill="none"
							stroke={l.tone}
							strokeWidth="1.5"
							strokeDasharray={l.dashed ? "4 3" : undefined}
							opacity="0.85"
						/>
					);
				})}
			</svg>

			{children}
		</div>
	);
}

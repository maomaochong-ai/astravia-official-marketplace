/**
 * 示意图里两节点之间的竖向连接符。
 *
 * 流向由此处表达，节点标题不再自带箭头：`idle` 时整条连接符是 muted 的灰色，
 * 只有真实活动（`flowing` 光点下流 / `done` 实心）才升到 primary。
 * 也就是说，箭头「亮不亮」是数据驱动的，不是画上去的装饰。
 * 动效一律挂在 motion-safe 下。
 */

import type { JSX } from "react";
import type { DiagramEdgeState } from "../live/diagram-live";

interface ConnectorProps {
	readonly label?: string;
	readonly state?: DiagramEdgeState;
}

export function ReaDiagramConnector({ label, state = "idle" }: ConnectorProps): JSX.Element {
	const active = state === "flowing" || state === "done";
	return (
		<div className="flex min-w-0 flex-col items-center gap-0.5 py-0.5" aria-hidden>
			<span className={`relative h-2.5 w-px overflow-hidden ${active ? "bg-primary/40" : "bg-border"}`}>
				{state === "flowing" ? (
					<span className="absolute inset-x-0 top-0 h-1.5 bg-primary motion-safe:animate-rea-flow" />
				) : state === "done" ? (
					<span className="absolute inset-0 bg-primary/70" />
				) : null}
			</span>
			<span
				className={`icon-[lucide--arrow-down] size-3 motion-safe:transition-colors ${
					active ? "text-primary" : "text-muted-foreground/40"
				}`}
			/>
			{label ? (
				<span className="text-center text-[9px] leading-tight text-muted-foreground">{label}</span>
			) : null}
		</div>
	);
}

/**
 * 示意图里两节点之间的竖向连接符。
 *
 * `state` 来自真实活动：`flowing` 时线槽里有一颗光点向下流动，表示流程正推进到下游节点；
 * `done` 时箭头实心高亮，表示两端都已发生。动效一律挂在 motion-safe 下。
 */

import type { JSX } from "react";
import type { DiagramEdgeState } from "../live/diagram-live";

interface ConnectorProps {
	readonly label?: string;
	readonly state?: DiagramEdgeState;
}

export function ReaDiagramConnector({ label, state = "idle" }: ConnectorProps): JSX.Element {
	return (
		<div className="flex min-w-0 flex-col items-center gap-0.5 py-0.5" aria-hidden>
			<span className="relative h-2.5 w-px overflow-hidden bg-border">
				{state === "flowing" ? (
					<span className="absolute inset-x-0 top-0 h-1.5 bg-primary motion-safe:animate-rea-flow" />
				) : state === "done" ? (
					<span className="absolute inset-0 bg-primary/70" />
				) : null}
			</span>
			<span
				className={
					state === "idle"
						? "icon-[lucide--arrow-down] size-3 text-primary/70"
						: "icon-[lucide--arrow-down] size-3 text-primary"
				}
			/>
			{label ? (
				<span className="text-center text-[9px] leading-tight text-muted-foreground">{label}</span>
			) : null}
		</div>
	);
}

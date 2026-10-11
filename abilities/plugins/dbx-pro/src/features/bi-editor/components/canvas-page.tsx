/**
 * canvas-page.tsx — 画布容器（CanvasStrip + NodeGraph）。
 */

import type { JSX } from "react";
import { CanvasStrip } from "./canvas-strip";
import { NodeGraph, type NodeGraphProps } from "./node-graph";

type Props = {
	theme: "dark" | "default";
} & NodeGraphProps;

export function CanvasPage({ theme: _theme, ...graphProps }: Props): JSX.Element {
	return (
		<div className="flex min-w-0 flex-1 flex-col bg-surface">
			<CanvasStrip />
			<NodeGraph {...graphProps} />
		</div>
	);
}

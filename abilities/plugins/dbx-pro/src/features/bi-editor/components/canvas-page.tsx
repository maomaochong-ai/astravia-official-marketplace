/**
 * canvas-page.tsx — 画布容器（设计稿 CanvasStrip + NodeGraph 组合）。
 *
 * 中间栏顶栏：CanvasStrip（调色板 / 网格 / 缩放）
 * 中间栏主体：NodeGraph（数据流节点画布）
 */

import type { JSX } from "react";
import { CanvasStrip } from "./canvas-strip";
import { NodeGraph } from "./node-graph";

export function CanvasPage({ theme }: { theme: "dark" | "default" }): JSX.Element {
	return (
		<div className="flex min-w-0 flex-1 flex-col bg-surface">
			<CanvasStrip />
			<NodeGraph />
		</div>
	);
}

/**
 * 流程示意图的纵向连接符。图在窄面板里是单列自上而下，横向箭头只在宽屏 SVG 版本里存在过。
 */

import type { JSX } from "react";

interface ConnectorProps {
	readonly label?: string;
}

export function ReaDiagramConnector({ label }: ConnectorProps): JSX.Element {
	return (
		<div className="flex items-center justify-center gap-1.5 py-1 text-muted-foreground" aria-hidden="true">
			<span className="text-[11px] leading-none">↓</span>
			{label ? <span className="break-words text-[10px] leading-none">{label}</span> : null}
		</div>
	);
}

/**
 * 流程示意图的纵向连接符：一段竖线 + 箭头 + 可选说明。
 *
 * 旧版只有一个「↓」字符，窄面板里几乎看不出节点之间的从属与先后关系；
 * 箭头取自 @iconify-json/lucide，和面板其余图标同一套视觉语言。
 */

import type { JSX } from "react";

interface ConnectorProps {
	readonly label?: string;
}

export function ReaDiagramConnector({ label }: ConnectorProps): JSX.Element {
	return (
		<div className="flex min-w-0 flex-col items-center gap-0.5 py-1 text-muted-foreground" aria-hidden="true">
			<span className="h-2 w-px bg-border" />
			<span className="icon-[lucide--arrow-down] size-3 text-primary/70" />
			{label ? (
				<span className="max-w-full break-words px-1 text-center text-[10px] leading-tight">{label}</span>
			) : null}
		</div>
	);
}

/**
 * 流程示意图的单个节点。
 *
 * 用 DOM 而不是 SVG：客户端面板宽度可能只有 300px，固定 viewBox 缩放的 SVG 会把 9px 字号
 * 压到 4px 且文字溢出圆角矩形。这里的节点靠 `min-w-0` + `break-words` 自动换行，任何宽度都不裁切。
 */

import type { JSX } from "react";

export type DiagramTone = "primary" | "neutral" | "warning" | "quiet";

const TONE: Record<DiagramTone, { readonly box: string; readonly title: string }> = {
	primary: { box: "border-primary/50 bg-primary/10", title: "text-foreground" },
	neutral: { box: "border-border bg-card", title: "text-foreground" },
	warning: { box: "border-amber-500/50 bg-amber-500/10", title: "text-amber-700 dark:text-amber-400" },
	quiet: { box: "border-dashed border-border bg-transparent", title: "text-foreground" },
};

interface NodeProps {
	readonly tone?: DiagramTone;
	readonly title: string;
	readonly hint?: string;
	/** 命令、字段名等需要等宽字体的内容。 */
	readonly mono?: boolean;
}

export function ReaDiagramNode({ tone = "neutral", title, hint, mono = false }: NodeProps): JSX.Element {
	const style = TONE[tone];
	return (
		<div className={`min-w-0 rounded-[min(var(--radius-md),8px)] border px-2.5 py-2 text-center ${style.box}`}>
			<div
				className={`break-words text-[11px] font-medium leading-tight ${style.title} ${mono ? "font-mono" : ""}`}
			>
				{title}
			</div>
			{hint ? (
				<div className="mt-1 break-words text-[10px] leading-snug text-muted-foreground">{hint}</div>
			) : null}
		</div>
	);
}

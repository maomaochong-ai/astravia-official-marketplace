import type { JSX } from "react";

/**
 * 代码片段：带行号槽的等宽文本。
 * 行号从 `startLine` 起算——审查结论指向哪一行，用户看到的就该是哪一行。
 */
export function CodeSnippet({
	title,
	code,
	startLine,
	tone,
}: {
	title: string;
	code: string;
	startLine: number;
	tone: "current" | "suggested";
}): JSX.Element {
	const lines = code.split("\n");
	const accent =
		tone === "current" ? "bg-red-500/5 text-foreground/90" : "bg-emerald-500/5 text-foreground/90";
	return (
		<div className="mt-1.5 overflow-hidden rounded border border-border/70">
			<div className="flex items-center justify-between bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
				<span>{title}</span>
				<span className="font-mono">{startLine > 0 ? `L${startLine}` : ""}</span>
			</div>
			<div className={`max-h-64 overflow-auto font-mono text-[11px] leading-5 ${accent}`}>
				{lines.map((line, index) => (
					<div key={`${startLine + index}`} className="flex">
						<span className="w-9 shrink-0 select-none pr-2 text-right text-muted-foreground/40 tabular-nums">
							{startLine > 0 ? startLine + index : ""}
						</span>
						<code className="whitespace-pre pr-2">{line || " "}</code>
					</div>
				))}
			</div>
		</div>
	);
}

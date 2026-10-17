import type { JSX } from "react";
import type { FindingMark, ReviewFinding } from "../../../review/finding.ts";
import { lineLabel } from "../finding-view.ts";
import { CategoryTag } from "./CategoryTag.tsx";
import { CodeSnippet } from "./CodeSnippet.tsx";
import { SeverityBadge } from "./SeverityBadge.tsx";

/**
 * 单条发现：级别 + 类别 + 行号 + 规则，正文是「哪里错、什么条件下错、怎么改」，
 * 可选原文/改法对照。右上角的处置按钮只改本地标记，不改审查结论。
 */
export function FindingCard({
	finding,
	mark,
	onMark,
}: {
	finding: ReviewFinding;
	mark?: FindingMark;
	onMark: (mark: FindingMark | null) => void;
}): JSX.Element {
	return (
		<div
			className={`rounded-md border p-2.5 transition-opacity ${
				mark ? "border-border/50 bg-muted/20 opacity-70" : "border-border"
			}`}
		>
			<div className="flex flex-wrap items-center gap-1.5">
				<SeverityBadge severity={finding.severity} />
				<CategoryTag category={finding.category} />
				<span className="font-mono text-[11px] text-muted-foreground">
					{lineLabel(finding.line, finding.endLine)}
				</span>
				{finding.rule ? (
					<span className="text-[11px] text-muted-foreground/60">[{finding.rule}]</span>
				) : null}
				<span className="ml-auto flex items-center gap-1">
					<button
						type="button"
						onClick={() => onMark(mark === "fixed" ? null : "fixed")}
						aria-pressed={mark === "fixed"}
						className={`rounded border px-1.5 py-0.5 text-[11px] ${
							mark === "fixed"
								? "border-emerald-500/40 bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
								: "border-border text-muted-foreground hover:bg-accent"
						}`}
					>
						已修复
					</button>
					<button
						type="button"
						onClick={() => onMark(mark === "ignored" ? null : "ignored")}
						aria-pressed={mark === "ignored"}
						className={`rounded border px-1.5 py-0.5 text-[11px] ${
							mark === "ignored"
								? "border-border bg-muted text-foreground/70"
								: "border-border text-muted-foreground hover:bg-accent"
						}`}
					>
						忽略
					</button>
				</span>
			</div>
			<p className="mt-1.5 whitespace-pre-wrap text-xs leading-5 text-foreground/90">{finding.message}</p>
			{finding.existingCode ? (
				<CodeSnippet title="当前代码" code={finding.existingCode} startLine={finding.line} tone="current" />
			) : null}
			{finding.suggestionCode ? (
				<CodeSnippet
					title="建议改成"
					code={finding.suggestionCode}
					startLine={finding.line}
					tone="suggested"
				/>
			) : null}
		</div>
	);
}

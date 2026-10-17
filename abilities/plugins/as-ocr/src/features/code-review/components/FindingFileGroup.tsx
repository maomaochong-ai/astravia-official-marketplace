import type { JSX } from "react";
import type { FileFindings, FindingMark } from "../../../review/finding.ts";
import { worstSeverity } from "../../../review/finding.ts";
import { FindingCard } from "./FindingCard.tsx";
import { SeverityBadge } from "./SeverityBadge.tsx";

/**
 * 按文件折叠：标题行给路径 + 该文件最严重级别 + 条数，展开后是逐条发现。
 * 默认展开——面板的用途是看清问题，不是先整理目录。
 */
export function FindingFileGroup({
	group,
	marks,
	onMark,
}: {
	group: FileFindings;
	marks: Readonly<Record<string, FindingMark>>;
	onMark: (key: string, mark: FindingMark | null) => void;
}): JSX.Element {
	const worst = worstSeverity(group.findings);
	return (
		<details open className="mb-2 overflow-hidden rounded-lg border border-border">
			<summary className="flex cursor-pointer select-none items-center gap-2 px-2.5 py-1.5 text-xs [&::-webkit-details-marker]:hidden">
				<span className="icon-[mdi--chevron-right] size-3.5 shrink-0 text-muted-foreground" />
				<span className="truncate font-mono text-[11px] text-foreground/90">{group.file}</span>
				{worst ? <SeverityBadge severity={worst} /> : null}
				<span className="ml-auto shrink-0 tabular-nums text-muted-foreground">
					{group.findings.length}
				</span>
			</summary>
			<div className="space-y-1.5 border-t border-border p-2">
				{group.findings.map((finding) => (
					<FindingCard
						key={finding.key}
						finding={finding}
						mark={marks[finding.key]}
						onMark={(mark) => onMark(finding.key, mark)}
					/>
				))}
			</div>
		</details>
	);
}

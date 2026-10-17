import type { JSX } from "react";
import type { ReviewRun } from "../../../review/store.ts";
import { formatClock } from "../finding-view.ts";

/** 历史选择：最近 20 次运行，最新的排在前面；只读结论，点选后切到那次结果。 */
export function RunPicker({
	runs,
	activeId,
	onSelect,
}: {
	runs: readonly ReviewRun[];
	activeId: string;
	onSelect: (runId: string) => void;
}): JSX.Element | null {
	if (runs.length < 2) return null;
	const options = [...runs].reverse();
	return (
		<select
			value={activeId}
			onChange={(event) => onSelect(event.target.value)}
			aria-label="历史审查记录"
			className="max-w-44 rounded border border-border bg-transparent px-1.5 py-0.5 text-[11px] text-muted-foreground"
		>
			{options.map((run) => (
				<option key={run.id} value={run.id}>
					{formatClock(run.startedAt)} · {run.ok ? `${run.findings.length} 个发现` : "失败"}
				</option>
			))}
		</select>
	);
}

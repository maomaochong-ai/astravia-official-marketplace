import type { JSX } from "react";
import type { ReviewFinding } from "../../../review/finding.ts";
import { CATEGORY_ORDER, SEVERITY_ORDER, countByCategory, countBySeverity } from "../../../review/finding.ts";
import type { FindingFilterModel } from "../hooks/useFindingFilters.ts";
import { CATEGORY_LABEL, SEVERITY_LABEL } from "../finding-view.ts";
import { FilterChip } from "./FilterChip.tsx";

/**
 * 过滤栏：只显示实际存在的级别/类别，避免一排 0 让用户以为漏了东西。
 * 两个维度都是单选可切换，避免多选组合把「当前到底在看什么」变得不可读。
 */
export function FindingFilterBar({
	findings,
	model,
	onClearMarks,
}: {
	findings: readonly ReviewFinding[];
	model: FindingFilterModel;
	onClearMarks: () => void;
}): JSX.Element {
	const severityCounts = countBySeverity(findings);
	const categoryCounts = countByCategory(findings);
	const severities = SEVERITY_ORDER.filter((severity) => severityCounts[severity] > 0);
	const categories = CATEGORY_ORDER.filter((category) => categoryCounts[category] > 0);
	return (
		<div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 border-b border-border px-3 py-2">
			{severities.map((severity) => (
				<FilterChip
					key={severity}
					label={SEVERITY_LABEL[severity]}
					count={severityCounts[severity]}
					active={model.filters.severity === severity}
					onClick={() => model.toggleSeverity(severity)}
				/>
			))}
			<span className="h-3 w-px bg-border" />
			{categories.map((category) => (
				<FilterChip
					key={category}
					label={CATEGORY_LABEL[category]}
					count={categoryCounts[category]}
					active={model.filters.category === category}
					onClick={() => model.toggleCategory(category)}
				/>
			))}
			<span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
				{model.markedCount > 0 ? (
					<>
						<button
							type="button"
							onClick={model.toggleHideMarked}
							className="rounded px-1 py-0.5 hover:bg-accent"
						>
							{model.filters.hideMarked ? `已隐藏 ${model.markedCount} 条` : `隐藏已标记 ${model.markedCount} 条`}
						</button>
						<button
							type="button"
							onClick={onClearMarks}
							className="rounded px-1 py-0.5 hover:bg-accent"
						>
							清除标记
						</button>
					</>
				) : null}
				{model.narrowed ? (
					<button type="button" onClick={model.reset} className="rounded px-1 py-0.5 hover:bg-accent">
						重置筛选
					</button>
				) : null}
			</span>
		</div>
	);
}

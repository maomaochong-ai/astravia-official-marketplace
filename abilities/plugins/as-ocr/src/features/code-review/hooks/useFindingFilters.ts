/**
 * 面板的筛选状态机：级别 / 类别单选，已标记默认隐藏。
 * 纯派生值（可见发现、分组、各类计数）在这里算完，组件只渲染。
 */

import { useState } from "react";
import type {
	FileFindings,
	FindingFilters,
	FindingMark,
	ReviewCategory,
	ReviewFinding,
	ReviewSeverity,
} from "../../../review/finding.ts";
import {
	DEFAULT_FILTERS,
	countMarked,
	filterFindings,
	groupByFile,
} from "../../../review/finding.ts";

export interface FindingFilterModel {
	readonly filters: FindingFilters;
	readonly groups: readonly FileFindings[];
	readonly markedCount: number;
	readonly narrowed: boolean;
	readonly toggleSeverity: (severity: ReviewSeverity) => void;
	readonly toggleCategory: (category: ReviewCategory) => void;
	readonly toggleHideMarked: () => void;
	readonly reset: () => void;
}

export function useFindingFilters(
	findings: readonly ReviewFinding[],
	marks: Readonly<Record<string, FindingMark>>,
): FindingFilterModel {
	const [filters, setFilters] = useState<FindingFilters>(DEFAULT_FILTERS);
	const visible = filterFindings(findings, filters, marks);
	const markedCount = countMarked(findings, marks);
	return {
		filters,
		groups: groupByFile(visible),
		markedCount,
		narrowed: filters.severity !== null || filters.category !== null,
		toggleSeverity: (severity) =>
			setFilters((current) => ({
				...current,
				severity: current.severity === severity ? null : severity,
			})),
		toggleCategory: (category) =>
			setFilters((current) => ({
				...current,
				category: current.category === category ? null : category,
			})),
		toggleHideMarked: () => setFilters((current) => ({ ...current, hideMarked: !current.hideMarked })),
		// 「重置」的语义是先把所有发现都拿回视野，所以连 hideMarked 一起关掉（初始默认仍然是隐藏）。
		reset: () => setFilters({ severity: null, category: null, hideMarked: false }),
	};
}

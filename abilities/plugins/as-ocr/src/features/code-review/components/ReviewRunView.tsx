import type { JSX } from "react";
import type { ReviewRun, ReviewStore } from "../../../review/store.ts";
import { useFindingFilters } from "../hooks/useFindingFilters.ts";
import { FindingFileGroup } from "./FindingFileGroup.tsx";
import { FindingFilterBar } from "./FindingFilterBar.tsx";
import { ReviewFailureNotice } from "./ReviewFailureNotice.tsx";
import { ReviewResultEmpty, type EmptyKind } from "./ReviewResultEmpty.tsx";
import { RunSummary } from "./RunSummary.tsx";

/** 一次运行的完整视图：摘要 → 失败提示 / 空态 / 过滤栏 + 文件分组。 */
export function ReviewRunView({ run, store }: { run: ReviewRun; store: ReviewStore }): JSX.Element {
	const marks = store.marksFor(run.id);
	const model = useFindingFilters(run.findings, marks);
	const onMark = (key: string, mark: "fixed" | "ignored" | null) => store.setMark(run.id, key, mark);

	if (!run.ok) {
		return (
			<div className="flex-1 overflow-y-auto">
				<RunSummary run={run} />
				<ReviewFailureNotice run={run} />
			</div>
		);
	}

	if (run.findings.length === 0) {
		return (
			<div className="flex flex-1 flex-col overflow-y-auto">
				<RunSummary run={run} />
				<ReviewResultEmpty kind={emptyKindFor(run)} />
			</div>
		);
	}

	return (
		<div className="flex-1 overflow-y-auto">
			<RunSummary run={run} />
			<FindingFilterBar
				findings={run.findings}
				model={model}
				onClearMarks={() => store.clearMarks(run.id)}
			/>
			{model.groups.length === 0 ? (
				<ReviewResultEmpty kind="filtered" onReset={model.reset} />
			) : (
				<div className="px-3 py-2">
					{model.groups.map((group) => (
						<FindingFileGroup key={group.file} group={group} marks={marks} onMark={onMark} />
					))}
				</div>
			)}
		</div>
	);
}

/** 空结果的成因：没东西可审 > 有文件没取到 diff > 真的干净。顺序不能反。 */
function emptyKindFor(run: ReviewRun): EmptyKind {
	const coverage = run.coverage;
	if (coverage && coverage.reviewable === 0) return "nothing-to-review";
	if (coverage && coverage.missing > 0) return "partial";
	return "clean";
}

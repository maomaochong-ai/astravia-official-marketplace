import type { JSX } from "react";
import type { ReviewRun } from "../../../review/store.ts";
import { SEVERITY_ORDER, countBySeverity, countFiles } from "../../../review/finding.ts";
import { engineLabel, formatDuration } from "../finding-view.ts";
import { SeverityBadge } from "./SeverityBadge.tsx";

/**
 * 一次审查的摘要行：结论 + 级别分布 + 文件数 + 覆盖度 + 耗时/引擎/范围。
 * 覆盖度必须露出来——「3 个文件没取到 diff」和「审了 3 个文件都没问题」不是一回事。
 */
export function RunSummary({ run }: { run: ReviewRun }): JSX.Element {
	const counts = countBySeverity(run.findings);
	const files = countFiles(run.findings);
	const coverage = run.coverage;
	const headline = !run.ok
		? "审查失败"
		: run.findings.length === 0
			? coverage && coverage.reviewable === 0
				? "没有可审查的改动"
				: "未发现问题"
			: `${run.findings.length} 个发现`;
	return (
		<div className="space-y-1.5 border-b border-border px-3 py-2 text-xs">
			<div className="flex flex-wrap items-center gap-x-3 gap-y-1">
				<span className={`font-medium ${run.ok && run.findings.length > 0 ? "text-foreground" : ""}`}>
					{headline}
				</span>
				{SEVERITY_ORDER.filter((severity) => counts[severity] > 0).map((severity) => (
					<SeverityBadge key={severity} severity={severity} count={counts[severity]} />
				))}
				{files > 0 ? <span className="text-muted-foreground">{files} 个文件</span> : null}
				<span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
					{run.engine ? <span>{engineLabel(run.engine)}</span> : null}
					{run.durationMs > 0 ? <span>{formatDuration(run.durationMs)}</span> : null}
					<span className="font-mono opacity-70">{run.scope}</span>
				</span>
			</div>
			{coverage && (coverage.excluded > 0 || coverage.missing > 0) ? (
				<div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
					{coverage.reviewable > 0 ? <span>可审查 {coverage.reviewable} 个文件</span> : null}
					{coverage.excluded > 0 ? (
						<span title="ocr 按规则跳过的文件（如生成物、锁文件、二进制）">
							规则排除 {coverage.excluded} 个
						</span>
					) : null}
					{coverage.missing > 0 ? (
						<span className="text-amber-600 dark:text-amber-400" title="这些文件没有取到 diff，本次未审">
							未取到 diff {coverage.missing} 个
						</span>
					) : null}
				</div>
			) : null}
			{run.rawSummary ? (
				<p className="whitespace-pre-wrap text-[11px] leading-5 text-muted-foreground">{run.rawSummary}</p>
			) : null}
		</div>
	);
}

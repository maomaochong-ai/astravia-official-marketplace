import type { JSX } from "react";
import type { ReviewSeverity } from "../../../review/finding.ts";
import { SEVERITY_HINT, SEVERITY_LABEL, SEVERITY_TONE } from "../finding-view.ts";

export function SeverityBadge({
	severity,
	count,
}: {
	severity: ReviewSeverity;
	count?: number;
}): JSX.Element {
	return (
		<span
			title={SEVERITY_HINT[severity]}
			className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${SEVERITY_TONE[severity]}`}
		>
			{SEVERITY_LABEL[severity]}
			{typeof count === "number" ? ` ${count}` : ""}
		</span>
	);
}

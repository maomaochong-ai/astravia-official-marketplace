/**
 * Findings of the selected run, highest severity first.
 *
 * The empty state distinguishes "nothing found" from "not scanned yet" by
 * taking the run's status, because those two read very differently to someone
 * deciding whether the target is clean.
 */

import type { StrixFinding } from "../../../runtime-contract";
import { sortBySeverity } from "../../../shared/formatters/severity";
import { FindingCard } from "./finding-card";
import { SeveritySummary } from "./severity-summary";

export interface FindingListProps {
	t: (key: string) => string;
	findings: readonly StrixFinding[];
	runStatus?: string;
}

export function FindingList({ t, findings, runStatus }: FindingListProps): React.ReactElement {
	if (!findings.length) {
		const scanned = runStatus === "completed" || runStatus === "stopped";
		return <p className="astra-strix-empty">{scanned ? t("findings.noneFound") : t("findings.notScanned")}</p>;
	}
	return (
		<div className="astra-strix-findings">
			<SeveritySummary t={t} findings={findings} />
			{sortBySeverity(findings).map((finding, index) => (
				<FindingCard
					key={finding.id ?? `${finding.title ?? "finding"}-${index}`}
					t={t}
					finding={finding}
				/>
			))}
		</div>
	);
}

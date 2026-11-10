/**
 * Severity tally for the selected run: the one line that tells a user whether
 * this scan found something they must act on today.
 */

import type { Severity } from "../../../shared/formatters/severity";
import { SEVERITIES, countBySeverity, severityTone } from "../../../shared/formatters/severity";
import type { StrixFinding } from "../../../runtime-contract";

export interface SeveritySummaryProps {
	t: (key: string) => string;
	findings: readonly StrixFinding[];
}

export function SeveritySummary({ t, findings }: SeveritySummaryProps): React.ReactElement {
	const tally = countBySeverity(findings);
	return (
		<ul className="astra-strix-summary" aria-label={t("summary.label")}>
			{SEVERITIES.map((severity: Severity) => (
				<li key={severity} className="astra-strix-summary-item">
					<span className={`astra-strix-summary-count ${severityTone(severity)}`}>{tally[severity]}</span>
					<span className="astra-strix-summary-label">{t(`severity.${severity}`)}</span>
				</li>
			))}
		</ul>
	);
}

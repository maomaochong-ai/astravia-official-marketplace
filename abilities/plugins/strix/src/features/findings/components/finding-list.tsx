/**
 * Findings of the selected run, one compact row per finding.
 *
 * Upstream's sidebar list shows severity + title and nothing else, with detail
 * on the selected entry (view.go:vulnerabilitiesView). The box is narrow, so the
 * expanded detail stays behind a disclosure rather than pushing rows apart.
 */

import { useState } from "react";
import type { StrixFinding } from "../../../runtime-contract";
import { normalizeSeverity, severityTone, sortBySeverity } from "../../../shared/formatters/severity";

export interface FindingListProps {
	t: (key: string) => string;
	findings: readonly StrixFinding[];
	runStatus?: string;
}

function FindingRow({ t, finding }: { t: (key: string) => string; finding: StrixFinding }): React.ReactElement {
	const [open, setOpen] = useState(false);
	const severity = normalizeSeverity(finding.severity);
	const where = finding.code_locations?.[0];
	const location = where?.file ? `${where.file}${where.start_line ? `:${where.start_line}` : ""}` : finding.target;

	return (
		<li className="astra-strix-finding">
			<button type="button" className="astra-strix-finding-row" onClick={() => setOpen((value) => !value)}>
				<span className={`astra-strix-severity ${severityTone(finding.severity)}`}>{t(`severity.${severity}`)}</span>
				<span className="astra-strix-finding-title">{finding.title || t("finding.untitled")}</span>
			</button>
			{open ? (
				<div className="astra-strix-finding-detail">
					{location ? <p className="astra-strix-dim">{location}</p> : null}
					{finding.description || finding.impact ? <p>{finding.description || finding.impact}</p> : null}
					{finding.cvss !== undefined || finding.cwe || finding.cve ? (
						<p className="astra-strix-dim">
							{finding.cvss !== undefined ? `CVSS ${String(finding.cvss)}` : ""}
							{finding.cwe ? ` · ${finding.cwe}` : ""}
							{finding.cve ? ` · ${finding.cve}` : ""}
						</p>
					) : null}
					{finding.technical_analysis ? <p>{finding.technical_analysis}</p> : null}
					{finding.poc_description ? (
						<>
							<p className="astra-strix-dim">{t("finding.poc")}</p>
							<p>{finding.poc_description}</p>
						</>
					) : null}
					{finding.remediation_steps ? (
						<>
							<p className="astra-strix-dim">{t("finding.remediation")}</p>
							<p>{finding.remediation_steps}</p>
						</>
					) : null}
				</div>
			) : null}
		</li>
	);
}

export function FindingList({ t, findings, runStatus }: FindingListProps): React.ReactElement {
	if (!findings.length) {
		const scanned = runStatus === "completed" || runStatus === "stopped";
		return <p className="astra-strix-dim">{scanned ? t("findings.noneFound") : t("findings.notScanned")}</p>;
	}
	return (
		<ul className="astra-strix-findings">
			{sortBySeverity(findings).map((finding, index) => (
				<FindingRow key={finding.id ?? `${finding.title ?? "finding"}-${index}`} t={t} finding={finding} />
			))}
		</ul>
	);
}

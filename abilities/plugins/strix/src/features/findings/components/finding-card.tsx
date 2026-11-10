/**
 * One finding, collapsed to what a reviewer triages on: severity, what it is,
 * where it is, and how bad it is (CVSS/CWE). The technical analysis stays
 * collapsed so a long scan does not bury the list.
 */

import { useState } from "react";
import type { StrixFinding } from "../../../runtime-contract";
import { normalizeSeverity, severityTone } from "../../../shared/formatters/severity";

export interface FindingCardProps {
	t: (key: string) => string;
	finding: StrixFinding;
}

function location(finding: StrixFinding): string | undefined {
	const first = finding.code_locations?.[0];
	if (!first) return finding.target;
	const file = first.file ?? "?";
	return first.start_line ? `${file}:${first.start_line}` : file;
}

export function FindingCard({ t, finding }: FindingCardProps): React.ReactElement {
	const [open, setOpen] = useState(false);
	const severity = normalizeSeverity(finding.severity);
	const where = location(finding);

	return (
		<article className="astra-strix-finding">
			<header className="astra-strix-finding-head">
				<span className={`astra-strix-severity ${severityTone(finding.severity)}`}>
					{t(`severity.${severity}`)}
				</span>
				<h4 className="astra-strix-finding-title">{finding.title || t("finding.untitled")}</h4>
			</header>
			{where ? <p className="astra-strix-finding-meta">{where}</p> : null}
			<p className="astra-strix-finding-desc">{finding.description || finding.impact || ""}</p>
			<div className="astra-strix-finding-facts">
				{finding.cvss !== undefined ? <span>CVSS {String(finding.cvss)}</span> : null}
				{finding.cwe ? <span>{finding.cwe}</span> : null}
				{finding.cve ? <span>{finding.cve}</span> : null}
			</div>
			<button type="button" className="astra-strix-link" onClick={() => setOpen((value) => !value)}>
				{open ? t("finding.hide") : t("finding.details")}
			</button>
			{open ? (
				<div className="astra-strix-finding-details">
					{finding.technical_analysis ? (
						<section>
							<h5>{t("finding.analysis")}</h5>
							<p>{finding.technical_analysis}</p>
						</section>
					) : null}
					{finding.poc_description ? (
						<section>
							<h5>{t("finding.poc")}</h5>
							<p>{finding.poc_description}</p>
						</section>
					) : null}
					{finding.remediation_steps ? (
						<section>
							<h5>{t("finding.remediation")}</h5>
							<p>{finding.remediation_steps}</p>
						</section>
					) : null}
				</div>
			) : null}
		</article>
	);
}

/**
 * SARIF 2.1.0 for CI.
 *
 * Upstream ships `findings.sarif` next to the Markdown report so a pipeline can
 * annotate a pull request instead of parsing prose. The mapping is the one GitHub
 * interprets: severity → `security-severity` (CVSS when known, else a band), CWE as
 * a tag, the code location as a physical location, and severity order → `level`.
 *
 * A finding without a file still travels: it becomes a result with no location,
 * which a scanner dashboard reads as "repository-level".
 */

import type { Finding } from "./findings";

const SEVERITY_SCORE: Record<string, string> = {
	critical: "9.5",
	high: "8.0",
	medium: "5.5",
	low: "3.1",
	info: "0.0",
};

/** SARIF levels: only `error` fails a build, so high and critical map there. */
function level(finding: Finding): "error" | "warning" | "note" {
	if (finding.severity === "critical" || finding.severity === "high") return "error";
	if (finding.severity === "medium" || finding.severity === "low") return "warning";
	return "note";
}

export interface SarifLog {
	$schema: string;
	version: "2.1.0";
	runs: {
		tool: {
			driver: {
				name: string;
				informationUri: string;
				version: string;
				rules: { id: string; name: string; shortDescription: { text: string }; properties: Record<string, unknown> }[];
			};
		};
		results: unknown[];
	}[];
}

export function toSarif(findings: readonly Finding[], options: { version: string; targets?: readonly string[] } = { version: "0.0.0" }): SarifLog {
	// One rule per finding class: CWE when the agent knew it, severity otherwise. Two
	// findings of the same class then group under one rule in the dashboard.
	const ruleId = (finding: Finding): string => finding.cwe.trim() || `strix-${finding.severity}`;
	const rules = new Map<string, { id: string; name: string; shortDescription: { text: string }; properties: Record<string, unknown> }>();

	for (const finding of findings) {
		const id = ruleId(finding);
		if (rules.has(id)) continue;
		rules.set(id, {
			id,
			name: finding.cwe.trim() || finding.title,
			shortDescription: { text: finding.title },
			properties: {
				tags: ["security", ...(finding.cwe ? [finding.cwe] : []), ...(finding.cve ? [finding.cve] : [])],
				"security-severity": finding.cvss !== undefined ? String(finding.cvss) : (SEVERITY_SCORE[finding.severity] ?? "0.0"),
			},
		});
	}

	const results = findings.map((finding) => {
		const locations = (finding.code_locations ?? [])
			.filter((location) => Boolean(location.file))
			.map((location) => ({
				physicalLocation: {
					artifactLocation: { uri: location.file },
					...(location.start_line
						? { region: { startLine: location.start_line, ...(location.end_line ? { endLine: location.end_line } : {}) } }
						: {}),
				},
			}));

		return {
			ruleId: ruleId(finding),
			level: level(finding),
			message: {
				text: [finding.description || finding.title, finding.remediation_steps ? `Remediation: ${finding.remediation_steps}` : ""]
					.filter(Boolean)
					.join("\n\n"),
			},
			...(finding.target ? { properties: { target: finding.target, confidence: finding.confidence } } : {}),
			...(locations.length ? { locations } : {}),
			...(finding.poc_description ? { fixes: [], attachments: [] } : {}),
		};
	});

	return {
		$schema: "https://json.schemastore.org/sarif-2.1.0.json",
		version: "2.1.0",
		runs: [
			{
				tool: {
					driver: {
						name: "Strix",
						informationUri: "https://strix.ai",
						version: options.version,
						rules: [...rules.values()],
					},
				},
				results,
			},
		],
	};
}

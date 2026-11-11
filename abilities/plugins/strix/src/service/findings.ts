/**
 * Findings a host agent files while it works, and the report it leaves behind.
 *
 * Shape follows Strix's finding schema (severity, cvss, cwe, poc, evidence,
 * remediation) so a finding filed here reads like one `strix` would write, and a
 * Markdown consumer sees no new vocabulary.
 *
 * Storage is the plugin's own data directory - never the package directory, which
 * would put user data inside the shipped archive.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export const SEVERITIES = ["critical", "high", "medium", "low", "info"] as const;
export type Severity = (typeof SEVERITIES)[number];

export interface Finding {
	id: string;
	title: string;
	severity: Severity;
	target: string;
	description: string;
	impact: string;
	technical_analysis: string;
	poc_description: string;
	remediation_steps: string;
	evidence: string;
	cvss?: number;
	cwe: string;
	cve: string;
	confidence: string;
	created_at: string;
}

export interface FindingsFile {
	bySeverity: Record<Severity, number>;
	count: number;
	findings: Finding[];
}

function dataDir(): string {
	const base = process.env.ASTRAVIA_SERVICE_DATA_DIR || join(homedir(), ".astravia", "plugin-data", "strix");
	return join(base, "findings");
}

function fileFor(sessionId: string): string {
	const safe = sessionId.replace(/[^A-Za-z0-9_-]/g, "") || "default";
	return join(dataDir(), `${safe}.json`);
}

export async function read(sessionId: string): Promise<Finding[]> {
	try {
		const parsed: unknown = JSON.parse(await readFile(fileFor(sessionId), "utf8"));
		return Array.isArray(parsed) ? (parsed as Finding[]) : [];
	} catch {
		return [];
	}
}

async function write(sessionId: string, findings: Finding[]): Promise<void> {
	await mkdir(dataDir(), { recursive: true });
	await writeFile(fileFor(sessionId), `${JSON.stringify(findings, null, 2)}\n`, "utf8");
}

export function tally(findings: readonly Finding[]): Record<Severity, number> {
	const counts = Object.fromEntries(SEVERITIES.map((name) => [name, 0])) as Record<Severity, number>;
	for (const finding of findings) counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
	return counts;
}

/** Order used by the list, the report and the panel. */
export function bySeverity(findings: readonly Finding[]): Finding[] {
	return [...findings].sort((left, right) => SEVERITIES.indexOf(left.severity) - SEVERITIES.indexOf(right.severity));
}

export function normalizeSeverity(value: unknown): Severity {
	const text = String(value ?? "").trim().toLowerCase();
	return (SEVERITIES as readonly string[]).includes(text) ? (text as Severity) : "info";
}

export async function add(sessionId: string, params: Record<string, unknown>): Promise<{ finding: Finding } & FindingsFile> {
	const title = String(params.title ?? "").trim();
	if (!title) throw new Error("title is required");
	const raw = String(params.severity ?? "").trim().toLowerCase();
	if (!(SEVERITIES as readonly string[]).includes(raw)) {
		throw new Error(`severity must be one of ${SEVERITIES.join(", ")}`);
	}

	const finding: Finding = {
		id: String(params.id ?? Math.random().toString(16).slice(2, 10)),
		title,
		severity: raw as Severity,
		target: String(params.target ?? ""),
		description: String(params.description ?? ""),
		impact: String(params.impact ?? ""),
		technical_analysis: String(params.technicalAnalysis ?? ""),
		poc_description: String(params.poc ?? ""),
		remediation_steps: String(params.remediation ?? ""),
		evidence: String(params.evidence ?? ""),
		...(typeof params.cvss === "number" ? { cvss: params.cvss } : {}),
		cwe: String(params.cwe ?? ""),
		cve: String(params.cve ?? ""),
		confidence: String(params.confidence ?? ""),
		created_at: new Date().toISOString(),
	};

	const findings = await read(sessionId);
	findings.push(finding);
	await write(sessionId, findings);
	return { finding, count: findings.length, bySeverity: tally(findings), findings: bySeverity(findings) };
}

export async function list(sessionId: string, params: Record<string, unknown> = {}): Promise<FindingsFile> {
	const filter = params.severity ? normalizeSeverity(params.severity) : undefined;
	const findings = (await read(sessionId)).filter((item) => (filter ? item.severity === filter : true));
	const ordered = bySeverity(findings);
	return { count: ordered.length, bySeverity: tally(ordered), findings: ordered };
}

const SECTIONS: [string, keyof Finding][] = [
	["Description", "description"],
	["Impact", "impact"],
	["Technical analysis", "technical_analysis"],
	["Proof of concept", "poc_description"],
	["Evidence", "evidence"],
	["Remediation", "remediation_steps"],
];

/** Markdown report, laid out like the one Strix writes at the end of a scan. */
export function renderReport(findings: readonly Finding[], targets: readonly string[]): string {
	const ordered = bySeverity(findings);
	const counts = tally(ordered);
	const lines: string[] = ["# Penetration test report", ""];
	if (targets.length) lines.push("## Targets", "", ...targets.map((target) => `- ${target}`), "");
	lines.push(`## Findings (${ordered.length})`, "");
	const summary = SEVERITIES.filter((name) => counts[name] > 0)
		.map((name) => `${name}: ${counts[name]}`)
		.join(", ");
	if (summary) lines.push(summary, "");
	if (!ordered.length) lines.push("No findings were filed.");

	ordered.forEach((finding, index) => {
		lines.push(`### ${index + 1}. ${finding.title}`, "", `- Severity: **${finding.severity}**`);
		if (finding.target) lines.push(`- Target: \`${finding.target}\``);
		if (finding.cvss !== undefined) lines.push(`- CVSS: ${finding.cvss}`);
		for (const [label, key] of [
			["CWE", "cwe"],
			["CVE", "cve"],
			["Confidence", "confidence"],
		] as [string, keyof Finding][]) {
			const value = String(finding[key] ?? "");
			if (value) lines.push(`- ${label}: ${value}`);
		}
		lines.push("");
		for (const [label, key] of SECTIONS) {
			const value = String(finding[key] ?? "").trim();
			if (value) lines.push(`**${label}**`, "", value, "");
		}
	});
	return `${lines.join("\n").replace(/\n+$/, "")}\n`;
}

export async function report(
	sessionId: string,
	params: Record<string, unknown> = {},
): Promise<{ markdown: string; path: string; count: number; bySeverity: Record<Severity, number> }> {
	const findings = await read(sessionId);
	const targets = Array.isArray(params.targets) ? params.targets.map(String) : [];
	const markdown = renderReport(findings, targets);
	await mkdir(dataDir(), { recursive: true });
	const path = join(dataDir(), "report.md");
	await writeFile(path, markdown, "utf8");
	return { markdown, path, count: findings.length, bySeverity: tally(findings) };
}

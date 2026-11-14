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

import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveDataDir, sessionKey } from "./paths";
import { toSarif } from "./sarif";

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
	code_locations?: { file: string; start_line?: number; end_line?: number }[];
	created_at: string;
}

export interface FindingsFile {
	bySeverity: Record<Severity, number>;
	count: number;
	findings: Finding[];
}

function dataDir(): string {
	return join(resolveDataDir(), "findings");
}

function fileFor(sessionId: string): string {
	return join(dataDir(), `${sessionKey(sessionId)}.json`);
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

/** The mutable half of a finding: what an agent may revise after further proof. */
const EDITABLE = [
	"title",
	"target",
	"description",
	"impact",
	"technicalAnalysis",
	"poc",
	"evidence",
	"remediation",
	"cwe",
	"cve",
	"confidence",
] as const;

const FIELD_OF: Record<(typeof EDITABLE)[number], keyof Finding> = {
	title: "title",
	target: "target",
	description: "description",
	impact: "impact",
	technicalAnalysis: "technical_analysis",
	poc: "poc_description",
	evidence: "evidence",
	remediation: "remediation_steps",
	cwe: "cwe",
	cve: "cve",
	confidence: "confidence",
};

export async function add(sessionId: string, params: Record<string, unknown>): Promise<{ finding: Finding } & FindingsFile> {
	const title = String(params.title ?? "").trim();
	if (!title) throw new Error("title is required");
	const raw = String(params.severity ?? "").trim().toLowerCase();
	if (!(SEVERITIES as readonly string[]).includes(raw)) {
		throw new Error(`severity must be one of ${SEVERITIES.join(", ")}`);
	}

	// The id is ours: a caller-supplied one could collide with an existing finding or
	// overwrite the report's links.
	const finding: Finding = {
		id: randomUUID().replace(/-/g, "").slice(0, 8),
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
		...(Array.isArray(params.codeLocations)
			? {
					code_locations: (params.codeLocations as Record<string, unknown>[])
						.filter((item) => typeof item.file === "string" && item.file)
						.map((item) => ({
							file: String(item.file),
							...(typeof item.startLine === "number" ? { start_line: item.startLine } : {}),
							...(typeof item.endLine === "number" ? { end_line: item.endLine } : {}),
						})),
				}
				: {}),
		created_at: new Date().toISOString(),
	};

	const findings = await read(sessionId);
	findings.push(finding);
	await write(sessionId, findings);
	return { finding, count: findings.length, bySeverity: tally(findings), findings: bySeverity(findings) };
}

/** Revise one finding by id, or by exact title when the caller does not have the id. */
export async function update(sessionId: string, params: Record<string, unknown>): Promise<{ finding: Finding } & FindingsFile> {
	const id = String(params.id ?? "").trim();
	const title = String(params.title ?? "").trim();
	if (!id && !title) throw new Error("id or title is required");

	const findings = await read(sessionId);
	const target = id ? findings.find((item) => item.id === id) : findings.find((item) => item.title === title);
	if (!target) throw new Error(`no finding matched ${id || title}`);

	for (const key of EDITABLE) {
		const value = params[key];
		if (typeof value === "string") (target[FIELD_OF[key]] as string) = value;
	}
	if (typeof params.cvss === "number") target.cvss = params.cvss;
	if (typeof params.severity === "string") target.severity = normalizeSeverity(params.severity);

	await write(sessionId, findings);
	return { finding: target, count: findings.length, bySeverity: tally(findings), findings: bySeverity(findings) };
}

/**
 * 删掉一条发现（上游 `delete_vulnerability_report`）。
 *
 * 为什么需要它：台账里会进真实的误报——某个“越权”最后证明是同一个人自己的两个账号。
 * 只能改不能删的话，那一条会永久占着报告，而报告是交给客户的。删一条比把它改成
 * `info` 诚实：后者仍在说“这里有个问题”。
 *
 * 删除是要不可逆的，所以回传完整台账与删除前的那条（供模型在回复里说明删了什么），
 * 不做静默丢弃。
 */
export async function remove(
	sessionId: string,
	params: Record<string, unknown>,
): Promise<{ deleted: Finding; count: number; bySeverity: Record<Severity, number>; findings: Finding[] }> {
	const id = String(params.id ?? "").trim();
	const title = String(params.title ?? "").trim();
	if (!id && !title) throw new Error("id or title is required");

	const findings = await read(sessionId);
	const index = id
		? findings.findIndex((item) => item.id === id)
		: findings.findIndex((item) => item.title === title);
	if (index < 0) throw new Error(`no finding matched ${id || title}`);

	const [deleted] = findings.splice(index, 1);
	await write(sessionId, findings);
	return {
		deleted: deleted as Finding,
		count: findings.length,
		bySeverity: tally(findings),
		findings: bySeverity(findings),
	};
}

/**
 * Merge one finding into another: the duplicate disappears, its evidence stays.
 *
 * Upstream collapses duplicates before writing the report (`strix/report/dedupe.py`).
 * The decision of *what* is a duplicate belongs to the model, but the merge itself must
 * be lossless and deterministic — an evidence line that only the duplicate carried is
 * exactly the line a reader will want when they reproduce the finding.
 */
export async function merge(
	sessionId: string,
	params: Record<string, unknown>,
): Promise<{ merged: { id: string; into: string }; count: number } & FindingsFile> {
	const id = String(params.id ?? "").trim();
	const into = String(params.into ?? "").trim();
	if (!id || !into) throw new Error("id and into are required");
	if (id === into) throw new Error("cannot merge a finding into itself");

	const findings = await read(sessionId);
	const duplicate = findings.find((item) => item.id === id);
	const keeper = findings.find((item) => item.id === into);
	if (!duplicate) throw new Error(`no finding matched ${id}`);
	if (!keeper) throw new Error(`no finding matched ${into}`);

	// Keep the higher severity: collapsing two reports must not downgrade the risk.
	const order = ["critical", "high", "medium", "low", "info"] as const;
	if (order.indexOf(duplicate.severity) < order.indexOf(keeper.severity)) keeper.severity = duplicate.severity;

	const extraEvidence = (duplicate.evidence ?? "").trim();
	if (extraEvidence && !(keeper.evidence ?? "").includes(extraEvidence)) {
		keeper.evidence = [keeper.evidence?.trim(), extraEvidence].filter(Boolean).join("\n\n---\n\n");
	}
	const note = typeof params.reason === "string" && params.reason.trim() ? params.reason.trim() : "same root cause";
	keeper.description = `${keeper.description ?? ""}${keeper.description ? "\n\n" : ""}(merged: ${note})`;

	const remaining = findings.filter((item) => item.id !== id);
	await write(sessionId, remaining);
	return { merged: { id, into }, count: remaining.length, bySeverity: tally(remaining), findings: bySeverity(remaining) };
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
export function renderReport(
	findings: readonly Finding[],
	targets: readonly string[],
	executiveSummary = "",
	/** The scope block the service assembled from the declared engagement scope. */
	scope = "",
): string {
	const ordered = bySeverity(findings);
	const counts = tally(ordered);
	const lines: string[] = ["# Penetration test report", ""];
	if (executiveSummary.trim()) lines.push(executiveSummary.trim(), "");
	if (targets.length) lines.push("## Targets", "", ...targets.map((target) => `- ${target}`), "");
	// 范围放在 findings 之前：读者先知道“允许测什么”，再看“测出了什么”。
	if (scope.trim()) lines.push("## Scope", "", scope.trim(), "");
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
	options: { version?: string } = {},
): Promise<{ markdown?: string; sarif?: unknown; path: string; count: number; bySeverity: Record<Severity, number> }> {
	const findings = await read(sessionId);
	const targets = Array.isArray(params.targets) ? params.targets.map(String) : [];
	await mkdir(dataDir(), { recursive: true });

	if (params.format === "sarif") {
		const sarif = toSarif(findings, { version: options.version ?? "0.0.0", targets });
		const path = join(dataDir(), "findings.sarif");
		await writeFile(path, `${JSON.stringify(sarif, null, 2)}\n`, "utf8");
		return { sarif, path, count: findings.length, bySeverity: tally(findings) };
	}

	const markdown = renderReport(
		findings,
		targets,
		String(params.executiveSummary ?? ""),
		String(params.scope ?? ""),
	);
	const path = join(dataDir(), "report.md");
	await writeFile(path, markdown, "utf8");
	return { markdown, path, count: findings.length, bySeverity: tally(findings) };
}

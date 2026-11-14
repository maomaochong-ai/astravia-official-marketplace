/**
 * Coverage, and the threat model it is measured against.
 *
 * Upstream treats coverage as a first-class artefact (`strix/tools/coverage`,
 * `threat_model`): the agent records every surface it tested with the outcome, and
 * the final report can say what was *not* tested. That honesty is the difference
 * between a pentest and a scanner run, so it is stored next to the findings rather
 * than inferred from them.
 *
 * The threat model is a single Markdown document per assessment - written once,
 * revised as the surface becomes clear - with the targets it covers.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { resolveDataDir, sessionKey } from "./paths";
import { randomUUID } from "node:crypto";

export const OUTCOMES = ["vulnerable", "clean", "skipped"] as const;
export type Outcome = (typeof OUTCOMES)[number];

export interface CoverageEntry {
	id: string;
	surface: string;
	outcome: Outcome;
	technique: string;
	evidence: string;
	note: string;
	created_at: string;
	/** 改过的记录留下痕迹：报告里能看出哪些结论被修正过（对应上游 update_coverage）。 */
	updated_at?: string;
}

export interface ThreatModel {
	content: string;
	targets: string[];
	updated_at: string | null;
}

function outcome(value: unknown): Outcome {
	const text = String(value ?? "").trim().toLowerCase();
	if (!(OUTCOMES as readonly string[]).includes(text)) {
		throw new Error(`outcome must be one of ${OUTCOMES.join(", ")}`);
	}
	return text as Outcome;
}

function fileFor(dir: string, sessionId: string, name: string): string {
	return join(dir, name, `${sessionKey(sessionId)}.json`);
}

export class CoverageStore {
	constructor(private readonly dir: string = resolveDataDir()) {}

	private coverageFile(sessionId: string): string {
		return fileFor(this.dir, sessionId, "coverage");
	}

	private threatFile(sessionId: string): string {
		return fileFor(this.dir, sessionId, "threat-model");
	}

	private async readCoverage(sessionId: string): Promise<CoverageEntry[]> {
		try {
			const parsed: unknown = JSON.parse(await readFile(this.coverageFile(sessionId), "utf8"));
			return Array.isArray(parsed) ? (parsed as CoverageEntry[]) : [];
		} catch {
			return [];
		}
	}

	private async writeCoverage(sessionId: string, entries: CoverageEntry[]): Promise<void> {
		await mkdir(join(this.dir, "coverage"), { recursive: true });
		await writeFile(this.coverageFile(sessionId), `${JSON.stringify(entries, null, 2)}\n`, "utf8");
	}

	async record(
		sessionId: string,
		params: Record<string, unknown>,
	): Promise<{ count: number; byOutcome: Record<Outcome, number>; entry: CoverageEntry }> {
		const surface = String(params.surface ?? "").trim();
		if (!surface) throw new Error("surface is required");
		const entry: CoverageEntry = {
			id: randomUUID().replace(/-/g, "").slice(0, 6),
			surface,
			outcome: outcome(params.outcome),
			technique: String(params.technique ?? "").trim(),
			evidence: String(params.evidence ?? "").trim(),
			note: String(params.note ?? "").trim(),
			created_at: new Date().toISOString(),
		};
		const entries = [entry, ...(await this.readCoverage(sessionId))];
		await this.writeCoverage(sessionId, entries);
		return { count: entries.length, byOutcome: tally(entries), entry };
	}

	/**
	 * 改一条已有覆盖记录（上游 `update_coverage`）。
	 *
	 * 为什么要这个：第一次记录时的判断常常是错的——一个面先写成 `clean`，后来在它上面
	 * 确认了越权。只能 record 的话，修正意味着再加一条相反的记录，台账里就同时存在
	 * ”没问”和“有问题”；报告读者看到两个互相矛盾的结论。改一条比覆写一条诚实。
	 */
	async update(
		sessionId: string,
		params: Record<string, unknown>,
	): Promise<{ count: number; byOutcome: Record<Outcome, number>; entry: CoverageEntry }> {
		const id = String(params.id ?? "").trim();
		if (!id) throw new Error("id is required");
		const entries = await this.readCoverage(sessionId);
		const target = entries.find((entry) => entry.id === id);
		if (!target) throw new Error(`no coverage entry ${id}`);
		if (params.outcome !== undefined) target.outcome = outcome(params.outcome);
		for (const key of ["technique", "evidence", "note", "surface"] as const) {
			if (params[key] === undefined) continue;
			const value = String(params[key]).trim();
			if (key === "surface" && !value) throw new Error("surface cannot be empty");
			target[key] = value;
		}
		target.updated_at = new Date().toISOString();
		await this.writeCoverage(sessionId, entries);
		return { count: entries.length, byOutcome: tally(entries), entry: target };
	}
	async list(
		sessionId: string,
		params: Record<string, unknown> = {},
	): Promise<{ count: number; byOutcome: Record<Outcome, number>; entries: CoverageEntry[] }> {
		const filter = params.outcome ? outcome(params.outcome) : undefined;
		const entries = (await this.readCoverage(sessionId)).filter((entry) =>
			filter ? entry.outcome === filter : true,
		);
		return { count: entries.length, byOutcome: tally(entries), entries };
	}

	async threatModel(sessionId: string, params: Record<string, unknown> = {}): Promise<ThreatModel> {
		const path = this.threatFile(sessionId);
		let current: ThreatModel = { content: "", targets: [], updated_at: null };
		try {
			current = JSON.parse(await readFile(path, "utf8")) as ThreatModel;
		} catch {
			/* no model yet */
		}
		if (typeof params.content !== "string") return current;
		const next: ThreatModel = {
			content: params.content,
			targets: Array.isArray(params.targets) ? params.targets.map(String) : current.targets,
			updated_at: new Date().toISOString(),
		};
		await mkdir(join(this.dir, "threat-model"), { recursive: true });
		await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
		return next;
	}
}

export function tally(entries: readonly CoverageEntry[]): Record<Outcome, number> {
	const counts: Record<Outcome, number> = { vulnerable: 0, clean: 0, skipped: 0 };
	for (const entry of entries) counts[entry.outcome] += 1;
	return counts;
}

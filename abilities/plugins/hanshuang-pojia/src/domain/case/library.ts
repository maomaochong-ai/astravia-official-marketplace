/**
 * Case index — reads the declarations `case/contract.ts` writes and turns them into a
 * queryable precedent list.
 *
 * Upstream keeps its packages under `Tool/cases/` with no index; finding the right precedent is
 * a directory walk plus reading. The mechanism worth copying is the retrieval, not the corpus
 * (ADR 0001 §2.3 keeps the corpus out of the package). So this module scans the operator's own
 * `cases/` and `work/` namespaces, parses each `scope.md`, and ranks them against a query.
 *
 * Nothing here judges a case: there is no readiness verdict, no blocker list and no "ready"
 * bonus in the ranking. A case is a record of what was examined, and the index only answers
 * "which record matches this query".
 */
import { joinPath } from "../toolchain/paths";

export interface CaseDirEntry {
	name: string;
	path: string;
	isDirectory: boolean;
	modifiedAt?: number;
}

/** Narrow read-only port so tools can pass `ctx.host.fs` and tests can pass a map. */
export interface CaseReadPort {
	readDir(path: string): Promise<CaseDirEntry[]>;
	readText(path: string): Promise<string | null>;
}

export interface CaseRecord {
	name: string;
	path: string;
	preset?: string;
	authStatus?: string;
	networkProfile?: string;
	sample?: string;
	inScope: string[];
	outOfScope: string[];
	deliverables: string[];
	evidenceCount: number;
	notes: { implemented: number; rejected: number };
	updatedAt?: number;
}

/** Case directories only live in these two namespaces; a full-tree walk is not affordable. */
export const CASE_NAMESPACE_DIRS = ["cases", "work"] as const;
export const MAX_CASE_DIRECTORIES = 200;

const NOT_PROVIDED = /^\(not provided\)$/i;

function splitSections(markdown: string): Map<string, string[]> {
	const sections = new Map<string, string[]>();
	let current = "_preamble";
	sections.set(current, []);
	for (const line of markdown.split(/\r?\n/)) {
		const heading = /^##\s+(.+?)\s*$/.exec(line);
		if (heading) {
			current = heading[1]!.toLowerCase();
			if (!sections.has(current)) sections.set(current, []);
			continue;
		}
		sections.get(current)?.push(line);
	}
	return sections;
}

function pairs(lines: readonly string[] | undefined): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of lines ?? []) {
		const match = /^\s*[-*]\s+([a-z_]+):\s*(.*)$/i.exec(line);
		if (!match) continue;
		const value = match[2]!.trim();
		if (value.length > 0 && !NOT_PROVIDED.test(value)) out[match[1]!.toLowerCase()] = value;
	}
	return out;
}

export interface ParsedScope {
	preset?: string;
	hint?: string;
	sample?: string;
	authStatus?: string;
	authBasis?: string;
	networkProfile?: string;
	inScope: string[];
	outOfScope: string[];
	deliverables: string[];
}

/**
 * Upstream writes lists as `- assets:` followed by indented `  - <item>` lines. An inline
 * `- assets: []` means the empty list, which is not the same as "not provided".
 */
function nestedList(lines: readonly string[] | undefined, key: string): string[] {
	const out: string[] = [];
	let inside = false;
	for (const line of lines ?? []) {
		const head = /^\s*[-*]\s+([a-z_]+):\s*(.*)$/i.exec(line);
		if (head && !/^\s{2,}/.test(line)) {
			inside = head[1]!.toLowerCase() === key.toLowerCase();
			const inline = head[2]!.trim();
			if (inside && inline && inline !== "[]" && !NOT_PROVIDED.test(inline)) out.push(inline);
			continue;
		}
		if (!inside) continue;
		const item = /^\s{2,}[-*]\s+(.+?)\s*$/.exec(line)?.[1];
		if (item) out.push(item);
	}
	return out;
}

export function parseScope(markdown: string): ParsedScope {
	const sections = splitSections(markdown);
	const meta = pairs(sections.get("meta"));
	const auth = pairs(sections.get("auth"));
	const network = pairs(sections.get("network_profile"));
	const inScopeLines = sections.get("in_scope");
	const offlineSample = network.offline_sample;
	return {
		preset: meta.preset,
		hint: meta.hint,
		sample: offlineSample && !/^\(none\)$/i.test(offlineSample) ? offlineSample : undefined,
		authStatus: auth.status,
		authBasis: auth.basis,
		networkProfile: network.mode,
		inScope: nestedList(inScopeLines, "assets"),
		// `- activities:` and `- surfaces:` are structural, never assets.
		outOfScope: nestedList(sections.get("out_of_scope"), "assets"),
		deliverables: nestedList(sections.get("deliverables"), "planned"),
	};
}

export function countEvidence(entries: readonly CaseDirEntry[]): number {
	return entries.filter(entry => !entry.isDirectory && /^E-\d+/i.test(entry.name)).length;
}

async function countNotes(port: CaseReadPort, casePath: string): Promise<{ implemented: number; rejected: number }> {
	const counts = { implemented: 0, rejected: 0 };
	for (const status of ["implemented", "rejected"] as const) {
		const base = joinPath(joinPath(casePath, ".agents/notes"), status);
		const categories = await safeReadDir(port, base);
		for (const category of categories) {
			if (!category.isDirectory) continue;
			const files = await safeReadDir(port, category.path);
			counts[status] += files.filter(file => !file.isDirectory && file.name.endsWith(".md")).length;
		}
	}
	return counts;
}

async function safeReadDir(port: CaseReadPort, path: string): Promise<CaseDirEntry[]> {
	try {
		return await port.readDir(path);
	} catch {
		return [];
	}
}

async function readCase(port: CaseReadPort, entry: CaseDirEntry): Promise<CaseRecord | null> {
	const scope = await port.readText(joinPath(entry.path, "scope.md"));
	if (scope === null) return null;
	const parsed = parseScope(scope);
	return {
		name: entry.name,
		path: entry.path,
		preset: parsed.preset,
		authStatus: parsed.authStatus,
		networkProfile: parsed.networkProfile,
		sample: parsed.sample,
		inScope: parsed.inScope,
		outOfScope: parsed.outOfScope,
		deliverables: parsed.deliverables,
		evidenceCount: countEvidence(await safeReadDir(port, joinPath(entry.path, "evidence"))),
		notes: await countNotes(port, entry.path),
		updatedAt: entry.modifiedAt,
	};
}

export interface ScanResult {
	root: string;
	cases: CaseRecord[];
	/** Case directories found beyond the cap; non-zero means the answer is partial. */
	truncated: number;
}

export async function scanCases(port: CaseReadPort, root: string): Promise<ScanResult> {
	const found: CaseDirEntry[] = [];
	for (const namespace of CASE_NAMESPACE_DIRS) {
		const base = joinPath(root, namespace);
		for (const child of await safeReadDir(port, base)) {
			if (child.isDirectory && !child.name.startsWith(".")) found.push(child);
		}
	}
	found.sort((a, b) => a.name.localeCompare(b.name));

	const kept = found.slice(0, MAX_CASE_DIRECTORIES);
	const records: CaseRecord[] = [];
	for (const entry of kept) {
		const record = await readCase(port, entry);
		if (record) records.push(record);
	}
	return { root, cases: records, truncated: found.length - kept.length };
}

export interface CaseHit {
	record: CaseRecord;
	/** 排序分，只由查询词贡献。 */
	score: number;
	reasons: string[];
}

const NAME_WEIGHT = 6;
const SCOPE_WEIGHT = 3;
const META_WEIGHT = 1;

/** Each hit says *why* it matched, so a ranking is never an unexplainable number. */
export function rankCases(
	records: readonly CaseRecord[],
	query: string | undefined,
	options: { limit?: number } = {},
): CaseHit[] {
	const tokens = (query ?? "")
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);
	const hits: CaseHit[] = records.map(record => {
		const reasons: string[] = [];
		let matched = 0;
		for (const token of tokens) {
			if (record.name.toLowerCase().includes(token)) {
				matched += NAME_WEIGHT;
				reasons.push(`name matches "${token}"`);
				continue;
			}
			if (record.inScope.some(asset => asset.toLowerCase().includes(token))) {
				matched += SCOPE_WEIGHT;
				reasons.push(`in-scope asset matches "${token}"`);
				continue;
			}
			const meta = [record.preset, record.networkProfile, ...record.deliverables].filter(Boolean).join(" ").toLowerCase();
			if (meta.includes(token)) {
				matched += META_WEIGHT;
				reasons.push(`preset or deliverable matches "${token}"`);
			}
		}
		if (tokens.length === 0) reasons.push("no query: listing the index");
		return { record, score: matched, reasons };
	});
	const filtered = tokens.length > 0 ? hits.filter(hit => hit.score > 0) : hits;
	filtered.sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name));
	return typeof options.limit === "number" ? filtered.slice(0, options.limit) : filtered;
}

export function renderCaseHit(hit: CaseHit): string {
	const { record } = hit;
	const facts = [
		`preset ${record.preset ?? "?"}`,
		`network ${record.networkProfile ?? "?"}`,
		`in scope ${record.inScope.length}`,
		`evidence ${record.evidenceCount}`,
		`notes ${record.notes.implemented} implemented / ${record.notes.rejected} rejected`,
	];
	return [
		`### ${record.name}`,
		"",
		`- path: ${record.path}`,
		`- ${facts.join(" · ")}`,
		`- why: ${hit.reasons.join("; ")}`,
		`- next: read ${joinPath(record.path, "scope.md")} then ${joinPath(record.path, "evidence")}/`,
	].join("\n");
}

export function renderCaseIndex(scan: ScanResult, hits: readonly CaseHit[], query?: string): string {
	if (scan.cases.length === 0) {
		return [
			`No cases under ${scan.root}.`,
			"",
			`Looked in ${CASE_NAMESPACE_DIRS.map(name => `${name}/*/scope.md`).join(" and ")}.`,
			"Create one with init_task (preset + in_scope), which writes scope.md and timeline.md; the case then",
			"shows up here and reads as precedent for the next target.",
		].join("\n");
	}
	const head = `Case index — ${scan.root} (${scan.cases.length} case${scan.cases.length === 1 ? "" : "s"})`;
	const trimmed = query?.trim() ?? "";
	const body =
		hits.length === 0
			? [`No case matches "${trimmed}".`, "", "Widen the query, or list the index without one."]
			: hits.map(renderCaseHit);
	return [
		head,
		"",
		...(trimmed ? [`Query: ${trimmed}`, ""] : []),
		...body,
		...(scan.truncated > 0 ? ["", `Truncated: ${scan.truncated} more case directories were not read.`] : []),
	].join("\n");
}

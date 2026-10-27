/**
 * Case index — reads the declarations `case/contract.ts` writes and turns them into a
 * queryable precedent list.
 *
 * Upstream keeps its 14 packages under `Tool/cases/` with no index; finding the right
 * precedent is a directory walk plus reading. The mechanism worth copying is the retrieval,
 * not the corpus (ADR 0001 §2.3 keeps the corpus out of the package). So this module scans
 * the operator's own `cases/` and `work/` namespaces, re-derives each case's readiness from
 * the scope text, and ranks them against a query.
 */
import { joinPath } from "../toolchain/paths";
import { CASE_DOCUMENTS, assessReadiness } from "./contract";

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

export interface CaseWorkItem {
	id: string;
	title: string;
	target: string;
	surface: string;
	status: string;
}

export interface CaseRecord {
	name: string;
	path: string;
	preset?: string;
	authStatus?: string;
	networkProfile?: string;
	/** Readiness needs it: upstream's offline gate opens only on an explicit sample. */
	sample?: string;
	ready: boolean;
	blockers: string[];
	inScope: string[];
	outOfScope: string[];
	deliverables: string[];
	workItems: CaseWorkItem[];
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

export interface ParsedAuthRecord {
	/** ISO timestamp of the winning record, when the block carried one. */
	at?: string;
	status?: string;
	basis?: string;
	evidence?: string;
}

/**
 * `auth-log.md` is append-only and the last block stands (ADR 0009). A block without a status
 * token is skipped rather than guessed: an unreadable record must never open the gate.
 */
export function parseAuthLog(markdown: string): ParsedAuthRecord {
	if (!markdown) return {};
	const blocks = markdown.split(/^## /m).slice(1);
	for (let index = blocks.length - 1; index >= 0; index -= 1) {
		const [heading = "", ...rest] = (blocks[index] ?? "").split(/\r?\n/);
		const [at = "", status = ""] = heading.split("|").map(cell => cell.trim());
		if (!status) continue;
		const fields = pairs(rest);
		return { at: at || undefined, status, basis: fields.basis, evidence: fields.evidence };
	}
	return {};
}

/**
 * The one place the log/scope precedence is decided (ADR 0009): the log wins whenever it carries
 * a status, because it is the later record. Both readers — `readCase` for `search_cases` and
 * `init_task`'s gate — must agree, so they call this instead of repeating `log.status ?? …`.
 */
export function effectiveAuthStatus(scopeStatus: string | undefined, log: ParsedAuthRecord): string {
	return log.status ?? scopeStatus ?? "";
}

/**
 * Table rows only; the prose and the coverage list are not work items. The status cell is
 * the sixth column, so the row is split rather than matched left to right.
 */
export function parseWorkItems(markdown: string): CaseWorkItem[] {
	const items: CaseWorkItem[] = [];
	for (const line of markdown.split(/\r?\n/)) {
		if (!line.startsWith("|")) continue;
		const cells = line.split("|").slice(1, -1).map(cell => cell.trim());
		if (cells.length < 6) continue;
		const [id, title, , target, surface, status] = cells;
		if (!id || !/^WI-\d+$/i.test(id)) continue;
		items.push({
			id: id.toUpperCase(),
			title: title ?? "",
			target: target ?? "",
			surface: surface ?? "",
			status: (status ?? "").toLowerCase(),
		});
	}
	return items;
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
	// 授权晚到是常态：日志里的最后一条盖过 scope.md 的 `## auth`，字段口径本身不变。
	const log = parseAuthLog((await port.readText(joinPath(entry.path, CASE_DOCUMENTS.authLog))) ?? "");
	const authStatus = effectiveAuthStatus(parsed.authStatus, log);
	const readiness = assessReadiness({
		// 原文直送：契约就读原始字符串，认不出的词由它报 blocker，不在这里二次解释。
		authStatus: authStatus ?? "",
		inScope: parsed.inScope,
		networkProfile: parsed.networkProfile ?? "",
		sample: parsed.sample,
	});
	const workItemsText = (await port.readText(joinPath(entry.path, "workitems.md"))) ?? "";
	return {
		name: entry.name,
		path: entry.path,
		preset: parsed.preset,
		authStatus: authStatus,
		networkProfile: parsed.networkProfile,
		sample: parsed.sample,
		ready: readiness.ready,
		blockers: readiness.blockers,
		inScope: parsed.inScope,
		outOfScope: parsed.outOfScope,
		deliverables: parsed.deliverables,
		workItems: parseWorkItems(workItemsText),
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
	/** 排序分：匹配分 + 就绪加分。 */
	score: number;
	/** 只由查询词贡献的分。过滤用它，所以不相关的案例不会被 ready 加分重新拉回来。 */
	matched: number;
	reasons: string[];
}

const NAME_WEIGHT = 6;
const SCOPE_WEIGHT = 3;
const META_WEIGHT = 1;

/** Each hit says *why* it matched, so a ranking is never an unexplainable number. */
export function rankCases(
	records: readonly CaseRecord[],
	query: string | undefined,
	options: { readyOnly?: boolean; limit?: number } = {},
): CaseHit[] {
	const pool = options.readyOnly ? records.filter(record => record.ready) : records;
	const tokens = (query ?? "")
		.toLowerCase()
		.split(/\s+/)
		.filter(Boolean);
	const hits: CaseHit[] = pool.map(record => {
		const reasons: string[] = [];
		// 匹配分为 0 的案例不能被 ready 加分救回来：有查询却返回不相关的案例，与不排序一样无用。
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
		const readinessBonus = record.ready ? META_WEIGHT : 0;
		if (record.ready) reasons.push("ready for act");
		return { record, score: matched + readinessBonus, matched, reasons };
	});
	const filtered = tokens.length > 0 ? hits.filter(hit => hit.matched > 0) : hits;
	filtered.sort((a, b) => b.score - a.score || a.record.name.localeCompare(b.record.name));
	return typeof options.limit === "number" ? filtered.slice(0, options.limit) : filtered;
}

function doneCount(record: CaseRecord): number {
	return record.workItems.filter(item => item.status === "done").length;
}

export function renderCaseHit(hit: CaseHit): string {
	const { record } = hit;
	const facts = [
		`preset ${record.preset ?? "?"}`,
		`auth ${record.authStatus ?? "?"}`,
		`network ${record.networkProfile ?? "?"}`,
		`in scope ${record.inScope.length}`,
		`evidence ${record.evidenceCount}`,
		`work items ${doneCount(record)}/${record.workItems.length} done`,
		`notes ${record.notes.implemented} implemented / ${record.notes.rejected} rejected`,
	];
	return [
		`### ${record.name} — ${record.ready ? "ready for act" : "not ready"}`,
		"",
		`- path: ${record.path}`,
		`- ${facts.join(" · ")}`,
		...(record.blockers.length > 0 ? [`- blockers: ${record.blockers.join("; ")}`] : []),
		`- why: ${hit.reasons.join("; ")}`,
		`- next: read ${joinPath(record.path, "scope.md")} then ${joinPath(record.path, "workitems.md")}`,
	].join("\n");
}

export function renderCaseIndex(scan: ScanResult, hits: readonly CaseHit[], query?: string): string {
	if (scan.cases.length === 0) {
		return [
			`No cases under ${scan.root}.`,
			"",
			`Looked in ${CASE_NAMESPACE_DIRS.map(name => `${name}/*/scope.md`).join(" and ")}.`,
			"Create one with init_task (preset + auth_status + in_scope), which writes scope.md, timeline.md and",
			"workitems.md; the case then shows up here and reads as precedent for the next target.",
		].join("\n");
	}
	const ready = scan.cases.filter(record => record.ready).length;
	const head = `Case index — ${scan.root} (${scan.cases.length} case${scan.cases.length === 1 ? "" : "s"}, ${ready} ready)`;
	const trimmed = query?.trim() ?? "";
	// 空命中不等于「查询无结果」：ready_only 也会把 hits 筛空，而那时调用方根本没传 query。
	// 两种空态说两句话，不要把内部变量当成用户文案。
	const body =
		hits.length === 0
			? trimmed
				? [`No case matches "${trimmed}".`, "", "Widen the query, or list the index without one."]
				: [
						"No case is ready for act yet.",
						"",
						"Every case under this root still has a blocker; drop ready_only to list them, or read the blockers.",
					]
			: hits.map(renderCaseHit);
	return [
		head,
		"",
		...(trimmed ? [`Query: ${trimmed}`, ""] : []),
		...body,
		...(scan.truncated > 0 ? ["", `Truncated: ${scan.truncated} more case directories were not read.`] : []),
	].join("\n");
}

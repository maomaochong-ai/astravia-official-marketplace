/**
 * Engagement scope — what this assessment is allowed to touch.
 *
 * Upstream keeps this as `scope_*` tools backed by the run's own state, and uses it in two
 * places: the report states it, and the agent is expected to check itself against it before
 * expanding a scan. Here it is a small JSON store beside the notes and todos, and it is
 * included in every report so a reader can see whether the evidence was collected inside
 * the agreed boundary.
 *
 * What this deliberately is **not**: a firewall. It does not parse `strix_exec` command
 * lines and refuse to run them — a regex over shell text is trivially defeated (variables,
 * pipes, `printf`) and would give false assurance. Instead:
 *
 *  - `strix_exec` gets an `outOfScope` advisory when the command mentions a host that the
 *    declared scope does not cover, and the panel shows it in the trace;
 *  - the report prints the scope next to the findings.
 *
 * That keeps the honest contract: the operator declares scope, the tooling makes drift
 * visible, the human stays the authority (ADR strix-0004).
 */

import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

export interface ScopeEntry {
	id: string;
	/** `domain` matches itself and its subdomains; `ip` / `cidr` / `url` match literally. */
	kind: "domain" | "ip" | "cidr" | "url";
	value: string;
	note?: string;
	createdAt: string;
}

export interface ScopeRules {
	/** Ports the operator agreed to. Empty means "any". */
	ports: string[];
	/** Free-form boundaries: hours, rate limits, forbidden techniques. */
	notes: string[];
	updatedAt: string | null;
}

export interface ScopeSnapshot {
	entries: ScopeEntry[];
	rules: ScopeRules;
}

const EMPTY_RULES: ScopeRules = { ports: [], notes: [], updatedAt: null };

const KINDS = new Set(["domain", "ip", "cidr", "url"]);

/** Lower-case, strip scheme and trailing dot: `https://A.test./x` and `a.test` are one host. */
export function normalizeScopeValue(raw: string): string {
	let value = raw.trim().toLowerCase();
	if (!value) return "";
	if (value.includes("://")) {
		try {
			value = new URL(value).host;
		} catch {
			/* keep the literal text: a malformed URL is still a declaration */
		}
	}
	value = value.replace(/\/.*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
	return value;
}

export function asScopeKind(raw: unknown, value: string): ScopeEntry["kind"] {
	const kind = String(raw ?? "").trim().toLowerCase();
	if (KINDS.has(kind)) return kind as ScopeEntry["kind"];
	if (/^\d+\.\d+\.\d+\.\d+$/.test(value)) return "ip";
	if (value.includes("/")) return "cidr";
	return "domain";
}

/** Domain scope covers subdomains; everything else is an exact match. */
export function covers(entry: ScopeEntry, host: string): boolean {
	const target = normalizeScopeValue(host);
	if (!target) return false;
	if (entry.kind === "domain") return target === entry.value || target.endsWith(`.${entry.value}`);
	if (entry.kind === "url") return target === entry.value;
	return target === entry.value;
}

/**
 * Hosts mentioned in a command that the scope does not cover.
 *
 * Advisory only, and intentionally crude: it looks for dotted tokens and URLs, skips the
 * loopback and the ones already declared. A false positive costs one line in the trace; a
 * false negative costs nothing, because nothing is being enforced here.
 */
export function outOfScopeHosts(command: string, entries: readonly ScopeEntry[]): string[] {
	const candidates = new Set<string>();
	for (const match of command.matchAll(/https?:\/\/[^\s'"`]+/gi)) candidates.add(match[0]);
	for (const match of command.matchAll(/\b(?:[a-z0-9-]+\.)+[a-z]{2,}\b/gi)) candidates.add(match[0]);
	for (const match of command.matchAll(/\b\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?\b/g)) candidates.add(match[0]);

	const outside: string[] = [];
	for (const candidate of candidates) {
		const host = normalizeScopeValue(candidate);
		if (!host) continue;
		if (/^(?:127\.0\.0\.1|localhost|0\.0\.0\.0|::1)$/.test(host)) continue;
		// Tool names and file extensions look like dotted tokens; neither is a host.
		if (/\.(?:py|js|ts|json|md|txt|sh|yml|yaml|log|png|jpg|html|go|rb|php|zip|gz)$/.test(host)) continue;
		if (entries.some((entry) => covers(entry, host))) continue;
		outside.push(host);
	}
	return [...new Set(outside)].slice(0, 12);
}

function scopeFile(dataDir: string): string {
	return join(dataDir, "scope.json");
}

async function read(file: string): Promise<ScopeSnapshot> {
	try {
		const parsed = JSON.parse(await readFile(file, "utf8")) as Partial<ScopeSnapshot>;
		return {
			entries: Array.isArray(parsed.entries) ? (parsed.entries as ScopeEntry[]) : [],
			rules: { ...EMPTY_RULES, ...(parsed.rules ?? {}) },
		};
	} catch {
		return { entries: [], rules: { ...EMPTY_RULES } };
	}
}

async function write(file: string, snapshot: ScopeSnapshot): Promise<void> {
	await mkdir(join(file, ".."), { recursive: true });
	await writeFile(file, JSON.stringify(snapshot, null, 2), "utf8");
}

export class ScopeStore {
	constructor(private readonly dataDir: string) {}

	async snapshot(): Promise<ScopeSnapshot> {
		return read(scopeFile(this.dataDir));
	}

	async add(args: Record<string, unknown>): Promise<ScopeSnapshot & { added: ScopeEntry[] }> {
		const file = scopeFile(this.dataDir);
		const snapshot = await read(file);
		const raw = Array.isArray(args.targets) ? args.targets.map(String) : args.target ? [String(args.target)] : [];
		const added: ScopeEntry[] = [];
		for (const item of raw) {
			const value = normalizeScopeValue(item);
			if (!value) continue;
			if (snapshot.entries.some((entry) => entry.value === value)) continue;
			const entry: ScopeEntry = {
				id: randomUUID().slice(0, 8),
				kind: asScopeKind(args.kind, value),
				value,
				...(typeof args.note === "string" && args.note.trim() ? { note: args.note.trim() } : {}),
				createdAt: new Date().toISOString(),
			};
			snapshot.entries.push(entry);
			added.push(entry);
		}
		await write(file, snapshot);
		return { ...snapshot, added };
	}

	async remove(args: Record<string, unknown>): Promise<ScopeSnapshot & { removed: string[] }> {
		const file = scopeFile(this.dataDir);
		const snapshot = await read(file);
		const ids = Array.isArray(args.ids) ? args.ids.map(String) : [];
		const value = typeof args.target === "string" ? normalizeScopeValue(args.target) : "";
		const before = snapshot.entries.length;
		snapshot.entries = snapshot.entries.filter(
			(entry) => !ids.includes(entry.id) && (!value || entry.value !== value),
		);
		await write(file, snapshot);
		return { ...snapshot, removed: Array.from({ length: before - snapshot.entries.length }, (_, index) => String(index)) };
	}

	async setRules(args: Record<string, unknown>): Promise<ScopeSnapshot> {
		const file = scopeFile(this.dataDir);
		const snapshot = await read(file);
		snapshot.rules = {
			ports: Array.isArray(args.ports) ? args.ports.map(String) : snapshot.rules.ports,
			notes: Array.isArray(args.notes) ? args.notes.map(String) : snapshot.rules.notes,
			updatedAt: new Date().toISOString(),
		};
		await write(file, snapshot);
		return snapshot;
	}
}

/** The report's scope section: what was allowed, in one compact block. */
export function describeScope(snapshot: ScopeSnapshot): string {
	if (snapshot.entries.length === 0 && snapshot.rules.notes.length === 0) {
		return "_No scope was declared for this assessment._";
	}
	const lines: string[] = [];
	if (snapshot.entries.length) {
		lines.push("**In scope**");
		for (const entry of snapshot.entries) {
			lines.push(`- \`${entry.value}\` (${entry.kind})${entry.note ? ` — ${entry.note}` : ""}`);
		}
	}
	if (snapshot.rules.ports.length) lines.push(`**Ports** ${snapshot.rules.ports.join(", ")}`);
	if (snapshot.rules.notes.length) {
		lines.push("**Boundaries**");
		for (const note of snapshot.rules.notes) lines.push(`- ${note}`);
	}
	return lines.join("\n");
}

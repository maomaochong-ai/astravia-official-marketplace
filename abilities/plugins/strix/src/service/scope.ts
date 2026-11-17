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
 * visible, the human stays the authority.
 */

import { createHash, randomUUID } from "node:crypto";
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
	// CIDR 的 `/` 是语法而不是路径：先认出来，别把它剥成裸 IP（审查指出 10.0.0.0/24 会变成 10.0.0.0）。
	// 端口不参与判定，所以这里仍然剥掉 `:port`；掩码则要留。
	if (/^\d{1,3}(?:\.\d{1,3}){3}\/\d{1,2}$/.test(value)) return value;
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

/**
 * 每个会话一份范围文件。
 *
 * 曾经只有一份 `scope.json`：A 会话声明了 a.test、B 会话声明了 b.test，两边写的是同一个
 * 文件，于是两个面板都画出「a.test、b.test」——用户看到的就是「多个目标混在一起」。
 * 范围是评估的属性（这次允许碰什么），不是机器的属性，所以它必须跟台账同一粒度。
 */
function scopeFile(dataDir: string, key: string): string {
	return join(dataDir, "scope", `${safeKey(key)}.json`);
}

/** 会话 id 不一定是文件名安全的（含 `/`、`:` 等），做一层 slug + 短哈希防撞。 */
export function safeKey(key: string): string {
	const raw = key.trim() || "default";
	const slug = raw.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 48) || "default";
	return `${slug}-${createHash("sha1").update(raw).digest("hex").slice(0, 8)}`;
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

	/**
	 * 旧安装只有一份 `scope.json`。升级后第一次被问到时**搬一次**：搬给当时问的那个会话，
	 * 再写一个标记文件，以后不再猜。
	 *
	 * 为什么允许这一次猜测：旧文件是这台机器上一个人写下的，此刻活着的会话就是想看它的
	 * 那一个。不猜，用户的声明会静默消失，比猜错更难解释；猜错也只错一次，改回来就是。
	 */
	private async adoptLegacy(key: string): Promise<boolean> {
		const legacy = join(this.dataDir, "scope.json");
		const marker = join(this.dataDir, "scope", ".legacy-adopted.json");
		try {
			await readFile(marker, "utf8");
			return false;
		} catch {
			/* 没搬过 */
		}
		let text: string;
		try {
			text = await readFile(legacy, "utf8");
		} catch {
			return false;
		}
		if (!text.trim()) return false;
		try {
			await write(scopeFile(this.dataDir, key), JSON.parse(text) as ScopeSnapshot);
		} catch {
			return false;
		}
		await mkdir(join(this.dataDir, "scope"), { recursive: true });
		await writeFile(marker, JSON.stringify({ to: key, at: new Date().toISOString() }, null, 2), "utf8");
		// 旧文件留一份可查的副本，并把原名清空：从此没有任何会话会读到它。
		await writeFile(join(this.dataDir, "scope.legacy.json"), text, "utf8");
		await writeFile(legacy, "", "utf8").catch(() => undefined);
		return true;
	}

	async snapshot(key: string): Promise<ScopeSnapshot> {
		await this.adoptLegacy(key);
		return read(scopeFile(this.dataDir, key));
	}

	async add(key: string, args: Record<string, unknown>): Promise<ScopeSnapshot & { added: ScopeEntry[] }> {
		const file = scopeFile(this.dataDir, key);
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

	async remove(key: string, args: Record<string, unknown>): Promise<ScopeSnapshot & { removed: string[] }> {
		const file = scopeFile(this.dataDir, key);
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

	async setRules(key: string, args: Record<string, unknown>): Promise<ScopeSnapshot> {
		const file = scopeFile(this.dataDir, key);
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

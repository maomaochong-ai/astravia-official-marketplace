/**
 * 历史（上游 `interface/viewer` 的诚实等价物）。
 *
 * 上游的 viewer 是一个网页，能翻看过去每次 run 的完整事件流。本插件没有事件流落盘
 * （那不是我们的事实：一轮对话归宿主），所以"历史"在这里的定义收窄成**评估账**：
 * 每次评估留下了什么——目标、覆盖、发现数、报告是否存在。
 *
 * 为什么值得做：台账文件本来就是按评估写的，只是没人能一次看全。列表化之后，
 * "上次扫了哪些目标""三次评估之间漏洞有没有减少"从猜测变成可核对。
 *
 * 只读：历史条目由磁盘上的文件推导，面板/工具都不写它。删除评估仍然走删文件
 * （或 `strix_delete_finding`），不在这里提供"删整轮"——那会悄悄丢掉证据。
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

export interface HistoryEntry {
	/** 评估键（会话 id 或沙箱 id）：台账文件就是按它命名的。 */
	key: string;
	/** 最近一次写入时间（ISO）。 */
	at: string;
	/** 这个键下有几条发现。 */
	findings: number;
	/** 记住的目标（沙箱快照里有；没有快照时为空）。 */
	targets: string[];
	/** 有没有生成过报告。 */
	report: boolean;
}

const DIRS = ["findings", "coverage", "notes", "todos", "reports"] as const;

function readJson<T>(path: string, fallback: T): T {
	try {
		return JSON.parse(readFileSync(path, "utf8")) as T;
	} catch {
		return fallback;
	}
}

/** 每份台账都是 `<dir>/<key>.json`：把目录里的键并起来，就是评估清单。 */
function keysOf(dir: string): Map<string, number> {
	const out = new Map<string, number>();
	let names: string[] = [];
	try {
		names = readdirSync(join(dir));
	} catch {
		return out;
	}
	for (const name of names) {
		if (!name.endsWith(".json")) continue;
		const key = name.slice(0, -".json".length);
		let at = 0;
		try {
			at = statSync(join(dir, name)).mtimeMs;
		} catch {
			continue;
		}
		if ((out.get(key) ?? 0) >= at) continue;
		out.set(key, at);
	}
	return out;
}

export function listHistory(dataDir: string, limit = 20): HistoryEntry[] {
	const merged = new Map<string, number>();
	for (const name of DIRS) {
		for (const [key, at] of keysOf(join(dataDir, name))) {
			const previous = merged.get(key) ?? 0;
			if (at > previous) merged.set(key, at);
		}
	}

	const entries: HistoryEntry[] = [];
	for (const [key, at] of merged) {
		const findingsFile = readJson<{ findings?: Array<{ title?: string; targets?: string[] }> }>(
			join(dataDir, "findings", `${key}.json`),
			{},
		);
		const findings = (findingsFile.findings ?? []).length;
		const targets = new Set<string>();
		for (const finding of findingsFile.findings ?? []) {
			for (const target of finding.targets ?? []) targets.add(target);
		}
		const scope = readJson<{ targets?: string[] }>(join(dataDir, "coverage", `${key}.json`), {});
		for (const target of scope.targets ?? []) targets.add(target);
		entries.push({
			key,
			at: new Date(at).toISOString(),
			findings,
			targets: [...targets].slice(0, 8),
			report: keysOf(join(dataDir, "reports")).has(key),
		});
	}
	return entries.sort((a, b) => (a.at < b.at ? 1 : -1)).slice(0, limit);
}

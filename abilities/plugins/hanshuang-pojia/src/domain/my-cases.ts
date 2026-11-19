/**
 * 我的案例：面板自己沉淀的案例库。
 *
 * 与「案例库」页扫的 `cases/` / `work/` 是两回事：那些是仓库里已有的战例目录（只读、
 * 由作者维护），这里存的是**这台机器上真的做过什么**。
 *
 * 一条案例不只是「跑过什么样本」，还要能回答「当时想让模型做什么、它怎么回应的」。
 * 所以每条带六项溯源字段：
 *   intent      —— 这条是从哪来的（面板自分析 / 宿主对话 / 用户存下的草稿）
 *   hostPrompt  —— 投进宿主对话的原话（面板自分析为空串）
 *   refusalSig  —— 命中的拒答信号与证据；没命中为 null
 *   rewriteChain—— 依次用过的改写档位；没改写为空数组
 *   model       —— 当时的模型标识；宿主没给为 null
 *   artifactRef —— 产物引用（报告路径 / 案例目录）
 *   tags        —— 标签
 *
 * `refusalSig` / `rewriteChain` 是**观测记录**，不是重试计划：它们回答的是「这一轮发生过
 * 什么」，供人事后复核。插件不会因为记下了这两项就去跨模型重试：续跑永远是同一会话、
 * 同一模型、同一回合内换句式。
 *
 * 全部是纯函数，不读时钟也不读盘：时间是调用方给的。
 */

import type { TriageReport } from "./report/report";

/** 一条案例的来源。决定 `hostPrompt` 有没有意义。 */
export type CaseIntent = "triage" | "host" | "draft" | "manual";

/** 拒答信号的紧凑记录：只要能被复核的部分，不留整段正文。 */
export interface RefusalPointer {
	/** 拒答类型，与 `domain/refusal.ts` 的 `RefusalKind` 同名。 */
	kind: string;
	/** 命中的原文片段；空数组表示「空正文」这种无证据形态。 */
	evidence: readonly string[];
}

export interface MyCase {
	/** 与样本库同一套 id：sha256 前 16 位 + 大小，保证同一份字节只留一条。 */
	id: string;
	name: string;
	sha256: string;
	size: number;
	format: string;
	grade: string;
	score: number;
	findings: number;
	/** 报告里最值得一眼看到的那几条（非 info 的前三条）。 */
	highlights: string[];
	/** 首次沉淀时间。 */
	at: string;
	/** 最近一次分析时间：重新分析会更新它，`at` 保持不变。 */
	lastSeenAt: string;
	/** 沉淀次数。 */
	seen: number;

	/** 来源。 */
	intent: CaseIntent;
	/** 投进宿主对话的原话；面板自分析为空串。 */
	hostPrompt: string;
	/** 命中过的拒答信号；没命中为 null。 */
	refusalSig: RefusalPointer | null;
	/** 依次用过的改写档位；没改写为空数组。 */
	rewriteChain: string[];
	/** 模型标识；宿主没给为 null。 */
	model: string | null;
	/** 产物引用：报告路径或案例目录。 */
	artifactRef: string | null;
	/** 用户或规则打上的标签。 */
	tags: string[];
}

export const MAX_MY_CASES = 60;

/** 沉淀时的可选溯源信息；缺省就是「面板自己分析出来的」。 */
export interface CaseProvenance {
	intent?: CaseIntent;
	hostPrompt?: string;
	refusalSig?: RefusalPointer | null;
	rewriteChain?: readonly string[];
	model?: string | null;
	artifactRef?: string | null;
	tags?: readonly string[];
}

/** 报告 → 案例条目。 */
export function caseFromReport(report: TriageReport, provenance: CaseProvenance = {}): MyCase {
	const highlights = report.findings
		.filter(finding => finding.severity !== "info")
		.slice(0, 3)
		.map(finding => `${finding.severity}: ${finding.title}`);
	return {
		id: `${report.target.sha256.slice(0, 16)}-${report.target.size}`,
		name: report.target.name,
		sha256: report.target.sha256,
		size: report.target.size,
		format: report.target.formatLabel || report.target.format,
		grade: report.risk.grade,
		score: report.risk.score,
		findings: report.findings.length,
		highlights: highlights.length > 0 ? highlights : report.summary.slice(0, 3),
		at: report.target.generatedAt,
		lastSeenAt: report.target.generatedAt,
		seen: 1,
		intent: provenance.intent ?? "triage",
		hostPrompt: (provenance.hostPrompt ?? "").trim(),
		refusalSig: provenance.refusalSig ?? null,
		rewriteChain: [...(provenance.rewriteChain ?? [])],
		model: provenance.model ?? null,
		artifactRef: provenance.artifactRef ?? report.target.path,
		tags: [...(provenance.tags ?? [])],
	};
}

/**
 * 写入一条：同 id 就累加。
 *
 * 按 id 而不是按 sha256 判重：同一份字节的分析永远得到同一个 id，而 sha256 单独比对会
 * 让「同名不同大小」的两条互相覆盖。
 * 排序按最近分析时间倒序——案例库的用法是「找我刚做过的那个」。
 *
 * 累加时溯源字段以**这一次**为准，但改写链是历史：把新档位接在旧链后面并去重，
 * 否则「到底试过哪几种问法」会被最后一次覆盖掉。
 */
export function upsertCase(list: readonly MyCase[], entry: MyCase, max = MAX_MY_CASES): MyCase[] {
	const existing = list.find(item => item.id === entry.id);
	const merged: MyCase = existing
		? {
				...entry,
				// 首次沉淀时间与次数是历史，不被这次覆盖。
				at: existing.at,
				seen: existing.seen + 1,
				rewriteChain: dedupe([...existing.rewriteChain, ...entry.rewriteChain]),
				tags: dedupe([...existing.tags, ...entry.tags]),
				// 没命中拒答的那一次不该抹掉「这里曾经被拒过」。
				refusalSig: entry.refusalSig ?? existing.refusalSig,
				// 原话只在有值时替换：面板自分析的一次不该清掉宿主那一轮说过的话。
				hostPrompt: entry.hostPrompt.length > 0 ? entry.hostPrompt : existing.hostPrompt,
			}
		: { ...entry, rewriteChain: dedupe(entry.rewriteChain), tags: dedupe(entry.tags) };
	const rest = list.filter(item => item.id !== entry.id);
	return [merged, ...rest].sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt)).slice(0, max);
}

function dedupe(values: readonly string[]): string[] {
	const seen = new Set<string>();
	const out: string[] = [];
	for (const value of values) {
		const key = value.trim();
		if (key.length === 0 || seen.has(key)) continue;
		seen.add(key);
		out.push(key);
	}
	return out;
}

function asIntent(value: unknown): CaseIntent {
	return value === "host" || value === "draft" || value === "manual" ? value : "triage";
}

function asRefusal(value: unknown): RefusalPointer | null {
	if (!value || typeof value !== "object") return null;
	const row = value as Partial<RefusalPointer>;
	if (typeof row.kind !== "string" || row.kind.length === 0) return null;
	return {
		kind: row.kind,
		evidence: Array.isArray(row.evidence) ? row.evidence.filter((text): text is string => typeof text === "string") : [],
	};
}

function asStrings(value: unknown): string[] {
	return Array.isArray(value) ? value.filter((text): text is string => typeof text === "string") : [];
}

/** 读回来的数据可能被手改过：形状不对的条目直接丢弃，不让页面崩。 */
export function sanitizeCases(value: unknown): MyCase[] {
	if (!Array.isArray(value)) return [];
	const out: MyCase[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") continue;
		const row = item as Partial<MyCase>;
		if (typeof row.id !== "string" || typeof row.name !== "string") continue;
		out.push({
			id: row.id,
			name: row.name,
			sha256: typeof row.sha256 === "string" ? row.sha256 : "",
			size: typeof row.size === "number" ? row.size : 0,
			format: typeof row.format === "string" ? row.format : "",
			grade: typeof row.grade === "string" ? row.grade : "-",
			score: typeof row.score === "number" ? row.score : 0,
			findings: typeof row.findings === "number" ? row.findings : 0,
			highlights: asStrings(row.highlights),
			at: typeof row.at === "string" ? row.at : "",
			lastSeenAt: typeof row.lastSeenAt === "string" ? row.lastSeenAt : "",
			seen: typeof row.seen === "number" && row.seen > 0 ? row.seen : 1,
			// 旧版本没有这七项：补默认值，不丢弃条目。
			intent: asIntent(row.intent),
			hostPrompt: typeof row.hostPrompt === "string" ? row.hostPrompt : "",
			refusalSig: asRefusal(row.refusalSig),
			rewriteChain: asStrings(row.rewriteChain),
			model: typeof row.model === "string" ? row.model : null,
			artifactRef: typeof row.artifactRef === "string" ? row.artifactRef : null,
			tags: asStrings(row.tags),
		});
	}
	return out.sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt)).slice(0, MAX_MY_CASES);
}

/**
 * 一条草稿（还没分析、只有一句话）也能进案例库：用户写完发现「这条值得留着」，
 * 不该被迫先跑一遍分析。它的 id 由内容哈希给出，同一段文字只留一条。
 */
export function caseFromDraft(input: {
	prompt: string;
	at: string;
	tags?: readonly string[];
	model?: string | null;
}): MyCase {
	const text = input.prompt.trim();
	const digest = fnv(text);
	return {
		id: `draft-${digest}`,
		name: text.split("\n")[0]?.slice(0, 60) || "draft",
		sha256: "",
		size: 0,
		format: "prompt",
		grade: "-",
		score: 0,
		findings: 0,
		highlights: [text.slice(0, 120)],
		at: input.at,
		lastSeenAt: input.at,
		seen: 1,
		intent: "draft",
		hostPrompt: text,
		refusalSig: null,
		rewriteChain: [],
		model: input.model ?? null,
		artifactRef: null,
		tags: [...(input.tags ?? [])],
	};
}

function fnv(text: string): string {
	let value = 0x811c9dc5;
	for (let index = 0; index < text.length; index += 1) {
		value ^= text.charCodeAt(index);
		value = Math.imul(value, 0x01000193) >>> 0;
	}
	return value.toString(16).padStart(8, "0");
}

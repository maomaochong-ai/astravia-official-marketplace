/**
 * ask-answer.ts — 模型输出 → 结构化答案（纯函数，无 IO）。
 *
 * 三条硬约束：
 *   1. 模型说的话不可信：拿不到合法 JSON 就如实报错并给出可重试的提示语，
 *      绝不「尽力猜一下」拼出一份看起来成功的答案。
 *   2. SQL 必须自己再校验一次只读单语句 —— 问数是取数，不是写库。
 *      这条校验同时被 ask-loop 的 run_sql 工具复用（唯一推导，不复制规则）。
 *   3. 缺字段（findings / suggestions）不算错：宁可少展示，也不编造内容。
 */

import type { AskAnswerDraft } from "./ask-types.ts";

export interface ParseAskAnswerOutcome {
	draft: AskAnswerDraft | null;
	/** 解析失败的原因（面向模型的可重试提示语）；成功时为 null。 */
	error: string | null;
}

/** 禁止出现的写库/改结构关键字（大小写无关，按词边界匹配）。 */
const WRITE_KEYWORDS = [
	"insert",
	"update",
	"delete",
	"drop",
	"alter",
	"create",
	"truncate",
	"replace into",
	"merge into",
	"grant",
	"revoke",
	"attach",
	"detach",
	"vacuum",
	"reindex",
	"call",
	"copy",
	"load data",
	"into outfile",
];

/**
 * 只读单语句校验。返回 null 表示通过，否则返回拒绝原因。
 * 故意保守：宁可拒绝一条合法的怪 SQL，也不放过一条写操作。
 */
export function checkReadOnlySql(sql: string): string | null {
	const text = String(sql ?? "").trim();
	if (!text) return "SQL 为空";
	// 去掉行注释与块注释后再判断，避免注释里的关键字误伤。
	const stripped = text
		.replace(/\/\*[\s\S]*?\*\//g, " ")
		.replace(/--[^\n]*/g, " ")
		.replace(/#[^\n]*/g, " ")
		.trim();
	const lowered = stripped.toLowerCase();
	// 结尾分号允许，中间的多个语句不允许。
	const body = lowered.endsWith(";") ? lowered.slice(0, -1) : lowered;
	if (body.includes(";")) return "只允许一条 SQL 语句，不能出现多个分号分隔的语句";
	if (!/^(select|with)\b/.test(body)) return "只允许只读查询：SQL 必须以 SELECT 或 WITH 开头";
	for (const keyword of WRITE_KEYWORDS) {
		const pattern = new RegExp(`(^|[^a-z0-9_])${keyword.replace(/ /g, "\\s+")}([^a-z0-9_]|$)`);
		if (pattern.test(body)) return `只允许只读查询：SQL 里出现了写操作关键字 ${keyword.toUpperCase()}`;
	}
	return null;
}

/** 从模型文本里挖出第一个「像 JSON 对象」的片段（围栏优先，其次花括号配对）。 */
export function extractJsonObject(text: string): string | null {
	const source = String(text ?? "");
	const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
	if (fenced && fenced[1]) {
		const inner = fenced[1].trim();
		if (inner.startsWith("{")) return inner;
	}
	const start = source.indexOf("{");
	if (start < 0) return null;
	let depth = 0;
	let inString = false;
	let escaped = false;
	for (let i = start; i < source.length; i += 1) {
		const ch = source[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === "\\") escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === "{") depth += 1;
		else if (ch === "}") {
			depth -= 1;
			if (depth === 0) return source.slice(start, i + 1);
		}
	}
	return null;
}

function asString(value: unknown): string {
	if (typeof value === "string") return value.trim();
	if (typeof value === "number" && Number.isFinite(value)) return String(value);
	return "";
}

function asStringArray(value: unknown): string[] {
	if (Array.isArray(value)) {
		return value.map((item) => asString(item)).filter((item) => item.length > 0);
	}
	const single = asString(value);
	if (!single) return [];
	return single
		.split(/[,，、;；]/)
		.map((item) => item.trim())
		.filter((item) => item.length > 0);
}

/**
 * 解析模型最终回答。契约见 ask-prompt.ts 的 buildAskSystemPrompt —— 两处必须同步。
 */
export function parseAskAnswer(text: string): ParseAskAnswerOutcome {
	const raw = extractJsonObject(text);
	if (!raw) {
		return { draft: null, error: "没有找到 JSON 对象。请只输出约定格式的 JSON（可以用 ```json 围栏包裹）。" };
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(raw);
	} catch (err) {
		return {
			draft: null,
			error: `JSON 解析失败（${err instanceof Error ? err.message : String(err)}）。请检查引号转义后重新输出。`,
		};
	}
	if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
		return { draft: null, error: "顶层必须是一个 JSON 对象。" };
	}
	const obj = parsed as Record<string, unknown>;
	const sql = asString(obj.sql);
	if (!sql) return { draft: null, error: "缺少 sql 字段：请给出最终取数的单条 SELECT。" };
	const sqlProblem = checkReadOnlySql(sql);
	if (sqlProblem) return { draft: null, error: `${sqlProblem}。请改成单条只读 SELECT。` };

	return {
		error: null,
		draft: {
			intent: asString(obj.intent),
			chartKind: asString(obj.chartKind),
			fields: asStringArray(obj.fields),
			sql,
			findings: asString(obj.findings),
			conclusion: asString(obj.conclusion),
			suggestions: asStringArray(obj.suggestions),
		},
	};
}

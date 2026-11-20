/**
 * 会话时间线：把宿主推来的生命周期事件压成「一轮里有几次工具调用、各花了多久、谁报错」。
 *
 * 面板收到的 `TaskStreamEntry` 是**最新在前**的原始事件流，只有 phase / toolName / at。
 * 组件里直接渲染它只能得到一堆散点：同一个工具的开始与结束是两条，时长要自己减，
 * 「本轮」要看最近的 turn 边界。这些判断放这里，组件只负责画，测试也只测这个文件。
 *
 * 不推断宿主没给的东西：没有 turn-end 就是 `open: true`，没有配对的 tool-end 就是
 * `finishedAt: null`，一律不拿「现在」去补一个看起来合理的时长。
 */

import type { TaskStreamEntry } from "./state";

export type SpanStatus = "running" | "ok" | "error";

export interface ToolSpan {
	id: string;
	toolName: string;
	startedAt: string;
	finishedAt: string | null;
	/** 配对后的耗时；任一端缺失就是 null。 */
	ms: number | null;
	status: SpanStatus;
	/** 0 = 最新一轮。侧栏只显示这一轮。 */
	turn: number;
}

export interface TurnSummary {
	index: number;
	startedAt: string | null;
	finishedAt: string | null;
	ms: number | null;
	tools: number;
	failures: number;
	/** 本轮还没收到 turn-end。 */
	open: boolean;
}

export interface Timeline {
	turns: TurnSummary[];
	spans: ToolSpan[];
	/** 最新一轮；一条 turn 事件都没有时给一个空壳，组件不必判空。 */
	current: TurnSummary;
}

const EMPTY_TURN: TurnSummary = {
	index: 0,
	startedAt: null,
	finishedAt: null,
	ms: null,
	tools: 0,
	failures: 0,
	open: false,
};

function at(value: string): number {
	const parsed = Date.parse(value);
	return Number.isNaN(parsed) ? 0 : parsed;
}

/** 毫秒差；两端任意一端无效就返回 null，不编一个数出来。 */
function span(startedAt: string, finishedAt: string): number | null {
	const begin = at(startedAt);
	const end = at(finishedAt);
	if (begin === 0 || end === 0 || end < begin) return null;
	return end - begin;
}

/**
 * 事件流是 newest-first；这里倒过来按时间正序配对，pairing 才是「先开后备」。
 * 同一工具并发时按栈配对（后开的先结束），比按名字取最后一个更像真实调用栈。
 */
export function buildTimeline(entries: readonly TaskStreamEntry[]): Timeline {
	const chronological = [...entries].reverse();

	const spans: ToolSpan[] = [];
	const open = new Map<string, ToolSpan>();
	let turnSeq = -1;
	let turnStart: { seq: number; at: string } | null = null;
	const turns: TurnSummary[] = [];
	// TurnSummary.index 是最终展示序号（0 = 最新），配对时需要原始序号，单独记一份。
	const turnOrders = new Map<TurnSummary, number>();

	const closeTurn = (atValue: string | null): void => {
		if (!turnStart) return;
		const summary: TurnSummary = {
			index: 0,
			startedAt: turnStart.at,
			finishedAt: atValue,
			ms: atValue ? span(turnStart.at, atValue) : null,
			tools: 0,
			failures: 0,
			open: atValue === null,
		};
		turnOrders.set(summary, turnStart.seq);
		turns.push(summary);
		turnStart = null;
		turnStart = null;
	};

	for (const entry of chronological) {
		if (entry.phase === "turn-start") {
			// 上一轮没收到 turn-end 就来了新的一轮：按「未闭合」结掉，不丢数据。
			closeTurn(null);
			turnSeq += 1;
			turnStart = { seq: turnSeq, at: entry.at };
			continue;
		}
		if (entry.phase === "turn-end") {
			closeTurn(entry.at);
			continue;
		}
		if (entry.phase !== "tool-start" && entry.phase !== "tool-end") continue;

		const toolName = entry.toolName ?? "tool";
		if (entry.phase === "tool-start") {
			const created: ToolSpan = {
				id: entry.id,
				toolName,
				startedAt: entry.at,
				finishedAt: null,
				ms: null,
				status: "running",
				turn: turnStart?.seq ?? turnSeq + 1,
			};
			spans.push(created);
			open.set(`${toolName}|${entry.id}`, created);
			// 同名工具可能并发：保留一份按名字的索引，配对失败时按名字兜底。
			open.set(toolName, created);
			continue;
		}

		const key = `${toolName}|${entry.id}`;
		const paired = open.get(key) ?? open.get(toolName) ?? null;
		if (paired) {
			paired.finishedAt = entry.at;
			paired.ms = span(paired.startedAt, entry.at);
			paired.status = entry.isError ? "error" : "ok";
			open.delete(toolName);
			open.delete(`${toolName}|${entry.id}`);
			continue;
		}
		// 只看到结束、没有对应开始（例如面板中途挂载后的重放）：仍记一条，
		// 但没有起点就不给时长，也不猜它是成功还是别的什么。
		spans.push({
			id: entry.id,
			toolName,
			startedAt: entry.at,
			finishedAt: entry.at,
			ms: null,
			status: entry.isError ? "error" : "ok",
			turn: turnSeq + 1,
		});
	}
	// 循环结束时还没收到 turn-end 的那一轮，算当前轮。
	const trailing = turnStart as { seq: number; at: string } | null;
	if (trailing) closeTurn(null);
	else if (turns.length === 0 && spans.length > 0) {
		// 一个 turn 事件都没有：整段事件当成一轮，避免侧栏空着。
		turns.push({ ...EMPTY_TURN, open: entries.some(entry => entry.phase === "tool-start") });
	}

	// 轮序号按真实 turn-start 次数据算：某一轮没有工具调用时也不能把序号错开。
	const latestSeq = turnSeq;
	for (const item of spans) item.turn = Math.max(0, latestSeq - item.turn);

	for (const turn of turns) {
		turn.index = Math.max(0, latestSeq - (turnOrders.get(turn) ?? latestSeq));
		const own = spans.filter(item => item.turn === turn.index);
		turn.tools = own.length;
		turn.failures = own.filter(item => item.status === "error").length;
	}

	const current = turns.find(turn => turn.index === 0) ?? { ...EMPTY_TURN };

	return { turns: [...turns].reverse(), spans: [...spans].reverse(), current };
}

/** 0.4s / 1.2s / 12s / 1m05s —— 小数值保留一位小数，取整只在真的过了秒级之后。 */
export function formatDuration(ms: number | null): string {
	if (ms === null) return "—";
	if (ms < 1_000) return `${(ms / 1_000).toFixed(1)}s`;
	if (ms < 60_000) return `${Math.round(ms / 1_000)}s`;
	const minutes = Math.floor(ms / 60_000);
	const seconds = Math.round((ms % 60_000) / 1_000);
	return `${minutes}m${String(seconds).padStart(2, "0")}s`;
}

/** 载荷里不适合当摘要的字段：身份、时间、路径都不说明「这次跑出了什么」。 */
const NOISE_KEYS = new Set(["id", "sha256", "at", "timestamp", "path", "sessionId", "source", "target"]);

/**
 * 从工具结果的 payload 里挑出「一眼能判断规模」的量。
 *
 * 不是把对象倒出来：`{ entries: [...156], sections: [...12] }` 对读者有用的是
 * 「156 条 / 12 段」，`{ format: "apk" }` 有用的就是那个值。嵌套对象一律略过——
 * 展开一个对象的名字不会让人更清楚发生了什么。
 */
export function payloadHints(payload: Record<string, unknown> | undefined, limit = 4): string[] {
	if (!payload) return [];
	const hints: string[] = [];
	for (const [key, value] of Object.entries(payload)) {
		if (NOISE_KEYS.has(key)) continue;
		if (Array.isArray(value)) {
			hints.push(`${key} ${value.length}`);
		} else if (typeof value === "number") {
			hints.push(`${key} ${value}`);
		} else if (typeof value === "boolean") {
			hints.push(`${key} ${value ? "yes" : "no"}`);
		} else if (typeof value === "string" && value.trim().length > 0 && value.length <= 48) {
			hints.push(`${key} ${value}`);
		}
		if (hints.length >= limit) break;
	}
	return hints;
}

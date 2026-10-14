/**
 * ask-loop.ts — 一轮问数的多轮工具调用循环（插件内部 loop，不向宿主 Agent 借力）。
 *
 * 形状照搬宿主内置 chinese-chess 插件的 agent-player.ts（同一个 SDK 能力、同一套约定）：
 * 插件自己持有 transcript、自己执行工具调用、用 `toolResult` 回填，模型只负责下一次输出。
 * 差别是这里唯一的工具是 run_sql —— 取数结果由引擎给出，不由模型叙述。
 *
 * 四条硬约束：
 *   1. 结论必须建立在真实取数上：模型要图要结论，但它给的 SQL 由插件自己执行，
 *      失败就如实把失败原因带回去（isError 回填 + 答案里标注），不伪造空结果。
 *   2. 同一条 SQL 在同一轮里只执行一次（cache），避免模型兜圈子把库打爆。
 *   3. 最多 maxRounds 轮；用尽后返回 error，让用户看见「模型没按约定回答」而不是静默给个空答案。
 *   4. 每次 run_sql 都过一次 checkReadOnlySql —— 与最终 sql 同一条校验规则。
 */

import type {
	PluginAiChatMessage,
	PluginAiChatRequest,
	PluginAiChatResult,
	PluginAiToolCall,
} from "@astravia-org/plugin-sdk";
import { checkReadOnlySql, parseAskAnswer } from "./ask-answer.ts";
import { normalizeChartKind } from "./ask-chart.ts";
import { ASK_SQL_TOOL, buildAskSystemPrompt } from "./ask-prompt.ts";
import type { AskAnswer, AskDatasetContext, AskResult } from "./ask-types.ts";

export interface AskChatPort {
	chat(request: PluginAiChatRequest): Promise<PluginAiChatResult>;
}

export interface AskRunSqlPort {
	(sql: string): Promise<AskResult>;
}

export interface RunAskTurnOptions {
	ai: AskChatPort;
	runSql: AskRunSqlPort;
	dataset: AskDatasetContext;
	/** 上一轮结束时的完整对话（插件自持；首轮传空数组）。 */
	transcript: PluginAiChatMessage[];
	question: string;
	today?: string;
	maxRounds?: number;
	/** 只能轮间生效：宿主 ai.chat 没有 signal 参数，进行中的请求无法中断。 */
	signal?: AbortSignal;
	/** 每次真实取数前的回调，面板用它显示「正在取数…」。 */
	onToolCall?: (info: { sql: string; purpose?: string }) => void;
}

export interface RunAskTurnResult {
	/** 新的完整对话，面板原样保存、下一轮继续传回来。 */
	transcript: PluginAiChatMessage[];
	answer: AskAnswer | null;
	error: string | null;
	/** 本轮真实执行过的 SQL（按执行顺序）。 */
	sqls: string[];
}

export const DEFAULT_MAX_ROUNDS = 6;
const MAX_TRANSCRIPT_MESSAGES = 60;
const TOOL_RESULT_ROW_LIMIT = 30;

/** 取数结果 → 回填给模型的紧凑文本（列名 + 行数 + 若干行样本）。 */
export function compactResult(result: AskResult): string {
	const head = `columns: ${result.columns.join(", ")}\nrows: ${result.rows.length}`;
	if (result.rows.length === 0) return `${head}\n(结果为空)`;
	const sample = result.rows.slice(0, TOOL_RESULT_ROW_LIMIT);
	const lines = sample.map((row) => JSON.stringify(row));
	const suffix = result.rows.length > sample.length ? `\n(只展示前 ${sample.length} 行)` : "";
	return `${head}\n${lines.join("\n")}${suffix}`;
}

/**
 * 收缩对话：丢掉最前面的消息直到首个 user 消息（避免留下孤儿 toolResult），再按条数封顶。
 */
export function trimAskTranscript(messages: PluginAiChatMessage[]): PluginAiChatMessage[] {
	let start = 0;
	while (start < messages.length && messages[start].role !== "user") start += 1;
	let trimmed = start >= messages.length ? messages.slice(-MAX_TRANSCRIPT_MESSAGES) : messages.slice(start);
	while (trimmed.length > MAX_TRANSCRIPT_MESSAGES) trimmed = trimmed.slice(1);
	// 丢掉头部后可能又露出孤儿 toolResult，再修一次。
	start = 0;
	while (start < trimmed.length && trimmed[start].role !== "user") start += 1;
	return start >= trimmed.length ? trimmed : trimmed.slice(start);
}

function sqlArgument(call: PluginAiToolCall): string {
	const raw = call.arguments ? call.arguments.sql : undefined;
	return typeof raw === "string" ? raw.trim() : "";
}

function purposeArgument(call: PluginAiToolCall): string | undefined {
	const raw = call.arguments ? call.arguments.purpose : undefined;
	const text = typeof raw === "string" ? raw.trim() : "";
	return text || undefined;
}

function errorText(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

/**
 * 跑一轮问数：把 question 追加到 transcript，循环「模型 → 工具 → 回填」直到模型给出 JSON 答案。
 * 永远返回 transcript（哪怕失败），面板据此保留现场。
 */
export async function runAskTurn(options: RunAskTurnOptions): Promise<RunAskTurnResult> {
	const maxRounds = Math.max(1, options.maxRounds ?? DEFAULT_MAX_ROUNDS);
	const transcript: PluginAiChatMessage[] = [
		...options.transcript,
		{ role: "user", content: options.question },
	];
	const systemPrompt = buildAskSystemPrompt({ dataset: options.dataset, today: options.today });
	const sqls: string[] = [];
	const cache = new Map<string, AskResult>();
	let lastError: string | null = null;

	const runOnce = async (sql: string): Promise<AskResult> => {
		const cached = cache.get(sql);
		if (cached) return cached;
		const result = await options.runSql(sql);
		cache.set(sql, result);
		return result;
	};

	for (let round = 0; round < maxRounds; round += 1) {
		if (options.signal?.aborted) {
			return { transcript, answer: null, error: "已取消", sqls };
		}
		const reply = await options.ai.chat({
			systemPrompt,
			messages: trimAskTranscript(transcript),
			tools: [ASK_SQL_TOOL],
			temperature: 0.2,
			maxTokens: 1_400,
		});
		transcript.push({
			role: "assistant",
			content: reply.text,
			...(reply.toolCalls.length > 0 ? { toolCalls: reply.toolCalls } : {}),
		});

		if (reply.toolCalls.length === 0) {
			const parsed = parseAskAnswer(reply.text);
			if (parsed.draft) {
				const draft = parsed.draft;
				let result: AskResult | null = null;
				let resultError: string | null = null;
				try {
					options.onToolCall?.({ sql: draft.sql });
					result = await runOnce(draft.sql);
					if (!sqls.includes(draft.sql)) sqls.push(draft.sql);
				} catch (err) {
					resultError = `最终 SQL 执行失败：${errorText(err)}`;
				}
				const answer: AskAnswer = {
					...draft,
					chartKind: normalizeChartKind(draft.chartKind, `${options.question} ${draft.intent}`),
					question: options.question,
					datasetName: options.dataset.connectionName,
					sqls: [...sqls],
					result,
					error: resultError,
				};
				return { transcript, answer, error: null, sqls };
			}
			lastError = parsed.error;
			if (round === maxRounds - 1) break;
			transcript.push({
				role: "user",
				content: `上面的回答无法使用：${parsed.error}\n请只输出约定格式的 JSON。`,
			});
			continue;
		}

		for (const call of reply.toolCalls) {
			if (call.name !== ASK_SQL_TOOL.name) {
				transcript.push({
					role: "toolResult",
					toolCallId: call.id,
					toolName: call.name,
					content: `未知工具 ${call.name}：当前只有 ${ASK_SQL_TOOL.name} 可用。`,
					isError: true,
				});
				continue;
			}
			const sql = sqlArgument(call);
			if (!sql) {
				transcript.push({
					role: "toolResult",
					toolCallId: call.id,
					toolName: call.name,
					content: "缺少 sql 参数：请在 sql 里给出单条只读 SELECT。",
					isError: true,
				});
				continue;
			}
			const problem = checkReadOnlySql(sql);
			if (problem) {
				transcript.push({
					role: "toolResult",
					toolCallId: call.id,
					toolName: call.name,
					content: `${problem}。请改成单条只读 SELECT 后重试。`,
					isError: true,
				});
				continue;
			}
			try {
				options.onToolCall?.({ sql, purpose: purposeArgument(call) });
				const result = await runOnce(sql);
				if (!sqls.includes(sql)) sqls.push(sql);
				transcript.push({
					role: "toolResult",
					toolCallId: call.id,
					toolName: call.name,
					content: compactResult(result),
				});
			} catch (err) {
				transcript.push({
					role: "toolResult",
					toolCallId: call.id,
					toolName: call.name,
					content: `取数失败：${errorText(err)}`,
					isError: true,
				});
			}
		}
	}

	return {
		transcript,
		answer: null,
		error: lastError ?? `模型在 ${maxRounds} 轮内没有给出约定格式的答案`,
		sqls,
	};
}

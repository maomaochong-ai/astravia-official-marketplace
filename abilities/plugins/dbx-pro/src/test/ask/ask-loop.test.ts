/**
 * 问数 · 多轮工具调用循环（纯逻辑，假 port）。
 *
 * 这是整个「智能问数」的可信度所在：模型只是提案，SQL 由插件自己执行，结果由引擎给出。
 * 钉住七件事：
 *   1. 模型先调 run_sql、再给 JSON：取数真的发生了，且答案里的 sqls 记录可审计；
 *   2. 同一条 SQL 一轮里只执行一次（cache），模型兜圈子不会重复打库；
 *   3. run_sql 里的写操作 / 多语句被拒，并以 isError 回填给模型；
 *   4. 最终 SQL 执行失败：answer 仍然返回（sql/intent 都在），但 result=null 且 error 有原因；
 *   5. 坏输出会被纠正一次（nudge），纠正后能成功；
 *   6. 一直不给 JSON 时到轮数上限返回 error，不静默给空答案；
 *   7. 未知工具名、缺 sql 参数都以 isError 回填。
 *
 * 运行：npm test
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	PluginAiChatMessage,
	PluginAiChatRequest,
	PluginAiChatResult,
	PluginAiToolCall,
} from "@astravia-org/plugin-sdk";
import { compactResult, runAskTurn, trimAskTranscript } from "../../features/ask/ask-loop.ts";
import type { AskResult } from "../../features/ask/ask-types.ts";

const RESULT: AskResult = {
	columns: ["dt", "gmv"],
	rows: [
		{ dt: "2026-10-13", gmv: 1200 },
		{ dt: "2026-10-14", gmv: 1500 },
	],
};

const FINAL_SQL = "SELECT dt, SUM(gmv) AS gmv FROM orders GROUP BY dt ORDER BY dt";
const FINAL_TEXT = JSON.stringify({
	intent: "近 14 天成交额趋势",
	chartKind: "line",
	fields: ["dt", "gmv"],
	sql: FINAL_SQL,
	findings: "10-14 成交额 1,500",
	conclusion: "上行",
	suggestions: ["看渠道"],
});

function makeChatPort(replies: Array<Partial<PluginAiChatResult>>) {
	const requests: PluginAiChatRequest[] = [];
	let index = 0;
	return {
		requests,
		port: {
			async chat(request: PluginAiChatRequest): Promise<PluginAiChatResult> {
				requests.push(request);
				const reply = replies[Math.min(index, replies.length - 1)];
				index += 1;
				const toolCalls = reply.toolCalls ?? [];
				return {
					modelKey: "fake-model",
					text: reply.text ?? "",
					toolCalls,
					stopReason: reply.stopReason ?? (toolCalls.length > 0 ? "toolUse" : "stop"),
					usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				};
			},
		},
	};
}

function makeRunSqlPort(handler?: (sql: string) => AskResult | Promise<AskResult>) {
	const calls: string[] = [];
	return {
		calls,
		port: async (sql: string): Promise<AskResult> => {
			calls.push(sql);
			if (handler) return handler(sql);
			return RESULT;
		},
	};
}

function toolCall(id: string, args: Record<string, unknown>, name = "run_sql"): PluginAiToolCall {
	return { id, name, arguments: args };
}

const base = { dataset: { connectionName: "warehouse", tables: ["orders"] }, today: "2026-10-15" };

describe("ask-loop · 正常路径", () => {
	it("先 run_sql 再给 JSON：真取数、答案可审计、SQL 不重复执行", async () => {
		const chat = makeChatPort([
			{ toolCalls: [toolCall("c1", { sql: "SELECT * FROM orders LIMIT 5", purpose: "看结构" })] },
			{ text: FINAL_TEXT },
		]);
		const runs = makeRunSqlPort();
		const toolCallsSeen: string[] = [];
		const out = await runAskTurn({
			ai: chat.port,
			runSql: runs.port,
			...base,
			transcript: [],
			question: "近 14 天成交额趋势",
			onToolCall: (info) => toolCallsSeen.push(info.sql),
		});

		assert.equal(out.error, null);
		assert.ok(out.answer);
		assert.equal(out.answer?.chartKind, "chart-line");
		assert.equal(out.answer?.datasetName, "warehouse");
		assert.deepEqual(out.answer?.result, RESULT);
		assert.deepEqual(out.answer?.sqls, ["SELECT * FROM orders LIMIT 5", FINAL_SQL]);
		assert.deepEqual(runs.calls, ["SELECT * FROM orders LIMIT 5", FINAL_SQL]);
		assert.deepEqual(toolCallsSeen, ["SELECT * FROM orders LIMIT 5", FINAL_SQL]);
		// 第一次请求必须带工具与系统提示词；第二次带上真实取数结果。
		assert.equal(chat.requests[0].tools?.[0].name, "run_sql");
		assert.match(chat.requests[0].systemPrompt ?? "", /warehouse/);
		const toolResult = chat.requests[1].messages.find((m) => m.role === "toolResult");
		assert.ok(toolResult && toolResult.role === "toolResult");
		assert.match(toolResult.content, /columns: dt, gmv/);
		assert.match(toolResult.content, /rows: 2/);
	});

	it("模型对同一条 SQL 取两次时只执行一次", async () => {
		const chat = makeChatPort([
			{ toolCalls: [toolCall("c1", { sql: "SELECT 1 AS v" }), toolCall("c2", { sql: "SELECT 1 AS v" })] },
			{ text: JSON.stringify({ sql: "SELECT 1 AS v", intent: "", chartKind: "chart-kpi" }) },
		]);
		const runs = makeRunSqlPort();
		const out = await runAskTurn({ ai: chat.port, runSql: runs.port, ...base, transcript: [], question: "总共多少" });
		assert.deepEqual(runs.calls, ["SELECT 1 AS v"]);
		assert.equal(out.answer?.chartKind, "chart-kpi");
		assert.deepEqual(out.answer?.sqls, ["SELECT 1 AS v"]);
	});

	it("最终 SQL 与 run_sql 相同：复用缓存，不再打库", async () => {
		const chat = makeChatPort([
			{ toolCalls: [toolCall("c1", { sql: FINAL_SQL })] },
			{ text: FINAL_TEXT },
		]);
		const runs = makeRunSqlPort();
		await runAskTurn({ ai: chat.port, runSql: runs.port, ...base, transcript: [], question: "趋势" });
		assert.deepEqual(runs.calls, [FINAL_SQL]);
	});

	it("模型编造的 chartKind 被意图纠正", async () => {
		const chat = makeChatPort([
			{ text: JSON.stringify({ sql: "SELECT 1", intent: "", chartKind: "chart-3d-bar" }) },
		]);
		const runs = makeRunSqlPort();
		const out = await runAskTurn({
			ai: chat.port,
			runSql: runs.port,
			...base,
			transcript: [],
			question: "各渠道成交额占比",
		});
		assert.equal(out.answer?.chartKind, "chart-donut");
	});
});

describe("ask-loop · 拒绝与兜底", () => {
	it("run_sql 里的写操作被拒且不执行", async () => {
		const chat = makeChatPort([
			{ toolCalls: [toolCall("c1", { sql: "DELETE FROM orders" })] },
			{ text: FINAL_TEXT },
		]);
		const runs = makeRunSqlPort();
		const out = await runAskTurn({ ai: chat.port, runSql: runs.port, ...base, transcript: [], question: "趋势" });
		assert.deepEqual(runs.calls, [FINAL_SQL]);
		const rejected = chat.requests[1].messages.find((m) => m.role === "toolResult");
		assert.ok(rejected && rejected.role === "toolResult");
		assert.equal(rejected.isError, true);
		assert.match(rejected.content, /只读/);
		assert.equal(out.error, null);
	});

	it("缺 sql 参数与未知工具都以 isError 回填", async () => {
		const chat = makeChatPort([
			{
				toolCalls: [
					toolCall("c1", {}),
					toolCall("c2", { sql: "SELECT 1" }, "run_python"),
				],
			},
			{ text: FINAL_TEXT },
		]);
		const runs = makeRunSqlPort();
		await runAskTurn({ ai: chat.port, runSql: runs.port, ...base, transcript: [], question: "趋势" });
		const toolResults = chat.requests[1].messages.filter((m) => m.role === "toolResult");
		assert.equal(toolResults.length, 2);
		for (const message of toolResults) {
			assert.equal(message.role === "toolResult" && message.isError, true);
		}
		assert.match(
			String(toolResults[0].role === "toolResult" ? toolResults[0].content : ""),
			/缺少 sql 参数/,
		);
		assert.match(
			String(toolResults[1].role === "toolResult" ? toolResults[1].content : ""),
			/未知工具 run_python/,
		);
	});

	it("取数抛错时以 isError 回填并继续", async () => {
		const chat = makeChatPort([
			{ toolCalls: [toolCall("c1", { sql: "SELECT * FROM nope" })] },
			{ text: JSON.stringify({ sql: "SELECT 1 AS v", intent: "", chartKind: "chart-kpi" }) },
		]);
		const runs = makeRunSqlPort((sql) => {
			if (sql.includes("nope")) throw new Error("table not found");
			return { columns: ["v"], rows: [{ v: 1 }] };
		});
		const out = await runAskTurn({ ai: chat.port, runSql: runs.port, ...base, transcript: [], question: "总量" });
		const failed = chat.requests[1].messages.find((m) => m.role === "toolResult");
		assert.ok(failed && failed.role === "toolResult" && failed.isError);
		assert.match(failed.content, /table not found/);
		assert.equal(out.error, null);
		assert.deepEqual(out.answer?.sqls, ["SELECT 1 AS v"]);
	});

	it("最终 SQL 执行失败：答案仍然返回，但 result 为 null 且带原因", async () => {
		const chat = makeChatPort([
			{ text: JSON.stringify({ sql: "SELECT * FROM ghost", intent: "查数", chartKind: "chart-table" }) },
		]);
		const runs = makeRunSqlPort(() => {
			throw new Error("relation ghost does not exist");
		});
		const out = await runAskTurn({ ai: chat.port, runSql: runs.port, ...base, transcript: [], question: "查数" });
		assert.equal(out.error, null);
		assert.equal(out.answer?.result, null);
		assert.match(String(out.answer?.error), /最终 SQL 执行失败/);
		assert.match(String(out.answer?.error), /relation ghost/);
	});

	it("坏输出会被纠正一次，纠正后成功", async () => {
		const chat = makeChatPort([{ text: "我觉得成交额在涨。" }, { text: `答案如下\n\`\`\`json\n${FINAL_TEXT}\n\`\`\`` }]);
		const runs = makeRunSqlPort();
		const out = await runAskTurn({ ai: chat.port, runSql: runs.port, ...base, transcript: [], question: "趋势" });
		assert.equal(out.error, null);
		assert.ok(out.answer);
		// 第二条请求最后一条消息是纠正指令
		const last = chat.requests[1].messages[chat.requests[1].messages.length - 1];
		assert.equal(last.role, "user");
		assert.match(last.role === "user" ? last.content : "", /请只输出约定格式的 JSON/);
	});

	it("一直不给 JSON：到轮数上限返回 error，不静默给空答案", async () => {
		const chat = makeChatPort([{ text: "我就是不给 JSON" }]);
		const runs = makeRunSqlPort();
		const out = await runAskTurn({
			ai: chat.port,
			runSql: runs.port,
			...base,
			transcript: [],
			question: "趋势",
			maxRounds: 3,
		});
		assert.equal(out.answer, null);
		assert.match(String(out.error), /没有找到 JSON/);
		assert.equal(chat.requests.length, 3);
	});

	it("已取消的 signal 立刻返回", async () => {
		const chat = makeChatPort([{ text: FINAL_TEXT }]);
		const runs = makeRunSqlPort();
		const controller = new AbortController();
		controller.abort();
		const out = await runAskTurn({
			ai: chat.port,
			runSql: runs.port,
			...base,
			transcript: [],
			question: "趋势",
			signal: controller.signal,
		});
		assert.equal(out.error, "已取消");
		assert.equal(chat.requests.length, 0);
	});
});

describe("ask-loop · transcript 维护", () => {
	it("本轮对话被追加进 transcript，多轮可继续", async () => {
		const chat = makeChatPort([{ text: FINAL_TEXT }]);
		const runs = makeRunSqlPort();
		const out = await runAskTurn({ ai: chat.port, runSql: runs.port, ...base, transcript: [], question: "趋势" });
		assert.deepEqual(
			out.transcript.map((m: PluginAiChatMessage) => m.role),
			["user", "assistant"],
		);
		// 把返回的 transcript 继续传回去，下一轮应在它之后追加
		const second = await runAskTurn({
			ai: chat.port,
			runSql: runs.port,
			...base,
			transcript: out.transcript,
			question: "那 10-14 呢",
		});
		assert.deepEqual(
			second.transcript.map((m) => m.role),
			["user", "assistant", "user", "assistant"],
		);
		assert.equal(runs.calls.length, 2);
	});

	it("trimAskTranscript 丢掉孤儿 toolResult 并封顶", () => {
		const orphan: PluginAiChatMessage[] = [
			{ role: "toolResult", toolCallId: "x", toolName: "run_sql", content: "..." },
			{ role: "user", content: "q" },
			{ role: "assistant", content: "a" },
		];
		assert.deepEqual(
			trimAskTranscript(orphan).map((m) => m.role),
			["user", "assistant"],
		);
		const long: PluginAiChatMessage[] = [{ role: "user", content: "q0" }];
		for (let i = 0; i < 40; i += 1) {
			long.push({ role: "assistant", content: `a${i}` });
			long.push({ role: "user", content: `q${i}` });
		}
		const trimmed = trimAskTranscript(long);
		assert.ok(trimmed.length <= 60);
		assert.equal(trimmed[0].role, "user");
	});
});

describe("ask-loop · 工具结果压缩", () => {
	it("空结果如实说空", () => {
		assert.match(compactResult({ columns: ["a"], rows: [] }), /结果为空/);
	});

	it("超过 30 行只展示前 30 行并标注", () => {
		const rows = Array.from({ length: 45 }, (_, i) => ({ i }));
		const text = compactResult({ columns: ["i"], rows });
		assert.match(text, /rows: 45/);
		assert.match(text, /只展示前 30 行/);
		assert.equal(text.split("\n").length, 2 + 30 + 1);
	});
});

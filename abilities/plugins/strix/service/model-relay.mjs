/**
 * The host-model relay.
 *
 * Astravia already has the user's models configured, and a plugin can reach them
 * through `ctx.ai` - but that API exists only in the plugin's renderer module,
 * while the agent loop that needs it runs in the Python bridge. This file closes
 * that gap: it serves an OpenAI-compatible endpoint on loopback, and hands each
 * request to the renderer, which answers it with `ctx.ai.chat()`. Strix therefore
 * runs on whatever model the user picked in Astravia, with no second credential.
 *
 * The renderer is driven by plugin activation rather than by the panel being
 * visible, so closing the tab does not cut inference off.
 */

import { randomUUID } from "node:crypto";

/** Inference can be slow; a hung renderer must not hold a request forever. */
const JOB_TIMEOUT_MS = 10 * 60_000;
const LONG_POLL_MS = 20_000;

export function createModelRelay() {
	/** Bearer token the scan uses for this endpoint; generated per service start. */
	const token = randomUUID();
	/** @type {{ id: string; request: any }[]} */
	const queue = [];
	/** @type {Set<(payload: any) => void>} */
	const listeners = new Set();
	/** @type {{ models: { id: string; modelKey: string; name?: string }[]; default: string | null }} */
	let registry = { models: [], default: null };

	function notify() {
		for (const listener of [...listeners]) listener();
		listeners.clear();
	}

	/** Ask the renderer to run one request; resolves with its reply. */
	function dispatch(request, timeoutMs = JOB_TIMEOUT_MS) {
		const id = randomUUID();
		return new Promise((resolve, reject) => {
			const waiter = {
				id,
				request,
				settle: (payload) => {
					clearTimeout(timer);
					const queued = queue.findIndex((job) => job.id === id);
					if (queued >= 0) queue.splice(queued, 1);
					if (payload?.error) reject(new Error(payload.error));
					else resolve(payload?.result ?? payload);
				},
			};
			const timer = setTimeout(() => {
				waiter.settle({ error: `the host model did not answer within ${Math.round(timeoutMs / 1000)}s` });
			}, timeoutMs);
			queue.push(waiter);
			notify();
		});
	}

	/** Renderer side: wait for the next job (or the poll timeout). */
	function nextJob(timeoutMs = LONG_POLL_MS) {
		/** Hand out the oldest job nobody has picked up yet. */
		const claim = () => {
			const first = queue.find((job) => !job.taken);
			if (!first) return undefined;
			first.taken = true;
			return { id: first.id, request: first.request };
		};

		const immediate = claim();
		if (immediate) return Promise.resolve(immediate);

		return new Promise((resolve) => {
			let done = false;
			// Wake-ups are "a job may exist now", not a payload: the waiter re-checks the
			// queue itself, so a notify that loses the race cannot hand back an empty job.
			const wake = () => {
				if (done) return;
				const claimed = claim();
				if (claimed) finish(claimed);
			};
			const finish = (value) => {
				if (done) return;
				done = true;
				clearTimeout(timer);
				listeners.delete(wake);
				resolve(value);
			};
			const timer = setTimeout(() => finish(null), timeoutMs);
			listeners.add(wake);
		});
	}

	function complete(id, payload) {
		const job = queue.find((entry) => entry.id === id);
		if (!job) return false;
		job.settle(payload);
		return true;
	}

	return {
		token,
		get models() {
			return registry;
		},
		setModels(next) {
			registry = {
				default: typeof next?.default === "string" ? next.default : null,
				models: Array.isArray(next?.models) ? next.models : [],
			};
		},
		dispatch,
		nextJob,
		complete,
		timeoutMs: JOB_TIMEOUT_MS,
	};
}

/** Rewrite an OpenAI chat request into the shape `ctx.ai.chat` expects. */
export function toHostChatRequest(body) {
	const messages = Array.isArray(body?.messages) ? body.messages : [];
	const systemParts = [];
	/** @type {Map<string, string>} */
	const toolNames = new Map();
	const rounds = [];

	for (const message of messages) {
		const role = String(message?.role ?? "");
		const content = typeof message.content === "string" ? message.content : stringifyContent(message?.content);
		if (role === "system" || role === "developer") {
			if (content) systemParts.push(content);
			continue;
		}
		if (role === "user") {
			rounds.push({ role: "user", content });
			continue;
		}
		if (role === "assistant") {
			const toolCalls = (message.tool_calls ?? []).map((call) => {
				const name = call?.function?.name ?? "";
				if (call?.id) toolNames.set(call.id, name);
				return { id: String(call.id ?? ""), name, arguments: parseArguments(call?.function?.arguments) };
			});
			rounds.push({ role: "assistant", content: content ?? "", ...(toolCalls.length ? { toolCalls } : {}) });
			continue;
		}
		if (role === "tool") {
			rounds.push({
				role: "toolResult",
				toolCallId: String(message.tool_call_id ?? ""),
				toolName: toolNames.get(String(message.tool_call_id ?? "")) ?? "",
				content,
			});
		}
	}

	return {
		systemPrompt: systemParts.join("\n\n") || undefined,
		messages: rounds,
		tools: (body?.tools ?? [])
			.filter((tool) => tool?.type === "function" && tool.function)
			.map((tool) => ({
				name: tool.function.name,
				description: tool.function.description ?? "",
				parameters: tool.function.parameters ?? { type: "object", properties: {} },
			})),
		temperature: typeof body?.temperature === "number" ? body.temperature : undefined,
		maxTokens: typeof body?.max_tokens === "number" ? body.max_tokens : undefined,
	};
}

/** Turn `ctx.ai.chat()`'s reply into an OpenAI chat completion. */
export function toOpenAiCompletion(chat, model) {
	const toolCalls = (chat?.toolCalls ?? []).map((call) => ({
		id: call.id,
		type: "function",
		function: { name: call.name, arguments: JSON.stringify(call.arguments ?? {}) },
	}));
	const finishReason = chat?.stopReason === "toolUse" ? "tool_calls" : chat?.stopReason === "length" ? "length" : "stop";
	return {
		id: `chatcmpl-${randomUUID()}`,
		object: "chat.completion",
		created: Math.floor(Date.now() / 1000),
		model,
		choices: [
			{
				index: 0,
				message: {
					role: "assistant",
					content: chat?.text ?? "",
					...(toolCalls.length ? { tool_calls: toolCalls } : {}),
				},
				finish_reason: finishReason,
			},
		],
		usage: {
			prompt_tokens: chat?.usage?.inputTokens ?? 0,
			completion_tokens: chat?.usage?.outputTokens ?? 0,
			total_tokens: chat?.usage?.totalTokens ?? 0,
		},
	};
}

/** Server-sent-events rendering of the same completion, for clients that stream. */
export function toSseChunks(completion) {
	const message = completion.choices[0]?.message ?? {};
	const head = {
		id: completion.id,
		object: "chat.completion.chunk",
		created: completion.created,
		model: completion.model,
		choices: [{ index: 0, delta: { role: "assistant", content: message.content ?? "" }, finish_reason: null }],
	};
	const tail = {
		id: completion.id,
		object: "chat.completion.chunk",
		created: completion.created,
		model: completion.model,
		choices: [{ index: 0, delta: {}, finish_reason: completion.choices[0]?.finish_reason ?? "stop" }],
		...(message.tool_calls ? { choices: [{ index: 0, delta: { tool_calls: message.tool_calls }, finish_reason: "tool_calls" }] } : {}),
	};
	return { head, tail };
}

function stringifyContent(content) {
	if (!Array.isArray(content)) return "";
	return content
		.map((part) => (typeof part === "string" ? part : typeof part?.text === "string" ? part.text : ""))
		.filter(Boolean)
		.join("\n");
}

function parseArguments(raw) {
	if (typeof raw !== "string") return raw ?? {};
	try {
		const parsed = JSON.parse(raw || "{}");
		return typeof parsed === "object" && parsed ? parsed : {};
	} catch {
		return {};
	}
}

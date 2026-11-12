/**
 * The scan loop: the host's model, Strix's tools, one transcript the plugin owns.
 *
 * Upstream runs this loop inside its own Python agent with its own model key. Here the
 * model comes from `ctx.ai` (the model the user already configured in Astravia) and
 * the tools come from the bridge service, so a scan costs no second credential and
 * produces no second transcript. `ctx.ai.chat` is stateless: this class keeps the
 * messages and replays them, which is exactly the contract the SDK documents.
 *
 * Tools split two ways, per the shared catalogue: `service` tools go over HTTP to the
 * process that owns the container, `plugin` tools are answered here because they need
 * the model (spawning an agent) or the operator (asking a question).
 *
 * Failure policy: a tool that throws becomes an `isError` tool result and the loop
 * continues - an agent that dies on the first `command not found` is useless. A model
 * call that throws ends the run, because there is nothing left to reason with.
 */

import type { PluginAiApi, PluginAiChatMessage, PluginAiChatTool } from "@astravia-org/plugin-sdk";
import type { BridgeClient } from "../domain/bridge-client";
import { buildAssessmentBrief, STRIX_SYSTEM_PROMPT } from "./system-prompt";
import { describeToolCall, describeToolResult, STRIX_TOOLS } from "./strix-tools";

/** A loop that never stops is a bill, not a scan: upstream caps turns too. */
const MAX_TURNS = 80;
/** The model sees a bounded tool result; the panel keeps the tail for the trace. */
const MAX_TOOL_CONTENT = 8_000;
/** Upstream caps parallel specialists for the same reason: a sandbox is shared. */
const MAX_CHILDREN = 3;

export type AgentEvent =
	| { type: "say"; text: string; agent?: string }
	| { type: "tool-start"; callId: string; name: string; label?: string; agent?: string }
	| { type: "tool-end"; callId: string; ok: boolean; detail?: string; output?: string; agent?: string }
	| { type: "note"; text: string; agent?: string }
	/** A child agent started, moved to a new status, or produced its summary. */
	| { type: "agent"; agent: AgentStatus }
	/** The operator is being asked something; `answerQuestion` resolves it. */
	| { type: "question"; question: string; options?: string[] }
	/** The assessment ended through `strix_finish`. */
	| { type: "finished"; summary: string };

export interface AgentStatus {
	name: string;
	status: "running" | "done" | "failed";
	task: string;
	result?: string;
}

export interface FinishRequest {
	executiveSummary: string;
	targets?: string[];
}

export interface LocalToolHost {
	/** Ask the operator; resolves with their answer, rejects when the panel closes. */
	askUser(question: string, options?: string[]): Promise<string>;
	/** `strix_finish`: the shell writes the report and stops the run. */
	finish(request: FinishRequest): Promise<void>;
}

export interface StrixAgentDeps {
	ai: PluginAiApi;
	bridge: BridgeClient;
	emit: (event: AgentEvent) => void;
	local: LocalToolHost;
	/** Tools offered to the model; defaults to the full catalogue. */
	tools?: PluginAiChatTool[];
	maxTurns?: number;
	/** Depth 0 is the lead; specialists run at depth 1 and cannot spawn further. */
	depth?: number;
	/** Name shown next to a specialist's rows; absent for the lead. */
	name?: string;
}

export interface AssessmentRequest {
	modelKey?: string;
	targets: string[];
	instruction: string;
	/** The conversation's cwd, mounted into the sandbox as the working directory. */
	workspace?: string;
}

function clip(value: string, limit = MAX_TOOL_CONTENT): string {
	return value.length <= limit ? value : `${value.slice(0, limit)}\n[... ${value.length - limit} chars truncated ...]`;
}

/** What the model gets back: the useful fields of a tool result, as text. */
function toolContent(result: unknown): string {
	if (typeof result === "string") return clip(result);
	const value = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
	if (typeof value.stdout === "string" || typeof value.stderr === "string") {
		const parts = [
			typeof value.exitCode === "number" ? `exit code: ${value.exitCode}` : "",
			typeof value.stdout === "string" && value.stdout.trim() ? `stdout:\n${value.stdout}` : "",
			typeof value.stderr === "string" && value.stderr.trim() ? `stderr:\n${value.stderr}` : "",
		].filter(Boolean);
		return clip(parts.join("\n\n") || "command finished with no output");
	}
	return clip(JSON.stringify(result, null, 2));
}

/** The tail of a tool result worth showing in the trace, folded away by default. */
function toolOutput(result: unknown): string | undefined {
	const value = result && typeof result === "object" ? (result as Record<string, unknown>) : {};
	const text =
		typeof value.stdout === "string" && value.stdout.trim()
			? value.stdout
			: typeof value.stderr === "string" && value.stderr.trim()
				? value.stderr
				: undefined;
	return text ? text.trim().slice(-2_000) : undefined;
}

export class StrixAgent {
	private messages: PluginAiChatMessage[] = [];
	private controller: AbortController | undefined;
	private running = false;
	private finished = false;
	private readonly children = new Map<string, { agent: StrixAgent; status: AgentStatus }>();

	constructor(private readonly deps: StrixAgentDeps) {}

	get busy(): boolean {
		return this.running;
	}

	get childAgents(): AgentStatus[] {
		return [...this.children.values()].map((child) => child.status);
	}

	/** Stop after the current model call or tool returns; children stop too. */
	abort(): void {
		this.controller?.abort();
		for (const child of this.children.values()) child.agent.abort();
	}

	/** Begin an assessment: start the sandbox, seed the transcript, run the loop. */
	async start(request: AssessmentRequest): Promise<void> {
		if (this.running) throw new Error("a scan is already running");
		this.messages = [{ role: "user", content: buildAssessmentBrief(request.targets, request.instruction) }];
		this.finished = false;
		await this.runLoop(request.modelKey, request.targets, request.workspace);
	}

	/** A follow-up instruction inside the same assessment. */
	async send(text: string, modelKey?: string): Promise<void> {
		if (this.running) throw new Error("a scan is already running");
		this.messages.push({ role: "user", content: text });
		this.finished = false;
		await this.runLoop(modelKey);
	}

	private async runLoop(modelKey?: string, targets?: readonly string[], workspace?: string): Promise<void> {
		this.running = true;
		this.controller = new AbortController();
		const { ai, emit, tools = STRIX_TOOLS, maxTurns = MAX_TURNS, name } = this.deps;
		const signal = this.controller.signal;
		const tag = name ? { agent: name } : {};

		try {
			if (targets) await this.openSandbox(targets, workspace);

			for (let turn = 0; turn < maxTurns; turn += 1) {
				if (signal.aborted) {
					emit({ type: "note", text: "Stopped.", ...tag });
					return;
				}

				const reply = await ai.chat({
					...(modelKey ? { modelKey } : {}),
					systemPrompt: name ? `${STRIX_SYSTEM_PROMPT}\n\nYou are the "${name}" specialist on a team.` : STRIX_SYSTEM_PROMPT,
					// A copy, not the live array: the host must not observe turns appended
					// after the call it is answering.
					messages: [...this.messages],
					tools,
				});

				const text = reply.text.trim();
				if (text) {
					// Kept as the agent's "result" when it is a specialist: the lead reads this
					// summary, exactly as upstream's agent_finish reports one.
					this.lastSay = text;
					emit({ type: "say", text, ...tag });
				}
				this.messages.push({ role: "assistant", content: reply.text, toolCalls: reply.toolCalls });

				if (reply.stopReason !== "toolUse" || !reply.toolCalls.length) return;

				for (const call of reply.toolCalls) {
					const label = describeToolCall(call.name, call.arguments);
					emit({ type: "tool-start", callId: call.id, name: call.name, label, ...tag });

					let ok = true;
					let content: string;
					const started = Date.now();
					try {
						const result = await this.runTool(call.name, call.arguments);
						content = toolContent(result);
						emit({
							type: "tool-end",
							callId: call.id,
							ok: true,
							detail: [describeToolResult(result), `${((Date.now() - started) / 1000).toFixed(1)}s`]
								.filter(Boolean)
								.join(" · "),
							output: toolOutput(result),
							...tag,
						});
					} catch (cause) {
						ok = false;
						content = cause instanceof Error ? cause.message : String(cause);
						emit({ type: "tool-end", callId: call.id, ok: false, detail: content, ...tag });
					}

					this.messages.push({
						role: "toolResult",
						toolCallId: call.id,
						toolName: call.name,
						content,
						isError: !ok,
					});

					// `finish` ends the assessment: the model's remaining turns would only
					// repeat what the summary already says.
					if (this.finished) return;
				}
			}
			emit({ type: "note", text: `Stopped after ${maxTurns} turns without a conclusion.`, ...tag });
		} finally {
			this.running = false;
			this.controller = undefined;
		}
	}

	/** Route one tool call to the side that owns it. */
	private async runTool(name: string, args: Record<string, unknown>): Promise<unknown> {
		switch (name) {
			case "strix_think":
				return { recorded: String(args.thought ?? "") };
			case "strix_ask_user": {
				const answer = await this.deps.local.askUser(
					String(args.question ?? ""),
					Array.isArray(args.options) ? args.options.map(String) : undefined,
				);
				return { answer };
			}
			case "strix_finish": {
				const request: FinishRequest = {
					executiveSummary: String(args.executiveSummary ?? ""),
					...(Array.isArray(args.targets) ? { targets: args.targets.map(String) } : {}),
				};
				this.finished = true;
				await this.deps.local.finish(request);
				this.deps.emit({ type: "finished", summary: request.executiveSummary });
				return { finished: true };
			}
			case "strix_spawn_agent":
				return this.spawn(String(args.name ?? ""), String(args.task ?? ""));
			case "strix_wait_agents":
				return this.waitChildren();
			case "strix_view_agents":
				return { agents: this.childAgents };
			default:
				return this.deps.bridge.callTool(name, args);
		}
	}

	/**
	 * Start a specialist on a subtask.
	 *
	 * It shares the sandbox and the findings ledger - that is the point of a team: a
	 * child's evidence lands where the lead's does - but keeps its own transcript, so
	 * two lines of work do not interleave inside one context window.
	 */
	private spawn(name: string, task: string): { name: string; started: boolean } {
		if (this.deps.depth) throw new Error("a specialist cannot spawn its own specialists");
		if (!name.trim()) throw new Error("name is required");
		if (!task.trim()) throw new Error("task is required");
		if (this.children.has(name)) throw new Error(`an agent named ${name} already exists`);
		if (this.children.size >= MAX_CHILDREN) {
			throw new Error(`at most ${MAX_CHILDREN} agents run at once; call strix_wait_agents first`);
		}

		const status: AgentStatus = { name, status: "running", task };
		const child = new StrixAgent({
			...this.deps,
			depth: (this.deps.depth ?? 0) + 1,
			name,
			emit: (event) => {
				if (event.type === "finished") return;
				this.deps.emit(event);
			},
		});
		this.children.set(name, { agent: child, status });
		this.deps.emit({ type: "agent", agent: status });

		void child
			.start({ modelKey: undefined, targets: [], instruction: task, workspace: undefined })
			.then(() => {
				const last = child.lastSay ?? "(no summary)";
				this.updateChild(name, { status: "done", result: last });
			})
			.catch((cause: unknown) => {
				this.updateChild(name, { status: "failed", result: cause instanceof Error ? cause.message : String(cause) });
			});

		return { name, started: true };
	}

	/** The last assistant line: a child's de-facto result summary. */
	lastSay?: string;

	private updateChild(name: string, patch: Partial<AgentStatus>): void {
		const entry = this.children.get(name);
		if (!entry) return;
		entry.status = { ...entry.status, ...patch };
		this.deps.emit({ type: "agent", agent: entry.status });
	}

	private async waitChildren(): Promise<{ agents: AgentStatus[] }> {
		const pending = [...this.children.values()].filter((child) => child.status.status === "running");
		await Promise.all(pending.map((child) => child.agent.idle()));
		return { agents: this.childAgents };
	}

	/** Resolves when the loop is not running; used to join a child. */
	idle(): Promise<void> {
		if (!this.running) return Promise.resolve();
		return new Promise((resolve) => {
			const timer = setInterval(() => {
				if (!this.running) {
					clearInterval(timer);
					resolve();
				}
			}, 200);
		});
	}

	/**
	 * Start the container before the first model call, so a machine that cannot run the
	 * sandbox says so in the launch log instead of burning a turn to find out.
	 *
	 * The conversation's cwd is mounted as well: the same workspace the chat agent can
	 * read is the one this loop gets to break, which is what makes "review this repo"
	 * mean the same thing in both windows.
	 */
	private async openSandbox(targets: readonly string[], workspace?: string): Promise<void> {
		const { bridge, emit } = this.deps;
		const args: Record<string, unknown> = { targets: [...targets] };
		if (workspace) args.localSources = [{ path: workspace }];
		const status = await bridge.callTool("strix_sandbox_start", args).catch((cause: unknown) => {
			throw new Error(`sandbox failed to start: ${cause instanceof Error ? cause.message : String(cause)}`);
		});
		emit({ type: "note", text: `Sandbox ready (${(status as { sessionId?: string }).sessionId ?? "session"}).` });
	}
}

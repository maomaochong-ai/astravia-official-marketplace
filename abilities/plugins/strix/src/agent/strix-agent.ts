/**
 * The scan loop: the host's model, Strix's tools, one transcript the plugin owns.
 *
 * Upstream runs this loop inside its own Python agent with its own model key. Here
 * the model comes from `ctx.ai` (the model the user already configured in Astravia)
 * and the tools come from the bridge service, so a scan costs no second credential
 * and produces no second transcript. `ctx.ai.chat` is stateless: this class keeps
 * the messages and replays them, which is exactly the contract the SDK documents.
 *
 * Failure policy: a tool that throws becomes an `isError` tool result and the loop
 * continues - an agent that dies on the first `command not found` is useless. A
 * model call that throws ends the run, because there is nothing left to reason with.
 */
import type { PluginAiApi, PluginAiChatMessage, PluginAiChatTool } from "@astravia-org/plugin-sdk";
import type { BridgeClient } from "../domain/bridge-client";
import { buildAssessmentBrief, STRIX_SYSTEM_PROMPT } from "./system-prompt";
import { describeToolCall, describeToolResult, STRIX_TOOLS } from "./strix-tools";

/** A loop that never stops is a bill, not a scan: upstream caps turns too. */
const MAX_TURNS = 80;
/** The model sees a bounded tool result; the panel keeps the tail for the trace. */
const MAX_TOOL_CONTENT = 8_000;

export type AgentEvent =
	| { type: "say"; text: string }
	| { type: "tool-start"; callId: string; name: string; label?: string }
	| { type: "tool-end"; callId: string; ok: boolean; detail?: string; output?: string }
	| { type: "note"; text: string };

export interface StrixAgentDeps {
	ai: PluginAiApi;
	bridge: BridgeClient;
	emit: (event: AgentEvent) => void;
	/** Tools offered to the model; defaults to the full bridge surface. */
	tools?: PluginAiChatTool[];
	maxTurns?: number;
}

export interface AssessmentRequest {
	modelKey?: string;
	targets: string[];
	instruction: string;
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

	constructor(private readonly deps: StrixAgentDeps) {}

	get busy(): boolean {
		return this.running;
	}

	/** Stop after the current model call or tool returns; the loop checks the flag. */
	abort(): void {
		this.controller?.abort();
	}

	/** Begin an assessment: start the sandbox, seed the transcript, run the loop. */
	async start(request: AssessmentRequest): Promise<void> {
		if (this.running) throw new Error("a scan is already running");
		this.messages = [
			{ role: "user", content: buildAssessmentBrief(request.targets, request.instruction) },
		];
		await this.runLoop(request.modelKey, request.targets);
	}

	/** A follow-up instruction inside the same assessment. */
	async send(text: string, modelKey?: string): Promise<void> {
		if (this.running) throw new Error("a scan is already running");
		this.messages.push({ role: "user", content: text });
		await this.runLoop(modelKey);
	}

	private async runLoop(modelKey?: string, targets?: readonly string[]): Promise<void> {
		this.running = true;
		this.controller = new AbortController();
		const { ai, bridge, emit, tools = STRIX_TOOLS, maxTurns = MAX_TURNS } = this.deps;
		const signal = this.controller.signal;

		try {
			if (targets) await this.openSandbox(targets);

			for (let turn = 0; turn < maxTurns; turn += 1) {
				if (signal.aborted) {
					emit({ type: "note", text: "Stopped." });
					return;
				}

				const reply = await ai.chat({
					...(modelKey ? { modelKey } : {}),
					systemPrompt: STRIX_SYSTEM_PROMPT,
					// A copy, not the live array: the host must not observe turns appended
					// after the call it is answering.
					messages: [...this.messages],
					tools,
				});

				const text = reply.text.trim();
				if (text) emit({ type: "say", text });
				this.messages.push({ role: "assistant", content: reply.text, toolCalls: reply.toolCalls });

				if (reply.stopReason !== "toolUse" || !reply.toolCalls.length) return;

				for (const call of reply.toolCalls) {
					const label = describeToolCall(call.name, call.arguments);
					emit({ type: "tool-start", callId: call.id, name: call.name, label });

					let ok = true;
					let content: string;
					const started = Date.now();
					try {
						const result = await bridge.callTool(call.name, call.arguments);
						content = toolContent(result);
						emit({
							type: "tool-end",
							callId: call.id,
							ok: true,
							detail: [describeToolResult(result), `${((Date.now() - started) / 1000).toFixed(1)}s`]
								.filter(Boolean)
								.join(" · "),
							output: toolOutput(result),
						});
					} catch (cause) {
						ok = false;
						content = cause instanceof Error ? cause.message : String(cause);
						emit({ type: "tool-end", callId: call.id, ok: false, detail: content });
					}

					this.messages.push({
						role: "toolResult",
						toolCallId: call.id,
						toolName: call.name,
						content,
						isError: !ok,
					});
				}
			}
			emit({ type: "note", text: `Stopped after ${maxTurns} turns without a conclusion.` });
		} finally {
			this.running = false;
			this.controller = undefined;
		}
	}

	/**
	 * Start the container before the first model call, so a machine that cannot run
	 * the sandbox says so in the launch log instead of burning a turn to find out.
	 */
	private async openSandbox(targets: readonly string[]): Promise<void> {
		const { bridge, emit } = this.deps;
		const status = await bridge
			.callTool("strix_sandbox_start", { targets: [...targets] })
			.catch((cause: unknown) => {
				throw new Error(`sandbox failed to start: ${cause instanceof Error ? cause.message : String(cause)}`);
			});
		emit({ type: "note", text: `Sandbox ready (${(status as { sessionId?: string }).sessionId ?? "session"}).` });
	}
}

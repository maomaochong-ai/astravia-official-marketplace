import type { PluginAiApi, PluginAiChatRequest, PluginAiChatResult } from "@astravia-org/plugin-sdk";
import { describe, expect, it, vi } from "vitest";
import { StrixAgent, type AgentEvent } from "../agent/strix-agent";
import type { BridgeClient } from "../domain/bridge-client";

/**
 * The loop is the part that can quietly misbehave - repeat a tool call, swallow a
 * failure, or keep going after a stop - so it is tested against a scripted model and
 * a stub bridge rather than through the panel.
 */

const reply = (overrides: Partial<PluginAiChatResult>): PluginAiChatResult => ({
	modelKey: "openai/gpt",
	text: "",
	toolCalls: [],
	stopReason: "stop",
	usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
	...overrides,
});

function scriptedAi(replies: PluginAiChatResult[]): { ai: PluginAiApi; calls: PluginAiChatRequest[] } {
	const calls: PluginAiChatRequest[] = [];
	const unused = async () => {
		throw new Error("not used");
	};
	const ai = {
		listModels: async () => ({ defaultModel: null, models: [] }),
		complete: unused,
		stream: unused,
		chat: async (request: PluginAiChatRequest) => {
			calls.push(request);
			const next = replies.shift();
			if (!next) throw new Error("model called more times than the script allows");
			return next;
		},
	} as unknown as PluginAiApi;
	return { ai, calls };
}

function stubBridge(handlers: Record<string, (args: Record<string, unknown>) => unknown>): {
	bridge: BridgeClient;
	calls: { name: string; args: Record<string, unknown> }[];
} {
	const calls: { name: string; args: Record<string, unknown> }[] = [];
	const bridge: BridgeClient = {
		state: async () => ({ environment: {}, sandbox: { running: false }, findings: [], logTail: [] }) as never,
		findings: async () => [],
		report: async () => ({ markdown: "", count: 0 }),
		stopSandbox: async () => ({ stopped: true }),
		events: () => () => undefined,
		callTool: async (name, args = {}) => {
			calls.push({ name, args });
			const handler = handlers[name];
			if (!handler) throw new Error(`no handler for ${name}`);
			return handler(args);
		},
	};
	return { bridge, calls };
}

describe("Strix agent loop", () => {
	it("starts the sandbox, runs a tool call, then stops when the model is done", async () => {
		const events: AgentEvent[] = [];
		const { ai, calls } = scriptedAi([
			reply({
				stopReason: "toolUse",
				toolCalls: [{ id: "c1", name: "strix_exec", arguments: { command: "id" } }],
			}),
			reply({ text: "Nothing else to check." }),
		]);
		const { bridge, calls: toolCalls } = stubBridge({
			strix_sandbox_start: () => ({ running: true, sessionId: "s1", targets: ["example.com"] }),
			strix_exec: () => ({ exitCode: 0, durationMs: 1200, stdout: "uid=0(root)" }),
		});

		const agent = new StrixAgent({ ai, bridge, emit: (event) => events.push(event) });
		await agent.start({ targets: ["example.com"], instruction: "", modelKey: "openai/gpt" });

		expect(toolCalls[0]).toEqual({ name: "strix_sandbox_start", args: { targets: ["example.com"] } });
		expect(toolCalls[1]).toEqual({ name: "strix_exec", args: { command: "id" } });
		expect(calls[0]?.messages[0]).toMatchObject({ role: "user" });
		// The second model call must carry the tool result, or the model re-runs the command.
		expect(calls[1]?.messages.at(-1)).toMatchObject({
			role: "toolResult",
			toolCallId: "c1",
			isError: false,
		});
		expect(events).toContainEqual({ type: "say", text: "Nothing else to check." });
		expect(events.filter((event) => event.type === "tool-start")).toHaveLength(1);
		expect(events.filter((event) => event.type === "tool-end")).toHaveLength(1);
		expect(events.find((event) => event.type === "tool-end")).toMatchObject({ ok: true });
	});

	it("hands a tool failure back to the model instead of ending the run", async () => {
		const { ai, calls } = scriptedAi([
			reply({ stopReason: "toolUse", toolCalls: [{ id: "c1", name: "strix_exec", arguments: { command: "nope" } }] }),
			reply({ text: "That binary is missing; trying the system one." }),
		]);
		const { bridge } = stubBridge({
			strix_sandbox_start: () => ({ running: true, sessionId: "s1" }),
			strix_exec: () => {
				throw new Error("sh: nope: not found");
			},
		});

		const agent = new StrixAgent({ ai, bridge, emit: () => undefined });
		await agent.start({ targets: ["example.com"], instruction: "" });

		expect(calls[1]?.messages.at(-1)).toMatchObject({
			role: "toolResult",
			isError: true,
			content: "sh: nope: not found",
		});
	});

	it("sends a follow-up instruction into the same transcript", async () => {
		const { ai, calls } = scriptedAi([reply({ text: "first" }), reply({ text: "second" })]);
		const { bridge } = stubBridge({ strix_sandbox_start: () => ({ running: true, sessionId: "s1" }) });

		const agent = new StrixAgent({ ai, bridge, emit: () => undefined });
		await agent.start({ targets: ["example.com"], instruction: "" });
		await agent.send("also check the admin panel");

		expect(calls[1]?.messages.map((message) => message.role)).toEqual(["user", "assistant", "user"]);
		expect(calls[1]?.messages.at(-1)).toMatchObject({ role: "user", content: "also check the admin panel" });
	});

	it("stops at the next boundary after an abort, without another model call", async () => {
		const events: AgentEvent[] = [];
		let agent: StrixAgent;
		const { ai, calls } = scriptedAi([reply({ stopReason: "toolUse", toolCalls: [{ id: "c1", name: "strix_exec", arguments: { command: "sleep 1" } }] })]);
		const { bridge } = stubBridge({
			strix_sandbox_start: () => ({ running: true, sessionId: "s1" }),
			strix_exec: () => {
				// The user hits stop while the command is still running.
				agent.abort();
				return { exitCode: 0, stdout: "done" };
			},
		});

		agent = new StrixAgent({ ai, bridge, emit: (event) => events.push(event) });
		await agent.start({ targets: ["example.com"], instruction: "" });

		expect(calls).toHaveLength(1);
		expect(events).toContainEqual({ type: "note", text: "Stopped." });
	});

	it("refuses to start a second run on the same agent", async () => {
		let release: (value: PluginAiChatResult) => void = () => undefined;
		const ai = {
			listModels: vi.fn(),
			complete: vi.fn(),
			stream: vi.fn(),
			chat: () => new Promise<PluginAiChatResult>((resolve) => (release = resolve)),
		} as unknown as PluginAiApi;
		const { bridge } = stubBridge({ strix_sandbox_start: () => ({ running: true, sessionId: "s1" }) });

		const agent = new StrixAgent({ ai, bridge, emit: () => undefined });
		const first = agent.start({ targets: ["example.com"], instruction: "" });
		await expect(agent.start({ targets: ["example.com"], instruction: "" })).rejects.toThrow(/already running/);
		release(reply({ text: "done" }));
		await first;
	});
});

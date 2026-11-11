import { describe, expect, it } from "vitest";
// The relay lives beside the service it serves; the test reaches across because that
// module is what decides whether the host's models can drive a scan at all.
import { toHostChatRequest, toOpenAiCompletion, toSseChunks } from "../../service/model-relay.mjs";

const call = (name: string, args: Record<string, unknown>) => ({
	id: "call_1",
	type: "function",
	function: { name, arguments: JSON.stringify(args) },
});

describe("host model relay translation", () => {
	it("splits the system prompt out and keeps the round order", () => {
		const request = toHostChatRequest({
			messages: [
				{ role: "system", content: "You are Strix." },
				{ role: "user", content: "scan example.com" },
				{ role: "assistant", content: "on it", tool_calls: [call("exec_command", { command: "nmap" })] },
				{ role: "tool", tool_call_id: "call_1", content: "open 22" },
			],
		});

		expect(request.systemPrompt).toBe("You are Strix.");
		expect(request.messages).toEqual([
			{ role: "user", content: "scan example.com" },
			{
				role: "assistant",
				content: "on it",
				toolCalls: [{ id: "call_1", name: "exec_command", arguments: { command: "nmap" } }],
			},
			// The tool result carries the tool name the assistant turn established, because
			// OpenAI's tool message only repeats the call id.
			{ role: "toolResult", toolCallId: "call_1", toolName: "exec_command", content: "open 22" },
		]);
	});

	it("flattens function tools and drops everything that is not one", () => {
		const request = toHostChatRequest({
			messages: [],
			tools: [
				{ type: "function", function: { name: "read", description: "Read a file", parameters: { type: "object" } } },
				{ type: "web_search" },
			],
		});
		expect(request.tools).toEqual([{ name: "read", description: "Read a file", parameters: { type: "object" } }]);
	});

	it("reports tool calls as finish_reason tool_calls so the agent keeps looping", () => {
		const completion = toOpenAiCompletion(
			{
				text: "",
				toolCalls: [{ id: "call_9", name: "exec_command", arguments: { command: "ls" } }],
				stopReason: "toolUse",
				usage: { inputTokens: 10, outputTokens: 2, totalTokens: 12 },
			},
			"deepseek/deepseek-chat",
		);

		expect(completion.choices[0]?.finish_reason).toBe("tool_calls");
		expect(completion.choices[0]?.message.tool_calls?.[0]?.function.arguments).toBe('{"command":"ls"}');
		expect(completion.usage).toEqual({ prompt_tokens: 10, completion_tokens: 2, total_tokens: 12 });
		expect(completion.model).toBe("deepseek/deepseek-chat");
	});

	it("wraps a plain reply into the streaming envelope Strix's client expects", () => {
		const completion = toOpenAiCompletion({ text: "done", stopReason: "stop" }, "m");
		const { head, tail } = toSseChunks(completion);
		expect(head.choices[0]?.delta.content).toBe("done");
		expect(tail.choices[0]?.finish_reason).toBe("stop");
	});
});

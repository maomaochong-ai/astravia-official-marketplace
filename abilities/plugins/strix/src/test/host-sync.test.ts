import { describe, expect, it } from "vitest";
import { hostToolCall, resolveModel, strixToolName, workspaceLabel } from "../domain/host-sync";

const model = (modelKey: string, name = "", provider = "") => ({
	modelKey,
	provider,
	id: modelKey,
	name,
	api: "chat",
	reasoning: false,
	input: ["text"] as Array<"text" | "image">,
	contextWindow: 128_000,
});

/**
 * These are the three channels that make the tab part of the host rather than a
 * separate tool: which model it runs on, which folder is mounted, and whose tool
 * calls appear in the trace.
 */
describe("host sync", () => {
	it("runs on the conversation's model, not the settings default", () => {
		const resolved = resolveModel({
			conversationModel: "anthropic/claude-opus-5-5",
			models: [model("openai/gpt-6"), model("anthropic/claude-opus-5-5", "Claude Opus 5.5")],
			defaultModel: "openai/gpt-6",
		});
		expect(resolved.fromConversation).toBe(true);
		expect(resolved.choice?.modelKey).toBe("anthropic/claude-opus-5-5");
		expect(resolved.choice?.name).toBe("Claude Opus 5.5");
	});

	it("still follows a conversation model the host did not list for text", () => {
		// A conversation can run a model the picker hides; the host stays authoritative,
		// so the key is used as-is and the label is derived from it.
		const resolved = resolveModel({
			conversationModel: "local/llama-4",
			models: [model("openai/gpt-6")],
			defaultModel: "openai/gpt-6",
		});
		expect(resolved.fromConversation).toBe(true);
		expect(resolved.choice).toEqual({ modelKey: "local/llama-4", name: "llama-4", provider: "local" });
	});

	it("falls back to the default when the conversation has no model", () => {
		const resolved = resolveModel({
			conversationModel: null,
			models: [model("openai/gpt-6", "GPT-6")],
			defaultModel: "openai/gpt-6",
		});
		expect(resolved.fromConversation).toBe(false);
		expect(resolved.choice?.name).toBe("GPT-6");
	});

	it("takes the first listed model when nothing is configured at all", () => {
		expect(resolveModel({ conversationModel: null, models: [model("openai/gpt-6")], defaultModel: null }).choice?.modelKey).toBe(
			"openai/gpt-6",
		);
	});

	it("recognises the Strix tool behind whatever namespace the host applied", () => {
		expect(strixToolName("strix_exec")).toBe("strix_exec");
		expect(strixToolName("mcp__strix__strix_sandbox_start")).toBe("strix_sandbox_start");
		expect(strixToolName("github_list_issues")).toBeUndefined();
		expect(strixToolName("mcp__github__strixlike")).toBeUndefined();
	});

	it("names a host tool call by the argument that says what it acts on", () => {
		expect(hostToolCall("mcp__strix__strix_exec", { command: "nmap -sV example.com" })).toEqual({
			label: "strix_exec",
			detail: "nmap -sV example.com",
		});
		expect(hostToolCall("strix_sandbox_start", { targets: ["example.com"] })).toEqual({
			label: "strix_sandbox_start",
			detail: "example.com",
		});
		// Not Strix's: must not appear in the assessment trace.
		expect(hostToolCall("read_file", { path: "/etc/hosts" })).toBeUndefined();
	});

	it("shows the mounted folder by its last path segment", () => {
		expect(workspaceLabel("D:\\open-source-projects\\strix")).toBe("strix");
		expect(workspaceLabel("/home/me/app/")).toBe("app");
		expect(workspaceLabel(null)).toBeUndefined();
	});
});

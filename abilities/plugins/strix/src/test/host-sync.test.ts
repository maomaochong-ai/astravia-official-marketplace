import { describe, expect, it } from "vitest";
import { resolveModel, workspaceLabel } from "../domain/host-sync";

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
 * Two channels that make the tab part of the host rather than a separate tool: which
 * model it reports, and which folder the sandbox mounts. The third — whose tool calls
 * appear in the trace — moved to `conversation-projection.test.ts` with the event split.
 */
describe("host sync", () => {
	it("reports the conversation's model, not the settings default", () => {
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
		const resolved = resolveModel({
			conversationModel: "local/llama-4",
			models: [model("openai/gpt-6")],
			defaultModel: "openai/gpt-6",
		});
		expect(resolved.fromConversation).toBe(true);
		expect(resolved.choice).toEqual({ modelKey: "local/llama-4", name: "llama-4", provider: "local" });
	});

	it("labels a model without asking the host for the list at all", () => {
		// The panel no longer calls `ctx.ai.listModels()`: the conversation key carries
		// both halves, so a display label needs no second AI surface.
		expect(resolveModel({ conversationModel: "openai/gpt-6" }).choice).toEqual({
			modelKey: "openai/gpt-6",
			name: "gpt-6",
			provider: "openai",
		});
	});

	it("says nothing when the conversation has no model, instead of borrowing the default", () => {
		// ADR strix-0003: the panel is not a second model picker. A host-wide default
		// named here would claim a model the chat is not running.
		const resolved = resolveModel({
			conversationModel: null,
			models: [model("openai/gpt-6", "GPT-6")],
			defaultModel: "openai/gpt-6",
		});
		expect(resolved.fromConversation).toBe(false);
		expect(resolved.choice).toBeUndefined();
	});

	it("never invents a choice from the list when nothing is configured", () => {
		expect(resolveModel({ conversationModel: null, models: [model("openai/gpt-6")], defaultModel: null }).choice).toBeUndefined();
	});

	it("shows the mounted folder by its last path segment", () => {
		expect(workspaceLabel("D:\\open-source-projects\\strix")).toBe("strix");
		expect(workspaceLabel("/home/me/app/")).toBe("app");
		expect(workspaceLabel(null)).toBeUndefined();
	});
});

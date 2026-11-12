import { describe, expect, it } from "vitest";
import { chooseModel, modelLabel, toChoice } from "../domain/model-label";

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

describe("model line", () => {
	it("splits provider from name at the last slash, as upstream splits STRIX_LLM", () => {
		expect(modelLabel("openrouter/z-ai/glm-5.3")).toEqual({ name: "glm-5.3", provider: "openrouter/z-ai" });
		expect(modelLabel("gpt-5.4")).toEqual({ name: "gpt-5.4", provider: "" });
	});

	it("prefers the label the host resolved", () => {
		expect(toChoice(model("openai/gpt-5", "GPT-5", "openai"))).toEqual({
			modelKey: "openai/gpt-5",
			name: "GPT-5",
			provider: "openai",
		});
	});

	it("takes the user's default when the host offers one", () => {
		const list = { defaultModel: "anthropic/claude", models: [model("openai/gpt"), model("anthropic/claude")] };
		expect(chooseModel(list)?.modelKey).toBe("anthropic/claude");
	});

	it("falls back to the first available model when there is no default", () => {
		expect(chooseModel({ defaultModel: null, models: [model("openai/gpt")] })?.modelKey).toBe("openai/gpt");
	});

	it("reports nothing when the host has no model configured", () => {
		expect(chooseModel({ defaultModel: null, models: [] })).toBeUndefined();
		expect(chooseModel(undefined)).toBeUndefined();
	});
});

import { describe, expect, it } from "vitest";
import {
	filterModels,
	formatContextWindow,
	parseModelRows,
	summarizeCatalog,
	toModelDefinitions,
} from "../src/model-catalog";

/** 一行与 magpie `/v1/models` 真实返回同形的数据（字段名与 gateway.go 的 modelObject 对齐）。 */
function row(overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id: "claude-sonnet-4",
		object: "model",
		type: "model",
		created: 0,
		created_at: "2025-01-01T00:00:00Z",
		owned_by: "anthropic",
		display_name: "Claude Sonnet 4",
		reasoning: false,
		reasoning_levels: [],
		context_window: 200000,
		max_output_tokens: 64000,
		modalities: { input: ["text"], output: ["text"] },
		...overrides,
	};
}

describe("parseModelRows", () => {
	it("reads the OpenAI list envelope", () => {
		const rows = parseModelRows({ object: "list", data: [row()] });
		expect(rows).toEqual([
			{
				id: "claude-sonnet-4",
				name: "Claude Sonnet 4",
				provider: "anthropic",
				contextWindow: 200000,
				maxOutputTokens: 64000,
				reasoning: false,
				reasoningLevels: [],
				images: false,
			},
		]);
	});

	it("returns an empty catalog instead of throwing on junk", () => {
		expect(parseModelRows(undefined)).toEqual([]);
		expect(parseModelRows(null)).toEqual([]);
		expect(parseModelRows({ data: "nope" })).toEqual([]);
		expect(parseModelRows({ data: [null, 3, {}, { id: "" }] })).toEqual([]);
	});

	it("keeps the first row for a duplicated id", () => {
		const rows = parseModelRows({ data: [row(), row({ display_name: "second" })] });
		expect(rows).toHaveLength(1);
		expect(rows[0]?.name).toBe("Claude Sonnet 4");
	});

	it("falls back through the context field aliases", () => {
		const [a] = parseModelRows({ data: [row({ context_window: undefined, max_input_tokens: 32000 })] });
		expect(a?.contextWindow).toBe(32000);
		const [b] = parseModelRows({ data: [row({ context_window: undefined, context_length: 8192 })] });
		expect(b?.contextWindow).toBe(8192);
	});

	it("reads image input from modalities", () => {
		const [only] = parseModelRows({ data: [row({ modalities: { input: ["text", "image"], output: ["text"] } })] });
		expect(only?.images).toBe(true);
	});

	it("treats either reasoning shape as reasoning", () => {
		const [flat] = parseModelRows({ data: [row({ reasoning_levels: ["low", "high"] })] });
		expect(flat?.reasoning).toBe(true);
		expect(flat?.reasoningLevels).toEqual(["low", "high"]);

		const [structured] = parseModelRows({
			data: [row({ supported_reasoning_levels: [{ effort: "minimal" }, { effort: "high" }] })],
		});
		expect(structured?.reasoningLevels).toEqual(["minimal", "high"]);

		const [flag] = parseModelRows({ data: [row({ reasoning: true })] });
		expect(flag?.reasoning).toBe(true);
	});

	it("sorts by provider then id", () => {
		const rows = parseModelRows({
			data: [row({ id: "z", owned_by: "openai" }), row({ id: "a", owned_by: "openai" }), row({ id: "m", owned_by: "anthropic" })],
		});
		expect(rows.map((entry) => entry.id)).toEqual(["m", "a", "z"]);
	});
});

describe("toModelDefinitions", () => {
	it("only writes fields that carry a value", () => {
		const definitions = toModelDefinitions(parseModelRows({ data: [row({ display_name: undefined })] }));
		expect(definitions).toEqual([
			{
				id: "claude-sonnet-4",
				name: "claude-sonnet-4",
				api: "openai-completions",
				contextWindow: 200000,
				maxTokens: 64000,
			},
		]);
	});

	it("does not send the host a field it no longer accepts", () => {
		// 宿主当前的 PluginModelDefinition 只有 id/name/api/reasoning*/context/maxTokens。
		// 吃不吃图仍写在目录行（`row.images`）上给面板展示，但不能往注册表里塞 `input`。
		const [definition] = toModelDefinitions(parseModelRows({ data: [row({ modalities: { input: ["text", "image"] } })] }));
		expect(definition).not.toHaveProperty("input");
		expect(definition?.id).toBeTruthy();
	});
});

describe("summarizeCatalog", () => {
	it("counts models per provider, images and reasoning", () => {
		const rows = parseModelRows({
			data: [
				row({ id: "a", owned_by: "openai" }),
				row({ id: "b", owned_by: "openai", reasoning: true }),
				row({ id: "c", owned_by: "google", modalities: { input: ["text", "image"] } }),
			],
		});
		expect(summarizeCatalog(rows)).toEqual({
			total: 3,
			providers: [
				{ id: "openai", count: 2 },
				{ id: "google", count: 1 },
			],
			imageCount: 1,
			reasoningCount: 1,
		});
	});
});

describe("filterModels", () => {
	const rows = parseModelRows({
		data: [row({ id: "gpt-4o", owned_by: "openai" }), row({ id: "claude-sonnet-4", owned_by: "anthropic" })],
	});

	it("matches id, name and provider case-insensitively", () => {
		expect(filterModels(rows, "GPT").map((entry) => entry.id)).toEqual(["gpt-4o"]);
		expect(filterModels(rows, "anthropic").map((entry) => entry.id)).toEqual(["claude-sonnet-4"]);
		expect(filterModels(rows, "  ").length).toBe(2);
	});

	it("returns a copy when the query is empty", () => {
		const copy = filterModels(rows, "");
		expect(copy).toEqual(rows);
		expect(copy).not.toBe(rows);
	});
});

describe("formatContextWindow", () => {
	it.each([
		[131072, "131.1K"],
		[200000, "200K"],
		[8192, "8.2K"],
		[1_000_000, "1M"],
		[1_500_000, "1.5M"],
		[512, "512"],
	])("formats %p as %p", (value, expected) => {
		expect(formatContextWindow(value)).toBe(expected);
	});

	it("returns undefined when unknown", () => {
		expect(formatContextWindow(undefined)).toBeUndefined();
		expect(formatContextWindow(0)).toBeUndefined();
	});
});

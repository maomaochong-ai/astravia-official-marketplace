import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { ReviewStore } from "../src/review/store.ts";
import { registerReviewTool } from "../src/review/tool.ts";

/**
 * 工具契约的静态部分：模型看得到的 description 与 parameters schema。
 * 这两块改错不会让 tsc 报错，却会让模型上报的发现落不进面板，所以单独立一组断言。
 */

interface ToolSpec {
	readonly name: string;
	readonly description: string;
	readonly parameters: {
		readonly type: string;
		readonly properties: Record<string, Record<string, unknown>>;
		readonly required?: readonly string[];
	};
}

function collectSpecs(): Record<string, ToolSpec> {
	const specs: ToolSpec[] = [];
	const ctx = {
		agent: { registerTool: (spec: ToolSpec) => specs.push(spec) },
	} as unknown as PluginContext;
	// 注册阶段只写 ctx.agent，store 不会在此时被调用。
	registerReviewTool(ctx, {} as ReviewStore);
	return Object.fromEntries(specs.map((spec) => [spec.name, spec]));
}

describe("code_review_report 的 schema", () => {
	const spec = collectSpecs()["code_review_report"];
	const findings = spec.parameters.properties.findings as {
		readonly type: string;
		readonly items: {
			readonly properties: Record<string, { readonly enum?: readonly string[] }>;
			readonly required?: readonly string[];
		};
	};

	it("findings 是数组，元素必填 file 与 message（其余字段都可省）", () => {
		assert.equal(findings.type, "array");
		assert.deepEqual(findings.items.required, ["file", "message"]);
	});

	it("severity 只接受 ocr 的四级", () => {
		assert.deepEqual(findings.items.properties.severity?.enum, ["critical", "high", "medium", "low"]);
	});

	it("category 覆盖 ocr 的八类", () => {
		assert.deepEqual(findings.items.properties.category?.enum, [
			"bug",
			"security",
			"performance",
			"maintainability",
			"test",
			"style",
			"documentation",
			"other",
		]);
	});

	it("原文/改法可选，但字段名必须是面板认的 existing_code / suggestion_code", () => {
		assert.ok(findings.items.properties.existing_code);
		assert.ok(findings.items.properties.suggestion_code);
		assert.ok(findings.items.properties.end_line);
	});

	it("顶层只要 findings，scope 与 summary 可选", () => {
		assert.deepEqual(spec.parameters.required, ["findings"]);
	});

	it("description 明确告知空数组表示没有发现，并指向「代码审查」面板", () => {
		assert.match(spec.description, /empty findings array when nothing is wrong/);
		assert.match(spec.description, /代码审查/);
	});
});

describe("code_review 的 schema", () => {
	const spec = collectSpecs()["code_review"];
	const engine = spec.parameters.properties.engine as { readonly enum?: readonly string[] } | undefined;

	it("engine 默认委托模式，另一个选项是 ocr", () => {
		assert.deepEqual(engine?.enum, ["delegate", "ocr"]);
		assert.match(spec.description, /Default \(delegation, no API key\)/);
	});

	it("支持工作区、分支区间与单提交三种范围", () => {
		assert.ok(spec.parameters.properties.from);
		assert.ok(spec.parameters.properties.to);
		assert.ok(spec.parameters.properties.commit);
	});
});

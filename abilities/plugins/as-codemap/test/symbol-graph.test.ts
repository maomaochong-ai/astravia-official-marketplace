import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildCodeGraph,
	extractReferences,
	extractSymbols,
	isReservedWord,
	searchSymbols,
} from "../src/parser/symbol-graph.ts";

/** as-codemap 解析层（零依赖词法提取）的回归测试。 */

const TS_SAMPLE = `
export function buildSummary(messages: string[]): string {
	return messages.join("\\n");
}

export default async function compact(): Promise<void> {
	// 注释行不应被计入
	const s = buildSummary(["a"]);
	void s;
}

export class CompactionService {
	private threshold = 10;
	public estimate(tokens: number): number {
		return tokens - this.threshold;
	}
}

export interface Settings {
	reserve: number;
}

export const DEFAULT_SETTINGS: Settings = { reserve: 36000 };
`;

describe("extractSymbols", () => {
	it("识别 function/class/method/interface/const 五种声明", () => {
		const symbols = extractSymbols("a.ts", TS_SAMPLE);
		const names = symbols.map((s) => `${s.kind}:${s.name}`).sort();
		for (const expected of [
			"function:buildSummary",
			"function:compact",
			"class:CompactionService",
			"method:estimate",
			"interface:Settings",
			"const:DEFAULT_SETTINGS",
		]) {
			assert.ok(names.includes(expected), `${expected} 缺失：${names.join(", ")}`);
		}
	});

	it("行号 = 声明所在行（1-based）", () => {
		const symbols = extractSymbols("a.ts", TS_SAMPLE);
		const build = symbols.find((s) => s.name === "buildSummary");
		assert.equal(build?.line, 2);
	});

	it("注释行不计为声明", () => {
		const symbols = extractSymbols("c.ts", "// function fake() {}\nconst real = 1;");
		assert.deepEqual(
			symbols.map((s) => s.name),
			["real"],
		);
	});
});

describe("extractReferences", () => {
	it("声明行自身不计引用；注释行不计；词法计数", () => {
		const symbols = extractSymbols("b.ts", "function helper() {}\nhelper(); helper();");
		const refs = extractReferences("b.ts", "function helper() {}\nhelper(); helper();", symbols);
		const helper = refs.find((r) => r.toSymbol === "helper");
		assert.equal(helper?.count, 2);
	});

	it("空符号集返回空", () => {
		assert.equal(extractReferences("b.ts", "x();", []).length, 0);
	});
});

describe("buildCodeGraph", () => {
	it("跨文件：引用聚合 + 符号全量（含同名多处声明）", () => {
		const files = new Map<string, string>([
			["lib.ts", "export function util() { return 1; }"],
			["a.ts", "import { util } from './lib';\nutil(); util();"],
			["b.ts", "util();"],
			["skip.md", "util() 不应被解析"],
		]);
		const graph = buildCodeGraph(files);
		const utilSymbols = graph.symbols.filter((s) => s.name === "util");
		assert.equal(utilSymbols.length, 1);
		const aRefs = graph.references.filter((r) => r.fromFile === "a.ts" && r.toSymbol === "util");
		assert.equal(aRefs[0]?.count, 3);
		const bRefs = graph.references.filter((r) => r.fromFile === "b.ts");
		assert.equal(bRefs[0]?.count, 1);
		assert.equal(
			graph.references.some((r) => r.fromFile === "skip.md"),
			false,
		);
	});
});

describe("searchSymbols（agent 查询面）", () => {
	const files = new Map<string, string>([
		["a.ts", "export function buildSummary() {}\nexport class BuildWorker {}"],
	]);
	const graph = buildCodeGraph(files);

	it("子串匹配 + kind 过滤 + 排序稳定", () => {
		assert.equal(searchSymbols(graph, "build").length, 2);
		assert.deepEqual(
			searchSymbols(graph, "build", "function").map((s) => s.name),
			["buildSummary"],
		);
		assert.equal(searchSymbols(graph, "").length, 0);
		assert.equal(searchSymbols(graph, "nope").length, 0);
	});
});

describe("isReservedWord（引用去噪）", () => {
	it("关键字与常用字面量识别", () => {
		assert.equal(isReservedWord("function"), true);
		assert.equal(isReservedWord("buildSummary"), false);
	});
});

import { describe, expect, it } from "vitest";
import {
	buildCodeGraph,
	extractReferences,
	extractSymbols,
	isReservedWord,
	searchSymbols,
} from "../src/parser/symbol-graph";

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
		expect(names).toContain("function:buildSummary");
		expect(names).toContain("function:compact");
		expect(names).toContain("class:CompactionService");
		expect(names).toContain("method:estimate");
		expect(names).toContain("interface:Settings");
		expect(names).toContain("const:DEFAULT_SETTINGS");
	});

	it("行号 = 声明所在行（1-based）", () => {
		const symbols = extractSymbols("a.ts", TS_SAMPLE);
		const build = symbols.find((s) => s.name === "buildSummary");
		expect(build?.line).toBe(2);
	});

	it("注释行不计为声明", () => {
		const symbols = extractSymbols("c.ts", "// function fake() {}\nconst real = 1;");
		expect(symbols.map((s) => s.name)).toEqual(["real"]);
	});
});

describe("extractReferences", () => {
	it("声明行自身不计引用；注释行不计；词法计数", () => {
		const symbols = extractSymbols("b.ts", "function helper() {}\nhelper(); helper();");
		const refs = extractReferences("b.ts", "function helper() {}\nhelper(); helper();", symbols);
		const helper = refs.find((r) => r.toSymbol === "helper");
		expect(helper?.count).toBe(2);
	});

	it("空符号集返回空", () => {
		expect(extractReferences("b.ts", "x();", [])).toHaveLength(0);
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
		expect(utilSymbols).toHaveLength(1);
		const aRefs = graph.references.filter((r) => r.fromFile === "a.ts" && r.toSymbol === "util");
		expect(aRefs[0]?.count).toBe(3);
		const bRefs = graph.references.filter((r) => r.fromFile === "b.ts");
		expect(bRefs[0]?.count).toBe(1);
		expect(graph.references.some((r) => r.fromFile === "skip.md")).toBe(false);
	});
});

describe("searchSymbols（agent 查询面）", () => {
	const files = new Map<string, string>([
		["a.ts", "export function buildSummary() {}\nexport class BuildWorker {}"],
	]);
	const graph = buildCodeGraph(files);

	it("子串匹配 + kind 过滤 + 排序稳定", () => {
		expect(searchSymbols(graph, "build").length).toBe(2);
		expect(searchSymbols(graph, "build", "function").map((s) => s.name)).toEqual(["buildSummary"]);
		expect(searchSymbols(graph, "")).toHaveLength(0);
		expect(searchSymbols(graph, "nope")).toHaveLength(0);
	});
});

describe("isReservedWord（引用去噪）", () => {
	it("关键字与常用字面量识别", () => {
		expect(isReservedWord("function")).toBe(true);
		expect(isReservedWord("buildSummary")).toBe(false);
	});
});

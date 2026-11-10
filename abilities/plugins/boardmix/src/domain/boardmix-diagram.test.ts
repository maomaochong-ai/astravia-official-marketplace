import { describe, expect, it } from "vitest";
import { countElements, fileNameFor, kindOf, planDiagram, stripFence } from "./boardmix-diagram";

describe("stripFence", () => {
	it("keeps a fenced body and drops the fence", () => {
		expect(stripFence("```mermaid\nflowchart TD\n  A-->B\n```")).toBe("flowchart TD\n  A-->B");
	});

	it("returns bare text untouched", () => {
		expect(stripFence("flowchart TD\nA-->B")).toBe("flowchart TD\nA-->B");
	});

	it("survives an unterminated fence", () => {
		expect(stripFence("```\ngraph LR\nA-->B")).toBe("graph LR\nA-->B");
	});
});

describe("kindOf", () => {
	it("reads the first significant line", () => {
		expect(kindOf("%% title: 流程\nflowchart TD\nA-->B")).toBe("flowchart");
		expect(kindOf("sequenceDiagram\nA->>B: hi")).toBe("sequenceDiagram");
	});

	it("is null for prose", () => {
		expect(kindOf("这是一段说明")).toBeNull();
		expect(kindOf("")).toBeNull();
	});
});

describe("countElements", () => {
	it("counts nodes and edges", () => {
		// A 与 B 两个节点，一条连线
		expect(countElements("flowchart TD\nA[开始]-->B{结束}")).toBe(3);
	});

	it("counts a sequential chain once per hop", () => {
		expect(countElements("flowchart LR\nA-->B-->C")).toBe(5);
	});

	it("ignores class members", () => {
		const diagram = "classDiagram\nclass Animal {\n  +String name\n  +eat()\n}\nAnimal <|-- Duck";
		expect(countElements(diagram)).toBe(3);
	});

	it("is 0 for a bare declaration", () => {
		expect(countElements("flowchart TD")).toBe(0);
	});
});

describe("fileNameFor", () => {
	it("prefers the caller's title", () => {
		expect(fileNameFor("flowchart TD\nA-->B", "季度复盘")).toBe("季度复盘.mmd");
	});

	it("falls back to a mermaid title comment", () => {
		expect(fileNameFor("%% title: Release Flow\nflowchart TD\nA-->B")).toBe("release-flow.mmd");
	});

	it("never returns an empty name", () => {
		expect(fileNameFor("flowchart TD")).toBe("board.mmd");
	});
});

describe("planDiagram", () => {
	it("accepts a real diagram and reports its shape", () => {
		const plan = planDiagram({ text: "flowchart TD\nA-->B" });
		expect(plan.accepted).toBe(true);
		expect(plan.kind).toBe("flowchart");
		expect(plan.elements).toBe(3);
		expect(plan.reason).toBeNull();
	});

	it("refuses empty input", () => {
		expect(planDiagram({}).reason).toBe("text-required");
		expect(planDiagram({ text: "   " }).accepted).toBe(false);
	});

	it("refuses prose with a reason the model can act on", () => {
		const plan = planDiagram({ text: "把流程画一下" });
		expect(plan.accepted).toBe(false);
		expect(plan.reason).toMatch(/not-mermaid/);
	});

	it("refuses a declaration with no shapes", () => {
		const plan = planDiagram({ text: "flowchart TD" });
		expect(plan.accepted).toBe(false);
		expect(plan.reason).toMatch(/no-shapes/);
	});

	it("still accepts an over-budget diagram, and says so", () => {
		const wide = ["flowchart LR", ...Array.from({ length: 40 }, (_, i) => `N${i}-->N${i + 1}`)].join("\n");
		const plan = planDiagram({ text: wide, limit: 50 });
		expect(plan.accepted).toBe(true);
		expect(plan.reason).toMatch(/over-budget/);
		expect(plan.elements).toBeGreaterThan(50);
	});
});

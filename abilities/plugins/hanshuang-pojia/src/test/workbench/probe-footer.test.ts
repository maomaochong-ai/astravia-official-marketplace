import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 「拒答梯度表格不见了」。
 *
 * 两次成因，两个都要钉住：
 *   · 第一次：整块表格被包在「有记录或有实时对照」的三元里，没跑过或只在对话里跑过时它不存在；
 *   · 第二次：有实时对照时行却从 `advice`（落盘记录）取，于是显示「没有可判定的行」。
 *
 * 现在的判据是**结构**：表格无条件渲染、行来自统一的 `tableRows`、讨论按钮在表格之后。
 */
const read = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

describe("the gradient table is always on screen", () => {
	const card = read("src/features/workbench/components/prompts/probe-refusal-card.tsx");

	it("does not gate the table behind a record", () => {
		expect(card).not.toContain("record === null && liveRows.length === 0 ?");
		expect(card).toContain('data-testid="probe-table"');
	});

	it("builds rows from records, live rows, or the ladder itself", () => {
		expect(card).toContain("const tableRows: TableRow[] =");
		// 三条来源：advice / liveRows / rungs —— 少一条就有一种场景看不到表。
		expect(card).toContain("? advice.map(item => {");
		expect(card).toContain(": liveRows.length > 0");
		expect(card).toContain(": rungs.map(rung => ({");
	});

	it("renders the discuss button after the table and before the card closes", () => {
		const discuss = card.indexOf('t("probe.discuss")');
		const table = card.indexOf('data-testid="probe-table"');
		expect(table).toBeGreaterThan(-1);
		expect(discuss).toBeGreaterThan(table);
		const between = card.slice(discuss, card.indexOf("</Card>"));
		expect(between).not.toContain("record === null");
	});

	it("explains that an empty table is still worth discussing", () => {
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		expect(zh["probe.discussHint"]).toBeTruthy();
		expect(zh["probe.discussHint"]).toMatch(/空着|空表|也能/);
	});

	it("says a rung was not run instead of leaving the cell blank", () => {
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		expect(zh["probe.verdict.pending"]).toBeTruthy();
		expect(card).toContain('t("probe.verdict.pending")');
	});
});

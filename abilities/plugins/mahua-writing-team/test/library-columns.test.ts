import { describe, expect, it } from "vitest";
import {
	COLUMN_BOUNDS,
	COLUMN_TEMPLATES,
	LIBRARY_CELLS,
	tierCells,
	tierTemplate,
} from "../src/features/workbench/components/pages/library-columns.js";

/**
 * 书库列档：宽度落进哪一档、那一档还剩哪几格。
 *
 * 纯函数，不需要 DOM——`useWidthTier` 只负责把宽度换成下标，换算规则全在这里。
 * 面板被拖到 260 与拉到「窗口减 384」差着一整条侧栏，档位必须跟着实测宽度走。
 */

describe("library column tiers", () => {
	it("drops columns in order as the panel narrows, never the book or the stage", () => {
		expect(tierCells(0).map((cell) => cell.key)).toEqual([
			"library.column.book",
			"library.column.genreLength",
			"library.column.stage",
			"library.column.chapters",
			"library.column.words",
			"library.column.updated",
		]);
		expect(tierCells(1).map((cell) => cell.key)).toEqual([
			"library.column.book",
			"library.column.stage",
			"library.column.chapters",
			"library.column.updated",
		]);
		expect(tierCells(2).map((cell) => cell.key)).toEqual([
			"library.column.book",
			"library.column.stage",
			"library.column.updated",
		]);
		expect(tierCells(3).map((cell) => cell.key)).toEqual([
			"library.column.book",
			"library.column.stage",
		]);
		// 最窄一档只留书名：再窄下去 `minmax(0,1fr)` 就没有宽度可分，封面会把文字挤没。
		expect(tierCells(4).map((cell) => cell.key)).toEqual(["library.column.book"]);
	});

	it("keeps the track count equal to the cells in every tier", () => {
		for (let tier = 0; tier < COLUMN_TEMPLATES.length; tier += 1) {
			const tracks = tierTemplate(tier)
				.split(/\s+/)
				.filter(Boolean).length;
			expect({ tier, tracks }).toEqual({ tier, tracks: tierCells(tier).length });
		}
	});

	it("gives every tier of the book column the flexible track", () => {
		// 书名那列不是固定 px：极端窄宽度下它先缩到 0，也不会把右列推出可视区。
		for (let tier = 0; tier < COLUMN_TEMPLATES.length; tier += 1) {
			expect(tierTemplate(tier).startsWith("minmax(0,1fr)")).toBe(true);
		}
	});

	it("falls back to the narrowest tier for an out-of-range index", () => {
		const widest = tierTemplate(COLUMN_TEMPLATES.length - 1);
		expect(tierTemplate(9)).toBe(widest);
		expect(tierCells(9)).toEqual(tierCells(COLUMN_TEMPLATES.length - 1));
	});

	it("declares one more tier than there are boundaries, widest first", () => {
		expect(COLUMN_TEMPLATES.length).toBe(COLUMN_BOUNDS.length + 1);
		expect([...COLUMN_BOUNDS].sort((left, right) => right - left)).toEqual([...COLUMN_BOUNDS]);
		// 每格都得有个取宽度：0 表示任何宽度都留着。
		expect(LIBRARY_CELLS.every((cell) => Number.isFinite(cell.minWidth) && cell.minWidth >= 0)).toBe(true);
	});
});

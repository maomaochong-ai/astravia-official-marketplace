import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * 「表格下方那个发送按钮不见了」。
 *
 * 它原先在「有记录」分支里：刚打开、还没跑过任何一次时整条按钮不存在 —— 用户看不到，
 * 也就以为功能被删了。判据是**位置**：那块必须在条件分支之外，紧挨 `</Card>` 之前。
 */
const read = (path: string): string => readFileSync(resolve(process.cwd(), path), "utf8");

describe("the discuss button is always present", () => {
	const card = read("src/features/workbench/components/prompts/probe-refusal-card.tsx");

	it("renders outside the record/live conditional", () => {
		const conditional = card.indexOf("record === null && liveRows.length === 0 ?");
		const discuss = card.indexOf('t("probe.discuss")');
		expect(conditional).toBeGreaterThan(-1);
		expect(discuss).toBeGreaterThan(-1);
		// 按钮在空态判断之后：空态分支是三元的前半段，按钮必须落在整个三元之后。
		expect(discuss).toBeGreaterThan(conditional);
		// 而且紧挨 Card 收尾 —— 那段不到下一个条件里去了。
		const between = card.slice(discuss, card.indexOf("</Card>"));
		expect(between).not.toContain("record === null");
	});

	it("explains that an empty table is still worth discussing", () => {
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		expect(zh["probe.discussHint"]).toBeTruthy();
		expect(zh["probe.discussHint"]).toMatch(/空着|空表|也能/);
	});
});

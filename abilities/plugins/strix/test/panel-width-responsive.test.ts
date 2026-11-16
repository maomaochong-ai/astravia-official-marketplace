import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "src", "style.css"), "utf8");

const ruleBody = (selector: string): string => {
	const at = css.lastIndexOf(`\n${selector} {`);
	expect(at, `${selector} 不存在`).toBeGreaterThan(-1);
	return css.slice(at, css.indexOf("}", at));
};

describe("面板宽度变化时版面跟着面板走，而不是跟着窗口走", () => {
	it("工作台是容器查询的锚点", () => {
		expect(ruleBody(".astra-strix-workbench")).toContain("container-type: inline-size");
		expect(css).toContain("@container sx-workbench");
	});

	it("窄容器下右栏让位，网格只有一轨", () => {
		const narrow = css.slice(css.indexOf("@container sx-workbench (max-width: 720px)"));
		expect(narrow).toContain("grid-template-columns: minmax(0, 1fr)");
		expect(narrow).toContain(".astra-strix-rail");
		expect(narrow).toContain("display: none");
	});

	it("网格两轨都可收缩，否则子项按内容撑开挤扁邻居", () => {
		expect(ruleBody(".astra-strix-workbench-grid")).toContain("minmax(0, 1fr)");
		expect(ruleBody(".astra-strix-workbench-grid")).toContain("minmax(0, 19rem)");
	});

	it("流式段落允许断长记号，且不在 flex 里按内容撑宽", () => {
		const say = css.slice(css.lastIndexOf('.astra-strix-say,'));
		expect(say).toContain("white-space: pre-wrap");
		expect(say).toContain("overflow-wrap: anywhere");
		expect(say).toContain("min-width: 0");
	});

	it("工具参数与输出不靠 nowrap 撑着", () => {
		const tools = css.slice(css.lastIndexOf(".astra-strix-tool,"));
		expect(tools).toContain("white-space: pre-wrap");
		expect(tools).toContain("max-width: 100%");
	});
});

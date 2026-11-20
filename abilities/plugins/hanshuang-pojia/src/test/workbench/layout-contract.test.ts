import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * 跨操作系统 / 大小屏的排版契约。
 *
 * 上一版在被问到「笔记本/台式机上样式乱」时只能靠肉眼比对；这一组把四条可机检的规则钉住，
 * 任何一条被改回去都会红：
 *
 *   1. 有跨系统字体栈与 text-size-adjust —— 否则 Linux 上 CJK 回退到等宽字体，整卡溢出；
 *   2. 固定行高改成 min-height —— 字体变高时不会把文字裁掉；
 *   3. 内容型文字允许换行（.fb-wrap），只有时间戳/计数保留单行；
 *   4. 活动页日志是两行结构，摘要不再被 truncate 成半句。
 */
const root = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

describe("layout contract across OS and screen sizes", () => {
	it("declares a cross-platform font stack and blocks automatic text inflation", () => {
		const css = read("src/style.css");
		expect(css).toContain("-webkit-text-size-adjust: 100%");
		expect(css).toContain("text-size-adjust: 100%");
		for (const family of ["system-ui", "-apple-system", "Segoe UI", "Noto Sans SC", "Microsoft YaHei"]) {
			expect(css, family).toContain(family);
		}
	});

	it("uses min-height instead of a fixed height on bars that hold text", () => {
		const top = read("src/features/workbench/components/shell/top-bar.tsx");
		const status = read("src/features/workbench/components/shell/inject-status-bar.tsx");
		expect(top).toContain("min-h-11");
		expect(status).toContain("min-h-7");
	});

	it("lets content text wrap instead of clipping it", () => {
		const css = read("src/style.css");
		expect(css).toMatch(/\.fb-wrap\s*\{[^}]*overflow-wrap:\s*anywhere/);
		// 表单式两列：窄容器下降成单列，标签在上、值在下
		expect(css).toMatch(/\.fb-field\s*\{[^}]*grid-template-columns/);
		expect(css).toContain("@container (max-width: 460px)");
		// 有页面已经用上表单式，不是只写了类名没人用
		expect(read("src/features/workbench/components/pages/selfcheck.tsx")).toContain("fb-field");
		expect(read("src/features/workbench/components/pages/reports.tsx")).toContain("fb-field");
	});

	it("keeps the activity log two-line so the summary is never cut", () => {
		const page = read("src/features/workbench/components/pages/activity.tsx");
		expect(page).toContain("fb-log-head");
		expect(page).toContain("fb-log-body");
		// 摘要行不允许再出现单行截断
		const bodyLine = page.split("\n").find(line => line.includes("fb-log-body"));
		expect(bodyLine ?? "").not.toContain("truncate");
	});

	// 笔记本矮屏上「底部的卡片看不见」不是滚动没开，是卡片被压扁了：
	// .fb-main 是滚动容器，而 .fb-page 及其子项默认 flex-shrink: 1，
	// 内容高于面板时它们先缩再滚，于是卡片高度被吃到正文以外，滚到底也只是空白。
	// 契约：只有 .fb-fill / .fb-fill-scroll 允许伸缩，其余子项保持自然高度，由 .fb-main 滚。
	it("never squeezes page cards to fit the panel — the main column scrolls instead", () => {
		const css = read("src/style.css");
		expect(css).toMatch(/\.fb-page\s*>\s*:not\(\.fb-fill\):not\(\.fb-fill-scroll\)\s*\{[^}]*flex:\s*0 0 auto/);
		expect(css).toMatch(/\.fb-main\s*\{[^}]*overflow-y:\s*auto/);
	});

	// 活动页的日志行曾经是三列 grid（`62px 14px 1fr`），对应「时间｜符号｜正文」的单行旧结构。
	// 改成两行（head + body）后没同步 grid，head 被塞进 62px、body 塞进 14px，
	// 于是摘要只剩一列字 —— 用户看到的就是「文字被圆角容器遮住」。
	it("keeps the activity log rows out of the legacy three-column grid", () => {
		const css = read("src/style.css");
		expect(css).not.toMatch(/\.fb-terminal\s+\.fb-log\s*\{[^}]*grid-template-columns/);
		const page = read("src/features/workbench/components/pages/activity.tsx");
		// 两行结构：head 装标量，body 装可换行的内容。
		expect(page).toContain("fb-log-head");
		expect(page).toContain("fb-log-body");
	});
});

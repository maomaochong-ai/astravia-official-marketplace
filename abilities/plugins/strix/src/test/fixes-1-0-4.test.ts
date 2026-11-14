import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 1.0.4 的两件事：
 *  1. 「先在宿主里打开一个工作目录」这个误报**还在**（1.0.3 的兜底不够，因为
 *     `getWorkspaceRoots()` 只在文件浏览器挂载时才返回根）。现在改成先发、后建、最后交给宿主。
 *  2. 首屏输入框以下参差不齐：改成两列 facts，标签列固定宽，值列占满。
 */

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const launch = read("src/features/scan-console/components/launch-screen.tsx");
const css = read("src/style.css");

describe("delivery never blocks on a folder the host already knows", () => {
	const deliver = /const deliver = useCallback\(([\s\S]*?)\n\t\);/.exec(hook)?.[1] ?? "";

	it("tries the host conversation first, before creating anything", () => {
		const send = deliver.indexOf("await sendPrompt(value)");
		const create = deliver.indexOf("await createSession(cwd)");
		expect(send).toBeGreaterThan(-1);
		expect(create).toBeGreaterThan(send);
	});

	it("hands the prompt to the host composer when no folder can be found", () => {
		// 最后一道退路：不报"先打开目录"，而是把话放进宿主输入框。
		expect(deliver).toContain("insertText(value)");
		expect(deliver).toContain('note(t("log.handedToHost"), "ok")');
	});

	it("still reports a real failure, and only after every route", () => {
		// noWorkspace 不再是第一条反应；真正的失败仍然是 sendFailed。
		expect(deliver).toContain('note(t("log.sendFailed"), "error")');
		const noWorkspace = deliver.indexOf("log.noWorkspace");
		expect(noWorkspace).toBe(-1);
	});

	it("has a message that tells the operator what to do next", () => {
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		expect(zh["log.handedToHost"]).toContain("Enter");
	});
});

describe("the rows under the composer line up", () => {
	it("renders one facts block with label/value pairs", () => {
		expect(launch).toContain("astra-strix-rows");
		const rows = launch.match(/className="astra-strix-row"/g) ?? [];
		// 模型 / 环境 / 日志 / 快捷键 / 桥接状态
		expect(rows.length).toBeGreaterThanOrEqual(4);
		expect(launch).toContain("astra-strix-row-label");
	});

	it("uses a two-column grid, not per-row padding", () => {
		const block = /\.astra-strix-row\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(block).toContain("display: grid");
		expect(block).toMatch(/grid-template-columns:\s*[\d.]+em\s+minmax\(0,\s*1fr\)/);
	});

	it("keeps the environment controls inside the value column", () => {
		expect(launch).toContain("astra-strix-env-line");
		expect(launch).toContain("astra-strix-env-actions");
		// 动作在值列里换行，不跨出左边缘
		expect(css).toMatch(/\.astra-strix-env-actions\s*\{[^}]*margin-top:\s*5px/s);
	});

	it("gives the select and buttons one height, so the line reads as one row", () => {
		expect(css).toMatch(/\.astra-strix-env-select\s*\{[^}]*height:\s*22px/s);
		expect(css).toMatch(/\.astra-strix-env-action\s*\{[^}]*height:\s*22px/s);
	});
});

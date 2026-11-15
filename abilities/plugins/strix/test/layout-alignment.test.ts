import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 布局的对齐条件（1.2.1）。
 *
 * 真机截图里的三处不规则，各自对应一条可测的规则：
 *
 *  1. **底条没有 flex**：上一轮清理注释时把 `.astra-strix-composer-bar{display:flex}` 前一行留成了
 *     重复的裸注释行，那条规则被当成非法 token 吞掉——于是「键位 / 工作台 / 发送」挤在左边。
 *     教训是：注释残渣会吃掉紧跟其后的规则，所以这里连"裸中文行"一起扫。
 *  2. **右边缘不齐**：配置页把事实行与对话框收到 72ch，标题却是整列宽，右边差 130px。
 *  3. **行高参差**：带 select 的行 22px、纯文字行 18px，一行行读下来不齐。
 *
 * 断言读的是 `src/style.css` 的规则（先剥注释，避免测到注释里的旧写法）。
 */

const plugin = resolve(process.cwd());
const raw = readFileSync(join(plugin, "src/style.css"), "utf8");
const rules = raw.replace(/\/\*[\s\S]*?\*\//g, "");
const rule = (selector: string): string => {
	const index = rules.indexOf(`${selector} {`);
	if (index < 0) return "";
	const end = rules.indexOf("}", index);
	return rules.slice(index + selector.length + 2, end);
};

describe("the composer bar is a row, not a pile", () => {
	it("is a flex row with a gap", () => {
		const bar = rule(".astra-strix-composer-bar");
		expect(bar).toContain("display: flex");
		expect(bar).toContain("align-items: center");
		expect(bar).toContain("gap:");
	});

	it("pushes the buttons to the right with an auto margin on the hint", () => {
		expect(rule(".astra-strix-composer-bar > .astra-strix-dim")).toContain("margin-right: auto");
	});

	it("has no stray top-level line that could swallow the next rule", () => {
		// 注释残渣（没有 `/*` 开头的中文行）出现在顶层时，CSS 解析器会把下一条规则当成它的延续。
		let inComment = false;
		const suspects: string[] = [];
		raw.split(/\r?\n/).forEach((line, index) => {
			const trimmed = line.trim();
			if (!inComment && trimmed.startsWith("/*")) {
				if (!trimmed.includes("*/")) inComment = true;
				return;
			}
			if (inComment) {
				if (trimmed.includes("*/")) inComment = false;
				return;
			}
			if (!trimmed) return;
			if (/[{};:,()]/.test(trimmed)) return;
			if (/^[.#*:a-zA-Z[-]/.test(trimmed)) return;
			suspects.push(`${index + 1}: ${trimmed.slice(0, 32)}`);
		});
		expect(suspects).toEqual([]);
	});
});

describe("the launch blocks share one column", () => {
	it("does not narrow the facts or the composer below the column", () => {
		// 只允许 tagline 收 72ch；rows / composer 跟着列宽走，右边缘才是一条线。
		const capped = [...rules.matchAll(/([^{}]+)\{([^}]*max-width:\s*72ch[^}]*)\}/g)].map((match) => match[1].trim());
		const offenders = capped.filter((selector) => selector.includes("astra-strix-rows") || selector.includes("astra-strix-composer-panel"));
		expect(offenders).toEqual([]);
		expect(rules).toContain(".astra-strix-launch .astra-strix-tagline {");
	});

	it("gives every fact row the same minimum height", () => {
		const row = rule(".astra-strix-row");
		expect(row).toContain("min-height:");
		expect(row).toContain("align-items: center");
	});
});

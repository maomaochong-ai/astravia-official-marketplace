import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const pluginRoot = join(__dirname, "..");
const css = readFileSync(join(pluginRoot, "src", "style.css"), "utf8");
const components = join(pluginRoot, "src", "features", "gateway-view", "components");
const read = (name: string): string => readFileSync(join(components, name), "utf8");

const block = (selector: string): string => {
	const at = css.indexOf(`${selector} {`);
	expect(at, `${selector} 不存在`).toBeGreaterThan(-1);
	return css.slice(at, css.indexOf("}", at));
};

describe("深浅两套主题共用一套对比关系", () => {
	it("发丝线由前景与卡面混出，不叠 token 透明度", () => {
		expect(block(".mp-root")).toContain("--mp-rule: color-mix(in srgb, var(--foreground)");
		// 浅色主题的 border 是 rgb(230,230,230) 压在 rgb(250,250,250) 上，
		// 再乘 70% 就等于看不见；组件里不许再出现这种写法。
		for (const file of ["gateway-view.tsx", "gateway-status-card.tsx", "gateway-setup-card.tsx", "gateway-connection-form.tsx", "gateway-model-list.tsx", "ui.tsx"]) {
			expect(read(file), file).not.toMatch(/border-border\/\d0/);
		}
	});

	it("状态色在深色模式换一档，不在组件里写死 emerald/amber", () => {
		expect(css).toContain('html[data-mode="dark"] .mp-root');
		expect(block('.mp-root .mp-dot[data-tone="ok"]')).toContain("var(--mp-ok)");
		for (const file of ["gateway-view.tsx", "gateway-status-card.tsx", "gateway-setup-card.tsx"]) {
			expect(read(file), file).not.toMatch(/emerald-|amber-/);
		}
	});

	it("正文/次要/提示三档文字各有一条 token，不靠透明度凑", () => {
		const root = block(".mp-root");
		expect(root).toContain("--mp-text:");
		expect(root).toContain("--mp-dim:");
		expect(root).toContain("--mp-faint:");
	});
});

describe("字体与字阶只有一个出处", () => {
	it("界面字体跟随宿主，标识符用等宽", () => {
		expect(block(".mp-root")).toContain("font-family: var(--font-sans)");
		expect(css).toContain("--mp-font-mono:");
		expect(block(".mp-root .mp-mono")).toContain("font-family: var(--mp-font-mono)");
		expect(block(".mp-root .mp-mono")).toContain("tabular-nums");
	});

	it("字阶收敛成五档，组件里不再散落 text-[10.5px]/text-[11px]", () => {
		for (const size of ["10.5px", "11px", "12px", "12.5px", "13px"]) {
			expect(css, size).toContain(`font-size: ${size}`);
		}
		for (const file of ["gateway-view.tsx", "gateway-status-card.tsx", "gateway-setup-card.tsx", "gateway-model-list.tsx", "ui.tsx"]) {
			expect(read(file), file).not.toMatch(/text-\[1[0-3](\.5)?px\]/);
		}
	});
});

describe("滚动条与窄面板", () => {
	it("滚动条细、透明轨道、拇指由前景淡化而来", () => {
		expect(css).toContain("scrollbar-width: thin");
		expect(css).toContain("scrollbar-color: var(--mp-thumb) transparent");
		expect(css).toContain("::-webkit-scrollbar-thumb");
		expect(block(".mp-root")).toContain("--mp-thumb:");
	});

	it("统计条在窄节里折成「标签 —— 值」，不再四等分截断", () => {
		const at = css.indexOf("@container (max-width: 30rem)");
		expect(at).toBeGreaterThan(-1);
		const narrow = css.slice(at);
		expect(narrow).toContain("grid-auto-flow: row");
		// 特异性必须压过基础规则，否则 grid-auto-flow 仍是 column，值被挤成 0。
		expect(narrow).toContain(".mp-root .mp-strip {");
	});

	it("聚焦看得见", () => {
		expect(css).toContain(":focus-visible");
		expect(css).toContain("outline: 2px solid var(--ring)");
	});
});

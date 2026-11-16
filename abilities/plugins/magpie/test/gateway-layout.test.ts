import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "..", "src", "features", "gateway-view", "components");
const read = (name: string): string => readFileSync(join(dir, name), "utf8");
const locale = (name: string): Record<string, string> =>
	JSON.parse(readFileSync(join(__dirname, "..", "locales", name), "utf8")) as Record<string, string>;

describe("整页只有一个圆角容器", () => {
	it("视图本身不再自己画圆角外框，唯一的框来自 Panel", () => {
		const view = read("gateway-view.tsx");
		expect(view).not.toContain("rounded-xl");
		expect(view).toContain("<Panel");
	});

	it("每一段都用 PanelSection，且不再用 Card", () => {
		for (const file of ["gateway-status-card.tsx", "gateway-connection-form.tsx", "gateway-model-list.tsx", "gateway-setup-card.tsx"]) {
			const text = read(file);
			expect(text, file).toContain("PanelSection");
			expect(text, file).not.toMatch(/\bCard\b/);
		}
		expect(read("ui.tsx")).not.toContain("export function Card");
	});

	it("「重新检测」只出现一次（头部），状态段不再重复同一个按钮", () => {
		const status = read("gateway-status-card.tsx");
		expect(status).not.toContain('t("actions.refresh")');
		expect(read("gateway-view.tsx")).toContain('t("actions.refresh")');
	});
});

describe("变量占位符不会漏成字面 {x}", () => {
	it("两份语言文件里没有单括号占位符", () => {
		for (const name of ["zh.json", "en.json"]) {
			for (const [key, value] of Object.entries(locale(name))) {
				// 单个 {name} 宿主不会替换（它只认 {{name}}），会原样显示给用户。
				expect(value, `${name} ${key}`).not.toMatch(/(^|[^{])\{[a-zA-Z][a-zA-Z0-9]*\}/);
			}
		}
	});

	it("视图实际传参的那几条用双括号", () => {
		const zh = locale("zh.json");
		expect(zh["view.subtitleOnline"]).toContain("{{count}}");
		expect(zh["view.subtitleOnline"]).toContain("{{provider}}");
		expect(zh["models.showing"]).toContain("{{shown}}");
		expect(zh["models.truncated"]).toContain("{{total}}");
		expect(zh["runtime.progress.downloadedOnly"]).toContain("{{size}}");
	});
});

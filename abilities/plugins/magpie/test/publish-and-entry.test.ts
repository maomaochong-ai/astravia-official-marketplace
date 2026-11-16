import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const components = join(__dirname, "..", "src", "features", "gateway-view", "components");
const read = (name: string): string => readFileSync(join(components, name), "utf8");
const source = (path: string): string => readFileSync(join(__dirname, "..", "src", path), "utf8");

describe("「打开 magpie」只留一个入口", () => {
	it("整个面板里只有状态行那一个按钮", () => {
		const files = ["gateway-status-card.tsx", "gateway-model-list.tsx", "gateway-setup-card.tsx", "gateway-connection-form.tsx", "gateway-view.tsx"];
		const hits = files.flatMap((file) => {
			const text = read(file);
			return [...text.matchAll(/actions\.openConsole/g)].map(() => file);
		});
		expect(hits).toEqual(["gateway-status-card.tsx"]);
	});

	it("空目录只用文字指路，不再放第二个按钮", () => {
		const list = read("gateway-model-list.tsx");
		expect(list).not.toContain("onOpenConsole");
		expect(list).not.toContain("mp-btn");
		expect(list).toContain("models.emptyHint");
	});
});

describe("空目录与解析失败分开说", () => {
	it("网关一条都没回 vs 回了却认不出，用两条文案", () => {
		const list = read("gateway-model-list.tsx");
		expect(list).toContain("models.unparsed");
		expect(list).toContain("catalogRawCount");
	});
});

describe("发布失败要把宿主原文交出来", () => {
	it("控制器保留 detail 并落盘", () => {
		const controller = source("controller.ts");
		expect(controller).toContain("last-publish-error.json");
		expect(controller).toContain("detail");
	});

	it("界面把 detail 原样渲染成一段可读文本", () => {
		const status = read("gateway-status-card.tsx");
		expect(status).toContain("state.detail");
	});
});

describe("完整字段被拒时退到最小字段", () => {
	it("模型定义有 minimal 档，只留 id / name / api", () => {
		const catalog = source("model-catalog.ts");
		expect(catalog).toContain("export function toModelDefinitions(rows: readonly MagpieModelRow[], minimal = false)");
	});

	it("发布失败后会用最小字段再试一次，并说明原因", () => {
		const controller = source("controller.ts");
		expect(controller).toContain("providerConfig(displayName, true)");
		expect(controller).toContain("status.publishedMinimal");
	});
});

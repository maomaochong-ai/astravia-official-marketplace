import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hostedAssetUrl } from "../../features/workbench/services/package-asset";

/**
 * 这组用例守住一次真实故障：构建把 `src/content/docs/**` 平铺到 `assets/docs/**`，
 * 而读取端曾把源码前缀同时当成产物前缀，于是装进宿主后请求
 * `assets/src/content/docs/index.json` —— 404，面板「文档」页与自检页永远停在加载中。
 */
describe("hosted asset urls", () => {
	const entry = "astravia-plugin://hanshuang-pojia/assets/index-B0EUPHux.js";

	it("points docs at assets/docs/, not assets/src/content/docs/", () => {
		const url = hostedAssetUrl(entry, "docs", "kb/README.md");
		expect(url).toBe("astravia-plugin://hanshuang-pojia/assets/docs/kb/README.md");
		expect(url).not.toContain("/src/");
	});

	it("points packs at assets/packs/", () => {
		expect(hostedAssetUrl(entry, "packs", "execution-kernel.md")).toBe(
			"astravia-plugin://hanshuang-pojia/assets/packs/execution-kernel.md",
		);
	});

	it("keeps the entry's host and protocol so the host loader still resolves it", () => {
		const url = new URL(hostedAssetUrl(entry, "docs", "index.json"));
		expect(url.protocol).toBe("astravia-plugin:");
		expect(url.host).toBe("hanshuang-pojia");
	});

	it("every caller passes both prefixes, so source and build layout stay separate", () => {
		const root = join(__dirname, "..", "..", "..");
		const docs = readFileSync(join(root, "src/features/workbench/services/docs.ts"), "utf8");
		const packs = readFileSync(join(root, "src/features/workbench/services/packs.ts"), "utf8");
		expect(docs).toContain('assetDir: "docs"');
		expect(packs).toContain('assetDir: "packs"');
	});
});

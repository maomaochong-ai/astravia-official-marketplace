import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { MAGPIE_NAV_ICON } from "../src/brand-icon";

const pluginRoot = join(__dirname, "..");
const indexSource = readFileSync(join(pluginRoot, "src", "index.tsx"), "utf8");

describe("侧边栏工作区图标用插件自己的品牌字形", () => {
	it("注册时不再拿一枚近似的 Iconify 图标占位", () => {
		expect(indexSource).not.toContain("icon-[solar--");
		expect(indexSource).toContain("icon: MAGPIE_NAV_ICON");
	});

	it("字形是内联图片（宿主会按图片处理并用 currentColor 遮罩）", () => {
		expect(MAGPIE_NAV_ICON.startsWith("data:image/png;base64,")).toBe(true);
	});

	it("字形透明底，不是「浅色底板 + 鸟」那张原图", () => {
		const base64 = MAGPIE_NAV_ICON.slice("data:image/png;base64,".length);
		const png = Buffer.from(base64, "base64");
		// PNG 签名 + IHDR（宽高 + 位深 + 颜色类型 6 = RGBA）
		expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
		expect(png.readUInt32BE(16)).toBe(64);
		expect(png.readUInt32BE(20)).toBe(64);
		expect(png[24]).toBe(8);
		expect(png[25]).toBe(6);
		// 体积：抠图后必须远小于原图（原图 6619 字节，且带一块不透明底板）
		expect(png.length).toBeLessThan(2000);
	});

	it("原图仍然给市场与设置页用（侧边栏只是不直接用它）", () => {
		const manifest = JSON.parse(readFileSync(join(pluginRoot, "plugin.json"), "utf8")) as { icon?: string };
		expect(manifest.icon).toBe("assets/icon.png");
	});
});

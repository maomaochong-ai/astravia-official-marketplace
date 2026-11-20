import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 字号标尺。
 *
 * 面板曾经同时用了 14 档字号：9 / 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 /
 * 13.5 / 14 / 15 / 18 / 19。差 0.5px 肉眼分不出，但「这里该用哪一档」就没有答案了，
 * 新增页面只能继续随手挑。
 *
 * 现在只有七档，每一档有明确职责：
 *
 *   9.5   微型标注（偏移、计数、单行时间；等宽）
 *   10.5  元信息（默认正文里最密的一档）
 *   11.5  正文
 *   12    强调正文 / 小节标题
 *   13    卡片标题
 *   14    页面标题
 *   18    统计数字
 *
 * 这条门禁不让新档位混进来：出现第八个值就是回退。
 */
const SCALE = ["9.5", "10.5", "11.5", "12", "13", "14", "18"];

const root = join(__dirname, "..", "..", "..");
const uiDir = join(root, "src/features/workbench/components");

function walk(dir: string, out: string[] = []): string[] {
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = join(dir, entry.name);
		if (entry.isDirectory()) walk(full, out);
		else if (full.endsWith(".tsx")) out.push(full);
	}
	return out;
}

describe("type scale", () => {
	it("uses only the seven documented sizes", () => {
		const found = new Map<string, string[]>();
		for (const file of walk(uiDir)) {
			const source = readFileSync(file, "utf8");
			for (const match of source.matchAll(/text-\[([\d.]+)px\]/g)) {
				const size = match[1];
				if (SCALE.includes(size)) continue;
				const label = file.replace(`${root}/`, "").replace(/\\/g, "/");
				found.set(size, [...(found.get(size) ?? []), label]);
			}
		}

		// 报出来的是「哪个文件用了哪档非标字号」，不是一句「失败」。
		expect([...found.entries()].map(([size, files]) => `${size}px ×${files.length} (${files[0]})`)).toEqual([]);
	});
});

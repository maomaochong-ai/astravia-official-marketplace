import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { CORE_TOOL_IDS, LAB_ONLY_TOOL_IDS } from "../../tools/gate";

/**
 * 工具表的上下文预算。
 *
 * 插件让宿主变卡，最大的一项不是渲染，而是**每轮请求都要带的工具 schema**：
 * 35 个工具的 description + parameters 合计曾达 63.5K 字符（≈15.9K token）。
 * 这类成本没有任何界面能看见，所以只能靠一条预算把它钉住。
 *
 * 数字来源：`scripts` 里逐文件量过（见 ADR 0019）。这里只钉总量与单工具上限，
 * 不钉具体措辞 —— 改文案是允许的，把预算吃光不行。
 */

const root = join(__dirname, "..", "..", "..");
const toolsDir = join(root, "src/tools");

function modules(): { id: string; chars: number }[] {
	const out: { id: string; chars: number }[] = [];
	const walk = (dir: string) => {
		for (const entry of readdirSync(dir, { withFileTypes: true })) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) walk(full);
			else if (entry.name.endsWith(".ts")) {
				const source = readFileSync(full, "utf8");
				if (!source.includes("registerTool<")) continue;
				const id = (source.match(/id:\s*"([a-z_0-9]+)"/) ?? [])[1] ?? "?";
				const desc = source.match(/description:\s*\[([\s\S]*?)\]\.join\("\\n"\)/)?.[1] ?? "";
				const params = source.match(/parameters:\s*\{([\s\S]*?)\n\t\t\},/)?.[1] ?? "";
				out.push({ id, chars: desc.length + params.length });
			}
		}
	};
	walk(toolsDir);
	return out;
}

describe("tool schema budget", () => {
	const all = modules();

	it("keeps a single tool under 3.6 KB of schema text", () => {
		// 单工具 3.6KB ≈ 900 token。超过这个量的描述一定塞了可移进说明书的内容。
		// 改前最大的 init_task 是 3473（描述里重述了一遍目录语义）。
		const heavy = all.filter(item => item.chars > 3600).map(item => `${item.id} ${item.chars}`);
		expect(heavy).toEqual([]);
	});

	it("keeps the whole table inside the per-turn budget", () => {
		const total = all.reduce((sum, item) => sum + item.chars, 0);
		// 改前 63521，本轮压到 61191。上限放在 62000：这条测试的目的是**挡住增长**，
		// 不是逼一次全面重写 —— 体量主要在 parameters，压缩它们等于砍参数说明。
		expect(total).toBeLessThan(62_000);
	});

	it("keeps the lab-off surface small, since that is what most conversations pay", () => {
		// lab 关闭时只挂 CORE；这部分是「日常问答」的真实成本。
		const core = all.filter(item => CORE_TOOL_IDS.includes(item.id));
		const coreTotal = core.reduce((sum, item) => sum + item.chars, 0);
		expect(core.length).toBe(CORE_TOOL_IDS.length);
		// 实测 17791（13 个核心工具）。这就是「日常问答」每轮的真实成本，
		// 约 4.4K token；再往下压只能砍参数说明。
		expect(coreTotal).toBeLessThan(18_000);
	});

	it("accounts for every registered tool exactly once", () => {
		const ids = all.map(item => item.id).sort();
		const declared = [...CORE_TOOL_IDS, ...LAB_ONLY_TOOL_IDS].sort();
		expect(ids).toEqual(declared);
	});
});

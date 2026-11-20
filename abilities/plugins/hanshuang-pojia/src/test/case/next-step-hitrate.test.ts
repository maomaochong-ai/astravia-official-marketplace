import { describe, expect, it } from "vitest";
import { planNextSteps } from "../../domain/case/next-step";

/**
 * `plan_next_step` 的**命中率**基准。
 *
 * 上一轮只测了「计划的形式是否合格」（有没有否证、有没有退路）。这一组测的是
 * 「给定事实，它给出的第一步对不对」——用一张人工标注的表当基准：
 *
 *   输入 = 样本格式 + 命中的规则 id（就是 triage 报告里那两栏）
 *   期望 = 人在这两个事实下会先做的那个动作
 *
 * 判分口径固定：**命中 = 期望的那一步出现在计划里，且在它该在的位置**
 * （强信号应排在最前；兜底等于没命中）。阈值 0.9 不是拍出来的：表里每一条都是
 * 规则集与步骤一一对应的确定性映射，只要映射没被改坏就该是 1.0；留 0.1 的余量
 * 是为了容忍「多条规则同时命中时顺序之争」，而不是给漏判留空间。
 */

interface Case {
	readonly name: string;
	readonly format: string;
	readonly rules: readonly string[];
	/** 期望首步的 id。`fallback` 表示「这里就该兜底」。 */
	readonly expect: string;
}

const CASES: readonly Case[] = [
	{ name: "APK 动态加载（壳）", format: "apk", rules: ["apk.dynamic-loading"], expect: "unpack-first" },
	{ name: "ELF 打包", format: "elf", rules: ["native.packed"], expect: "unpack-first" },
	{ name: "APK 高熵资源", format: "apk", rules: ["archive.high-entropy-payload"], expect: "unpack-first" },
	{ name: "原生库动态加载", format: "apk", rules: ["apk.native-loading"], expect: "unpack-first" },
	{ name: "只有 v1 签名", format: "apk", rules: ["apk.signature-v1-only"], expect: "signature-baseline" },
	{ name: "没有签名", format: "apk", rules: ["apk.no-signature"], expect: "signature-baseline" },
	{ name: "PE 未签名", format: "pe", rules: ["native.authenticode"], expect: "signature-baseline" },
	{ name: "导出组件", format: "apk", rules: ["apk.exported-component"], expect: "exported-surface" },
	{ name: "导出 provider", format: "apk", rules: ["apk.exported-provider"], expect: "exported-surface" },
	{ name: "RWX 段", format: "elf", rules: ["native.rwx-segment"], expect: "hardening-record" },
	{ name: "可调试", format: "apk", rules: ["apk.debuggable"], expect: "hardening-record" },
	{ name: "无 PIE", format: "elf", rules: ["native.no-pie"], expect: "hardening-record" },
	{ name: "明文流量", format: "apk", rules: ["apk.cleartext-traffic"], expect: "traffic-observe" },
	{ name: "弱算法", format: "pe", rules: ["apk.weak-crypto"], expect: "traffic-observe" },
	{ name: "干净样本（无命中）", format: "macho", rules: [], expect: "fallback" },
	{ name: "只有格式（无命中）", format: "apk", rules: [], expect: "fallback" },
];

/** 兜底步的 id 在领域层叫 `gather-facts`，表里用 `fallback` 表示「这里就该兜底」。 */
function actualFirstStep(input: Case): string {
	const steps = planNextSteps({ format: input.format, ruleIds: [...input.rules] });
	const first = steps[0];
	if (!first) return "(empty)";
	return first.confidence === "fallback" ? "fallback" : first.id;
}

describe("plan_next_step hit rate", () => {
	it("matches the labelled first step on every case", () => {
		const misses: string[] = [];
		for (const item of CASES) {
			const actual = actualFirstStep(item);
			if (actual !== item.expect) misses.push(`${item.name}: expect ${item.expect}, got ${actual}`);
		}
		const hitRate = (CASES.length - misses.length) / CASES.length;
		expect(misses, misses.join("\n")).toEqual([]);
		expect(hitRate).toBeGreaterThanOrEqual(0.9);
	});

	it("keeps the strongest signal first when several rules fire at once", () => {
		// 一个真实 APK 往往同时命中壳、签名、导出组件。壳最先：不确定「磁盘上的代码是不是真代码」
		// 之前，后面所有静态结论都不可靠。
		const steps = planNextSteps({ format: "apk", ruleIds: ["apk.exported-component", "apk.signature-v1-only", "apk.dynamic-loading"] });
		expect(steps[0].id).toBe("unpack-first");
		expect(steps.map(step => step.id)).toContain("signature-baseline");
		expect(steps.map(step => step.id)).toContain("exported-surface");
	});

	it("never emits a step whose action is not a real tool id", () => {
		const tools = new Set([
			"triage_binary",
			"scan_binary_strings",
			"list_code_symbols",
			"disassemble_range",
			"decompile_function",
			"search_dex_symbols",
			"disassemble_dex_method",
			"decompile_android",
			"verify_signature",
			"generate_hook",
			"read_doc",
			"search_cases",
			"init_task",
			"run_case_tool",
			"plan_next_step",
		]);
		for (const item of CASES) {
			for (const step of planNextSteps({ format: item.format, ruleIds: [...item.rules] })) {
				expect(tools.has(step.action.tool), `${item.name} → ${step.action.tool}`).toBe(true);
			}
		}
	});
});

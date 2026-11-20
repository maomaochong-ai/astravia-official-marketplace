import { describe, expect, it } from "vitest";
import { planNextSteps, strongStepCount } from "../../domain/case/next-step";

/**
 * 计划层的契约：三条硬约定 —— 每条都是假设、都带否证条件、命中不了必须给兜底。
 *
 * 这组用例不测「假设对不对」（那要看真样本），只测「假设的写法有没有退化成算命」。
 */
describe("planNextSteps", () => {
	it("puts unpacking first when the code on disk is not the code that runs", () => {
		const steps = planNextSteps({ format: "apk", ruleIds: ["apk.dynamic-loading"] });
		expect(steps[0].id).toBe("unpack-first");
		expect(steps[0].precedent).toBe("apk-dex-unpack");
		expect(steps[0].action.tool).toBe("run_case_tool");
	});

	it("routes the same rule to the ELF precedent when the format is not an APK", () => {
		const steps = planNextSteps({ format: "elf", ruleIds: ["native.packed"] });
		expect(steps[0].precedent).toBe("elf-packed-loader");
	});

	it("warns that a v1-only signature rules out static patching", () => {
		const step = planNextSteps({ format: "apk", ruleIds: ["apk.signature-v1-only"] }).find(item => item.id === "signature-baseline");
		expect(step).toBeTruthy();
		expect(step!.disproof).toContain("v2/v3");
		expect(step!.elseDo).toContain("动态");
	});

	it("tells the reader that exported does not mean unprotected", () => {
		const step = planNextSteps({ format: "apk", ruleIds: ["apk.exported-component"] }).find(item => item.id === "exported-surface");
		expect(step!.disproof).toContain("signature");
	});

	it("falls back to precedent lookup instead of inventing a default path", () => {
		const steps = planNextSteps({ format: "macho", ruleIds: [] });
		expect(steps).toHaveLength(1);
		expect(steps[0].confidence).toBe("fallback");
		expect(steps[0].action.tool).toBe("search_cases");
	});

	it("prepends the case reminder only when the caller says no case exists", () => {
		expect(planNextSteps({ format: "apk", ruleIds: ["apk.debuggable"] })[0].id).not.toBe("open-case");
		const withCaseHint = planNextSteps({ format: "apk", ruleIds: ["apk.debuggable"], caseOpen: false });
		expect(withCaseHint[0].id).toBe("open-case");
		expect(withCaseHint[0].action.tool).toBe("init_task");
	});

	it("every step carries a disproof and a fallback — no exceptions", () => {
		const cases = [
			{ format: "apk", ruleIds: ["apk.dynamic-loading", "apk.signature-v1-only", "apk.exported-component"] },
			{ format: "elf", ruleIds: ["native.rwx-segment"] },
			{ format: "apk", ruleIds: ["apk.cleartext-traffic"] },
			{ format: "pe", ruleIds: [] },
		];
		for (const input of cases) {
			for (const step of planNextSteps(input)) {
				expect(step.disproof.length, step.id).toBeGreaterThan(10);
				expect(step.elseDo.length, step.id).toBeGreaterThan(5);
				expect(step.action.produces.length, step.id).toBeGreaterThan(5);
			}
		}
	});

	it("counts only strong signals, so the panel can decide whether to lead with the plan", () => {
		expect(strongStepCount(planNextSteps({ format: "apk", ruleIds: [] }))).toBe(0);
		expect(strongStepCount(planNextSteps({ format: "apk", ruleIds: ["apk.dynamic-loading"] }))).toBe(1);
	});
});

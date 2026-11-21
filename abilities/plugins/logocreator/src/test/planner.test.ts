// @vitest-environment node
import { describe, expect, it } from "vitest";
import { extractBrandName, planFromBrief } from "../domain/planner";
import { resolveMark } from "../domain/engine/compose";

/**
 * The planner is why this plugin works with **no image model**.
 *
 * The reference design plugin's trick is the same one at a larger scale: the host's
 * text model picks fields, a local engine draws them. Here the picking is offline and
 * deterministic, so a session with no provider connected still produces usable
 * proposals instead of a disabled button.
 */

describe("planning from a brief", () => {
	it("reads the brand name out of a sentence", () => {
		expect(extractBrandName('Logo for "Kettle Lane", a coffee roastery')).toBe("Kettle Lane");
		expect(extractBrandName("a logo for Fern & Field, a garden studio")).toBe("Fern & Field");
		expect(extractBrandName("品牌名叫做青岚茶事，山上的茶馆")).toBe("青岚茶事");
	});

	it("gives three candidates that differ in structure, not just seed", () => {
		const plans = planFromBrief('Logo for "Kettle Lane", a coffee roastery');
		expect(plans).toHaveLength(3);
		expect(new Set(plans.map((plan) => plan.type)).size).toBeGreaterThan(1);
		// Same subject across the three: three structures of one idea.
		expect(new Set(plans.map((plan) => plan.subject)).size).toBe(1);
	});

	it("lets the brief's own nouns win over the sector guess", () => {
		// "leaf" is in the text, so every candidate must be a leaf — not a cup because
		// it also says "tea".
		const plans = planFromBrief("a leaf mark for a mountain teahouse");
		for (const plan of plans) {
			expect(plan.spec.intent.startsWith("leaf"), `intent was ${plan.spec.intent}`).toBe(true);
			expect(resolveMark(plan.spec).subject).toBe("leaf");
		}
	});

	it("maps a sector to a style it reads as", () => {
		expect(planFromBrief("a coffee roastery")[0].style).toBe("hand-drawn");
		expect(planFromBrief("a software platform")[0].style).toBe("geometric");
		expect(planFromBrief("a private wealth law firm")[0].style).toBe("luxury");
	});

	it("uses the surface cue to choose a structure", () => {
		expect(planFromBrief("an app icon for a music studio")[0].type).toBe("icon");
		expect(planFromBrief("a beer label")[0].type).toBe("emblem");
	});

	it("is deterministic: the same brief plans the same specs", () => {
		const a = planFromBrief("a leaf mark for a garden studio", { brandName: "Fern" });
		const b = planFromBrief("a leaf mark for a garden studio", { brandName: "Fern" });
		expect(a.map((plan) => plan.spec.seed)).toEqual(b.map((plan) => plan.spec.seed));
	});

	it("explains every candidate", () => {
		for (const plan of planFromBrief("a coffee roastery")) {
			expect(plan.rationale.length).toBeGreaterThan(20);
		}
	});

	it("survives a brief with nothing recognisable in it", () => {
		const plans = planFromBrief("zzyzx");
		expect(plans).toHaveLength(3);
		for (const plan of plans) expect(plan.spec.brandName).toBe("");
	});
});

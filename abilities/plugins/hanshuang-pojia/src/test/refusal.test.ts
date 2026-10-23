import { describe, expect, it } from "vitest";
import { buildRecoveryFragment, detectRefusal, planRecovery } from "../domain/refusal";

/** 造一条足够长、且不带任何交付物指纹的正文。 */
const prose = (text: string) =>
	`${text} This workspace has been described at length in the request, including the sample name, ` +
	`the platform it runs on, and the outcome the operator expects from this engagement today.`;

describe("detectRefusal", () => {
	it("flags a policy stop that delivered nothing", () => {
		const signal = detectRefusal(prose("I can't help with that."));
		expect(signal?.kind).toBe("policy");
		expect(signal?.evidence.length).toBeGreaterThan(0);
	});

	it("flags identity framing and third-party deflection", () => {
		expect(detectRefusal(prose("As an AI, I am not able to run that."))?.kind).toBe("identity");
		expect(detectRefusal(prose("建议您联系厂商处理"))?.kind).toBe("deflection");
	});

	it("stays quiet when the reply did deliver something", () => {
		const withFence = `${prose("I can't help with that directly, but here is the harness.")}\n\`\`\`bash\nrabin2 -I sample.apk\n\`\`\``;
		expect(detectRefusal(withFence)).toBeNull();

		const withPath = prose("I must decline the framing. The file is at /usr/local/bin/r2 today.");
		expect(detectRefusal(withPath)).toBeNull();

		const withOffset = prose("As an AI I would rather point at 0x00401a20 first.");
		expect(detectRefusal(withOffset)).toBeNull();
	});

	it("ignores short clarifications and ordinary technical prose", () => {
		expect(detectRefusal("无法确认，需要你补一下样本路径。")).toBeNull();
		expect(detectRefusal(prose("The license check sits behind a boolean returned by the verifier."))).toBeNull();
		expect(detectRefusal("")).toBeNull();
	});
});

describe("planRecovery", () => {
	const message = prose("I can't help with that.");

	it("recovers once while lab mode is on", () => {
		const outcome = planRecovery(message, { enabled: true, stopHookActive: false });
		expect(outcome?.fragment).toContain("Resume the technical work");
	});

	it("does nothing when lab mode is off or the host already continued once", () => {
		expect(planRecovery(message, { enabled: false, stopHookActive: false })).toBeUndefined();
		expect(planRecovery(message, { enabled: true, stopHookActive: true })).toBeUndefined();
		expect(planRecovery(null, { enabled: true, stopHookActive: false })).toBeUndefined();
	});
});

describe("buildRecoveryFragment", () => {
	it("keeps a way out for genuinely blocked steps", () => {
		const fragment = buildRecoveryFragment({ kind: "policy", evidence: ["I can't"] });
		expect(fragment).toContain("genuinely blocked");
		expect(fragment).toContain("quote the exact error");
		// 追问交付，而不是要求改口：这是本项目对「防过度防御」的一贯写法。
		expect(fragment.toLowerCase()).not.toContain("you must not refuse");
	});
});

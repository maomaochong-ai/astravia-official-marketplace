import { describe, expect, it } from "vitest";
import {
	COMMANDS,
	COMPANIONS,
	TOOLCHAIN,
	detectPlatform,
	resolvePlatform,
	specFor,
	type Platform,
} from "../domain/toolchain/catalog";
import { inferGoal, planInstallation, renderPlan } from "../domain/toolchain/install";
import type { ToolchainReport, ToolStatus } from "../domain/toolchain/probe";

/** A report where every tool is absent, as before the first install. */
function emptyReport(): ToolchainReport {
	const tools: ToolStatus[] = TOOLCHAIN.map(spec => ({
		id: spec.id,
		binary: spec.binary,
		available: false,
		detail: "spawn ENOENT",
		blocked: false,
		install: spec.install,
	}));
	return { tools, capabilities: {} as ToolchainReport["capabilities"], missing: [] };
}

function reportWith(present: readonly string[], blocked: readonly string[] = []): ToolchainReport {
	const tools: ToolStatus[] = TOOLCHAIN.map(spec => {
		if (blocked.includes(spec.binary)) {
			return { id: spec.id, binary: spec.binary, available: false, detail: "host refused", blocked: true };
		}
		return present.includes(spec.binary)
			? { id: spec.id, binary: spec.binary, available: true, detail: "present", blocked: false }
			: { id: spec.id, binary: spec.binary, available: false, detail: "spawn ENOENT", blocked: false, install: spec.install };
	});
	return { tools, capabilities: {} as ToolchainReport["capabilities"], missing: [] };
}

const PLATFORMS: readonly Platform[] = ["darwin", "linux", "windows"];

describe("goal inference", () => {
	it("maps sample extensions to the goal that needs those tools", () => {
		expect(inferGoal("app-release.apk")).toBe("apk");
		expect(inferGoal("base.aab")).toBe("apk");
		expect(inferGoal("classes.dex")).toBe("apk");
		expect(inferGoal("libfoo.so")).toBe("native");
		expect(inferGoal("libfoo.so.3")).toBe("native");
		expect(inferGoal("kernel.elf")).toBe("native");
		expect(inferGoal("payload.exe")).toBe("native");
		expect(inferGoal("firmware.img")).toBe("firmware");
	});

	it("falls back to full when nothing matches", () => {
		expect(inferGoal("sample.dat")).toBe("full");
		expect(inferGoal("")).toBe("full");
		expect(inferGoal(undefined)).toBe("full");
	});
});

describe("platform detection", () => {
	it("reads the three platforms out of the renderer user agent", () => {
		expect(detectPlatform("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)")).toBe("darwin");
		expect(detectPlatform("Mozilla/5.0 (Windows NT 10.0; Win64; x64)")).toBe("windows");
		expect(detectPlatform("Mozilla/5.0 (X11; Linux x86_64)")).toBe("linux");
		expect(detectPlatform(undefined)).toBe("linux");
	});

	it("normalises explicit values", () => {
		expect(resolvePlatform("darwin")).toBe("darwin");
		expect(resolvePlatform("win32")).toBe("windows");
		expect(resolvePlatform(null)).toBe("linux");
	});
});

describe("planInstallation", () => {
	it("only names tools the goal needs", () => {
		const plan = planInstallation(emptyReport(), { platform: "darwin", goal: "apk" });
		expect(plan.required).toContain("jadx");
		expect(plan.required).toContain("apktool");
		expect(plan.required).toContain("java");
		expect(plan.required).not.toContain("radiff2");
		expect(plan.required).not.toContain("frida");
	});

	it("keeps blocked tools out of the install list", () => {
		const plan = planInstallation(reportWith([], ["jadx"]), { platform: "darwin", goal: "apk" });
		const jadx = plan.steps.find(step => step.binary === "jadx");
		expect(jadx?.reason).toBe("blocked");
		expect(jadx?.command).toBeUndefined();
		expect(plan.notes.join(" ")).toContain("permission problem");
	});

	it("skips tools that already answered", () => {
		const report = reportWith(["r2", "rabin2", "radiff2", "rasm2", "rahash2", "rax2"]);
		const plan = planInstallation(report, { platform: "linux", goal: "native" });
		expect(plan.ready).toEqual(["r2", "rabin2", "radiff2", "rasm2", "rahash2", "rax2"]);
		expect(plan.steps).toHaveLength(0);
		expect(renderPlan(plan)).toContain("Nothing to install");
	});

	it("emits a command for every platform-specific recipe", () => {
		for (const platform of PLATFORMS) {
			const plan = planInstallation(emptyReport(), { platform, goal: "apk" });
			const jadx = plan.steps.find(step => step.binary === "jadx");
			expect(jadx?.command, platform).toBe(specFor("jadx").recipe?.[platform]);
			expect(jadx?.command?.length).toBeGreaterThan(0);
		}
	});

	it("marks administrator commands", () => {
		const plan = planInstallation(emptyReport(), { platform: "linux", goal: "apk" });
		const jadx = plan.steps.find(step => step.binary === "jadx");
		expect(jadx?.elevated).toBe(true);
		const darwin = planInstallation(emptyReport(), { platform: "darwin", goal: "apk" });
		expect(darwin.steps.find(step => step.binary === "jadx")?.elevated).toBe(false);
	});

	it("reports companions without a recipe as user-supplied", () => {
		const plan = planInstallation(emptyReport(), { platform: "linux", goal: "full" });
		const commercial = plan.companions.filter(spec => spec.commercial).map(spec => spec.name);
		expect(commercial).toContain("ida");
		expect(commercial).toContain("binaryninja");
		for (const spec of plan.companions.filter(item => item.commercial)) {
			expect(plan.steps.some(step => step.binary === spec.name)).toBe(false);
		}
	});

	it("still plans when no probe ran at all", () => {
		const plan = planInstallation(null, { platform: "darwin", goal: "native" });
		expect(plan.ready).toHaveLength(0);
		expect(plan.steps.every(step => step.reason === "missing" || step.reason === "no-recipe")).toBe(true);
		expect(renderPlan(plan)).toContain("Commands:");
	});

	it("never invents a tool outside the catalog", () => {
		const plan = planInstallation(emptyReport(), { platform: "darwin", goal: "full" });
		const known = new Set(TOOLCHAIN.map(spec => spec.binary));
		for (const step of plan.steps) expect(known.has(step.binary)).toBe(true);
	});
	});

describe("renderPlan", () => {
	it("numbers the commands so progress can be reported per step", () => {
		const text = renderPlan(planInstallation(emptyReport(), { platform: "linux", goal: "apk" }));
		expect(text).toMatch(/^ {2}1\. /m);
		expect(text).toContain("Commands:");
		expect(text).toContain("probe_environment with refresh=true");
	});

	it("names the goal and platform in the first line", () => {
		const text = renderPlan(planInstallation(emptyReport(), { platform: "darwin", goal: "firmware" }));
		expect(text.split("\n")[0]).toContain("firmware");
		expect(text.split("\n")[0]).toContain("darwin");
	});

	it("says commercial tools are never installed by the plugin", () => {
		const text = renderPlan(planInstallation(emptyReport(), { platform: "linux", goal: "full" }));
		expect(text).toContain("Commercial, user-supplied:");
		expect(text).toContain("never installed by the plugin");
	});

	it("prints one command once even when it unlocks two binaries", () => {
		const text = renderPlan(planInstallation(emptyReport(), { platform: "darwin", goal: "apk" }));
		const sdk = text.split("\n").filter(line => line.includes("android-commandlinetools"));
		expect(sdk).toHaveLength(1);
		expect(sdk[0]).toContain("apksigner");
		expect(sdk[0]).toContain("zipalign");
	});

	it("agrees in number when several binaries ship with another package", () => {
		const two = renderPlan(planInstallation(emptyReport(), { platform: "darwin", goal: "apk" }));
		expect(two).toContain("usually ship with another package");
	});
});

describe("catalog consistency", () => {
	it("keeps every probed binary in plugin.json#commands", () => {
		expect(COMMANDS).toEqual(TOOLCHAIN.map(spec => spec.binary));
	});

	it("never lists a companion as a command", () => {
		const companions = new Set(COMPANIONS.map(spec => spec.name));
		for (const command of COMMANDS) expect(companions.has(command)).toBe(false);
	});

	it("gives every installable tool a recipe on every platform", () => {
		const shipsWithAnother = new Set(["rabin2", "radiff2", "rasm2", "rahash2", "rax2"]);
		for (const spec of TOOLCHAIN) {
			if (shipsWithAnother.has(spec.binary)) {
				expect(spec.recipe, spec.binary).toBeUndefined();
				continue;
			}
			for (const platform of PLATFORMS) {
				expect(spec.recipe?.[platform], `${spec.binary} on ${platform}`).toBeTruthy();
			}
		}
	});

	it("gives every tool a purpose and at least one goal", () => {
		for (const spec of TOOLCHAIN) {
			expect(spec.purpose.length, spec.binary).toBeGreaterThan(0);
			expect(spec.goals.length, spec.binary).toBeGreaterThan(0);
		}
	});
});

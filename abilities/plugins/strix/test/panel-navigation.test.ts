import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const plugin = resolve(process.cwd());

/**
 * 首屏 ↔ 工作台的导航契约（ADR 0014）：「返回首屏」是按钮不是推断，
 * 「新会话」在当前目录建会话，拿不到目录不报错。
 */
describe("navigation and instances (ADR 0014)", () => {
	it("lets the operator go back to the launch screen and stay there", () => {
		const hook = readFileSync(join(plugin, "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
		expect(hook).toContain("launchPinned");
		expect(hook).toContain("const openLaunch");
		// 自动跟屏必须检查是否被钉住（1.0.5：不再要求胶囊启用，pin 是唯一开关）
		expect(hook).toMatch(/if \(!launchPinned\.current\) \{[\s\S]{0,160}setShowLaunch\(false\)/);
	});

	it("creates a new conversation in the current folder instead of guessing one", () => {
		const hook = readFileSync(join(plugin, "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
		expect(hook).toContain("const newSession");
		expect(hook).toContain("await createSession(cwd)");
		// 拿不到目录时不报错（1.0.6）：回首屏，第一句话由宿主建会话。
		expect(hook).toContain('note(t("log.newSessionNoFolder"), "ok")');
	});

	it("renders both navigation buttons on the workbench band", () => {
		const screen = readFileSync(join(plugin, "src/features/scan-console/components/scan-screen.tsx"), "utf8");
		expect(screen).toContain('t("nav.launch")');
		expect(screen).toContain('t("nav.newSession")');
	});
});

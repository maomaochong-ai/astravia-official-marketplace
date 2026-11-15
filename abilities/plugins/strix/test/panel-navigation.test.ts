import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const plugin = resolve(process.cwd());

/**
 * 首屏 ↔ 工作台的导航契约：「返回首屏」是按钮不是推断，
 * 「新会话」在当前目录建会话，拿不到目录不报错。
 */
describe("navigation and instances", () => {
	it("creates a new session in the current project, not in a fixed folder", () => {
		// 用户问的是「点新会话是不是真的在已挂载的项目里建」。实现只有一条路：
		// cwd 取当前会话（其次宿主打开的工作目录），再交给宿主 openSession——
		// 与用户自己在新会话页按发送是同一条。这里钉住取值顺序与调用点。
		const hook = readFileSync(join(plugin, "src/features/scan-console/hooks/use-strix-session.ts"), "utf8");
		const body = /const newSession = useCallback\(async \(\) => \{([\s\S]*?)\n\t\}, \[/.exec(hook)?.[1] ?? "";
		expect(body).toContain("cwdRef.current ?? workspaceRoot?.() ?? null");
		expect(body).toContain("await createSession(cwd)");
		// 拿不到目录时不报错：把面板放回首屏，让用户在那里说第一句（宿主的常规路径）。
		expect(body).toContain("setShowLaunch(true)");
	});

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

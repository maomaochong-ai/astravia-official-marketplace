import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { locateSkills, loadIndex, packagedSkillsRoot } from "../service/skills";
import { dockerInstallCommand, normalizeMode } from "../service/preferences";

/**
 * ADR 0012 / 0013 / 0014 的落点，逐条用可执行的东西钉住。
 */

const plugin = resolve(process.cwd());

describe("skills are vendored, not scanned (ADR 0012)", () => {
	it("resolves to the packaged library without touching python", () => {
		const location = locateSkills();
		expect(location.source).toBe("bundled");
		expect(location.root.replace(/\\/g, "/")).toContain("agent/skills/library");
		// 旧实现会问解释器；现在这个名字不该再出现在源码里。
		const source = readFileSync(join(plugin, "src/service/skills.ts"), "utf8");
		expect(source).not.toContain("pythonCandidates");
		expect(source).not.toContain("import os, strix");
	});

	it("ships the whole upstream library with provenance and licence", () => {
		const root = packagedSkillsRoot();
		expect(existsSync(join(root, "PROVENANCE.md"))).toBe(true);
		expect(existsSync(join(root, "LICENSE"))).toBe(true);
		const categories = readdirSync(root, { withFileTypes: true })
			.filter((entry) => entry.isDirectory())
			.map((entry) => entry.name);
		expect(categories.sort()).toEqual([
			"analysis",
			"cloud",
			"coordination",
			"custom",
			"frameworks",
			"protocols",
			"reconnaissance",
			"scan_modes",
			"technologies",
			"tooling",
			"vulnerabilities",
		]);
	});

	it("indexes at least 75 packs and can load a body by name", async () => {
		const { entries, categories } = await loadIndex(locateSkills());
		expect(entries.length).toBeGreaterThanOrEqual(75);
		expect(categories.length).toBe(11);
		// 出处/许可文件不能被当成技能条目
		expect(entries.some((entry) => entry.name === "PROVENANCE")).toBe(false);
	});
});

describe("environment is a choice (ADR 0013)", () => {
	it("accepts host / docker / auto and rejects anything else", () => {
		expect(normalizeMode("docker")).toBe("docker");
		expect(normalizeMode("HOST")).toBe("host");
		expect(normalizeMode("nonsense")).toBe("host");
		expect(normalizeMode(undefined, "auto")).toBe("auto");
	});

	it("hands the install command to the host instead of running sudo", () => {
		const win = dockerInstallCommand("win32");
		expect(win.command).toBe("powershell");
		expect(win.argv.join(" ")).toContain("Docker.DockerDesktop");
		const mac = dockerInstallCommand("darwin");
		expect(mac.argv.join(" ")).toContain("brew install --cask docker");
		// Linux：需要 root，只回显命令，不代跑
		const linux = dockerInstallCommand("linux");
		expect(linux.argv.join(" ")).toContain("apt-get install");
	});

	it("keeps environment and scan depth as separate parameters", () => {
		// 曾经把环境塞进 `mode`（扫描深度），导致"选了容器却跑在本机"。这条守那个错误。
		const tools = readFileSync(join(plugin, "src/agent/strix-tools.ts"), "utf8");
		expect(tools).toContain("environment: {");
		const sandbox = readFileSync(join(plugin, "src/service/sandbox.ts"), "utf8");
		expect(sandbox).toContain('params.environment === "host"');
		expect(sandbox).toContain("asScanMode(params.mode)");
	});

	it("refuses to silently fall back when docker was requested but is down", () => {
		const environment = readFileSync(join(plugin, "src/service/environment.ts"), "utf8");
		expect(environment).toContain('preference === "docker" && !probe.ready');
		expect(environment).toContain("ready: false");
	});
});

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

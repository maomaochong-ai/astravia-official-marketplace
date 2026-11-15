import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 1.5.2 的三处修复，各自的失败模式写成断言。
 *
 *  1. **装好 docker 却检测不到**：服务是宿主拉起的子进程，PATH 里常常没有 docker
 *     （Windows 在 Program Files、macOS 在 /usr/local/bin 或应用包里）。所以要按平台
 *     常见位置找可执行文件，而不是只信 PATH。
 *  2. **macOS 界面乱套**：渐变描边原来靠 `mask-composite: exclude`，旧 WebKit 不支持——
 *     描边消失、内容被拉到框外。改用 `background-clip` 双层（任何引擎都认）。
 *  3. **背景是日文**：字形表里混了半角片假名；本项目的语汇是英文，改成 0/1 + 英文词。
 */

const plugin = resolve(process.cwd());
const docker = readFileSync(join(plugin, "src/service/docker.ts"), "utf8");
const main = readFileSync(join(plugin, "src/service/main.ts"), "utf8");
const css = readFileSync(join(plugin, "src/style.css"), "utf8");
const rain = readFileSync(join(plugin, "src/features/scan-console/components/hacker-rain.tsx"), "utf8");

describe("docker is found even when the service PATH is thin", () => {
	it("probes the platform's install locations", () => {
		expect(docker).toContain("resolveDockerBinary");
		expect(docker).toContain('"Docker", "Docker", "resources", "bin"');
		expect(docker).toContain('"/Applications/Docker.app/Contents/Resources/bin/docker"');
		expect(docker).toContain('"/usr/local/bin/docker"');
	});

	it("caches the answer but forgets it after an install or a refresh", () => {
		expect(docker).toContain("forgetDockerBinary");
		expect(main).toContain("forgetDockerBinary()");
	});

	it("uses the resolved path everywhere the CLI is spawned", () => {
		expect(docker).not.toMatch(/spawn\("docker"/);
		expect(docker).not.toMatch(/run\("docker",/);
	});
});

describe("the glow does not depend on mask-composite", () => {
	it("draws the gradient border with background-clip instead", () => {
		expect(css).toContain("background-clip: padding-box, border-box");
		// 注释里可以提到它，但规则里不许再有。
		const rules = css.replace(/\/\*[\s\S]*?\*\//g, "");
		expect(rules).not.toContain("mask-composite");
		expect(rules).not.toContain("-webkit-mask:");
	});

	it("gives the pseudo element a transparent border so border-box has an edge", () => {
		const before = /\.astra-strix-prompt::before \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
		expect(before).toContain("border: 1px solid transparent");
	});

	it("keeps the report panel absolute so a transformed ancestor cannot push it off screen", () => {
		const report = /\.astra-strix-report \{([\s\S]*?)\n\}/.exec(css)?.[1] ?? "";
		expect(report).toContain("position: absolute");
		expect(report).not.toContain("position: fixed");
	});
});

describe("the rain speaks the project's language", () => {
	it("has no half-width katakana left", () => {
		const glyphs = /const GLYPHS = "([^"]+)"/.exec(rain)?.[1] ?? "";
		expect(glyphs.length).toBeGreaterThan(20);
		expect(glyphs).not.toMatch(/[\u30a0-\u30ff\u3040-\u309f]/);
	});

	it("is 0/1 plus words a reader of this panel already knows", () => {
		const glyphs = /const GLYPHS = "([^"]+)"/.exec(rain)?.[1] ?? "";
		expect(glyphs.startsWith("01")).toBe(true);
		for (const word of ["STRIX", "RECON", "EXPLOIT", "SANDBOX", "FINDING"]) {
			expect(glyphs, word).toContain(word);
		}
	});
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * 这一轮四个报修的落点（1.0.3）。每条都对应一个真机现象，所以每条都要有代码证据。
 */

const plugin = resolve(process.cwd());
const read = (p: string): string => readFileSync(join(plugin, p), "utf8");
const css = read("src/style.css");
const launch = read("src/features/scan-console/components/launch-screen.tsx");
const hook = read("src/features/scan-console/hooks/use-strix-session.ts");
const index = read("src/index.tsx");
const manifest = JSON.parse(read("plugin.json")) as { permissions: string[] };

describe("the workspace prompt is no longer a false alarm", () => {
	it("asks the host for its open workspace folders", () => {
		// 用户明明打开了目录却被告知"先打开一个工作目录"：会话没有 cwd，而宿主有目录。
		expect(manifest.permissions).toContain("workspace.read");
		expect(index).toContain("getWorkspaceRoots");
	});

	it("falls back to the workspace root before refusing", () => {
		// 两处：发送（deliver）与新建会话（newSession）都必须先兜底。
		const fallbacks = hook.match(/cwdRef\.current \?\? workspaceRoot\?\.\(\) \?\? null/g) ?? [];
		expect(fallbacks.length).toBeGreaterThanOrEqual(2);
		// 只有兜底也拿不到时才报错
		expect(hook).toContain('note(t("log.noWorkspace"), "error")');
	});

	it("keeps the message honest when there really is no folder", () => {
		const zh = JSON.parse(read("locales/zh.json")) as Record<string, string>;
		expect(zh["log.noWorkspace"]).toContain("工作目录");
	});
});

describe("the first screen is one column again", () => {
	it("gives every row under the composer the same left edge", () => {
		expect(css).toContain("一条左边缘（1.0.3）");
		const block = /\.astra-strix-meta,\s*\.astra-strix-env,\s*\.astra-strix-hints,\s*\.astra-strix-boot,[\s\S]*?\{([^}]*)\}/.exec(css)?.[1] ?? "";
		expect(block).toContain("padding-left: 2px");
	});

	it("shows the model once, not twice", () => {
		// 输入框内不再渲染模型，唯一的一行在框下面。
		const occurrences = launch.match(/astra-strix-meta-name/g) ?? [];
		expect(occurrences.length).toBe(1);
	});

	it("hides the drag handle until it is useful", () => {
		// 真机截图里它像一条悬空的绿线。
		expect(css).toMatch(/\.astra-strix-resize-handle::before\s*\{[^}]*opacity:\s*0/s);
		expect(css).toMatch(/\.astra-strix-prompt:hover \.astra-strix-resize-handle::before/s);
	});
});

describe("the environment selector is readable", () => {
	it("gives the control its own background and light text", () => {
		const block = /\.astra-strix-env-select\s*\{([^}]*)\}/s.exec(css)?.[1] ?? "";
		expect(block).toContain("background-color:");
		expect(block).toContain("color: var(--sx-white");
	});

	it("styles the native dropdown list too", () => {
		// 展开后的 option 是系统渲染的：单独设，否则白底深字。
		expect(css).toMatch(/\.astra-strix-env-select option\s*\{[^}]*background-color:\s*#04120a/s);
	});
});

describe("the environment reports what it found", () => {
	it("has three states, not a boolean", () => {
		expect(launch).toContain('"host" | "noDocker" | "noImage" | "ready"');
		expect(launch).toContain('data-state={envState}');
	});

	it("offers install when docker is missing and a pull when the image is not local", () => {
		expect(launch).toContain('t("env.install")');
		expect(launch).toContain('t("env.pull")');
		expect(launch).toContain("onPullImage");
	});

	it("probes again as soon as the operator switches environment", () => {
		const block = /const setEnvironmentMode[\s\S]{0,700}?\[client\],/.exec(hook)?.[0] ?? "";
		expect(block).toContain("probeEnvironment");
	});
});

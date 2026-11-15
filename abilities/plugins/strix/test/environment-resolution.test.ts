import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { dockerInstallCommand, normalizeMode } from "../src/service/preferences";

/**
 * The environment must resolve to something that actually runs.
 *
 * ghcr.io is unreachable on restricted networks, so "pull the sandbox image" is not a
 * thing the panel may block on: a failed pull left the session with nothing to run on
 * and printed `sandbox failed to start`. These assertions pin the resolution rules and
 * the fallback that has to exist behind them.
 */
const environment = readFileSync(resolve(process.cwd(), "src/service/environment.ts"), "utf8");
const sandbox = readFileSync(resolve(process.cwd(), "src/service/sandbox.ts"), "utf8");
const payloads = readFileSync(resolve(process.cwd(), "src/domain/bridge-payloads.ts"), "utf8");

describe("environment resolution", () => {
	it("still prefers the container when the daemon is up but the image is missing", () => {
		// Giving up the container up front would throw away its toolchain; the pull is
		// bounded and has a fallback, so docker stays the first choice.
		expect(environment).toContain("is not pulled yet");
		expect(sandbox).toContain("could not be pulled");
		expect(sandbox).toContain("degraded(");
	});

	it("keeps a single definition of the host path", () => {
		// Two copies drifted once already: the fallback called a helper that did not exist.
		expect(sandbox.match(/beginHost\(/g)?.length).toBeGreaterThan(1);
		expect(sandbox).toContain("private beginHost(");
	});

	it("reports why the container was skipped", () => {
		// The reason travels to the panel as an event; it is not kept as dead state.
		expect(sandbox).toContain("sandbox_degraded");
		expect(sandbox).not.toContain("degradedReason");
	});

	it("passes the mode through so the panel can name the environment", () => {
		expect(payloads).toContain("value.mode === \"docker\" || value.mode === \"host\"");
	});
});

const plugin = resolve(process.cwd());

/**
 * 环境是用户的选择：三个取值、安装命令交给宿主、与扫描深度分开。
 */
describe("environment is a choice the user makes", () => {
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

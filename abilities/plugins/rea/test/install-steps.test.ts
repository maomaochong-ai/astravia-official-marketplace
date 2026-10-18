/**
 * 安装过程的判读：阶段与失败原因。
 *
 * 这两件事都必须只依赖「真实输出里出现过什么」——阶段找不到标记就返回 unknown，
 * 失败原因对不上规则就退回 generic 并把原文带出去。测试用真实的 brew / pipx 输出
 * 片段，避免出现「实现变了但断言还按旧格式写」的自欺。
 */

import { describe, expect, it } from "vitest";
import { deriveInstallStage, explainInstallError } from "../src/features/rea-workflow/live/tool-install";

describe("deriveInstallStage", () => {
	it("还没有输出时是 starting，不是 unknown", () => {
		expect(deriveInstallStage("")).toBe("starting");
		expect(deriveInstallStage("  \n\t\n")).toBe("starting");
	});

	it("brew 的下载标记", () => {
		expect(deriveInstallStage("==> Downloading https://ghcr.io/v2/homebrew/core/jadx/manifests/1.5.0")).toBe(
			"downloading",
		);
		expect(deriveInstallStage("==> Fetching jadx\n==> Fetching dependencies for jadx: openjdk")).toBe("downloading");
	});

	it("brew 的安装标记", () => {
		expect(deriveInstallStage("==> Installing Cask mitmproxy")).toBe("installing");
		expect(deriveInstallStage("==> Pouring apktool--2.9.3.all.bottle.tar.gz")).toBe("installing");
	});

	it("brew 的收尾标记", () => {
		expect(deriveInstallStage("==> Caveats\nmitmproxy is installed")).toBe("finishing");
		expect(deriveInstallStage("==> Running `brew cleanup apktool`...")).toBe("finishing");
	});

	it("pipx 的两段输出", () => {
		expect(deriveInstallStage("creating virtual environment...")).toBe("installing");
		expect(deriveInstallStage("  installed package frida-tools 17.1.0, installed using Python 3.13")).toBe(
			"finishing",
		);
	});

	it("取最后一条命中的标记：后来的阶段覆盖先前的", () => {
		expect(deriveInstallStage("==> Downloading x\n==> Installing y\n==> Caveats")).toBe("finishing");
		expect(deriveInstallStage("==> Downloading x\n==> Installing y")).toBe("installing");
	});

	it("有输出但没有认得的标记时返回 unknown，不按时间编造阶段", () => {
		expect(deriveInstallStage("Warning: something unexpected happened")).toBe("unknown");
	});
});

describe("explainInstallError", () => {
	const cases: readonly (readonly [string, string, string])[] = [
		["宿主闸门：命令被用户关掉", "Command disabled by user: brew", "tab.install.error.disabled"],
		["宿主闸门：命令不在白名单", "Command not declared: pipx", "tab.install.error.notDeclared"],
		["可执行文件不存在", "Failed to start command: brew", "tab.install.error.missingCommand"],
		["需要管理员密码却没有终端", "sudo: a terminal is required to read the password", "tab.install.error.needsPassword"],
		["Homebrew 没有这个包", "Error: No Cask with this name exists.", "tab.install.error.noPackage"],
		["PEP 668 拒绝系统级安装", "error: externally-managed-environment", "tab.install.error.externallyManaged"],
		["网络失败", "fatal: unable to access: Could not resolve host: github.com", "tab.install.error.network"],
		["对不上的错误", "Error: something odd happened", "tab.install.error.generic"],
	];

	it.each(cases)("%s", (_label, raw, key) => {
		expect(explainInstallError(raw).key).toBe(key);
	});

	it("detail 保留宿主原文的最后一行，便于用户自己搜", () => {
		const raw = "==> Downloading x\nError: No Cask with this name exists.\n";
		expect(explainInstallError(raw)).toEqual({
			key: "tab.install.error.noPackage",
			detail: "Error: No Cask with this name exists.",
		});
	});

	it("detail 截到 240 字符，不把整段日志塞进 UI", () => {
		const raw = `Error: ${"x".repeat(400)}`;
		expect(explainInstallError(raw).detail).toHaveLength(240);
	});

	it("空输出也能给出结论，不会抛异常", () => {
		expect(explainInstallError("")).toEqual({ key: "tab.install.error.generic", detail: "" });
	});
});

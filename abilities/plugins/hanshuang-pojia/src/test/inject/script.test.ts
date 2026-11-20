import { describe, expect, it } from "vitest";
import { renderInstaller, renderRestoreScript } from "../../domain/inject/script";
import { planFor, targetById } from "../../domain/inject/targets";

const AT = "2026-11-20T00:00:00.000Z";

function plan(id: string) {
	return planFor(targetById(id)!, { packLabel: "execution-kernel", body: "正文一行\n第二行", statePath: "workbench/install-state.json" });
}

describe("renderInstaller · powershell", () => {
	it("backups, replaces only the block, writes state and reads back", () => {
		const script = renderInstaller(plan("codex"), "powershell", { generatedAt: AT });
		expect(script).toContain("Copy-Item $target");
		expect(script).toContain(".hanshuang-backup-$stamp");
		expect(script).toContain("$begin = '<!-- 寒霜破甲注入开始'");
		// 有块替换、无块追加：两个分支都要在。
		expect(script).toContain("$head");
		expect(script).toContain("$out = @($lines)");
		expect(script).toContain("install-state.json");
		expect(script).toContain("marker block missing after write");
		expect(script).toContain(AT);
	});

	it("writes the whole file for a system-layer target and leaves the config key to the human", () => {
		const script = renderInstaller(plan("opencode"), "powershell", { generatedAt: AT });
		expect(script).toContain("Set-Content -Path $target");
		expect(script).not.toContain("$begin");
		expect(script).toContain("default_agent");
	});
});

describe("renderInstaller · posix", () => {
	it("uses the same three guarantees without GNU-only flags", () => {
		const script = renderInstaller(plan("claude"), "posix", { generatedAt: AT });
		expect(script.startsWith("#!/bin/sh")).toBe(true);
		expect(script).toContain("cp -p");
		expect(script).toContain("awk");
		expect(script).toContain("grep -qF");
		expect(script).toContain("install-state.json");
	});

	it("quotes paths so a space cannot split the argument", () => {
		const script = renderInstaller(plan("codex"), "posix", { generatedAt: AT });
		// TARGET='~/.codex/AGENTS.md' —— 单引号包裹，展开交给 shell。
		expect(script).toContain("TARGET='~/.codex/AGENTS.md'");
	});
});

describe("renderRestoreScript", () => {
	it("restores from the newest backup instead of guessing what was installed", () => {
		const ps = renderRestoreScript(plan("codex"), "powershell");
		expect(ps).toContain("Sort-Object LastWriteTime -Descending");
		expect(ps).toContain("no backup found");
		const sh = renderRestoreScript(plan("codex"), "posix");
		expect(sh).toContain("ls -1t");
		expect(sh).toContain("restored from");
	});
});

import { describe, expect, it } from "vitest";
import { applyCommand, chooseRoute, handoffCommands, readEvidence, scriptPathFor } from "../../domain/inject/apply";
import { planFor, targetById } from "../../domain/inject/targets";

describe("chooseRoute", () => {
	it("prefers running it ourselves when the channel and the shell are both there", () => {
		expect(chooseRoute({ commandChannel: true, shellReady: true })).toBe("command");
	});

	it("falls back to the agent when either is missing — never to a silent no-op", () => {
		expect(chooseRoute({ commandChannel: true, shellReady: false })).toBe("agent");
		expect(chooseRoute({ commandChannel: false, shellReady: true })).toBe("agent");
		expect(chooseRoute({ commandChannel: false, shellReady: false })).toBe("agent");
	});

	it("only picks save when the user asked for it", () => {
		expect(chooseRoute({ commandChannel: true, shellReady: true }, true)).toBe("save");
	});
});

describe("applyCommand", () => {
	it("passes -NoProfile and bypasses the local-script policy for PowerShell", () => {
		const command = applyCommand("powershell", ".hanshuang/inject/codex.ps1");
		expect(command.file).toBe("pwsh");
		expect(command.args).toEqual(["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ".hanshuang/inject/codex.ps1"]);
		expect(command.display).toBe("pwsh -NoProfile -ExecutionPolicy Bypass -File .hanshuang/inject/codex.ps1");
	});

	it("keeps arguments as an array so a path with spaces cannot split", () => {
		const command = applyCommand("powershell", "C:/work/my dir/codex.ps1");
		expect(command.args).toContain("C:/work/my dir/codex.ps1");
		expect(command.args).toHaveLength(5);
	});

	it("runs posix scripts through sh instead of relying on the execute bit", () => {
		expect(applyCommand("posix", ".hanshuang/inject/claude.sh")).toEqual({
			file: "sh",
			args: [".hanshuang/inject/claude.sh"],
			display: "sh .hanshuang/inject/claude.sh",
		});
	});
});

describe("scriptPathFor", () => {
	it("keeps every script inside the project, under one predictable directory", () => {
		expect(scriptPathFor("codex", "powershell")).toBe(".hanshuang/inject/codex.ps1");
		expect(scriptPathFor("opencode", "posix")).toBe(".hanshuang/inject/opencode.sh");
		// 必须在工作区内：宿主的 fs 只放行项目内路径。
		expect(scriptPathFor("codex", "powershell").startsWith("./")).toBe(false);
		expect(scriptPathFor("codex", "powershell")).not.toContain("..");
	});
});

describe("readEvidence", () => {
	it("reads the three lines the installer prints and nothing it did not", () => {
		const stdout = [
			"backup -> ~/.codex/AGENTS.md.hanshuang-backup-20261120-010203",
			"state -> workbench/install-state.json",
			"done: ~/.codex/AGENTS.md",
		].join("\n");
		const evidence = readEvidence(stdout);
		expect(evidence.backup).toBe("~/.codex/AGENTS.md.hanshuang-backup-20261120-010203");
		expect(evidence.state).toContain("install-state.json");
		expect(evidence.markerVerified).toBe(true);
	});

	it("reports no evidence rather than inventing it", () => {
		const evidence = readEvidence("something went sideways");
		expect(evidence.backup).toBeNull();
		expect(evidence.state).toBeNull();
		expect(evidence.markerVerified).toBe(false);
	});
});

describe("handoffCommands", () => {
	it("hands over the same script, not a second implementation", () => {
		const plan = planFor(targetById("codex")!, { packLabel: "execution-kernel", body: "正文" });
		const lines = handoffCommands(plan, applyCommand("powershell", scriptPathFor("codex", "powershell")), scriptPathFor("codex", "powershell"));
		const text = lines.join("\n");
		expect(text).toContain("pwsh -NoProfile -ExecutionPolicy Bypass -File .hanshuang/inject/codex.ps1");
		// 回读确认要逐条点到计划里的写入点。
		for (const write of plan.writes) expect(text).toContain(write.path);
	});
});

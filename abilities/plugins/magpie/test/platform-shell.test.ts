import { describe, expect, it } from "vitest";
import {
	encodePowerShell,
	psQuote,
	SHELL_CANDIDATES,
	shellMissing,
	windowsArchScript,
	windowsInstallScript,
	windowsProbeScript,
	windowsStartScript,
	binDisplayPath,
} from "../src/platform-shell";
import { assetKeyFor, pickReleaseAsset } from "../src/gateway-runtime";

/**
 * Windows 执行面：0.1.3 只会 `sh -c`，在 Windows 上第一步就 ENOENT，面板把那条错误
 * 读成「平台没有官方构建」——而清单里有 `magpie-cli-windows-amd64.exe`。
 *
 * 这里钉住三件事：脚本存在且带关键步骤、清单里的 Windows 资产能被选中、两条 shell 的
 * 候选顺序与「命令不存在」的识别。
 */

const FEED = {
	version: "0.1.4131",
	assets: {
		"magpie-cli-windows-amd64.exe": {
			url: "https://usemagpie.ai/files/v0.1.4131/magpie-cli-windows-amd64.exe",
			size: 89839616,
			sha256: "027b7330dae426d785bcd8ee5349f216130db48db61ff76f4098b35f745db85c",
		},
	},
};

describe("shell ladder", () => {
	it("tries sh first, then powershell", () => {
		expect(SHELL_CANDIDATES.map((candidate) => candidate.command)).toEqual(["sh", "powershell"]);
	});

	it("passes the Windows script as one encoded argument, not as text", () => {
		const runner = SHELL_CANDIDATES[1];
		const argv = runner?.args("Write-Output 'hi'") ?? [];
		expect(argv).toContain("-EncodedCommand");
		const encoded = argv[argv.indexOf("-EncodedCommand") + 1];
		expect(encoded).toBe(encodePowerShell("Write-Output 'hi'"));
		// 必须是 UTF-16LE：ASCII 字符每个前面一个 0x00 字节。
		expect(encoded).toBe(btoa("W\0r\0i\0t\0e\0-\0O\0u\0t\0p\0u\0t\0 \0'\0h\0i\0'\0"));
	});

	it("recognises a missing command, both languages", () => {
		expect(shellMissing(new Error("Command failed to start: sh (ENOENT)"))).toBe(true);
		expect(shellMissing(new Error("'sh' is not recognized as an internal or external command"))).toBe(true);
		expect(shellMissing(new Error("spawn powershell ENOENT"))).toBe(true);
		expect(shellMissing(new Error("Command not declared: sh"))).toBe(false);
	});

	it("quotes PowerShell strings by doubling apostrophes", () => {
		expect(psQuote("a'b")).toBe("'a''b'");
	});
});

describe("windows scripts", () => {
	it("picks the Windows CLI asset from the real feed shape", () => {
		const asset = pickReleaseAsset(FEED, { os: "windows", arch: "amd64" });
		expect(asset?.key).toBe("magpie-cli-windows-amd64.exe");
		expect(asset?.size).toBe(89839616);
	});

	it("probes the per-user install dir and falls back to PATH", () => {
		const script = windowsProbeScript();
		expect(script).toContain("LOCALAPPDATA");
		expect(script).toContain("magpie.exe");
		expect(script).toContain("Get-Command");
		expect(script).toContain("path=$bin");
		expect(script).toContain("version=$version");
	});

	it("installs with the same line protocol the parser already reads", () => {
		const asset = pickReleaseAsset(FEED, { os: "windows", arch: "amd64" });
		if (!asset) throw new Error("asset missing");
		const script = windowsInstallScript(asset);
		// 协议：进度、校验、落地，三行都要在，且与 POSIX 那份同名同形。
		expect(script).toContain('"progress $n $want"');
		expect(script).toContain("Write-Output 'verifying'");
		expect(script).toContain("Get-FileHash");
		expect(script).toContain("Move-Item");
		expect(script).toContain(asset.url);
		expect(script).toContain(asset.sha256);
		// 已有就退出，所以「安装并启动」可以反复点。
		expect(script).toContain("already installed");
		// 不落系统目录、不要管理员。
		expect(script).not.toContain("Program Files");
		expect(script).not.toContain("Start-Process -Verb RunAs");
	});

	it("starts serve in the foreground so the host owns the process", () => {
		const script = windowsStartScript("C:\\Users\\me\\AppData\\Local\\magpie\\bin\\magpie.exe");
		expect(script).toContain("& $bin serve");
		expect(script).not.toContain("Start-Process");
	});

	it("reads architecture without uname", () => {
		expect(windowsArchScript()).toContain("PROCESSOR_ARCHITECTURE");
	});

	it("shows the Windows install path in the panel", () => {
		expect(binDisplayPath("windows")).toContain("magpie.exe");
		expect(binDisplayPath("windows")).toContain("LOCALAPPDATA");
		expect(binDisplayPath("posix")).toContain(".local/bin");
	});

	it("maps the release feed key for both windows arches", () => {
		expect(assetKeyFor({ os: "windows", arch: "amd64" })).toBe("magpie-cli-windows-amd64.exe");
		expect(assetKeyFor({ os: "windows", arch: "arm64" })).toBe("magpie-cli-windows-arm64.exe");
		// POSIX 仍然没有后缀。
		expect(assetKeyFor({ os: "darwin", arch: "arm64" })).toBe("magpie-cli-darwin-arm64");
	});
});

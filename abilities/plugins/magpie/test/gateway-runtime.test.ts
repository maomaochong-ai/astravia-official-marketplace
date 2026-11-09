import { describe, expect, it } from "vitest";
import {
	assetKeyFor,
	classifyCommandError,
	installScript,
	lastLine,
	parseHostTarget,
	parseInstallProgress,
	parseProbe,
	pickReleaseAsset,
	probeScript,
	shellQuote,
	startScript,
	type ReleaseAsset,
} from "../src/gateway-runtime";

const SHA = "eaddd4073f03d0d976bb24d393a1d96a5c8346b6d68d01c3688eb8bccdb94334";

const FEED = {
	version: "0.1.3336",
	url: "https://github.com/yetone/magpie-releases/releases/tag/v0.1.3336",
	assets: {
		"magpie-cli-darwin-arm64": {
			url: "https://github.com/yetone/magpie-releases/releases/download/v0.1.3336/magpie-cli-darwin-arm64",
			size: 69149314,
			sha256: SHA,
		},
		"magpie-cli-linux-amd64": {
			url: "https://github.com/yetone/magpie-releases/releases/download/v0.1.3336/magpie-cli-linux-amd64",
			size: 70000000,
			sha256: SHA,
		},
		"magpie-cli-windows-amd64.exe": {
			url: "https://github.com/yetone/magpie-releases/releases/download/v0.1.3336/magpie-cli-windows-amd64.exe",
			size: 71000000,
			sha256: SHA,
		},
	},
};

describe("parseHostTarget", () => {
	it("reads the two uname lines on macOS", () => {
		expect(parseHostTarget("Darwin\narm64\n")).toEqual({ os: "darwin", arch: "arm64" });
	});

	it("normalizes x86_64 and aarch64", () => {
		expect(parseHostTarget("Linux\nx86_64")).toEqual({ os: "linux", arch: "amd64" });
		expect(parseHostTarget("Linux\naarch64")).toEqual({ os: "linux", arch: "arm64" });
	});

	it("refuses a platform it cannot name", () => {
		expect(parseHostTarget("FreeBSD\nriscv64")).toBeNull();
		expect(parseHostTarget("")).toBeNull();
	});
});

describe("pickReleaseAsset", () => {
	it("picks the terminal build for the host", () => {
		expect(pickReleaseAsset(FEED, { os: "darwin", arch: "arm64" })).toEqual({
			key: "magpie-cli-darwin-arm64",
			version: "0.1.3336",
			url: "https://github.com/yetone/magpie-releases/releases/download/v0.1.3336/magpie-cli-darwin-arm64",
			sha256: SHA,
			size: 69149314,
		});
	});

	it("keeps the .exe suffix on Windows", () => {
		expect(assetKeyFor({ os: "windows", arch: "amd64" })).toBe("magpie-cli-windows-amd64.exe");
		expect(pickReleaseAsset(FEED, { os: "windows", arch: "amd64" })?.key).toBe("magpie-cli-windows-amd64.exe");
	});

	it("refuses a download URL that is not the official release host", () => {
		const tampered = structuredClone(FEED);
		tampered.assets["magpie-cli-darwin-arm64"].url = "https://evil.example/magpie";
		expect(pickReleaseAsset(tampered, { os: "darwin", arch: "arm64" })).toBeNull();
	});

	it("accepts the file host the live feed actually hands out", () => {
		// 2026-11-09 实测：/api/latest 给的是 usemagpie.ai/files/…，不是 GitHub 直链
		const live = structuredClone(FEED);
		live.assets["magpie-cli-darwin-arm64"].url = "https://usemagpie.ai/files/v0.1.3395/magpie-cli-darwin-arm64";
		expect(pickReleaseAsset(live, { os: "darwin", arch: "arm64" })?.url).toBe(
			"https://usemagpie.ai/files/v0.1.3395/magpie-cli-darwin-arm64",
		);
	});

	it("still refuses a lookalike host that only starts with the same words", () => {
		const tampered = structuredClone(FEED);
		tampered.assets["magpie-cli-darwin-arm64"].url = "https://usemagpie.ai.evil.example/files/x";
		expect(pickReleaseAsset(tampered, { os: "darwin", arch: "arm64" })).toBeNull();
	});

	it("refuses a checksum that is not lowercase hex", () => {
		const tampered = structuredClone(FEED);
		tampered.assets["magpie-cli-darwin-arm64"].sha256 = "EADD";
		expect(pickReleaseAsset(tampered, { os: "darwin", arch: "arm64" })).toBeNull();
	});

	it("returns null for an unknown platform or a malformed feed", () => {
		expect(pickReleaseAsset(FEED, { os: "linux", arch: "arm64" })).toBeNull();
		expect(pickReleaseAsset(null, { os: "darwin", arch: "arm64" })).toBeNull();
		expect(pickReleaseAsset({ version: "1", assets: [] }, { os: "darwin", arch: "arm64" })).toBeNull();
	});
});

describe("install script", () => {
	const asset = pickReleaseAsset(FEED, { os: "darwin", arch: "arm64" }) as ReleaseAsset;

	it("quotes the download and the checksum, and verifies before installing", () => {
		const script = installScript(asset);
		expect(script).toContain(`curl -fsSL --retry 3 --retry-delay 2 --connect-timeout 20 -o "$part" '${asset.url}'`);
		expect(script).toContain(`[ "$got" != '${asset.sha256}' ]`);
		expect(script).toContain('command -v shasum');
		expect(script).toContain('command -v sha256sum');
		// 校验在前，安装在后：两个字符串的位置就是这条规则的证据
		expect(script.indexOf("checksum mismatch")).toBeLessThan(script.indexOf('install -m 755'));
	});

	it("downloads into a cache file and re-downloads rather than resuming", () => {
		const script = installScript(asset);
		expect(script).toContain(`part="$HOME/.cache/magpie/${asset.key}"`);
		// 官方文件主机不处理 Range：曾测到 curl 56，残片在场时 `-C -` 会永久失败
		expect(script).not.toContain("-C -");
		// 但长度已对上就不发请求
		expect(script).toContain(`want="${asset.size}"`);
		expect(script.indexOf('have="$(wc -c')).toBeLessThan(script.indexOf("curl"));
		// 坏包必须删掉，不然下次会把脏数据当成品
		expect(script).toMatch(/checksum mismatch[\s\S]{0,400}rm -f "\$part"/);
	});

	it("installs into the same directory as the official installer", () => {
		const script = installScript(asset);
		expect(script).toContain('bin="$HOME/.local/bin/magpie"');
		expect(script).toContain('mkdir -p "$HOME/.local/bin"');
	});

	it("does nothing when the binary is already there", () => {
		const script = installScript(asset);
		expect(script.indexOf('if [ -x "$bin" ]')).toBeLessThan(script.indexOf("curl"));
		expect(script).toContain("already installed");
	});

	it("escapes a single quote instead of closing the string", () => {
		expect(shellQuote("it's")).toBe("'it'\\''s'");
	});

	it("starts whatever it installed, in the foreground", () => {
		const script = startScript();
		expect(script).toContain('exec "$bin" serve');
		expect(script).toContain("magpie binary not found");
	});
});

describe("probe script", () => {
	it("looks at the install slot, then PATH, then the usual bin directories", () => {
		const script = probeScript();
		// 已经装了 magpie 的机器，不该为了「点一下」重下 69 MB
		expect(script.indexOf("$HOME/.local/bin/magpie")).toBeLessThan(script.indexOf("command -v magpie"));
		expect(script.indexOf("command -v magpie")).toBeLessThan(script.indexOf("for dir in"));
		for (const dir of ["$HOME/.local/bin", "$HOME/bin", "/usr/local/bin", "/opt/homebrew/bin"]) {
			expect(script).toContain(dir);
		}
		expect(script).toContain("exit 127");
	});

	it("does not hand the binary a terminal", () => {
		// 没有 </dev/null 时，一个不可执行的「下载物」会被当脚本解析并无限等输入
		expect(probeScript()).toContain("</dev/null");
	});
});

describe("install progress", () => {
	it("reports how many bytes have landed, once a second, while curl still runs", () => {
		const asset = pickReleaseAsset(FEED, { os: "darwin", arch: "arm64" }) as ReleaseAsset;
		const script = installScript(asset);
		// curl 的进度条只在终端里画；插件这边只能自己数文件长度，才能给面板一个百分比
		expect(script).toContain('echo "progress $s $want"');
		expect(script).toContain('echo "progress 0 $want"');
		expect(script).toContain('echo "progress $want $want"');
		// 观察者靠标记文件收尾：不用 `kill -0`，以免子进程已死但尚未被回收时空转
		expect(script).toContain('stop="$HOME/.cache/magpie/.watch.$$"');
		expect(script).not.toContain("kill -0");
		expect(script).toContain('wait "$watch"');
		// 下载失败要把残片删掉，并且报出 curl 的退出码
		expect(script).toContain('|| rc=$?');
		expect(script).toContain('exit 5');
		// 校验开始前先告诉面板：字节数已经到齐，接下来是 sha256
		expect(script).toContain('echo "verifying"');
	});
});

describe("parseProbe", () => {
	it("reads the path and the self-reported version", () => {
		expect(parseProbe("path=/tmp/magpie\nmagpie 0.1.3336\n", 0)).toEqual({
			installed: true,
			path: "/tmp/magpie",
			version: "0.1.3336",
		});
	});

	it("treats the 127 exit as not installed", () => {
		expect(parseProbe("", 127)).toEqual({ installed: false });
	});

	it("does not invent a version when the binary says nothing", () => {
		expect(parseProbe("path=/tmp/magpie\n", 0)).toEqual({ installed: true, path: "/tmp/magpie", version: undefined });
	});
});

describe("command failures", () => {
	it("recognizes the host's three refusals as one thing", () => {
		expect(classifyCommandError(new Error("Command not declared: sh"))).toBe("denied");
		expect(classifyCommandError(new Error("Command disabled by user: sh"))).toBe("denied");
		expect(classifyCommandError(new Error("Plugin permission denied: agent.command.run"))).toBe("denied");
		expect(classifyCommandError(new Error("spawn ENOENT"))).toBe("failed");
	});
});

describe("parseInstallProgress", () => {
	it("keeps the last byte count the installer printed", () => {
		expect(parseInstallProgress("progress 0 700\nprogress 10 700\nprogress 350 700")).toEqual({
			downloaded: 350,
			total: 700,
			verifying: false,
			installed: false,
		});
	});

	it("says verifying once the bytes are in, and drops it once the binary is installed", () => {
		expect(parseInstallProgress("progress 700 700\nverifying")).toMatchObject({ verifying: true, installed: false });
		expect(parseInstallProgress("progress 700 700\nverifying\ninstalled /Users/me/.local/bin/magpie")).toMatchObject({
			verifying: false,
			installed: true,
		});
	});

	it("does not invent a total when the line is not a progress line", () => {
		// 已装时脚本只打一行「already installed」，它同样是「装好了」这个结论
		expect(parseInstallProgress("already installed: /Users/me/.local/bin/magpie")).toEqual({
			downloaded: undefined,
			total: undefined,
			verifying: false,
			installed: true,
		});
		expect(parseInstallProgress("progress 10 0").total).toBeUndefined();
	});
});

describe("lastLine", () => {
	it("takes the last non-empty line and truncates it", () => {
		expect(lastLine("a\n\nb\r\n")).toBe("b");
		expect(lastLine("")).toBeUndefined();
		expect(lastLine("x".repeat(400))).toHaveLength(241);
	});

	it("skips progress lines so the panel keeps showing the real message", () => {
		expect(lastLine("downloading x 1 (700 bytes)\nprogress 350 700")).toBe("downloading x 1 (700 bytes)");
		expect(lastLine("progress 1 700\nprogress 350 700")).toBeUndefined();
	});
});

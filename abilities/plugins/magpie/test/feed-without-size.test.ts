import { describe, expect, it } from "vitest";
import { installScript, pickReleaseAsset } from "../src/gateway-runtime";
import { windowsInstallScript } from "../src/platform-shell";

/**
 * 官方 feed 的 `size` 一直是 90 MB 左右，0.1.4138 起突然变成 0。
 * 0.1.3 把它当「必须有、必须 > 0」的字段，于是整条安装路径 fail-closed 成
 * `runtime.unsupported` —— 按钮上写着「安装并启动」，实际一步都不走。
 *
 * `size` 不是安全属性（完整性靠 sha256），所以缺失时降级而不是拒绝。
 */

const entry = (size: number | undefined) => ({
	version: "0.1.4138",
	assets: {
		"magpie-cli-windows-amd64.exe": {
			url: "https://usemagpie.ai/files/v0.1.4138/magpie-cli-windows-amd64.exe",
			sha256: "5c5fff411f8b64beaed438ebd0237657596a4ede0eb2301a9f48d493fdd424ca",
			...(size === undefined ? {} : { size }),
		},
	},
});

describe("a feed without size", () => {
	it("still selects the asset", () => {
		const asset = pickReleaseAsset(entry(0), { os: "windows", arch: "amd64" });
		expect(asset).toBeTruthy();
		expect(asset?.key).toBe("magpie-cli-windows-amd64.exe");
		expect(asset?.size).toBeUndefined();
	});

	it("keeps the size when the feed does publish one", () => {
		expect(pickReleaseAsset(entry(1024), { os: "windows", arch: "amd64" })?.size).toBe(1024);
	});

	it("still refuses an asset whose sha256 is not a real digest", () => {
		const broken = entry(1024);
		broken.assets["magpie-cli-windows-amd64.exe"].sha256 = "nope";
		expect(pickReleaseAsset(broken, { os: "windows", arch: "amd64" })).toBeNull();
	});

	it("still refuses a download host that is not the vendor's", () => {
		const broken = entry(1024);
		broken.assets["magpie-cli-windows-amd64.exe"].url = "https://evil.example/magpie.exe";
		expect(pickReleaseAsset(broken, { os: "windows", arch: "amd64" })).toBeNull();
	});
});

describe("install scripts with an unknown size", () => {
	const asset = {
		key: "magpie-cli-windows-amd64.exe",
		version: "0.1.4138",
		url: "https://usemagpie.ai/files/v0.1.4138/magpie-cli-windows-amd64.exe",
		sha256: "5c5fff411f8b64beaed438ebd0237657596a4ede0eb2301a9f48d493fdd424ca",
	};

	it("windows: want = 0 means 'do not pre-check the partial', not 'zero bytes'", () => {
		const script = windowsInstallScript(asset);
		expect(script).toContain("$want = 0");
		expect(script).toContain("($want -eq 0) -or ($have -ne $want)");
		// 不谎报「全部完成」。
		expect(script).toContain("if ($want -ne 0)");
	});

	it("posix: same rule, and the digest still gates the install", () => {
		const script = installScript(asset);
		expect(script).toContain('want="0"');
		expect(script).toContain('[ "$want" = 0 ] ||');
		expect(script).toContain("checksum mismatch");
		expect(script).toContain(asset.sha256);
	});
});

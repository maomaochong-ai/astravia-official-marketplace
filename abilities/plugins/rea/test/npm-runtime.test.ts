import { describe, expect, it } from "vitest";
import { looksLikeMissingNpm, NPM_MISSING_PATTERN } from "../src/features/rea-workflow/live/engine-bridge";

/**
 * 这批断言对应一次真实故障：宿主把运行时升到 Node 22.23.5，该版本不再自带 npm，
 * 而 PATH 上第一条 `npx.cmd` 仍指向 `node\22.23.5\node_modules\npm\bin\npx-cli.js`。
 * 结果是 provider 的 probe / install / doctor 全部失败，界面上看起来像「REA 没装好」。
 */
describe("npm 缺失的识别", () => {
	const fatal = [
		// 本机实测输出（PowerShell 包了一层 node 的 loader 异常）
		"node:internal/modules/cjs/loader:1433\nCannot find module 'C:\\Users\\x\\.astravia\\runtimes\\node\\22.23.5\\node_modules\\npm\\bin\\npx-cli.js'",
		"Error: Cannot find module '.../node_modules/npm/bin/npm-cli.js'",
		"spawn npx ENOENT",
	];

	it("把坏 shim 的输出当成运行时故障，而不是 REA 未安装", () => {
		for (const stderr of fatal) {
			expect(looksLikeMissingNpm({ exitCode: 1, stdout: "", stderr }), stderr).toBe(true);
		}
	});

	it("成功的调用永远不算故障", () => {
		expect(looksLikeMissingNpm({ exitCode: 0, stdout: "6.7.0", stderr: "" })).toBe(false);
	});

	it("普通失败不触发兜底：兜底只针对 npm 组件缺失，别把参数错误也换条路重跑", () => {
		expect(looksLikeMissingNpm({ exitCode: 1, stdout: "", stderr: "unknown command: docter" })).toBe(false);
		expect(NPM_MISSING_PATTERN.test("rea-agents: provider not ready")).toBe(false);
	});
});

/**
 * reveal-item 测试 —— 「打开所在文件夹」平台命令选择与执行。
 * 不真实打开文件管理器：成功路径用 node 自身进程模拟，失败路径用不存在的命令。
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	REVEAL_PATH_MAX_LENGTH,
	runRevealCommand,
	selectRevealCommand,
	validateRevealPath,
} from "../src/engine/reveal-item.mjs";

describe("validateRevealPath", () => {
	it("接受绝对路径并 trim", () => {
		assert.equal(validateRevealPath("/tmp/a.csv"), "/tmp/a.csv");
		assert.equal(validateRevealPath("  /tmp/a.csv  "), "/tmp/a.csv");
	});

	it("拒绝空串 / 空白 / 非字符串 / null", () => {
		for (const bad of ["", "   ", null, undefined, 42, {}]) {
			assert.throws(() => validateRevealPath(bad), /非空字符串/);
		}
	});

	it("拒绝相对路径", () => {
		assert.throws(() => validateRevealPath("tmp/a.csv"), /绝对路径/);
		assert.throws(() => validateRevealPath("./a.csv"), /绝对路径/);
	});

	it("拒绝空字节", () => {
		assert.throws(() => validateRevealPath("/tmp/a\0.csv"), /空字节/);
	});

	it("拒绝超长路径", () => {
		assert.throws(() => validateRevealPath(`/${"a".repeat(REVEAL_PATH_MAX_LENGTH)}`), /过长/);
	});
});

describe("selectRevealCommand", () => {
	it("darwin → open -R <path>", () => {
		assert.deepEqual(selectRevealCommand("darwin", "/tmp/a.csv"), {
			command: "open",
			args: ["-R", "/tmp/a.csv"],
		});
	});

	it("win32 → explorer.exe /select,<path> 且忽略退出码", () => {
		const spec = selectRevealCommand("win32", "/tmp/a.csv");
		assert.equal(spec.command, "explorer.exe");
		assert.deepEqual(spec.args, ["/select,/tmp/a.csv"]);
		assert.equal(spec.ignoreExitCode, true);
	});

	it("linux/其它 → xdg-open 所在目录", () => {
		assert.deepEqual(selectRevealCommand("linux", "/tmp/dir/a.csv"), {
			command: "xdg-open",
			args: ["/tmp/dir"],
		});
		assert.deepEqual(selectRevealCommand("aix", "/root/x"), {
			command: "xdg-open",
			args: ["/root"],
		});
	});

	it("非法路径直接抛错（不会拼命令）", () => {
		assert.throws(() => selectRevealCommand("darwin", "relative/a.csv"), /绝对路径/);
	});

	it("win32 盘符绝对路径（仅 Windows 运行时可通过 isAbsolute 校验）", { skip: process.platform === "win32" ? false : "仅 win32 校验盘符路径" }, () => {
		const spec = selectRevealCommand("win32", "C:\\Users\\me\\a.csv");
		assert.deepEqual(spec.args, ["/select,C:\\Users\\me\\a.csv"]);
	});
});

describe("runRevealCommand", () => {
	it("退出码 0 → resolve", async () => {
		await runRevealCommand({ command: process.execPath, args: ["-e", "process.exit(0)"] });
	});

	it("非零退出码 → reject 并带退出码", async () => {
		await assert.rejects(
			runRevealCommand({ command: process.execPath, args: ["-e", "process.exit(3)"] }),
			/退出码 3/,
		);
	});

	it("ignoreExitCode 容忍 explorer 的非零退出", async () => {
		await runRevealCommand({
			command: process.execPath,
			args: ["-e", "process.exit(1)"],
			ignoreExitCode: true,
		});
	});

	it("命令不存在 → reject 启动错误", async () => {
		await assert.rejects(
			runRevealCommand({ command: "dbx-reveal-nonexistent-bin-xyz", args: [] }),
			/无法启动文件管理器/,
		);
	});
});

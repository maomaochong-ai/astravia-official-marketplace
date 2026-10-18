/**
 * 安装配方表的回归测试。
 *
 * 这一层的断言全部对着「真实能不能跑」写，而不是对着实现细节：
 *   - 每个 command 通道的可执行文件都必须在 plugin.json 的 commands 白名单里，
 *     否则宿主会直接拒绝，用户点了按钮只会看到一句 disabled；
 *   - 配方里的包名必须真的存在于对应包管理器（本轮被否证的 5 条已经写死在
 *     下面的反例里，防止有人再把它们加回来）；
 *   - 复制给用户的那一行必须与真正会跑的步骤等价，不能有一条「说一套跑一套」。
 */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	INSTALL_RECIPES,
	describeRecipe,
	firstChannel,
	installRecipeFor,
	installSteps,
	isRunnable,
	needsConfigAfterInstall,
	type InstallRecipe,
	type InstallRunner,
} from "../src/features/rea-workflow/live/tool-install";

const readJson = <T>(relativePath: string): T =>
	JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as T;

const plugin = readJson<{ commands: readonly string[] }>("../plugin.json");
const en = readJson<Record<string, string>>("../locales/en.json");
const zh = readJson<Record<string, string>>("../locales/zh.json");

const recipes = Object.entries(INSTALL_RECIPES) as readonly (readonly [string, InstallRecipe])[];

function runnerText(runner: InstallRunner): string {
	const args = runner.args.join(" ");
	return runner.channel === "rea" ? `rea ${args}` : `${runner.file ?? ""} ${args}`.trim();
}

/** brew 这一步装的包名（跳过 `install` 与 `--cask` 这类开关）。 */
function brewPackages(recipe: InstallRecipe): readonly string[] {
	return recipe.steps
		.filter((runner) => runner.file === "brew")
		.flatMap((runner) => runner.args.filter((arg) => !arg.startsWith("-") && arg !== "install"));
}

describe("安装配方的可执行性", () => {
	it("command 通道的每个可执行文件都在 plugin.json 白名单里", () => {
		const missing: string[] = [];
		for (const [id, recipe] of recipes) {
			for (const runner of recipe.steps) {
				if (runner.channel !== "command") continue;
				if (!plugin.commands.includes(runner.file ?? "")) missing.push(`${id}: ${runner.file}`);
			}
		}
		expect(missing).toEqual([]);
	});

	it("pip 类配方会先把 pipx 装进白名单，否则第二步必然被宿主拒绝", () => {
		expect(plugin.commands).toContain("pipx");
	});

	it("参数里不出现 shell 语法：spawn 是 execFile 语义，不经过 shell", () => {
		const offenders: string[] = [];
		for (const [id, recipe] of recipes) {
			for (const runner of recipe.steps) {
				for (const arg of runner.args) {
					if (/[|&;<>$`]/.test(arg)) offenders.push(`${id}: ${arg}`);
				}
			}
		}
		expect(offenders).toEqual([]);
	});
});

describe("被否证的包名不许回到配方里", () => {
	// 本机 Homebrew 7.0.9 上逐条核验过：这些包 brew 都没有，装必然失败。
	const NO_BREW_PACKAGE = ["ghidra", "pwndbg", "frida-tools", "unblob"];

	it("brew 步骤不装 brew 里不存在的包", () => {
		for (const [id, recipe] of recipes) {
			for (const name of brewPackages(recipe)) {
				expect(NO_BREW_PACKAGE, `${id} 装了 ${name}`).not.toContain(name);
			}
		}
	});

	it("mitmproxy 只有 cask，没有 formula", () => {
		const steps = installSteps(installRecipeFor("mitmdump"));
		expect(steps).toHaveLength(1);
		expect(steps[0]?.args).toEqual(["install", "--cask", "mitmproxy"]);
	});

	it("wireshark 用 formula 而不是需要 sudo 的 cask", () => {
		for (const id of ["tshark", "capinfos"]) {
			expect(installSteps(installRecipeFor(id))[0]?.args).toEqual(["install", "wireshark"]);
		}
	});

	it("python 包走 pipx，不碰系统 Python 的 PEP 668 限制", () => {
		for (const id of ["frida", "unblob"]) {
			const steps = installSteps(installRecipeFor(id));
			expect(steps).toHaveLength(2);
			expect(steps[0]).toEqual({ channel: "command", file: "brew", args: ["install", "pipx"] });
			expect(steps[1]?.file).toBe("pipx");
			expect(steps[1]?.args[0]).toBe("install");
		}
	});
});

describe("无法代跑的工具只给复制", () => {
	// ghidra = brew 无 cask；pwndbg = brew / PyPI 都没有；java(temurin) 与 jeb = 需要人工步骤。
	const MANUAL_ONLY = ["ghidra", "pwndbg", "java", "jeb"];

	it.each(MANUAL_ONLY)("%s 没有一键安装，但有可复制的命令与原因", (id) => {
		const recipe = installRecipeFor(id);
		expect(recipe).not.toBeNull();
		expect(isRunnable(recipe)).toBe(false);
		expect(installSteps(recipe)).toEqual([]);
		expect(firstChannel(recipe)).toBeNull();
		expect(describeRecipe(recipe as InstallRecipe).length).toBeGreaterThan(0);
		expect(needsConfigAfterInstall(recipe)).toBe(true);
		expect((recipe as InstallRecipe).noteKey).toBeTruthy();
	});
});

describe("文案与真实步骤一致", () => {
	it("可复制的一行等于真实步骤用 && 连接", () => {
		for (const [id, recipe] of recipes) {
			if (recipe.steps.length === 0) continue;
			expect(describeRecipe(recipe), id).toBe(recipe.steps.map(runnerText).join(" && "));
		}
	});

	it("REA 通道的配方文案带 rea 前缀", () => {
		expect(describeRecipe(installRecipeFor("hopper") as InstallRecipe)).toBe("rea setup --yes --installHopper");
		expect(firstChannel(installRecipeFor("hopper"))).toBe("rea");
	});

	it("mayNeedConfig 一定带 noteKey，ready 一定不带", () => {
		for (const [id, recipe] of recipes) {
			if (recipe.note === "mayNeedConfig") expect(recipe.noteKey, id).toBeTruthy();
			else expect(recipe.noteKey, id).toBeUndefined();
		}
	});

	it("每个 noteKey 在中文与英文里都存在", () => {
		for (const [id, recipe] of recipes) {
			if (recipe.noteKey === undefined) continue;
			expect(en[recipe.noteKey], `${id} en`).toBeTruthy();
			expect(zh[recipe.noteKey], `${id} zh`).toBeTruthy();
		}
	});
});

describe("空配方的边界", () => {
	it("未知工具返回 null，且各导出函数都能安全处理", () => {
		expect(installRecipeFor("no-such-tool")).toBeNull();
		expect(isRunnable(null)).toBe(false);
		expect(installSteps(null)).toEqual([]);
		expect(firstChannel(null)).toBeNull();
		expect(needsConfigAfterInstall(null)).toBe(false);
	});
});

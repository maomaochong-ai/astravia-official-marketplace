/**
 * 「这个工具怎么装」的配方表。
 *
 * 每条配方有三件事，必须分开说：
 *
 *   command   写给人看、也能复制走的一行命令
 *   runner    插件自己能不能跑（能跑才给「一键安装」按钮）；null 表示只能复制
 *   note      装完之后是不是真的就能用：ready 直接用得上；mayNeedConfig 装完可能还要
 *             配置（环境变量、PATH、代码签名），面板会把原因写出来而不是假装成功
 *
 * brew 只收会落在 PATH 上的 formula：wireshark 用 formula 而不是 `--cask wireshark`
 * （cask 要管理员密码改 dumpcap 权限，而我们只需要 tshark / capinfos 两个 CLI）。
 *
 * 有安装命令就给按钮，但按钮不是承诺：ghidra 装完还得让 `GHIDRA_INSTALL_DIR` 出现在
 * Astravia 主进程的环境里；binutils 是 keg-only，objdump 不会进 PATH；gdb 在 macOS
 * 上还要自行 codesign。这些走 mayNeedConfig，理由写在行内。
 */

export type InstallChannel = "rea" | "command";

/** 装完之后的可用性，决定面板是否要补一句「可能还要配置」。 */
export type InstallNote = "ready" | "mayNeedConfig";

export interface InstallRunner {
	readonly channel: InstallChannel;
	/** channel = command 时要执行的可执行文件名（须在 plugin.json 的 commands 白名单里）。 */
	readonly file?: string;
	readonly args: readonly string[];
}

export interface InstallRecipe {
	/** 可复制的一行命令。 */
	readonly command: string;
	/** null 表示没有可以替用户执行的通道（例如 jeb 只需设一个环境变量）。 */
	readonly runner: InstallRunner | null;
	readonly note: InstallNote;
	/** i18n key：装完为什么可能还要配置。 */
	readonly noteKey?: string;
}

const brew = (...args: string[]): InstallRunner => ({ channel: "command", file: "brew", args });
// pip 类配方只给可复制命令：`pip3` 不在 plugin.json 的命令白名单里，
// 装上按钮却 spawn 不出去，比不给按钮更糟。

export const INSTALL_RECIPES: Readonly<Record<string, InstallRecipe>> = {
	hopper: {
		command: "rea setup --yes --installHopper",
		runner: { channel: "rea", args: ["setup", "--yes", "--installHopper"] },
		note: "ready",
	},
	apktool: { command: "brew install apktool", runner: brew("install", "apktool"), note: "ready" },
	binwalk: { command: "brew install binwalk", runner: brew("install", "binwalk"), note: "ready" },
	unblob: {
		command: "pip3 install --user unblob",
		runner: null,
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.pipPath",
	},
	adb: {
		command: "brew install --cask android-platform-tools",
		runner: brew("install", "--cask", "android-platform-tools"),
		note: "ready",
	},
	rizin: { command: "brew install rizin", runner: brew("install", "rizin"), note: "ready" },
	wabt: { command: "brew install wabt", runner: brew("install", "wabt"), note: "ready" },
	mitmdump: { command: "brew install mitmproxy", runner: brew("install", "mitmproxy"), note: "ready" },
	ghidra: {
		command: "brew install --cask ghidra",
		runner: brew("install", "--cask", "ghidra"),
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.ghidraEnv",
	},
	jadx: { command: "brew install jadx", runner: brew("install", "jadx"), note: "ready" },
	cutter: {
		command: "brew install --cask cutter",
		runner: brew("install", "--cask", "cutter"),
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.cutterPath",
	},
	objdump: {
		command: "brew install binutils",
		runner: brew("install", "binutils"),
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.kegOnly",
	},
	tshark: { command: "brew install wireshark", runner: brew("install", "wireshark"), note: "ready" },
	capinfos: { command: "brew install wireshark", runner: brew("install", "wireshark"), note: "ready" },
	sigrok: { command: "brew install sigrok-cli", runner: brew("install", "sigrok-cli"), note: "ready" },
	frida: {
		command: "pip3 install --user frida-tools",
		runner: null,
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.pipPath",
	},
	pwntools: {
		command: "pip3 install --user pwntools",
		runner: null,
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.pipPath",
	},
	pwndbg: {
		command: "brew install pwndbg",
		runner: brew("install", "pwndbg"),
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.pwndbgGdb",
	},
	gdb: {
		command: "brew install gdb",
		runner: brew("install", "gdb"),
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.gdbCodesign",
	},
	java: {
		command: "brew install --cask temurin",
		runner: brew("install", "--cask", "temurin"),
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.javaPath",
	},
	browser: {
		command: "brew install --cask google-chrome",
		runner: brew("install", "--cask", "google-chrome"),
		note: "ready",
	},
	jeb: {
		command: "REA_JEB_MCP_URL=http://127.0.0.1:<port>",
		runner: null,
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.jebEnv",
	},
};

export function installRecipeFor(id: string): InstallRecipe | null {
	return INSTALL_RECIPES[id] ?? null;
}

/** 一行人类可读的命令：给副标题显示，也是「复制」按钮的内容。 */
export function describeRecipe(recipe: InstallRecipe): string {
	return recipe.command;
}
/** 插件能不能替用户执行：能跑才显示「一键安装」，否则只给复制。 */
export function isRunnable(recipe: InstallRecipe | null): recipe is InstallRecipe & { readonly runner: InstallRunner } {
	return recipe?.runner != null;
}

/** 装完是否还需要用户额外配置（按钮照样给，但要把原因写清楚）。 */
export function needsConfigAfterInstall(recipe: InstallRecipe | null): boolean {
	return recipe?.note === "mayNeedConfig";
}

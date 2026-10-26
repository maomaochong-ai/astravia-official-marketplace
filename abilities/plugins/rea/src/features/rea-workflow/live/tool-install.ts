/**
 * 「这个工具怎么装」的配方表 + 安装过程的判读规则。
 *
 * 每条配方有四件事，必须分开说：
 *
 *   command   写给人看、也能复制走的一行（多步用 `&&` 连起来，与真正会跑的步骤一致）
 *   steps     插件自己能跑的那几步；空数组表示只能复制
 *   note      装完之后是不是真的就能用：ready 直接用得上；mayNeedConfig 装完可能还要
 *             配置（PATH、代码签名、环境变量），面板会把原因写出来而不是假装成功
 *   noteKey   上面这句话的 i18n key
 *
 * 配方里每一个命令都在本机（Homebrew 7.0.9 / macOS arm64）用 `brew info --json=v2`
 * 与 PyPI 元数据核验过，核验结论直接决定它属于哪一类：
 *
 *   ghidra     Homebrew 没有这个 cask（`No Cask with this name exists`）→ 只能给官方 Release 页
 *   pwndbg     formula / cask / PyPI 三处都没有 → 只能给官方的 git clone + setup.sh
 *   temurin    cask 是 .pkg，装的时候要管理员密码；面板的 stdio 里没有终端 → 只能复制
 *   mitmproxy  只有 cask，formula 不存在 → `--cask mitmproxy`（cask 会链出 mitmdump）
 *   wireshark  cask 是 pkg + sudo，但 formula 存在 → 用 formula（只要 tshark / capinfos）
 *   pip 类     brew 没有 frida-tools / unblob，PyPI 有；brew 的 python 是 externally-managed，
 *             所以走 pipx（不碰系统 Python，也不需要管理员权限）
 *   pwntools   brew 有 formula → 直接可跑
 *
 * 有安装按钮也不是承诺：binutils 是 keg-only，objdump 不会进 PATH；gdb 在 macOS 上还要
 * 自己 codesign；pipx 装出来的命令落在 ~/.local/bin。这些走 mayNeedConfig，理由写在行内。
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
	/** 可复制的一行；多步配方用 `&&` 串起来，与 steps 一一对应。 */
	readonly command: string;
	/** 插件可代跑的步骤；空数组 = 没有能替用户执行的通道。 */
	readonly steps: readonly InstallRunner[];
	readonly note: InstallNote;
	/** i18n key：装完为什么可能还要配置。 */
	readonly noteKey?: string;
}

const brew = (...args: string[]): InstallRunner => ({ channel: "command", file: "brew", args });
const viaPipx = (pkg: string): InstallRunner => ({ channel: "command", file: "pipx", args: ["install", pkg] });

/**
 * pipx 把命令装到 ~/.local/bin：宿主的 PATH 在启动时读一次，所以装完往往要重启才认。
 * 两步都成功才算装完，中间任一步失败就停在那里。
 */
const pipxPlan = (pkg: string): readonly InstallRunner[] => [brew("install", "pipx"), viaPipx(pkg)];

const GHIDRA_RELEASES = "https://github.com/NationalSecurityAgency/ghidra/releases/latest";
const PWNDBG_SETUP = "git clone https://github.com/pwndbg/pwndbg && cd pwndbg && ./setup.sh";

export const INSTALL_RECIPES: Readonly<Record<string, InstallRecipe>> = {
	hopper: {
		// CLI 6.8.0 实测的开关是 kebab-case 的 `--install-hopper`（`rea setup --help`）。
		// 以前写成 `--installHopper`，CLI 不认这个拼写、静默忽略，于是只跑了 setup，没有装 Hopper。
		command: "rea setup --yes --install-hopper",
		steps: [{ channel: "rea", args: ["setup", "--yes", "--install-hopper"] }],
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.hopperLicense",
	},
	apktool: { command: "brew install apktool", steps: [brew("install", "apktool")], note: "ready" },
	binwalk: { command: "brew install binwalk", steps: [brew("install", "binwalk")], note: "ready" },
	unblob: {
		command: "brew install pipx && pipx install unblob",
		steps: pipxPlan("unblob"),
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.pipxPath",
	},
	adb: {
		command: "brew install --cask android-platform-tools",
		steps: [brew("install", "--cask", "android-platform-tools")],
		note: "ready",
	},
	rizin: { command: "brew install rizin", steps: [brew("install", "rizin")], note: "ready" },
	wabt: { command: "brew install wabt", steps: [brew("install", "wabt")], note: "ready" },
	mitmdump: {
		command: "brew install --cask mitmproxy",
		steps: [brew("install", "--cask", "mitmproxy")],
		note: "ready",
	},
	ghidra: {
		// Homebrew 没有 ghidra（formula / cask 都没有），所以这里只有一个下载页。
		command: GHIDRA_RELEASES,
		steps: [],
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.ghidraManual",
	},
	jadx: { command: "brew install jadx", steps: [brew("install", "jadx")], note: "ready" },
	cutter: {
		command: "brew install --cask cutter",
		steps: [brew("install", "--cask", "cutter")],
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.cutterPath",
	},
	objdump: {
		command: "brew install binutils",
		steps: [brew("install", "binutils")],
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.kegOnly",
	},
	tshark: { command: "brew install wireshark", steps: [brew("install", "wireshark")], note: "ready" },
	capinfos: { command: "brew install wireshark", steps: [brew("install", "wireshark")], note: "ready" },
	sigrok: { command: "brew install sigrok-cli", steps: [brew("install", "sigrok-cli")], note: "ready" },
	frida: {
		command: "brew install pipx && pipx install frida-tools",
		steps: pipxPlan("frida-tools"),
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.pipxPath",
	},
	pwntools: {
		// brew 有 pwntools formula：它被装进 Homebrew 的 Python，所以仍可能对不上 REA 用的解释器。
		command: "brew install pwntools",
		steps: [brew("install", "pwntools")],
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.pwntoolsEnv",
	},
	pwndbg: {
		// brew 里没有 pwndbg（formula / cask 都没有），PyPI 也没有；官方只给了 setup.sh。
		command: PWNDBG_SETUP,
		steps: [],
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.pwndbgGdb",
	},
	gdb: {
		command: "brew install gdb",
		steps: [brew("install", "gdb")],
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.gdbCodesign",
	},
	java: {
		// temurin 的 cask 是 .pkg，安装器要管理员密码；面板里没有终端可以输入。
		command: "brew install --cask temurin",
		steps: [],
		note: "mayNeedConfig",
		noteKey: "tab.tools.note.javaAdmin",
	},
	browser: {
		command: "brew install --cask google-chrome",
		steps: [brew("install", "--cask", "google-chrome")],
		note: "ready",
	},
	jeb: {
		command: "REA_JEB_MCP_URL=http://127.0.0.1:<port>",
		steps: [],
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
export function isRunnable(recipe: InstallRecipe | null): recipe is InstallRecipe & { readonly steps: readonly InstallRunner[] } {
	return recipe !== null && recipe.steps.length > 0;
}

/** 要跑的步骤（不能跑时为空数组，调用方不必再判 null）。 */
export function installSteps(recipe: InstallRecipe | null): readonly InstallRunner[] {
	return recipe === null ? [] : recipe.steps;
}

/** 第一步走哪条通道：按钮的提示文案据此区分「REA 官方安装」与「执行本机命令」。 */
export function firstChannel(recipe: InstallRecipe | null): InstallChannel | null {
	return recipe !== null && recipe.steps.length > 0 ? (recipe.steps[0] as InstallRunner).channel : null;
}

/** 装完是否还需要用户额外配置（按钮照样给，但要把原因写清楚）。 */
export function needsConfigAfterInstall(recipe: InstallRecipe | null): boolean {
	return recipe?.note === "mayNeedConfig";
}

/** 安装过程的阶段，只按真实输出里的标记推进，没有标记就保持 unknown。 */
export type InstallStage = "starting" | "downloading" | "installing" | "finishing" | "unknown";

const STAGE_MARKERS: readonly { readonly stage: InstallStage; readonly test: RegExp }[] = [
	// brew 先取包信息再下载；pipx 只有「创建 venv / 安装包」两类。
	{ stage: "downloading", test: /==>\s+(Downloading|Fetching|Updating Homebrew)|Downloading |Resolving |Fetching / },
	{ stage: "installing", test: /==>\s+(Installing|Pouring|Upgrading|Linking)|Installing package|creating virtual environment|installing /i },
	{ stage: "finishing", test: /==>\s+(Running|Caveats|Summary|Purging|Cleanup)|done!|installed package/i },
];

/**
 * 从已捕获的输出里读出现在进行到哪一步。
 *
 * 只认 brew / pipx 真实打印的标记，从最后一行往前找最近出现的那类；找不到就返回
 * unknown —— 面板宁可说「不确定」也不按时间编一个进度。
 */
export function deriveInstallStage(log: string): InstallStage {
	const lines = log.split(/\r?\n/);
	for (let index = lines.length - 1; index >= 0; index -= 1) {
		const line = lines[index] ?? "";
		if (line.trim().length === 0) continue;
		for (const marker of STAGE_MARKERS) {
			if (marker.test.test(line)) return marker.stage;
		}
	}
	return log.trim().length === 0 ? "starting" : "unknown";
}

/** 失败原因的 i18n key；detail 是宿主给的原文，用来让用户能自己搜。 */
export type InstallFailureKey =
	| "tab.install.error.disabled"
	| "tab.install.error.notDeclared"
	| "tab.install.error.missingCommand"
	| "tab.install.error.needsPassword"
	| "tab.install.error.noPackage"
	| "tab.install.error.externallyManaged"
	| "tab.install.error.network"
	| "tab.install.error.precondition"
	| "tab.install.error.generic";

export interface InstallFailure {
	readonly key: InstallFailureKey;
	readonly detail: string;
}

const FAILURE_RULES: readonly { readonly key: InstallFailureKey; readonly test: RegExp }[] = [
	// 宿主 renderer 的闸门（plugin-host-apis.ts）与本机 spawn 的闸门（command-spawner.ts）。
	{ key: "tab.install.error.disabled", test: /disabled by user|命令已禁用/i },
	{ key: "tab.install.error.notDeclared", test: /not declared/i },
	{ key: "tab.install.error.missingCommand", test: /failed to start|ENOENT|command not found/i },
	{ key: "tab.install.error.needsPassword", test: /a terminal is required|sudo: |password|administrator/i },
	{ key: "tab.install.error.noPackage", test: /no available formula|no cask with this name|is unavailable|no formulae or casks/i },
	{ key: "tab.install.error.externallyManaged", test: /externally-managed-environment/i },
	{ key: "tab.install.error.network", test: /could not resolve|connection refused|network is unreachable|temporary failure|timed out|ssl/i },
	// CLI 自己拒绝执行（例：Node 版本不足、macOS 太旧）。这类输出里带着 `remediation`，
	// 比宿主的 exit code 有用得多，所以单独一类，不归到 generic。
	{
		key: "tab.install.error.precondition",
		test: /Install Node\.js|rerun setup|Upgrade to macOS|needs_human|requires macOS \d+/i,
	},
];

function lastLine(text: string): string {
	const line = text
		.split(/\r?\n/)
		.map((candidate) => candidate.trim())
		.filter((candidate) => candidate.length > 0)
		.pop();
	return (line ?? "").slice(0, 240);
}

/** 从 CLI 的 JSON 输出里取它自己给的 `remediation`（doctor / setup 的拒绝都会带）。 */
function cliRemediation(raw: string): string | null {
	const match = /"remediation"\s*:\s*"((?:[^"\\]|\\.)*)"/u.exec(raw);
	if (match === null) return null;
	const text = (match[1] ?? "").replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim();
	return text.length === 0 ? null : text.slice(0, 240);
}

/**
 * 把宿主的错误翻成「该怎么办」，原文照旧带在 detail 里。
 *
 * 这一步是必要的：`Command disabled by user: brew` 与 `No Cask with this name exists`
 * 对用户是两句完全不同的话——一句要去插件设置里授权，一句是配方本身错了。
 */
export function explainInstallError(raw: string): InstallFailure {
	// CLI 的结构化输出自带「该怎么办」那一句，比取最后一行靠谱：JSON 的最后一行通常只是 `}`。
	const detail = cliRemediation(raw) ?? lastLine(raw);
	for (const rule of FAILURE_RULES) {
		if (rule.test.test(raw)) return { key: rule.key, detail };
	}
	return { key: "tab.install.error.generic", detail };
}

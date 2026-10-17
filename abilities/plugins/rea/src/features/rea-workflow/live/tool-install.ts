/**
 * 「这个工具怎么装」的配方表。
 *
 * 三种类型，区别是**用户要付出多少操作**，不能混着说：
 *
 *   rea     REA 官方支持无人值守安装（目前只有 Hopper：`rea setup --yes --installHopper`）
 *   brew    Homebrew 装完即可被 REA 直接用到，属于真正的一键安装
 *   manual  需要授权、需要设置应用看不到的环境变量、或装完还得再配置——只给可复制的命令
 *
 * brew 只收「装完命令就在 PATH 上、REA 立刻能调」的 formula：
 *   wireshark 用 formula 而不是 `--cask wireshark`（cask 要管理员密码改 dumpcap 权限，
 *   而且我们只需要 tshark / capinfos 两个 CLI）；binutils 是 keg-only，装完 objdump
 *   依然不在 PATH 上，所以留在 manual 里说清楚。
 *
 * manual 里 ghidra 尤其要说清：装了 Ghidra 还得让 `GHIDRA_INSTALL_DIR` 出现在
 * Astravia 主进程的环境里，否则 REA 依然用不了。pwntools / pwndbg 走 Python / gdb
 * 生态同样不在应用能管的范围内。所以这些都不给「一键安装」，避免装完还是红的。
 */

export type InstallKind = "rea" | "brew" | "manual";

export interface InstallRecipe {
	readonly kind: InstallKind;
	/** kind = rea：传给 REA CLI 的参数（不含包名前缀）；kind = brew：传给 brew 的参数。 */
	readonly args?: readonly string[];
	/** kind = manual：给用户复制的一行命令。 */
	readonly command?: string;
}

export const INSTALL_RECIPES: Readonly<Record<string, InstallRecipe>> = {
	hopper: { kind: "rea", args: ["setup", "--yes", "--installHopper"] },
	apktool: { kind: "brew", args: ["install", "apktool"] },
	binwalk: { kind: "brew", args: ["install", "binwalk"] },
	unblob: { kind: "manual", command: "pip3 install --user unblob" },
	adb: { kind: "brew", args: ["install", "--cask", "android-platform-tools"] },
	rizin: { kind: "brew", args: ["install", "rizin"] },
	wabt: { kind: "brew", args: ["install", "wabt"] },
	mitmdump: { kind: "brew", args: ["install", "mitmproxy"] },
	ghidra: { kind: "manual", command: "brew install --cask ghidra" },
	jadx: { kind: "brew", args: ["install", "jadx"] },
	cutter: { kind: "manual", command: "brew install --cask cutter" },
	objdump: { kind: "manual", command: "brew install binutils" },
	tshark: { kind: "brew", args: ["install", "wireshark"] },
	capinfos: { kind: "brew", args: ["install", "wireshark"] },
	sigrok: { kind: "brew", args: ["install", "sigrok-cli"] },
	frida: { kind: "manual", command: "pip3 install --user frida-tools" },
	pwntools: { kind: "manual", command: "pip3 install --user pwntools" },
	pwndbg: { kind: "manual", command: "brew install pwndbg" },
	gdb: { kind: "manual", command: "brew install gdb" },
	java: { kind: "manual", command: "brew install --cask temurin" },
	browser: { kind: "manual", command: "brew install --cask google-chrome" },
	jeb: { kind: "manual", command: "REA_JEB_MCP_URL=http://127.0.0.1:<port>" },
};

export function installRecipeFor(id: string): InstallRecipe | null {
	return INSTALL_RECIPES[id] ?? null;
}

/** 真正能由插件直接执行的一键安装（rea / brew）。 */
export function isOneClick(recipe: InstallRecipe | null): boolean {
	return recipe !== null && (recipe.kind === "rea" || recipe.kind === "brew");
}

/** 一行人类可读的命令，用于「正在安装」这一行的副标题与复制内容。 */
export function describeRecipe(recipe: InstallRecipe): string {
	if (recipe.kind === "rea") return `rea ${(recipe.args ?? []).join(" ")}`.trim();
	if (recipe.kind === "brew") return `brew ${(recipe.args ?? []).join(" ")}`.trim();
	return recipe.command ?? "";
}

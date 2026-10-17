/**
 * 直接探测外部可执行文件在不在。
 *
 * doctor 只覆盖 REA 自己的分析引擎（node / host / hopper / ghidra / ida / jadx /
 * ilspycmd），frida、adb、apktool、binwalk、tshark、pwntools… 它一概不管。以前这些
 * 一律显示「未知」，对用户没有信息量。这里用宿主声明的命令通道跑一次 `--version`：
 *
 *   能跑起来   ⇒ 可执行文件存在（版本能解析就带上，解析不了也不算失败）；
 *   ENOENT     ⇒ 没装；
 *   被权限挡住 ⇒ 未知，并且明确告诉用户是插件没拿到命令执行授权，不是没装。
 *
 * 没有稳定 `--version` 入口的工具（pwntools / pwndbg / JEB / Chrome）不设探测配方：
 * 硬跑一个 python -c 会把「导入失败」当成「装好了」。这几项留给会话证据与手动确认。
 *
 * 探测是只读的：不写文件、不联网、不改配置，超时 6 秒。
 */

import type { PluginCommandRunResult } from "@astravia-org/plugin-sdk";

export const PROBE_TIMEOUT_MS = 6_000;

export interface ToolProbeRecipe {
	readonly file: string;
	readonly args: readonly string[];
}

/** 工具 id → 探测命令。id 与 live/tool-requirements.ts 一致。 */
export const TOOL_PROBES: Readonly<Record<string, ToolProbeRecipe>> = {
	node: { file: "node", args: ["--version"] },
	java: { file: "java", args: ["-version"] },
	frida: { file: "frida", args: ["--version"] },
	adb: { file: "adb", args: ["version"] },
	apktool: { file: "apktool", args: ["--version"] },
	binwalk: { file: "binwalk", args: ["--help"] },
	unblob: { file: "unblob", args: ["--version"] },
	tshark: { file: "tshark", args: ["--version"] },
	capinfos: { file: "capinfos", args: ["--version"] },
	sigrok: { file: "sigrok-cli", args: ["--version"] },
	objdump: { file: "objdump", args: ["--version"] },
	gdb: { file: "gdb", args: ["--version"] },
	rizin: { file: "rizin", args: ["-v"] },
	cutter: { file: "cutter", args: ["--version"] },
	jadx: { file: "jadx", args: ["--version"] },
	mitmdump: { file: "mitmdump", args: ["--version"] },
	wabt: { file: "wasm-validate", args: ["--version"] },
	brew: { file: "brew", args: ["--version"] },
};

export type ProbeState = "ready" | "missing" | "blocked";

export interface ProbeOutcome {
	readonly state: ProbeState;
	/** 版本号或首行输出；没有可读输出时为 null。 */
	readonly detail: string | null;
}

export type ProbeRunner = (file: string, args: readonly string[]) => Promise<PluginCommandRunResult>;

export function probeRecipeFor(id: string): ToolProbeRecipe | null {
	return TOOL_PROBES[id] ?? null;
}

/** 首行输出当版本号用；`java -version` 把版本写在 stderr 上。 */
export function versionLine(result: PluginCommandRunResult): string | null {
	const text = `${result.stdout}\n${result.stderr}`;
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (line.length === 0) continue;
		return line.length > 60 ? `${line.slice(0, 59)}…` : line;
	}
	return null;
}

function blockReason(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return /permission denied|not declared|disabled by user/i.test(message);
}

/**
 * 跑一次探测。任何「能启动」的结果都算存在——很多工具（binwalk、cutter）的
 * `--version` 会以非 0 退出，用退出码判断会全部误报成没装。
 */
export async function probeTool(id: string, run: ProbeRunner): Promise<ProbeOutcome | null> {
	const recipe = probeRecipeFor(id);
	if (!recipe) return null;
	try {
		const result = await run(recipe.file, recipe.args);
		return { state: "ready", detail: versionLine(result) };
	} catch (error) {
		if (blockReason(error)) return { state: "blocked", detail: null };
		return { state: "missing", detail: null };
	}
}

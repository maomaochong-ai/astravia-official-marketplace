/**
 * 「这个目标类型需要哪些外部工具」的完整清单。
 *
 * 清单口径对齐上游 README 的 What you can analyze 表：每一行里 Caller-supplied /
 * 需要安装的东西都算一项。之前这里只列了 doctor 覆盖的几个引擎，其余靠「本次会话
 * 调用过才出现」，于是面板永远只显示一小撮工具 —— 用户看到的就是「不全」。
 *
 * 两类来源，必须分开表达：
 *
 *   doctor     `rea doctor --json` 能直接证明的工具（node / host / hopper / ghidra /
 *              ida / jadx / ilspycmd）。检查项命名规则见上游 DoctorDiagnostics.ts：
 *              `<provider>` 或 `<provider>-<check>`。
 *   runtime    doctor 观测不到的依赖（frida / adb / apktool / binwalk / pwntools…）。
 *              由命令探测给结论；探测不到时才退回「本次会话是否真的调用成功过」。
 *
 * 目标类型决定清单内容，而不是决定「这次用没用过」。没证据的项显示「未确认」并给出
 * 可操作下一步，不隐藏、也不谎称缺失。
 */

import type { TargetKind } from "../data/targets";
import type { ReaLiveCall } from "./session-store";
import { normalizeToolName } from "./tool-taxonomy";

export type ToolSource = "doctor" | "runtime";

export interface ToolRequirement {
	readonly id: string;
	/** 展示名。专有名词不翻译。 */
	readonly label: string;
	readonly source: ToolSource;
	/** doctor 检查名前缀；runtime 依赖为 null。 */
	readonly doctorId: string | null;
	/** 适用目标类型；空数组表示任何目标都要。 */
	readonly targets: readonly TargetKind[];
	/** i18n key：这个工具用来做什么。 */
	readonly purposeKey: string;
}

const ALWAYS: readonly TargetKind[] = [];

export const TOOL_REQUIREMENTS: readonly ToolRequirement[] = [
	{
		id: "node",
		label: "Node.js",
		source: "doctor",
		doctorId: "node",
		targets: ALWAYS,
		purposeKey: "tab.tools.purpose.node",
	},
	{
		id: "host",
		label: "Host",
		source: "doctor",
		doctorId: "host",
		targets: ALWAYS,
		purposeKey: "tab.tools.purpose.host",
	},
	{
		id: "hopper",
		label: "Hopper",
		source: "doctor",
		doctorId: "hopper",
		targets: ["native"],
		purposeKey: "tab.tools.purpose.hopper",
	},
	{
		id: "ghidra",
		label: "Ghidra",
		source: "doctor",
		doctorId: "ghidra",
		targets: ["native", "firmware"],
		purposeKey: "tab.tools.purpose.ghidra",
	},
	{
		id: "ida",
		label: "IDA",
		source: "doctor",
		doctorId: "ida",
		targets: ["native"],
		purposeKey: "tab.tools.purpose.ida",
	},
	{
		id: "jadx",
		label: "jadx",
		source: "doctor",
		doctorId: "jadx",
		targets: ["mobile"],
		purposeKey: "tab.tools.purpose.jadx",
	},
	{
		id: "ilspycmd",
		label: "ilspycmd",
		source: "doctor",
		doctorId: "ilspycmd",
		targets: ["dotnet"],
		purposeKey: "tab.tools.purpose.ilspycmd",
	},
	{
		id: "java",
		label: "Java",
		source: "runtime",
		doctorId: null,
		targets: ["native", "firmware", "mobile"],
		purposeKey: "tab.tools.purpose.java",
	},
	{
		id: "frida",
		label: "Frida",
		source: "runtime",
		doctorId: null,
		targets: ["native", "mobile", "javascript"],
		purposeKey: "tab.tools.purpose.frida",
	},
	{
		id: "adb",
		label: "adb",
		source: "runtime",
		doctorId: null,
		targets: ["mobile"],
		purposeKey: "tab.tools.purpose.adb",
	},
	{
		id: "apktool",
		label: "apktool",
		source: "runtime",
		doctorId: null,
		targets: ["mobile"],
		purposeKey: "tab.tools.purpose.apktool",
	},
	{
		id: "jeb",
		label: "JEB",
		source: "runtime",
		doctorId: null,
		targets: ["mobile"],
		purposeKey: "tab.tools.purpose.jeb",
	},
	{
		id: "binwalk",
		label: "binwalk",
		source: "runtime",
		doctorId: null,
		targets: ["firmware"],
		purposeKey: "tab.tools.purpose.binwalk",
	},
	{
		id: "unblob",
		label: "unblob",
		source: "runtime",
		doctorId: null,
		targets: ["firmware"],
		purposeKey: "tab.tools.purpose.unblob",
	},
	{
		id: "tshark",
		label: "tshark",
		source: "runtime",
		doctorId: null,
		targets: ["firmware"],
		purposeKey: "tab.tools.purpose.tshark",
	},
	{
		id: "capinfos",
		label: "capinfos",
		source: "runtime",
		doctorId: null,
		targets: ["firmware"],
		purposeKey: "tab.tools.purpose.capinfos",
	},
	{
		id: "sigrok",
		label: "sigrok-cli",
		source: "runtime",
		doctorId: null,
		targets: ["firmware"],
		purposeKey: "tab.tools.purpose.sigrok",
	},
	{
		id: "gdb",
		label: "gdb",
		source: "runtime",
		doctorId: null,
		targets: ["native"],
		purposeKey: "tab.tools.purpose.gdb",
	},
	{
		id: "pwndbg",
		label: "pwndbg",
		source: "runtime",
		doctorId: null,
		targets: ["native"],
		purposeKey: "tab.tools.purpose.pwndbg",
	},
	{
		id: "pwntools",
		label: "pwntools",
		source: "runtime",
		doctorId: null,
		targets: ["native"],
		purposeKey: "tab.tools.purpose.pwntools",
	},
	{
		id: "rizin",
		label: "rizin",
		source: "runtime",
		doctorId: null,
		targets: ["native"],
		purposeKey: "tab.tools.purpose.rizin",
	},
	{
		id: "objdump",
		label: "objdump",
		source: "runtime",
		doctorId: null,
		targets: ["native"],
		purposeKey: "tab.tools.purpose.objdump",
	},
	{
		id: "cutter",
		label: "cutter",
		source: "runtime",
		doctorId: null,
		targets: ["native"],
		purposeKey: "tab.tools.purpose.cutter",
	},
	{
		id: "wabt",
		label: "WABT",
		source: "runtime",
		doctorId: null,
		targets: ["native"],
		purposeKey: "tab.tools.purpose.wabt",
	},
	{
		id: "mitmdump",
		label: "mitmdump",
		source: "runtime",
		doctorId: null,
		targets: ["web"],
		purposeKey: "tab.tools.purpose.mitmdump",
	},
	{
		id: "browser",
		label: "Chrome",
		source: "runtime",
		doctorId: null,
		targets: ["web"],
		purposeKey: "tab.tools.purpose.browser",
	},
] as const;

/**
 * 工具名 → 运行时依赖 id。用于两件事：
 *   1. 把「这条真实调用属于哪个工具」落到清单上（会话证据）；
 *   2. 会话正在跑的时候，同一条规则也能算出「哪个工具正在运行」。
 */
const RUNTIME_TOOL_RULES: readonly { readonly test: RegExp; readonly id: string }[] = [
	{ test: /frida/, id: "frida" },
	{ test: /(^|_)adb_|^list_adb|^inspect_adb|^install_adb|^pull_adb|^push_adb|^read_adb|^search_android|^trace_android/, id: "adb" },
	{ test: /apktool|android_package|android_resources/, id: "apktool" },
	{ test: /jeb/, id: "jeb" },
	{ test: /firmware|binwalk/, id: "binwalk" },
	{ test: /pcap/, id: "tshark" },
	{ test: /signal/, id: "sigrok" },
	{ test: /wasm/, id: "wabt" },
	{ test: /inspect_binary_layout|inspect_recorded_crash/, id: "pwntools" },
	{ test: /^web_|webmcp|browser|_web_/, id: "browser" },
	{ test: /gdb/, id: "gdb" },
	{ test: /rizin/, id: "rizin" },
	{ test: /objdump/, id: "objdump" },
	{ test: /cutter/, id: "cutter" },
];

export interface SessionToolEvidence {
	readonly calls: number;
	readonly errors: number;
}

/**
 * 本次会话对某个运行时依赖的真实证据：成功过几次、失败过几次。
 * 没有任何调用时返回 null —— 不猜「已安装」。
 */
export function runtimeEvidence(requirementId: string, calls: readonly ReaLiveCall[]): SessionToolEvidence | null {
	const rule = RUNTIME_TOOL_RULES.find((candidate) => candidate.id === requirementId);
	if (!rule) return null;
	let total = 0;
	let errors = 0;
	for (const call of calls) {
		if (!rule.test.test(normalizeToolName(call.rawToolName))) continue;
		total += 1;
		if (call.isError === true) errors += 1;
	}
	return total === 0 ? null : { calls: total, errors };
}

/**
 * 这个目标类型的完整工具清单。顺序按 TOOL_REQUIREMENTS 固定，不随会话变化，
 * 保证面板不会因为多了一次调用就重排。
 */
export function requiredTools(target: TargetKind | null): readonly ToolRequirement[] {
	return TOOL_REQUIREMENTS.filter((requirement) => {
		if (requirement.targets.length === 0) return true;
		return target !== null && requirement.targets.includes(target);
	});
}

/** 正在运行的工具名 → 清单里的 id。用于把「运行中」高亮到对应的工具行。 */
export function runningRequirementIds(toolNames: readonly string[]): ReadonlySet<string> {
	const ids = new Set<string>();
	for (const raw of toolNames) {
		const name = normalizeToolName(raw);
		for (const rule of RUNTIME_TOOL_RULES) {
			if (rule.test.test(name)) ids.add(rule.id);
		}
	}
	return ids;
}

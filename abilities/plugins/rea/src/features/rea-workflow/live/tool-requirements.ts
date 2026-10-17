/**
 * 「这次逆向需要哪些外部工具」的推导表。
 *
 * 两类来源，必须分开表达，不能混成一句「推荐工具栈」：
 *
 *   doctor     `rea doctor --json` 能直接证明的工具（node / host / hopper / ghidra /
 *              ida / jadx / ilspycmd）。检查项命名规则见上游 DoctorDiagnostics.ts：
 *              `<provider>` 或 `<provider>-<check>`。
 *   runtime    doctor 观测不到的运行时依赖（frida / adb / apktool / binwalk / gdb…）。
 *              只能靠本次会话里这些工具的真实调用结果判断：调用成功过 ⇒ 可用。
 *
 * 目标类型决定基础需求；宿主对话里实际调用过的工具再把运行时依赖补进来——
 * 这正是「按会话选工具」的可证实部分，其余不猜。
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
	/** REA CLI 里能无人值守安装它时给出的参数（不含包名前缀）。 */
	readonly autoInstallArgs?: readonly string[];
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
		autoInstallArgs: ["setup", "--yes", "--installHopper"],
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
		id: "binwalk",
		label: "binwalk",
		source: "runtime",
		doctorId: null,
		targets: ["firmware"],
		purposeKey: "tab.tools.purpose.binwalk",
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
		id: "jeb",
		label: "JEB",
		source: "runtime",
		doctorId: null,
		targets: ["mobile"],
		purposeKey: "tab.tools.purpose.jeb",
	},
] as const;

/** 工具名 → 运行时依赖 id。用于从真实调用里补出「这次用了什么」。 */
const RUNTIME_TOOL_RULES: readonly { readonly test: RegExp; readonly id: string }[] = [
	{ test: /frida/, id: "frida" },
	{ test: /(^|_)adb_|^list_adb|^inspect_adb|^install_adb|^pull_adb|^push_adb|^read_adb|^search_android|^trace_android/, id: "adb" },
	{ test: /apktool|android_package|android_resources/, id: "apktool" },
	{ test: /jeb/, id: "jeb" },
	{ test: /firmware|binwalk/, id: "binwalk" },
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
 * 推导本次需要的工具：目标类型的基础需求 + 会话中真实出现过的运行时依赖。
 * 顺序稳定（先 doctor 类，再 runtime 类），保证 UI 不因重渲染抖动。
 */
export function requiredTools(target: TargetKind | null, calls: readonly ReaLiveCall[]): readonly ToolRequirement[] {
	const used = new Set<string>();
	for (const call of calls) {
		const name = normalizeToolName(call.rawToolName);
		for (const rule of RUNTIME_TOOL_RULES) {
			if (rule.test.test(name)) used.add(rule.id);
		}
	}
	return TOOL_REQUIREMENTS.filter((requirement) => {
		if (requirement.targets.length === 0) return true;
		if (requirement.source === "runtime") return used.has(requirement.id);
		return target !== null && requirement.targets.includes(target);
	});
}

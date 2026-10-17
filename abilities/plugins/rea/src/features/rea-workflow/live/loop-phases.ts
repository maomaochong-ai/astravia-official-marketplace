/**
 * 执行环 —— 逆向工作在制品上真实推进到的六个环节。
 *
 * 这是与 `tool-taxonomy.ts` 六阶段**不同的坐标轴**，两者都由真实调用推导：
 *   - 阶段（connect / route / summary / plan / read / finish）描述 Agent 的操作纪律；
 *   - 执行环（binary → analyze → spec → rebuild → oracle，失败落到 retry）描述取证进度。
 *
 * 界面只表达可证实的事实：没有观测到的环节就是「未观测」，不给它编一个进度；
 * 百分比按「已观测环节 / 总环节」计算，代表覆盖度而不是耗时估算。
 */

import type { ReaLiveCall } from "./session-store";
import { isKnownReaTool, normalizeToolName } from "./tool-taxonomy";

export type ReaLoopPhaseId = "binary" | "analyze" | "spec" | "rebuild" | "oracle" | "retry";

export const LOOP_PHASE_ORDER: readonly ReaLoopPhaseId[] = [
	"binary",
	"analyze",
	"spec",
	"rebuild",
	"oracle",
	"retry",
];

/**
 * binary：拿到制品本体或接上运行面 —— 打开、识别、枚举目标。
 * 判定只看「把工具推进到能读字节」这一层，不包含任何解读。
 */
const BINARY_TOOLS: ReadonlySet<string> = new Set([
	"open_binary",
	"close_binary",
	"binary_session",
	"get_navigation_context",
	"identify_flutter_build",
	"inspect_artifact",
	"inspect_binary_layout",
	"inspect_managed_artifact",
	"inspect_android_package",
	"inspect_dart_aot",
	"inspect_firmware_regions",
	"inspect_macho",
	"inspect_pe_resources",
	"inspect_keyed_archive",
	"inspect_asset_catalog",
	"inspect_plist",
	"inspect_signature",
	"inspect_pcap_client",
	"inspect_apktool_client",
	"inspect_jeb_client",
	"inspect_adb_client",
	"list_architectures",
	"list_segments",
	"list_cutter_sessions",
	"list_jeb_units",
]);

const BINARY_PATTERNS: readonly RegExp[] = [
	/^(start|resume|load|unload|close)_(frida|gdb|rizin|cutter)/,
	/^list_(browser_targets|electron_targets|javascript_runtime_targets|adb_devices|adb_packages|frida_devices|frida_processes)$/,
];

/** spec：把结论写成可交付物 —— 重建义务清单、未决项、证据包。 */
const SPEC_TOOLS: ReadonlySet<string> = new Set([
	"build_reconstruction_obligation_ledger",
	"record_unknown",
	"update_unknown",
	"list_unknowns",
	"export_evidence_bundle",
	"get_evidence_bundle",
	"import_evidence_bundle",
]);

/** rebuild：重建蓝图与重建结果导入。 */
const REBUILD_TOOLS: ReadonlySet<string> = new Set(["import_managed_reconstruction"]);

const REBUILD_PATTERNS: readonly RegExp[] = [/^project_.*_application_graph$/];

/** oracle：拿重建结果和原制品对账。 */
const ORACLE_TOOLS: ReadonlySet<string> = new Set([
	"verify_reconstruction",
	"verify_managed_native_boundaries",
	"verify_unknown_resolution",
	"evaluate_reconstruction_coverage",
	"inspect_managed_members",
	"inspect_managed_native_boundaries",
	"correlate_static_and_runtime",
	"find_changed_behavior",
]);

const ORACLE_PATTERNS: readonly RegExp[] = [/^compare_/];

/** retry：源码/运行时恢复类工具；失败调用同样点亮这一环节。 */
const RETRY_TOOLS: ReadonlySet<string> = new Set([
	"recover_javascript_sources",
	"reconcile_javascript_runtime",
]);

function matchesAny(name: string, patterns: readonly RegExp[]): boolean {
	return patterns.some((pattern) => pattern.test(name));
}

/**
 * 分类归属。返回 `null` 表示这次调用不属于 REA 执行环（例如别的 MCP 工具），
 * 界面把它算进总调用数但不点亮任何环节。
 */
export function loopPhaseForTool(rawToolName: string): ReaLoopPhaseId | null {
	const name = normalizeToolName(rawToolName);
	if (RETRY_TOOLS.has(name)) return "retry";
	if (BINARY_TOOLS.has(name) || matchesAny(name, BINARY_PATTERNS)) return "binary";
	if (SPEC_TOOLS.has(name)) return "spec";
	if (REBUILD_TOOLS.has(name) || matchesAny(name, REBUILD_PATTERNS)) return "rebuild";
	if (ORACLE_TOOLS.has(name) || matchesAny(name, ORACLE_PATTERNS)) return "oracle";
	// 其余已知 REA 工具都是读字节/反编译/追踪，归入 analyze。
	return isKnownReaTool(name) ? "analyze" : null;
}

export interface LoopPhaseLive {
	readonly id: ReaLoopPhaseId;
	readonly calls: number;
	/** 该环节里失败过的调用数；retry 环节这一列统计全会话失败数。 */
	readonly errors: number;
	readonly running: number;
	readonly lastTool: string | null;
	readonly lastArgs: string;
	readonly observed: boolean;
}

export interface ReaLoopStep {
	/** 这是本次会话的第几次 REA 调用（从 1 开始）。 */
	readonly ordinal: number;
	readonly toolName: string;
	readonly argsPreview: string;
	readonly phase: ReaLoopPhaseId | null;
	readonly status: "running" | "ok" | "failed";
	readonly durationMs: number | null;
}

export interface ReaLoopLive {
	readonly phases: readonly LoopPhaseLive[];
	/** 参与覆盖度计算的环节（不含 retry —— 失败不算进度）。 */
	readonly progressPhases: readonly LoopPhaseLive[];
	readonly observedPhases: number;
	readonly passPercent: number;
	readonly step: ReaLoopStep | null;
	readonly activePhase: ReaLoopPhaseId | null;
	readonly totalErrors: number;
}

interface PhaseTally {
	calls: number;
	errors: number;
	running: number;
	lastTool: string | null;
	lastArgs: string;
}

function emptyTally(): PhaseTally {
	return { calls: 0, errors: 0, running: 0, lastTool: null, lastArgs: "" };
}

function stepOf(call: ReaLiveCall, ordinal: number): ReaLoopStep {
	const running = call.endedAt === null;
	return {
		ordinal,
		toolName: call.toolName,
		argsPreview: call.argsPreview,
		phase: loopPhaseForTool(call.rawToolName),
		status: running ? "running" : call.isError === true ? "failed" : "ok",
		durationMs: call.endedAt === null ? null : Math.max(0, call.endedAt - call.startedAt),
	};
}

/**
 * `calls` 是被截断的尾部窗口（上限 80），`callCount` 是会话内的真实总数，
 * 两者相减才能得到「第几次调用」这种稳定序号。
 */
function ordinalAt(index: number, calls: readonly ReaLiveCall[], callCount: number): number {
	return Math.max(1, callCount - (calls.length - 1 - index));
}

export function buildLoopLive(calls: readonly ReaLiveCall[], callCount: number): ReaLoopLive {
	const tallies: Record<ReaLoopPhaseId, PhaseTally> = {
		binary: emptyTally(),
		analyze: emptyTally(),
		spec: emptyTally(),
		rebuild: emptyTally(),
		oracle: emptyTally(),
		retry: emptyTally(),
	};

	let totalErrors = 0;
	calls.forEach((call) => {
		const failed = call.isError === true;
		if (failed) totalErrors += 1;
		const phase = loopPhaseForTool(call.rawToolName);
		if (phase === null) return;
		const tally = tallies[phase];
		tally.calls += 1;
		if (failed) tally.errors += 1;
		if (call.endedAt === null) tally.running += 1;
		tally.lastTool = call.toolName;
		tally.lastArgs = call.argsPreview;
	});

	// retry 不是独立工具族：它由失败调用点亮，所以要单独记一次失败总数。
	tallies.retry.errors = totalErrors;

	const phases: readonly LoopPhaseLive[] = LOOP_PHASE_ORDER.map((id) => {
		const tally = tallies[id];
		const observed = id === "retry" ? tally.calls > 0 || totalErrors > 0 : tally.calls > 0;
		return {
			id,
			calls: tally.calls,
			errors: tally.errors,
			running: tally.running,
			lastTool: tally.lastTool,
			lastArgs: tally.lastArgs,
			observed,
		};
	});

	// retry 是回退环节，不是推进环节：失败照旧高亮，但不计入 pass。
	const progressPhases = phases.filter((phase) => phase.id !== "retry");
	const observedPhases = progressPhases.filter((phase) => phase.observed).length;

	// 当前步骤：优先「正在跑」的那次，否则就停在最后一次调用上（和终端里最后一行一致）。
	let targetIndex = -1;
	for (let index = calls.length - 1; index >= 0; index -= 1) {
		if (calls[index].endedAt === null) {
			targetIndex = index;
			break;
		}
	}
	if (targetIndex < 0 && calls.length > 0) targetIndex = calls.length - 1;
	const step =
		targetIndex >= 0 ? stepOf(calls[targetIndex], ordinalAt(targetIndex, calls, callCount)) : null;

	return {
		phases,
		progressPhases,
		observedPhases,
		passPercent: Math.round((observedPhases / progressPhases.length) * 100),
		step,
		activePhase: step?.phase ?? null,
		totalErrors,
	};
}

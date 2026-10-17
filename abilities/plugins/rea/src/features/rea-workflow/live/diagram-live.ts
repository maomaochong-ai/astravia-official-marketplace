/**
 * 流程图节点 ↔ 真实会话活动。
 *
 * 示意图本身是固定文案，但每个节点可以声明一个「绑定」，说明它的状态该从哪条真实信号读：
 *
 *   stage      该阶段真实跑过的工具调用（connect 的会话类工具、finish 的证据类工具…）
 *   tools      指定工具名的调用（ledger、证据包、未知项…）
 *   targets    某个目标类型上的调用（route 的四个入口桶）
 *   milestone  后续阶段已经开跑 ⇒ 这个无法直接观测的检查点视为已越过（summary 没有专属工具）
 *   total      整个会话的调用总量（summary 的「原始发现」来自多次调用）
 *
 * 没有绑定的节点是纯参考内容，永远保持 idle —— 不编造进度。
 * 状态优先级：active > failed > hit > idle；running 优先于历史调用。
 */

import type { TargetKind } from "../data/targets";
import type { ReaLiveCall } from "./session-store";
import { classifyTool, STAGE_ORDER, stageIdForIndex, type ReaStageId } from "./tool-taxonomy";

export type DiagramNodeState = "idle" | "active" | "hit" | "failed";

export interface DiagramNodeLive {
	readonly state: DiagramNodeState;
	/** 命中的真实调用次数。 */
	readonly count: number;
	readonly errors: number;
	/** 命中过的工具名，最近的在前（最多 3 个）。 */
	readonly tools: readonly string[];
	/** 此刻正在运行的工具名。 */
	readonly running: readonly string[];
}

export const IDLE_NODE_LIVE: DiagramNodeLive = {
	state: "idle",
	count: 0,
	errors: 0,
	tools: [],
	running: [],
};

export type DiagramBinding =
	| { readonly kind: "stage"; readonly stage: ReaStageId }
	| { readonly kind: "tools"; readonly tools: readonly string[] }
	| { readonly kind: "targets"; readonly targets: readonly TargetKind[] }
	| { readonly kind: "milestone"; readonly after: readonly ReaStageId[] }
	| { readonly kind: "total" }
	/** 任一子绑定命中就算命中：同一个节点可以有多个可观测来源。 */
	| { readonly kind: "any"; readonly of: readonly DiagramBinding[] };

function matchesCall(binding: DiagramBinding, call: ReaLiveCall): boolean {
	switch (binding.kind) {
		case "stage":
			return call.stage === binding.stage;
		case "tools":
			return binding.tools.includes(call.toolName);
		case "targets":
			return call.targets.some((target) => binding.targets.includes(target));
		case "any":
			return binding.of.some((child) => matchesCall(child, call));
		default:
			return false;
	}
}

function matchesRunning(binding: DiagramBinding, toolName: string): boolean {
	switch (binding.kind) {
		case "stage":
			return classifyTool(toolName).stage === binding.stage;
		case "tools":
			return binding.tools.includes(toolName);
		case "targets": {
			const classification = classifyTool(toolName);
			return classification.targets.some((target) => binding.targets.includes(target));
		}
		case "any":
			return binding.of.some((child) => matchesRunning(child, toolName));
		default:
			return false;
	}
}

/** 把绑定解析成节点状态；未绑定返回 idle。 */
export function resolveNodeLive(
	binding: DiagramBinding | undefined,
	calls: readonly ReaLiveCall[],
	running: readonly string[],
): DiagramNodeLive {
	if (!binding) return IDLE_NODE_LIVE;

	if (binding.kind === "milestone") {
		const reached = binding.after.some((stage) => calls.some((call) => call.stage === stage));
		return reached ? { ...IDLE_NODE_LIVE, state: "hit" } : IDLE_NODE_LIVE;
	}

	if (binding.kind === "total") {
		return calls.length > 0 ? { ...IDLE_NODE_LIVE, state: "hit", count: calls.length } : IDLE_NODE_LIVE;
	}

	const matched = calls.filter((call) => matchesCall(binding, call));
	if (matched.length === 0 && running.length === 0) return IDLE_NODE_LIVE;

	const activeTools = running.filter((toolName) => matchesRunning(binding, toolName));
	const errors = matched.filter((call) => call.isError === true).length;
	const recent: string[] = [];
	for (let i = matched.length - 1; i >= 0 && recent.length < 3; i -= 1) {
		const name = matched[i]?.toolName;
		if (name && !recent.includes(name)) recent.push(name);
	}
	const state: DiagramNodeState =
		activeTools.length > 0 ? "active" : errors > 0 ? "failed" : matched.length > 0 ? "hit" : "idle";
	return { state, count: matched.length, errors, tools: recent, running: activeTools };
}

export interface StageLiveDigest {
	readonly index: number;
	readonly stage: ReaStageId;
	readonly state: "idle" | "active" | "done";
	readonly calls: number;
	readonly errors: number;
	readonly running: readonly string[];
	readonly lastTool: string | null;
	readonly lastArgs: string | null;
}

/**
 * 当前阶段的真实活动摘要，供阶段标题胶囊与流程图标题行使用。
 *
 * summary 阶段没有专属工具，所以「后续阶段已经开跑」也视作它已完成，
 * 否则摘要阶段会永远显示未开始。
 */
export function buildStageDigest(
	index: number,
	calls: readonly ReaLiveCall[],
	running: readonly string[],
): StageLiveDigest {
	const stage = stageIdForIndex(index) ?? "connect";
	const mine = calls.filter((call) => call.stage === stage);
	const activeTools = running.filter((toolName) => classifyTool(toolName).stage === stage);
	const last = mine.length > 0 ? (mine[mine.length - 1] ?? null) : null;
	const passed =
		stage === "summary" &&
		calls.some((call) => call.stage === "plan" || call.stage === "read" || call.stage === "finish");
	const state = activeTools.length > 0 ? "active" : mine.length > 0 || passed ? "done" : "idle";
	return {
		index,
		stage,
		state,
		calls: mine.length,
		errors: mine.filter((call) => call.isError === true).length,
		running: activeTools,
		lastTool: last?.toolName ?? null,
		lastArgs: last?.argsPreview ?? null,
	};
}

export type DiagramEdgeState = "idle" | "flowing" | "done";

/**
 * 连接符状态：箭头指向的节点正在跑 ⇒ 光点下流；两端都已命中 ⇒ 实线；
 * 上游已命中而下游还没动 ⇒ 也下流，表示流程刚推进到这条边。
 */
export function resolveEdgeState(before: DiagramNodeLive, after: DiagramNodeLive): DiagramEdgeState {
	if (after.state === "active") return "flowing";
	if (before.state === "hit" && after.state === "hit") return "done";
	if (before.state === "hit") return "flowing";
	return "idle";
}

/**
 * 本次会话被「越过」的阶段：阶段自身没有调用记录，但下游阶段已经有真实调用。
 *
 * 典型是 summary（没有专属工具），以及 Agent 跳步：open_binary 之后直接读与收尾，
 * 中间 route/plan 没留下调用。流程条要把这种情况画成「已越过」而不是「没开始」，
 * 否则界面看起来就像流程卡住了。
 */
export function bypassedStageIds(calls: readonly ReaLiveCall[]): readonly ReaStageId[] {
	const touched = new Set(calls.map((call) => call.stage));
	let lastIndex = -1;
	for (let i = 0; i < STAGE_ORDER.length; i += 1) {
		const stage = STAGE_ORDER[i];
		if (stage !== undefined && touched.has(stage)) lastIndex = i;
	}
	if (lastIndex <= 0) return [];
	return STAGE_ORDER.filter((stage, index) => index < lastIndex && !touched.has(stage));
}

/** 传给阶段详情与示意图的一份实时数据：调用列表、正在运行的工具、阶段摘要。 */
export interface StageLiveSource {
	readonly calls: readonly ReaLiveCall[];
	readonly running: readonly string[];
	readonly digest: StageLiveDigest;
}

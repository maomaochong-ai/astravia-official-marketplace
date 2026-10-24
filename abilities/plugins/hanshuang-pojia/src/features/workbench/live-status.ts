import type { TriageReport } from "../../domain/report/report";
import type { ChatState, TaskStreamEntry } from "./state";

/** 侧栏一个状态点的语气：live = 正在发生，alert = 需要看一眼，idle = 无事。 */
export type LiveTone = "live" | "alert" | "idle";

export interface SessionStatus {
	tone: LiveTone;
	/** 对话是否正在流式输出。 */
	streaming: boolean;
	/** 宿主报的当前插件工具名，null 表示对话没在动插件。 */
	tool: string | null;
	/** 没有接上会话（面板独立打开时）。 */
	disconnected: boolean;
}

export interface RunStatus {
	tone: LiveTone;
	/** 还有未结束的 turn / 工具调用。 */
	active: boolean;
	/** 本轮已发生的工具调用次数。 */
	tools: number;
	/** 本轮最近一次被调用的工具名。 */
	lastTool: string | null;
	/** 本轮出现过工具错误。 */
	failed: boolean;
}

export interface SampleStatus {
	tone: LiveTone;
	name: string;
	score: number;
	grade: string;
}

export interface InjectStatus {
	tone: LiveTone;
	/** 当前激活的提示词名；null = 没有激活。 */
	name: string | null;
}

export interface LiveStatus {
	session: SessionStatus;
	run: RunStatus;
	sample: SampleStatus | null;
	inject: InjectStatus;
}

/**
 * 本轮的工具调用：entries 是最新在前的环形流，所以从头部往前数到 turn 边界为止。
 * 只统计「已经开始」的调用——tool-end 单独出现（例如重放半截）不算一次。
 */
export function countTurnTools(entries: readonly TaskStreamEntry[]): Omit<RunStatus, "tone" | "active"> {
	let tools = 0;
	let lastTool: string | null = null;
	let failed = false;
	for (const entry of entries) {
		if (entry.phase === "turn-end" || entry.phase === "turn-start") break;
		if (entry.phase === "tool-start") {
			tools += 1;
			lastTool ??= entry.toolName ?? null;
		} else if (entry.phase === "tool-end") {
			lastTool ??= entry.toolName ?? null;
			if (entry.isError) failed = true;
		}
	}
	return { tools, lastTool, failed };
}

/** 等级 A/B 视作无事，C 视作「有东西要看」，D/E 是需要立刻解释的风险。 */
function sampleTone(grade: string): LiveTone {
	if (grade === "D" || grade === "E") return "alert";
	if (grade === "C") return "live";
	return "idle";
}

export interface LiveStatusInput {
	chat: ChatState;
	stream: { entries: readonly TaskStreamEntry[]; active: boolean };
	report: TriageReport | null;
	activePrompt: { name: string } | null;
}

/**
 * 把四个来源（对话状态、任务流、当前报告、激活的提示词）压成侧栏要的那几行。
 * 纯函数：组件只负责画，判断都在这里，方便直接断言。
 */
export function deriveLiveStatus(input: LiveStatusInput): LiveStatus {
	const { chat, stream, report, activePrompt } = input;
	const disconnected = chat.status === "disconnected";
	const streaming = chat.status === "streaming";
	const turn = countTurnTools(stream.entries);

	return {
		session: {
			tone: disconnected ? "alert" : streaming ? "live" : "idle",
			streaming,
			tool: chat.tool,
			disconnected,
		},
		run: {
			...turn,
			active: stream.active,
			tone: turn.failed ? "alert" : stream.active || turn.tools > 0 ? "live" : "idle",
		},
		sample: report
			? {
					tone: sampleTone(report.risk.grade),
					name: report.target.name,
					score: report.risk.score,
					grade: report.risk.grade,
				}
			: null,
		inject: { tone: activePrompt ? "live" : "idle", name: activePrompt?.name ?? null },
	};
}

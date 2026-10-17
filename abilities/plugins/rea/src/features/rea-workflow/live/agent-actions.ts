/**
 * 阶段详情里「Agent 侧动作」这一段的派生数据。
 *
 * 两件事：
 * 1. 选定了目标类型时，把该类型的入口工具提到最前面 —— 不同目标的第一把刀不一样
 *    （JS 走 analyze_javascript_application，固件走 inspect_firmware_regions），
 *    这是上游 SKILL.md「Route the target first」的实际内容。
 * 2. 每个工具标上本会话内真实被调用的次数 / 失败数：面板只报告发生过的事，
 *    0 次就写「未调用」，不猜它「应该已经跑过」。
 */

import type { ReaLiveCall } from "./session-store";

export type AgentActionState = "idle" | "active" | "hit" | "failed";

export interface AgentAction {
	readonly name: string;
	/** 本会话内这个工具被调起的次数（含失败）。 */
	readonly calls: number;
	readonly errors: number;
	readonly running: boolean;
	/** 是否是该目标类型的首选入口工具。 */
	readonly entry: boolean;
	readonly state: AgentActionState;
}

interface ActionOptions {
	/** 当前选定 / 识别出的目标类型入口工具；null 表示还没定类型。 */
	readonly entryTool: string | null;
	readonly calls: readonly ReaLiveCall[];
	readonly running: readonly string[];
}

/**
 * @param toolNames 阶段声明的工具清单（data/stages.ts，静态合同）
 * @returns 入口工具在前，其余保持声明顺序；不重复、不丢项
 */
export function agentActionsFor(toolNames: readonly string[], options: ActionOptions): readonly AgentAction[] {
	const { entryTool, calls, running } = options;
	const ordered: string[] = [];
	if (entryTool !== null) ordered.push(entryTool);
	for (const name of toolNames) {
		if (!ordered.includes(name)) ordered.push(name);
	}
	return ordered.map((name) => {
		const own = calls.filter((call) => call.toolName === name);
		const errors = own.filter((call) => call.isError === true).length;
		const isRunning = running.includes(name);
		const state: AgentActionState = isRunning ? "active" : errors > 0 ? "failed" : own.length > 0 ? "hit" : "idle";
		return { name, calls: own.length, errors, running: isRunning, entry: name === entryTool, state };
	});
}

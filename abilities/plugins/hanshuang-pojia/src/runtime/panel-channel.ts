import type { TriageReport } from "../domain/report/report";

/**
 * Agent → 面板的回程通道。
 *
 * 工具 handler 与活动面板跑在同一个插件运行时里（都在渲染进程，ctx 由宿主
 * 通过 plugin-agent-context 注入），所以一个模块级订阅表就够把「对话里刚跑完
 * 的分析」推回面板。但订阅表只在面板挂载期间存在 —— 用户正在对话页看着 Agent
 * 分析时，插件 tab 往往是**没挂载**的，事件会直接丢掉，切回来只看到空库。
 *
 * 所以每个事件同时压进一个容量固定的队列：面板挂载时先把积压的事件重放一遍，
 * 再开始接新的。这是「双向交互」里最容易漏掉的一环。
 */

export interface PanelReportEvent {
	type: "report";
	report: TriageReport;
	/** 触发来源，面板据此显示「来自对话」的标记。 */
	source: "agent";
}

export type PanelEvent = PanelReportEvent | PanelToolResultEvent | PanelTaskEvent;

/**
 * 任意 Agent 工具跑出的结构化结果。
 *
 * 工具 handler 在当前插件运行时里，结果既要回聊天、也要能到面板，所以每个工具在返回
 * markdown 之前先 publish 一步结构化摘要。面板的 Activity 页订阅它，
 * 让用户在对话里跑 strings / disasm / diff / checklist 等几十个工具时，结果一呼入手。
 */
export interface PanelToolResultEvent {
	type: "tool-result";
	/** 工具 id，如 `scan_strings` / `run_radare`。 */
	toolId: string;
	/** 结果种类，面板据此分组、选图标。`report` 复用 triage 报告语义。 */
	kind:
		| "report"
		| "strings"
		| "symbols"
		| "disasm"
		| "decompile"
		| "diff"
		| "signature"
		| "checklist"
		| "probe"
		| "docs"
		| "hook"
		| "other";
	/** 目标样本 / 主题，供面板显示与去重。 */
	target?: string;
	/** 一行可读摘要，不带 markdown。 */
	summary: string;
	/** 结构化载荷（随各工具而异），面板可按 kind 决定怎么渲染。 */
	payload?: Record<string, unknown>;
	/** 来源，目前恒为 agent。 */
	source: "agent";
	/** 结果触发时间（ISO）。缺省由面板在收到时补。 */
	timestamp?: string;
}

/** 任务实时流里的宿主方向事件（会话 / turn / 工具调用生命周期）。 */
export interface PanelTaskEvent {
	type: "task";
	/** 事件阶段，面板据此给出「正在跑 / 刚完成 / 报错」等实时状态。 */
	phase:
		| "conversation"
		| "turn-start"
		| "turn-end"
		| "tool-start"
		| "tool-end";
	/** 触发事件的会话 / 任务标签：给我个线程粒度，面板才能把一串事件排成流。 */
	sessionId: string | null;
	/** 关联的工具名（tool-start / tool-end 才需要）。 */
	toolName?: string;
	/** tool-end 失败标记。 */
	isError?: boolean;
	/** 会话当前是否在流式输出。 */
	streaming?: boolean;
	/** 当前工作目录。 */
	cwd?: string | null;
	/** 事件触发时间（ISO）。缺省由面板在收到时补。 */
	timestamp?: string;
}

type Listener = (event: PanelEvent) => void;

const listeners = new Set<Listener>();

/** 最多积压多少条；样本库本来就只留最近 40 条，这里不需要无限增长。 */
const MAX_BACKLOG = 40;
/** 工具把一个结果推回面板：多了“结果可复核”这一层，不取代聊天里的 markdown。 */
export function publishToolResult(event: Omit<PanelToolResultEvent, "type" | "source">): void {
	publishPanelEvent({
		type: "tool-result",
		source: "agent",
		timestamp: event.timestamp ?? new Date().toISOString(),
		...event,
	} satisfies PanelToolResultEvent);
}

/** 宿主方向的任务生命周期事件：会话 / turn / 工具调用，供面板做实时流。 */
export function publishTaskEvent(event: Omit<PanelTaskEvent, "type">): void {
	publishPanelEvent({
		type: "task",
		timestamp: event.timestamp ?? new Date().toISOString(),
		...event,
	} satisfies PanelTaskEvent);
}

const backlog: PanelEvent[] = [];

/** 工具里调用；没有面板在听时事件进积压队列，等面板挂载后重放。 */
export function publishPanelEvent(event: PanelEvent): void {
	backlog.push(event);
	if (backlog.length > MAX_BACKLOG) backlog.splice(0, backlog.length - MAX_BACKLOG);

	for (const listener of listeners) {
		try {
			listener(event);
		} catch (error) {
			console.error("[hanshuang-pojia] panel listener failed", error);
		}
	}
}

/**
 * 面板挂载时订阅。`replay: true`（默认）会先把积压事件全部投一遍，
 * 订阅者应当在拿到第一个事件时就进入「可接收」状态，避免重放期间再丢。
 */
export function subscribePanel(listener: Listener, options: { replay?: boolean } = {}): () => void {
	if (options.replay !== false) {
		for (const event of backlog.splice(0, backlog.length)) {
			try {
				listener(event);
			} catch (error) {
				console.error("[hanshuang-pojia] panel replay failed", error);
			}
		}
	}
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** 清空积压（用户主动关掉「来自对话」的提示后调用）。 */
export function clearPanelBacklog(): void {
	backlog.length = 0;
}

/**
 * 面板当前页。系统提示块用它补一行「用户在看哪一页」，
 * 这比让模型猜用户在干什么要准。
 */
let agentPage: string | null = null;

export function setAgentPage(page: string): void {
	agentPage = page;
}

export function getAgentPage(): string | null {
	return agentPage;
}

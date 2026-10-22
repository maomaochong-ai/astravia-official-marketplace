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

export type PanelEvent = PanelReportEvent;

type Listener = (event: PanelEvent) => void;

const listeners = new Set<Listener>();

/** 最多积压多少条；样本库本来就只留最近 40 条，这里不需要无限增长。 */
const MAX_BACKLOG = 40;
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

import type { TriageReport } from "../domain/report/report";

/**
 * Agent → 面板的单向通道。
 *
 * 工具 handler 与活动面板跑在同一个插件运行时里（都在渲染进程，ctx 由宿主
 * 通过 plugin-agent-context 注入），所以一个模块级订阅表就足够把「对话里刚
 * 跑完的分析」推回面板。面板订阅后把报告写进样本库并切到对应页面，
 * 这就是双向交互的回程：面板 → 对话走 ctx.conversation，对话 → 面板走这里。
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

/** 工具里调用；没有面板在听时是空操作。 */
export function publishPanelEvent(event: PanelEvent): void {
	for (const listener of listeners) {
		try {
			listener(event);
		} catch (error) {
			console.error("[frostbreak] panel listener failed", error);
		}
	}
}

/** 面板挂载时订阅，卸载时调用返回的退订函数。 */
export function subscribePanel(listener: Listener): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

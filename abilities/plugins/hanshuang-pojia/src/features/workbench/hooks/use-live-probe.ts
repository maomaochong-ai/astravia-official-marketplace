import { useEffect, useMemo, useRef, useState } from "react";
import { useConversationMessages } from "@astravia-org/plugin-sdk";
import { parseLiveReport, type LiveProbeReport } from "../../../domain/refusal-probe";
import { subscribePanel } from "../../../runtime/panel-channel";

/**
 * 最新一条助手回复里附带的实时对照。
 *
 * 为什么需要它：`probe_refusal` 只在被调用时写文件。agent 用散文回答（逐档拒答情况 +
 * 措施）时文件不更新，面板就停在上一份 —— 用户看到的是「表格没有按对话更新」。
 * 扫描本身很便宜（一条字符串的 indexOf + 一次 JSON.parse），但只在消息数量变化时跑。
 */
export function useLiveProbeReport(): LiveProbeReport | null {
	const messages = useConversationMessages();
	const cache = useRef<{ length: number; report: LiveProbeReport | null }>({ length: -1, report: null });

	const length = messages.length;
	return useMemo(() => {
		if (cache.current.length === length) return cache.current.report;
		let report: LiveProbeReport | null = null;
		// 只看最后几条：实时块总是在刚结束的那一轮里。
		for (let index = messages.length - 1; index >= Math.max(0, messages.length - 6); index -= 1) {
			const message = messages[index] as { role?: string; content?: unknown };
			if (message?.role !== "assistant") continue;
			const text = typeof message.content === "string" ? message.content : "";
			report = parseLiveReport(text);
			if (report) break;
		}
		cache.current = { length, report };
		return report;
	}, [messages, length]);
}

/** 自动探测的状态：宿主的 Stop hook 派了一次梯度，面板要知道是谁在测。 */
export interface AutoProbeStatus {
	targetClass: string;
	rungs: number;
	at: string;
}

/**
 * 实时对照 + 自动探测状态。
 *
 * 订阅的是 `refusal` 事件（`runtime/panel-channel.ts`）：它不带正文，只说「这一轮为什么停、
 * 是否已自动派梯度」。收到就更新状态条；状态条上的刷新按钮负责把工具刚写完的记录读进来。
 */
export function useAutoProbeStatus(): { live: LiveProbeReport | null; autoProbe: AutoProbeStatus | null } {
	const live = useLiveProbeReport();
	const [autoProbe, setAutoProbe] = useState<AutoProbeStatus | null>(null);

	useEffect(
		() =>
			subscribePanel(event => {
				if (event.type !== "refusal") return;
				if (!event.autoProbe) {
					// 这一轮没有自动测（静默拦截 / 没有原话）：清掉旧状态条，免得挂着上一次的。
					setAutoProbe(null);
					return;
				}
				setAutoProbe({ targetClass: event.autoProbe.targetClass, rungs: event.autoProbe.rungs, at: event.at });
			}),
		[],
	);

	// 对话里出现了新的实时块，说明自动测已经回来了：状态条功成身退。
	useEffect(() => {
		if (live) setAutoProbe(null);
	}, [live]);

	return { live, autoProbe };
}

/** 只在宿主模型 id 真的变化时给一次回调，用来同步「要测谁」。 */
export function useHostModelChange(
	hostModelId: string | null,
	onChange: (next: string, previous: string | null) => void,
): void {
	const previous = useRef<string | null>(hostModelId);
	useEffect(() => {
		if (previous.current === hostModelId) return;
		const before = previous.current;
		previous.current = hostModelId;
		if (hostModelId) onChange(hostModelId, before);
	}, [hostModelId, onChange]);
}

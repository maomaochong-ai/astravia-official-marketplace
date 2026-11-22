import { useEffect, useMemo, useRef } from "react";
import { useConversationMessages } from "@astravia-org/plugin-sdk";
import { parseLiveReport, type LiveProbeReport } from "../../../domain/refusal-probe";

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

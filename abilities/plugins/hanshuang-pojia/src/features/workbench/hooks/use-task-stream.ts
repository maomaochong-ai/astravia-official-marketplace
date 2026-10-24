import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePanel, type PanelTaskEvent } from "../../../runtime/panel-channel";
import { MAX_TASKS, type TaskStreamEntry } from "../state";
import type { WorkbenchBridge } from "../bridge";

export interface TaskStreamModel {
	entries: TaskStreamEntry[];
	/** 是否还有正在跑的任务（最后一条没有 turn-end 归档）。 */
	active: boolean;
	clear(): void;
}

function label(event: PanelTaskEvent): string {
	switch (event.phase) {
		case "conversation":
			return event.streaming ? "conversation streaming" : event.sessionId ? "conversation ready" : "no active conversation";
		case "turn-start":
			return "turn started";
		case "turn-end":
			return "turn finished";
		case "tool-start":
			return `tool started: ${event.toolName ?? "?"}`;
		case "tool-end":
			return event.isError ? `tool failed: ${event.toolName ?? "?"}` : `tool finished: ${event.toolName ?? "?"}`;
	}
}

function toEntry(event: PanelTaskEvent): TaskStreamEntry {
	const at = event.timestamp ?? new Date().toISOString();
	return {
		id: `${event.phase}-${event.toolName ?? "task"}-${at}`,
		phase: event.phase,
		sessionId: event.sessionId,
		toolName: event.toolName,
		isError: event.isError,
		streaming: event.streaming,
		summary: label(event),
		at,
	};
}

/** 任务流末位“还在跑”的判定：存在未配对的 tool-start / turn-start。 */
function isActive(acc: boolean, event: PanelTaskEvent): boolean {
	if (event.phase === "turn-start") return true;
	if (event.phase === "tool-start") return true;
	if (event.phase === "turn-end") return false;
	return acc;
}

/**
 * 任务实时流：宿主方向会话来的一条「正在发生什么」。轻量、当下、可清空。
 * 与 activity 的分工：activity 收「已完成的工具结果」，stream 收「运行中的生命周期」。
 */
export function useTaskStream(bridge: WorkbenchBridge, enabled = true): TaskStreamModel {
	// 同 useActivity：参数只用于调用点表意，订阅不依赖它。
	void bridge;
	const [entries, setEntries] = useState<TaskStreamEntry[]>([]);
	const [active, setActive] = useState(false);
	const alive = useRef(true);

	// 同 useActivity：订阅只建一次，bridge 不进依赖，避免重订阅重放积压。
	useEffect(() => {
		if (!enabled) return;
		alive.current = true;
		alive.current = true;
		const stop = subscribePanel(event => {
			if (!alive.current || event.type !== "task") return;
			setEntries(current => [toEntry(event), ...current].slice(0, MAX_TASKS));
			setActive(prev => isActive(prev, event));
		});
		return () => {
			alive.current = false;
			stop();
		};
	}, [enabled]);

	const clear = useCallback(() => {
		setEntries([]);
		setActive(false);
	}, []);

	return { entries, active, clear };
}
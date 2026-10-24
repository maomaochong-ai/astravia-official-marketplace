import { useCallback, useEffect, useRef, useState } from "react";
import { subscribePanel, type PanelToolResultEvent } from "../../../runtime/panel-channel";
import { MAX_ACTIVITY, type ActivityEntry } from "../state";
import type { WorkbenchBridge } from "../bridge";

export interface ActivityModel {
	entries: ActivityEntry[];
	/** 把面板自己产生的结果也记进活动流（例如面板触发的分析）。 */
	record(entry: Omit<ActivityEntry, "id" | "at"> & { at?: string }): void;
	clear(): void;
}

/** 从回传事件建活动条目：事件字段与条目一一对应，统一补上 id / at。 */
function toEntry(event: PanelToolResultEvent): ActivityEntry {
	const at = event.timestamp ?? new Date().toISOString();
	return {
		id: `${event.toolId}-${at}`,
		toolId: event.toolId,
		kind: event.kind,
		target: event.target,
		summary: event.summary,
		payload: event.payload,
		at,
	};
}

function fromPartial(entry: Omit<ActivityEntry, "id" | "at"> & { at?: string }): ActivityEntry {
	return { ...entry, id: `${entry.toolId}-${entry.at ?? ""}`, at: entry.at ?? new Date().toISOString() };
}

/**
 * 活动流：Agent 在对话里跑通的每个工具结果都进面板。
 *
 * 事件经 panel-channel 回传（含挂载前积压的重放），所以用户先在对话页让 Agent 跑了一串
 * strings / disasm / diff，切回插件 tab 时这些结果会按顺序补进来。内存态即可——它本质是
 * 本次会话的复核轨迹，不需要跨会话持久化（样本库 / 报告已经落盘）。
 */
export function useActivity(bridge: WorkbenchBridge, enabled = true): ActivityModel {
	// 参数保留：调用点靠它表明自己绑定哪个 bridge；订阅本身不依赖它（见下方 enabled 依赖）。
	void bridge;
	const [entries, setEntries] = useState<ActivityEntry[]>([]);
	const alive = useRef(true);

	// 订阅只建一次：bridge 只用于生命周期对齐，不能当 effect 依赖——它一旦换成新对象，
	// 每次重渲染都会重新订阅并重放积压事件（React #185 的成圆路径）。
	useEffect(() => {
		if (!enabled) return;
		alive.current = true;
		const stop = subscribePanel(event => {
			if (alive.current && event.type === "tool-result") {
				setEntries(current => [toEntry(event), ...current].slice(0, MAX_ACTIVITY));
			}
		});
		return () => {
			alive.current = false;
			stop();
		};
	}, [enabled]);

	const record = useCallback((entry: Omit<ActivityEntry, "id" | "at"> & { at?: string }) => {
		setEntries(current => [fromPartial(entry), ...current].slice(0, MAX_ACTIVITY));
	}, []);

	const clear = useCallback(() => setEntries([]), []);

	return { entries, record, clear };
}
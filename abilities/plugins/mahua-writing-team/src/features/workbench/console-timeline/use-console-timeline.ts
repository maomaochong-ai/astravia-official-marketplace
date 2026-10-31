import { useSyncExternalStore } from "react";
import type { ConsoleLogEvent } from "../../../application/console-log/console-log-event.js";
import { consoleLogStore } from "../../../application/console-log/console-log-store.js";

/**
 * 订阅运行台时间线。总线的快照是不可变数组，`append` 会换引用，所以
 * `useSyncExternalStore` 只在真有新事件时重渲染——不轮询，也无需要求页面刷新。
 */
export function useConsoleTimeline(): readonly ConsoleLogEvent[] {
	return useSyncExternalStore(
		consoleLogStore.subscribe,
		consoleLogStore.getSnapshot,
		consoleLogStore.getSnapshot,
	);
}

/**
 * 清空时间线。写在 hook 文件里而不是让视图直接摸单例：
 * 视图只描述「清」这个动作，不拥有总线。
 */
export function clearConsoleTimeline(): void {
	consoleLogStore.clear();
}

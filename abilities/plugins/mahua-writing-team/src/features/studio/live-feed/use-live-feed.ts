import { useSyncExternalStore } from "react";
import { feedStore } from "../../../application/live-feed/feed-store.js";
import type { FeedEvent } from "../../../application/live-feed/feed-types.js";

/**
 * 订阅活动流。总线的快照是不可变数组，`append` 会换引用，所以
 * `useSyncExternalStore` 只在真有新事件时重渲染——不轮询，也无需要求页面刷新。
 */
export function useLiveFeed(): readonly FeedEvent[] {
	return useSyncExternalStore(feedStore.subscribe, feedStore.getSnapshot, feedStore.getSnapshot);
}

/**
 * 清空活动流。写在 hook 文件里而不是让视图直接摸单例：
 * 视图只描述「清」这个动作，不拥有总线。
 */
export function clearLiveFeed(): void {
	feedStore.clear();
}

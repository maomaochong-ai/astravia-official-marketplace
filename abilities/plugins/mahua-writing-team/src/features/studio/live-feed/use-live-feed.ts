import { useSyncExternalStore } from "react";
import { feedStore } from "./feed-store.js";
import type { FeedEvent } from "./feed-types.js";

/**
 * 订阅活动流。总线的快照是不可变数组，`append` 会换引用，所以
 * `useSyncExternalStore` 只在真有新事件时重渲染——不轮询，也无需要求页面刷新。
 */
export function useLiveFeed(): readonly FeedEvent[] {
	return useSyncExternalStore(feedStore.subscribe, feedStore.getSnapshot, feedStore.getSnapshot);
}

/**
 * 把宿主的会话事件流接进 ReaLiveStore。
 *
 * 只做订阅与转发；分类、聚合、裁剪都在 store 里，便于单测。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import type { ReaLiveStore } from "./session-store";

/**
 * 订阅当前会话的全部事件并写入 store。
 * 返回的 Disposable 在插件停用时会取消订阅。
 */
export function activateLiveWatch(ctx: PluginContext, store: ReaLiveStore): Disposable {
	const subscription = ctx.conversation.on((event) => {
		store.ingest(event);
	});
	return {
		dispose: (): void => {
			subscription.dispose();
		},
	};
}

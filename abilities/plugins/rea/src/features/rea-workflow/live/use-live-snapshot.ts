/**
 * 订阅 ReaLiveStore 的 React 钩子。
 *
 * useSyncExternalStore 在 React 18+ 从 react 导出；SDK barrel 不转出它，所以直接引 react。
 * 允许 store 为 null（插件还没装配完成时组件已经渲染），此时返回空快照。
 */

import { useSyncExternalStore } from "react";
import { EMPTY_LIVE_STATE, type ReaLiveState, type ReaLiveStore } from "./session-store";

const NOOP_SUBSCRIBE = (): (() => void) => () => {};
const EMPTY_SNAPSHOT = (): ReaLiveState => EMPTY_LIVE_STATE;

export function useReaLiveSnapshot(store: ReaLiveStore | null): ReaLiveState {
	return useSyncExternalStore(
		store ? store.subscribe : NOOP_SUBSCRIBE,
		store ? store.getSnapshot : EMPTY_SNAPSHOT,
	);
}

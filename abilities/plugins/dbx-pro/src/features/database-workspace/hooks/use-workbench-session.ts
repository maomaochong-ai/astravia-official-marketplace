/**
 * useWorkbenchSession — 会话恢复与自动保存逻辑。
 *
 * 从 use-workbench.tsx 拆分出来，专注会话持久化相关的逻辑。
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { patchSession, readSession } from "../../../domain/workbench-session";
import type { WorkbenchState } from "../state/workbench-types";
import type { WorkbenchAction } from "../state/workbench-actions";

interface SessionDeps {
	state: WorkbenchState;
	dispatch: React.Dispatch<WorkbenchAction>;
}

export function useWorkbenchSession(deps: SessionDeps) {
	const { state, dispatch } = deps;
	const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	/**
	 * 恢复完成前不落盘：挂载瞬间的 state 是空初始态，把它写回去会覆盖正要恢复的会话。
	 * 恢复是异步的，只有它结束后自动保存才有意义。
	 */
	const [hydrated, setHydrated] = useState(false);

	/** 恢复上次会话（活动连接、tab、展开节点）。 */
	const restoreSession = useCallback(async () => {
		try {
			const storedSession = await readSession();
			if (storedSession) {
				dispatch({ type: "restoreSession", session: storedSession });
			}
		} finally {
			setHydrated(true);
		}
	}, [dispatch]);

	/** 自动保存会话（防抖）。 */
	useEffect(() => {
		if (!hydrated) return;
		if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
		sessionSaveTimer.current = setTimeout(() => {
			// 画廊等瞬时 tab 不入库：重载后没有意义，恢复出来只会是空壳。
			const persistedTabs = state.tabs
				.filter((t) => t.gallery !== true)
				.map((t) => ({
					id: t.id, label: t.label, connectionName: t.connectionName, sql: t.sql,
					...(t.visualization ? { visualization: t.visualization } : {}),
				}));
			// 活动 tab 若是被过滤的瞬时 tab，则不恢复活动指针（由 reducer 回退首个 tab）。
			const activeTabId = persistedTabs.some((t) => t.id === state.activeTabId)
				? state.activeTabId
				: null;
			// 只合并本写入方维护的字段：栏宽与折叠态由其它写入方维护，
			// 整份覆盖会在自动保存时把它们抹掉。
			void patchSession({
				activeConnectionName: state.activeConnectionName,
				activeTabId,
				tabs: persistedTabs,
				expandedNodes: [...state.expandedNodes],
			}).catch(() => { /* 持久化失败不影响使用 */ });
		}, 400);
		return () => {
			if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
		};
	}, [hydrated, state.activeConnectionName, state.activeTabId, state.tabs, state.expandedNodes]);

	return { restoreSession };
}

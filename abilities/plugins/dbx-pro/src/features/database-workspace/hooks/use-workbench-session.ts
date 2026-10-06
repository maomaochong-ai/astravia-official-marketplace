/**
 * useWorkbenchSession — 会话恢复与自动保存逻辑。
 *
 * 从 use-workbench.tsx 拆分出来，专注会话持久化相关的逻辑。
 */

import { useCallback, useEffect, useRef } from "react";
import { readSession, writeSession, type StoredSession } from "../../../domain/workbench-session";
import type { WorkbenchState } from "../state/workbench-types";
import type { WorkbenchAction } from "../state/workbench-actions";

interface SessionDeps {
	state: WorkbenchState;
	dispatch: React.Dispatch<WorkbenchAction>;
}

export function useWorkbenchSession(deps: SessionDeps) {
	const { state, dispatch } = deps;
	const sessionSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	/** 恢复上次会话（活动连接、tab、展开节点）。 */
	const restoreSession = useCallback(async () => {
		const storedSession = await readSession();
		if (storedSession) {
			dispatch({ type: "restoreSession", session: storedSession });
		}
	}, [dispatch]);

	/** 自动保存会话（防抖）。 */
	useEffect(() => {
		if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
		sessionSaveTimer.current = setTimeout(() => {
			const session: StoredSession = {
				activeConnectionName: state.activeConnectionName,
				activeTabId: state.activeTabId,
				tabs: state.tabs.map((t) => ({
					id: t.id, label: t.label, connectionName: t.connectionName, sql: t.sql,
					...(t.visualization ? { visualization: t.visualization } : {}),
				})),
				expandedNodes: [...state.expandedNodes],
			};
			void writeSession(session).catch(() => { /* 持久化失败不影响使用 */ });
		}, 400);
		return () => {
			if (sessionSaveTimer.current) clearTimeout(sessionSaveTimer.current);
		};
	}, [state.activeConnectionName, state.activeTabId, state.tabs, state.expandedNodes]);

	return { restoreSession };
}

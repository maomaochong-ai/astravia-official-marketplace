/**
 * 案卷列表的读侧。
 *
 * 存储层是「一案一文件 + 一份索引」，读索引就够渲染列表；写入由 case_* 工具与
 * 取证钩子完成，它们写完会 `emit`，这里订阅同一个事件源，所以 Agent 在对话里
 * 记一条结论，面板会自动跟着更新，不需要用户点刷新。
 *
 * 上下文未就绪时（surface 比 activate 先挂载、单测直接渲染）返回空列表：
 * 面板显示「还没有案件」比抛一个 `REA plugin is not active` 更好读。
 */
import { useCallback, useEffect, useState } from "react";
import type { CaseSummary } from "../domain/case-model";
import { hasPluginContext } from "../plugin-context";
import { getActiveCaseId, listCaseSummaries, setActiveCaseId, subscribeCases } from "../services/case-store";

export interface CaseBoardState {
	readonly loading: boolean;
	readonly cases: readonly CaseSummary[];
	readonly activeId: string | null;
	readonly error: string | null;
	readonly reload: () => void;
	readonly activate: (caseId: string | null) => void;
}

export function useCaseBoard(cwd: string | null): CaseBoardState {
	const [cases, setCases] = useState<readonly CaseSummary[]>([]);
	const [activeId, setActiveId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [nonce, setNonce] = useState(0);

	const reload = useCallback((): void => setNonce((value) => value + 1), []);

	useEffect(() => {
		if (!hasPluginContext()) {
			setCases([]);
			setActiveId(null);
			setLoading(false);
			return;
		}
		let cancelled = false;
		setLoading(true);
		void (async () => {
			try {
				const [summaries, active] = await Promise.all([listCaseSummaries(), getActiveCaseId(cwd)]);
				if (cancelled) return;
				setCases(summaries);
				setActiveId(active);
				setError(null);
			} catch (cause) {
				if (cancelled) return;
				setError(cause instanceof Error ? cause.message : String(cause));
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, [cwd, nonce]);

	// 关注写入事件：Agent 记录证据、开关案件都会让列表重新读一遍。
	useEffect(() => {
		if (!hasPluginContext()) return undefined;
		return subscribeCases(() => setNonce((value) => value + 1));
	}, []);

	const activate = useCallback(
		(caseId: string | null): void => {
			setActiveId(caseId);
			if (!hasPluginContext()) return;
			void setActiveCaseId(cwd, caseId).catch((cause: unknown) =>
				console.warn("[rea] cannot switch the active case", cause),
			);
		},
		[cwd],
	);

	return { loading, cases, activeId, error, reload, activate };
}

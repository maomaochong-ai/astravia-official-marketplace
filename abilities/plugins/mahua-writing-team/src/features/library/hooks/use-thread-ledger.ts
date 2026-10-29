import { useCallback, useEffect, useState } from "react";
import type { StudioService } from "../../../application/studio-service.js";
import type { ArbitrationRecord, Finding, StoryThread } from "../../../domain/novel-types.js";
import type { ThreadAudit } from "../../../domain/threads.js";
import { getStudioRuntime } from "../../../plugin-context.js";

/** 没有台账时的体检读数：四个零，不是一个「加载中」的占位。 */
const EMPTY_AUDIT: ThreadAudit = { findings: [], open: 0, overdue: 0, unresolvedRate: 0 };

export interface ThreadLedgerState {
	loading: boolean;
	error: string | null;
	threads: StoryThread[];
	audit: ThreadAudit;
	decisions: ArbitrationRecord[];
	/** 一致性体检的发现项：判据全在领域层，这里只负责取回来摆上去。 */
	findings: Finding[];
	refresh(): void;
}

/**
 * 伏笔账本的数据（ADR 0021 §2 / ADR 0026 §6）。
 *
 * 四个读数来自四个只读接口——台账、台账体检、决策日志、一致性体检。没有一个是视图自己
 * 算的：视图一旦开始自己判断「这条算不算逾期」，它和模型看到的 `mahua_check_threads`
 * 就会给出两个答案。写入口仍然只有 `StudioService`，这一页本身没有任何按钮。
 */
export function useThreadLedger(bookId: string | null): ThreadLedgerState {
	const service: StudioService = getStudioRuntime().service;

	const [threads, setThreads] = useState<StoryThread[]>([]);
	const [audit, setAudit] = useState<ThreadAudit>(EMPTY_AUDIT);
	const [decisions, setDecisions] = useState<ArbitrationRecord[]>([]);
	const [findings, setFindings] = useState<Finding[]>([]);
	const [loading, setLoading] = useState(bookId !== null);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState(0);

	useEffect(() => {
		let live = true;
		setError(null);

		if (bookId === null) {
			setThreads([]);
			setAudit(EMPTY_AUDIT);
			setDecisions([]);
			setFindings([]);
			setLoading(false);
			return () => {
				live = false;
			};
		}

		setLoading(true);
		void (async () => {
			try {
				const [ledger, health, log, consistent] = await Promise.all([
					service.threads(bookId),
					service.checkThreads(bookId),
					service.decisions(bookId),
					service.checkConsistency(bookId),
				]);
				if (!live) return;

				if (!ledger.ok) setError(ledger.detail ?? ledger.error);
				else if (!health.ok) setError(health.detail ?? health.error);
				else if (!log.ok) setError(log.detail ?? log.error);
				else if (!consistent.ok) setError(consistent.detail ?? consistent.error);

				setThreads(ledger.ok ? ledger.data : []);
				setAudit(health.ok ? health.data : EMPTY_AUDIT);
				setDecisions(log.ok ? log.data : []);
				setFindings(consistent.ok ? consistent.data.findings : []);
			} catch (cause) {
				if (live) setError(cause instanceof Error ? cause.message : String(cause));
			} finally {
				if (live) setLoading(false);
			}
		})();

		return () => {
			live = false;
		};
	}, [bookId, service, version]);

	const refresh = useCallback(() => setVersion((value) => value + 1), []);

	return { loading, error, threads, audit, decisions, findings, refresh };
}

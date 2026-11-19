/**
 * 我的案例：面板自己沉淀的案例库，按工作区隔离。
 *
 * 与案例库页扫的 `cases/` / `work/` 分开：那些是仓库里已有的战例（只读），这里是
 * 「这台机器上真的做过什么」。写盘失败不影响分析本身——分析结果是当下的，沉淀是事后的。
 *
 * 沉淀有两条入口，都必须**显式**：
 *   1. 一份报告产出来（`record`）——分析完成即入；
 *   2. 用户把发送前编辑过的草稿按「存为案例草稿」（`recordDraft`）——还没跑也能留。
 *
 * 没有第三条「自动把别的会话的东西并进来」的路：会话草稿在 storage-layout 里是
 * `session` 作用域，跨会话不可见，除非用户在这里显式沉淀。
 */

import { useCallback, useEffect, useRef, useState } from "react";

import {
	caseFromDraft,
	caseFromReport,
	MAX_MY_CASES,
	sanitizeCases,
	upsertCase,
	type CaseProvenance,
	type MyCase,
} from "../../../domain/my-cases";
import type { TriageReport } from "../../../domain/report/report";
import type { WorkbenchBridge } from "../bridge";

export interface MyCasesModel {
	cases: MyCase[];
	loaded: boolean;
	/** 一份报告产出来就调一次；同一份样本重复分析会累加而不是新增。 */
	record(report: TriageReport, provenance?: CaseProvenance): void;
	/** 一句话草稿入案例库（还没跑分析）。同一段文字只留一条。 */
	recordDraft(input: { prompt: string; tags?: readonly string[]; model?: string | null }): void;
	remove(id: string): void;
	clear(): void;
}

export function useMyCases(bridge: WorkbenchBridge, cwd: string | null): MyCasesModel {
	const [cases, setCases] = useState<MyCase[]>([]);
	const [loaded, setLoaded] = useState(false);
	// 写入串行化：一次分析可能连着产出两条，两个写盘互相覆盖会丢条目。
	const writing = useRef<Promise<unknown>>(Promise.resolve());

	useEffect(() => {
		let cancelled = false;
		setLoaded(false);
		bridge
			.myCases(cwd)
			.then(stored => {
				if (cancelled) return;
				setCases(sanitizeCases(stored));
			})
			.catch(() => {
				if (!cancelled) setCases([]);
			})
			.finally(() => {
				if (!cancelled) setLoaded(true);
			});
		return () => {
			cancelled = true;
		};
	}, [bridge, cwd]);

	const persist = useCallback(
		(next: MyCase[]) => {
			writing.current = writing.current.then(() => bridge.saveMyCases(next, cwd)).catch(() => undefined);
		},
		[bridge, cwd],
	);

	const record = useCallback(
		(report: TriageReport, provenance?: CaseProvenance) => {
			setCases(current => {
				const next = upsertCase(current, caseFromReport(report, provenance), MAX_MY_CASES);
				persist(next);
				return next;
			});
		},
		[persist],
	);

	const recordDraft = useCallback(
		(input: { prompt: string; tags?: readonly string[]; model?: string | null }) => {
			const prompt = input.prompt.trim();
			if (prompt.length === 0) return;
			setCases(current => {
				const next = upsertCase(
					current,
					caseFromDraft({ prompt, at: new Date().toISOString(), tags: input.tags, model: input.model }),
					MAX_MY_CASES,
				);
				persist(next);
				return next;
			});
		},
		[persist],
	);

	const remove = useCallback(
		(id: string) => {
			setCases(current => {
				const next = current.filter(item => item.id !== id);
				persist(next);
				return next;
			});
		},
		[persist],
	);

	const clear = useCallback(() => {
		setCases(() => {
			persist([]);
			return [];
		});
	}, [persist]);

	return { cases, loaded, record, recordDraft, remove, clear };
}

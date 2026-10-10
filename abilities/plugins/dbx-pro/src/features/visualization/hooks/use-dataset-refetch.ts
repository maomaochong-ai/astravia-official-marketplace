/**
 * useDatasetRefetch — 「重新取数」的状态机。
 *
 * 筛选不走 SQL（纯前端过滤），只有用户明确点「重新取数」时才重跑：
 * 复用 executeServerPage（工作台查询网格 / dbx_query_full 用的同一条通道），
 * 不新增数据通道、不新增 Agent 工具（ADR-0009 §7 非目标）。
 *
 * 失败时把引擎给的 SQL 错误**原样**透出：改写过的文案会掩盖真正原因，
 * 而用户接下来要做的往往就是照着这句话去改 SQL。
 */

import { useRef, useState } from "react";
import type { DatasetSpec, Visualization } from "../../../domain/chart-contract";
import { DATASET_ROW_LIMIT, normalizeDatasetSpec } from "../../../domain/dataset-spec";
import { executeServerPage } from "../../../shared/services/execute-server-page";

const REFETCH_TIMEOUT_MS = 30000;

export type RefetchStatus = "idle" | "running" | "ok" | "error";

export interface DatasetRefetch {
	status: RefetchStatus;
	message: string;
	refetch: () => Promise<void>;
}

export function useDatasetRefetch(
	visualization: Visualization,
	onRefetched: (datasets: DatasetSpec[]) => void,
): DatasetRefetch {
	const [status, setStatus] = useState<RefetchStatus>("idle");
	const [message, setMessage] = useState("");
	const running = useRef(false);

	async function refetch(): Promise<void> {
		if (running.current) return;
		const all = visualization.datasets ?? [];
		const targets = all.filter((dataset) => dataset.connection && dataset.sql);
		if (targets.length === 0) {
			setStatus("error");
			setMessage("该产物没有可用于重新取数的 SQL（数据集缺少 sql 或连接）");
			return;
		}

		running.current = true;
		setStatus("running");
		setMessage("正在重新取数…");
		try {
			const refreshed = new Map<string, DatasetSpec>();
			for (const dataset of targets) {
				const outcome = await executeServerPage(dataset.connection, dataset.sql, {
					baseOffset: 0,
					pageSize: DATASET_ROW_LIMIT,
					timeoutMs: REFETCH_TIMEOUT_MS,
				});
				refreshed.set(
					dataset.id,
					normalizeDatasetSpec(
						{ ...dataset, rows: outcome.rows, rowCount: outcome.row_count },
						{ fetchedAt: Date.now() },
					),
				);
			}

			// 没有 SQL 的数据集原样保留：一次取数不该把它们从产物里抹掉
			const datasets = all.map((dataset) => refreshed.get(dataset.id) ?? dataset);
			onRefetched(datasets);

			const loaded = datasets.reduce((sum, dataset) => sum + dataset.rows.length, 0);
			const total = datasets.reduce((sum, dataset) => sum + dataset.rowCount, 0);
			setStatus("ok");
			setMessage(loaded < total ? `已载入 ${loaded} 行（SQL 共 ${total} 行）` : `已载入 ${loaded} 行`);
		} catch (error) {
			setStatus("error");
			setMessage(error instanceof Error ? error.message : String(error));
		} finally {
			running.current = false;
		}
	}

	return { status, message, refetch };
}

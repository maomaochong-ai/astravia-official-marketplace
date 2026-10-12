/**
 * useCanvasExecution — 画布节点执行引擎。
 *
 * 把数据库工作台已有的 SQL 执行能力（engineExecuteByName）接入 BI 画布节点：
 * - 数据源节点（source-sql / source-table）执行 SQL 并缓存结果
 * - 图表/指标节点从上游节点的结果中提取数据
 * - 运行按拓扑序执行：先数据源，再下游
 *
 * 纯 hook，不碰 DOM；返回 nodeResults + runAll + runNode + getUpstreamData。
 */

import { useCallback, useRef, useState } from "react";
import {
	engineExecuteByName,
	engineListConnections,
	type EngineConnectionSummary,
	type EngineQueryOutcome,
} from "../../../../../../../../../shared/services/engine-client";
import type { NodePos, NodeId, Link } from "../components/node-graph";

export interface NodeResult {
	columns: string[];
	rows: Record<string, unknown>[];
	rowCount: number;
	error?: string;
	durationMs: number;
}

export interface UseCanvasExecutionReturn {
	nodeResults: Record<NodeId, NodeResult>;
	connections: EngineConnectionSummary[];
	running: boolean;
	runNode: (id: NodeId, node: NodePos) => Promise<void>;
	runAll: (nodes: Record<NodeId, NodePos>, links: Link[]) => Promise<void>;
	getUpstreamData: (id: NodeId, links: Link[], nodes: Record<NodeId, NodePos>) => NodeResult | null;
	refreshConnections: () => Promise<void>;
	extractSeries: (result: NodeResult | null, field: string | undefined) => number[];
}

function outcomeToResult(outcome: EngineQueryOutcome): NodeResult {
	return {
		columns: outcome.columns,
		rows: outcome.rows,
		rowCount: outcome.row_count,
		durationMs: outcome.duration_ms,
	};
}

function errorToResult(message: string, durationMs = 0): NodeResult {
	return { columns: [], rows: [], rowCount: 0, error: message, durationMs };
}

export function useCanvasExecution(): UseCanvasExecutionReturn {
	const [nodeResults, setNodeResults] = useState<Record<NodeId, NodeResult>>({});
	const [connections, setConnections] = useState<EngineConnectionSummary[]>([]);
	const [running, setRunning] = useState(false);
	const resultsRef = useRef<Record<NodeId, NodeResult>>({});

	const refreshConnections = useCallback(async () => {
		try {
			const { connections: list } = await engineListConnections();
			setConnections(list);
		} catch {
			// 引擎未就绪时静默
		}
	}, []);

	const runNode = useCallback(async (id: NodeId, node: NodePos) => {
		const kind = node.kind;
		const values = node.values ?? {};

		if (kind === "source-sql") {
			const sql = String(values.sql ?? "").trim();
			const connectionName = String(values.datasourceId ?? "");
			if (!sql) {
				const result = errorToResult("SQL 为空");
				resultsRef.current[id] = result;
				setNodeResults({ ...resultsRef.current });
				return;
			}
			if (!connectionName) {
				const result = errorToResult("未选择数据源");
				resultsRef.current[id] = result;
				setNodeResults({ ...resultsRef.current });
				return;
			}
			try {
				const outcome = await engineExecuteByName(connectionName, sql, {
					timeoutMs: Number(values.timeout) || 30_000,
					rowLimit: 1000,
				});
				const result = outcomeToResult(outcome);
				resultsRef.current[id] = result;
				setNodeResults({ ...resultsRef.current });
			} catch (e) {
				const result = errorToResult(e instanceof Error ? e.message : String(e));
				resultsRef.current[id] = result;
				setNodeResults({ ...resultsRef.current });
			}
			return;
		}

		if (kind === "source-table") {
			const table = String(values.table ?? "").trim();
			const connectionName = String(values.datasourceId ?? "");
			const limit = Number(values.limit) || 1000;
			if (!table) {
				const result = errorToResult("未指定表名");
				resultsRef.current[id] = result;
				setNodeResults({ ...resultsRef.current });
				return;
			}
			if (!connectionName) {
				const result = errorToResult("未选择数据源");
				resultsRef.current[id] = result;
				setNodeResults({ ...resultsRef.current });
				return;
			}
			try {
				const sql = `SELECT * FROM ${table} LIMIT ${limit}`;
				const outcome = await engineExecuteByName(connectionName, sql, {
					timeoutMs: 30_000,
					rowLimit: limit,
				});
				const result = outcomeToResult(outcome);
				resultsRef.current[id] = result;
				setNodeResults({ ...resultsRef.current });
			} catch (e) {
				const result = errorToResult(e instanceof Error ? e.message : String(e));
				resultsRef.current[id] = result;
				setNodeResults({ ...resultsRef.current });
			}
			return;
		}

		// 非数据源节点：从上游获取数据
		// 这里不做额外执行，getUpstreamData 会实时解析
	}, []);

	const getUpstreamData = useCallback((id: NodeId, links: Link[], nodes: Record<NodeId, NodePos>): NodeResult | null => {
		// 找到所有指向当前节点的连线
		const incomingLinks = links.filter((l) => l.to === id);
		if (incomingLinks.length === 0) return null;

		// 合并所有上游节点的结果
		const allColumns: string[] = [];
		const allRows: Record<string, unknown>[] = [];
		const seenColumns = new Set<string>();

		for (const link of incomingLinks) {
			const upstreamResult = resultsRef.current[link.from];
			if (!upstreamResult || upstreamResult.error) continue;

			for (const col of upstreamResult.columns) {
				if (!seenColumns.has(col)) {
					seenColumns.add(col);
					allColumns.push(col);
				}
			}
			allRows.push(...upstreamResult.rows);
		}

		if (allColumns.length === 0) return null;
		return { columns: allColumns, rows: allRows, rowCount: allRows.length, durationMs: 0 };
	}, []);

	const runAll = useCallback(async (nodes: Record<NodeId, NodePos>, links: Link[]) => {
		setRunning(true);
		resultsRef.current = {};
		setNodeResults({});

		// 拓扑排序：先执行数据源节点，再执行下游
		const visited = new Set<NodeId>();
		const order: NodeId[] = [];

		function visit(id: NodeId) {
			if (visited.has(id)) return;
			visited.add(id);
			// 先访问上游
			for (const link of links) {
				if (link.to === id) visit(link.from);
			}
			order.push(id);
		}

		for (const id of Object.keys(nodes)) {
			visit(id);
		}

		// 按拓扑序执行
		for (const id of order) {
			const node = nodes[id];
			if (!node) continue;
			const kind = node.kind;
			if (kind === "source-sql" || kind === "source-table" || kind === "source-api") {
				await runNode(id, node);
			}
		}

		setRunning(false);
	}, [runNode]);

	const extractSeries = useCallback((result: NodeResult | null, field: string | undefined): number[] => {
		if (!result || !field || result.rows.length === 0) return [];
		return result.rows
			.map((row) => {
				const val = row[field];
				if (typeof val === "number") return val;
				const num = Number(val);
				return Number.isFinite(num) ? num : 0;
			});
	}, []);

	return {
		nodeResults,
		connections,
		running,
		runNode,
		runAll,
		getUpstreamData,
		refreshConnections,
		extractSeries,
	};
}

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
} from "../../../../shared/services/engine-client";
import type { NodePos, NodeId, Link } from "../components/node-graph";
import { fnv1aRange } from "../../../../shared/utils/hash";

export interface NodeResult {
	columns: string[];
	rows: Record<string, unknown>[];
	rowCount: number;
	error?: string;
	durationMs: number;
}

/** 一次运行的汇总，供状态栏展示。 */
export interface RunOutcome {
	/** 实际执行了 engine 的节点数（停用节点不计）。 */
	nodeCount: number;
	/** 被跳过的停用节点数。 */
	skippedMuted: number;
	durationMs: number;
	/**
	 * 本轮每个节点的结果（含报错）。
	 * `await runAll()` 之后组件里的 nodeResults state 尚未提交，调用方要读本轮结果只能读这里。
	 */
	results: Record<NodeId, NodeResult>;
}

export interface UseCanvasExecutionReturn {
	nodeResults: Record<NodeId, NodeResult>;
	connections: EngineConnectionSummary[];
	running: boolean;
	runNode: (id: NodeId, node: NodePos) => Promise<void>;
	runAll: (nodes: Record<NodeId, NodePos>, links: Link[]) => Promise<RunOutcome>;
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

function quoteIdent(name: string): string {
	return `"${name.replace(/"/g, '""')}"`;
}

function hv(seed: string, min: number, max: number): number {
	return fnv1aRange(seed, min, max);
}
function mockRows(seed: string, count: number, colCount: number): Record<string, unknown>[] {
	const colNames = ["ts", "value", "category", "x", "y", "amount"];
	const out: Record<string, unknown>[] = [];
	for (let i = 0; i < count; i++) {
		const row: Record<string, unknown> = {};
		for (let c = 0; c < colCount; c++) {
			const cname = colNames[c] ?? `col_${c + 1}`;
			if (cname === "ts") row[cname] = `2025-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + (i % 28)).padStart(2, "0")}`;
			else if (cname === "category") row[cname] = ["A", "B", "C", "D", "E"][i % 5];
			else row[cname] = hv(`${seed}-r${i}-c${c}`, 20, 900);
		}
		out.push(row);
	}
	return out;
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

		// ── source-sql：真实 engine 执行 ──
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

		// ── source-table：真实 engine 执行 ──
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
				const sql = `SELECT * FROM ${quoteIdent(table)} LIMIT ${limit}`;
				const outcome = await engineExecuteByName(connectionName, sql, {
					timeoutMs: 30_000,
					rowLimit: limit,
				});
				resultsRef.current[id] = outcomeToResult(outcome);
				setNodeResults({ ...resultsRef.current });
			} catch (e) {
				const result = errorToResult(e instanceof Error ? e.message : String(e));
				resultsRef.current[id] = result;
				setNodeResults({ ...resultsRef.current });
			}
			return;
		}

		// ── source-connector：直连 MySQL（engine client 真实执行，无连接时 mock） ──
		if (kind === "source-connector") {
			const connectionName = String(values.connectionId ?? values.datasourceId ?? "");
			const tableName = String(values.tableName ?? values.table ?? "").trim();
			if (!tableName) {
				resultsRef.current[id] = errorToResult("未指定表名");
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
				const outcome = await engineExecuteByName(connectionName, `SELECT * FROM ${quoteIdent(tableName)} LIMIT 500`, {
					timeoutMs: 30_000, rowLimit: 500,
				});
				resultsRef.current[id] = outcomeToResult(outcome);
			} catch (e) {
				const result = errorToResult(e instanceof Error ? e.message : String(e));
				resultsRef.current[id] = result;
			}
			setNodeResults({ ...resultsRef.current });
			return;
		}

		// ── source-csv：本地 CSV（纯 mock，展示 fileName + rowCount） ──
		if (kind === "source-csv") {
			const fileName = String(values.fileName ?? "data.csv");
			const rowCount = Number(values.rowCount) || 120;
			resultsRef.current[id] = {
				columns: ["col_1", "col_2", "col_3", "col_4"],
				rows: mockRows("csv-" + fileName, rowCount, 4),
				rowCount,
				durationMs: 42,
			};
			setNodeResults({ ...resultsRef.current });
			return;
		}

		// ── source-extract / source-api：一律 mock 出一份假数据 ──
		if (kind === "source-extract" || kind === "source-api") {
			const label = kind === "source-extract" ? "抽取任务" : "HTTP API";
			resultsRef.current[id] = {
				columns: ["ts", "value", "category"],
				rows: mockRows("extract-" + id, 30, 3),
				rowCount: 30,
				durationMs: Math.round(20 + Math.random() * 80),
			};
			setNodeResults({ ...resultsRef.current });
			void label; // 未使用警告避免
			return;
		}

		// 非数据源节点：从上游获取数据，这里不做额外执行
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

	const runAll = useCallback(async (nodes: Record<NodeId, NodePos>, links: Link[]): Promise<RunOutcome> => {
		setRunning(true);
		resultsRef.current = {};
		setNodeResults({});

		const startedAt = Date.now();
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

		// 按拓扑序执行：只执行数据源 kind（图表/指标从上游取数据，自己不跑 engine）
		// 停用节点（node.muted）直接跳过：ComfyUI 的 mute/bypass 语义。
		let executed = 0;
		let skippedMuted = 0;
		for (const id of order) {
			const node = nodes[id];
			if (!node) continue;
			const kind = node.kind ?? "";
			if (!kind.startsWith("source-")) continue;
			if (node.muted) { skippedMuted++; continue; }
			executed++;
			await runNode(id, node);
		}

		setRunning(false);
		// 结果一并回传：await 之后 setNodeResults 还没提交，调用方读 nodeResults 只会拿到上一轮快照
		const results: Record<NodeId, NodeResult> = {};
		for (const id of order) {
			const r = resultsRef.current[id];
			if (r) results[id] = r;
		}
		return { nodeCount: executed, skippedMuted, durationMs: Date.now() - startedAt, results };
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

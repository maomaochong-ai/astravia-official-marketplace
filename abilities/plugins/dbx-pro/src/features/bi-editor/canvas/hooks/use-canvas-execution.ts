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
import { parseCsv } from "../lib/parse-csv";
import { parseRestJson } from "../lib/parse-rest-json";
import { resolveConnectionName } from "../lib/connection-ref";

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

/** 把一行结果写进缓存并同步 state（执行器里多处重复同一模式）。 */
function commitResult(
	id: NodeId,
	result: NodeResult,
	cache: Record<NodeId, NodeResult>,
	set: (next: Record<NodeId, NodeResult>) => void,
): void {
	cache[id] = result;
	set({ ...cache });
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
			// 面板存的是连接 id，引擎按 name 执行：统一在此解析（旧页面因此自动修复）
			const connectionName = resolveConnectionName(values.datasourceId ?? values.connectionId, connections);
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
					// 面板单位是秒，默认 30s
					timeoutMs: (Number(values.timeout) > 0 ? Number(values.timeout) : 30) * 1000,
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
			const connectionName = resolveConnectionName(values.datasourceId ?? values.connectionId, connections);
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
			const connectionName = resolveConnectionName(values.connectionId ?? values.datasourceId, connections);
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
				// 面板的 Limit 生效：默认 500，上限 5000（与 rowLimit 保持一致）
				const wanted = Number(values.limit);
				const limit = Number.isFinite(wanted) && wanted > 0 ? Math.min(5000, Math.floor(wanted)) : 500;
				// 「选字段」写的是 JSON 数组；为空或不合法则取全部列
				let projection = "*";
				const rawFields = String(values.fields ?? "").trim();
				if (rawFields) {
					try {
						const parsed = JSON.parse(rawFields) as unknown;
						const names = Array.isArray(parsed)
							? parsed.filter((x): x is string => typeof x === "string" && x.trim() !== "")
							: [];
						if (names.length > 0) projection = names.map(quoteIdent).join(", ");
					} catch {
						// 非法 JSON 不阻断查询，按全部列执行
					}
				}
				const outcome = await engineExecuteByName(connectionName, `SELECT ${projection} FROM ${quoteIdent(tableName)} LIMIT ${limit}`, {
					timeoutMs: 30_000, rowLimit: limit,
				});
				resultsRef.current[id] = outcomeToResult(outcome);
			} catch (e) {
				const result = errorToResult(e instanceof Error ? e.message : String(e));
				resultsRef.current[id] = result;
			}
			setNodeResults({ ...resultsRef.current });
			return;
		}

		// ── source-csv：粘贴的 CSV / TSV 文本真解析 ──
		if (kind === "source-csv") {
			const started = performance.now();
			const content = String(values.content ?? "");
			if (!content.trim()) {
				commitResult(id, errorToResult("未粘贴 CSV 内容：在右侧属性面板粘贴数据", performance.now() - started), resultsRef.current, setNodeResults);
				return;
			}
			const hasHeader = values.hasHeader !== "no";
			const parsed = parseCsv(content, hasHeader);
			if (parsed.rows.length === 0) {
				commitResult(id, errorToResult(parsed.note || "CSV 没有可用数据行", performance.now() - started), resultsRef.current, setNodeResults);
				return;
			}
			commitResult(
				id,
				{
					columns: parsed.columns,
					rows: parsed.rows,
					rowCount: parsed.rows.length,
					durationMs: Math.max(1, Math.round(performance.now() - started)),
				},
				resultsRef.current,
				setNodeResults,
			);
			return;
		}

		// ── source-api：真发 HTTP 请求，失败如实报错 ──
		if (kind === "source-api") {
			const started = performance.now();
			const url = String(values.url ?? "").trim();
			if (!url) {
				commitResult(id, errorToResult("未填写接口地址：在右侧属性面板填写 URL", performance.now() - started), resultsRef.current, setNodeResults);
				return;
			}
			const method = String(values.method ?? "GET").toUpperCase();
			let headers: Record<string, string> = { Accept: "application/json" };
			const rawHeaders = String(values.headers ?? "").trim();
			if (rawHeaders) {
				try {
					const parsed = JSON.parse(rawHeaders) as unknown;
					if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
						headers = { ...headers, ...(parsed as Record<string, string>) };
					}
				} catch {
					commitResult(id, errorToResult("请求头不是合法 JSON", performance.now() - started), resultsRef.current, setNodeResults);
					return;
				}
			}
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15_000);
			try {
				const response = await fetch(url, {
					method,
					headers,
					body: method === "GET" || method === "HEAD" ? undefined : String(values.body ?? "") || undefined,
					signal: controller.signal,
				});
				if (!response.ok) {
					commitResult(id, errorToResult(`接口返回 ${response.status} ${response.statusText}`.trim(), performance.now() - started), resultsRef.current, setNodeResults);
					return;
				}
				const payload: unknown = await response.json();
				const table = parseRestJson(payload, Number(values.limit) > 0 ? Number(values.limit) : 1000);
				if (table.rows.length === 0) {
					commitResult(id, errorToResult("接口返回的 JSON 里没有可用数据行", performance.now() - started), resultsRef.current, setNodeResults);
					return;
				}
				commitResult(
					id,
					{
						columns: table.columns,
						rows: table.rows,
						rowCount: table.truncatedFrom ?? table.rows.length,
						durationMs: Math.max(1, Math.round(performance.now() - started)),
					},
					resultsRef.current,
					setNodeResults,
				);
			} catch (e) {
				const raw = e instanceof Error ? e.message : String(e);
				const message = e instanceof DOMException && e.name === "AbortError"
					? "接口请求超时（15s）"
					: raw === "Failed to fetch"
						? "请求失败：网络不可达，或被接口的跨域策略拦截"
						: raw;
				commitResult(id, errorToResult(message, performance.now() - started), resultsRef.current, setNodeResults);
			} finally {
				clearTimeout(timeout);
			}
			return;
		}

		// ── source-extract：抽取任务没有引擎侧接口，不做假数据 ──
		if (kind === "source-extract") {
			commitResult(id, errorToResult("抽取任务尚未接入：请改用 SQL 查询或直连数据源节点"), resultsRef.current, setNodeResults);
			return;
		}

		// 非数据源节点：从上游获取数据，这里不做额外执行
	}, [connections]);

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

/**
 * query.mjs — 执行 SQL（含 API 接入 / 写驱动 / 分页）。
 *   POST /query
 */
import { engineError } from "../engine/protocol.mjs";
import { DBX_MAX_ROWS, DBX_EFFECTIVE_ROW_CAP, clampRowLimit, clampTimeout, dbxMaxRows } from "./router-context.mjs";

export function queryRoutes(ctx) {
	return [
		["/query", "POST", true, async ({ body }) => {
			const connectionName = body?.connectionName ?? body?.connection?.name;
			if (!connectionName) throw engineError("BAD_REQUEST", "缺少 connectionName");
			const sql = body?.sql;
			if (typeof sql !== "string" || sql.trim().length === 0) throw engineError("BAD_REQUEST", "SQL 不能为空");

			const classified = ctx.classifyQuery(sql);
			const isApiQuery =
				ctx.dataDir !== null &&
				(ctx.isApiDbType(body?.dbType ?? body?.connection?.db_type ?? body?.connection?.dbType) ||
					ctx.isApiSourceName(ctx.dataDir, connectionName));
			if (isApiQuery && classified.requiresConfirmation) {
				throw engineError("WRITE_BLOCKED", "API 接入是只读数据源，不支持写 / DDL");
			}

			const timeoutMs = clampTimeout(body?.timeoutMs);
			const rowLimit = clampRowLimit(body?.rowLimit);
			const started = ctx.now();
			const maxRows = dbxMaxRows(rowLimit);
			let pageLimit = null;

			if (classified.requiresConfirmation) {
				if (body?.allowWrite !== true) throw engineError("SQL_BLOCKED", "写 / DDL 需要显式确认");
				if (body.confirmedWriteSql !== sql) throw engineError("CONFIRM_MISMATCH", "写确认文本与待执行 SQL 不一致");
				const connSpec = body?.connection;
				if (!connSpec?.host) throw engineError("BAD_REQUEST", "写操作需要连接配置（connection）");
				if (connSpec.read_only === true) throw engineError("WRITE_BLOCKED", "连接已设为只读，写操作被拒绝");
				let writeResult;
				try {
					const resolvedSpec = await ctx.resolveWriteConnSpec(connectionName, connSpec);
					writeResult = await ctx.executeWrite(resolvedSpec, sql);
				} catch (e) {
					if (e?.engineError) throw e;
					const writeError = e?.message ?? String(e);
					const hint = await ctx.describeFailure(connectionName, sql, sql, writeError);
					throw engineError(e?.code ?? "WRITE_FAILED", `写操作执行失败: ${writeError}${hint}`, writeError);
				}
				return {
					connection: connectionName, kind: classified.kind,
					statement_count: classified.statements.length,
					columns: writeResult.columns, rows: writeResult.rows,
					row_count: writeResult.rows.length, truncated: false,
					row_limit: rowLimit, max_rows: maxRows,
					duration_ms: ctx.now() - started, duration_hint: "self-write",
					raw_text: null, command: writeResult.command,
					affected_rows: writeResult.affectedRows, write_executed: true,
				};
			}

			const dbType = body?.dbType ?? body?.connection?.db_type ?? body?.connection?.dbType;
			const countOnly = body?.countOnly === true;
			const pageReq = body?.page;
			let effectiveSql = sql;
			const pageable = !isApiQuery && ctx.canPaginate(sql);

			if (pageable && countOnly) {
				if (!ctx.supportsPagination(dbType)) throw engineError("BAD_REQUEST", "当前数据库类型不支持分页统计");
				effectiveSql = ctx.buildCountSql(sql);
			} else if (pageable && pageReq && Number.isFinite(pageReq.offset) && Number.isFinite(pageReq.limit)) {
				if (!ctx.supportsPagination(dbType)) throw engineError("BAD_REQUEST", "当前数据库类型不支持分页");
				const limit = Math.min(Math.max(Math.trunc(pageReq.limit), 1), DBX_EFFECTIVE_ROW_CAP);
				const offset = Math.max(Math.trunc(pageReq.offset), 0);
				pageLimit = limit;
				effectiveSql = ctx.buildPagedSql(sql, dbType, limit, offset);
			}

			const toOutcome = (text, extra = {}) => ctx.toOutcome(text, {
				pageLimit, rowLimit, maxRows,
				durationMs: ctx.now() - started, ...extra,
			});

			if (isApiQuery) {
				let run;
				try {
					run = await ctx.runApiQuery({
						dataDir: ctx.dataDir, sql, maxRows,
						engine: {
							ensureConnection: ctx.ensureApiEngineConnection,
							execute: async (engineSql, limit) => {
								const engineResult = await ctx.mcpClient().callTool(
									"dbx_execute_query",
									{ connection_name: ctx.API_ENGINE_CONNECTION, sql: engineSql, max_rows: limit ?? maxRows },
									timeoutMs,
								);
								if (engineResult.isError) {
									const engineText = ctx.textOf(engineResult);
									if (ctx.isDriverUnavailable(engineText)) {
										throw engineError("API_ENGINE_UNAVAILABLE",
											"本机查询通道不可用：DuckDB 驱动未安装。请在「驱动管理」里安装 DuckDB，" +
											"或设置 DBX_DUCKDB_DRIVER_PATH 后重试（接口数据已取到，只是没地方跑 SQL）。",
											engineText);
									}
									const err = ctx.classifyError(engineText);
									throw engineError(err.code, `快照查询失败: ${err.detail}`, engineText);
								}
								return ctx.textOf(engineResult);
							},
						},
					});
				} catch (e) {
					if (e?.engineError) throw e;
					throw engineError(e?.code ?? "API_QUERY_FAILED", e?.message ?? String(e));
				}
				const outcome = toOutcome(run.engineText);
				return {
					...outcome,
					api: {
						engine_sql: run.engineSql,
						sources: run.sources.map((s) => ({
							name: s.name, url: s.url,
							row_count: s.rowCount, total_records: s.totalRecords,
							truncated: s.truncated, status: s.status,
							fetched_at: s.fetchedAt, duration_ms: s.durationMs,
						})),
					},
				};
			}

			let result;
			try {
				result = await ctx.mcpClient().callTool(
					"dbx_execute_query",
					{ connection_name: connectionName, sql: effectiveSql, max_rows: pageLimit ?? maxRows },
					timeoutMs,
				);
			} catch (e) {
				const msg = e?.message ?? String(e);
				throw engineError("DBX_MCP_ERROR", `dbx-mcp 调用失败: ${msg}`);
			}

			if (!result.isError) {
				const outcome = toOutcome(ctx.textOf(result));
				if (countOnly) {
					const total = Number.parseInt(String(outcome.rows[0]?._dbx_total ?? "0"), 10);
					return { kind: "count", connection: connectionName, total_count: Number.isFinite(total) ? total : 0 };
				}
				if (pageLimit) return { ...outcome, paged: true, pageable: true };
				return { ...outcome, pageable };
			}

			const errorText = ctx.textOf(result);
			const err = ctx.classifyError(errorText);
			const hint = await ctx.describeFailure(connectionName, sql, effectiveSql, errorText);
			throw engineError(err.code, `dbx_execute_query failed: ${err.detail}${hint}`, errorText);
		}],
	];
}

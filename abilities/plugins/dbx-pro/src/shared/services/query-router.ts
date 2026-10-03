/**
 * 查询路由 —— 面板取数的唯一入口，负责「引擎优先 + 自动降级 + 如实报路」。
 *
 * 三条硬规则（对应验收项）：
 *   1. 实际来源必须可观测：每次执行都返回 `path: "engine" | "cli"`，
 *      降级时附 `fallbackReason`（导致降级的引擎错误码）。面板禁止在降级时宣称走了引擎。
 *   2. 降级白名单：只有「引擎根本没用上」的错误才回退（未注册/未就绪、传输失败、
 *      非契约响应、驱动未实现）。**`TIMEOUT` 与任何 SQL 执行错误一律不回退** ——
 *      超时的写语句可能已经在引擎侧完成，换 CLI 再执行一次就是重复写入。
 *   3. 写闸门不放宽：引擎路径默认 `allowWrites:false`；CLI 路径先过插件侧保守闸门
 *      （`sql-write-guard.ts`），两道都要求显式开启才放行。
 *
 * 依赖通过 `QueryRouterDeps` 注入，便于在不启动引擎/CLI 的情况下做单测。
 */

import type { DbConnection, DbQueryResult } from "../../domain/connection-config";
import type { QueryPath } from "../../domain/query-history";
import type { EnginePreference } from "../../domain/workbench-settings";
import { supportsLocalCliFallback } from "../../domain/driver-tiers";
import { assertCliWriteAllowed } from "../../domain/sql-write-guard";
import { executeQuery as cliExecuteQuery } from "./query-service";
import {
	ENGINE_NOT_READY,
	EngineClientError,
	engineExecuteQuery,
	engineTestConnection,
	getEngineServices,
	toQueryResult,
	type EngineQueryOutcome,
} from "./engine-client";

export const ROUTE_TIMEOUT_DEFAULT_MS = 30_000;
export const ROUTE_TIMEOUT_MIN_MS = 1_000;
export const ROUTE_TIMEOUT_MAX_MS = 300_000;
export const ROUTE_TEST_TIMEOUT_MS = 10_000;
/** 连通性探测用的最小代价语句（与 query-service 的 testConnection 保持一致）。 */
export const ROUTE_TEST_SQL = "SELECT 1 AS ok";
/** 显式表达「按设置里的偏好」而不是「没给值」。 */
export const PREFERENCE_FROM_SETTINGS = "settings.enginePreference";

/** 触发自动降级的引擎错误码（白名单，刻意不含 TIMEOUT）。 */
export const ENGINE_FALLBACK_CODES: readonly string[] = Object.freeze([
	ENGINE_NOT_READY,
	"TRANSPORT_ERROR",
	"DRIVER_UNSUPPORTED",
	"BAD_RESPONSE",
]);

const FALLBACK_CODE_SET = new Set<string>(ENGINE_FALLBACK_CODES);

export interface RouteOptions {
	enginePreference?: EnginePreference;
	/** 显式超时（毫秒）；面板从设置里换算后传入，不依赖默认值 */
	timeoutMs?: number;
	/** 仅引擎路径生效：结果行数上限（不用于改写 SQL） */
	rowLimit?: number;
	/** 引擎与 CLI 共用的写开关，默认关闭 */
	allowWrites?: boolean;
	/** 连接级只读开关，优先级高于 allowWrites */
	readOnly?: boolean;
}

export interface RouteOutcome {
	result: DbQueryResult;
	path: QueryPath;
	/** 发生降级时，导致降级的引擎错误码（面板据此解释原因） */
	fallbackReason?: string;
	/** 引擎路径的结果被行数上限截断 */
	truncated?: boolean;
}

export interface EngineQueryCallOptions {
	allowWrites?: boolean;
	confirmedWriteSql?: string;
	rowLimit?: number;
	timeoutMs: number;
}

export interface QueryRouterDeps {
	/** 引擎服务是否已绑定到宿主能力 */
	engineBound(): boolean;
	engineQuery(connection: DbConnection, sql: string, options: EngineQueryCallOptions): Promise<EngineQueryOutcome>;
	engineProbe(connection: DbConnection, options: { timeoutMs: number }): Promise<unknown>;
	cliQuery(connection: DbConnection, sql: string, timeoutMs: number): Promise<DbQueryResult>;
}

export interface QueryRouter {
	execute(connection: DbConnection, sql: string, options?: RouteOptions): Promise<RouteOutcome>;
	test(connection: DbConnection, options?: RouteOptions): Promise<RouteOutcome>;
	/** 按偏好预判本次会走哪条路（面板在执行前显示来源） */
	resolvedPath(connection: DbConnection, options?: RouteOptions): QueryPath;
	/** 引擎是否已绑定（面板顶部状态条用） */
	engineBound(): boolean;
}

/** 取错误码（引擎错误、CLI 错误都带 code 字段）。 */
export function errorCodeOf(error: unknown): string {
	if (error && typeof error === "object") {
		const code = (error as { code?: unknown }).code;
		if (typeof code === "string" && code) return code;
		// 引擎侧走 request 通道时，错误可能被包一层
		const cause = (error as { cause?: unknown }).cause;
		if (cause && cause !== error) return errorCodeOf(cause);
	}
	return "";
}

/** 引擎错误码 → 人话。 */
export function describeEngineCode(code: string): string {
	switch (code) {
		case ENGINE_NOT_READY:
			return "引擎服务未注册或未就绪";
		case "TRANSPORT_ERROR":
			return "引擎连接失败（进程未启动或端口不可达）";
		case "BAD_RESPONSE":
			return "引擎返回非契约响应（可能版本不匹配）";
		case "DRIVER_UNSUPPORTED":
			return "引擎尚未实现该驱动";
		case "TIMEOUT":
			return "引擎请求超时";
		default:
			return `引擎返回错误 ${code || "UNKNOWN"}`;
	}
}

/** 降级原因文案（面板状态条显示）。 */
export function describeFallbackReason(code: string): string {
	return `${describeEngineCode(code)} → 已回退本地 sqlite3 CLI`;
}

export class RouteError extends EngineClientError {
	readonly engineCode: string;
	readonly canFallback: boolean;
	readonly fallbackSkipped: "no-local-fallback" | "code-not-eligible" | "preference-engine-only" | undefined;

	constructor(
		message: string,
		options: {
			code: string;
			status?: number;
			detail?: unknown;
			engineCode: string;
			canFallback: boolean;
			fallbackSkipped?: "no-local-fallback" | "code-not-eligible" | "preference-engine-only";
		},
	) {
		super(options.code, message, { status: options.status, detail: options.detail });
		this.name = "RouteError";
		this.engineCode = options.engineCode;
		this.canFallback = options.canFallback;
		this.fallbackSkipped = options.fallbackSkipped;
	}
}

export function clampRouteTimeout(value?: number): number {
	const numeric = Number.isFinite(value) ? Number(value) : ROUTE_TIMEOUT_DEFAULT_MS;
	return Math.min(Math.max(Math.trunc(numeric), ROUTE_TIMEOUT_MIN_MS), ROUTE_TIMEOUT_MAX_MS);
}

function messageOf(error: unknown): string {
	if (error instanceof Error && error.message) return error.message;
	return String(error);
}

/**
 * 不回退时的统一包装：把「为什么没回退」讲清楚，避免用户以为引擎错误是 SQL 错误。
 */
function asRouteError(
	error: unknown,
	context: {
		connection: DbConnection;
		canFallback: boolean;
		fallbackSkipped: "no-local-fallback" | "code-not-eligible" | "preference-engine-only";
	},
): RouteError {
	const code = errorCodeOf(error);
	const engineCode = error instanceof EngineClientError ? error.code : code;
	const reason = !context.canFallback
		? `该连接类型 ${context.connection.db_type} 没有本地 CLI 实现，无法回退。`
		: context.fallbackSkipped === "preference-engine-only"
			? "当前设置为「仅引擎」，按设置不回退。"
			: `引擎错误 ${engineCode || "UNKNOWN"} 不在回退白名单（仅 ${ENGINE_FALLBACK_CODES.join(" / ")} 会回退），不回退，避免重复执行。`;
	return new RouteError(`${messageOf(error)} ${reason}`, {
		code: engineCode || "ENGINE_ERROR",
		status: error instanceof EngineClientError ? error.status : undefined,
		detail: error instanceof EngineClientError ? error.detail : error,
		engineCode: engineCode || "ENGINE_ERROR",
		canFallback: context.canFallback,
		fallbackSkipped: context.fallbackSkipped,
	});
}

/** 引擎调用参数：写语句必须回传逐字节一致的原文（引擎 CONFIRM_MISMATCH 契约）。 */
function engineCallOptions(sql: string, options: RouteOptions, timeoutMs: number): EngineQueryCallOptions {
	const allowWrites = options.allowWrites === true;
	const rowLimit = Number.isFinite(options.rowLimit) && Number(options.rowLimit) > 0 ? Math.trunc(Number(options.rowLimit)) : undefined;
	return {
		allowWrites,
		...(allowWrites ? { confirmedWriteSql: sql } : {}),
		...(rowLimit ? { rowLimit } : {}),
		timeoutMs,
	};
}

/** CLI 路径：先过插件侧保守写闸门，再执行（SQL 原样送达，不做任何改写）。 */
async function runCli(
	deps: QueryRouterDeps,
	connection: DbConnection,
	sql: string,
	timeoutMs: number,
	options: RouteOptions,
): Promise<DbQueryResult> {
	assertCliWriteAllowed(sql, { allowWrites: options.allowWrites === true, readOnly: options.readOnly === true });
	return deps.cliQuery(connection, sql, timeoutMs);
}

function testResult(connection: DbConnection): DbQueryResult {
	return { connection: connection.name, columns: ["ok"], rows: [{ ok: 1 }], row_count: 1 };
}

export function createQueryRouter(overrides: Partial<QueryRouterDeps> = {}): QueryRouter {
	const deps: QueryRouterDeps = {
		engineBound: () => getEngineServices() !== null,
		engineQuery: (connection, sql, options) =>
			engineExecuteQuery(connection, sql, {
				allowWrites: options.allowWrites === true,
				...(options.confirmedWriteSql ? { confirmedWriteSql: options.confirmedWriteSql } : {}),
				...(options.rowLimit ? { rowLimit: options.rowLimit } : {}),
				timeoutMs: options.timeoutMs,
			}),
		engineProbe: (connection, options) => engineTestConnection(connection, { timeoutMs: options.timeoutMs }),
		cliQuery: (connection, sql, timeoutMs) => cliExecuteQuery(connection, sql, timeoutMs),
		...overrides,
	};

	const resolvedPath = (connection: DbConnection, options: RouteOptions = {}): QueryPath => {
		const preference = options.enginePreference ?? "auto";
		if (preference === "cli") return "cli";
		if (preference === "engine") return "engine";
		return deps.engineBound() ? "engine" : "cli";
	};

	const execute: QueryRouter["execute"] = async (connection, sql, options = {}) => {
		const preference = options.enginePreference ?? "auto";
		const timeoutMs = clampRouteTimeout(options.timeoutMs);
		const canFallback = supportsLocalCliFallback(connection.db_type);

		// 1. 显式指定只走 CLI
		if (preference === "cli") {
			const result = await runCli(deps, connection, sql, timeoutMs, options);
			return { result, path: "cli", fallbackReason: `${PREFERENCE_FROM_SETTINGS}=cli` };
		}

		// 2. 引擎可用 → 引擎优先
		if (deps.engineBound()) {
			try {
				const outcome = await deps.engineQuery(connection, sql, engineCallOptions(sql, options, timeoutMs));
				return {
					result: toQueryResult(outcome),
					path: "engine",
					...(outcome.truncated === true ? { truncated: true } : {}),
				};
			} catch (error) {
				const code = errorCodeOf(error);
				if (canFallback && FALLBACK_CODE_SET.has(code)) {
					const result = await runCli(deps, connection, sql, timeoutMs, options);
					return { result, path: "cli", fallbackReason: code };
				}
				throw asRouteError(error, {
					connection,
					canFallback,
					fallbackSkipped: canFallback ? "code-not-eligible" : "no-local-fallback",
				});
			}
		}

		// 3. 引擎未绑定
		if (preference === "engine") {
			throw new RouteError(
				`引擎服务未注册或未就绪，且当前设置为「仅引擎」，按设置不回退本地 sqlite3 CLI。${describeEngineCode(ENGINE_NOT_READY)}。`,
				{ code: ENGINE_NOT_READY, engineCode: ENGINE_NOT_READY, canFallback, fallbackSkipped: "preference-engine-only" },
			);
		}
		if (canFallback) {
			const result = await runCli(deps, connection, sql, timeoutMs, options);
			return { result, path: "cli", fallbackReason: ENGINE_NOT_READY };
		}
		throw new RouteError(
			`引擎服务未注册或未就绪，且连接类型 ${connection.db_type} 没有本地 CLI 实现，无法执行该查询。`,
			{ code: ENGINE_NOT_READY, engineCode: ENGINE_NOT_READY, canFallback: false, fallbackSkipped: "no-local-fallback" },
		);
	};

	const test: QueryRouter["test"] = async (connection, options = {}) => {
		const preference = options.enginePreference ?? "auto";
		const timeoutMs = clampRouteTimeout(options.timeoutMs ?? ROUTE_TEST_TIMEOUT_MS);
		const canFallback = supportsLocalCliFallback(connection.db_type);

		if (preference !== "cli" && deps.engineBound()) {
			try {
				await deps.engineProbe(connection, { timeoutMs });
				return { result: testResult(connection), path: "engine" };
			} catch (error) {
				const code = errorCodeOf(error);
				if (canFallback && FALLBACK_CODE_SET.has(code) && preference === "auto") {
					const result = await runCli(deps, connection, ROUTE_TEST_SQL, timeoutMs, options);
					return { result, path: "cli", fallbackReason: code };
				}
				throw asRouteError(error, {
					connection,
					canFallback,
					fallbackSkipped: canFallback
						? preference === "engine"
							? "preference-engine-only"
							: "code-not-eligible"
						: "no-local-fallback",
				});
			}
		}

		if (preference === "engine") {
			throw new RouteError(`引擎服务未注册或未就绪，且当前设置为「仅引擎」，无法测试该连接。`, {
				code: ENGINE_NOT_READY,
				engineCode: ENGINE_NOT_READY,
				canFallback,
				fallbackSkipped: "preference-engine-only",
			});
		}
		const result = await runCli(deps, connection, ROUTE_TEST_SQL, timeoutMs, options);
		return { result, path: "cli", ...(deps.engineBound() ? { fallbackReason: ENGINE_NOT_READY } : {}) };
	};

	return {
		execute,
		test,
		resolvedPath,
		engineBound: () => deps.engineBound(),
	};
}

/** 面板使用的默认实例（引擎绑定在插件装配层完成）。 */
export const queryRouter = createQueryRouter();

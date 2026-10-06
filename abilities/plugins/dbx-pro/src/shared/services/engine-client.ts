/**
 * 引擎服务的插件侧客户端。
 *
 * 只做一件事：把「引擎 HTTP 契约」翻译成插件可用的类型化函数。安装 / 启动 / 传输全部
 * 留在宿主侧（providers.services），本模块不碰文件、不碰端口、不碰 secrets。
 *
 * 为什么要自己声明 EngineServicesApi：
 *   - `ctx` 句柄来自 src/runtime-contract.ts，但那里的 requireCtx() 不对外导出，且该文件
 *     不在本次改动范围内；这里用结构化类型局部声明所需的那几个方法（不 import SDK 深类型，
 *     避免 MF 空闲超时）。等 D2 接面板时再把 runtime-contract 的上下文补进来。
 *   - 声明成 `| null` 并在未绑定时抛出 ENGINE_NOT_READY，比静默失败更容易定位。
 *
 * 超时：宿主 request 默认 30s、上限 5min。查询一定要显式传 timeoutMs，
 * 否则连接池/慢查询会正好压在默认边界上。
 */

import type { DbQueryResult } from "../../domain/connection-config";

export const ENGINE_SERVICE_ID = "dbx-engine";
export const ENGINE_NOT_READY = "ENGINE_NOT_READY";
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_TIMEOUT_MS = 300_000;
export const TEST_TIMEOUT_MS = 10_000;

/** 宿主 ctx.services 的最小结构面（见 plugin-sdk service-provider.d.ts）。 */
export interface EngineServicesApi {
	request<T = unknown>(
		serviceId: string,
		request: {
			path: string;
			method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
			credentialId?: string;
			headers?: Record<string, string>;
			body?: unknown;
			responseType?: "json" | "text";
			timeoutMs?: number;
		},
	): Promise<EngineServiceResponse<T>>;
}

export interface EngineServiceResponse<T = unknown> {
	ok: boolean;
	status: number;
	statusText: string;
	headers: Record<string, string>;
	body: T;
}

let services: EngineServicesApi | null = null;

/** 由插件装配层在拿到 ctx 后调用；传 null 可解绑（例如禁用时）。 */
export function bindEngineServices(api: EngineServicesApi | null): void {
	services = api;
}

export function getEngineServices(): EngineServicesApi | null {
	return services;
}

export class EngineClientError extends Error {
	readonly code: string;
	readonly status?: number;
	readonly detail?: unknown;

	constructor(code: string, message: string, options: { status?: number; detail?: unknown } = {}) {
		super(message);
		this.name = "EngineClientError";
		this.code = code;
		this.status = options.status;
		this.detail = options.detail;
	}
}

/** 引擎错误信封（与 service/src/engine/protocol.mjs 一致）。 */
export type EngineEnvelope<T> =
	| { ok: true; data: T }
	| { ok: false; error: { code: string; message: string; detail?: unknown } };

export interface EngineStatementResult {
	sql: string;
	kind: string;
	columns: string[];
	rows: Record<string, unknown>[];
	row_count: number;
	affected_rows: number;
	truncated: boolean;
	last_insert_rowid?: number;
}

export interface EngineQueryOutcome {
	connection: string | null;
	kind: string;
	statement_count: number;
	statements: EngineStatementResult[];
	truncated: boolean;
	/** SQL 支持服务端分页（单条 SELECT/WITH、无自带分页子句）。 */
	pageable?: boolean;
	/** 本次响应是服务端分页中的一页。 */
	paged?: boolean;
	/** countOnly 响应的真实总行数。 */
	total_count?: number;
	row_limit: number;
	/** 引擎实际施加的行数上限（已按制品硬上限夹紧）。截断提示要引用它。 */
	max_rows: number;
	/** 引擎真实返回的行数，可能多于 max_rows / row_limit（已被引擎侧裁剪）。 */
	engine_row_count?: number;
	timeout_ms: number;
	duration_ms: number;
	columns: string[];
	rows: Record<string, unknown>[];
	row_count: number;
	affected_rows: number;
}

export interface EngineHealth {
	status: string;
	version: string;
	protocol: number;
	pid: number;
	node: string;
	platform: string;
	uptimeMs: number;
	auth: "enabled" | "disabled";
	pool: { size: number; invalidations: number; connections: { key: string; idleMs: number }[] };
	drivers: { id: string; label: string; tier: string; ready: boolean; reason?: string }[];
}

interface CallOptions {
	/** 覆盖默认超时；会被夹在 1s ~ 5min 之间。 */
	timeoutMs?: number;
	/** 覆盖 HTTP 方法（删除连接必须用 DELETE，否则会误命中 POST 新增处理器）。 */
	method?: "GET" | "POST" | "DELETE" | "PUT";
}

function clampTimeout(timeoutMs?: number): number {
	const value = Number.isFinite(timeoutMs) ? Number(timeoutMs) : DEFAULT_TIMEOUT_MS;
	return Math.min(Math.max(value, 1_000), MAX_TIMEOUT_MS);
}

function toEngineClientError(error: unknown): EngineClientError {
	if (error instanceof EngineClientError) return error;
	const message = error instanceof Error ? error.message : String(error);
	if (/timeout|timed out/i.test(message)) {
		return new EngineClientError("TIMEOUT", `引擎请求超时：${message}`, { detail: error });
	}
	return new EngineClientError("TRANSPORT_ERROR", message, { detail: error });
}

async function engineRequest<T>(path: string, body: unknown, options: CallOptions = {}): Promise<T> {
	const api = services;
	if (!api) {
		throw new EngineClientError(
			ENGINE_NOT_READY,
			"引擎服务尚未绑定：插件装配层需要先调用 bindEngineServices(ctx.services)",
		);
	}
	let response: EngineServiceResponse<EngineEnvelope<T>>;
	try {
		response = await api.request<EngineEnvelope<T>>(ENGINE_SERVICE_ID, {
			path,
			method: options.method ?? (body === undefined ? "GET" : "POST"),
			body,
			timeoutMs: clampTimeout(options.timeoutMs),
		});
	} catch (error) {
		const msg = error instanceof Error ? error.message : String(error);
		if (msg.includes("Service is not ready") || msg.includes("not ready")) {
			throw new EngineClientError(
				ENGINE_NOT_READY,
				"引擎服务正在启动中，请稍等片刻后重试",
				{ detail: error },
			);
		}
		throw toEngineClientError(error);
	}
	const envelope = response.body;
	if (!envelope || typeof envelope !== "object" || typeof envelope.ok !== "boolean") {
		throw new EngineClientError("BAD_RESPONSE", `引擎返回了非契约响应（HTTP ${response.status}）`, {
			status: response.status,
			detail: envelope,
		});
	}
	if (envelope.ok) return envelope.data;
	const errCode = envelope.error?.code ?? "ENGINE_ERROR";
	const errMsg = envelope.error?.message ?? "引擎调用失败";
	if (errMsg.includes("no PostgreSQL user name") || errMsg.includes("28000")) {
		throw new EngineClientError(errCode, "数据库连接缺少用户名，请检查连接配置", {
			status: response.status,
			detail: envelope.error?.detail,
		});
	}
	throw new EngineClientError(errCode, errMsg, {
		status: response.status,
		detail: envelope.error?.detail,
	});
}

/** 健康检查：宿主侧探测同样走这里。 */
export function engineHealth(options: CallOptions = {}): Promise<EngineHealth> {
	return engineRequest<EngineHealth>("/health", undefined, { timeoutMs: options.timeoutMs ?? TEST_TIMEOUT_MS });
}

export interface EngineExecuteOptions extends CallOptions {
	/** 显式授权写操作；引擎只读拦截后由自研写驱动执行。 */
	allowWrite?: boolean;
	/** 危险语句必须回传与 SQL 逐字节一致的原文，否则引擎返回 CONFIRM_MISMATCH。 */
	confirmedWriteSql?: string;
	rowLimit?: number;
	/** 服务端分页：请求该 offset/limit 对应的一页。 */
	page?: { offset: number; limit: number };
	/** 只取总数（包 COUNT 派生表），响应读 total_count。 */
	countOnly?: boolean;
	/** SQL 方言（分页重写需要）。 */
	dbType?: string;
	/** 写驱动所需的完整连接配置（db_type/host/port/凭据/库）。 */
	connection?: {
		db_type?: string;
		dbType?: string;
		host: string;
		port?: number;
		username?: string;
		password?: string;
		database?: string;
		ssl?: boolean;
		read_only?: boolean;
	};
}

// ─── 新版 API：基于 connectionName（引擎连接自管）──────────────

export interface EngineConnectionSummary {
	id: string;
	name: string;
	groupPath: string;
	type: string;
	host: string;
	port: number;
	database: string;
}

export interface EngineListTablesOutcome {
	connection: string;
	tables: { name: string; kind: string }[];
}

export interface EngineListSchemasOutcome {
	connection: string;
	schemas: string[];
	/** 该库是否有 schema 概念（false 时前端渲染扁平表树）。 */
	supported: boolean;
}

export interface EngineDescribeOutcome {
	connection: string;
	table: string;
	columns: { name: string; type: string; nullable: boolean; hasDefault: boolean; defaultValue: string; comment: string; isPrimaryKey: boolean }[];
}

/** 列出所有已保存连接（GET /connections）。 */
export function engineListConnections(options: CallOptions = {}): Promise<{ connections: EngineConnectionSummary[] }> {
	return engineRequest<{ connections: EngineConnectionSummary[] }>("/connections", undefined, options);
}

/** 新增连接（POST /connections，引擎侧按名称幂等）。 */
export function engineAddConnection(
	spec: { name: string; dbType: string; host: string; port?: number; username?: string; password?: string; database?: string; ssl?: boolean },
	options: CallOptions = {},
): Promise<{ id: string; name: string; detail?: string; existing?: boolean }> {
	return engineRequest<{ id: string; name: string; detail?: string; existing?: boolean }>("/connections", spec, options);
}

/** 删除连接（DELETE /connections）。 */
export function engineRemoveConnection(name: string, options: CallOptions = {}): Promise<{ deleted: string }> {
	// 必须显式 DELETE：默认带 body 会发 POST，命中新增连接处理器导致删除无效。
	return engineRequest<{ deleted: string }>("/connections", { name }, { ...options, method: "DELETE" });
}

/** 测试连接（已存或草稿，POST /connections/test）。 */
export function engineTestConnectionByName(
	connectionName?: string,
	draft?: Record<string, unknown>,
	options: CallOptions = {},
): Promise<{ tableCount: number; detail?: string }> {
	const body: Record<string, unknown> = {};
	if (connectionName) body.connectionName = connectionName;
	if (draft) body.draft = draft;
	return engineRequest<{ tableCount: number; detail?: string }>("/connections/test", body, { timeoutMs: options.timeoutMs ?? TEST_TIMEOUT_MS });
}

/** 列出连接下全部表（POST /tables）。 */
export function engineListTables(
	connectionName: string,
	scope?: { schema?: string; database?: string },
	options: CallOptions = {},
): Promise<EngineListTablesOutcome> {
	return engineRequest<EngineListTablesOutcome>("/tables", { connectionName, scope: scope ?? {} }, options);
}

/**
 * 列出连接的 schema（POST /schemas）。
 * 库不支持目录视图时引擎返回 supported=false + 空列表，调用方据此隐藏 schema 层。
 * dbType 用于选择方言对应的目录查询（PG 查 pg_namespace 等）。
 */
export function engineListSchemas(
	connectionName: string,
	dbType?: string,
	options: CallOptions = {},
): Promise<EngineListSchemasOutcome> {
	return engineRequest<EngineListSchemasOutcome>(
		"/schemas",
		{ connectionName, dbType },
		{ timeoutMs: options.timeoutMs ?? TEST_TIMEOUT_MS },
	);
}

/** 查看表结构（POST /describe，用 connectionName）。 */
export function engineDescribeByName(
	connectionName: string,
	target: { schema?: string; table: string },
	options: CallOptions = {},
): Promise<EngineDescribeOutcome> {
	return engineRequest<EngineDescribeOutcome>("/describe", { connectionName, target }, options);
}

/** 执行 SQL（POST /query）——直接用 connectionName，不走 connection spec。 */
export function engineExecuteByName(
	connectionName: string,
	sql: string,
	options: EngineExecuteOptions = {},
): Promise<EngineQueryOutcome> {
	const body: Record<string, unknown> = {
		connectionName,
		sql,
		allowWrite: options.allowWrite === true,
		confirmedWriteSql: options.confirmedWriteSql,
		rowLimit: options.rowLimit,
		timeoutMs: clampTimeout(options.timeoutMs),
	};
	if (options.page) body.page = options.page;
	if (options.countOnly) body.countOnly = true;
	if (options.dbType) body.dbType = options.dbType;
	if (options.connection) body.connection = options.connection;
	return engineRequest<EngineQueryOutcome>(
		"/query",
		body,
		{ timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS },
	);
}

/**
 * 在系统文件管理器中定位并选中文件（POST /reveal）。
 * 导出完成态「打开所在文件夹」的真实入口：由 host-node 引擎服务执行
 * open -R / explorer /select / xdg-open，10s 预算。
 */
export function engineRevealInFolder(
	fsPath: string,
	options: CallOptions = {},
): Promise<{ revealed: boolean; platform: string }> {
	return engineRequest<{ revealed: boolean; platform: string }>(
		"/reveal",
		{ path: fsPath },
		{ timeoutMs: options.timeoutMs ?? 10_000 },
	);
}

/**
 * 引擎结果 → 旧 UI 期望的 DbQueryResult（只展示最后一个结果集，多语句时附 note）。
 * 与 query-service.ts 的语义保持一致，便于 D2 面板无痛切换。
 */
export function toQueryResult(outcome: EngineQueryOutcome): DbQueryResult {
	const notes: string[] = [];
	if (outcome.statement_count > 1) {
		notes.push(`已执行 ${outcome.statement_count} 条语句，仅展示最后一个结果集`);
	}
	if (outcome.truncated && !outcome.paged) {
		// 仅常规读（非分页页请求）达到单次上限才提示：SQL 未强制 LIMIT 时
		// 结果在引擎硬上限处截断。分页页请求不在这里提示（导航本身即继续查看）。
		notes.push(`结果达到单次取回上限 ${outcome.max_rows} 行，仅展示前 ${outcome.max_rows} 行；如需全部请在 SQL 中使用 LIMIT/OFFSET`);
	}
	return {
		connection: outcome.connection ?? "",
		columns: outcome.columns,
		rows: outcome.rows,
		row_count: outcome.row_count,
		// 服务端分页页响应：网格走服务端翻页模式。
		...(outcome.paged ? { paged: true } : {}),
		...(notes.length > 0 ? { note: notes.join("；") } : {}),
	};
}

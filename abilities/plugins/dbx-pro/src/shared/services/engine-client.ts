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
			method: body === undefined ? "GET" : "POST",
			body,
			timeoutMs: clampTimeout(options.timeoutMs),
		});
	} catch (error) {
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
	throw new EngineClientError(envelope.error?.code ?? "ENGINE_ERROR", envelope.error?.message ?? "引擎调用失败", {
		status: response.status,
		detail: envelope.error?.detail,
	});
}

/** 健康检查：宿主侧探测同样走这里。 */
export function engineHealth(options: CallOptions = {}): Promise<EngineHealth> {
	return engineRequest<EngineHealth>("/health", undefined, { timeoutMs: options.timeoutMs ?? TEST_TIMEOUT_MS });
}

export interface EngineExecuteOptions extends CallOptions {
	/** 显式授权写操作；dbx-mcp 只读拦截后由自研写驱动执行。 */
	allowWrite?: boolean;
	/** 危险语句必须回传与 SQL 逐字节一致的原文，否则引擎返回 CONFIRM_MISMATCH。 */
	confirmedWriteSql?: string;
	rowLimit?: number;
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

// ─── 新版 API：基于 connectionName（dbx-mcp 连接自管）──────────────

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
	return engineRequest<{ deleted: string }>("/connections", { name }, options);
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
 */
export function engineListSchemas(
	connectionName: string,
	options: CallOptions = {},
): Promise<EngineListSchemasOutcome> {
	return engineRequest<EngineListSchemasOutcome>(
		"/schemas",
		{ connectionName },
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
	if (options.connection) body.connection = options.connection;
	return engineRequest<EngineQueryOutcome>(
		"/query",
		body,
		{ timeoutMs: options.timeoutMs ?? DEFAULT_TIMEOUT_MS },
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
	if (outcome.truncated) {
		// 说清是谁截断的：用户自己设的上限，还是宿主导品的硬上限。
		// 混为一谈会让用户调大设置却发现没用，白白反复试。
		const engineRows = outcome.engine_row_count;
		notes.push(
			engineRows !== undefined && engineRows <= outcome.max_rows && outcome.row_limit > outcome.max_rows
				? `结果已截断到 ${outcome.max_rows} 行（宿主 dbx-mcp 单次上限）`
				: `结果已按设置的 ${outcome.row_limit} 行上限截断`,
		);
	}
	return {
		connection: outcome.connection ?? "",
		columns: outcome.columns,
		rows: outcome.rows,
		row_count: outcome.row_count,
		...(notes.length > 0 ? { note: notes.join("；") } : {}),
	};
}

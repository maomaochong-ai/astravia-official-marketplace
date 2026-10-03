/**
 * 自研写驱动 — 上游 dbx-mcp 默认只读（写操作返回 SQL_BLOCKED）。
 *
 * 仅在 dbx-mcp 拒绝写操作时启用；读路径仍走 dbx-mcp。
 * 支持三大家族（覆盖主流 SQL 数据库）：
 *   pg 系：postgres/postgresql/redhift…     → pg
 *   mysql 系：mysql/mariadb/tidb…           → mysql2/promise
 *   mssql 系：sqlserver/mssql               → mssql
 *
 * 安全：调用方（request-router）只在 body.allowWrite 且确认文本匹配时调用，
 * 并已在 UI 层做过危险操作确认，本层不静默执行任何写。
 */

import mssql from "mssql";
import mysql from "mysql2/promise";
import pg from "pg";

/** dbType → 驱动家族。 */
function familyOf(dbType) {
	const type = String(dbType ?? "").toLowerCase();
	if (/^(postgres|pg|redhift|greenplum|cockroach)/.test(type)) return "pg";
	if (/^(mysql|maria|tidb|starrocks|doris|oceanbase$|gauss.*mysql)/.test(type)) return "mysql";
	if (/^(mssql|sqlserver)/.test(type)) return "mssql";
	return null;
}

export function supportsWrite(dbType) {
	return familyOf(dbType) !== null;
}

function connectionSpec(spec) {
	return {
		host: spec.host,
		port: spec.port ? Number(spec.port) : undefined,
		user: spec.username,
		password: spec.password,
		database: spec.database,
		ssl: spec.ssl ? { rejectUnauthorized: false } : undefined,
	};
}

async function runPg(spec, sql) {
	const client = new pg.Client({
		...connectionSpec(spec),
		connectionTimeoutMillis: 15_000,
	});
	await client.connect();
	try {
		const result = await client.query(sql);
		return {
			command: result.command,
			columns: (result.fields ?? []).map((field) => field.name),
			rows: result.rows ?? [],
			affectedRows: typeof result.rowCount === "number" ? result.rowCount : null,
		};
	} finally {
		await client.end().catch(() => {});
	}
}

async function runMysql(spec, sql) {
	const conn = await mysql.createConnection({
		host: spec.host,
		port: spec.port ? Number(spec.port) : undefined,
		user: spec.username,
		password: spec.password,
		database: spec.database,
		ssl: spec.ssl ? { rejectUnauthorized: false } : undefined,
		connectTimeout: 15_000,
	});
	try {
		const [data, fields] = await conn.query(sql);
		// DML：data 是 OkPacket（含 affectedRows）；SELECT：data 是行数组
		if (Array.isArray(data)) {
			return {
				command: "SELECT",
				columns: (fields ?? []).map((field) => field.name),
				rows: data,
				affectedRows: null,
			};
		}
		return {
			command: String(data.command ?? "").toUpperCase(),
			columns: [],
			rows: [],
			affectedRows: data.affectedRows ?? null,
		};
	} finally {
		await conn.end().catch(() => {});
	}
}

async function runMssql(spec, sql) {
	const pool = await mssql.connect({
		server: spec.host,
		port: spec.port ? Number(spec.port) : undefined,
		user: spec.username,
		password: spec.password,
		database: spec.database,
		connectionTimeout: 15_000,
		options: { encrypt: false, trustServerCertificate: true },
	});
	try {
		const result = await pool.request().query(sql);
		const rows = result.recordset ?? [];
		const affectedRows = Array.isArray(result.rowsAffected)
			? result.rowsAffected.reduce((sum, n) => sum + Number(n), 0)
			: null;
		return {
			command: rows.length > 0 ? "SELECT" : "",
			columns: (result.columns ?? []).map((col) => col.name),
			rows,
			affectedRows,
		};
	} finally {
		await pool.close().catch(() => {});
	}
}

/**
 * 执行写 / DDL。
 * @param {{db_type: string, host: string, port?: number, username?: string, password?: string, database?: string, ssl?: boolean}} spec
 * @param {string} sql
 */
export async function executeWrite(spec, sql) {
	const family = familyOf(spec.db_type);
	if (!family) {
		const error = new Error(`dbx-pro 写驱动暂不支持数据库类型：${spec.db_type}（只读查询仍可用）`);
		error.code = "WRITE_UNSUPPORTED";
		throw error;
	}
	if (spec.read_only) {
		const error = new Error("连接已设为只读，写操作被拒绝");
		error.code = "CONNECTION_READ_ONLY";
		throw error;
	}
	if (family === "pg") return runPg(spec, sql);
	if (family === "mysql") return runMysql(spec, sql);
	return runMssql(spec, sql);
}

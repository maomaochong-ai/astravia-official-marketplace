/**
 * 自研写驱动 — 写 / DDL 的唯一执行路径。
 *
 * 为什么不用 dbx-mcp 执行写：它的写权限来自 dbx 自己的持久化 MCP settings，
 * 进程级 env 只能收紧不能放宽（DBX_MCP_ALLOW_WRITES=1 不解锁，=0 才强制只读，
 * 见 dbx crates/dbx-mcp/src/backend.rs）。插件既无权也不应该改用户的 dbx 全局设置，
 * 因此写操作在这里执行 —— dbx-mcp 子进程在任何路径下都保持零提权。
 *
 * 覆盖三大家族（主流 SQL 数据库）：
 *   pg 系：postgres/postgresql/redshift…     → pg
 *   mysql 系：mysql/mariadb/tidb…           → mysql2/promise
 *   mssql 系：sqlserver/mssql               → mssql
 *
 * 安全：调用方（request-router）只在 body.allowWrite 且确认文本与 SQL 逐字节一致时调用，
 * 且 UI 层已弹出写确认框；本层不静默执行任何写。
 * 事务：含多条写/DDL 语句时默认包在显式事务里，任一语句失败即整体回滚，避免半写状态。
 *   注意这只是尽力保证，不是数据库级原子性：MySQL / MariaDB 的 DDL 会隐式提交，
 *   脚本里混了 DDL 时回滚只能覆盖 DML 部分。真正需要原子性请让用户显式写
 *   BEGIN/COMMIT 或用存储过程。
 */

import mssql from "mssql";
import mysql from "mysql2/promise";
import pg from "pg";

/** dbType → 驱动家族。 */
export function familyOf(dbType) {
	const type = String(dbType ?? "").toLowerCase();
	if (/^(postgres|pg|redhift|greenplum|cockroach)/.test(type)) return "pg";
	if (/^(mysql|maria|tidb|starrocks|doris|oceanbase$|gauss.*mysql)/.test(type)) return "mysql";
	if (/^(mssql|sqlserver)/.test(type)) return "mssql";
	return null;
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

async function runPg(spec, sql, { transactional }) {
	const client = new pg.Client({
		...connectionSpec(spec),
		connectionTimeoutMillis: 15_000,
	});
	await client.connect();
	try {
		// 多语句脚本：pg 返回结果数组；显式事务保证「全成或全败」。
		if (transactional) await client.query("BEGIN");
		try {
			const result = await client.query(sql);
			if (transactional) await client.query("COMMIT");
			return pickPgResult(result);
		} catch (e) {
			if (transactional) await client.query("ROLLBACK").catch(() => {});
			throw e;
		}
	} finally {
		await client.end().catch(() => {});
	}
}

/**
 * pg 多语句返回结果数组；取最后一个有行的结果集作为展示集。
 *
 * 影响行数必须按 `command` 判断，不能看 `rows` —— pg 对每条语句都给出 `rows`
 * 数组（DML 时是空数组），用 `Array.isArray(r.rows)` 过滤会让影响行数恒为 0，
 * 于是 `affectedRows` 永远是 null，UI 上的「N 行受影响」全部丢失。
 */
function pickPgResult(result) {
	const candidates = Array.isArray(result) ? result : [result];
	const withRows = candidates.filter((r) => Array.isArray(r?.rows) && r.rows.length > 0);
	const picked = withRows[withRows.length - 1] ?? candidates[candidates.length - 1] ?? {};
	const affected = candidates.reduce((sum, r) => {
		if (r?.command === "SELECT") return sum;
		return sum + (typeof r?.rowCount === "number" ? r.rowCount : 0);
	}, 0);
	return {
		command: String(picked.command ?? "").toUpperCase(),
		columns: (picked.fields ?? []).map((field) => field.name),
		rows: picked.rows ?? [],
		affectedRows: affected > 0 ? affected : null,
	};
}

async function runMysql(spec, sql, { transactional }) {
	const conn = await mysql.createConnection({
		host: spec.host,
		port: spec.port ? Number(spec.port) : undefined,
		user: spec.username,
		password: spec.password,
		database: spec.database,
		// 堆叠查询只在真的要多语句时打开：单语句写并不需要它，
		// 而它是 SQL 注入里最常见的放大器，不该默认开着。
		multipleStatements: transactional,
		ssl: spec.ssl ? { rejectUnauthorized: false } : undefined,
		connectTimeout: 15_000,
	});
	try {
		if (transactional) await conn.beginTransaction();
		try {
			const [data, fields] = await conn.query(sql);
			if (transactional) await conn.commit();
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
		} catch (e) {
			if (transactional) await conn.rollback().catch(() => {});
			throw e;
		}
	} finally {
		await conn.end().catch(() => {});
	}
}

async function runMssql(spec, sql, { transactional }) {
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
		const request = pool.request();
		const result = transactional
			? await request.transaction((tx) => tx.query(sql))
			: await request.query(sql);
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
 * 粗判 SQL 是否含多条语句（忽略字符串 / 注释里的分号）。
 *
 * 已知不覆盖的方言语法：PostgreSQL 的美元引用（`$$ … $$`）和 MySQL 的
 * `DELIMITER`。这两种写法会让函数体内的分号被当成语句边界。
 * 后果可控：误判为多语句只是多包一层事务（DDL 仍可能隐式提交），
 * 漏判才会让第二段语句裸跑 —— 因此宁可多判。
 */
export function looksMultiStatement(sql) {
	let inSingle = false, inDouble = false, inLineComment = false, inBlockComment = false;
	for (let i = 0; i < sql.length; i++) {
		const ch = sql[i], next = sql[i + 1];
		if (inLineComment) { if (ch === "\n") inLineComment = false; continue; }
		if (inBlockComment) { if (ch === "*" && next === "/") { inBlockComment = false; i++; } continue; }
		if (!inSingle && !inDouble && ch === "-" && next === "-") { inLineComment = true; i++; continue; }
		if (!inSingle && !inDouble && ch === "/" && next === "*") { inBlockComment = true; i++; continue; }
		if (ch === "'" && !inDouble) { inSingle = !inSingle; continue; }
		if (ch === '"' && !inSingle) { inDouble = !inDouble; continue; }
		if (ch === ";" && !inSingle && !inDouble) {
			// 分号后若只剩空白 / 注释，则不算新语句
			const rest = sql.slice(i + 1).replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, "").trim();
			if (rest.length > 0) return true;
		}
	}
	return false;
}

/**
 * 执行写 / DDL。
 * @param {{db_type: string, host: string, port?: number, username?: string, password?: string, database?: string, ssl?: boolean, read_only?: boolean}} spec
 * @param {string} sql
 */
export async function executeWrite(spec, sql) {
	const family = familyOf(spec.db_type);
	if (!family) {
		const error = new Error(
			`暂不支持 ${spec.db_type} 的写操作：写驱动覆盖 PostgreSQL / MySQL 系 / SQL Server 三大家族，其余类型请在 dbx 桌面端执行`,
		);
		error.code = "WRITE_UNSUPPORTED";
		throw error;
	}
	if (spec.read_only) {
		const error = new Error("连接已设为只读，写操作被拒绝");
		error.code = "CONNECTION_READ_ONLY";
		throw error;
	}
	const options = { transactional: looksMultiStatement(sql) };
	if (family === "pg") return runPg(spec, sql, options);
	if (family === "mysql") return runMysql(spec, sql, options);
	return runMssql(spec, sql, options);
}

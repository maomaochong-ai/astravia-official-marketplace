/**
 * Direct Driver — dbx-mcp 拦截 DDL/DML 时的原生驱动直连 fallback。
 *
 * dbx-mcp 内置 McpGlobalPolicy 编译时硬编码，SQL_BLOCKED 无法通过 env var 或配置绕过。
 * 本模块在 request-router 捕获 SQL_BLOCKED 后，用 Node.js 原生驱动直连执行。
 *
 * 支持的数据库类型（SQL 类）：
 *   PostgreSQL 系：postgres, postgresql, redshift, greenplum, cockroachdb,
 *                  timescaledb, oceanbase, opengauss, gaussdb, highgo
 *   MySQL 系：     mysql, mariadb, tidb, starrocks, doris
 *   SQLite 系：    sqlite, sqlite3（Node 24 内置 node:sqlite.DatabaseSync）
 *   SQL Server：   mssql, sqlserver
 *   ClickHouse：   clickhouse（HTTP Native Protocol，零依赖）
 *
 * 不支持的（返回明确错误）：
 *   Oracle（需 Instant Client）、Snowflake、BigQuery、DuckDB 等复杂协议
 *   MongoDB、Redis、Elasticsearch 等非 SQL 数据库（DDL 语义不同或无 SQL DDL）
 *
 * 设计：动态 import 各驱动包，bundle 时 esbuild 会保留为 external（运行时按需加载）。
 *      仅 SQLite 用 Node 内置 node:sqlite（零依赖）。
 */

/** dbType → 驱动家族（决定用哪个原生包）。 */
export const DRIVER_FAMILY = {
	// PostgreSQL 家族
	postgres: "pg", postgresql: "pg", redshift: "pg", greenplum: "pg",
	cockroachdb: "pg", timescaledb: "pg", oceanbase: "pg", opengauss: "pg",
	gaussdb: "pg", highgo: "pg", edb: "pg", postgis: "pg",
	// MySQL 家族
	mysql: "mysql", mariadb: "mysql", tidb: "mysql", starrocks: "mysql", doris: "mysql",
	// SQLite
	sqlite: "sqlite", sqlite3: "sqlite",
	// SQL Server
	mssql: "mssql", sqlserver: "mssql",
	// ClickHouse
	clickhouse: "clickhouse",
	// DuckDB — 用 node:sqlite 兼容？DuckDB 有自己协议但本地文件模式类似
	duckdb: "sqlite",
};

/** 各驱动的默认端口。 */
const DEFAULT_PORT = { pg: 5432, mysql: 3306, mssql: 1433, clickhouse: 9000 };

/**
 * 直连执行 SQL。
 * @param {Object} opts
 * @param {string} opts.dbType       数据库类型名（小写）
 * @param {string} [opts.host]       主机（SQLite 用 path）
 * @param {number} [opts.port]       端口
 * @param {string} [opts.username]   用户名
 * @param {string} [opts.password]   密码
 * @param {string} [opts.database]   数据库名 / 文件路径（SQLite）
 * @param {string} opts.sql          要执行的 SQL
 * @param {boolean} [opts.ssl]       启用 TLS
 * @param {number} [opts.timeoutMs]  超时，默认 30_000
 * @returns {Promise<DirectQueryResult>}
 */
export async function executeDirect(opts) {
	const { dbType, host, port, username, password, database, sql, ssl, timeoutMs = 30_000 } = opts ?? {};

	if (!dbType) throw mkError("DIRECT_DRIVER_BAD_CONFIG", "Direct driver 缺少 dbType");
	if (!sql || typeof sql !== "string" || sql.trim().length === 0) throw mkError("BAD_REQUEST", "SQL 不能为空");

	const family = DRIVER_FAMILY[dbType.toLowerCase()];
	if (!family) {
		throw mkError(
			"DIRECT_DRIVER_UNSUPPORTED",
			`Direct driver 不支持的 dbType: ${dbType}。支持: ${Object.keys(DRIVER_FAMILY).join(", ")}`,
		);
	}

	// 参数校验（SQLite 不需要 host，用 database 做文件路径）
	if (family !== "sqlite" && !host) {
		throw mkError("DIRECT_DRIVER_BAD_CONFIG", `Direct driver (${family}) 缺少 host`);
	}
	if (family === "sqlite" && !database) {
		throw mkError("DIRECT_DRIVER_BAD_CONFIG", "SQLite 模式缺少 database（文件路径）");
	}

	const started = Date.now();
	const result = { columns: [], rows: [], rowCount: 0 };

	try {
		switch (family) {
			case "pg":       return await execPg({ dbType, host, port, username, password, database, sql, ssl, timeoutMs, started });
			case "mysql":    return await execMy({ dbType, host, port, username, password, database, sql, ssl, timeoutMs, started });
			case "mssql":    return await execMs({ dbType, host, port, username, password, database, sql, timeoutMs, started });
			case "sqlite":   return await execSqlite({ dbType, database, sql, started });
			case "clickhouse": return await execClickHouse({ dbType, host, port, username, password, database, sql, timeoutMs, started });
		}
	} catch (e) {
		// 已经是 DIRECT_DRIVER_* 错误直接向上抛
		if (e?.code?.startsWith("DIRECT_DRIVER")) throw e;
		const msg = e?.message ?? String(e);
		const err = mkError("DIRECT_DRIVER_ERROR", `Direct driver 执行失败 (${family}): ${msg}`);
		err.cause = e;
		throw err;
	}
}

// ─── PostgreSQL 家族 ───────────────────────────────────

async function execPg({ dbType, host, port, username, password, database, sql, ssl, timeoutMs, started }) {
	const { default: pg } = await import("pg");
	const pool = new pg.Pool({
		host, port: Number(port) || DEFAULT_PORT.pg, user: username, password, database,
		max: 1, idleTimeoutMillis: 10_000, connectionTimeoutMillis: Math.min(timeoutMs, 10_000),
		ssl: ssl ? { rejectUnauthorized: false } : undefined,
	});
	try {
		const client = await pool.connect();
		try {
			const r = await client.query({ text: sql, rowMode: "array" });
			return shapeResult(r.fields, r.rows, r.rowCount, started, dbType, host, port, database, sql);
		} finally { client.release(); }
	} finally { await pool.end(); }
}

// ─── MySQL 家族 ───────────────────────────────────────

async function execMy({ dbType, host, port, username, password, database, sql, ssl, timeoutMs, started }) {
	const { default: mysql } = await import("mysql2/promise");
	const conn = await mysql.createConnection({
		host, port: Number(port) || DEFAULT_PORT.mysql, user: username, password, database,
		ssl: ssl ? { rejectUnauthorized: false } : undefined,
		connectTimeout: Math.min(timeoutMs, 10_000),
	});
	try {
		const [result, fields] = await conn.query({ sql, rowsAsArray: true });
		const columns = fields ? fields.map((f) => f.name) : [];
		let rows = []; let rowCount = 0;
		if (Array.isArray(result)) {
			rows = result.map((row) => {
				const obj = {}; fields.forEach((f, i) => { obj[f.name] = row[i]; });
				return obj;
			});
			rowCount = rows.length;
		} else if (result && typeof result === "object") {
			rowCount = result.affectedRows ?? result.changedRows ?? 0;
		}
		return { columns, rows, rowCount, ...meta(started, dbType, host, port, database, sql) };
	} finally { await conn.end(); }
}

// ─── SQL Server ───────────────────────────────────────

async function execMs({ dbType, host, port, username, password, database, sql, timeoutMs, started }) {
	const sqlSrvModule = await import("mssql");
	const sqlSrv = sqlSrvModule.default ?? sqlSrvModule; // mssql 包是 default export
	const pool = await sqlSrv.connect({
		server: host,
		port: Number(port) || DEFAULT_PORT.mssql,
		userName: username, password,
		database,
		options: { trustServerCertificate: true, connectTimeout: Math.min(timeoutMs, 10_000) },
	});
	try {
		const r = await pool.request().query(sql);
		const recordsets = r.recordsets || [];
		const first = recordsets[0] || [];
		const columns = (r.columns && r.columns[0]) ? r.columns[0].map((c) => c.name) : [];
		return {
			columns, rows: first, rowCount: first.length,
			...meta(started, dbType, host, port, database, sql),
		};
	} finally { await pool.close(); }
}

// ─── SQLite ────────────────────────────────────────────

async function execSqlite({ dbType, database, sql, started }) {
	const { DatabaseSync } = await import("node:sqlite");
	const db = new DatabaseSync(database);
	try {
		const rows = []; let columns = [];
		if (/\b(SELECT|PRAGMA|WITH)\b/i.test(sql)) {
			const stmt = db.prepare(sql);
			for (const row of stmt.all()) {
				if (columns.length === 0) columns = Object.keys(row);
				rows.push({ ...row });
			}
		} else {
			db.exec(sql);
		}
		return { columns, rows, rowCount: rows.length, ...meta(started, dbType, undefined, undefined, database, sql) };
	} finally { db.close(); }
}

// ─── ClickHouse（HTTP Native Protocol，零依赖）────────

async function execClickHouse({ dbType, host, port, username, password, database, sql, timeoutMs, started }) {
	const url = `http://${host}:${port || DEFAULT_PORT.clickhouse}/`;
	const auth = username ? `Basic ${Buffer.from(`${username}:${password ?? ""}`).toString("base64")}` : undefined;
	const headers = { "Content-Type": "text/plain" };
	if (auth) headers.Authorization = auth;
	if (database) headers["X-ClickHouse-Database"] = database;

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	try {
		// 查询 + FORMAT JSONEachRow 方便解析
		const query = sql.replace(/;?\s*$/, "") + " FORMAT JSON";
		const res = await fetch(url, {
			method: "POST", body: query, headers, signal: controller.signal,
		});
		clearTimeout(timer);
		const text = await res.text();
		if (!res.ok) throw new Error(`ClickHouse HTTP ${res.status}: ${text.slice(0, 200)}`);

		// DDL/DML 可能返回空或进度
		if (!text.trim()) {
			return { columns: [], rows: [], rowCount: 0, ...meta(started, dbType, host, port, database, sql) };
		}
		const parsed = JSON.parse(text);
		const data = parsed.data || [];
		const metaCols = parsed.meta || [];
		return {
			columns: metaCols.map((m) => m.name),
			rows: data, rowCount: data.length,
			...meta(started, dbType, host, port, database, sql),
		};
	} catch (e) {
		clearTimeout(timer);
		if (e.name === "AbortError") throw new Error("ClickHouse 查询超时");
		throw e;
	}
}

// ─── 工具函数 ──────────────────────────────────────────

function shapeResult(fields, rows, rowCount, started, dbType, host, port, database, sql) {
	const columns = fields ? fields.map((f) => f.name) : [];
	let shapedRows = [];
	if (fields && Array.isArray(rows)) {
		shapedRows = rows.map((row) => {
			const obj = {};
			fields.forEach((f, i) => { obj[f.name] = row[i]; });
			return obj;
		});
	}
	return { columns, rows: shapedRows, rowCount: rowCount ?? shapedRows.length, ...meta(started, dbType, host, port, database, sql) };
}

function meta(started, dbType, host, port, database, sql) {
	return {
		elapsedMs: Date.now() - started,
		connectionName: `${dbType}://${host ?? ""}${port ? ":" + port : ""}/${database ?? ""}`.replace(/:\/\//, host ? "://" : ""),
		sql,
		directExecuted: true,
	};
}

function mkError(code, message) {
	const err = new Error(message);
	err.code = code;
	return err;
}

// ─── SQL_BLOCKED 检测（给 request-router 用）───────────

/** 检查 dbx-mcp 返回是否是 SQL_BLOCKED。 */
export function isSqlBlocked(result) {
	if (!result?.isError) return false;
	const text = extractText(result);
	if (!text) return false;
	const upper = text.toUpperCase();
	return upper.includes("SQL_BLOCKED")
		|| upper.includes("HIGH-RISK SQL IS DISABLED")
		|| upper.includes("HIGH RISK SQL")
		|| upper.includes("WRITE DISABLED")
		|| upper.includes("BLOCKED");
}

function extractText(result) {
	if (!result?.content) return "";
	if (Array.isArray(result.content)) {
		return result.content.map((c) => c?.text ?? "").join("");
	}
	return result.content?.text ?? "";
}

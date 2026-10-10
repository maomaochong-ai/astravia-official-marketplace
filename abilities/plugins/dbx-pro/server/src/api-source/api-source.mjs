/**
 * 「API 接入」— 配置归一化、认证头组装、响应抽行与表格化。
 *
 * 为什么在插件里做：引擎（dbx-mcp）的内置类型清单是编译进去的，外部加不进新 dbType；
 * 而 dbx-pro 的服务端本来就是自研的（先例：server/src/write/direct-write.mjs 的自研写驱动），
 * 所以「API 接入」是插件自有的数据通路，不进引擎的连接注册表（`dbx_add_connection`）。
 *
 * 本模块是纯函数，不接触网络 / 文件系统，便于单测。
 * 网络部分见 api-fetch.mjs，持久化见 api-store.mjs，SQL 重写见 sql-rewrite.mjs。
 */

import { createHash } from "node:crypto";
import { EngineError, stringifyJson } from "../engine/protocol.mjs";

/** 插件自有的连接类型标识。刻意与引擎清单里的任何 dbType 都不重名。 */
export const API_DB_TYPE = "api";

/** 第一版支持的认证方式。 */
export const API_AUTH_KINDS = ["none", "bearer", "api-key", "basic"];

/** 第一版只支持 GET：写语义的接口不在本次范围内。 */
export const API_METHODS = ["GET"];

/** 单次取数的行数上限，与引擎结果上限保持一致（见 request-router 的 DBX_EFFECTIVE_ROW_CAP）。 */
export const API_MAX_ROWS = 1000;
export const API_DEFAULT_ROWS = 1000;

/**
 * 错误类型直接继承 EngineError：这样它一路穿过 request-router 的 normalizeThrown / fail，
 * 错误码与 HTTP 状态都不会在边界上被改写成 INTERNAL。
 */
export class ApiSourceError extends EngineError {
	constructor(code, message, detail) {
		super(code, message, detail);
		this.name = "ApiSourceError";
	}
}

export function isApiDbType(dbType) {
	return String(dbType ?? "").trim().toLowerCase() === API_DB_TYPE;
}

function asText(value) {
	return typeof value === "string" ? value.trim() : "";
}

/**
 * 校验接口地址。只允许 http / https：内网接口常见 http，因此不强制 https，
 * 但要求协议显式写出（`example.com/api` 这种会被拒，避免用户以为填的是路径）。
 */
function normalizeUrl(raw) {
	const text = asText(raw);
	if (!text) throw new ApiSourceError("BAD_REQUEST", "接口地址不能为空");
	let parsed;
	try {
		parsed = new URL(text);
	} catch {
		throw new ApiSourceError("BAD_REQUEST", `接口地址不是合法 URL: ${text}`);
	}
	if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
		throw new ApiSourceError("BAD_REQUEST", `接口地址只支持 http / https，收到 ${parsed.protocol}`);
	}
	return parsed.toString();
}

/**
 * 数据路径：从响应 JSON 里定位「记录数组」的点路径，例如 `data.items`。
 * 支持 `[n]` 下标（`data.list[0].items`）。留空表示响应本身就是数组。
 */
export function normalizeDataPath(raw) {
	const text = asText(raw).replace(/^\./, "");
	if (!text) return "";
	if (!/^[A-Za-z0-9_$]+(\[\d+\])?(\.[A-Za-z0-9_$]+(\[\d+\])?)*$/.test(text)) {
		throw new ApiSourceError("BAD_REQUEST", `数据路径格式不合法: ${text}`);
	}
	return text;
}

/** 把 `a.b[0].c` 拆成 ['a','b',0,'c']。 */
export function parseDataPath(dataPath) {
	const text = normalizeDataPath(dataPath);
	if (!text) return [];
	return text
		.split(".")
		.flatMap((segment) => {
			const match = segment.match(/^([A-Za-z0-9_$]+)(?:\[(\d+)\])?$/);
			if (!match) throw new ApiSourceError("BAD_REQUEST", `数据路径格式不合法: ${text}`);
			return match[2] === undefined ? [match[1]] : [match[1], Number(match[2])];
		});
}

/**
 * 自定义请求头：接受 `key: value` 文本行数组或对象。空行与 `#` 注释行忽略。
 * 返回对象；同一 key 后者覆盖前者。
 */
export function normalizeHeaders(raw) {
	/** @type {Record<string,string>} */
	const headers = {};
	const lines = [];
	if (typeof raw === "string") lines.push(...raw.split(/\r?\n/));
	else if (Array.isArray(raw)) lines.push(...raw.map((v) => String(v)));
	else if (raw && typeof raw === "object") {
		for (const [key, value] of Object.entries(raw)) {
			if (asText(key)) headers[asText(key)] = String(value ?? "").trim();
		}
		return headers;
	} else return headers;

	for (const line of lines) {
		const text = line.trim();
		if (!text || text.startsWith("#")) continue;
		const at = text.indexOf(":");
		if (at <= 0) throw new ApiSourceError("BAD_REQUEST", `请求头缺少冒号: ${text}`);
		const key = text.slice(0, at).trim();
		const value = text.slice(at + 1).trim();
		if (!key) throw new ApiSourceError("BAD_REQUEST", `请求头名不能为空: ${text}`);
		headers[key] = value;
	}
	return headers;
}

/**
 * 认证配置归一化。`secret`（token / 密码）不进入返回值 —— 它单独持久化，
 * 只在发请求的那一刻组装进请求头。
 */
export function normalizeAuth(raw) {
	const input = raw && typeof raw === "object" ? raw : {};
	const kind = asText(input.kind) || "none";
	if (!API_AUTH_KINDS.includes(kind)) {
		throw new ApiSourceError("BAD_REQUEST", `不支持的认证方式: ${kind}`);
	}
	const auth = { kind };
	if (kind === "bearer") return auth;
	if (kind === "api-key") {
		const headerName = asText(input.headerName) || "X-API-Key";
		if (!/^[!#$%&'*+.^_`|~0-9A-Za-z-]+$/.test(headerName)) {
			throw new ApiSourceError("BAD_REQUEST", `自定义认证头名不合法: ${headerName}`);
		}
		auth.headerName = headerName;
		if (asText(input.prefix)) auth.prefix = asText(input.prefix);
		return auth;
	}
	if (kind === "basic") {
		if (!asText(input.username)) throw new ApiSourceError("BAD_REQUEST", "基本认证需要用户名");
		auth.username = asText(input.username);
		return auth;
	}
	return auth;
}

/**
 * 「API 接入」连接配置归一化。入参是 UI / REST 传来的原始对象。
 * 返回的对象可直接持久化（不含任何明文凭据）。
 */
export function normalizeApiSource(raw) {
	const input = raw && typeof raw === "object" ? raw : {};
	const name = asText(input.name);
	if (!name) throw new ApiSourceError("BAD_REQUEST", "连接名称不能为空");
	if (name.length > 120) throw new ApiSourceError("BAD_REQUEST", "连接名称过长");

	const method = (asText(input.method) || "GET").toUpperCase();
	if (!API_METHODS.includes(method)) {
		throw new ApiSourceError("BAD_REQUEST", `第一版只支持 GET，收到 ${method}`);
	}

	const rawRows = input.rowLimit ?? input.row_limit ?? API_DEFAULT_ROWS;
	const rowLimit = Number.isFinite(Number(rawRows)) ? Math.trunc(Number(rawRows)) : API_DEFAULT_ROWS;
	if (rowLimit < 1 || rowLimit > API_MAX_ROWS) {
		throw new ApiSourceError("BAD_REQUEST", `行数上限需在 1–${API_MAX_ROWS} 之间`);
	}

	return {
		name,
		url: normalizeUrl(input.url),
		method,
		headers: normalizeHeaders(input.headers),
		auth: normalizeAuth(input.auth),
		dataPath: normalizeDataPath(input.dataPath ?? input.data_path),
		rowLimit,
	};
}

/**
 * 组装认证请求头。`secret` 是明文凭据（token / 密码），只在内存里出现。
 *
 * - bearer：`Authorization: Bearer <token>`
 * - api-key：`<headerName>: [prefix ]<key>`
 * - basic：`Authorization: Basic base64(user:pass)`
 */
export function buildAuthHeaders(auth, secret) {
	const kind = asText(auth?.kind) || "none";
	const value = typeof secret === "string" ? secret : "";
	if (kind === "none") return {};
	if (kind === "bearer") {
		if (!value) throw new ApiSourceError("AUTH_MISSING", "认证方式为 Bearer Token，但未提供 Token");
		return { Authorization: `Bearer ${value}` };
	}
	if (kind === "api-key") {
		if (!value) throw new ApiSourceError("AUTH_MISSING", "认证方式为 API Key，但未提供 Key");
		const headerName = asText(auth?.headerName) || "X-API-Key";
		const prefix = asText(auth?.prefix);
		return { [headerName]: prefix ? `${prefix} ${value}` : value };
	}
	if (kind === "basic") {
		if (!value) throw new ApiSourceError("AUTH_MISSING", "认证方式为基本认证，但未提供密码");
		const username = asText(auth?.username);
		return { Authorization: `Basic ${Buffer.from(`${username}:${value}`, "utf8").toString("base64")}` };
	}
	throw new ApiSourceError("BAD_REQUEST", `不支持的认证方式: ${kind}`);
}

/** 完整请求头 = 自定义头 → 认证头（认证头优先，避免用户自定义头把认证覆盖成错的） → Accept。 */
export function buildRequestHeaders(config, secret) {
	return {
		Accept: "application/json",
		...(config?.headers ?? {}),
		...buildAuthHeaders(config?.auth, secret),
	};
}

/**
 * 从响应体里按数据路径抽出记录数组。
 *
 * 抽不到数组时**抛错而不是返回空**（见 ADR §8 风险表）：静默空表会让用户以为接口没数据。
 * 抽到空数组是合法结果，交给上层提示「接口返回 0 行」。
 */
export function extractRecords(payload, dataPath) {
	const segments = parseDataPath(dataPath);
	let current = payload;
	let walked = "";
	for (const segment of segments) {
		walked = walked ? `${walked}.${segment}` : String(segment);
		if (current === null || typeof current !== "object") {
			throw new ApiSourceError("API_PATH_NOT_FOUND", `数据路径 ${dataPath} 在 ${walked} 处断掉（响应里没有该层级）`);
		}
		if (typeof segment === "number") {
			if (!Array.isArray(current)) {
				throw new ApiSourceError("API_PATH_NOT_FOUND", `数据路径 ${dataPath} 期望 ${walked} 是数组`);
			}
		} else if (Array.isArray(current) || !(segment in current)) {
			throw new ApiSourceError(
				"API_PATH_NOT_FOUND",
				`数据路径 ${dataPath} 找不到 ${walked}；响应顶层键：${topLevelKeys(payload)}`,
			);
		}
		current = current[segment];
	}

	if (current === null || current === undefined) {
		throw new ApiSourceError("API_PATH_NOT_FOUND", `数据路径 ${dataPath || "(根)"} 是空值；顶层键：${topLevelKeys(payload)}`);
	}
	if (!Array.isArray(current)) {
		throw new ApiSourceError(
			"API_PATH_NOT_FOUND",
			`数据路径 ${dataPath || "(根)"} 指向的不是数组，而是 ${Array.isArray(current) ? "数组" : typeof current}；` +
				`顶层键：${topLevelKeys(payload)}`,
		);
	}
	return current;
}

/** 给「路径写错」的报错附上响应顶层键名，用户一眼能看出该填什么。 */
export function topLevelKeys(payload) {
	if (Array.isArray(payload)) return `(响应本身就是数组，长度 ${payload.length})`;
	if (payload && typeof payload === "object") {
		const keys = Object.keys(payload);
		return keys.length ? keys.slice(0, 12).join(", ") : "(空对象)";
	}
	return `(响应是 ${payload === null ? "null" : typeof payload})`;
}

/**
 * 记录数组 → 结果网格的 `{ columns, rows }`。
 *
 * 列取所有记录的键的并集，按首次出现顺序。嵌套对象 / 数组原样序列化成 JSON 字符串
 * （与引擎返回嵌套列的既有行为一致），标量保持标量。
 */
export function tableFromRecords(records, { rowLimit = API_MAX_ROWS, dataPath = "" } = {}) {
	if (!Array.isArray(records)) {
		throw new ApiSourceError("BAD_REQUEST", "records 不是数组");
	}
	const truncatedRecords = records.length > rowLimit;
	const limited = truncatedRecords ? records.slice(0, rowLimit) : records;

	const columns = [];
	const seen = new Set();
	for (const record of limited) {
		if (!record || typeof record !== "object" || Array.isArray(record)) continue;
		for (const key of Object.keys(record)) {
			if (seen.has(key)) continue;
			seen.add(key);
			columns.push(key);
		}
	}

	// 记录是裸标量（如 `[1,2,3]`）时，退化成单列 value，而不是给出一个零列表。
	if (columns.length === 0 && limited.length > 0) {
		const rows = limited.map((value) => ({ value: cellValue(value) }));
		return { columns: ["value"], rows, truncated: truncatedRecords, totalRecords: records.length, dataPath };
	}

	const rows = limited.map((record) => {
		/** @type {Record<string, unknown>} */
		const row = {};
		for (const column of columns) {
			const value = record && typeof record === "object" ? record[column] : undefined;
			row[column] = cellValue(value);
		}
		return row;
	});

	return { columns, rows, truncated: truncatedRecords, totalRecords: records.length, dataPath };
}

/**
 * 连接树里「结构」视图用的列类型标注。
 *
 * 只依据**本次取到的原始记录**给出粗粒度标签，不冒充数据库里的真实类型：
 * 快照是运行时物化的，DuckDB 的 `read_json_auto` 同样靠推断。嵌套对象在快照里被序列化成
 * JSON 文本（见 `cellValue`），因此这里按 `json` 标注，免得用户以为它是可继续展开的结构。
 */
export function inferColumnTypes(records, columns) {
	const list = Array.isArray(records) ? records : [];
	const result = {};
	for (const column of columns ?? []) {
		const seen = new Set();
		for (const record of list) {
			if (!record || typeof record !== "object") continue;
			const value = record[column];
			if (value === null || value === undefined) continue;
			if (typeof value === "number") seen.add(Number.isInteger(value) ? "bigint" : "double");
			else if (typeof value === "boolean") seen.add("boolean");
			else if (typeof value === "object") seen.add("json");
			else seen.add("varchar");
		}
		// 样本里既有整数又有小数时归 double（DuckDB 推断同一列也是 DOUBLE）；
		// 数字与文本混在一起、或整列都是 null 时老实回 varchar —— 断言成 numeric
		// 会在结果网格里造成「明明是值却像类型错了」的错觉。
		const allNumeric = seen.size > 0 && [...seen].every((t) => t === "bigint" || t === "double");
		if (seen.size === 1) result[column] = [...seen][0];
		else if (allNumeric) result[column] = "double";
		else result[column] = "varchar";
	}
	return result;
}

/** 单元格取值：只做「能进 JSON / 结果网格」的归一化，不做类型推断。 */
function cellValue(value) {
	if (value === undefined) return null;
	if (value === null) return null;
	if (typeof value === "object") return stringifyJson(value);
	return value;
}

/** 结果行 → NDJSON（供 DuckDB 的 `read_json_auto` 读本地快照）。 */
export function toNdjson(rows) {
	if (!Array.isArray(rows) || rows.length === 0) return "";
	return `${rows.map((row) => stringifyJson(row)).join("\n")}\n`;
}

/**
 * 连接名 → 快照文件名。只保留安全字符，避免路径逃逸。
 *
 * 纯中文名（很常见的输入）清洗后会变成空串，此时退化成 `src-<哈希>`：
 * 用户不该因为给连接起了个中文名就用不了。
 */
export function snapshotFileName(name) {
	const text = String(name ?? "").trim();
	if (!text) throw new ApiSourceError("BAD_REQUEST", "连接名称不能为空");
	const slug = text
		.replace(/[^A-Za-z0-9._-]+/g, "_")
		.replace(/^[._-]+|[._-]+$/g, "")
		.slice(0, 80);
	if (slug) return `${slug}.ndjson`;
	const digest = createHash("sha1").update(text, "utf8").digest("hex").slice(0, 12);
	return `src-${digest}.ndjson`;
}

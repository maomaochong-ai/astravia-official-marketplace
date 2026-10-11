/**
 * 「API 接入」的取数步骤：组装认证头 → 发起请求 → 按数据路径抽行 → 表格化。
 *
 * 与引擎行为的一处**刻意不同**：这里的 4xx / 5xx 是**错误**。
 * M1 实测过外部 SQL 化引擎会把「查询成功 + 错误页正文」一起返回（状态码只是结果列值），
 * 用户会以为接口有数据。API 接入自己在进程内发请求，没有理由继承这个行为。
 */

import { ApiSourceError, buildRequestHeaders, extractRecords, tableFromRecords } from "./api-source.mjs";

export const API_DEFAULT_TIMEOUT_MS = 15_000;
export const API_MAX_TIMEOUT_MS = 120_000;

export function clampApiTimeout(value) {
	const ms = Number(value);
	if (!Number.isFinite(ms) || ms <= 0) return API_DEFAULT_TIMEOUT_MS;
	return Math.min(Math.trunc(ms), API_MAX_TIMEOUT_MS);
}

/** 状态码 → 稳定错误码。认证类是 AUTH_FAILED，其余归 CONNECTION_FAILED。 */
function httpErrorCode(status) {
	if (status === 401 || status === 403 || status === 407) return "AUTH_FAILED";
	if (status === 404) return "API_HTTP_ERROR";
	if (status === 429) return "API_RATE_LIMITED";
	return "API_HTTP_ERROR";
}

/**
 * 取一次数。返回 `{ records, table, status, url, fetchedAt, bytes }`，
 * `table` 已是 `{ columns, rows, truncated, totalRecords }`。
 *
 * @param {object} config  normalizeApiSource 的产物（含 secret）
 * @param {{ fetchImpl?: typeof fetch, timeoutMs?: number }} options
 *
 * 响应体全量读进内存（第一版无大小上限，见 ADR-0008 §10.5 未实测项）。
 */
export async function fetchApiSource(config, options = {}) {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== "function") {
		throw new ApiSourceError("API_UNAVAILABLE", "当前运行环境没有全局 fetch");
	}
	const secret = typeof config?.secret === "string" ? config.secret : "";
	const headers = buildRequestHeaders(config, secret);
	const timeoutMs = clampApiTimeout(options.timeoutMs);
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);
	const startedAt = Date.now();

	let response;
	try {
		response = await fetchImpl(config.url, {
			method: config.method ?? "GET",
			headers,
			redirect: "follow",
			signal: controller.signal,
		});
	} catch (error) {
		const aborted = error?.name === "AbortError" || controller.signal.aborted;
		if (aborted) {
			throw new ApiSourceError("TIMEOUT", `接口在 ${timeoutMs} ms 内没有响应: ${config.url}`);
		}
		throw new ApiSourceError("CONNECTION_FAILED", `请求失败: ${error?.message ?? String(error)}`);
	} finally {
		clearTimeout(timer);
	}

	const body = await response.text();
	const bytes = Buffer.byteLength(body, "utf8");

	// 刻意在解析前判状态：错误响应体往往是 HTML 错误页，解析只会给出误导性的路径报错。
	if (!response.ok) {
		const snippet = body.trim().slice(0, 200);
		throw new ApiSourceError(
			httpErrorCode(response.status),
			`接口返回 HTTP ${response.status}${snippet ? `：${snippet}` : ""}`,
		);
	}

	let payload;
	try {
		payload = JSON.parse(body);
	} catch {
		const snippet = body.trim().slice(0, 200);
		throw new ApiSourceError(
			"API_INVALID_JSON",
			`响应不是合法 JSON（第一版只支持 JSON 接口）${snippet ? `，正文开头：${snippet}` : ""}`,
		);
	}

	const records = extractRecords(payload, config.dataPath ?? "");
	const table = tableFromRecords(records, {
		rowLimit: config.rowLimit ?? 1000,
		dataPath: config.dataPath ?? "",
	});

	return {
		records,
		table,
		status: response.status,
		url: config.url,
		fetchedAt: new Date().toISOString(),
		durationMs: Date.now() - startedAt,
		bytes,
	};
}

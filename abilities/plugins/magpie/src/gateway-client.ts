import type { PluginNetworkApi } from "@astravia-org/plugin-sdk";
import { authHeaders, modelsUrl, versionUrl, type MagpieSettings } from "./gateway-endpoint";
import { parseModelRows, type MagpieModelRow } from "./model-catalog";

/**
 * 失败原因是封闭枚举，视图与工具都按它选 i18n key，绝不把宿主原始报错当文案。
 * - unreachable：连接不上（拒绝连接 / DNS / 宿主拒绝该主机声明）
 * - timeout：连上了但没在预算内答完
 * - unauthorized：401/403
 * - not-magpie：有 HTTP 响应但不是 magpie（/api/version 里没有 version）
 * - http：其它非 2xx
 */
export type GatewayFailure = "unreachable" | "timeout" | "unauthorized" | "not-magpie" | "http";

export type GatewayProbe =
	| { ok: true; version: string }
	| { ok: false; failure: GatewayFailure; status?: number };

export type ModelListResult =
	| { ok: true; rows: MagpieModelRow[] }
	| { ok: false; failure: GatewayFailure; status?: number };

/** 探针预算很短：网关在本机，4 秒没结果就是没在跑。 */
const PROBE_TIMEOUT_MS = 4_000;
/** 模型目录可能来自十几个提供方，给足 15 秒；宿主上限 300 秒。 */
const LIST_TIMEOUT_MS = 15_000;

export const FAILURE_KEYS: Record<GatewayFailure, string> = {
	unreachable: "error.unreachable",
	timeout: "error.timeout",
	unauthorized: "error.unauthorized",
	"not-magpie": "error.notMagpie",
	http: "error.http",
};

/** 宿主 PluginNetworkError.reason → 本模块的失败类型。缺省按「连不上」处理。 */
function failureOf(error: unknown): GatewayFailure {
	const reason = (error as { reason?: unknown }).reason;
	switch (reason) {
		case "timed-out":
			return "timeout";
		case "invalid-json":
			return "not-magpie";
		default:
			return "unreachable";
	}
}

function statusFailure(status: number): GatewayFailure | null {
	if (status === 401 || status === 403) return "unauthorized";
	if (status >= 400) return "http";
	return null;
}

/**
 * 存活探针：GET /api/version。回的是 Ollama 形状的 `{ version }`，
 * 因此「有东西在监听但不是 magpie」能被区分出来，而不是被当成网关可用。
 */
export async function probeGateway(network: PluginNetworkApi, settings: MagpieSettings): Promise<GatewayProbe> {
	let response;
	try {
		response = await network.request<unknown>({
			url: versionUrl(settings.baseUrl),
			method: "GET",
			headers: authHeaders(settings.apiKey),
			responseType: "json",
			timeoutMs: PROBE_TIMEOUT_MS,
		});
	} catch (error) {
		return { ok: false, failure: failureOf(error) };
	}
	const failure = statusFailure(response.status);
	if (failure) return { ok: false, failure, status: response.status };
	if (!response.ok) return { ok: false, failure: "http", status: response.status };
	const version = (response.body as { version?: unknown } | null)?.version;
	if (typeof version !== "string" || version.trim().length === 0) {
		return { ok: false, failure: "not-magpie", status: response.status };
	}
	return { ok: true, version: version.trim() };
}

/** 模型目录：GET /v1/models。空目录是正常状态（magpie 里还没加提供方），不算失败。 */
export async function loadModels(network: PluginNetworkApi, settings: MagpieSettings): Promise<ModelListResult> {
	let response;
	try {
		response = await network.request<unknown>({
			url: modelsUrl(settings.baseUrl),
			method: "GET",
			headers: authHeaders(settings.apiKey),
			responseType: "json",
			timeoutMs: LIST_TIMEOUT_MS,
		});
	} catch (error) {
		return { ok: false, failure: failureOf(error) };
	}
	const failure = statusFailure(response.status);
	if (failure) return { ok: false, failure, status: response.status };
	if (!response.ok) return { ok: false, failure: "http", status: response.status };
	return { ok: true, rows: parseModelRows(response.body) };
}

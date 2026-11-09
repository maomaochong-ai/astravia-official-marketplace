import type { PluginNetworkApi } from "@astravia-org/plugin-sdk";
import { authHeaders, helloUrl, identityUrl, modelsUrl, versionUrl, type MagpieSettings } from "./gateway-endpoint";
import { parseModelRows, type MagpieModelRow } from "./model-catalog";

/**
 * 失败原因是封闭枚举，视图与工具都按它选 i18n key，绝不把宿主原始报错当文案。
 * - unreachable：连接不上（拒绝连接 / DNS / 宿主拒绝该主机声明）
 * - timeout：连上了但没在预算内答完
 * - unauthorized：401/403
 * - not-magpie：有 HTTP 响应但不是 magpie（/api/hello 不自称 magpie，且没有 magpie 独有路由）
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
 * 身份结论。三个分支对应三种现实：是 magpie / 是别的服务 / 没法判断（网络层或鉴权）。
 */
type Identity =
	| { kind: "magpie"; version?: string }
	| { kind: "other"; status?: number }
	| { kind: "failure"; failure: GatewayFailure; status?: number };

/**
 * `/v1/magpie/*` 的状态码。只要状态码、不要 body：这样无论上游换成什么响应体，
 * 判据都不会跟着撒谎；解析失败也不影响结论。
 */
async function sharedRouteStatus(
	network: PluginNetworkApi,
	settings: MagpieSettings,
): Promise<number | GatewayFailure> {
	try {
		const response = await network.request<unknown>({
			url: identityUrl(settings.baseUrl),
			method: "GET",
			headers: authHeaders(settings.apiKey),
			responseType: "text",
			timeoutMs: PROBE_TIMEOUT_MS,
		});
		return response.status;
	} catch (error) {
		return failureOf(error);
	}
}

/**
 * 身份探针，两档：
 * 1. `GET /api/hello` —— magpie 专门给客户端做的自报身份接口，理想情况下一次定案；
 * 2. 老版本 magpie 还没有 /api/hello（上游 2026-09-28 才加）时，退到 magpie 独有的
 *    `/v1/magpie/*`：404/405 才是别人，其余状态码（401/403/5xx）说明路由存在。
 *
 * 为什么非要身份这一档：magpie 用 Ollama 兼容形状回答 `GET /api/version`（上游
 * ollama.go 里是一个写死的 `0.12.6`），真正的 Ollama 在同一个端口答的 JSON 一模一样 ——
 * 只凭「有 version」就把服务当成 magpie，会把 Ollama 的模型当成 magpie 的模型发布出去。
 *
 * 副作用之一是对的：`/api/hello` 里的 version 是 magpie 自己的版本，而
 * `/api/version` 里的 0.12.6 是「冒充的 Ollama 版本」，后者拿去展示本身就是错的。
 */
async function identify(network: PluginNetworkApi, settings: MagpieSettings): Promise<Identity> {
	let hello;
	try {
		hello = await network.request<unknown>({
			url: helloUrl(settings.baseUrl),
			method: "GET",
			headers: authHeaders(settings.apiKey),
			responseType: "json",
			timeoutMs: PROBE_TIMEOUT_MS,
		});
	} catch (error) {
		return { kind: "failure", failure: failureOf(error) };
	}

	if (hello.ok) {
		const body = hello.body as { name?: unknown; version?: unknown } | null;
		if (body?.name === "magpie") {
			return {
				kind: "magpie",
				version: typeof body.version === "string" ? body.version : undefined,
			};
		}
		// 有服务、也答了 hello，但自称别的名字：相信它，别拿它当 magpie。
		return { kind: "other", status: hello.status };
	}

	// 只有「这个路由不存在」才值得再试一次；401/403/5xx 是别的结论。
	if (hello.status !== 404 && hello.status !== 405) {
		return { kind: "failure", failure: statusFailure(hello.status) ?? "http", status: hello.status };
	}

	const shared = await sharedRouteStatus(network, settings);
	if (typeof shared === "string") return { kind: "failure", failure: shared };
	if (shared === 404 || shared === 405) return { kind: "other", status: shared };
	const sharedFailure = statusFailure(shared);
	if (sharedFailure) return { kind: "failure", failure: sharedFailure, status: shared };
	return { kind: "magpie" };
}

/**
 * 探针：先看端口上有没有 HTTP 服务（`/api/version`），再确认它是不是 magpie。
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

	const identity = await identify(network, settings);
	if (identity.kind === "failure") {
		return { ok: false, failure: identity.failure, status: identity.status };
	}
	if (identity.kind === "other") {
		return { ok: false, failure: "not-magpie", status: identity.status };
	}

	// 自报的名字比冒充的 Ollama 版本可信：有就用它，没有才退回 /api/version。
	return { ok: true, version: (identity.version ?? version).trim() };
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

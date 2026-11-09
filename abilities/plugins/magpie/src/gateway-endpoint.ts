import { readJsonFile, writeJsonFile, type PluginStorageApi } from "@astravia-org/plugin-sdk";

/**
 * magpie 网关的连接信息。
 *
 * 默认值就是 magpie 自己的默认：网关 127.0.0.1:3425，本机回环调用不需要密钥
 * （文档给出的 OpenAI 客户端写法仍会带一个占位 key，这里沿用 `magpie`）。
 * 用户把 MAGPIE_ADDR 改到别处、或连另一台机器上的 magpie 时，才需要动这两项。
 */
export interface MagpieSettings {
	/** 网关根地址，不含 /v1。 */
	baseUrl: string;
	/** Authorization: Bearer <apiKey>；本机回环时 magpie 不校验。 */
	apiKey: string;
}

export const SETTINGS_PATH = "settings.json";

export const DEFAULT_GATEWAY_URL = "http://127.0.0.1:3425";
export const DEFAULT_GATEWAY_KEY = "magpie";
/** magpie 的页面/管理端默认端口；网关端口不在这里时退回这个地址。 */
export const DEFAULT_CONSOLE_URL = "http://127.0.0.1:3430";
export const GATEWAY_PORT = "3425";
export const CONSOLE_PORT = "3430";

export const DEFAULT_SETTINGS: MagpieSettings = {
	baseUrl: DEFAULT_GATEWAY_URL,
	apiKey: DEFAULT_GATEWAY_KEY,
};

export function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/**
 * fail-closed：只接受 http/https 且带主机名的地址，其余一律回到默认值。
 * 末尾斜杠一并去掉，后面拼路径时才不会出现 `//v1`。
 */
export function normalizeBaseUrl(raw: unknown): string {
	if (typeof raw !== "string") return DEFAULT_GATEWAY_URL;
	const trimmed = raw.trim().replace(/\/+$/, "");
	if (!trimmed) return DEFAULT_GATEWAY_URL;
	if (!/^https?:\/\//i.test(trimmed)) return DEFAULT_GATEWAY_URL;
	try {
		const url = new URL(trimmed);
		return url.hostname ? trimmed : DEFAULT_GATEWAY_URL;
	} catch {
		return DEFAULT_GATEWAY_URL;
	}
}

export function normalizeApiKey(raw: unknown): string {
	if (typeof raw !== "string") return DEFAULT_GATEWAY_KEY;
	const trimmed = raw.trim();
	return trimmed ? trimmed : DEFAULT_GATEWAY_KEY;
}

export function normalizeSettings(raw: unknown): MagpieSettings {
	if (!isRecord(raw)) return { ...DEFAULT_SETTINGS };
	return {
		baseUrl: normalizeBaseUrl(raw.baseUrl),
		apiKey: normalizeApiKey(raw.apiKey),
	};
}

export async function loadSettings(storage: PluginStorageApi): Promise<MagpieSettings> {
	const raw = await readJsonFile(storage, SETTINGS_PATH).catch(() => undefined);
	return normalizeSettings(raw);
}

export async function saveSettings(storage: PluginStorageApi, settings: MagpieSettings): Promise<void> {
	await writeJsonFile(storage, SETTINGS_PATH, normalizeSettings(settings));
}

/** 存活探针：magpie 用 Ollama 的形状回答 /api/version —— 只证明「有 HTTP 服务」。 */
export function versionUrl(baseUrl: string): string {
	return `${baseUrl}/api/version`;
}

/**
 * 身份探针：`/v1/magpie/*` 是 magpie 独有的路由，别的 Ollama 兼容服务在这条路径上
 * 只会给 404/405。只有它能回答「这是不是 magpie」——/api/version 回答不了（见
 * gateway-client 里 probeGateway 的说明）。
 */
export function identityUrl(baseUrl: string): string {
	return `${baseUrl}/v1/magpie/concurrency`;
}

/** magpie 给客户端做自报身份的接口：`{ "name": "magpie", "version": … }`（上游 gateway.go:960）。 */
export function helloUrl(baseUrl: string): string {
	return `${baseUrl}/api/hello`;
}

/** 模型目录：OpenAI 形状的 /v1/models（默认只列 chat 模型）。 */
export function modelsUrl(baseUrl: string): string {
	return `${baseUrl}/v1/models`;
}

/** 写进宿主模型注册表的 baseUrl 必须指向 OpenAI 兼容根（以 /v1 结尾）。 */
export function providerBaseUrl(baseUrl: string): string {
	return `${baseUrl}/v1`;
}

/**
 * 「打开 magpie」指向页面/管理端。只有网关仍在默认端口时才能从地址推出来；
 * 用户改过端口时，magpie 的页面端口与网关端口没有固定关系，于是退回本机默认页面。
 */
export function consoleUrl(baseUrl: string): string {
	try {
		const url = new URL(normalizeBaseUrl(baseUrl));
		if (url.port === GATEWAY_PORT) {
			url.port = CONSOLE_PORT;
			return url.toString().replace(/\/+$/, "");
		}
	} catch {
		// 落到下面的默认值
	}
	return DEFAULT_CONSOLE_URL;
}

export function authHeaders(apiKey: string): Record<string, string> {
	return { authorization: `Bearer ${normalizeApiKey(apiKey)}` };
}

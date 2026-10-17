import { readJsonFile, writeJsonFile, type PluginStorageApi } from "@astravia-org/plugin-sdk";

/** 插件设置：唯一可调项是「激活时自动启动服务」。默认开——本插件的产品承诺就是装完即用。 */
export interface GatewaySettings {
	autoStart: boolean;
}

export const GATEWAY_SETTINGS_PATH = "settings.json";

export const DEFAULT_GATEWAY_SETTINGS: GatewaySettings = {
	autoStart: true,
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

/** fail-closed：任何形状问题都回默认值，绝不抛错阻塞视图渲染。 */
export function normalizeGatewaySettings(raw: unknown): GatewaySettings {
	if (!isRecord(raw)) return { ...DEFAULT_GATEWAY_SETTINGS };
	return {
		autoStart: raw.autoStart === true,
	};
}

export function isGatewaySettings(value: unknown): value is GatewaySettings {
	return isRecord(value) && typeof value.autoStart === "boolean";
}

export async function loadGatewaySettings(storage: PluginStorageApi): Promise<GatewaySettings> {
	const raw = await readJsonFile(storage, GATEWAY_SETTINGS_PATH).catch(() => undefined);
	return normalizeGatewaySettings(raw);
}

export async function saveGatewaySettings(
	storage: PluginStorageApi,
	settings: GatewaySettings,
): Promise<void> {
	await writeJsonFile(storage, GATEWAY_SETTINGS_PATH, settings);
}

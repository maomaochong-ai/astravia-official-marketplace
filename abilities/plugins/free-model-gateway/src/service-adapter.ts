import type {
	PluginModelDefinition,
	PluginModelProviderConfig,
	PluginModelsApi,
	PluginServicePhase,
	PluginServiceStatus,
} from "@astravia-org/plugin-sdk";

/** plugin.json providers.services[0].id。 */
export const SERVICE_ID = "ofm-gateway";

/** manifest 里 artifact 的 destination（zip 解压到 runtime/versions/<v>/server/）。 */
export const ARTIFACT_DESTINATION = "server";

/** 打包产物在插件包内的路径（public/ 会被 vite 拷进 dist/，随 astraviapkg 分发）。 */
export const SERVER_ZIP_PATH = "dist/ofm-server.zip";

/** 写入宿主模型注册表的 owned provider id（以插件 id 命名空间隔离）。 */
export const PROVIDER_ID = "free-model";

/** 上游是 OpenAI 兼容端点；SDK PluginModelDefinition.api 按宿主 adapter 名标注。 */
export const API_KIND = "openai-completions";

export const PROVIDER_DISPLAY_NAME = "Free Model Gateway";

export interface UpstreamModelRow {
	id: string;
	contextWindow?: number;
}

/**
 * 上游 forward.js 的模型行是 OpenAI 形状：
 * { id, object: "model", created, owned_by: "our-free-model", context_window? }。
 * fail-closed：任何非预期形状一律丢弃，绝不猜测。
 */
export function parseModelRows(body: unknown): UpstreamModelRow[] {
	const data = (body as { data?: unknown } | null)?.data;
	if (!Array.isArray(data)) return [];
	const rows: UpstreamModelRow[] = [];
	for (const item of data) {
		if (typeof item !== "object" || item === null) continue;
		const id = (item as { id?: unknown }).id;
		if (typeof id !== "string" || id.length === 0) continue;
		const contextWindow = (item as { context_window?: unknown }).context_window;
		rows.push({
			id,
			contextWindow: typeof contextWindow === "number" && Number.isFinite(contextWindow)
				? contextWindow
				: undefined,
		});
	}
	return rows.sort((a, b) => a.id.localeCompare(b.id));
}

export function toModelDefinitions(rows: readonly UpstreamModelRow[]): PluginModelDefinition[] {
	return rows.map((row) => ({
		id: row.id,
		api: API_KIND,
		...(row.contextWindow === undefined ? {} : { contextWindow: row.contextWindow }),
	}));
}

/** 上游服务地址（http://127.0.0.1:<port>）→ OpenAI 兼容 baseUrl（…/v1）。 */
export function baseUrlForProvider(connectionBaseUrl: string): string {
	return `${connectionBaseUrl.replace(/\/+$/, "")}/v1`;
}

export interface ProviderSnapshotInput {
	baseUrl: string;
	apiKey: string;
	models: PluginModelDefinition[];
}

export function buildProviderConfig(input: ProviderSnapshotInput): PluginModelProviderConfig {
	return {
		baseUrl: input.baseUrl,
		apiKey: input.apiKey,
		api: API_KIND,
		displayName: PROVIDER_DISPLAY_NAME,
		models: input.models,
	};
}

/**
 * 对账合并：existing.displayName 非空则保留（用户可能改过显示名）；
 * 凭据永远写新值——listOwnedProviders 回读的是掩码，继承掩码会让 provider 失效。
 * 空模型列表返回 null = 不写注册表（防误删）。
 */
export function computeProviderSnapshot(
	existing: PluginModelProviderConfig | undefined,
	next: PluginModelProviderConfig,
): PluginModelProviderConfig | null {
	if ((next.models?.length ?? 0) === 0) return null;
	const displayName = existing?.displayName?.trim() ? existing.displayName : next.displayName;
	return { ...next, displayName };
}

/**
 * 写前先读后写（SDK 文档要求）：上游一时不返回 ≠ 用户配置丢失。
 * 空列表直接返回 false——「服务起来了但上游一个模型都没有」（通道未登录）是预期状态，
 * 不是异常：不写注册表，也不把正常状态渲染成故障（控制器据此提示 error.emptyModels）。
 */
export async function reconcileProviders(
	models: PluginModelsApi,
	next: PluginModelProviderConfig,
): Promise<boolean> {
	if ((next.models?.length ?? 0) === 0) return false;
	const owned = await models.listOwnedProviders();
	const existing = owned?.[PROVIDER_ID];
	const snapshot = computeProviderSnapshot(existing, next);
	if (!snapshot) return false;
	await models.replaceOwnedProviders({ [PROVIDER_ID]: snapshot });
	return true;
}

/**
 * 上游每次启动都会把 forwardKey 写进 <dataDir>/settings.json（存在则复用）。
 * 这里从宿主 readDataFile 读出并解析；缺文件/缺字段/坏 JSON 一律 undefined（fail-closed）。
 */
export function parseForwardKey(raw: string | null | undefined): string | undefined {
	if (typeof raw !== "string" || raw.length === 0) return undefined;
	try {
		const value = (JSON.parse(raw) as { forwardKey?: unknown } | null)?.forwardKey;
		return typeof value === "string" && value.length > 0 ? value : undefined;
	} catch {
		return undefined;
	}
}

/** 宿主服务相位 → 视图相位（failed 保留 message 供错误卡展示）。 */
export type GatewayPhase = "idle" | "installing" | "starting" | "running" | "stopping" | "error";

export function phaseFromServiceStatus(status: PluginServiceStatus): GatewayPhase {
	switch (status.phase as PluginServicePhase) {
		case "ready":
			return "running";
		case "installing":
			return "installing";
		case "starting":
			return "starting";
		case "stopping":
			return "stopping";
		case "failed":
			return "error";
		default:
			return "idle";
	}
}

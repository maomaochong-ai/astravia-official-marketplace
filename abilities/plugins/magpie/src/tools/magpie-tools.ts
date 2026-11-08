import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import type { GatewayController } from "../controller";
import { consoleUrl, providerBaseUrl } from "../gateway-endpoint";
import { loadModels, probeGateway } from "../gateway-client";
import { filterModels, formatContextWindow } from "../model-catalog";
import { TOOL_MODELS, TOOL_STATUS } from "../plugin-ids";

const TOOL_SCOPE = ["conversation", "project"] as const;
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 120;

interface ModelsInput {
	query?: string;
	limit?: number;
}

function clampLimit(value: unknown): number {
	if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_LIMIT;
	return Math.min(MAX_LIMIT, Math.max(1, Math.floor(value)));
}

/**
 * 两个只读工具：让 Agent 能回答「本机 magpie 现在能用哪些模型」，
 * 而不是凭记忆列一份可能过期的目录。
 *
 * 边界：只读。发布模型、改连接地址都是用户在面板上做的决定，
 * Agent 不通过工具改宿主模型配置。
 */
export function registerMagpieTools(ctx: PluginContext, controller: GatewayController): Disposable {
	const settings = () => controller.getSettings();

	const status = ctx.agent.registerTool({
		id: TOOL_STATUS,
		label: "Magpie gateway status",
		description:
			"Check whether the local magpie gateway is running and how many models it currently serves. Use it before answering anything about which models are available on this computer, or when a request to reach magpie failed and the reason matters. Do NOT use it to change magpie's configuration or to start it: this tool only reads the gateway that is already running.",
		scope_use: TOOL_SCOPE,
		parameters: { type: "object", properties: {}, additionalProperties: false },
		handler: async () => {
			const current = settings();
			const probe = await probeGateway(ctx.network, current);
			if (!probe.ok) {
				return JSON.stringify({
					ok: false,
					endpoint: current.baseUrl,
					failure: probe.failure,
					status: probe.status,
					hint: "magpie is not answering on this address; the user starts it (menu-bar app, window, or `magpie serve`).",
				});
			}
			const list = await loadModels(ctx.network, current);
			const state = controller.getState();
			return JSON.stringify({
				ok: true,
				endpoint: current.baseUrl,
				version: probe.version,
				modelCount: list.ok ? list.rows.length : null,
				catalogReadable: list.ok,
				failure: list.ok ? undefined : list.failure,
				publishedToAstravia: state.publishedCount ?? null,
				console: consoleUrl(current.baseUrl),
				providerBaseUrl: providerBaseUrl(current.baseUrl),
			});
		},
	});

	const models = ctx.agent.registerTool({
		id: TOOL_MODELS,
		label: "Magpie models",
		description:
			"List the models the local magpie gateway serves right now, with provider, context window and whether a model takes images. Use it when the user asks which models magpie has, which model to pick for a long context, or whether a specific model is reachable through magpie. Do NOT use it to install providers or sign in — those happen in magpie's own UI.",
		scope_use: TOOL_SCOPE,
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Case-insensitive match on model id, display name or provider." },
				limit: { type: "number", description: `Maximum rows to return (default ${DEFAULT_LIMIT}, max ${MAX_LIMIT}).` },
			},
			additionalProperties: false,
		},
		handler: async (context) => {
			const input = (context.trigger.input ?? {}) as ModelsInput;
			const current = settings();
			const list = await loadModels(ctx.network, current);
			if (!list.ok) {
				return JSON.stringify({ ok: false, endpoint: current.baseUrl, failure: list.failure, status: list.status });
			}
			const matched = filterModels(list.rows, typeof input.query === "string" ? input.query : "");
			const limit = clampLimit(input.limit);
			const shown = matched.slice(0, limit);
			return JSON.stringify({
				ok: true,
				endpoint: current.baseUrl,
				total: list.rows.length,
				matched: matched.length,
				truncated: matched.length > shown.length,
				models: shown.map((row) => ({
					id: row.id,
					provider: row.provider || null,
					contextWindow: row.contextWindow ?? null,
					contextLabel: formatContextWindow(row.contextWindow) ?? null,
					images: row.images,
					reasoning: row.reasoning,
				})),
			});
		},
	});

	return {
		dispose: () => {
			status.dispose();
			models.dispose();
		},
	};
}

/**
 * Adopt the host's model choice for Strix.
 *
 * Astravia keeps provider credentials inside its main process and does not hand
 * them to a plugin runtime (docs/plugin/ai.md:3), so a plugin cannot borrow the
 * host's key. What it *can* do is read which models the user already has
 * (`ctx.ai.listModels()`) and write that model name into Strix's own config, so
 * the user never has to retype a model id or wonder why the two disagree.
 *
 * The resolved name is passed through unchanged: Astravia's `modelKey` is
 * `provider/model`, which is exactly the shape Strix's `STRIX_LLM` expects
 * (strix/interface/environment.py:85).
 */

export interface HostModel {
	modelKey: string;
	name: string;
	provider: string;
}

export interface HostModelReader {
	listModels(): Promise<{ defaultModel: string | null; models: HostModel[] }>;
}

export interface HostModels {
	/** `defaultModel` when the host exposes one, otherwise the first available. */
	preferred?: string;
	available: HostModel[];
	/** Why the list is empty, when the host refused or had nothing configured. */
	error?: string;
}

export async function readHostModels(ctx: unknown): Promise<HostModels> {
	const ai = (ctx as { ai?: Partial<HostModelReader> }).ai;
	if (!ai || typeof ai.listModels !== "function") {
		return { available: [], error: "host does not expose the AI model list" };
	}
	try {
		const { defaultModel, models } = await ai.listModels();
		return {
			preferred: defaultModel ?? models[0]?.modelKey,
			available: models.map(({ modelKey, name, provider }) => ({ modelKey, name, provider })),
		};
	} catch (cause) {
		return { available: [], error: cause instanceof Error ? cause.message : String(cause) };
	}
}

/** Provider base URLs Strix's litellm does not infer from the name alone. */
const API_BASES: Record<string, string> = {
	deepseek: "https://api.deepseek.com/v1",
	zai: "https://api.z.ai/api/paas/v4",
	moonshot: "https://api.moonshot.cn/v1",
	qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
};

export function apiBaseFor(modelKey: string): string {
	const provider = modelKey.split("/", 1)[0]?.toLowerCase() ?? "";
	return API_BASES[provider] ?? "";
}

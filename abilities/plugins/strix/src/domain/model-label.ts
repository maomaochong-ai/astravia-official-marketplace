/**
 * The model line under the Strix composer.
 *
 * Upstream prints `● <name> · <provider>` from whatever STRIX_LLM resolves to
 * (setup.go:setupSummaryView). Here the model is the host's, so the same line is
 * built from `ctx.ai.listModels()`: the user's default when it is available,
 * otherwise the first one - never a model the host cannot serve.
 */

import type { PluginAiModel, PluginAiModelListResult } from "@astravia-org/plugin-sdk";

export interface ModelChoice {
	modelKey: string;
	name: string;
	provider: string;
}

/** `provider/model` split at the last slash, the way upstream splits STRIX_LLM. */
export function modelLabel(modelKey: string): { name: string; provider: string } {
	const slash = modelKey.lastIndexOf("/");
	return slash < 0
		? { name: modelKey, provider: "" }
		: { name: modelKey.slice(slash + 1), provider: modelKey.slice(0, slash) };
}

export function toChoice(model: PluginAiModel): ModelChoice {
	const label = modelLabel(model.modelKey);
	return {
		modelKey: model.modelKey,
		name: model.name || label.name,
		provider: model.provider || label.provider,
	};
}

export function chooseModel(list: PluginAiModelListResult | undefined): ModelChoice | undefined {
	if (!list?.models.length) return undefined;
	const preferred = list.defaultModel ? list.models.find((model) => model.modelKey === list.defaultModel) : undefined;
	return toChoice(preferred ?? list.models[0]!);
}

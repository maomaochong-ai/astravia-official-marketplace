/**
 * Where the plugin's model and workspace come from.
 *
 * The console is not a second agent with its own settings: it reads the *active
 * conversation* and follows it. Two things travel from host to plugin, and each has one
 * source of truth:
 *
 *  - **model**  — `ConversationState.model` (`provider/id`). The panel displays it and
 *    nothing more: the run itself happens inside the host conversation, on the model the
 *    host already resolved, so there is no second model selection to drift out of sync.
 *  - **workspace** — `ConversationState.cwd`, which is the folder the host agent works
 *    in and the folder the sandbox mounts, so "review this repo" means one thing in both
 *    windows.
 *
 * Tool-name and message projection used to live here too; those call rules now sit in
 * `conversation-projection.ts`, next to the event split they belong to.
 *
 * Pure functions only: narrowing and naming, no I/O, so they are testable without a host.
 */

import type { PluginAiModel } from "@astravia-org/plugin-sdk";
import type { ModelChoice } from "./model-label";
import { toChoice } from "./model-label";

export interface ModelResolution {
	choice?: ModelChoice;
	/** True when the model came from the active conversation rather than the default. */
	fromConversation: boolean;
}

/**
 * The conversation's model is the only authority.
 *
 * `models` is optional and used for display only (a nicer label than the raw key). A
 * conversation can name a model the list does not offer — an older host, or a provider
 * the list call skipped — and the label then falls back to splitting the key, because the
 * host is still the authority on what it will run.
 */
export function resolveModel(input: {
	conversationModel: string | null | undefined;
	models?: readonly PluginAiModel[];
	/** Kept out of the resolution on purpose (ADR strix-0003): the conversation decides. */
	defaultModel?: string | null;
}): ModelResolution {
	const { conversationModel, models = [] } = input;
	const match = (key: string | null | undefined): PluginAiModel | undefined =>
		key ? models.find((model) => model.modelKey === key) : undefined;

	if (conversationModel) {
		const listed = match(conversationModel);
		if (listed) return { choice: toChoice(listed), fromConversation: true };
		const slash = conversationModel.lastIndexOf("/");
		return {
			choice: {
				modelKey: conversationModel,
				name: conversationModel.slice(slash + 1),
				provider: slash < 0 ? "" : conversationModel.slice(0, slash),
			},
			fromConversation: true,
		};
	}

	// No host-wide fallback (ADR strix-0003). The conversation is the only authority on
	// which model runs: picking `defaultModel` here made the panel claim a model the chart
	// was not using, and switching model in the chat did not reach the panel. Without one
	// the panel says so (log.noModel) instead of inventing a choice.
	return { choice: undefined, fromConversation: false };
}

/** A short name for the workspace, for the status row. */
export function workspaceLabel(cwd: string | null | undefined): string | undefined {
	if (!cwd) return undefined;
	const parts = cwd.split(/[\\/]/).filter(Boolean);
	return parts.at(-1);
}

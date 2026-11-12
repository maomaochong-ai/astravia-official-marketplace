/**
 * Where the plugin's model, workspace and trace come from.
 *
 * The console is not a second agent with its own settings: it reads the *active
 * conversation* and follows it. Three things travel from host to plugin, and each
 * has one source of truth:
 *
 *  - **model**  - `ConversationState.model` (`provider/id`), falling back to the
 *    user's default when the conversation has none. `ctx.ai.chat({ modelKey })`
 *    accepts exactly that string, so the console runs on the same model, plan and
 *    quota as the chat next to it.
 *  - **workspace** - `ConversationState.cwd`, mounted into the sandbox as the
 *    working directory, the way upstream mounts cwd for a prompt with no target.
 *  - **trace** - the host agent's own tool calls. When the user drives Strix from
 *    the chat ("scan this host"), those calls reach the same sandbox; the panel
 *    narrates them so both surfaces read as one assessment.
 *
 * Pure functions only: narrowing and naming, no I/O, so they are testable without
 * a host.
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
 * The conversation's model wins; the default fills the gap.
 *
 * A conversation can name a model `ctx.ai.listModels()` does not offer for text
 * (or the list can be empty on an older host). In that case the conversation still
 * decides - the host is the authority on what it will run - and the label falls back
 * to splitting the key.
 */
export function resolveModel(input: {
	conversationModel: string | null | undefined;
	models: readonly PluginAiModel[];
	defaultModel: string | null | undefined;
}): ModelResolution {
	const { conversationModel, models, defaultModel } = input;
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

	const fallback = match(defaultModel) ?? models[0];
	return { choice: fallback ? toChoice(fallback) : undefined, fromConversation: false };
}

/** The `strix_*` tool behind whatever namespace the host applied to it. */
export function strixToolName(toolName: string): string | undefined {
	// The host namespaces MCP tools, e.g. `mcp__strix__strix_exec`; the part that matters
	// is the last `strix_*` segment, whatever separator precedes it.
	const trimmed = toolName.trim();
	const index = trimmed.toLowerCase().lastIndexOf("strix_");
	if (index < 0) return undefined;
	const candidate = trimmed.slice(index).replace(/_+$/, "");
	return /^strix_[a-z0-9_]+$/i.test(candidate) ? candidate : undefined;
}

/**
 * A trace label for a host tool call: the tool, and the argument that says what it
 * acts on. Returns undefined for tools that are not Strix's, so an unrelated MCP
 * server in the same conversation does not leak into the trace.
 */
export function hostToolCall(toolName: string, args?: Record<string, unknown>): { label: string; detail?: string } | undefined {
	const name = strixToolName(toolName);
	if (!name) return undefined;
	const values = args ?? {};
	const pick = (key: string): string | undefined => (typeof values[key] === "string" ? (values[key] as string) : undefined);
	const detail =
		pick("command") ??
		pick("title") ??
		(Array.isArray(values.targets) ? values.targets.map(String).join(" ") : undefined) ??
		(Array.isArray(values.names) ? values.names.map(String).join(", ") : undefined);
	return detail ? { label: name, detail } : { label: name };
}

/** A short name for the workspace, for the status row. */
export function workspaceLabel(cwd: string | null | undefined): string | undefined {
	if (!cwd) return undefined;
	const parts = cwd.split(/[\\/]/).filter(Boolean);
	return parts.at(-1);
}

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import type { DestinationKey } from "../domain/boardmix-destinations";
import { resolveEntryTarget } from "../features/boardmix-workspace/services/entry-target";
import { TOOL_IDS } from "../plugin-ids";
import { ensureTab, envelope, rejection } from "./boardmix-navigation-tools";

const TOOL_SCOPE = ["conversation", "project"] as const;

const AI_SOURCES = {
	ppt: "aiPpt",
	flowchart: "aiFlowchart",
	chat: "aiChat",
} as const satisfies Record<string, DestinationKey>;

type AiKind = keyof typeof AI_SOURCES;

async function enterDestination(
	ctx: PluginContext,
	key: DestinationKey,
	next: string,
	cwd?: string,
): Promise<string> {
	const target = resolveEntryTarget({ kind: "destination", key });
	if (!target.ok) return rejection(target.reason, "This destination is not configured; report it as a plugin bug.");
	const handle = await ensureTab(ctx, cwd);
	if (!handle) {
		return JSON.stringify({
			ok: false,
			open: false,
			url: target.url,
			reason: "tab-not-ready",
			next: "Ask the user to open the Boardmix tab from the tab bar, then retry.",
		});
	}
	const snapshot = await handle.navigate(target.url);
	const landed = snapshot.open && !snapshot.failure;
	return envelope(snapshot, {
		needsUserAction: true,
		next: landed
			? next
			: "The page did not load, so the panel is still where it was. Read the failure text, ask the user to press Retry in the panel, and do not claim the panel moved.",
	});
}

/**
 * 两个「送到门口」的工具：页面打开后由用户点下去。它们固定带
 * `needsUserAction: true`——插件没有能力替用户按下生成按钮，也不该假装按过。
 */
export function registerDestinationTools(ctx: PluginContext): Disposable[] {
	return [
		ctx.agent.registerTool({
			id: TOOL_IDS.newDoc,
			label: "%tool.new.label%",
			description:
				"Open Boardmix's create entry so the user can pick a whiteboard, mind map, document or table and start it. " +
				"Use when the user wants something new rather than an existing board. " +
				"It only navigates: the plugin cannot create, name or edit a board for the user.",
			parameters: { type: "object", properties: {}, additionalProperties: false },
			scope_use: TOOL_SCOPE,
			timeoutMs: 30_000,
			handler: async ({ session }) =>
				enterDestination(
					ctx,
					"create",
					"Ask the user to pick the board type and press create. If the type is a diagram, you can write the Mermaid source while they paste it in.",
					session.cwd,
				),
		}),
		ctx.agent.registerTool<{ kind: AiKind }>({
			id: TOOL_IDS.ai,
			label: "%tool.ai.label%",
			description:
				"Open one of Boardmix's own AI entries: ppt (slide deck), flowchart (diagram from a description) or chat (the in-page assistant). " +
				"Use when the user wants Boardmix to generate the artifact in place. " +
				"Do NOT use it to promise a result: generation runs on the user's account and consumes their points, so the user must press generate.",
			parameters: {
				type: "object",
				properties: {
					kind: {
						type: "string",
						enum: ["ppt", "flowchart", "chat"],
						description: "Which Boardmix AI entry to open. There is no separate mind-map entry.",
					},
				},
				required: ["kind"],
				additionalProperties: false,
			},
			scope_use: TOOL_SCOPE,
			timeoutMs: 30_000,
			handler: async ({ trigger, session }) => {
				const kind = trigger.input?.kind;
				if (!kind || !(kind in AI_SOURCES)) {
					return JSON.stringify({
						ok: false,
						open: false,
						reason: "invalid-kind",
						next: "Use kind = ppt, flowchart or chat.",
					});
				}
				return enterDestination(
					ctx,
					AI_SOURCES[kind],
					"Give the user a prompt they can paste (topic, audience, structure, length), then let them press generate. Do not claim the artifact exists.",
					session.cwd,
				);
			},
		}),
	];
}

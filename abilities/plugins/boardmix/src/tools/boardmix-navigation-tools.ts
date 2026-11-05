import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import {
	DESTINATIONS,
	phaseOf,
} from "../domain/boardmix-destinations";
import type { BoardmixSnapshot } from "../domain/boardmix-entry";
import { resolveEntryTarget } from "../features/boardmix-workspace/services/entry-target";
import {
	boardmixTab,
	snapshotOrClosed,
	waitForBoardmixTab,
	type BoardmixTabHandle,
} from "../features/boardmix-workspace/services/tab-registry";
import { ACTIVITY_TAB_ID, TOOL_IDS } from "../plugin-ids";

const TOOL_SCOPE = ["conversation", "project"] as const;

export const NO_TAB_NEXT =
	"Call boardmix_open first: the whiteboard lives in its activity tab, and these tools only act on that tab.";

export function envelope(
	snapshot: BoardmixSnapshot,
	extra: Record<string, unknown> = {},
): string {
	return JSON.stringify({ ok: snapshot.open, ...snapshot, ...extra });
}

export function rejection(
	reason: "origin-not-allowed" | "invalid-url",
	next: string,
): string {
	return JSON.stringify({
		ok: false,
		open: boardmixTab() !== null,
		url: "",
		origin: "",
		phase: "unknown",
		seedLevel: 0,
		landedAt: null,
		reason,
		next,
	});
}

/** 先开标签页，再等句柄挂上；超时返回 null，由调用方转成一句可执行的话。 */
export async function ensureTab(ctx: PluginContext): Promise<BoardmixTabHandle | null> {
	const existing = boardmixTab();
	if (existing) return existing;
	ctx.ui.openActivityTab(ACTIVITY_TAB_ID, { width: "max" });
	return waitForBoardmixTab();
}

export function registerNavigationTools(ctx: PluginContext): Disposable[] {
	const disposables: Disposable[] = [];

	disposables.push(
		ctx.agent.registerTool({
			id: TOOL_IDS.open,
			label: "%tool.open.label%",
			description:
				"Open the Boardmix whiteboard workspace in its activity tab and return where it landed. " +
				"Use when the user wants to work in Boardmix itself. " +
				"After this call the panel is readable: boardmix_read lists the controls on screen with the points to " +
				"click, boardmix_act clicks and types, boardmix_shot captures what is drawn. Canvas shapes themselves " +
				"are pixels, so look at a screenshot rather than claiming what a layer contains.",
			parameters: { type: "object", properties: {}, additionalProperties: false },
			scope_use: TOOL_SCOPE,
			timeoutMs: 30_000,
			handler: async () => {
				const handle = await ensureTab(ctx);
				if (!handle) {
					return JSON.stringify({
						ok: false,
						open: false,
						reason: "tab-not-ready",
						next: "Ask the user to open the Boardmix tab from the tab bar, then retry.",
					});
				}
				const snapshot = await handle.navigate(DESTINATIONS.workspace);
				return envelope(snapshot, {
					next: "Tell the user where it landed. Repeat their own words for the task; do not describe what is on the canvas.",
				});
			},
		}),
	);

	disposables.push(
		ctx.agent.registerTool<{ url: string }>({
			id: TOOL_IDS.goto,
			label: "%tool.goto.label%",
			description:
				"Send the Boardmix tab to one boardmix.cn address the user already has. " +
				"Use it for a whiteboard link the user pasted, or a Boardmix page they named. " +
				"It refuses every non-boardmix origin, and it does not invent a file id: if you have no address, ask for the link instead.",
			parameters: {
				type: "object",
				properties: {
					url: {
						type: "string",
						description: "A https://boardmix.cn/... address, usually one the user pasted.",
					},
				},
				required: ["url"],
				additionalProperties: false,
			},
			scope_use: TOOL_SCOPE,
			timeoutMs: 30_000,
			handler: async ({ trigger }) => {
				const target = resolveEntryTarget({
					kind: "url",
					url: String(trigger.input?.url ?? ""),
				});
				if (!target.ok) {
					return rejection(
						target.reason,
						"Only https://boardmix.cn addresses can be opened. Ask the user for the whiteboard link instead of guessing one.",
					);
				}
				const handle = await ensureTab(ctx);
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
				return envelope(snapshot, {
					next: "Report the landed address and phase. If phase is login, the user has to sign in themselves.",
				});
			},
		}),
	);

	disposables.push(
		ctx.agent.registerTool({
			id: TOOL_IDS.tabStatus,
			label: "%tool.status.label%",
			description:
				"Report whether the Boardmix tab is open, which address it shows and whether it sits on the login page. " +
				"Read-only: it never opens the tab. Use it before promising anything about Boardmix during a turn.",
			parameters: { type: "object", properties: {}, additionalProperties: false },
			scope_use: TOOL_SCOPE,
			timeoutMs: 10_000,
			handler: async () => {
				const snapshot = snapshotOrClosed();
				if (!snapshot.open) {
					return JSON.stringify({
						ok: false,
						...snapshot,
						next: NO_TAB_NEXT,
					});
				}
				return envelope(snapshot, {
					next:
						snapshot.phase === "login"
							? "The tab sits on the login page: the user must sign in before Boardmix shows any board."
							: "Use this address in your answer; do not claim to know the canvas contents.",
				});
			},
		}),
	);

	disposables.push(
		ctx.agent.registerTool<{ url?: string }>({
			id: TOOL_IDS.openInBrowser,
			label: "%tool.openInBrowser.label%",
			description:
				"Hand the current Boardmix address (or the workspace root) to the user's default browser. " +
				"Use it when the in-app tab fails to load or the user needs a second account. " +
				"It opens the system browser, not the in-app panel.",
			parameters: {
				type: "object",
				properties: {
					url: { type: "string", description: "Optional boardmix.cn address; defaults to the current one." },
				},
				required: [],
				additionalProperties: false,
			},
			scope_use: TOOL_SCOPE,
			timeoutMs: 15_000,
			handler: async ({ trigger }) => {
				const requested = String(trigger.input?.url ?? "").trim();
				const fallback = snapshotOrClosed().url || DESTINATIONS.workspace;
				const target = resolveEntryTarget(
					requested ? { kind: "url", url: requested } : { kind: "url", url: fallback },
				);
				if (!target.ok) {
					return rejection(
						target.reason,
						"Only https://boardmix.cn addresses can be handed to the browser.",
					);
				}
				try {
					await ctx.ui.openExternal(target.url);
				} catch (error) {
					return JSON.stringify({
						ok: false,
						open: boardmixTab() !== null,
						url: target.url,
						reason: "open-external-failed",
						failure: error instanceof Error ? error.message : String(error),
						next: "Tell the user the address so they can paste it into a browser themselves.",
					});
				}
				return JSON.stringify({
					ok: true,
					open: boardmixTab() !== null,
					url: target.url,
					origin: new URL(target.url).origin,
					phase: phaseOf(target.url),
					openedExternally: true,
					next: "The system browser now has the address. Signing in there does not sign in this tab.",
				});
			},
		}),
	);

	return disposables;
}

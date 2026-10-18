/**
 * Talking to the host conversation from the console.
 *
 * Posting needs `agent.session.write`. The SDK exposes no runtime permission
 * probe, so the call is attempted and the failure is reported: a missing grant
 * shows up as a hint in the panel, not as a disabled input with no explanation.
 */

import type { SendPromptResult } from "@astravia-org/plugin-sdk";
import { getPluginContext, hasPluginContext } from "./plugin-context";

export type PromptOutcome =
	| { status: "sent" | "queued" }
	/** No active session: the text was placed in the host input bar instead. */
	| { status: "drafted" }
	| { status: "failed"; message: string };

export async function sendPrompt(text: string): Promise<PromptOutcome> {
	const trimmed = text.trim();
	if (!trimmed) return { status: "failed", message: "empty" };
	if (!hasPluginContext()) return { status: "failed", message: "context-unavailable" };

	const conversation = getPluginContext().conversation;
	let result: SendPromptResult;
	try {
		result = await conversation.sendPrompt(trimmed);
	} catch (error) {
		// No active session (or no grant): hand the text over instead of dropping it.
		try {
			conversation.insertText(trimmed);
			return { status: "drafted" };
		} catch {
			return { status: "failed", message: error instanceof Error ? error.message : String(error) };
		}
	}

	if (result.status === "failed") {
		return { status: "failed", message: result.error?.message ?? "failed" };
	}
	return { status: result.status };
}

export async function abortTurn(): Promise<boolean> {
	if (!hasPluginContext()) return false;
	try {
		await getPluginContext().conversation.abort();
		return true;
	} catch {
		return false;
	}
}

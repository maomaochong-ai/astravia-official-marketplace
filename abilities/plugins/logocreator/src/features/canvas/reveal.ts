import type { PluginContext } from "@astravia-org/plugin-sdk";
import { activeScopeKey } from "./canvas-prompt";
import { setPendingDesignId } from "./pending-design";
import { LOGO_TAB_ID } from "../../tab-ids";

/**
 * Bring the canvas up on a design the tool just produced.
 *
 * Everything about this used to be one `try` block in each tool, which is how "image
 * generation works but the canvas never opens" became possible: a single throwing call
 * skipped the open, and the failure was swallowed.
 *
 * Three things make it dependable, all of them stated in the SDK:
 *  - **no `cwd` on the open calls.** `setActivityTabVisible`/`openActivityTab` default to
 *    "the conversation the host is displaying", which is exactly what the user is
 *    looking at. Passing a tool-session cwd only works when that cwd matches the visible
 *    conversation; when it does not, the call records the tab against a conversation
 *    nobody is watching and nothing appears.
 *  - **the pending id is written under both keys** (the active scope and the tool's own
 *    cwd), so whichever scope the panel resolves to finds it.
 *  - **the failures are collected**, not swallowed: the tool reports them, so a refusal
 *    reads as a message instead of as "nothing happened".
 */
export interface RevealResult {
	opened: boolean;
	/** Present when opening failed; safe to surface to the user. */
	error?: string;
}

export function revealInCanvas(
	ctx: PluginContext,
	cwd: string | null | undefined,
	designId: string,
): RevealResult {
	// Hand the design over first: the panel claims it when it mounts or when it re-renders.
	setPendingDesignId(cwd ?? undefined, designId);
	setPendingDesignId(activeScopeKey(), designId);

	const errors: string[] = [];
	try {
		ctx.ui.setActivityTabVisible(LOGO_TAB_ID, true);
	} catch (cause) {
		errors.push(describe(cause));
		// A host that insists on an explicit target still gets one.
		try {
			ctx.ui.setActivityTabVisible(LOGO_TAB_ID, true, cwd ? { cwd } : undefined);
		} catch (retry) {
			errors.push(describe(retry));
		}
	}
	try {
		ctx.ui.openActivityTab(LOGO_TAB_ID, { width: "max" });
	} catch (cause) {
		errors.push(describe(cause));
		try {
			ctx.ui.openActivityTab(LOGO_TAB_ID, cwd ? { width: "max", cwd } : { width: "max" });
		} catch (retry) {
			errors.push(describe(retry));
		}
	}

	if (errors.length === 0) return { opened: true };
	return { opened: false, error: errors[0] };
}

function describe(cause: unknown): string {
	return cause instanceof Error ? cause.message : String(cause);
}

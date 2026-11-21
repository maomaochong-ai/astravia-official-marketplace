import type { PluginAgentToolRegistration } from "@astravia-org/plugin-sdk";
import { getNoteStore, getPluginContext } from "../plugin-context";
import { TOOL_LABELS } from "../contributions";
import { TOOL_NOTES } from "../tab-ids";

interface NotesToolInput {
	/** `list` (default) reads pending notes; `resolve` closes them after a re-render. */
	action?: "list" | "resolve";
	/** Note ids to resolve; omit to resolve every note of `designId`. */
	ids?: string[];
	designId?: string;
}

interface NotesToolResult {
	ok: boolean;
	pending: { id: string; text: string; designId: string | null }[];
	resolved?: number;
	notes: string[];
}

/**
 * `logocreator_notes` — read the notes the user pinned on the canvas, then close
 * them once the design actually changed.
 *
 * The canvas can send its notes as a chat turn on its own, but a turn is easy to
 * lose (the user edits it, the model answers something else). This tool is the
 * deterministic side of the same loop: the agent can ask "what is pinned right
 * now", apply the changes, and mark exactly those notes resolved.
 */
export function createNotesTool(): PluginAgentToolRegistration<NotesToolInput> {
	return {
		id: TOOL_NOTES,
		name: TOOL_NOTES,
		label: TOOL_LABELS.notes,
		description: [
			"Read and close the notes the user pinned on the LogoCreator canvas.",
			"`action: \"list\"` (default) returns the pending notes with their ids and the design they belong to. Apply each one as a field change on the spec, then call this tool again with `action: \"resolve\"` — pass the ids you actually addressed, or the whole `designId`.",
			"Do NOT resolve a note you did not act on: the pinned list is the user's checklist, and closing an untouched note hides work that is still due.",
			"Do NOT use it to write notes; only the user pins them, in the panel.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				action: { type: "string", enum: ["list", "resolve"], description: "list (default) or resolve." },
				ids: { type: "array", items: { type: "string" }, description: "Note ids to resolve." },
				designId: { type: "string", description: "Restrict to (or resolve all of) one design." },
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		handler: async ({ trigger }) => {
			const input = trigger.input ?? {};
			const store = getNoteStore();
			await store.hydrate();

			if (input.action === "resolve") {
				const ids = input.ids?.length
					? input.ids
					: store.pending(input.designId).map((note) => note.id);
				const resolved = await store.resolve(ids);
				const result: NotesToolResult = {
					ok: true,
					resolved,
					pending: store.pending().map(toRow),
					notes: resolved === 0 ? ["No note matched; nothing was closed."] : [],
				};
				// The canvas is the evidence; keep it in view after a change.
				try {
					getPluginContext().ui.openActivityTab("logocreator-canvas", { width: "max" });
				} catch {
					// Opening the tab is a convenience here; the notes are already closed.
				}
				return result;
			}

			return {
				ok: true,
				pending: store.pending(input.designId).map(toRow),
				notes: [],
			} satisfies NotesToolResult;
		},
	};
}

function toRow(note: { id: string; text: string; designId: string | null }) {
	return { id: note.id, text: note.text, designId: note.designId };
}

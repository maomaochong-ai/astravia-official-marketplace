import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { CHECKLIST_TYPES, checklistById, checklistMenu } from "../domain/playbooks";
import { docById, loadDoc } from "../features/workbench/services/docs";
import { kitProvenance, truncationNote } from "./doc-header";

const DEFAULT_CHARS = 12_000;
const MAX_CHARS = 60_000;

interface KbChecklistInput {
	checklist_type?: string;
	maxChars?: number;
}

export function registerKbChecklistTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<KbChecklistInput>({
		id: "kb_checklist",
		name: "kb_checklist",
		label: "%tool.checklist.label%",
		description: [
			"Open one of the workbench kit's tactical checklists by name, without searching for it first.",
			"",
			`Six types: ${CHECKLIST_TYPES.map(entry => entry.id).join(", ")}.`,
			`Default and fallback is ${CHECKLIST_TYPES[0]?.id}.`,
			"",
			"Use it when the task is already classified and the next step is procedure rather than discovery: a",
			"fresh web target, a PE sample to triage for IOCs, a persistence chain to walk, a YARA rule to write.",
			"When you do not yet know which one applies, call `search_docs` instead — it returns the same",
			"documents plus everything around them.",
			"",
			"An unknown type is answered with the menu, never with a silent substitution.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				checklist_type: { type: "string", description: `One of: ${CHECKLIST_TYPES.map(entry => entry.id).join(", ")}.` },
				maxChars: { type: "integer", description: `Character budget (default ${DEFAULT_CHARS}, max ${MAX_CHARS}).` },
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 60_000,
		handler: async context => {
			const input = context.trigger.input;
			const requested = (input.checklist_type ?? "").trim();
			const type = checklistById(requested);
			if (!type) {
				return [
					`No checklist type "${requested}".`,
					"",
					checklistMenu(),
					"",
					"These are the kit's own checklists, not a catalogue of everything it ships; `search_docs` covers the rest.",
				].join("\n");
			}

			const entry = docById(type.doc);
			if (!entry) return `Checklist ${type.id} points at ${type.doc}, which is not in this build's document index.`;

			let text: string;
			try {
				text = await loadDoc(type.doc);
			} catch (error) {
				return `Could not read ${type.doc}: ${error instanceof Error ? error.message : String(error)}`;
			}

			const budget = Math.max(500, Math.min(MAX_CHARS, Math.trunc(input.maxChars ?? DEFAULT_CHARS)));
			const header = [
				`# ${entry.title}`,
				kitProvenance,
				"",
				`${type.id} · \`${type.doc}\` · ${entry.bytes} bytes · ${entry.lines} lines`,
				"",
			];
			if (text.length <= budget) return [...header, text].join("\n");
			return [...header, text.slice(0, budget), "", truncationNote(budget, text.length)].join("\n");
		},
	});
}

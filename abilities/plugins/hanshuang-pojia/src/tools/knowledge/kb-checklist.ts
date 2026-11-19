/**
 * `kb_checklist`：按名字直接打开工具箱里的一份战术清单。
 *
 * 输入是**已分类**的任务形态（web 目标、PE 取证、持久化链、YARA 编写），不是关键词；
 * 尚未分类时应改用 `search_docs`。未知类型返回菜单，绝不静默替换成默认那份——
 * 「打开错了清单还照它做」比「没打开」更糟。
 */
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { DEFAULT_DOC_BUDGET, MAX_DOC_BUDGET, partialNotice, sliceDocument } from "../../domain/doc-slice";
import { CHECKLIST_TYPES, checklistById, checklistMenu } from "../../domain/playbooks";
import { loadDocsLibrary } from "../../features/workbench/services/docs";
import { kitProvenance } from "../lib/doc-header";
import { publishToolResult } from "../../runtime/panel-channel";

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
				maxChars: {
					type: "integer",
					description: `Characters in this part (default ${DEFAULT_DOC_BUDGET}, max ${MAX_DOC_BUDGET}).`,
				},
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

			const library = await loadDocsLibrary();
			const entry = library.byId(type.doc);
			if (!entry) return `Checklist ${type.id} points at ${type.doc}, which is not in this build's document index.`;

			let text: string;
			try {
				text = await library.loadBody(type.doc);
			} catch (error) {
				return `Could not read ${type.doc}: ${error instanceof Error ? error.message : String(error)}`;
			}

			const budget = Math.max(500, Math.min(MAX_DOC_BUDGET, Math.trunc(input.maxChars ?? DEFAULT_DOC_BUDGET)));
			publishToolResult({
				toolId: "kb_checklist",
				kind: "checklist",
				target: type.id,
				summary: `${entry.title} (${entry.lines} lines) opened`,
				payload: {
					id: type.id,
					doc: type.doc,
					lines: entry.lines,
					bytes: entry.bytes,
				},
			});
			const header = [
				`# ${entry.title}`,
				kitProvenance,
				"",
				`${type.id} · \`${type.doc}\` · ${entry.bytes} bytes · ${entry.lines} lines`,
				"",
			];
			// 与 read_doc 同一套分片：清单也可能超过一份回复的预算（ADR 0009 D5 的续读口径）。
			const slice = sliceDocument(text, 0, budget);
			const notice = partialNotice(slice, {
				id: type.doc,
				extraArgs: input.maxChars === undefined ? undefined : { maxChars: budget },
			});
			return [...header, slice.text, ...(notice === "" ? [] : ["", notice])].join("\n");
		},
	});
}

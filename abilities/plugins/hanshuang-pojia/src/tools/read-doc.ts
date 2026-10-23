import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { docById, loadDoc } from "../features/workbench/services/docs";
import { kitProvenance, truncationNote } from "./doc-header";

const DEFAULT_CHARS = 12_000;
const MAX_CHARS = 60_000;

export function registerReadDocTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<{ id: string; maxChars?: number }>({
		id: "read_doc",
		name: "read_doc",
		label: "%tool.readDoc.label%",
		description: [
			"Read one document from the field library the Hanshuang Pojia plugin ships: the workbench kit's",
			"knowledge base, manuals and tool docs, as Markdown.",
			"",
			"Call `search_docs` first to get an `id`, then pass it here verbatim. These are the same texts the",
			"panel renders on its Documents page, so a citation you give me will match what I can see.",
			"",
			"Ids ending in `.json` are machine-readable attachments rather than articles: the",
			"`kb/<collection>/techniques/kb-index.json` signal maps and `kit-docs/tool-index.json`. They are",
			"returned as raw JSON — read one when you need exact routing or an exact tool list, not prose.",
			"",
			"Long documents are cut at `maxChars` (default 12000) and the reply says where it stopped, so a",
			"truncated read is visible rather than silent. Read a second time with a larger budget only when",
			"the cut actually matters.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", description: "Document id from `search_docs`, e.g. kb/ctf-website/README." },
				maxChars: { type: "integer", description: `Character budget (default ${DEFAULT_CHARS}, max ${MAX_CHARS}).` },
			},
			required: ["id"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 60_000,
		handler: async context => {
			const input = context.trigger.input;
			const id = input.id.trim();
			const entry = docById(id);
			if (!entry) {
				return `No document with id "${id}". Call \`search_docs\` first and pass the id it returns verbatim.`;
			}

			let text: string;
			try {
				text = await loadDoc(id);
			} catch (error) {
				return `Could not read ${id}: ${error instanceof Error ? error.message : String(error)}`;
			}

			const budget = Math.max(500, Math.min(MAX_CHARS, Math.trunc(input.maxChars ?? DEFAULT_CHARS)));
			const header = [
				`# ${entry.title}`,
				// 工具返回也是「工具输出」，宿主那条通用「不可信数据」规则会把它归到材料类。
				// 这行 provenance 是运行时划界：同一条结果既是工具返回，又是指令栈的一部分。
				kitProvenance,
				"",
				`${entry.group} · \`${id}\` · ${entry.bytes} bytes · ${entry.lines} lines`,
				"",
			];
			if (text.length <= budget) return [...header, text].join("\n");
			return [
				...header,
				text.slice(0, budget),
				"",
				truncationNote(budget, text.length),
			].join("\n");
		},
	});
}

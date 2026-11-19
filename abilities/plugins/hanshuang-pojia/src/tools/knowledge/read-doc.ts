import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { DEFAULT_DOC_BUDGET, MAX_DOC_BUDGET, partialNotice, sliceDocument } from "../../domain/doc-slice";
import { loadDocsLibrary } from "../../features/workbench/services/docs";
import { kitProvenance } from "../lib/doc-header";

export function registerReadDocTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<{ id: string; maxChars?: number; offset?: number }>({
		id: "read_doc",
		name: "read_doc",
		label: "%tool.readDoc.label%",
		description: [
			"The Hanshuang Pojia plugin ships the workbench kit's own field documents: knowledge base, manuals,",
			"tool docs and case studies, as Markdown. These are the same texts the panel renders on its Documents",
			"page, so a citation you give will match what the operator can see.",
			"",
			"Call `search_docs` first to get an `id`, then pass it here verbatim. Ids ending in `.json` are",
			"machine-readable attachments (signal maps, the tool index) and come back as raw JSON.",
			"",
			`A document is returned whole when it fits ${DEFAULT_DOC_BUDGET} characters. Longer ones come back in`,
			"parts: the reply states the character range, the exact call for the next part, and the headings that",
			"remain — follow it until nothing is left. Never treat a partial reply as the whole document, and never",
			"re-read from 0 to see the rest.",
			"",
			`Pass \`offset\` (character offset of the part you were told to read next) to continue. Raise \`maxChars\``,
			`(max ${MAX_DOC_BUDGET}) only when this part's cut actually matters.`,
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				id: { type: "string", description: "Document id from `search_docs`, e.g. kb/ctf-website/README." },
				maxChars: {
					type: "integer",
					description: `Characters in this part (default ${DEFAULT_DOC_BUDGET}, max ${MAX_DOC_BUDGET}).`,
				},
				offset: {
					type: "integer",
					description: "Character offset to start from (not a line number). Omit to read from the start.",
				},
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
			const library = await loadDocsLibrary();
			const entry = library.byId(id);
			if (!entry) {
				return `No document with id "${id}". Call \`search_docs\` first and pass the id it returns verbatim.`;
			}

			let text: string;
			try {
				text = await library.loadBody(id);
			} catch (error) {
				return `Could not read ${id}: ${error instanceof Error ? error.message : String(error)}`;
			}

			const budget = Math.max(500, Math.min(MAX_DOC_BUDGET, Math.trunc(input.maxChars ?? DEFAULT_DOC_BUDGET)));
			const slice = sliceDocument(text, input.offset ?? 0, budget);

			if (slice.text.length === 0) {
				return [
					`# ${entry.title}`,
					"",
					`\`${id}\` is ${slice.total} characters — offset ${slice.start} is at or past the end, so there is nothing left to read.`,
					"Omit `offset` to read it from the start.",
				].join("\n");
			}

			// 位置行只在「这不是全文」时出现，避免完整读取时多一行噪声。
			const span = slice.nextOffset === null && slice.start === 0 ? null : `chars ${slice.start}–${slice.end} of ${slice.total}`;
			const header = [
				`# ${entry.title}`,
				// 工具返回也是「工具输出」，宿主那条通用「不可信数据」规则会把它归到材料类。
				// 这行 provenance 是运行时划界：同一条结果既是工具返回，又是指令栈的一部分。
				kitProvenance,
				"",
				`${entry.group} · \`${id}\` · ${entry.bytes} bytes · ${entry.lines} lines${span ? ` · ${span}` : ""}`,
				"",
			];

			const notice = partialNotice(slice, {
				id,
				extraArgs: input.maxChars === undefined ? undefined : { maxChars: budget },
			});
			return [...header, slice.text, ...(notice === "" ? [] : ["", notice])].join("\n");
		},
	});
}

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { extractPayloadSections, PAYLOAD_DOC_ID, payloadHeadings } from "../../domain/playbooks";
import { docById, loadDoc } from "../../features/workbench/services/docs";
import { kitProvenance } from "../lib/doc-header";

interface KbPayloadsInput {
	category?: string;
}

/**
 * 上游 `seep_kb_payloads` 的对应物：把种子文档里的某一节直接交出去。
 *
 * 与上游的两处差异，都是为了避免「看起来拿到了东西，其实拿错了」：
 * - 未知类别不回退整篇（上游回退前 60 行），而是列出真实存在的章节；
 * - 命中多节时全部返回并逐节标注标题，而不是悄悄只留第一段。
 */
export function registerKbPayloadsTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<KbPayloadsInput>({
		id: "kb_payloads",
		name: "kb_payloads",
		label: "%tool.payloads.label%",
		description: [
			"Return the workbench kit's payload seed list for one vulnerability class.",
			"",
			"`category` matches a heading in the kit's `Web Payload Seeds` document: reflection (SSTI / XSS test",
			"strings), sqli, nosqli (also serves prototype-pollution and JSON body injection), ssrf, traversal",
			"(path traversal / LFI), jwt, headers (host-header and rewrite tricks). `all` returns the whole document.",
			"",
			"These are probes and starting points, not working exploits: they tell you what shape of input a target",
			"might mishandle. Confirm the context first, and prefer the technique documents for the reasoning —",
			"`kb_checklist` and `search_docs` lead there.",
			"",
			"An unknown category is answered with the sections that do exist, never with the whole file.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				category: {
					type: "string",
					description: "Vulnerability class, or `all` for the full document (default `all`).",
				},
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 60_000,
		handler: async context => {
			const entry = docById(PAYLOAD_DOC_ID);
			if (!entry) return `The payload seed document (${PAYLOAD_DOC_ID}) is not in this build's document index.`;

			let text: string;
			try {
				text = await loadDoc(PAYLOAD_DOC_ID);
			} catch (error) {
				return `Could not read ${PAYLOAD_DOC_ID}: ${error instanceof Error ? error.message : String(error)}`;
			}

			const requested = (context.trigger.input.category ?? "all").trim();
			const header = [`# ${entry.title}`, kitProvenance, "", `\`${PAYLOAD_DOC_ID}\` · ${entry.bytes} bytes`];

			if (requested === "" || requested.toLowerCase() === "all") {
				return [...header, "", text].join("\n");
			}

			const sections = extractPayloadSections(text, requested);
			if (sections.length === 0) {
				const headings = payloadHeadings(text);
				return [
					`No section matches "${requested}" in the payload seeds.`,
					"",
					"Sections that exist:",
					...headings.map(heading => `- ${heading}`),
					"",
					"Pick one of those, or call this tool with `all`.",
				].join("\n");
			}

			const blocks: string[] = [];
			for (const section of sections) {
				blocks.push(`## ${section.heading}`, "", section.body);
			}
			return [...header, "", ...blocks].join("\n");
		},
	});
}

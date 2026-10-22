import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { DOC_ENTRIES, type DocEntry } from "../features/workbench/services/docs";

const MAX_HITS = 60;
const MAX_SCAN = 400;

export interface DocHit {
	entry: DocEntry;
	score: number;
}

/**
 * 标题 / id / 主题打分：完全相等 > 前缀 > 子串，标题权重高于路径。
 * 不做模糊匹配——这里拿到的一般是关键词，排序稳定比召回率重要。
 */
export function rankDocs(query: string, limit = 20, group = ""): DocHit[] {
	const needle = query.trim().toLowerCase();
	if (needle === "") return [];
	const hits: DocHit[] = [];
	for (const entry of DOC_ENTRIES) {
		if (group !== "" && entry.group !== group) continue;
		const title = entry.title.toLowerCase();
		const id = entry.id.toLowerCase();
		let score = 0;
		if (title === needle) score = 100;
		else if (title.startsWith(needle)) score = 70;
		else if (title.includes(needle)) score = 50;
		else if (id.includes(needle)) score = 30;
		else if (entry.topic.toLowerCase().includes(needle)) score = 15;
		if (score > 0) hits.push({ entry, score });
	}
	hits.sort((a, b) => b.score - a.score || a.entry.id.localeCompare(b.entry.id));
	return hits.slice(0, Math.max(1, Math.min(MAX_SCAN, limit)));
}

export function registerSearchDocsTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<{ query: string; group?: string; limit?: number }>({
		id: "search_docs",
		name: "search_docs",
		label: "%tool.searchDocs.label%",
		description: [
			"The Hanshuang Pojia plugin ships the workbench kit's own field documents: 292 knowledge-base",
			"articles, 10 manuals and 7 tool docs, indexed by id, title, group and topic.",
			"",
			"Use it before improvising a technique: search by keyword (`kerberos`, `frida`, `apk signing`,",
			"`payment bypass`) and then read the match with `read_doc`. Titles, ids and topics are matched,",
			"not document bodies — if a keyword only lives inside a body, search for a term from that",
			"document's title first.",
			"",
			"Returns id / title / group / topic / size for every hit. Call `read_doc` with the id verbatim.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Keyword matched against document titles, ids and topics." },
				group: { type: "string", description: "Restrict to one collection: kb, manual or kit-docs." },
				limit: { type: "integer", description: `Maximum hits (default 20, max ${MAX_HITS}).` },
			},
			required: ["query"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 30_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const limit = Math.max(1, Math.min(MAX_HITS, Math.trunc(input.limit ?? 20)));
				const group = (input.group ?? "").trim();
				const hits = rankDocs(input.query, limit, group);
				if (hits.length === 0) {
					const scope = group === "" ? "kb, manual and kit-docs" : `the ${group} collection`;
					return `No document in ${scope} matches "${input.query.trim()}". Try a broader keyword, or a term that appears in a document title.`;
				}

				const lines = [
					`# ${hits.length} document(s) for "${input.query.trim()}"`,
					"",
					"| id | title | group | bytes |",
					"| --- | --- | --- | --- |",
				];
				for (const hit of hits) {
					lines.push(`| \`${hit.entry.id}\` | ${hit.entry.title.replace(/\|/g, "\\|")} | ${hit.entry.group} | ${hit.entry.bytes} |`);
				}
				lines.push("", "Read one with `read_doc` and pass its `id` verbatim.");
				return lines.join("\n");
			} catch (error) {
				return `Document search failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

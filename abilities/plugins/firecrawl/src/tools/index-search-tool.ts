/**
 * firecrawl_index_search — Firecrawl's curated indexes.
 *
 * Three indexes with three different shapes, so one tool takes an `index`
 * instead of three tools: `developer` (docs, issues, pull requests, readmes),
 * `gov` (government sites) and `research` (papers, with read and
 * similar-paper modes). These are not web search — firecrawl_search is.
 */

import { clip } from "../domain/firecrawl/documents";
import type { IndexHit, PaperHit, PaperSearchResult } from "../domain/firecrawl/types";
import type { ToolDeps } from "./deps";
import { readEnum, readNumber, readOptionalString, readString, readStringArray } from "./tool-arguments";
import { ToolArgumentError } from "./tool-arguments";

const INDEXES = ["developer", "gov", "research"] as const;
const TYPES = ["doc", "issue", "pull_request", "readme"] as const;
const MODES = ["similar", "citers", "references"] as const;

function hitBlock(hit: IndexHit, index: number): string {
	const heading = [hit.type ? `[${hit.type}]` : "", hit.title ?? hit.url ?? "(untitled)"].filter(Boolean).join(" ");
	const lines = [`${index + 1}. ${heading}`];
	if (hit.url) lines.push(`   ${hit.url}`);
	if (typeof hit.description === "string" && hit.description) lines.push(`   ${clip(hit.description, 400)}`);
	const passages = Array.isArray(hit.passages) ? hit.passages : [];
	for (const passage of passages.slice(0, 3)) {
		const text = typeof passage.text === "string" ? passage.text : typeof passage === "string" ? passage : "";
		if (text) lines.push(`   > ${clip(text.replace(/\s+/g, " ").trim(), 600)}`);
	}
	return lines.join("\n");
}

function paperBlock(paper: PaperHit, index: number): string {
	const lines = [`${index + 1}. ${paper.title ?? paper.primaryId ?? paper.paperId ?? "(untitled)"}`];
	const ids = [paper.primaryId, paper.paperId].filter((value): value is string => typeof value === "string" && value.length > 0);
	if (ids.length > 0) lines.push(`   ${ids.join("  ·  ")}`);
	if (paper.authors) lines.push(`   ${clip(String(paper.authors), 200)}`);
	if (Array.isArray(paper.categories) && paper.categories.length > 0) lines.push(`   ${paper.categories.join(", ")}`);
	if (paper.abstract) lines.push(`   ${clip(String(paper.abstract).replace(/\s+/g, " ").trim(), 700)}`);
	return lines.join("\n");
}

function paperText(result: PaperSearchResult): string {
	const sections: string[] = [];
	if (result.paper) sections.push(paperBlock(result.paper, 0).replace(/^1\. /, ""));
	if (Array.isArray(result.passages) && result.passages.length > 0) {
		const passages = result.passages
			.slice(0, 6)
			.map((entry, index) => {
				const text = typeof entry.text === "string" ? entry.text : typeof entry.content === "string" ? entry.content : JSON.stringify(entry);
				return `[${index + 1}] ${clip(text.replace(/\s+/g, " ").trim(), 1_500)}`;
			})
			.join("\n\n");
		sections.push("Passages:", passages);
	}
	if (result.results.length > 0) {
		sections.push("Related papers:", result.results.map((paper, index) => paperBlock(paper, index)).join("\n"));
	}
	return sections.filter(Boolean).join("\n\n");
}

export function createIndexSearchTool({ config, store }: ToolDeps) {
	return {
		id: "firecrawl_index_search",
		name: "firecrawl_index_search",
		label: "%tool.indexSearch.label%",
		description: [
			"Search Firecrawl's curated indexes instead of the open web. Three indexes, picked with `index`:",
			"- developer: documentation, GitHub issues, pull requests and readmes. Scope it with `types`, `repos`,",
			"  `sources`, or `skills: \"only\"` to search agent-skill files only.",
			"- gov: government and public-sector sites.",
			"- research: academic papers. Add `paperId` to read one paper (with `passages` when you also pass a",
			"  question in `query`) or to walk citations with `similarTo` + `intent` and `mode`.",
			"",
			"Use it when the answer must come from those corpora specifically — 'what does the upstream repo say",
			"about this in its issues', 'the exact wording of this paper's method'. For general web search use",
			"firecrawl_search; for one page you already have a URL for, firecrawl_scrape.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				index: { type: "string", enum: [...INDEXES], description: "Which index to query." },
				query: {
					type: "string",
					description: "Natural-language question or search phrase. Optional when `paperId` is given without passages.",
				},
				limit: { type: "number", description: "Results to return (developer/gov 1-100 default 10; papers 1-500 default 40 for similar)." },
				types: {
					type: "array",
					items: { type: "string", enum: [...TYPES] },
					description: "developer: result kinds to search. Defaults to all four.",
				},
				repos: { type: "array", items: { type: "string" }, description: "developer: repository slugs, e.g. [\"firecrawl/firecrawl\"]." },
				sources: { type: "array", items: { type: "string" }, description: "developer: documentation source ids (max 20)." },
				skillsOnly: { type: "boolean", description: "developer: restrict the search to indexed agent-skill files." },
				passages: { type: "number", description: "developer: matched passages per result (1-5)." },
				authors: { type: "string", description: "research: author substring filter." },
				categories: { type: "string", description: "research: paper category filter, e.g. cs.LG." },
				from: { type: "string", description: "research: inclusive lower bound on the paper date (YYYY-MM-DD)." },
				to: { type: "string", description: "research: inclusive upper bound on the paper date (YYYY-MM-DD)." },
				paperId: {
					type: "string",
					description: "research: read one paper, e.g. arxiv:2105.05233 or a canonical paperId.",
				},
				similarTo: {
					type: "string",
					description: "research: seed paper to expand from. Requires `intent`.",
				},
				intent: { type: "string", description: "research: what to look for in related papers (semantic ranking)." },
				mode: { type: "string", enum: [...MODES], description: "research: similar papers, papers citing the seed, or its references." },
			},
			required: ["index"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"] as const,
		context: { conversation: "summary" },
		timeoutMs: 120_000,
		handler: async (context: { trigger: { input?: unknown } }) => {
			const input = context.trigger.input;
			const index = readEnum(input, "index", INDEXES, "developer");
			const client = await config.require();
			const query = readOptionalString(input, "query");
			const limit = readNumber(input, "limit", { min: 1, max: 500, def: 10 });

			if (index === "developer") {
				if (!query) throw new ToolArgumentError('firecrawl_index_search needs a "query" for the developer index');
				const body: Record<string, unknown> = { query, k: limit };
				const types = readStringArray(input, "types", 4).filter((entry) => (TYPES as readonly string[]).includes(entry));
				if (types.length > 0) body.types = types;
				const repos = readStringArray(input, "repos", 10);
				if (repos.length > 0) body.repos = repos;
				const sources = readStringArray(input, "sources", 20);
				if (sources.length > 0) body.sources = sources;
				if (input && typeof input === "object" && (input as Record<string, unknown>).skillsOnly === true) body.skills = "only";
				const passages = readNumber(input, "passages", { min: 1, max: 5, def: 0 });
				if (passages > 0) body.passages = passages;

				const result = await client.searchDeveloper(body);
				store.note("ok", `index  developer  ${result.results.length} results`);
				if (result.results.length === 0) return "No developer-index results.";
				const lines = [`${result.results.length} developer-index results`];
				if (result.warning) lines.push(`Warning: ${result.warning}`);
				if (result.coverage) {
					const gaps = Object.entries(result.coverage).filter(([, state]) => state !== "ok" && state !== "skipped");
					if (gaps.length > 0) lines.push(`Coverage: ${gaps.map(([kind, state]) => `${kind}=${state}`).join(", ")}`);
				}
				lines.push("", result.results.map((hit, i) => hitBlock(hit, i)).join("\n\n"));
				return lines.join("\n");
			}

			if (index === "gov") {
				if (!query) throw new ToolArgumentError('firecrawl_index_search needs a "query" for the gov index');
				const result = await client.searchGov({ query, k: limit });
				store.note("ok", `index  gov  ${result.results.length} results`);
				if (result.results.length === 0) return "No government-index results.";
				return [`${result.results.length} government-index results`, "", result.results.map((hit, i) => hitBlock(hit, i)).join("\n\n")].join("\n");
			}

			const similarTo = readOptionalString(input, "similarTo");
			const paperId = readOptionalString(input, "paperId");

			if (similarTo) {
				const intent = readOptionalString(input, "intent") ?? query;
				if (!intent) throw new ToolArgumentError('"intent" (or "query") is required when using "similarTo"');
				const mode = readOptionalString(input, "mode");
				const result = await client.similarPapers(similarTo, {
					intent,
					...(mode && (MODES as readonly string[]).includes(mode) ? { mode } : {}),
					k: readNumber(input, "limit", { min: 1, max: 500, def: 40 }),
				});
				store.note("ok", `index  papers-similar  ${result.results.length} results`);
				if (result.results.length === 0) return "No related papers.";
				return [`Papers related to ${similarTo}`, "", result.results.map((paper, i) => paperBlock(paper, i)).join("\n")].join("\n");
			}

			if (paperId) {
				const result = await client.paper(paperId, {
					...(query ? { query } : {}),
					k: readNumber(input, "passages", { min: 1, max: 50, def: 0 }) || undefined,
				});
				store.note("ok", `index  paper  ${paperId}`);
				return paperText(result) || "No content for that paper id.";
			}

			if (!query) {
				throw new ToolArgumentError('firecrawl_index_search needs "query", "paperId" or "similarTo" for the research index');
			}
			const params: Record<string, string | number | undefined> = { query, k: readNumber(input, "limit", { min: 1, max: 500, def: 10 }) };
			for (const key of ["authors", "categories", "from", "to"] as const) {
				const value = readOptionalString(input, key);
				if (value) params[key] = value;
			}
			const result = await client.searchPapers(params);
			store.note("ok", `index  papers  ${result.results.length} results`);
			if (result.results.length === 0) return "No paper results.";
			return [`${result.results.length} paper results`, "", result.results.map((paper, i) => paperBlock(paper, i)).join("\n")].join("\n");
		},
	};
}

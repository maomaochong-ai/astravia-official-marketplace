import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { renderCaseIndex, rankCases, scanCases, type CaseReadPort } from "../../domain/case/library";
import {
	findPrecedent,
	rankPrecedents,
	renderPrecedentIndex,
	renderPrecedentPackage,
	shippedPrecedentSlugs,
} from "../../domain/case/precedents";
import { isOutsideProject, resolveSamplePath } from "../../domain/sample-path";

interface SearchCasesInput {
	query?: string;
	root?: string;
	limit?: number;
	/** 先例库：默认 true，与项目里的 cases/ 命中一起返回。 */
	library?: boolean;
	/** 只回一份先例的完整正文，按 slug 指定。 */
	precedent?: string;
}

const MAX_HITS = 20;

/** 先例比本地案例少得多，5 条足够看完一次查询的全部候选。 */
const PRECEDENT_LIMIT = 5;

export function registerSearchCasesTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<SearchCasesInput>({
		id: "search_cases",
		name: "search_cases",
		label: "%tool.cases.label%",
		description: [
			"Search the case folders in this project for precedent: <root>/cases/*/scope.md and <root>/work/*/scope.md.",
			"Each hit reports the preset, the recorded auth status, network profile, in-scope asset count, evidence",
			"count and decision-note counts, plus why it matched.",
			"",
			"Use it before starting a target that resembles something already analysed: a matching precedent carries a",
			"known technique chain, a known dead end and a citation you can quote. With no query it lists the whole index.",
			"",
			"The shipped precedent library is appended (method-level packages under cases/<slug>/); library=false",
			"restricts the search to this project. A shipped precedent is a starting point, not an authorisation:",
			"its scope.md says auth.status=pending so the operator declares their own scope.",
			"",
			"The result carries paths and reasons, not document bodies: open scope.md / evidence/ / docs/ with the",
			"file tools. Cases only live under cases/ and work/ — a project-wide walk for scope.md is not performed.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				query: { type: "string", description: "Keyword(s): a product, protocol, defect class or technique." },
				root: { type: "string", description: "Directory holding cases/ and work/; defaults to the working directory." },
				limit: { type: "integer", description: `Maximum hits to render (default 8, max ${MAX_HITS}).` },
				library: {
					type: "boolean",
					description: "Include the shipped precedent library (default true). Set false to search only this project.",
				},
				precedent: {
					type: "string",
					description: "Return one shipped precedent package in full, by slug (e.g. elf-packed-loader).",
				},
			},
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 30_000,
		handler: async context => {
			const input = context.trigger.input;
			// 整包正文按 slug 现取：只有显式要一份时才把 2 KB 正文放进上下文。
			const wanted = (input.precedent ?? "").trim();
			if (wanted) {
				const precedent = findPrecedent(wanted);
				return precedent
					? renderPrecedentPackage(precedent)
					: `No shipped precedent is named "${wanted}". Available: ${shippedPrecedentSlugs()}.`;
			}
			const cwd = context.session.cwd;
			const rawRoot = (input.root ?? "").trim();
			if (rawRoot && isOutsideProject(rawRoot, cwd)) return `root must stay inside the open project: ${rawRoot}`;
			if (!cwd && !rawRoot) return "No working directory is available; pass root explicitly.";
			let root: string;
			try {
				root = rawRoot ? resolveSamplePath(cwd, rawRoot) : (cwd as string);
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}
			const host = context.host.fs;
			const port: CaseReadPort = {
				readDir: directory => host.readDir(directory),
				readText: async path => {
					try {
						const file = await host.readFile(path);
						return file.encoding === "utf8" ? file.content : null;
					} catch {
						// Missing scope.md is the normal case for "this directory is not a case".
						return null;
					}
				},
			};

			try {
				const scan = await scanCases(port, root);
				const limit = Math.min(MAX_HITS, Math.max(1, Math.round(input.limit ?? 8)));
				const hits = rankCases(scan.cases, input.query, { limit });
				const body = renderCaseIndex(scan, hits, input.query);
				if (input.library === false) return body;
				// 先例与本地案例分开报告：先例是方法，不是「你打过这个目标」的证据。
				const precedents = rankPrecedents(input.query, PRECEDENT_LIMIT);
				return [body, "", renderPrecedentIndex(precedents, input.query)].join("\n");
			} catch (error) {
				return `search_cases failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

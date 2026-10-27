/**
 * `scaffold_case` — write a shipped precedent's tools into the project.
 *
 * The precedents carry runnable Python tools, but they ship as package assets:
 * nothing on disk means nothing to run. This tool is the bridge — it copies
 * `tools/` plus the shared `hpkit` into a case directory and hands back the exact
 * command lines.
 *
 * It deliberately stops there. No interpreter is spawned, no sample is read, and
 * the copied scope.md still declares auth.status=pending: a precedent carries a
 * method, never an authorisation.
 */
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { findPrecedent, shippedPrecedentSlugs } from "../../domain/case/precedents";
import { planScaffold, readCaseText, renderScaffoldPlan } from "../../domain/case/scaffold";
import { isOutsideProject, resolveSamplePath } from "../../domain/sample-path";

interface ScaffoldCaseInput {
	/** Shipped precedent slug, e.g. `client-auth-gate`. */
	precedent: string;
	/** Directory to scaffold into; defaults to `<cwd>/<slug>`. Stays inside the project. */
	into?: string;
	/** Overwrite files that already exist (default false: they are reported and left alone). */
	overwrite?: boolean;
}

export function registerScaffoldCaseTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<ScaffoldCaseInput>({
		id: "scaffold_case",
		name: "scaffold_case",
		label: "%tool.scaffoldCase.label%",
		description: [
			"Write a shipped precedent's runnable tools into a directory of this project: tools/<entry>.py plus",
			"tools/manifest.json and the shared hpkit modules they import. Returns the exact command lines.",
			"",
			"Read `search_cases` with a `precedent` slug first — it lists `- tools:` for the package. Then scaffold,",
			"then run each tool's `--self-test` before trusting its output on a real sample.",
			"",
			"It writes files only: nothing is executed, nothing is read from a sample, and the copied scope.md",
			"still says auth.status=pending. Declare real scope with init_task before acting on a target.",
			"",
			`Available precedents: ${shippedPrecedentSlugs()}.`,
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				precedent: { type: "string", description: "Shipped precedent slug, e.g. client-auth-gate." },
				into: {
					type: "string",
					description: "Target directory inside the project. Defaults to <cwd>/<slug>.",
				},
				overwrite: {
					type: "boolean",
					description: "Replace existing files. Default false: existing files are reported and kept.",
				},
			},
			required: ["precedent"],
			additionalProperties: false,
		},
		scope_use: ["project"],
		context: { conversation: "summary" },
		timeoutMs: 30_000,
		handler: async context => {
			const input = context.trigger.input;
			const slug = (input.precedent ?? "").trim();
			const precedent = findPrecedent(slug);
			if (!precedent) {
				return `No shipped precedent is named "${slug}". Available: ${shippedPrecedentSlugs()}.`;
			}
			const entries = precedent.tools?.tools ?? [];
			if (entries.length === 0) {
				return `Precedent "${slug}" ships no runnable tools — it is a reading package only.`;
			}

			const cwd = context.session.cwd;
			const rawInto = (input.into ?? "").trim();
			if (rawInto && isOutsideProject(rawInto, cwd)) {
				return `into must stay inside the open project: ${rawInto}`;
			}
			if (!cwd && !rawInto) return "No working directory is available; pass into explicitly.";

			let target: string;
			try {
				target = rawInto ? resolveSamplePath(cwd, rawInto) : `${cwd as string}/${slug}`;
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}

			const plan = planScaffold(precedent, { into: rawInto ? target : undefined, cwd });
			const fs = context.host.fs;
			const written: string[] = [];
			const skipped: string[] = [];

			for (const file of plan.files) {
				const destination = `${plan.directory}/${file.path}`;
				if (input.overwrite !== true) {
					const existing = await fs.stat(destination).catch(() => null);
					if (existing) {
						skipped.push(file.path);
						continue;
					}
				}
				let content: string;
				try {
					content = await readCaseText(file.source);
				} catch (error) {
					return `scaffold_case could not read ${file.source}: ${error instanceof Error ? error.message : String(error)}`;
				}
				await ensureDir(fs, destination.slice(0, destination.lastIndexOf("/")));
				await fs.writeFile(destination, content);
				written.push(file.path);
			}

			return renderScaffoldPlan(plan, written, skipped);
		},
	});
}

/** 逐级建目录：宿主的 `createDirectory` 不保证递归，缺一层就失败。 */
async function ensureDir(fs: { createDirectory(path: string): Promise<void> }, dir: string): Promise<void> {
	const parts = dir.split("/").filter(Boolean);
	let current = dir.startsWith("/") ? "" : ".";
	for (const part of parts) {
		current = `${current}/${part}`;
		try {
			await fs.createDirectory(current);
		} catch {
			// 已存在就是我们要的状态；其余错误留给随后的写入暴露。
		}
	}
}

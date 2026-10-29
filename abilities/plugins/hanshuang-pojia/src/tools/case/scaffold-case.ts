/**
 * `scaffold_case` — 把「方法」落到项目目录里，两种形态：
 *
 * 1. **先例工具**（`precedent=<slug>`）：复制 `cases/<slug>/tools/` 与共享 `hpkit`，
 *    得到一组立刻能跑 `--self-test` 的 Python 工具。
 * 2. **战例工程骨架**（`project=A…N`）：按上游 14 条战例的工程契约生成
 *    README（中英双语）/ docs / src 说明 / tools 说明 / 构建脚本，三系统各自成型。
 *
 * 两种模式都只写文件：不启动解释器、不读样本、不执行生成的脚本。复制过去的
 * `scope.md` 仍然是 `auth.status=pending` —— 先例携带方法，不携带授权。
 */
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { caseProjectSlugs, findCaseProject } from "../../domain/case-projects/catalog";
import { planCaseProject, renderCaseProjectPlan } from "../../domain/case-projects/skeleton";
import { findPrecedent, shippedPrecedentSlugs } from "../../domain/case/precedents";
import { planScaffold, readCaseText, renderScaffoldPlan } from "../../domain/case/scaffold";
import { detectPlatform } from "../../domain/toolchain/catalog";
import { isOutsideProject, resolveSamplePath } from "../../domain/sample-path";
import { writeFiles } from "../lib/write-files";

interface ScaffoldCaseInput {
	/** Shipped precedent slug, e.g. `client-auth-gate`. */
	precedent?: string;
	/** Case project archetype letter, A–N. */
	project?: string;
	/** Directory to scaffold into; defaults to `<cwd>/<slug>`. Stays inside the project. */
	into?: string;
	/** Which OS the generated build script targets; defaults to the one running the panel. */
	os?: "win32" | "darwin" | "linux";
	/** Overwrite files that already exist (default false: they are reported and left alone). */
	overwrite?: boolean;
}

export function registerScaffoldCaseTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<ScaffoldCaseInput>({
		id: "scaffold_case",
		name: "scaffold_case",
		label: "%tool.scaffoldCase.label%",
		description: [
			"Write a case into a directory of this project. Two modes:",
			"",
			"  precedent=<slug> — copy that precedent's tools/<entry>.py, tools/manifest.json and the shared",
			"  hpkit modules. Returns the exact command lines; run each tool's --self-test before a sample.",
			"",
			"  project=A..N — generate the engineering skeleton of one upstream case archetype: bilingual",
			"  README with evidence gates, docs/reverse-engineering.md, docs/algorithm.md, extra method docs,",
			"  src/README.md (why src starts empty), tools/README.md, and a build script for the chosen OS",
			"  (build.ps1 on win32, build.sh on darwin/linux). src/ is intentionally empty: a copied",
			"  implementation is a dead file on any machine that is not the original one.",
			"",
			"Both modes write files only. Nothing is executed, no sample is read, and the copied scope.md",
			`still says auth.status=pending. Precedents: ${shippedPrecedentSlugs()}.`,
			`Archetypes: ${caseProjectSlugs()}.`,
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				precedent: { type: "string", description: "Shipped precedent slug, e.g. client-auth-gate." },
				project: { type: "string", description: "Case project archetype letter, A–N." },
				into: {
					type: "string",
					description: "Target directory inside the project. Defaults to <cwd>/<slug>.",
				},
				os: {
					type: "string",
					enum: ["win32", "darwin", "linux"],
					description: "OS the generated build script targets. Defaults to the running platform.",
				},
				overwrite: {
					type: "boolean",
					description: "Replace existing files. Default false: existing files are reported and kept.",
				},
			},
			required: [],
			additionalProperties: false,
		},
		scope_use: ["project"],
		context: { conversation: "summary" },
		timeoutMs: 30_000,
		handler: async context => {
			const input = context.trigger.input;
			const cwd = context.session.cwd;
			const rawInto = (input.into ?? "").trim();
			if (rawInto && isOutsideProject(rawInto, cwd)) {
				return `into must stay inside the open project: ${rawInto}`;
			}
			if (!cwd && !rawInto) return "No working directory is available; pass into explicitly.";

			const projectId = (input.project ?? "").trim();

			if (projectId) {
				const project = findCaseProject(projectId);
				if (!project) return `No case project is named "${projectId}". Available: ${caseProjectSlugs()}.`;

				const os = input.os ?? toOsKey(detectPlatform(typeof navigator === "undefined" ? undefined : navigator.userAgent));
				let target: string;
				try {
					target = rawInto ? resolveSamplePath(cwd, rawInto) : `${cwd as string}/${project.slug}`;
				} catch (error) {
					return error instanceof Error ? error.message : String(error);
				}

				const plan = planCaseProject(project, { os, into: rawInto ? target : undefined, cwd });
				const result = await writeFiles(context.host.fs, plan.directory, plan.files, input.overwrite === true);
				return renderCaseProjectPlan(plan, result.written, result.skipped);
			}

			const slug = (input.precedent ?? "").trim();
			const precedent = findPrecedent(slug);
			if (!precedent) {
				return `No shipped precedent is named "${slug}". Pass precedent=<slug> or project=A..N. Available precedents: ${shippedPrecedentSlugs()}.`;
			}
			const entries = precedent.tools?.tools ?? [];
			if (entries.length === 0) {
				return `Precedent "${slug}" ships no runnable tools — it is a reading package only.`;
			}

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
				const result = await writeFiles(fs, plan.directory, [{ path: file.path, content }], true);
				written.push(...result.written);
			}

			return renderScaffoldPlan(plan, written, skipped);
		},
	});
}

/** 工具链目录用的是 `windows`，骨架用 `win32`；这里只做一次映射，别让它散到各处。 */
function toOsKey(platform: "darwin" | "linux" | "windows"): "win32" | "darwin" | "linux" {
	return platform === "windows" ? "win32" : platform;
}

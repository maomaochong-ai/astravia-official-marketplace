import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { isOutsideProject, resolveSamplePath } from "../domain/sample-path";
import { initTaskWorkspace, renderWorkspace } from "../domain/toolchain/workspace";

interface InitTaskInput {
	name: string;
	description?: string;
	report?: boolean;
	root?: string;
}

export function registerInitTaskTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<InitTaskInput>({
		id: "init_task",
		name: "init_task",
		label: "%tool.workspace.label%",
		description: [
			"Create a case directory for one target so samples, evidence and the write-up stay together:",
			"  <root>/<name>/samples/   copies of the files under examination",
			"  <root>/<name>/exports/   decompiled sources, disassembly, string dumps",
			"  <root>/<name>/reports/   findings and the final report",
			"plus a README.md that records the scope, and with report=true a reports/security-report.md skeleton.",
			"",
			"Use it at the start of any engagement that will produce more than one artefact. The name is sanitised:",
			"anything outside letters, digits, dash and underscore becomes an underscore, so the directory can never",
			"escape the root. Existing files are never overwritten — a second call keeps the README and the report",
			"you already wrote and only fills in missing directories.",
			"",
			"root defaults to the conversation working directory; pass a subdirectory when the project already keeps",
			"its own case folders. The layout is evidence-first (samples/, exports/, reports/); a patched or rebuilt",
			"artefact belongs under exports/ with the command that produced it, so the run can be repeated.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				name: { type: "string", description: "Case name, e.g. 'sample-2024-11' or 'com.example.app'." },
				description: { type: "string", description: "Scope line written into README.md and the report skeleton." },
				report: { type: "boolean", description: "Also create reports/security-report.md (default false)." },
				root: { type: "string", description: "Parent directory; defaults to the conversation working directory." },
			},
			required: ["name"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 30_000,
		handler: async context => {
			const input = context.trigger.input;
			const cwd = context.session.cwd;
			const rawRoot = (input.root ?? "").trim();
			if (rawRoot && isOutsideProject(rawRoot, cwd)) return `root must stay inside the open project: ${rawRoot}`;
			if (!cwd && !rawRoot) return "No working directory is available; pass root explicitly.";
			let root: string;
			try {
				root = rawRoot ? resolveSamplePath(cwd, rawRoot) : cwd;
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}

			try {
				const result = await initTaskWorkspace(context.host.fs, {
					root,
					name: input.name ?? "",
					description: input.description,
					report: input.report === true,
				});
				return renderWorkspace(result);
			} catch (error) {
				return `init_task failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

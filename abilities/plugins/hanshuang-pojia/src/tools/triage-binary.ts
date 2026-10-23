import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { renderMarkdown } from "../domain/report/report";
import { triage } from "../domain/triage";
import { publishPanelEvent } from "../runtime/panel-channel";
import { loadSample } from "./read-sample";

interface TriageBinaryInput {
	path?: string;
	mode?: "summary" | "full";
}

export function registerTriageBinaryTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<TriageBinaryInput>({
		id: "triage_binary",
		name: "triage_binary",
		label: "%tool.triage.label%",
		description: [
			"Statically triage one binary or package and return a bounded markdown report: format detection",
			"(APK / AAB / IPA / ELF / PE / Mach-O / DEX / ZIP), SHA-256, entropy, AndroidManifest facts,",
			"exported components, requested permissions, DEX string-level API evidence, section flags,",
			"imports, archive layout, a 0-100 risk score and rule-based next steps.",
			"",
			"Use it when the user asks what a package does, whether an APK is safe, what permissions or",
			"components it exposes, why an executable is flagged, or when a `.apk`, `.so`, `.exe`, `.dylib`",
			"or unknown blob needs a first read.",
			"",
			"It is a static first pass: the sample is not run, and Android signature digests are read structurally.",
			"Hand verification to `apksigner verify`; when the next step is unpacking, patching, re-signing or",
			"repacking, chain into `decompile_android`, `run_radare` or the skill scripts rather than asking this tool.",
			"Summary mode is the default; ask for full mode only when the summary is not enough.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "File path, absolute or relative to the session working directory." },
				mode: {
					type: "string",
					enum: ["summary", "full"],
					description: "summary (default) keeps the report under ~4500 characters; full expands tables and findings.",
				},
			},
			required: ["path"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 120_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const sample = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				const report = await triage(sample, { mode: input.mode === "full" ? "full" : "summary" });
				// 面板与工具同处插件渲染进程：把报告推回面板，用户不必把结论再抄一遍。
				publishPanelEvent({ type: "report", report, source: "agent" });
				return renderMarkdown(report, { mode: report.mode });
			} catch (error) {
				return `Triage failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

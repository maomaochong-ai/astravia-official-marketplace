/**
 * `export_triage_report`：把一份完整体检报告交给宿主的保存对话框。
 *
 * 写盘的唯一路径是 `host.fs.saveAs`——用户选目标、用户点确认，插件自己不开文件。
 * 因此取消也是一种正常结果（返回取消提示，不写空文件、不报错）。
 * 报告一律 full 模式生成：屏幕上看到的是摘要，交出去的那份不能也是摘要。
 */
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { renderMarkdown, reportToJson } from "../../domain/report/report";
import { triage } from "../../domain/triage";
import { loadSample } from "../lib/read-sample";

interface ExportReportInput {
	path?: string;
	format?: "markdown" | "json";
	mode?: "summary" | "full";
}

export function registerExportReportTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<ExportReportInput>({
		id: "export_triage_report",
		name: "export_triage_report",
		label: "%tool.export.label%",
		description: [
			"Run a full triage on one sample and hand the finished report to the user's save dialog as",
			"markdown or JSON. The user chooses the destination, so nothing is written without confirmation.",
			"",
			"Use it when the user wants a shareable report, an attachment for a review, or the machine",
			"readable JSON form of a triage they already saw in the panel.",
			"",
			"Always runs in full mode regardless of what the conversation showed. It returns the saved",
			"path, or a cancellation notice — it never re-prints the whole report inline.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Sample path, absolute or relative to the session working directory." },
				format: { type: "string", enum: ["markdown", "json"], description: "Output format (default markdown)." },
				mode: {
					type: "string",
					enum: ["summary", "full"],
					description: "Report depth for markdown output (default full). JSON always carries every finding.",
				},
			},
			required: ["path"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 180_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const sample = await loadSample(context.host.fs, context.session.cwd, input.path ?? "");
				const report = await triage(sample, { mode: input.mode === "summary" ? "summary" : "full" });
				const format = input.format === "json" ? "json" : "markdown";
				const stem = sample.name.replace(/\.[^.]+$/, "") || "sample";
				const fileName = `${stem}-triage.${format === "json" ? "json" : "md"}`;
				const content = format === "json" ? reportToJson(report) : renderMarkdown(report, { mode: report.mode });
				const saved = await context.host.fs.saveAs(fileName, content, "utf8", {
					title: `Save triage report for ${sample.name}`,
					filters:
						format === "json"
							? [{ name: "JSON", extensions: ["json"] }]
							: [{ name: "Markdown", extensions: ["md"] }],
				});
				if (!saved) return `Export cancelled — no file was written for ${sample.name}.`;
				return `Saved the ${format} triage report for ${sample.name} to ${saved} (risk ${report.risk.score}/100, grade ${report.risk.grade}, ${report.findings.length} finding(s)).`;
			} catch (error) {
				return `Export failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

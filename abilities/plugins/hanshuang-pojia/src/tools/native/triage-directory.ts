/**
 * `triage_directory`：把一个目录里的候选样本跑一遍判级，输出「先开哪个」的排序表。
 *
 * 三条不能丢的性质：
 *   1. 候选来自扩展名白名单，纯文本不会被当二进制解析；
 *   2. 单个文件读不了只产出一行 failed，不中断整批；
 *   3. 两层上限（宿主 10000 条目 / 本工具的 `limit`）都必须**报出来**，不能静默截断——
 *      悄悄少扫一批文件，结论就成了「这批是干净的」。
 *
 * 逐文件规则与 `triage_binary` 同一套，只是走 summary 模式：批量的用途是排优先级，不是给每份写报告。
 */
import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { renderBatch, triageDirectory, type BatchOptions } from "../../domain/batch";
import { resolveSamplePath } from "../../domain/sample-path";

interface TriageDirectoryInput {
	path?: string;
	recursive?: boolean;
	limit?: number;
}

const MAX_LIMIT = 200;

export function registerTriageDirectoryTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<TriageDirectoryInput>({
		id: "triage_directory",
		name: "triage_directory",
		label: "%tool.batch.label%",
		description: [
			"Triage every binary and package under one directory in a single pass and return a ranked table:",
			"grade, risk score, format, size, finding counts per severity and the relative path, worst first.",
			"Per-file analysis is the same rule set as triage_binary, run in summary mode because the point of a",
			"batch is which sample to open first, not the full report for each.",
			"",
			"Use it when the user points at a dump, a sample folder, an APK collection or a build output and asks",
			"what is in there or which one is suspicious. Candidates come from an extension whitelist (apk, aab,",
			"ipa, jar, zip, dex, so, dylib, exe, dll, sys, scr, elf, bin, img) so text files are not parsed as",
			"binaries.",
			"",
			"Files above the 32 MiB host read limit are listed with a note instead of being loaded, and a single",
			"unreadable file only produces one failed row. Nothing is written to disk: pass one row to",
			"triage_binary or export_triage_report for the full report. Directory walks are capped by the host at",
			"10,000 entries and by `limit` here; both caps are reported, never silently applied.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				path: { type: "string", description: "Directory to scan, absolute or relative to the session working directory." },
				recursive: { type: "boolean", description: "Walk subdirectories (default true)." },
				limit: { type: "integer", description: `Maximum files to actually triage (default 60, max ${MAX_LIMIT}).` },
			},
			required: ["path"],
			additionalProperties: false,
		},
		scope_use: ["conversation", "project"],
		context: { conversation: "summary" },
		timeoutMs: 300_000,
		handler: async context => {
			try {
				const input = context.trigger.input;
				const root = resolveSamplePath(context.session.cwd, input.path ?? ".");
				const options: BatchOptions = {
					root,
					recursive: input.recursive !== false,
					limit: Math.max(1, Math.min(MAX_LIMIT, input.limit ?? 60)),
				};
				const result = await triageDirectory(context.host.fs, options);
				return renderBatch(result);
			} catch (error) {
				return `Batch triage failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

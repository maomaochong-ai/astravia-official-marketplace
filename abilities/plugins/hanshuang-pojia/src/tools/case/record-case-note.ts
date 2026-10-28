/**
 * record_case_note：把一次决策写进案卷的 `.agents/notes/<status>/<category>/` 并追加时间线。
 *
 * 已存在的同名笔记不覆盖（除非显式要求）。被否决的路子与做成的同样重要——
 * 它们挡住下一次重试。
 */

import type { Disposable, PluginContext } from "@astravia-org/plugin-sdk";
import { categorySegment, parseDecisionStatus, writeDecisionNote, type CaseWritePort } from "../../domain/case/journal";
import { baseName, isOutsideProject, resolveSamplePath } from "../../domain/sample-path";
import { joinPath } from "../../domain/toolchain/paths";

interface RecordCaseNoteInput {
	case: string;
	status: "implemented" | "rejected";
	category: string;
	title: string;
	body: string;
	root?: string;
	overwrite?: boolean;
}

export function registerRecordCaseNoteTool(ctx: PluginContext): Disposable {
	return ctx.agent.registerTool<RecordCaseNoteInput>({
		id: "record_case_note",
		name: "record_case_note",
		label: "%tool.caseNote.label%",
		description: [
			"Record one decision inside a case as a note, at <case>/.agents/notes/<status>/<category>/<date>-<slug>.md.",
			"status is implemented or rejected; category groups the kind of decision (architecture, feature, testing,",
			"process…); the file name is the date plus a slug of the title.",
			"",
			"Write the body as observations and reasoning, not as a verdict: what was tried, what the evidence said,",
			"and why it was kept or dropped. A rejected path is the most valuable note — it stops the next attempt.",
			"Every call also appends one line to the case timeline, so the decision shows up in the event log.",
			"",
			"An existing note is never overwritten unless overwrite=true. The case must already exist: create it with",
			"init_task first, which is what gives the note a scope to belong to.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				case: { type: "string", description: "Case name or path relative to root, e.g. 'demo' or 'cases/demo'." },
				status: { type: "string", enum: ["implemented", "rejected"], description: "Whether the decision shipped." },
				category: { type: "string", description: "One path segment, e.g. architecture / feature / testing / process." },
				title: { type: "string", description: "Decision title; becomes the file slug and the H1." },
				body: { type: "string", description: "Markdown body: context, evidence, and why it stands or was dropped." },
				root: { type: "string", description: "Directory holding the case; defaults to the working directory." },
				overwrite: { type: "boolean", description: "Replace an existing note file (default false)." },
			},
			required: ["case", "status", "category", "title", "body"],
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
			if (!(input.case ?? "").trim()) return "case is required";

			let root: string;
			let casePath: string;
			try {
				root = rawRoot ? resolveSamplePath(cwd, rawRoot) : (cwd as string);
				casePath = resolveSamplePath(root, input.case);
			} catch (error) {
				return error instanceof Error ? error.message : String(error);
			}
			if (isOutsideProject(casePath, cwd)) return `case must stay inside the open project: ${casePath}`;

			const host = context.host.fs;
			const port: CaseWritePort = {
				readText: async path => {
					try {
						const file = await host.readFile(path);
						return file.encoding === "utf8" ? file.content : null;
					} catch {
						return null;
					}
				},
				writeText: (path, content) => host.writeFile(path, content),
				createDirectory: path => host.createDirectory(path),
				exists: async path => {
					try {
						return (await host.stat(path)) !== null;
					} catch {
						return false;
					}
				},
			};

			try {
				if (!(await port.exists(casePath))) return `case directory does not exist: ${casePath}. Create it with init_task first.`;
				const status = parseDecisionStatus(input.status);
				const category = categorySegment(input.category);
				const date = new Date().toISOString().slice(0, 10);
				const result = await writeDecisionNote(
					port,
					casePath,
					{
						// 目录名才是案例的身份；入参可能是 `cases/demo` 这种路径。
						caseName: baseName(casePath) || input.case.trim(),
						status,
						category,
						title: input.title.trim(),
						body: input.body,
						date,
					},
					{ overwrite: input.overwrite === true },
				);
				const declared = await port.exists(joinPath(casePath, "scope.md"));
				return [
					`${result.overwritten ? "Replaced" : "Wrote"} ${result.path}`,
					`- status: ${status} · category: ${category} · date: ${date}`,
					result.timelinePath ? `- timeline: appended to ${result.timelinePath}` : "- timeline: not updated (timeline.md is unreadable)",
					declared
						? "- the case has a scope.md, so this note is citable as precedent"
						: "- no scope.md in this case: run init_task to record the declaration, or this note stays unpinned",
				].join("\n");
			} catch (error) {
				return `record_case_note failed: ${error instanceof Error ? error.message : String(error)}`;
			}
		},
	});
}

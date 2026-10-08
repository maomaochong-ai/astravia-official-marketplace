/**
 * agent 工具 `code_review`：对当前工作区（或分支区间）跑 ocr 审查。
 *
 * 执行链（全部走 SDK 真实 API）：
 *   ctx.command.run("ocr", [...]) — 子进程执行（agent.command.run 权限）
 *   ctx.fs.read(tmp)              — 读 JSON 输出（fs.read 权限）
 *   store.appendRun               — 结果入面板 + storage 持久化
 * 返回结构化摘要给模型（模型可直接讨论/修复，也可再跑复查）。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { ReviewFinding, ReviewRun, ReviewStore } from "./store";

export interface CodeReviewInput {
	from?: string;
}

interface OcrRawFinding {
	file?: unknown;
	line?: unknown;
	severity?: unknown;
	message?: unknown;
	rule?: unknown;
}

const SEVERITIES = new Set(["critical", "major", "minor", "info"]);

export function normalizeFindings(raw: unknown): ReviewFinding[] {
	if (!Array.isArray(raw)) return [];
	const out: ReviewFinding[] = [];
	for (const item of raw) {
		if (typeof item !== "object" || item === null) continue;
		const f = item as OcrRawFinding;
		if (typeof f.file !== "string" || typeof f.message !== "string") continue;
		out.push({
			file: f.file,
			line: typeof f.line === "number" ? f.line : 0,
			severity:
				typeof f.severity === "string" && SEVERITIES.has(f.severity) ? f.severity : "info",
			message: f.message,
			...(typeof f.rule === "string" ? { rule: f.rule } : {}),
		});
	}
	return out;
}

/** 组装 review 子进程的参数（独立出来便于测试）。 */
export function buildOcrArgs(input: CodeReviewInput, outputPath: string): string[] {
	const args = ["review", "--format", "json", "--output", outputPath];
	if (input.from) args.push("--from", input.from, "--to", "HEAD");
	return args;
}

export function registerReviewTool(ctx: PluginContext, store: ReviewStore): void {
	ctx.agent.registerTool({
		id: "as-ocr.code-review",
		name: "code_review",
		label: "Code Review",
		description: [
			"Run ocr (alibaba/open-code-review) on the current workspace changes and return structured findings.",
			"",
			"When to use: the user asks to review changes / 审查改动 / check the diff before committing, or you finished a change and want a defect pass (NPE, thread-safety, XSS, SQL injection rules built in).",
			"Do NOT use for: general questions about code (just read it), or when the user only wants a git diff summary (use the git panel).",
			"",
			'Input: {"from": "<base-branch>"} optional — defaults to all workspace changes (staged + unstaged + untracked).',
			"Returns: severity-grouped findings with file:line. Findings also land in the 审查 activity panel for the user.",
			"",
			"If the tool reports ocr is not installed: tell the user to run `brew install open-code-review` (macOS) or `go install github.com/alibaba/open-code-review/cmd/ocr@latest`, then retry.",
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				from: {
					type: "string",
					description: "Base branch for a range review (optional; default: workspace changes)",
				},
			},
		},
		scope_use: ["conversation", "project"],
		timeoutMs: 600_000,
		async handler({ input, sessionId }) {
			const startedAt = Date.now();
			const parsed = (input ?? {}) as CodeReviewInput;
			const scope = parsed.from ? `${parsed.from}…HEAD` : "workspace";
			const tmp = `/tmp/as-ocr-${sessionId ?? "run"}-${startedAt}.json`;

			const outcome = await ctx.command.run("ocr", buildOcrArgs(parsed, tmp));

			if (outcome.exitCode === null || /not found|ENOENT/i.test(outcome.stderr)) {
				return {
					content: [
						{
							type: "text",
							text: "ocr is not installed. Install it first (user action):\n  macOS: brew install open-code-review\n  or:   go install github.com/alibaba/open-code-review/cmd/ocr@latest\nThen retry this tool.",
						},
					],
				};
			}

			let findings: ReviewFinding[] = [];
			if (outcome.exitCode === 0) {
				try {
					const raw = await ctx.fs.read(tmp);
					const parsedJson: unknown = JSON.parse(raw);
					findings = normalizeFindings(
						Array.isArray(parsedJson)
							? parsedJson
							: ((parsedJson as { findings?: unknown[] }).findings ?? []),
					);
				} catch {
					/* JSON 解析失败按空结果处理 */
				}
			}

			const ok = outcome.exitCode === 0;
			store.appendRun({
				id: `run-${startedAt}`,
				startedAt,
				durationMs: Date.now() - startedAt,
				scope,
				findings,
				rawSummary: "",
				ok,
				...(ok ? {} : { error: outcome.stderr.slice(0, 300) || `exit ${outcome.exitCode}` }),
			});

			return {
				content: [
					{
						type: "text",
						text: ok ? store.summaryForAgent() : `ocr failed: ${outcome.stderr.slice(0, 200)}`,
					},
				],
			};
		},
	});
}

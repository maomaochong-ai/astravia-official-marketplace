/**
 * agent 工具 `code_review`：对当前工作区（或分支区间）跑 ocr 审查。
 *
 * 执行链（全部走 SDK 真实 API）：
 *   ctx.cliProviders.run("ocr", [...]) — 宿主托管的 ocr（providers.cli：探测失败即自动安装）
 *   ctx.fs.readFile(tmp)                — 读 JSON 输出（fs.read 权限）
 *   store.appendRun                     — 结果入面板 + storage 持久化
 * 返回结构化摘要给模型（模型可直接讨论/修复，也可再跑复查）。
 */

import type {
	PluginCliProviderStatus,
	PluginCommandRunResult,
	PluginContext,
} from "@astravia-org/plugin-sdk";
import { isProviderBusy, OCR_MANUAL_INSTALL, OCR_PROVIDER_ID, outputTail, phaseLabel } from "./provider.ts";
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

function normalizeSeverity(value: unknown): ReviewFinding["severity"] {
	return typeof value === "string" && SEVERITIES.has(value)
		? (value as ReviewFinding["severity"])
		: "info";
}

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
			severity: normalizeSeverity(f.severity),
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

/**
 * ocr 不可用时给模型的说明。宿主把 ocr 当托管依赖：正在装就等，装失败就替用户重试一次，
 * 并让模型去「审查」面板看进度——而不是叫用户自己敲 brew。
 */
async function providerBlockedMessage(ctx: PluginContext, error: unknown): Promise<string> {
	const reason = error instanceof Error ? error.message : String(error);
	let status: PluginCliProviderStatus | undefined;
	try {
		status = await ctx.cliProviders.getStatus(OCR_PROVIDER_ID);
	} catch {
		/* 状态读不到也不影响给模型一个可执行的结论 */
	}
	const phase = status?.phase ?? "checking";
	const head = `ocr CLI 暂不可用（${phaseLabel(phase)}）：${reason}`;
	if (phase === "failed") {
		const tail = outputTail(status?.recentOutput ?? "", 4);
		try {
			await ctx.cliProviders.retry(OCR_PROVIDER_ID);
			return `${head}\n已替你重装一次，请 1~2 分钟后重试；进度见「审查」面板。${tail ? `\n最近安装输出：\n${tail}` : ""}`;
		} catch {
			return `${head}\n自动重装失败。可在「审查」面板重试，或手动安装：${OCR_MANUAL_INSTALL}`;
		}
	}
	if (isProviderBusy(phase)) {
		return `${head}\n宿主正在自动安装 ocr（约 53 MB，首次约 10~60 秒），请稍后重试；进度见「审查」面板。`;
	}
	if (phase === "disabled") {
		return `${head}\n请先在能力页启用 as-ocr；启用时宿主会自动安装 ocr。`;
	}
	return `${head}\n可手动安装后重试：${OCR_MANUAL_INSTALL}`;
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
			"If the tool reports ocr as unavailable: it is either still installing (the host installs it automatically once the plugin is enabled) or the install failed. Tell the user to watch the 审查 (Reviews) panel and retry in a minute; that panel has a retry action.",
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
		async handler({ trigger, session }) {
			const startedAt = Date.now();
			const parsed = (trigger.input ?? {}) as CodeReviewInput;
			const sessionId = session.id ?? "run";
			const scope = parsed.from ? `${parsed.from}…HEAD` : "workspace";
			const tmp = `/tmp/as-ocr-${sessionId ?? "run"}-${startedAt}.json`;

			let outcome: PluginCommandRunResult;
			try {
				outcome = await ctx.cliProviders.run(OCR_PROVIDER_ID, buildOcrArgs(parsed, tmp), {
					timeoutMs: 600_000,
				});
			} catch (error) {
				return { content: [{ type: "text", text: await providerBlockedMessage(ctx, error) }] };
			}

			if (outcome.exitCode === null || /not found|ENOENT/i.test(outcome.stderr)) {
				return {
					content: [
						{
							type: "text",
							text: `ocr 调用未成功：${outcome.stderr.slice(0, 200) || "可执行文件未响应"}。插件启用后宿主会自动安装 ocr，进度见「审查」面板；也可手动安装：${OCR_MANUAL_INSTALL}`,
						},
					],
				};
			}

			let findings: ReviewFinding[] = [];
			if (outcome.exitCode === 0) {
				try {
					const fileResult = await ctx.fs.readFile(tmp);
					const raw = fileResult.content;
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

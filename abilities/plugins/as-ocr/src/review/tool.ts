/**
 * agent 工具 `code_review` / `code_review_report`：审查当前工作区（或分支区间）的改动。
 *
 * 两条执行链：
 *   委托模式（默认）—— ocr 只做确定性工程：`ocr delegate preview` 选文件、`ocr delegate rule` 给规则，
 *     diff 由 git 取，判断交给会话里的模型（复用宿主模型额度，无需 API Key）；
 *     模型审完后用 `code_review_report` 把发现写回面板与 storage。
 *   ocr 托管模式（`engine: "ocr"`）—— `ocr review --format json` 自己调 LLM，需要用户先
 *     `ocr config provider`。没有配置时上游会报 `no valid LLM endpoint configured`。
 *
 * 契约（alibaba/open-code-review v1.13）：
 *   ocr delegate preview [--from a --to b | --commit c] --repo <root>
 *   ocr delegate rule <path...> --repo <root>
 *   git --no-pager diff/show ...
 */

import type {
	PluginCliProviderStatus,
	PluginCommandRunResult,
	PluginContext,
} from "@astravia-org/plugin-sdk";
import {
	buildPreviewArgs,
	buildRuleArgs,
	composeBrief,
	describeScope,
	gitDiffArgs,
	parsePreview,
	selectDiffBudget,
} from "./delegate.ts";
import { isProviderBusy, OCR_MANUAL_INSTALL, OCR_PROVIDER_ID, outputTail, phaseLabel } from "./provider.ts";
import type { ReviewFinding, ReviewRun, ReviewStore } from "./store";

export interface CodeReviewInput {
	from?: string;
	to?: string;
	commit?: string;
	/** delegate（默认，无需 API Key）| ocr（ocr 自己调 LLM，需先配置端点）。 */
	engine?: "delegate" | "ocr";
}

export interface CodeReviewReportInput {
	findings?: unknown;
	scope?: string;
	summary?: string;
}

interface OcrRawFinding {
	file?: unknown;
	line?: unknown;
	severity?: unknown;
	message?: unknown;
	rule?: unknown;
}

const SEVERITIES = new Set(["critical", "major", "minor", "info"]);

/** 单次简报最多取多少个文件的 diff（其余交给模型自行读取）。 */
const MAX_DIFF_FILES = 40;
/** 单个 diff 命令的超时。 */
const GIT_TIMEOUT_MS = 60_000;

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

/** 组装 ocr 托管模式的参数（独立出来便于测试）。 */
export function buildOcrArgs(input: CodeReviewInput, outputPath: string): string[] {
	const args = ["review", "--format", "json", "--output", outputPath];
	if (input.commit) args.push("--commit", input.commit);
	else if (input.from) args.push("--from", input.from, "--to", input.to ?? "HEAD");
	return args;
}

/**
 * 会话 cwd → 子进程 cwd。
 *
 * 宿主在省略 `cwd` 时用主进程自己的工作目录；Finder 启动的应用里那是 `/`，
 * ocr 的 `review` 又必须在 git 仓库里跑，于是必然报 `/ is not a git repository`。
 * 所以没拿到可用工作区时宁可不跑，也不要把进程丢到根目录。
 */
export function resolveRunCwd(cwd: string | undefined): string | null {
	const normalized = (cwd ?? "").trim().replace(/[\\/]+$/, "");
	if (!normalized) return null; // "" 或文件系统根 "/"
	if (/^[A-Za-z]:$/.test(normalized)) return null; // Windows 盘符根 "C:"
	const absolute = normalized.startsWith("/") || /^[A-Za-z]:[\\/]/.test(normalized);
	return absolute ? normalized : null;
}

/**
 * ocr 的 stderr 直接甩给用户没有行动指引：换成一句能照做的提示。
 * 其余保持原文（截断）供排查。
 */
export function describeRunFailure(stderr: string, cwd: string): string {
	const text = stderr.trim();
	if (/is not a git repository/i.test(text)) {
		return `ocr 需要在 git 仓库里运行，当前工作区 ${cwd} 不是 git 仓库。请把会话切到仓库目录后重试。`;
	}
	if (/no valid llm endpoint/i.test(text)) {
		return [
			"ocr 没有可用的模型端点，`ocr review` 无法运行。",
			"两种解决方式：① 直接用默认的委托模式（不带 engine 参数），由我按 ocr 规则审；",
			"② 在终端执行 `ocr config provider` 配好端点后再用 engine=\"ocr\"。",
		].join("\n");
	}
	return text.slice(0, 200) || "可执行文件未响应";
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

/** 取单个文件的 diff：按优先级尝试命令，第一个有输出者胜；git 被拒时返回 null。 */
async function readDiff(
	ctx: PluginContext,
	preview: ReturnType<typeof parsePreview>,
	root: string,
	path: string,
): Promise<string | null> {
	for (const args of gitDiffArgs(preview, path)) {
		let result: PluginCommandRunResult;
		try {
			result = await ctx.command.run("git", args, { cwd: root, timeoutMs: GIT_TIMEOUT_MS });
		} catch {
			return null; // 未声明 / 用户关闭 / 无 agent.command.run 权限：整批降级
		}
		if (result.stdout.trim()) return result.stdout;
		if (result.exitCode === null) return "";
	}
	return "";
}

export function registerReviewTool(ctx: PluginContext, store: ReviewStore): void {
	ctx.agent.registerTool({
		id: "as-ocr.code-review",
		name: "code_review",
		label: "Code Review",
		description: [
			"Collect the review scope for alibaba/open-code-review (ocr) and hand you a ready-to-review brief: files, per-path rules, and diffs.",
			"",
			"When to use: the user asks to review changes / 审查改动 / check the diff before committing, or you finished a change and want a defect pass.",
			"Do NOT use for: general questions about code (just read it), or when the user only wants a git diff summary (use the git panel).",
			"",
			"Default (delegation, no API key): returns ocr-selected files + resolved rules + git diffs. YOU then review against the rules, and call `code_review_report` with the findings so the user sees them in the 审查 panel.",
			'Set `engine: "ocr"` only if the user already ran `ocr config provider`: then ocr drives the whole review with its own LLM.',
			"",
			'Input: {"from": "<base-branch>", "to": "<ref>", "commit": "<sha>"} — all optional; default is workspace changes (staged + unstaged + untracked).',
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				from: {
					type: "string",
					description: "Base branch for a range review (optional; default: workspace changes)",
				},
				to: {
					type: "string",
					description: 'Range end ref (optional; default: "HEAD"; only used with `from`)',
				},
				commit: {
					type: "string",
					description: "Review a single commit instead of the workspace (optional)",
				},
				engine: {
					type: "string",
					enum: ["delegate", "ocr"],
					description:
						'"delegate" (default, no API key needed) or "ocr" (ocr calls its own configured LLM)',
				},
			},
		},
		scope_use: ["conversation", "project"],
		timeoutMs: 600_000,
		async handler({ trigger, session }) {
			const startedAt = Date.now();
			const parsed = (trigger.input ?? {}) as CodeReviewInput;
			const cwd = resolveRunCwd(session.cwd);
			if (!cwd) {
				return {
					content: [
						{
							type: "text",
							text: `当前会话没有可用的工作区目录（cwd: ${session.cwd || "空"}），无法发起审查。请在 Astravia 里打开一个项目目录后重试。`,
						},
					],
				};
			}
			if (parsed.engine === "ocr") {
				return runOcrReview(ctx, store, parsed, cwd, startedAt, session.id ?? "run");
			}
			return runDelegateReview(ctx, store, parsed, cwd, startedAt);
		},
	});

	ctx.agent.registerTool({
		id: "as-ocr.code-review-report",
		name: "code_review_report",
		label: "Code Review Report",
		description: [
			"Record the findings of a delegated `code_review` run so the user sees them in the 审查 (Reviews) panel.",
			"Call it once, after you finished reviewing the brief returned by `code_review`. Pass an empty findings array when nothing is wrong.",
			"",
			'Input: {"findings": [{"file": "<repo-relative path>", "line": 42, "severity": "critical|major|minor|info", "message": "<what is wrong and why>", "rule": "<optional rule hint>"}], "scope": "<from code_review>", "summary": "<one paragraph>"}',
		].join("\n"),
		parameters: {
			type: "object",
			properties: {
				findings: {
					type: "array",
					description: "Findings you verified; empty array when the change is clean",
					items: {
						type: "object",
						properties: {
							file: { type: "string", description: "Repo-relative path, as shown in the brief" },
							line: { type: "number", description: "Changed line number (omit or 0 when unknown)" },
							severity: { type: "string", enum: ["critical", "major", "minor", "info"] },
							message: { type: "string", description: "Concrete defect, its trigger, and the fix direction" },
							rule: { type: "string", description: "Optional rule that flagged it" },
						},
						required: ["file", "message"],
					},
				},
				scope: { type: "string", description: 'Scope string echoed from `code_review` (default "workspace")' },
				summary: { type: "string", description: "Short overall conclusion for the panel/agent" },
			},
			required: ["findings"],
		},
		scope_use: ["conversation", "project"],
		async handler({ trigger }) {
			const input = (trigger.input ?? {}) as CodeReviewReportInput;
			const findings = normalizeFindings(input.findings);
			store.appendRun({
				id: `run-${Date.now()}`,
				startedAt: Date.now(),
				durationMs: 0,
				scope: input.scope?.trim() || "workspace",
				findings,
				rawSummary: input.summary ?? "",
				ok: true,
				engine: "delegate",
			});
			return { content: [{ type: "text", text: store.summaryForAgent() }] };
		},
	});
}

/**
 * 会话目录 → git 仓库根。
 *
 * ocr 的 `delegate preview` 返回仓库根相对路径；拿仓库子目录跑 `git diff -- <根相对路径>` 会全部落空。
 * 所以先问 git 拿仓库根，拿不到（非仓库 / git 不可用）就退回会话目录，让 ocr 自己报错。
 */
async function resolveRepoRoot(ctx: PluginContext, cwd: string): Promise<string | null> {
	try {
		const result = await ctx.command.run("git", ["rev-parse", "--show-toplevel"], {
			cwd,
			timeoutMs: 10_000,
		});
		const top = result.stdout.trim();
		return result.exitCode === 0 && top ? top : null;
	} catch {
		return null;
	}
}

/** 委托模式：ocr 选文件 + 给规则，git 取 diff，模型自己审。 */
async function runDelegateReview(
	ctx: PluginContext,
	store: ReviewStore,
	input: CodeReviewInput,
	cwd: string,
	startedAt: number,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	let previewOut: PluginCommandRunResult;
	// 仓库根同时用于 ocr 与 git：preview 返回的是仓库根相对路径，会话 cwd 可能只是仓库子目录。
	const repo = await resolveRepoRoot(ctx, cwd);
	const root = repo ?? cwd;
	try {
		previewOut = await ctx.cliProviders.run(OCR_PROVIDER_ID, buildPreviewArgs(input, root), {
			cwd: root,
			timeoutMs: 120_000,
		});
	} catch (error) {
		return { content: [{ type: "text", text: await providerBlockedMessage(ctx, error) }] };
	}
	if (previewOut.exitCode !== 0) {
		const message = describeRunFailure(previewOut.stderr || previewOut.stdout, root);
		store.appendRun({
			id: `run-${startedAt}`,
			startedAt,
			durationMs: Date.now() - startedAt,
			scope: "workspace",
			findings: [],
			rawSummary: "",
			ok: false,
			engine: "delegate",
			error: message,
		});
		return { content: [{ type: "text", text: message }] };
	}

	const preview = parsePreview(previewOut.stdout);
	const scope = describeScope(preview);

	if (preview.files.length === 0) {
		store.appendRun({
			id: `run-${startedAt}`,
			startedAt,
			durationMs: Date.now() - startedAt,
			scope,
			findings: [],
			rawSummary: "",
			ok: true,
			engine: "delegate",
		});
		const excluded =
			preview.excluded.length > 0
				? `\nocr 按规则排除了 ${preview.excluded.length} 个文件：${preview.excluded.map((e) => `${e.path}（${e.reason}）`).join("、")}`
				: "";
		return {
			content: [
				{
					type: "text",
					text: `工作区 ${root} 在 ${scope} 范围内没有可审查的改动。${excluded}\n无需提交 code_review_report。`,
				},
			],
		};
	}

	const targets = preview.files.slice(0, MAX_DIFF_FILES).map((f) => f.path);
	let rules = "";
	try {
		const rulesOut = await ctx.cliProviders.run(OCR_PROVIDER_ID, buildRuleArgs(targets, root), {
			cwd: root,
			timeoutMs: 120_000,
		});
		if (rulesOut.exitCode === 0 && rulesOut.stdout.trim()) rules = rulesOut.stdout;
	} catch {
		/* 规则拿不到就按通用缺陷清单审，不阻塞 */
	}

	const diffs = new Map<string, string>();
	let gitBlocked = false;
	for (const file of preview.files.slice(0, MAX_DIFF_FILES)) {
		if (file.status === "deleted") continue;
		const diff = await readDiff(ctx, preview, root, file.path);
		if (diff === null) {
			gitBlocked = true;
			break;
		}
		diffs.set(file.path, diff);
	}

	const { files, missing } = selectDiffBudget(preview, diffs);
	const brief = composeBrief({ root, preview, rules, files, missing });

	const guide = [
		"---",
		"请按上面的规则逐文件审查这些 diff：只看真实缺陷（空指针、异常分支、并发与状态、安全、资源泄漏、边界、明显回归），不要复述改动、不要提无法验证的猜测。",
		gitBlocked
			? "宿主未授权 git 命令，diff 没能取到：请用你自己的读取/shell 工具读上述文件后再审查。"
			: missing.length > 0
				? "没取到 diff 的文件请自行读取后再审查，不要凭文件名下结论。"
				: "",
		"审完后调用 code_review_report 提交发现（没有发现就传空数组），用户会在「审查」面板看到结果。",
	]
		.filter(Boolean)
		.join("\n");

	return { content: [{ type: "text", text: `${brief}\n\n${guide}` }] };
}

/** ocr 托管模式：ocr 自己调 LLM，需要用户先配好端点。 */
async function runOcrReview(
	ctx: PluginContext,
	store: ReviewStore,
	input: CodeReviewInput,
	cwd: string,
	startedAt: number,
	sessionId: string,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	const scope = input.commit ? input.commit.slice(0, 10) : input.from ? `${input.from}…${input.to ?? "HEAD"}` : "workspace";
	const tmp = `/tmp/as-ocr-${sessionId}-${startedAt}.json`;
	let outcome: PluginCommandRunResult;
	try {
		outcome = await ctx.cliProviders.run(OCR_PROVIDER_ID, buildOcrArgs(input, tmp), {
			cwd,
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
			const parsedJson: unknown = JSON.parse(fileResult.content);
			findings = normalizeFindings(
				Array.isArray(parsedJson) ? parsedJson : ((parsedJson as { findings?: unknown[] }).findings ?? []),
			);
		} catch {
			/* JSON 解析失败按空结果处理 */
		}
	}

	const ok = outcome.exitCode === 0;
	const run: ReviewRun = {
		id: `run-${startedAt}`,
		startedAt,
		durationMs: Date.now() - startedAt,
		scope,
		findings,
		rawSummary: "",
		ok,
		engine: "ocr",
		...(ok ? {} : { error: describeRunFailure(outcome.stderr, cwd) }),
	};
	store.appendRun(run);

	return {
		content: [
			{
				type: "text",
				text: ok ? store.summaryForAgent() : `ocr failed: ${describeRunFailure(outcome.stderr, cwd)}`,
			},
		],
	};
}

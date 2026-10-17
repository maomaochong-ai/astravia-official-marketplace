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
import type { ReviewFinding } from "./finding.ts";
import { normalizeFindings } from "./finding.ts";
import type { ReviewCoverage, ReviewRun, ReviewStore } from "./store";

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

/** 单次简报最多取多少个文件的 diff（其余交给模型自行读取）。 */
const MAX_DIFF_FILES = 40;
/** 单个 diff 命令的超时。 */
const GIT_TIMEOUT_MS = 60_000;

/**
 * 组装 ocr 托管模式的参数（独立出来便于测试）。
 *
 * `--output -` 让结果 JSON 走 stdout：上游 json 格式下进度全部改写 stderr，stdout 恒为
 * 单一可解析文档（shared.go#newQuietHandle）。中转文件方案已废弃——`/tmp` 不在宿主允许的
 * 根目录内，`ctx.fs.readFile` 会被拒，而且失败路径拿不到清理时机，文件会一直残留。
 */
export function buildOcrArgs(input: CodeReviewInput): string[] {
	const args = ["review", "--format", "json", "--output", "-"];
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
			"Default (delegation, no API key): returns ocr-selected files + resolved rules + git diffs. YOU then review against the rules, and call `code_review_report` with the findings so the user sees them in the 代码审查 (Code Review) panel.",
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
			const engine = parsed.engine === "ocr" ? "ocr" : "delegate";
			const scope = scopeOf(parsed);
			const cwd = resolveRunCwd(session.cwd) ?? workspaceRootOf(ctx);
			if (!cwd) {
				const error = `当前会话没有可用的工作区目录（会话 cwd：${session.cwd || "空"}，文件列表也没有打开的项目），无法发起审查。请在 Astravia 里打开一个项目目录后重试。`;
				recordFailure(store, startedAt, engine, scope, error);
				return { content: [{ type: "text", text: error }] };
			}
			if (engine === "ocr") {
				return runOcrReview(ctx, store, parsed, cwd, startedAt);
			}
			return runDelegateReview(ctx, store, parsed, cwd, startedAt);
		},
	});

	ctx.agent.registerTool({
		id: "as-ocr.code-review-report",
		name: "code_review_report",
		label: "Code Review Report",
		description: [
			"Record the findings of a delegated `code_review` run so the user sees them in the 代码审查 (Code Review) panel.",
			"Call it once, after you finished reviewing the brief returned by `code_review`. Pass an empty findings array when nothing is wrong.",
			"",
			"Precision over recall: report only defects you verified in the diff. Do not restate the change, and do not guess.",
			"",
			'severity: "critical" (data loss / security / guaranteed crash) | "high" (breaks a real path) | "medium" (edge case or maintainability risk) | "low" (nit).',
			'category: "bug" | "security" | "performance" | "maintainability" | "test" | "style" | "documentation" | "other".',
			"existing_code / suggestion_code: paste the offending lines and the replacement verbatim (without line-number prefixes) so the panel can show a before/after diff. Omit them when the fix is not a local rewrite.",
			"",
			'Input: {"findings": [{"file": "<repo-relative path>", "line": 42, "end_line": 44, "severity": "high", "category": "bug", "message": "<what is wrong, when it triggers, how to fix>", "existing_code": "<verbatim>", "suggestion_code": "<verbatim>", "rule": "<optional rule hint>"}], "scope": "<from code_review>", "summary": "<one paragraph>"}',
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
							end_line: { type: "number", description: "Last line of the finding when it spans several lines (optional)" },
							severity: {
								type: "string",
								enum: ["critical", "high", "medium", "low"],
								description: "critical = data loss/security/crash; high = breaks a real path; medium = edge case; low = nit",
							},
							category: {
								type: "string",
								enum: [
									"bug",
									"security",
									"performance",
									"maintainability",
									"test",
									"style",
									"documentation",
									"other",
								],
								description: "What kind of problem this is; defaults to other when omitted",
							},
							message: { type: "string", description: "Concrete defect, its trigger, and the fix direction" },
							existing_code: {
								type: "string",
								description: "Verbatim current code the finding points at (enables the before/after view)",
							},
							suggestion_code: {
								type: "string",
								description: "Verbatim replacement code (omit when the fix is not a local rewrite)",
							},
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
			// 简报阶段的覆盖度只对紧跟着的这次上报有效；消费后立即清空，避免脏数据粘到下一次。
			const coverage = pendingCoverage;
			pendingCoverage = null;
			store.appendRun({
				id: `run-${Date.now()}`,
				startedAt: Date.now(),
				durationMs: 0,
				scope: input.scope?.trim() || "workspace",
				findings,
				rawSummary: input.summary ?? "",
				ok: true,
				engine: "delegate",
				...(coverage ? { coverage } : {}),
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

/**
 * 会话没绑定目录时的兜底：从 Finder 启动的宿主主进程 cwd 是 `/`，`session.cwd` 也可能是空的或根。
 * 此时退回文件列表里的活动工作区，否则插件只能反复告诉用户「没有工作区」。
 *
 * 读工作区需要 `workspace.read`；没授权或旧宿主不提供该 API 时返回 null，不影响原有行为。
 */
function workspaceRootOf(ctx: PluginContext): string | null {
	try {
		const root = ctx.fileExplorer.getWorkspaceRoots()[0];
		return root ? resolveRunCwd(root.path) : null;
	} catch {
		return null;
	}
}

/** 审查范围标签：面板与工具回写的文字用同一套口径。 */
function scopeOf(input: CodeReviewInput): string {
	if (input.commit) return input.commit.slice(0, 10);
	if (input.from) return `${input.from}…${input.to ?? "HEAD"}`;
	return "workspace";
}

/**
 * 失败也落一条运行记录。
 *
 * 面板是用户唯一的反馈面：只要没记录，那里就会一直挂着上一次（可能是几小时前、甚至旧版本的）
 * 结论，看起来像「刚才这次又失败了」。
 */
function recordFailure(
	store: ReviewStore,
	startedAt: number,
	engine: "delegate" | "ocr",
	scope: string,
	error: string,
	coverage?: ReviewCoverage,
): void {
	store.appendRun({
		id: `run-${startedAt}`,
		startedAt,
		durationMs: Date.now() - startedAt,
		scope,
		findings: [],
		rawSummary: "",
		ok: false,
		engine,
		...(coverage ? { coverage } : {}),
		error,
	});
}

/** ocr JSON 主契约是 comments[]；子集偶见 findings[]，两种都认。 */
function pickComments(parsed: unknown): unknown {
	if (Array.isArray(parsed)) return parsed;
	if (typeof parsed !== "object" || parsed === null) return [];
	const record = parsed as { comments?: unknown; findings?: unknown };
	if (Array.isArray(record.comments)) return record.comments;
	if (Array.isArray(record.findings)) return record.findings;
	return [];
}

/** ocr 的项目级总结（project_summary）作为面板摘要行。 */
function pickProjectSummary(parsed: unknown): string {
	if (typeof parsed !== "object" || parsed === null) return "";
	const summary = (parsed as { project_summary?: unknown }).project_summary;
	return typeof summary === "string" ? summary.trim() : "";
}

/**
 * 最近一次委托简报的覆盖度。
 *
 * 简报走工具返回值交给模型，`code_review_report` 才落库；面板要区分「没发现问题」和
 * 「本来就没东西可审」，所以把这次简报的覆盖度暂存到报告回来。
 */
let pendingCoverage: ReviewCoverage | null = null;

/** 委托模式：ocr 选文件 + 给规则，git 取 diff，模型自己审。 */
async function runDelegateReview(
	ctx: PluginContext,
	store: ReviewStore,
	input: CodeReviewInput,
	cwd: string,
	startedAt: number,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	const scope = scopeOf(input);
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
		const message = await providerBlockedMessage(ctx, error);
		recordFailure(store, startedAt, "delegate", scope, message, { reviewable: 0, excluded: 0, missing: 0 });
		return { content: [{ type: "text", text: message }] };
	}
	if (previewOut.exitCode !== 0) {
		const message = describeRunFailure(previewOut.stderr || previewOut.stdout, root);
		recordFailure(store, startedAt, "delegate", scope, message, { reviewable: 0, excluded: 0, missing: 0 });
		return { content: [{ type: "text", text: message }] };
	}

	const preview = parsePreview(previewOut.stdout);

	const runScope = describeScope(preview);

	if (preview.files.length === 0) {
		store.appendRun({
			id: `run-${startedAt}`,
			startedAt,
			durationMs: Date.now() - startedAt,
			scope: runScope,
			coverage: { reviewable: 0, excluded: preview.excluded.length, missing: 0 },
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
				text: `工作区 ${root} 在 ${runScope} 范围内没有可审查的改动。${excluded}\n无需提交 code_review_report。`,
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
	const deleted: string[] = [];
	let gitBlocked = false;
	for (const file of preview.files.slice(0, MAX_DIFF_FILES)) {
		// 已删除的文件没有新内容可读，从「missing（需自行读取）」里拿出来，
		// 在简报里单独列出，免得模型去读一个不存在的文件。
		if (file.status === "deleted") {
			deleted.push(file.path);
			continue;
		}
		const diff = await readDiff(ctx, preview, root, file.path);
		if (diff === null) {
			gitBlocked = true;
			break;
		}
		diffs.set(file.path, diff);
	}

	const { files, missing: missingAll } = selectDiffBudget(preview, diffs);
	// 已删除的文件不进 missing（没有内容可读），单独列一节，免得模型去读不存在的文件。
	const deletedSet = new Set(deleted);
	const missing = missingAll.filter((path) => !deletedSet.has(path));
	const deletedListed = deleted.map((p) => `- \`${p}\`（已删除，内容已不存在）`).join("\n");
	const brief = composeBrief({ root, preview, rules, files, missing }) + (deletedListed ? `\n\n已删除的文件（不在上面 diff 里）：\n${deletedListed}` : "");
	pendingCoverage = {
		reviewable: preview.reviewable,
		excluded: preview.excluded.length,
		missing: gitBlocked ? preview.files.length : missing.length,
	};

	const guide = [
		"---",
		"请按上面的规则逐文件审查这些 diff：只看真实缺陷（空指针、异常分支、并发与状态、安全、资源泄漏、边界、明显回归），不要复述改动、不要提无法验证的猜测。",
		gitBlocked
			? "宿主未授权 git 命令，diff 没能取到：请用你自己的读取/shell 工具读上述文件后再审查。"
			: missing.length > 0
				? "没取到 diff 的文件请自行读取后再审查，不要凭文件名下结论。"
				: "",
		"审完后调用 code_review_report 提交发现（没有发现就传空数组），用户会在「代码审查」面板看到结果。",
		"每条发现带上 category（bug/security/performance/maintainability/test/style/documentation/other）；能贴出原文与改法时再带 existing_code / suggestion_code，面板会渲染成对照视图。",
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
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
	const scope = scopeOf(input);
	let outcome: PluginCommandRunResult;
	try {
		outcome = await ctx.cliProviders.run(OCR_PROVIDER_ID, buildOcrArgs(input), {
			cwd,
			timeoutMs: 600_000,
		});
	} catch (error) {
		const message = await providerBlockedMessage(ctx, error);
		recordFailure(store, startedAt, "ocr", scope, message);
		return { content: [{ type: "text", text: message }] };
	}

	if (outcome.exitCode === null || /not found|ENOENT/i.test(outcome.stderr)) {
		const detail = outcome.stderr.slice(0, 200) || "可执行文件未响应";
		const message = `ocr 调用未成功：${detail}。插件启用后宿主会自动安装 ocr，进度见「代码审查」面板；也可手动安装：${OCR_MANUAL_INSTALL}`;
		recordFailure(store, startedAt, "ocr", scope, message);
		return { content: [{ type: "text", text: message }] };
	}

	let findings: ReviewFinding[] = [];
	let rawSummary = "";
	let parseIssue: string | undefined;
	if (outcome.exitCode === 0) {
		try {
			const parsedJson: unknown = JSON.parse(outcome.stdout);
			findings = normalizeFindings(pickComments(parsedJson));
			rawSummary = pickProjectSummary(parsedJson);
		} catch {
			// stdout 不是合法 JSON：这是插件契约被破坏（上游保证 json 格式下 stdout 只有一份文档），
			// 不能静默当「审完零发现」，否则面板会把失败伪装成通过。
			parseIssue = `ocr 返回的结果不是可解析的 JSON（stdout 前 200 字：${outcome.stdout.slice(0, 200) || "空"}）`;
		}
	}

	const ok = outcome.exitCode === 0 && !parseIssue;
	const run: ReviewRun = {
		id: `run-${startedAt}`,
		startedAt,
		durationMs: Date.now() - startedAt,
		scope,
		findings,
		rawSummary,
		ok,
		engine: "ocr",
		...(ok ? {} : { error: parseIssue ?? describeRunFailure(outcome.stderr, cwd) }),
	};
	store.appendRun(run);

	return {
		content: [
			{
				type: "text",
			text: ok ? store.summaryForAgent() : `ocr failed: ${parseIssue ?? describeRunFailure(outcome.stderr, cwd)}`,
			},
		],
	};
}

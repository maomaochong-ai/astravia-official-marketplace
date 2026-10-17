/**
 * 审查结果的数据与执行层。
 *
 * store：审查运行、发现、用户标记（活动面板消费）+ 最新一次结果的会话注入；
 * tool：agent 工具 `code_review` / `code_review_report` 的执行体。
 *
 * ocr CLI 契约（alibaba/open-code-review）：
 *   ocr review --format json --output <file>   # 工作区变更审查（staged+unstaged+untracked）
 *   ocr review --from <a> --to <b> --format json --output <file>  # 分支区间
 * 退出码 0 = 完成（可能有发现）；JSON 的 comments[] 字段见 finding.ts 的归一化说明。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";
import type { FindingMark, ReviewFinding } from "./finding.ts";
import { normalizeFindings } from "./finding.ts";

/**
 * 这次审查到底覆盖了什么。
 * 用来把「没发现问题」和「没东西可审 / 有文件没取到 diff」区分开——
 * 两者在面板上必须是不同的空态，否则用户会把漏审当成通过。
 */
export interface ReviewCoverage {
	/** ocr 选出的可审查文件数。 */
	readonly reviewable: number;
	/** 被 ocr 规则排除的文件数。 */
	readonly excluded: number;
	/** 选中但没取到 diff 的文件数（git 被拒或超预算）。 */
	readonly missing: number;
}

export interface ReviewRun {
	readonly id: string;
	readonly startedAt: number;
	readonly durationMs: number;
	readonly scope: string;
	readonly findings: readonly ReviewFinding[];
	readonly rawSummary: string;
	readonly ok: boolean;
	/** delegate = 模型自己审（默认）；ocr = ocr 调自己的 LLM。旧记录没有该字段。 */
	readonly engine?: "delegate" | "ocr";
	readonly coverage?: ReviewCoverage;
	readonly error?: string;
}

type MarksByRun = Record<string, Record<string, FindingMark>>;

const RUNS_KEY = "as-ocr.runs";
const MARKS_KEY = "as-ocr.marks.json";
const MAX_RUNS = 20;

/**
 * 历史记录读回：缺字段给默认值，发现走归一化（旧记录的 severity 是 major/minor/info）。
 *
 * 返回 null 表示这条记录不该再展示：0.1.9 及之前的运行没有 engine 字段，且那时所有
 * 早退失败（cwd 守卫、provider 未就绪、ocr 缺失）都不落盘——留下面板永远停在旧结论上，
 * 每次重试都像「又失败了」。这种失败在新版本不可能复现（cwd 守卫 + 工作区回退 + 失败也落盘），
 * 所以没有 engine 的失败记录一律剪掉；成功记录保留（那是真实历史）。
 *
 * 不用错误文案做判据：上游措辞一变正则就漏。
 */
function restoreRun(saved: Partial<ReviewRun> & { id: string }): ReviewRun | null {
	if (saved.engine === undefined && saved.ok === false) return null;
	return {
		id: saved.id,
		startedAt: saved.startedAt ?? 0,
		durationMs: saved.durationMs ?? 0,
		scope: saved.scope ?? "workspace",
		findings: normalizeFindings(saved.findings),
		rawSummary: saved.rawSummary ?? "",
		ok: saved.ok !== false,
		...(saved.engine ? { engine: saved.engine } : {}),
		...(saved.coverage ? { coverage: saved.coverage } : {}),
		...(saved.error ? { error: saved.error } : {}),
	};
}

/** 运行记录 + 用户标记的单一来源：面板订阅它，工具往里写。 */
export class ReviewStore {
	private runs: ReviewRun[] = [];
	private marks: MarksByRun = {};
	private listeners = new Set<() => void>();
	private disposables: Array<() => void> = [];
	private readonly ctx: PluginContext;

	// 不用构造函数参数属性：node 的 strip-only 类型剥离不支持它，测试就没法直接 import 这个模块。
	constructor(ctx: PluginContext) {
		this.ctx = ctx;
		void this.loadPersisted();
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	getRuns(): readonly ReviewRun[] {
		return this.runs;
	}

	latest(): ReviewRun | undefined {
		return this.runs[this.runs.length - 1];
	}

	findRun(id: string): ReviewRun | undefined {
		return this.runs.find((run) => run.id === id);
	}

	appendRun(run: ReviewRun): void {
		// 被挤出历史窗口的运行，它的标记也不该继续留在存储里。
		const evicts = this.runs.length >= MAX_RUNS;
		this.runs = [...this.runs, run].slice(-MAX_RUNS);
		if (evicts) {
			const kept = new Set(this.runs.map((item) => item.id));
			const pruned = Object.entries(this.marks).filter(([runId]) => kept.has(runId));
			if (pruned.length !== Object.keys(this.marks).length) {
				this.marks = Object.fromEntries(pruned);
				this.persistMarks();
			}
		}
		this.persistRuns();
		this.emit();
	}

	/** 某次运行的标记表（finding.key → 处置）。只读快照，视图直接渲染。 */
	marksFor(runId: string): Readonly<Record<string, FindingMark>> {
		return this.marks[runId] ?? {};
	}

	/** mark 传 null 表示清除该条标记。 */
	setMark(runId: string, key: string, mark: FindingMark | null): void {
		const current = { ...(this.marks[runId] ?? {}) };
		if (mark) current[key] = mark;
		else delete current[key];
		this.marks = { ...this.marks, [runId]: current };
		this.persistMarks();
		this.emit();
	}

	clearMarks(runId: string): void {
		if (!this.marks[runId]) return;
		const next = { ...this.marks };
		delete next[runId];
		this.marks = next;
		this.persistMarks();
		this.emit();
	}

	/** agent 工具注入用：最新一次审查的结构化摘要（无运行返回 undefined）。 */
	summaryForAgent(): string {
		const run = this.latest();
		if (!run) return "（尚无审查记录。可先运行 code_review 工具。）";
		if (!run.ok) return `最近一次审查失败：${run.error ?? "未知错误"}`;
		if (run.findings.length === 0) return `最近审查（${run.scope}）：未发现问题。`;
		const bySeverity = new Map<string, number>();
		for (const finding of run.findings) {
			bySeverity.set(finding.severity, (bySeverity.get(finding.severity) ?? 0) + 1);
		}
		const counts = [...bySeverity.entries()].map(([severity, count]) => `${severity}:${count}`).join(" ");
		const top = run.findings
			.slice(0, 8)
			.map((finding) => `[${finding.severity}] ${finding.file}:${finding.line} ${finding.message}`)
			.join("\n");
		const rest =
			run.findings.length > 8 ? `\n…另有 ${run.findings.length - 8} 个，详见「代码审查」面板。` : "";
		return `最近审查（${run.scope}）：${run.findings.length} 个发现（${counts}）。\n${top}${rest}`;
	}

	private async loadPersisted(): Promise<void> {
		try {
			const [runsRaw, marksRaw] = await Promise.all([
				this.ctx.storage.readFile(RUNS_KEY, "utf8"),
				this.ctx.storage.readFile(MARKS_KEY, "utf8"),
			]);
			if (runsRaw) {
				const saved: unknown = JSON.parse(runsRaw);
				if (Array.isArray(saved)) {
					// 旧版本记录没有 key/category/endLine，级别还是 major/minor/info：读回来先归一化，面板才敢直接渲染。
					// restoreRun 返回 null 的是旧版已修复的失败（见其注释），直接丢掉而不是当作当前结果展示。
					this.runs = (saved as Partial<ReviewRun>[])
						.filter((run): run is Partial<ReviewRun> & { id: string } => typeof run?.id === "string")
						.map(restoreRun)
						.filter((run): run is ReviewRun => run !== null)
						.slice(-MAX_RUNS);
				}
			}
			if (marksRaw) {
				const saved: unknown = JSON.parse(marksRaw);
				if (saved && typeof saved === "object") this.marks = saved as MarksByRun;
			}
		} catch {
			/* 首次运行或存储损坏：从空开始 */
		}
		this.emit();
	}

	private persistRuns(): void {
		void this.ctx.storage
			.writeFile(RUNS_KEY, JSON.stringify(this.runs), "utf8")
			.catch(() => {
				/* 存储失败不阻塞 */
			});
	}

	private persistMarks(): void {
		void this.ctx.storage
			.writeFile(MARKS_KEY, JSON.stringify(this.marks), "utf8")
			.catch(() => {
				/* 存储失败不阻塞 */
			});
	}

	private emit(): void {
		for (const listener of this.listeners) listener();
	}

	dispose(): void {
		for (const dispose of this.disposables) dispose();
		this.disposables = [];
		this.listeners.clear();
	}
}

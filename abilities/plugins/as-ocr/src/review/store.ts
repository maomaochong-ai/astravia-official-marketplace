/**
 * 审查结果的数据与执行层。
 *
 * store：审查运行与结果（活动面板消费）+ 最新一次结果的会话注入；
 * tool：agent 工具 `code_review` 的执行体（terminal.run 起子进程，JSON 输出落盘后解析）。
 *
 * ocr CLI 契约（alibaba/open-code-review）：
 *   ocr review --format json --output <file>   # 工作区变更审查（staged+unstaged+untracked）
 *   ocr review --from <a> --to <b> --format json --output <file>  # 分支区间
 * 退出码 0 = 完成（可能有发现）；发现结构含 file/line/severity/message/rule。
 */

import type { PluginContext } from "@astravia-org/plugin-sdk";

export interface ReviewFinding {
	readonly file: string;
	readonly line: number;
	readonly severity: "critical" | "major" | "minor" | "info";
	readonly message: string;
	readonly rule?: string;
}

export interface ReviewRun {
	readonly id: string;
	readonly startedAt: number;
	readonly durationMs: number;
	readonly scope: string;
	readonly findings: readonly ReviewFinding[];
	readonly rawSummary: string;
	readonly ok: boolean;
	readonly error?: string;
}

const STORAGE_KEY = "as-ocr.runs";

export class ReviewStore {
	private runs: ReviewRun[] = [];
	private listeners = new Set<() => void>();
	private disposables: Array<() => void> = [];

	constructor(private readonly ctx: PluginContext) {
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

	appendRun(run: ReviewRun): void {
		this.runs = [...this.runs, run].slice(-20);
		this.persist();
		this.emit();
	}

	/** agent 工具注入用：最新一次审查的结构化摘要（无运行返回 undefined）。 */
	summaryForAgent(): string {
		const run = this.latest();
		if (!run) return "（尚无审查记录。可先运行 code_review 工具。）";
		if (!run.ok) return `最近一次审查失败：${run.error ?? "未知错误"}`;
		if (run.findings.length === 0) return `最近审查（${run.scope}）：未发现问题。`;
		const bySeverity = new Map<string, number>();
		for (const f of run.findings) bySeverity.set(f.severity, (bySeverity.get(f.severity) ?? 0) + 1);
		const counts = [...bySeverity.entries()].map(([s, n]) => `${s}:${n}`).join(" ");
		const top = run.findings
			.slice(0, 8)
			.map((f) => `[${f.severity}] ${f.file}:${f.line} ${f.message}`)
			.join("\n");
		return `最近审查（${run.scope}）：${run.findings.length} 个发现（${counts}）。\n${top}${run.findings.length > 8 ? `\n…另有 ${run.findings.length - 8} 个，详见审查面板。` : ""}`;
	}

	private async loadPersisted(): Promise<void> {
		try {
			const raw = await this.ctx.storage.readFile(STORAGE_KEY, "utf8");
			if (!raw) return;
			const saved: unknown = JSON.parse(raw);
			if (Array.isArray(saved)) this.runs = (saved as ReviewRun[]).slice(-20);
		} catch {
			/* 首次运行或存储损坏：从空开始 */
		}
	}

	private persist(): void {
		void this.ctx.storage
			.writeFile(STORAGE_KEY, JSON.stringify(this.runs), "utf8")
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

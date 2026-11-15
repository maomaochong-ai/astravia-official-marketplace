/**
 * 预算：一次评估最多花多少。
 *
 * 上游把它放在 `interface/cloud/billing + budget`，因为上游自己付模型费、自己算 token。
 * 本插件没有模型调用，所以"成本"不是钱，而是**这一轮允许做多少事**：
 * 多少次命令、多少分钟、多少条发现。三者都是插件真能观测、也真能拦住的量。
 *
 * 为什么在服务侧而不是面板：
 *  - agent 才是花预算的人（它调 `strix_exec`），只有服务能在**调用前**拒绝；
 *  - 面板只读，用来显示"还剩多少"，抄一份本地副本只会与真相分叉。
 *
 * 超限不是崩溃：`check()` 返回一句诚实的话，工具调用被拒并告知原因；用户改偏好或
 * 新开一轮即可继续。静默截断（比如悄悄不记录第 251 条发现）会让报告说谎。
 */

export interface BudgetLimits {
	/** 一次评估最多多少次工具调用。0 表示不限。 */
	maxToolCalls: number;
	/** 一次评估最长多少分钟。0 表示不限。 */
	maxMinutes: number;
	/** 最多记录多少条发现。0 表示不限。 */
	maxFindings: number;
}

export const DEFAULT_LIMITS: BudgetLimits = { maxToolCalls: 0, maxMinutes: 0, maxFindings: 0 };

export interface BudgetSnapshot {
	limits: BudgetLimits;
	used: { toolCalls: number; minutes: number; findings: number };
	/** 已经触顶的维度；空数组表示还有余量。 */
	exhausted: Array<"toolCalls" | "minutes" | "findings">;
	/** 一句话解释为什么被拒；没有触顶时为空。 */
	reason?: string;
}

export function normalizeLimits(value: unknown): BudgetLimits {
	const source = (value ?? {}) as Record<string, unknown>;
	const number = (raw: unknown): number => {
		const parsed = Number(raw);
		return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
	};
	return {
		maxToolCalls: number(source.maxToolCalls),
		maxMinutes: number(source.maxMinutes),
		maxFindings: number(source.maxFindings),
	};
}

export class Budget {
	private limits: BudgetLimits = { ...DEFAULT_LIMITS };
	private toolCalls = 0;
	private startedAt = Date.now();
	private findings = 0;

	constructor(limits: Partial<BudgetLimits> = {}) {
		this.limits = { ...DEFAULT_LIMITS, ...limits };
	}

	/** 换一轮：计数归零，时钟重走（新会话 / 新沙箱时调用）。 */
	reset(limits: Partial<BudgetLimits> = this.limits): void {
		this.limits = { ...DEFAULT_LIMITS, ...limits };
		this.toolCalls = 0;
		this.findings = 0;
		this.startedAt = Date.now();
	}

	setLimits(limits: Partial<BudgetLimits>): void {
		this.limits = { ...this.limits, ...limits };
	}

	/** 一次工具调用发生（成功或失败都算：它同样消耗了这一轮的额度）。 */
	spendToolCall(): void {
		this.toolCalls += 1;
	}

	/** 记了一条发现。 */
	spendFinding(): void {
		this.findings += 1;
	}

	used(): { toolCalls: number; minutes: number; findings: number } {
		return {
			toolCalls: this.toolCalls,
			minutes: Math.round(((Date.now() - this.startedAt) / 60_000) * 10) / 10,
			findings: this.findings,
		};
	}

	snapshot(): BudgetSnapshot {
		const used = this.used();
		const exhausted: BudgetSnapshot["exhausted"] = [];
		if (this.limits.maxToolCalls > 0 && used.toolCalls >= this.limits.maxToolCalls) exhausted.push("toolCalls");
		if (this.limits.maxMinutes > 0 && used.minutes >= this.limits.maxMinutes) exhausted.push("minutes");
		if (this.limits.maxFindings > 0 && used.findings >= this.limits.maxFindings) exhausted.push("findings");
		const reason =
			exhausted.length === 0
				? undefined
				: exhausted
						.map((key) =>
							key === "toolCalls"
								? `工具调用已到上限（${this.limits.maxToolCalls} 次）`
								: key === "minutes"
									? `已用满 ${this.limits.maxMinutes} 分钟`
									: `发现已到上限（${this.limits.maxFindings} 条）`,
						)
						.join("；");
		return { limits: this.limits, used, exhausted, ...(reason ? { reason } : {}) };
	}
}

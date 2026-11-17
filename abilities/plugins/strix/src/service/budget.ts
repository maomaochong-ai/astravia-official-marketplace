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

/**
 * 一个会话的计数器。额度上限是用户偏好（全局），用量是那一次评估的（按会话）。
 */
interface Counters {
	toolCalls: number;
	findings: number;
	startedAt: number;
}

/**
 * 预算：**按会话记账**。
 *
 * 曾经只有一个计数器：在 A 里跑了 40 次工具，切到 B 就被报「预算已用尽」——B 什么都没做。
 * 用户看到的是「任务没有隔离」。上限是偏好，一份就够；用量必须与台账、范围同粒度。
 */
export class Budget {
	private limits: BudgetLimits = { ...DEFAULT_LIMITS };
	private readonly counters = new Map<string, Counters>();

	constructor(limits: Partial<BudgetLimits> = {}) {
		this.limits = { ...DEFAULT_LIMITS, ...limits };
	}

	private counter(key: string): Counters {
		const existing = this.counters.get(key);
		if (existing) return existing;
		const fresh: Counters = { toolCalls: 0, findings: 0, startedAt: Date.now() };
		this.counters.set(key, fresh);
		return fresh;
	}

	/** 换一轮：**只归零这个会话**（新沙箱时调用）。 */
	reset(key: string, limits: Partial<BudgetLimits> = this.limits): void {
		this.limits = { ...DEFAULT_LIMITS, ...limits };
		this.counters.set(key, { toolCalls: 0, findings: 0, startedAt: Date.now() });
	}

	/** 改偏好时把所有会话的额度一起换掉，用量保留（它已经是历史事实）。 */
	setLimits(limits: Partial<BudgetLimits>): void {
		this.limits = { ...this.limits, ...limits };
	}

	/** 一次工具调用发生（成功或失败都算：它同样消耗了那一轮的额度）。 */
	spendToolCall(key: string): void {
		this.counter(key).toolCalls += 1;
	}

	/** 记了一条发现。 */
	spendFinding(key: string): void {
		this.counter(key).findings += 1;
	}

	used(key: string): { toolCalls: number; minutes: number; findings: number } {
		const counters = this.counter(key);
		return {
			toolCalls: counters.toolCalls,
			minutes: Math.round(((Date.now() - counters.startedAt) / 60_000) * 10) / 10,
			findings: counters.findings,
		};
	}

	snapshot(key: string): BudgetSnapshot {
		const used = this.used(key);
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

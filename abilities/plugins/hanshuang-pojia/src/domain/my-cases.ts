/**
 * 我的案例：面板自己沉淀的案例库。
 *
 * 与「案例库」页扫的 `cases/` / `work/` 是两回事：那些是仓库里已有的战例目录（只读、
 * 由作者维护），这里存的是**这台机器上真的做过什么**——一次分析产出报告，就沉淀一条。
 *
 * 为什么要有它：报告写在 `reports/` 里，下一次想在面板里找「上周那个 APK 的结论」只能翻
 * 文件系统。沉淀成条目之后，同一个样本再分析一次是在原条目上累加（`seen`），而不是塞第二条。
 *
 * 全部是纯函数，不读时钟也不读盘：时间是调用方给的。
 */

import type { TriageReport } from "./report/report";

export interface MyCase {
	/** 与样本库同一套 id：sha256 前 16 位 + 大小，保证同一份字节只留一条。 */
	id: string;
	name: string;
	sha256: string;
	size: number;
	format: string;
	grade: string;
	score: number;
	findings: number;
	/** 报告里最值得一眼看到的那几条（非 info 的前三条）。 */
	highlights: string[];
	/** 首次沉淀时间。 */
	at: string;
	/** 最近一次分析时间：重新分析会更新它，`at` 保持不变。 */
	lastSeenAt: string;
	/** 沉淀次数。 */
	seen: number;
}

export const MAX_MY_CASES = 60;

/** 报告 → 案例条目。 */
export function caseFromReport(report: TriageReport): MyCase {
	const highlights = report.findings
		.filter(finding => finding.severity !== "info")
		.slice(0, 3)
		.map(finding => `${finding.severity}: ${finding.title}`);
	return {
		id: `${report.target.sha256.slice(0, 16)}-${report.target.size}`,
		name: report.target.name,
		sha256: report.target.sha256,
		size: report.target.size,
		format: report.target.formatLabel || report.target.format,
		grade: report.risk.grade,
		score: report.risk.score,
		findings: report.findings.length,
		highlights: highlights.length > 0 ? highlights : report.summary.slice(0, 3),
		at: report.target.generatedAt,
		lastSeenAt: report.target.generatedAt,
		seen: 1,
	};
}

/**
 * 写入一条：同 id 就累加。
 *
 * 按 id 而不是按 sha256 判重：同一份字节的分析永远得到同一个 id，而 sha256 单独比对会
 * 让「同名不同大小」的两条互相覆盖。
 * 排序按最近分析时间倒序——案例库的用法是「找我刚做过的那个」。
 */
export function upsertCase(list: readonly MyCase[], entry: MyCase, max = MAX_MY_CASES): MyCase[] {
	const existing = list.find(item => item.id === entry.id);
	const merged: MyCase = existing
		? {
				...entry,
				// 首次沉淀时间与次数是历史，不被这次覆盖。
				at: existing.at,
				seen: existing.seen + 1,
			}
		: entry;
	const rest = list.filter(item => item.id !== entry.id);
	return [merged, ...rest].sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt)).slice(0, max);
}

/** 读回来的数据可能被手改过：形状不对的条目直接丢弃，不让页面崩。 */
export function sanitizeCases(value: unknown): MyCase[] {
	if (!Array.isArray(value)) return [];
	const out: MyCase[] = [];
	for (const item of value) {
		if (!item || typeof item !== "object") continue;
		const row = item as Partial<MyCase>;
		if (typeof row.id !== "string" || typeof row.name !== "string") continue;
		out.push({
			id: row.id,
			name: row.name,
			sha256: typeof row.sha256 === "string" ? row.sha256 : "",
			size: typeof row.size === "number" ? row.size : 0,
			format: typeof row.format === "string" ? row.format : "",
			grade: typeof row.grade === "string" ? row.grade : "-",
			score: typeof row.score === "number" ? row.score : 0,
			findings: typeof row.findings === "number" ? row.findings : 0,
			highlights: Array.isArray(row.highlights) ? row.highlights.filter((text): text is string => typeof text === "string") : [],
			at: typeof row.at === "string" ? row.at : "",
			lastSeenAt: typeof row.lastSeenAt === "string" ? row.lastSeenAt : "",
			seen: typeof row.seen === "number" && row.seen > 0 ? row.seen : 1,
		});
	}
	return out.sort((left, right) => right.lastSeenAt.localeCompare(left.lastSeenAt)).slice(0, MAX_MY_CASES);
}

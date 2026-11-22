import type { useTranslation } from "@astravia-org/plugin-sdk";
import type { ProbeRecord } from "../../domain/refusal-probe";
import type { TriageReport } from "../../domain/report/report";
import type { ActivityEntry, PageId, TaskStreamEntry } from "./state";
import type { LiveTone } from "./live-status";
import type { Timeline } from "./timeline";
import { formatDuration } from "./timeline";

/**
 * 对话观测：把「宿主对话正在发生什么」压成几条能直接做决定的行。
 *
 * 为什么要有这一层而不是让页面自己读 model：
 *   · 五个来源（报告 / 活动流 / 任务流 / 探测记录 / 当前样本）各有自己的形状，
 *     页面里逐条判断会写成五段 if，条件一改就漏；
 *   · 「哪些事实值得看」是一个判断，不是渲染 —— 放在纯函数里才断言得了。
 *
 * 这一页原来只有「去载入样本」一个动作：面板在对话里已经跑过 triage / probe 的时候，
 * 用户看不到任何一条来自对话的结论，只能自己翻活动流。观测行就是为了补这一段。
 */

export type ObservationKind = "block" | "probe" | "risk" | "tool" | "turn" | "sample";

export interface ObservationAction {
	/** 标签的本地化键。 */
	labelKey: string;
	/** 面板内跳转目标；与 prompt 二选一。 */
	page?: PageId;
	/** 交给对话的话。 */
	prompt?: string;
}

export interface Observation {
	id: string;
	kind: ObservationKind;
	/** live = 正在发生；alert = 需要看一眼；idle = 只是状态。 */
	tone: LiveTone;
	/** 一行标题：发生了什么。 */
	title: string;
	/** 补充依据：工具名、摘要、规则 id、路径。已经是人读的文本，不再翻译。 */
	detail?: string;
	/** 为什么值得看一眼 / 下一步做什么。 */
	hint?: string;
	at: string | null;
	action?: ObservationAction;
}

/** 面板的翻译函数。用 hook 的返回类型而不是自己写一遍，为的是参数表跟宿主一致。 */
export type Translate = ReturnType<typeof useTranslation>["t"];

export interface ObservationInput {
	report: TriageReport | null;
	activity: readonly ActivityEntry[];
	stream: { entries: readonly TaskStreamEntry[]; active: boolean };
	timeline: Timeline;
	probe: ProbeRecord | null;
	selectedPath: string | null;
	phase: "idle" | "loading" | "ready" | "error";
}

/** 一屏最多几条：超过这个数就不叫「观测」，叫活动流。 */
export const MAX_OBSERVATIONS = 8;

const HIGH_SEVERITIES = new Set(["critical", "high"]);

/**
 * 行序 = 决策优先级：
 *   被拦 / 出错 → 探测结论 → 风险 → 本轮动态 → 最近结果 → 没有样本。
 * 前三条是「必须处理」，后三条是「知道正在发生什么」。
 */
export function deriveObservations(input: ObservationInput, t: Translate): Observation[] {
	const { report, activity, stream, timeline, probe, selectedPath, phase } = input;
	const out: Observation[] = [];

	// 1. 失败的调用：它是唯一「结论可能不完整」的直接证据。
	for (const entry of activity.filter(item => item.isError).slice(0, 2)) {
		out.push({
			id: `block-${entry.id}`,
			kind: "block",
			tone: "alert",
			title: t("obs.title.failed", { tool: entry.toolId }),
			detail: entry.summary,
			hint: t("obs.hint.failed"),
			at: entry.at,
			action: { labelKey: "obs.act.activity", page: "activity" },
		});
	}

	// 2. 探测结论：只列真被拦的档位。`answered` 不是观测点，是背景。
	if (probe) {
		const blocked = probe.rows.filter(row => row.verdict === "refused" || row.verdict === "filtered").slice(0, 3);
		for (const row of blocked) {
			out.push({
				id: `probe-${row.probe.level}`,
				kind: "probe",
				tone: "alert",
				title: t("obs.title.probe", {
					level: row.probe.level,
					verdict: t(`probe.verdict.${row.verdict}`),
				}),
				detail: row.evidence[0] ?? row.excerpt,
				hint: t("obs.hint.probe"),
				at: probe.at,
				action: { labelKey: "obs.act.prompts", page: "prompts" },
			});
		}
	}

	// 3. 风险：高危优先。零发现也要说一句 —— 「没有」是一个结论。
	if (report) {
		const high = report.findings.filter(finding => HIGH_SEVERITIES.has(finding.severity));
		if (high.length > 0) {
			out.push({
				id: "risk-high",
				kind: "risk",
				tone: "alert",
				title: t("obs.title.risk", { high: high.length, total: report.findings.length }),
				// 只列前三条规则：三条之后读者已经知道该去看列表，而不是继续读这一行。
				detail: [...new Set(high.map(finding => finding.ruleId))].slice(0, 3).join(" · "),
				hint: t("obs.hint.risk"),
				at: report.target.generatedAt,
				action: {
					labelKey: "obs.act.explain",
					prompt: `这份报告里有 ${high.length} 条高危（${[...new Set(high.map(finding => finding.ruleId))].slice(0, 3).join("、")}）。逐条说明它在当前样本上的可验证后果，以及最该先修哪一个。`,
				},
			});
		} else {
			out.push({
				id: "risk-clean",
				kind: "risk",
				tone: "idle",
				title: t("obs.title.clean", { total: report.findings.length }),
				detail: report.target.name,
				hint: t("obs.hint.clean"),
				at: report.target.generatedAt,
			});
		}
	}

	// 4. 本轮动态：对话正在动插件工具（或刚动完）。
	const turn = timeline.current;
	if (turn.tools > 0 || stream.active) {
		out.push({
			id: "turn-current",
			kind: "turn",
			tone: turn.failures > 0 ? "alert" : stream.active ? "live" : "idle",
			title: t("obs.title.turn", { tools: turn.tools, ms: formatDuration(turn.ms) }),
			detail: timeline.spans[0]?.toolName,
			hint: turn.open ? t("obs.hint.turnOpen") : t("obs.hint.turnDone"),
			at: turn.startedAt,
			action: { labelKey: "obs.act.activity", page: "activity" },
		});
	}

	// 5. 最近一条结果：侧栏已有的信息，这里给一个能继续追问的入口。
	const latest = activity.find(entry => !entry.isError);
	if (latest) {
		out.push({
			id: `latest-${latest.id}`,
			kind: "tool",
			tone: "live",
			title: t("obs.title.latest", { tool: latest.toolId }),
			detail: latest.summary,
			hint: t("obs.hint.latest"),
			at: latest.at,
			action: {
				labelKey: "obs.act.next",
				prompt: `${latest.toolId} 刚才的结果是：${latest.summary}。基于这一条，下一步最值得做的检查是什么？给出具体命令或偏移。`,
			},
		});
	}

	// 6. 没有样本：面板空着而对话可能已经在跑。这一条不做成「大空态」，只做一行带入口的观测。
	if (!report) {
		out.push({
			id: "no-report",
			kind: "sample",
			tone: phase === "loading" ? "live" : "idle",
			title: t(phase === "loading" ? "obs.title.loading" : "obs.title.noSample"),
			detail: selectedPath ?? undefined,
			hint: t("obs.hint.noSample"),
			at: null,
			action: { labelKey: "obs.act.samples", page: "samples" },
		});
	}

	return out.slice(0, MAX_OBSERVATIONS);
}

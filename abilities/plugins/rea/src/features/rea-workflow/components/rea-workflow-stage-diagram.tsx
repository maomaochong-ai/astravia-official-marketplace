/**
 * 6 阶段流程示意图。
 *
 * 布局原则：单列纵向流动，节点宽度跟随容器，文字自动换行。
 * 面板可能只有 300px 宽，因此不再使用固定 viewBox 的 SVG —— 那种做法会把字号缩到不可读、
 * 并让长文案溢出圆角矩形。
 *
 * 实时化：示意图不再是死图。每个节点声明一个真实信号的绑定（见 live/diagram-live.ts），
 * 命中就显示调用次数、失败数或正在跑的工具名；连接符按两端状态流动或实心。
 * 没有绑定的节点（三类失败、五字段、部分规划步骤）保持参考态，不编造进度。
 *
 * 颜色沿用宿主 CSS variables（--primary / --border / --card），通过 Tailwind 语义色拿到。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { StageDiagram } from "../data/stages";
import {
	resolveEdgeState,
	resolveNodeLive,
	type DiagramBinding,
	type DiagramNodeLive,
} from "../live/diagram-live";
import type { ReaLiveCall } from "../live/session-store";
import { ReaDiagramConnector } from "./rea-diagram-connector";
import { ReaDiagramFrame } from "./rea-diagram-frame";
import { ReaDiagramNode } from "./rea-diagram-node";

interface DiagramProps {
	readonly kind: StageDiagram;
	/** 当前工作目录范围内的真实调用，来自 ReaWorkflowTab 的实时快照。 */
	readonly calls: readonly ReaLiveCall[];
	readonly running: readonly string[];
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"] as const;

/** 重建计划里真实存在的图投影工具。 */
const GRAPH_TOOLS = [
	"project_managed_application_graph",
	"project_android_application_graph",
	"project_apple_application_graph",
	"project_harmony_application_graph",
] as const;

/** 运行时观察类工具，对应 references/runtime-observation.md。 */
const RUNTIME_TOOLS = [
	"capture_process_scenario",
	"trace_javascript_semantics",
	"build_call_path",
	"correlate_static_and_runtime",
	"observe_web_session",
	"instrument_with_frida",
] as const;

/** Stage 1 — Connect：探测 → 三类失败 → 预演 → 下一阶段 */
function ConnectDecisionTree({ calls, running }: DiagramProps): JSX.Element {
	const { t } = useTranslation();
	const node = (binding?: DiagramBinding): DiagramNodeLive => resolveNodeLive(binding, calls, running);
	const probe = node({ kind: "stage", stage: "connect" });
	// 预演是 connect 的最后一步：下游阶段已经开跑，就说明它确实完成了。
	const dryRun = node({ kind: "milestone", after: ["route", "plan", "read"] });
	const handoff = node({ kind: "stage", stage: "route" });
	const fails = [t("tab.diagram.connect.fail1"), t("tab.diagram.connect.fail2"), t("tab.diagram.connect.fail3")];
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.connect.diagramAria")}>
			<ReaDiagramNode tone="primary" mono title="rea doctor --json" hint={t("tab.diagram.connect.probe")} live={probe} />
			<ReaDiagramConnector label={t("tab.diagram.connect.modes")} state={resolveEdgeState(probe, dryRun)} />
			<div className="flex flex-col gap-1.5">
				{fails.map((label, index) => (
					<ReaDiagramNode key={label} tone="warning" title={`${CIRCLED[index]} ${label}`} />
				))}
			</div>
			<ReaDiagramConnector state={resolveEdgeState(probe, dryRun)} />
			<ReaDiagramNode
				tone="primary"
				title={t("tab.diagram.connect.dryRun")}
				hint={t("tab.diagram.connect.dryRunHint")}
				live={dryRun}
			/>
			<ReaDiagramConnector state={resolveEdgeState(dryRun, handoff)} />
			<ReaDiagramNode tone="quiet" title={`route (${t("tab.diagram.nextStage")})`} live={handoff} />
		</ReaDiagramFrame>
	);
}

/** Stage 2 — Route：22 类型 → 4 大类 → 工作模式 */
function RouteFanOut({ calls, running }: DiagramProps): JSX.Element {
	const { t } = useTranslation();
	const node = (binding?: DiagramBinding): DiagramNodeLive => resolveNodeLive(binding, calls, running);
	const source = node({ kind: "stage", stage: "route" });
	// 工作模式确定之后才有下游调用，用后续阶段反推这一节点。
	const mode = node({ kind: "milestone", after: ["plan", "read", "finish"] });
	const handoff = node({ kind: "stage", stage: "summary" });
	// 四个入口桶各自绑定目标类型：真实调用落在哪个桶，那个桶就亮。
	const buckets = [
		{ title: t("tab.diagram.route.bucket1"), hint: t("tab.diagram.route.bucket1Hint"), live: node({ kind: "targets", targets: ["native"] }) },
		{ title: t("tab.diagram.route.bucket2"), hint: t("tab.diagram.route.bucket2Hint"), live: node({ kind: "targets", targets: ["dotnet"] }) },
		{ title: t("tab.diagram.route.bucket3"), hint: t("tab.diagram.route.bucket3Hint"), live: node({ kind: "targets", targets: ["javascript"] }) },
		{
			title: t("tab.diagram.route.bucket4"),
			hint: t("tab.diagram.route.bucket4Hint"),
			live: node({ kind: "targets", targets: ["mobile", "firmware"] }),
		},
	];
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.route.diagramAria")}>
			<ReaDiagramNode
				tone="primary"
				title={t("tab.diagram.route.source")}
				hint="native · .NET · JS · Android"
				live={source}
			/>
			<ReaDiagramConnector state={resolveEdgeState(source, buckets[0]?.live ?? source)} />
			<div className="flex flex-col gap-1.5">
				{buckets.map((bucket, index) => (
					<ReaDiagramNode
						key={bucket.title}
						title={`${CIRCLED[index]} ${bucket.title}`}
						hint={bucket.hint}
						live={bucket.live}
					/>
				))}
			</div>
			<ReaDiagramConnector state={resolveEdgeState(buckets[0]?.live ?? source, mode)} />
			<ReaDiagramNode
				tone="primary"
				title={t("tab.diagram.route.mode")}
				hint={t("tab.diagram.route.modeHint")}
				live={mode}
			/>
			<ReaDiagramConnector state={resolveEdgeState(mode, handoff)} />
			<ReaDiagramNode tone="quiet" title={`summary (${t("tab.diagram.nextStage")})`} live={handoff} />
		</ReaDiagramFrame>
	);
}

/** Stage 3 — Summary：原始发现 → 5 字段报告 */
function SummaryFiveFields({ calls, running }: DiagramProps): JSX.Element {
	const { t } = useTranslation();
	const node = (binding?: DiagramBinding): DiagramNodeLive => resolveNodeLive(binding, calls, running);
	const source = node({ kind: "total" });
	// summary 没有专属工具，用"后续阶段已开跑"表示这份摘要已经产出。
	const report = node({ kind: "milestone", after: ["plan", "read", "finish"] });
	const handoff = node({ kind: "stage", stage: "plan" });
	const fields = ["who", "where", "what", "why", "evidence"] as const;
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.summary.diagramAria")}>
			<ReaDiagramNode
				tone="primary"
				title={t("tab.diagram.summary.source")}
				hint={t("tab.diagram.summary.sourceHint")}
				live={source}
			/>
			<ReaDiagramConnector state={resolveEdgeState(source, report)} />
			<ReaDiagramNode
				tone="neutral"
				title={t("tab.diagram.summary.report")}
				hint="who · where · what · why · evidence"
				live={report}
			/>
			<ReaDiagramConnector label={t("tab.diagram.summary.fieldsHint")} />
			<div className="grid min-w-0 grid-cols-1 gap-1.5 @min-[380px]:grid-cols-2">
				{fields.map((field) => (
					<div
						key={field}
						title={field}
						className="min-w-0 truncate rounded-[min(var(--radius-md),6px)] border border-border bg-card px-2 py-1 font-mono text-[10px] text-foreground"
					>
						{field}
					</div>
				))}
			</div>
			<ReaDiagramConnector state={resolveEdgeState(report, handoff)} />
			<ReaDiagramNode tone="quiet" title={`plan (${t("tab.diagram.nextStage")})`} live={handoff} />
		</ReaDiagramFrame>
	);
}

/** Stage 4 — Plan：8 步循环 */
function PlanEightSteps({ calls, running }: DiagramProps): JSX.Element {
	const { t } = useTranslation();
	const node = (binding?: DiagramBinding): DiagramNodeLive => resolveNodeLive(binding, calls, running);
	const handoff = node({ kind: "stage", stage: "read" });
	const started = calls.length > 0;
	const steps: ReadonlyArray<{
		readonly key: string;
		readonly label: string;
		readonly tone: "primary" | "warning" | "neutral";
		readonly live?: DiagramNodeLive;
	}> = [
		{ key: "1", label: t("tab.diagram.plan.step1"), tone: "primary", live: node({ kind: "stage", stage: "route" }) },
		{ key: "2", label: t("tab.diagram.plan.step2"), tone: "primary", live: node({ kind: "stage", stage: "connect" }) },
		{ key: "3", label: t("tab.diagram.plan.step3"), tone: "primary", live: node({ kind: "tools", tools: GRAPH_TOOLS }) },
		{ key: "4", label: t("tab.diagram.plan.step4"), tone: "primary", live: node({ kind: "stage", stage: "read" }) },
		{ key: "5", label: t("tab.diagram.plan.step5"), tone: "primary", live: node({ kind: "any", of: [{ kind: "stage", stage: "read" }, { kind: "stage", stage: "finish" }] }) },
		{
			key: "?",
			label: t("tab.diagram.plan.step6"),
			tone: "warning",
			live: node({ kind: "tools", tools: ["record_unknown", "list_unknowns", "update_unknown"] }),
		},
		{
			key: "✓",
			label: t("tab.diagram.plan.step7"),
			tone: "neutral",
			live: node({ kind: "tools", tools: ["build_reconstruction_obligation_ledger", "import_managed_reconstruction"] }),
		},
		{ key: "↺", label: t("tab.diagram.plan.step8"), tone: "neutral", live: node({ kind: "milestone", after: ["read", "finish"] }) },
	];
	const toneClass = {
		primary: "border-primary/50 bg-primary/10 text-foreground",
		warning: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
		neutral: "border-border bg-card text-foreground",
	} as const;
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.plan.diagramAria")}>
			<div className="grid min-w-0 grid-cols-1 gap-1.5 @min-[380px]:grid-cols-2">
				{steps.map((step) => (
					<div
						key={step.key}
						data-rea-node-state={step.live?.state ?? "idle"}
						className={`flex min-w-0 items-center gap-1.5 rounded-[min(var(--radius-md),8px)] border px-2 py-1.5 ${toneClass[step.tone]} ${
							step.live?.state === "active" ? "border-primary/80 motion-safe:animate-rea-ring" : ""
						}`}
					>
						<span className="grid size-4 shrink-0 place-items-center rounded-full border border-current text-[9px] font-semibold leading-none">
							{step.key}
						</span>
						<span className="min-w-0 break-words text-[10px] leading-tight">{step.label}</span>
						{step.live && (step.live.state !== "idle" || started) ? (
							<span
								className={`ml-auto shrink-0 text-[9px] tabular-nums ${
									step.live.state === "failed"
										? "text-red-600 dark:text-red-400"
										: step.live.state === "idle"
											? "text-muted-foreground"
											: "text-primary"
								}`}
								title={step.live.state === "idle" ? t("tab.live.diagram.unmetHint") : (step.live.tools[0] ?? undefined)}
							>
								{step.live.state === "active"
									? t("tab.live.diagram.running")
									: step.live.state === "idle"
										? t("tab.live.diagram.unmet")
										: step.live.count > 0
											? t("tab.live.diagram.calls", { count: step.live.count })
											: t("tab.live.diagram.reached")}
							</span>
						) : null}
					</div>
				))}
			</div>
			<ReaDiagramConnector label={t("tab.diagram.plan.loopHint")} state={resolveEdgeState(steps[0]?.live ?? handoff, handoff)} />
			<ReaDiagramNode tone="quiet" title={t("tab.diagram.plan.handoff")} live={handoff} />
		</ReaDiagramFrame>
	);
}

/** Stage 5 — Read：summary → 按目标类型读一份 references */
function ReadReferencesRouting({ calls, running }: DiagramProps): JSX.Element {
	const { t } = useTranslation();
	const node = (binding?: DiagramBinding): DiagramNodeLive => resolveNodeLive(binding, calls, running);
	const summary = node({ kind: "milestone", after: ["plan"] });
	const handoff = node({ kind: "stage", stage: "finish" });
	// 每份参考绑定它实际对应的证据来源：目标类型或工具族。
	const refs = [
		{ name: "connection-and-recovery", hint: t("tab.diagram.read.ref1"), live: node({ kind: "stage", stage: "connect" }) },
		{ name: "native-and-artifacts", hint: t("tab.diagram.read.ref2"), live: node({ kind: "targets", targets: ["native", "dotnet"] }) },
		{ name: "javascript-applications", hint: t("tab.diagram.read.ref3"), live: node({ kind: "targets", targets: ["javascript"] }) },
		{ name: "android-applications", hint: t("tab.diagram.read.ref4"), live: node({ kind: "targets", targets: ["mobile"] }) },
		{ name: "runtime-observation", hint: t("tab.diagram.read.ref5"), live: node({ kind: "tools", tools: RUNTIME_TOOLS }) },
		{ name: "evidence-workflows", hint: t("tab.diagram.read.ref6"), live: node({ kind: "stage", stage: "finish" }) },
	];
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.read.diagramAria")}>
			<ReaDiagramNode tone="primary" title="summary" hint="who · where · what" live={summary} />
			<ReaDiagramConnector label={t("tab.diagram.read.pick")} state={resolveEdgeState(summary, refs[0]?.live ?? summary)} />
			<div className="flex flex-col gap-1.5">
				{refs.map((ref) => (
					<div
						key={ref.name}
						data-rea-node-state={ref.live.state}
						className={`min-w-0 rounded-[min(var(--radius-md),8px)] border bg-card px-2 py-1.5 ${
							ref.live.state === "active"
								? "border-primary/80 motion-safe:animate-rea-ring"
								: ref.live.state === "idle"
									? "border-border"
									: "border-primary/45"
						}`}
					>
						<div className="flex min-w-0 items-baseline gap-1.5">
							<span className="min-w-0 break-all font-mono text-[10px] leading-tight text-foreground">{ref.name}.md</span>
							{ref.live.state !== "idle" ? (
								<span className="ml-auto shrink-0 text-[9px] tabular-nums text-primary">
									{ref.live.state === "active"
										? t("tab.live.diagram.running")
										: ref.live.count > 0
											? t("tab.live.diagram.calls", { count: ref.live.count })
											: t("tab.live.diagram.reached")}
								</span>
							) : null}
						</div>
						<div className="mt-0.5 break-words text-[10px] leading-snug text-muted-foreground">{ref.hint}</div>
					</div>
				))}
			</div>
			<ReaDiagramConnector state={resolveEdgeState(refs[0]?.live ?? summary, handoff)} />
			<ReaDiagramNode tone="quiet" title={t("tab.diagram.read.handoff")} live={handoff} />
		</ReaDiagramFrame>
	);
}

/** Stage 6 — Finish：5 项交付清单 → 收尾 */
function FinishChecklist({ calls, running }: DiagramProps): JSX.Element {
	const { t } = useTranslation();
	const node = (binding?: DiagramBinding): DiagramNodeLive => resolveNodeLive(binding, calls, running);
	const finish = node({ kind: "stage", stage: "finish" });
	// 每条清单绑定**产出它的工具族**：不要求必须是某一个冷门工具，否则正常分析里几乎永远不会亮。
	// 一个都没命中的条目不假装完成，下面会标成「未执行」。
	const checks = [
		{
			label: t("tab.diagram.finish.check1"),
			live: node({
				kind: "any",
				of: [
					{ kind: "tools", tools: ["verify_reconstruction", "evaluate_reconstruction_coverage"] },
					{ kind: "tools", tools: ["build_reconstruction_obligation_ledger", "import_managed_reconstruction"] },
				],
			}),
		},
		{ label: t("tab.diagram.finish.check2"), live: node({ kind: "tools", tools: RUNTIME_TOOLS }) },
		{ label: t("tab.diagram.finish.check3"), live: node({ kind: "tools", tools: ["list_unknowns", "record_unknown", "update_unknown"] }) },
		{
			label: t("tab.diagram.finish.check4"),
			live: node({ kind: "tools", tools: ["export_evidence_bundle", "import_evidence_bundle", "get_evidence_bundle"] }),
		},
		{
			label: t("tab.diagram.finish.check5"),
			live: node({ kind: "tools", tools: ["verify_unknown_resolution", "update_unknown", "verify_reconstruction"] }),
		},
	];
	// 会话已经开跑、但这几条检查本次没有对应调用：如实标成「未执行」。
	const started = calls.length > 0;
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.finish.diagramAria")}>
			<ul className="space-y-1.5">
				{checks.map((check) => {
					const state = check.live.state;
					return (
						<li key={check.label} className="flex min-w-0 items-start gap-1.5" data-rea-node-state={state}>
							<span
								className={`mt-px grid size-4 shrink-0 place-items-center rounded-[4px] border text-[9px] font-semibold leading-none ${
									state === "idle"
										? "border-primary/50 bg-primary/10 text-primary"
										: state === "failed"
											? "border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-400"
											: "border-primary bg-primary/20 text-primary"
								}`}
								aria-hidden="true"
							>
								{state === "failed" ? "!" : state === "idle" ? "–" : "✓"}
							</span>
							<span className="min-w-0 break-words text-[10px] leading-snug text-foreground/90">{check.label}</span>
							{state !== "idle" || started ? (
								<span
									className={`ml-auto shrink-0 text-[9px] tabular-nums ${state === "idle" ? "text-muted-foreground" : "text-primary"}`}
									title={state === "idle" ? t("tab.live.diagram.unmetHint") : undefined}
								>
									{state === "active"
										? t("tab.live.diagram.running")
										: state === "idle"
											? t("tab.live.diagram.unmet")
											: check.live.count > 0
												? t("tab.live.diagram.calls", { count: check.live.count })
												: t("tab.live.diagram.reached")}
								</span>
							) : null}
						</li>
					);
				})}
			</ul>
			{/* 清单与收尾节点之间不画箭头：清单不是会话节点，连线会让人以为 finish 之前还有一步。 */}
			<ReaDiagramNode
				tone="primary"
				title="finish"
				hint={t("tab.diagram.finish.deliverable")}
				live={finish}
			/>
			<p className="mt-1 break-words text-center text-[10px] leading-snug text-muted-foreground">
				{t("tab.diagram.finish.handoff")}
			</p>
		</ReaDiagramFrame>
	);
}

export function ReaWorkflowStageDiagram({ kind, calls, running }: DiagramProps): JSX.Element {
	switch (kind) {
		case "connect-decision-tree":
			return <ConnectDecisionTree kind={kind} calls={calls} running={running} />;
		case "route-fan-out":
			return <RouteFanOut kind={kind} calls={calls} running={running} />;
		case "summary-five-fields":
			return <SummaryFiveFields kind={kind} calls={calls} running={running} />;
		case "plan-eight-steps":
			return <PlanEightSteps kind={kind} calls={calls} running={running} />;
		case "read-references-routing":
			return <ReadReferencesRouting kind={kind} calls={calls} running={running} />;
		case "finish-checklist":
			return <FinishChecklist kind={kind} calls={calls} running={running} />;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

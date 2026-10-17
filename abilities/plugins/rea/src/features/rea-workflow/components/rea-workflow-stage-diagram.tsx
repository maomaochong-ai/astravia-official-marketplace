/**
 * 6 阶段流程示意图。
 *
 * 布局原则：单列纵向流动，节点宽度跟随容器，文字自动换行。
 * 面板可能只有 300px 宽，因此不再使用固定 viewBox 的 SVG —— 那种做法会把字号缩到不可读、
 * 并让长文案溢出圆角矩形。
 *
 * 颜色沿用宿主 CSS variables（--primary / --border / --card），通过 Tailwind 语义色拿到。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { StageDiagram } from "../data/stages";
import { ReaDiagramConnector } from "./rea-diagram-connector";
import { ReaDiagramFrame } from "./rea-diagram-frame";
import { ReaDiagramNode } from "./rea-diagram-node";

interface DiagramProps {
	readonly kind: StageDiagram;
}

const CIRCLED = ["①", "②", "③", "④", "⑤", "⑥", "⑦", "⑧"] as const;

/** Stage 1 — Connect：探测 → 三类失败 → 预演 → 下一阶段 */
function ConnectDecisionTree(): JSX.Element {
	const { t } = useTranslation();
	const fails = [t("tab.diagram.connect.fail1"), t("tab.diagram.connect.fail2"), t("tab.diagram.connect.fail3")];
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.connect.diagramAria")}>
			<ReaDiagramNode tone="primary" mono title="rea doctor --json" hint={t("tab.diagram.connect.probe")} />
			<ReaDiagramConnector label={t("tab.diagram.connect.modes")} />
			<div className="flex flex-col gap-1.5">
				{fails.map((label, index) => (
					<ReaDiagramNode key={label} tone="warning" title={`${CIRCLED[index]} ${label}`} />
				))}
			</div>
			<ReaDiagramConnector />
			<ReaDiagramNode
				tone="primary"
				title={t("tab.diagram.connect.dryRun")}
				hint={t("tab.diagram.connect.dryRunHint")}
			/>
			<ReaDiagramConnector />
			<ReaDiagramNode tone="quiet" title={`→ route (${t("tab.diagram.nextStage")})`} />
		</ReaDiagramFrame>
	);
}

/** Stage 2 — Route：22 类型 → 4 大类 → 工作模式 */
function RouteFanOut(): JSX.Element {
	const { t } = useTranslation();
	const buckets = [
		{ title: t("tab.diagram.route.bucket1"), hint: t("tab.diagram.route.bucket1Hint") },
		{ title: t("tab.diagram.route.bucket2"), hint: t("tab.diagram.route.bucket2Hint") },
		{ title: t("tab.diagram.route.bucket3"), hint: t("tab.diagram.route.bucket3Hint") },
		{ title: t("tab.diagram.route.bucket4"), hint: t("tab.diagram.route.bucket4Hint") },
	];
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.route.diagramAria")}>
			<ReaDiagramNode tone="primary" title={t("tab.diagram.route.source")} hint="native · .NET · JS · Android" />
			<ReaDiagramConnector />
			<div className="flex flex-col gap-1.5">
				{buckets.map((bucket, index) => (
					<ReaDiagramNode
						key={bucket.title}
						title={`${CIRCLED[index]} ${bucket.title}`}
						hint={bucket.hint}
					/>
				))}
			</div>
			<ReaDiagramConnector />
			<ReaDiagramNode
				tone="primary"
				title={t("tab.diagram.route.mode")}
				hint={t("tab.diagram.route.modeHint")}
			/>
			<ReaDiagramConnector />
			<ReaDiagramNode tone="quiet" title={`→ summary (${t("tab.diagram.nextStage")})`} />
		</ReaDiagramFrame>
	);
}

/** Stage 3 — Summary：原始发现 → 5 字段报告 */
function SummaryFiveFields(): JSX.Element {
	const { t } = useTranslation();
	const fields = ["who", "where", "what", "why", "evidence"] as const;
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.summary.diagramAria")}>
			<ReaDiagramNode
				tone="primary"
				title={t("tab.diagram.summary.source")}
				hint={t("tab.diagram.summary.sourceHint")}
			/>
			<ReaDiagramConnector />
			<ReaDiagramNode
				tone="neutral"
				title={t("tab.diagram.summary.report")}
				hint="who · where · what · why · evidence"
			/>
			<ReaDiagramConnector label={t("tab.diagram.summary.fieldsHint")} />
			<div className="grid min-w-0 grid-cols-1 gap-1.5 min-[360px]:grid-cols-2">
				{fields.map((field) => (
					<div
						key={field}
						className="min-w-0 truncate rounded-[min(var(--radius-md),6px)] border border-border bg-card px-2 py-1 font-mono text-[10px] text-foreground"
					>
						{field}
					</div>
				))}
			</div>
			<ReaDiagramConnector />
			<ReaDiagramNode tone="quiet" title={`→ plan (${t("tab.diagram.nextStage")})`} />
		</ReaDiagramFrame>
	);
}

/** Stage 4 — Plan：8 步循环 */
function PlanEightSteps(): JSX.Element {
	const { t } = useTranslation();
	const steps: ReadonlyArray<{ readonly key: string; readonly label: string; readonly tone: "primary" | "warning" | "neutral" }> = [
		{ key: "1", label: t("tab.diagram.plan.step1"), tone: "primary" },
		{ key: "2", label: t("tab.diagram.plan.step2"), tone: "primary" },
		{ key: "3", label: t("tab.diagram.plan.step3"), tone: "primary" },
		{ key: "4", label: t("tab.diagram.plan.step4"), tone: "primary" },
		{ key: "5", label: t("tab.diagram.plan.step5"), tone: "primary" },
		{ key: "?", label: t("tab.diagram.plan.step6"), tone: "warning" },
		{ key: "✓", label: t("tab.diagram.plan.step7"), tone: "neutral" },
		{ key: "↺", label: t("tab.diagram.plan.step8"), tone: "neutral" },
	];
	const toneClass = {
		primary: "border-primary/50 bg-primary/10 text-foreground",
		warning: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
		neutral: "border-border bg-card text-foreground",
	} as const;
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.plan.diagramAria")}>
			<div className="grid min-w-0 grid-cols-1 gap-1.5 min-[360px]:grid-cols-2">
				{steps.map((step) => (
					<div
						key={step.key}
						className={`flex min-w-0 items-center gap-1.5 rounded-[min(var(--radius-md),8px)] border px-2 py-1.5 ${toneClass[step.tone]}`}
					>
						<span className="grid size-4 shrink-0 place-items-center rounded-full border border-current text-[9px] font-semibold leading-none">
							{step.key}
						</span>
						<span className="min-w-0 break-words text-[10px] leading-tight">{step.label}</span>
					</div>
				))}
			</div>
			<ReaDiagramConnector label={t("tab.diagram.plan.loopHint")} />
			<ReaDiagramNode tone="quiet" title={`→ ${t("tab.diagram.plan.handoff")}`} />
		</ReaDiagramFrame>
	);
}

/** Stage 5 — Read：summary → 按目标类型读一份 references */
function ReadReferencesRouting(): JSX.Element {
	const { t } = useTranslation();
	const refs = [
		{ name: "connection-and-recovery", hint: t("tab.diagram.read.ref1") },
		{ name: "native-and-artifacts", hint: t("tab.diagram.read.ref2") },
		{ name: "javascript-applications", hint: t("tab.diagram.read.ref3") },
		{ name: "android-applications", hint: t("tab.diagram.read.ref4") },
		{ name: "runtime-observation", hint: t("tab.diagram.read.ref5") },
		{ name: "evidence-workflows", hint: t("tab.diagram.read.ref6") },
	];
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.read.diagramAria")}>
			<ReaDiagramNode tone="primary" title="summary" hint="who · where · what" />
			<ReaDiagramConnector label={t("tab.diagram.read.pick")} />
			<div className="flex flex-col gap-1.5">
				{refs.map((ref) => (
					<div
						key={ref.name}
						className="min-w-0 rounded-[min(var(--radius-md),8px)] border border-border bg-card px-2 py-1.5"
					>
						<div className="break-all font-mono text-[10px] leading-tight text-foreground">{ref.name}.md</div>
						<div className="mt-0.5 break-words text-[10px] leading-snug text-muted-foreground">{ref.hint}</div>
					</div>
				))}
			</div>
			<ReaDiagramConnector />
			<ReaDiagramNode tone="quiet" title={`→ ${t("tab.diagram.read.handoff")}`} />
		</ReaDiagramFrame>
	);
}

/** Stage 6 — Finish：5 项交付清单 → 收尾 */
function FinishChecklist(): JSX.Element {
	const { t } = useTranslation();
	const checks = [
		t("tab.diagram.finish.check1"),
		t("tab.diagram.finish.check2"),
		t("tab.diagram.finish.check3"),
		t("tab.diagram.finish.check4"),
		t("tab.diagram.finish.check5"),
	];
	return (
		<ReaDiagramFrame ariaLabel={t("tab.detail.finish.diagramAria")}>
			<ul className="space-y-1.5">
				{checks.map((check) => (
					<li key={check} className="flex min-w-0 items-start gap-1.5">
						<span
							className="mt-px grid size-4 shrink-0 place-items-center rounded-[4px] border border-primary/50 bg-primary/10 text-[9px] font-semibold leading-none text-primary"
							aria-hidden="true"
						>
							✓
						</span>
						<span className="min-w-0 break-words text-[10px] leading-snug text-foreground/90">{check}</span>
					</li>
				))}
			</ul>
			<ReaDiagramConnector />
			<ReaDiagramNode
				tone="primary"
				title="finish"
				hint={t("tab.diagram.finish.deliverable")}
			/>
			<p className="mt-1 break-words text-center text-[10px] leading-snug text-muted-foreground">
				{t("tab.diagram.finish.handoff")}
			</p>
		</ReaDiagramFrame>
	);
}

export function ReaWorkflowStageDiagram({ kind }: DiagramProps): JSX.Element {
	switch (kind) {
		case "connect-decision-tree":
			return <ConnectDecisionTree />;
		case "route-fan-out":
			return <RouteFanOut />;
		case "summary-five-fields":
			return <SummaryFiveFields />;
		case "plan-eight-steps":
			return <PlanEightSteps />;
		case "read-references-routing":
			return <ReadReferencesRouting />;
		case "finish-checklist":
			return <FinishChecklist />;
		default: {
			const _exhaustive: never = kind;
			return _exhaustive;
		}
	}
}

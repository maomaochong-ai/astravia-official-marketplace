/**
 * 单阶段详情：标题 + 流程示意图 + 关键要点 + Agent 侧动作 + 关联 reference + 失败兜底。
 *
 * 这是一个「文档区」而不是一张卡：区块之间只用 1px 分隔线，不再套圆角边框。
 * 理由是这个区块本身已经在一个更大的表面里（main 列），再框一层会出现「框中框」，
 * 面板拖窄时特别明显。
 *
 * 标题与副标题在宽面板隐藏：左栏的 ReaWorkflowRail 已经用更大的字号展示同一段文字，
 * 两处都显示就只是重复。窄面板没有左栏，所以这里补上。
 *
 * 这里不提供「手动跑命令」：运行 REA CLI 与 Agent 侧自动调用 MCP 工具是同一件事的两种入口，
 * 并存只会让人分不清该点哪个。插件负责显示进度与所需工具，执行交给 Agent。
 */

import type { JSX, ReactNode } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { StageDefinition } from "../data/stages";
import { getTarget, type TargetKind } from "../data/targets";
import type { DoctorStatus } from "../hooks/use-doctor-report";
import type { StageLiveSource } from "../live/diagram-live";
import { agentActionsFor } from "../live/agent-actions";
import { StatusChip } from "../../../shared/components/status-chip";
import { Eyebrow } from "../../../shared/components/eyebrow";
import { ReaAgentActionRow } from "./rea-agent-action-row";
import { ReaDiagramLiveCaption } from "./rea-diagram-live-caption";
import { ReaStagePoints } from "./rea-stage-points";
import { ReaWorkflowStageDiagram } from "./rea-workflow-stage-diagram";

interface DetailProps {
	readonly stage: StageDefinition;
	/** 总阶段数，用于 "Stage n of N"。 */
	readonly total: number;
	/** 当前工作目录范围内的真实调用 + 本阶段摘要，用于把示意图点亮。 */
	readonly live: StageLiveSource;
	/** doctor 自动检测的状态，用于点亮「环境/依赖」类要点。 */
	readonly doctor: DoctorStatus;
	/** 当前选定 / 识别出的目标类型；null 表示还没定，动作清单保持阶段默认顺序。 */
	readonly target: TargetKind | null;
}

export function ReaWorkflowStageDetail({ stage, total, live, doctor, target }: DetailProps): JSX.Element {
	const { t } = useTranslation();
	const entryTool = target === null ? null : getTarget(target).entryTool;
	const actions = agentActionsFor(stage.toolNames, { entryTool, calls: live.calls, running: live.running });

	return (
		<div className="flex flex-col">
			<header className="flex min-w-0 flex-col gap-1.5 border-b border-border px-4 py-3">
				<div className="flex min-w-0 items-center justify-between gap-2">
					<Eyebrow tone="strong" className="min-w-0 truncate font-mono">
						{t("tab.detail.microLabel", {
							target: target === null ? t("tab.detail.microNone") : t(getTarget(target).labelKey),
							index: String(stage.index).padStart(2, "0"),
							calls: live.digest.calls,
						})}
					</Eyebrow>
					<StatusChip
						tone={live.digest.state === "active" ? "progress" : live.digest.state === "done" ? "success" : "neutral"}
						className="normal-case tracking-normal"
					>
						<span
							className={`size-1.5 rounded-pill bg-current ${live.digest.state === "active" ? "motion-safe:animate-pulse" : ""}`}
							aria-hidden
						/>
						{t(`tab.live.stage.${live.digest.state}`)}
					</StatusChip>
				</div>
				<h2 className="text-pretty text-heading font-semibold leading-tight text-foreground @min-[880px]:hidden">
					{t(stage.headingKey)}
				</h2>
				<p className="text-pretty text-micro leading-relaxed text-faint @min-[880px]:hidden">{t(stage.subtitleKey)}</p>
			</header>

			<DetailSection title={t("tab.detail.section.flow")}>
				<ReaDiagramLiveCaption digest={live.digest} />
				<div className="mt-2 rounded-tile border border-border bg-background/50 p-2">
					<ReaWorkflowStageDiagram kind={stage.diagram} calls={live.calls} running={live.running} />
				</div>
			</DetailSection>

			<DetailSection title={t("tab.detail.section.bullets")}>
				<ReaStagePoints points={stage.points} calls={live.calls} running={live.running} doctor={doctor} />
			</DetailSection>

			<DetailSection title={t("tab.detail.section.automation")}>
				<p className="text-pretty text-micro leading-relaxed text-faint">
					{target === null ? t("tab.detail.agentDriven") : t("tab.detail.agentDrivenTarget", { target: t(getTarget(target).labelKey) })}
				</p>
				<ul className="mt-2 flex flex-col gap-1">
					{actions.map((action) => (
						<ReaAgentActionRow key={action.name} action={action} />
					))}
				</ul>
			</DetailSection>

			{stage.referencePath ? (
				<DetailSection title={t("tab.detail.section.reference")}>
					<code
						className="block truncate rounded-control border border-border bg-stone px-2 py-1 font-mono text-micro text-foreground/80"
						title={stage.referencePath}
					>
						{stage.referencePath}
					</code>
				</DetailSection>
			) : null}

			<DetailSection title={t("tab.detail.section.fallback")} last>
				<p className="rounded-tile border border-border-strong bg-apricot-light px-3 py-2 text-micro leading-relaxed text-ochre">
					{t(stage.fallbackKey)}
				</p>
			</DetailSection>
		</div>
	);
}

interface DetailSectionProps {
	readonly title: string;
	readonly children: ReactNode;
	readonly last?: boolean;
}

function DetailSection({ title, children, last = false }: DetailSectionProps): JSX.Element {
	return (
		<section className={`px-4 py-3 ${last ? "" : "border-b border-border"}`}>
			<Eyebrow className="mb-2 block">{title}</Eyebrow>
			{children}
		</section>
	);
}

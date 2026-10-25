/**
 * 单阶段详情：流程示意图 + 关键要点 + Agent 侧动作 + 关联 reference + 失败兜底。
 *
 * 这是卡片正文，不再自带外框 —— 外面由 `Panel` 提供圆角与边框，
 * 区块之间只用 1px 分隔线，避免「框中框」。
 *
 * 标题与副标题不在这里：左栏阶段列表与页头都已经说过「当前是哪个阶段」，
 * 第三遍只会把示意图往下推。这里只留机器可读的一行（目标 / 序号 / 调用数）与状态。
 *
 * 不提供「手动跑命令」：运行 REA CLI 与 Agent 侧自动调用 MCP 工具是同一件事的两种入口，
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
			<header className="flex min-w-0 items-center justify-between gap-2 border-b border-border-subtle px-4 py-2.5">
				<span className="min-w-0 truncate font-mono text-micro text-text-4">
					{t("tab.detail.microLabel", {
						target: target === null ? t("tab.detail.microNone") : t(getTarget(target).labelKey),
						index: String(stage.index).padStart(2, "0"),
						total: String(total).padStart(2, "0"),
						calls: live.digest.calls,
					})}
				</span>
				<StatusChip
					tone={live.digest.state === "active" ? "progress" : live.digest.state === "done" ? "success" : "neutral"}
					className="shrink-0"
				>
					<span
						className={`size-1.5 rounded-pill bg-current ${live.digest.state === "active" ? "motion-safe:animate-pulse" : ""}`}
						aria-hidden
					/>
					{t(`tab.live.stage.${live.digest.state}`)}
				</StatusChip>
			</header>

			<DetailSection title={t("tab.detail.section.flow")}>
				<ReaDiagramLiveCaption digest={live.digest} />
				<div className="mt-2 rounded-tile border border-border-subtle bg-surface-3/60 p-2">
					<ReaWorkflowStageDiagram kind={stage.diagram} calls={live.calls} running={live.running} />
				</div>
			</DetailSection>

			<DetailSection title={t("tab.detail.section.bullets")}>
				<ReaStagePoints points={stage.points} calls={live.calls} running={live.running} doctor={doctor} />
			</DetailSection>

			<DetailSection title={t("tab.detail.section.automation")}>
				<p className="text-pretty text-micro leading-relaxed text-text-3">
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
						className="block truncate rounded-md border border-border-subtle bg-surface-3 px-2 py-1 font-mono text-micro text-text-2"
						title={stage.referencePath}
					>
						{stage.referencePath}
					</code>
				</DetailSection>
			) : null}

			<DetailSection title={t("tab.detail.section.fallback")} last>
				<p className="rounded-md border border-risk-medium/40 bg-risk-medium/10 px-3 py-2 text-micro leading-relaxed text-risk-medium">
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
		<section className={`px-4 py-3 ${last ? "" : "border-b border-border-subtle"}`}>
			<span className="mb-2 block text-micro-up font-medium uppercase tracking-[0.08em] text-text-4">{title}</span>
			{children}
		</section>
	);
}

/**
 * 单阶段详情卡：标题 + 副标题 + 流程示意图 + 关键要点 + Agent 侧动作 + 关联 reference + 失败兜底。
 *
 * 容器：bg-card / border-border / rounded-[min(var(--radius-md),10px)]。
 * 段落标题：text-[10px] uppercase tracking-wider text-muted-foreground。
 *
 * 这里不提供「手动跑命令」：运行 REA CLI 与 Agent 侧自动调用 MCP 工具是同一件事的两种入口，
 * 并存只会让人分不清该点哪个。插件负责显示进度与所需工具，执行交给 Agent。
 */

import type { JSX } from "react";
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
		<div className="flex flex-col bg-card text-card-foreground">
			<header className="border-b border-border px-3 py-3 @min-[400px]:px-4">
				<div className="flex min-w-0 items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
					<span className="min-w-0 truncate font-mono text-[9.5px] tracking-[0.08em] text-foreground/70">
						{t("tab.detail.microLabel", {
							target: target === null ? t("tab.detail.microNone") : t(getTarget(target).labelKey),
							index: String(stage.index).padStart(2, "0"),
							calls: live.digest.calls,
						})}
					</span>
					<StatusChip
						tone={live.digest.state === "active" ? "progress" : live.digest.state === "done" ? "success" : "neutral"}
						className="normal-case tracking-normal"
					>
						<span
							className={`size-1.5 rounded-full bg-current ${live.digest.state === "active" ? "motion-safe:animate-pulse" : ""}`}
							aria-hidden
						/>
						{t(`tab.live.stage.${live.digest.state}`)}
					</StatusChip>
				</div>
				<h2 className="mt-1 text-pretty text-sm font-semibold leading-tight text-foreground">{t(stage.headingKey)}</h2>
				<p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">{t(stage.subtitleKey)}</p>
			</header>

			<section className="border-b border-border px-3 py-3 @min-[400px]:px-4">
				<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					{t("tab.detail.section.flow")}
				</h3>
				<ReaDiagramLiveCaption digest={live.digest} />
				<div className="rounded-[min(var(--radius-md),10px)] border border-border bg-background/40 p-2">
					<ReaWorkflowStageDiagram kind={stage.diagram} calls={live.calls} running={live.running} />
				</div>
			</section>

			<section className="border-b border-border px-3 py-3 @min-[400px]:px-4">
				<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					{t("tab.detail.section.bullets")}
				</h3>
				<ReaStagePoints points={stage.points} calls={live.calls} running={live.running} doctor={doctor} />
			</section>

			<section className="border-b border-border px-3 py-3 @min-[400px]:px-4">
				<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					{t("tab.detail.section.automation")}
				</h3>
				<p className="text-pretty text-[11px] leading-relaxed text-muted-foreground">
					{target === null ? t("tab.detail.agentDriven") : t("tab.detail.agentDrivenTarget", { target: t(getTarget(target).labelKey) })}
				</p>
				<ul className="mt-1.5 flex flex-col gap-1">
					{actions.map((action) => (
						<ReaAgentActionRow key={action.name} action={action} />
					))}
				</ul>
			</section>

			{stage.referencePath ? (
				<section className="border-b border-border px-3 py-3 @min-[400px]:px-4">
					<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
						{t("tab.detail.section.reference")}
					</h3>
					<code
						className="block truncate rounded-[min(var(--radius-md),8px)] border border-border bg-background/50 px-2 py-1 font-mono text-[11px] text-foreground/80"
						title={stage.referencePath}
					>
						{stage.referencePath}
					</code>
				</section>
			) : null}

			<section className="px-3 py-3 @min-[400px]:px-4">
				<h3 className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
					{t("tab.detail.section.fallback")}
				</h3>
				<p className="rounded-[min(var(--radius-md),10px)] border border-warning/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-700 dark:text-amber-400">
					{t(stage.fallbackKey)}
				</p>
			</section>
		</div>
	);
}

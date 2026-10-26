/**
 * 工作台分节：一屏内回答四个问题 —— 交给谁（目标）、走到哪（阶段）、
 * Agent 正在做什么（执行环）、刚刚做了什么（最近调用）。
 *
 * 版式沿用设计稿的 4 + 8 两列栅格：左列是「输入与去向」，右列是「状态与证据」。
 * 栅格只在面板够宽时生效（`@min-[1040px]`），窄面板自动叠成单列 ——
 * 320px 宽下任何两列布局都会把文字挤成竖条。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { StageDefinition } from "../data/stages";
import type { ReaLiveCall, ReaLiveState } from "../live/session-store";
import type { StageLiveDigest } from "../live/diagram-live";
import { STAGE_INDEX } from "../live/tool-taxonomy";
import type { DoctorStatus } from "../hooks/use-doctor-report";
import type { Workbench } from "../hooks/use-workbench";
import { Panel, PanelHeader } from "../../../shared/components/panel";
import { ReaWorkbench } from "./rea-workbench";
import { ReaWorkflowTargetRouting } from "./rea-workflow-target-routing";
import { ReaWorkflowStageDetail } from "./rea-workflow-stage-detail";
import { ReaWorkflowControls } from "./rea-workflow-controls";
import { ReaStageTrack } from "./rea-stage-track";
import { ReaLoopConsole } from "./rea-loop-console";
import { ReaLiveCallLog } from "./rea-live-call-log";
import { ReaPage, ReaPageHeader } from "./rea-app-shell";
import type { ReaSection } from "./rea-sections";

export interface WorkbenchPageProps {
	readonly active: boolean;
	readonly workbench: Workbench;
	readonly snapshot: ReaLiveState;
	readonly stage: StageDefinition;
	readonly currentStage: number;
	readonly calls: readonly ReaLiveCall[];
	readonly bypassed: readonly number[];
	readonly stageLive: { calls: readonly ReaLiveCall[]; running: readonly string[]; digest: StageLiveDigest };
	readonly doctor: DoctorStatus;
	readonly onSelectStage: (stage: number) => void;
	readonly onGoTo: (section: ReaSection) => void;
	readonly onUseTarget: (path: string) => void;
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }): JSX.Element {
	return (
		<div className="min-w-0 rounded-lg border border-border bg-surface-2 px-4 py-3">
			<div className="truncate text-micro-up uppercase tracking-wider text-text-4">{label}</div>
			<div className="mt-1 truncate text-display font-semibold tabular-nums text-text" title={value}>
				{value}
			</div>
			{hint === undefined ? null : <div className="mt-0.5 truncate text-micro text-text-3">{hint}</div>}
		</div>
	);
}

export function WorkbenchPage({
	active,
	workbench,
	snapshot,
	stage,
	currentStage,
	calls,
	bypassed,
	stageLive,
	doctor,
	onSelectStage,
	onGoTo,
	onUseTarget,
}: WorkbenchPageProps): JSX.Element {
	const { t } = useTranslation();
	const targetLabel =
		workbench.active === null ? t("ui.stat.targetNone") : t(`tab.target.${workbench.active}.label`);
	const stageIndex = (id: keyof typeof STAGE_INDEX): number => STAGE_INDEX[id];
	const lastTarget = snapshot.lastTargetPath;

	return (
		<ReaPage active={active}>
			<ReaPageHeader
				title={t("tab.workbench.title")}
				subtitle={t("tab.workbench.subtitle")}
				actions={
					<>
						<button
							type="button"
							onClick={() => onGoTo("guide")}
							className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-3 px-2.5 text-caption text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--book-open] size-3.5" />
							{t("ui.nav.guide")}
						</button>
						<button
							type="button"
							onClick={() => onGoTo("toolchain")}
							className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-surface-3 px-2.5 text-caption text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--wrench] size-3.5" />
							{t("ui.nav.toolchain")}
						</button>
					</>
				}
			/>

			<div className="grid grid-cols-2 gap-3 @min-[720px]:grid-cols-4">
				<StatCard label={t("ui.stat.target")} value={targetLabel} hint={lastTarget ?? t("ui.stat.targetHint")} />
				<StatCard label={t("ui.stat.stage")} value={`${currentStage} / 6`} hint={t(stage.labelKey)} />
				<StatCard label={t("ui.stat.calls")} value={String(snapshot.callCount)} hint={t("live.calls.count", { count: calls.length })} />
				<StatCard
					label={t("ui.stat.errors")}
					value={String(snapshot.errors.length)}
					hint={snapshot.errors.length === 0 ? t("ui.stat.errorsNone") : t("ui.stat.errorsSome")}
				/>
			</div>

			<ReaStageTrack
				currentStage={currentStage}
				onSelect={onSelectStage}
				completedStages={snapshot.visitedStages.map(stageIndex)}
				liveStage={snapshot.activeStage === null ? null : stageIndex(snapshot.activeStage)}
				bypassedStages={bypassed}
			/>

			<div className="grid min-w-0 grid-cols-1 gap-4 @min-[1040px]:grid-cols-12">
				<div className="flex min-w-0 flex-col gap-4 @min-[1040px]:col-span-4">
					<Panel>
						<PanelHeader title={t("ui.panel.compose")} hint={t("ui.panel.composeHint")} />
						<ReaWorkbench workbench={workbench} detected={snapshot.detectedTarget ?? snapshot.hintedTarget} />
					</Panel>

					<Panel>
						<PanelHeader
							title={t("ui.panel.targets")}
							hint={t("ui.panel.targetsHint")}
							actions={
								<button
									type="button"
									onClick={() => onGoTo("targets")}
									className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-micro text-text-3 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
								>
									{t("ui.action.details")}
									<span aria-hidden className="icon-[lucide--arrow-up-right] size-3" />
								</button>
							}
						/>
						<ReaWorkflowTargetRouting
							active={workbench.active}
							picked={workbench.picked}
							detected={snapshot.detectedTarget}
							onPick={workbench.pick}
							onClear={workbench.clearPick}
							onFollowDetected={workbench.clearPick}
						/>
					</Panel>

					<Panel>
						<PanelHeader title={t("ui.panel.shortcuts")} hint={t("ui.panel.shortcutsHint")} />
						<div className="flex flex-col divide-y divide-border-subtle">
							<button
								type="button"
								onClick={() => onGoTo("toolchain")}
								className="flex items-center justify-between gap-2 px-4 py-2.5 text-left text-caption text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							>
								<span className="flex items-center gap-2">
									<span aria-hidden className="icon-[lucide--wrench] size-3.5 text-text-3" />
									{t("tab.tools.title")}
								</span>
								<span aria-hidden className="icon-[lucide--chevron-right] size-3.5 text-text-4" />
							</button>
							<button
								type="button"
								onClick={() => onGoTo("engine")}
								className="flex items-center justify-between gap-2 px-4 py-2.5 text-left text-caption text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							>
								<span className="flex items-center gap-2">
									<span aria-hidden className="icon-[lucide--server] size-3.5 text-text-3" />
									{t("ui.nav.engine")}
								</span>
								<span aria-hidden className="icon-[lucide--chevron-right] size-3.5 text-text-4" />
							</button>
						</div>
					</Panel>
				</div>

				<div className="flex min-w-0 flex-col gap-4 @min-[1040px]:col-span-8">
					<Panel>
						<PanelHeader
							title={t("ui.panel.stage")}
							hint={t(stage.headingKey)}
							actions={<ReaWorkflowControls currentStage={currentStage} onChange={onSelectStage} />}
						/>
						<ReaWorkflowStageDetail
							stage={stage}
							total={6}
							live={stageLive}
							doctor={doctor}
							target={workbench.active ?? snapshot.detectedTarget}
						/>
					</Panel>

					<div className="grid min-w-0 grid-cols-1 gap-4 @min-[1280px]:grid-cols-2">
						<Panel>
							<ReaLoopConsole snapshot={snapshot} />
						</Panel>
						<Panel>
							<PanelHeader
								title={t("ui.panel.recentCalls")}
								badge={calls.length}
								actions={
									<button
										type="button"
										onClick={() => onGoTo("calls")}
										className="inline-flex h-6 items-center gap-1 rounded-sm px-1.5 text-micro text-text-3 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
									>
										{t("ui.action.all")}
										<span aria-hidden className="icon-[lucide--arrow-up-right] size-3" />
									</button>
								}
							/>
							<ReaLiveCallLog calls={calls.slice(-6)} errors={snapshot.errors} onSelectStage={onSelectStage} compact />
						</Panel>
					</div>

					{lastTarget === null ? null : (
						<button
							type="button"
							onClick={() => onUseTarget(lastTarget)}
							className="flex min-w-0 items-center gap-2 rounded-lg border border-border-subtle bg-surface-2 px-4 py-2.5 text-left transition-colors hover:border-purple/40 hover:bg-purple/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
						>
							<span aria-hidden className="icon-[lucide--file-search] size-3.5 shrink-0 text-text-3" />
							<span className="min-w-0 flex-1 truncate font-mono text-micro text-text-2">{lastTarget}</span>
							<span className="shrink-0 text-micro text-text-4">{t("ui.action.useTarget")}</span>
						</button>
					)}
				</div>
			</div>
		</ReaPage>
	);
}

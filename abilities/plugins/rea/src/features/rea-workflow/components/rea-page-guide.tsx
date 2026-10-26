/**
 * 阶段指引分节：左侧六个阶段（一次点开一个），右侧是该阶段的完整手册 ——
 * 流程图、要点、Agent 侧动作、参考文件、失败回退。
 *
 * 与工作台页的分工：工作台只给「当前阶段」的摘要与实时信号；这里允许横向翻阅
 * 任意阶段，并且带真实示例提示词（ReaUsageExamples），因为它就是「读手册」的地方。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { StageDefinition } from "../data/stages";
import { STAGES } from "../data/stages";
import type { ReaLiveCall } from "../live/session-store";
import type { StageLiveDigest } from "../live/diagram-live";
import type { DoctorStatus } from "../hooks/use-doctor-report";
import type { TargetKind } from "../data/targets";
import { Panel, PanelHeader } from "../../../shared/components/panel";
import { ReaPage, ReaPageHeader } from "./rea-app-shell";
import { ReaWorkflowStageDetail } from "./rea-workflow-stage-detail";
import { ReaWorkflowControls } from "./rea-workflow-controls";
import { ReaUsageExamples } from "./rea-usage-examples";

interface GuidePageProps {
	readonly active: boolean;
	readonly currentStage: number;
	readonly onSelectStage: (stage: number) => void;
	readonly stage: StageDefinition;
	readonly stageLive: { calls: readonly ReaLiveCall[]; running: readonly string[]; digest: StageLiveDigest };
	readonly doctor: DoctorStatus;
	readonly target: TargetKind | null;
	readonly targetPath: string | null;
}

export function GuidePage({
	active,
	currentStage,
	onSelectStage,
	stage,
	stageLive,
	doctor,
	target,
	targetPath,
}: GuidePageProps): JSX.Element {
	const { t } = useTranslation();
	const [examplesOpen, setExamplesOpen] = useState(false);

	return (
		<ReaPage active={active}>
			<ReaPageHeader title={t("ui.page.guide.title")} subtitle={t("ui.page.guide.subtitle")} />

			{/* 填满主区高度：底部不再留一大块空白，内部各自滚动。 */}
			<div className="grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-4 @min-[880px]:grid-cols-[14rem_minmax(0,1fr)]">
				{/* 列表只有六行，不撑满高度：拉伸后卡片下半截是空的，看起来像内容没加载。
				    max-h-full 保证行很短时才生效，内容长时仍然在图内滚动。 */}
				<Panel className="min-h-0 max-h-full self-start">
					<PanelHeader title={t("ui.nav.guide")} badge={STAGES.length} />
					<nav className="flex min-h-0 flex-col divide-y divide-border-subtle overflow-y-auto overscroll-contain">
						{STAGES.map((item) => {
							const isCurrent = item.index === currentStage;
							return (
								<button
									key={item.index}
									type="button"
									onClick={() => onSelectStage(item.index)}
									aria-current={isCurrent ? "step" : undefined}
									className={`flex items-center gap-2.5 px-4 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 ${
										isCurrent ? "bg-surface-active" : "hover:bg-surface-hover"
									}`}
								>
									<span
										aria-hidden
										className={`flex size-4 shrink-0 items-center justify-center rounded-full text-micro-up font-medium ${
											isCurrent
												? "border border-purple bg-purple/10 text-purple-ink"
												: "border border-border-subtle text-text-4"
										}`}
									>
										{item.index}
									</span>
									<span className="min-w-0 flex-1">
										<span className={`block truncate text-caption ${isCurrent ? "font-medium text-text" : "text-text-2"}`}>
											{t(item.labelKey)}
										</span>
										<span className="block truncate text-micro-up text-text-4">{t(item.headingKey)}</span>
									</span>
								</button>
							);
						})}
					</nav>
				</Panel>

				<div className="flex min-h-0 min-w-0 flex-col gap-4">
					<Panel className="min-h-0 flex-1">
						<PanelHeader
							title={t(stage.headingKey)}
							hint={t(stage.subtitleKey)}
							actions={
								<button
									type="button"
									onClick={() => setExamplesOpen((prev) => !prev)}
									aria-expanded={examplesOpen}
									className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-surface-3 px-2 text-micro text-text-2 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
								>
									<span aria-hidden className="icon-[lucide--sparkles] size-3" />
									{t("tab.examples.button")}
								</button>
							}
						/>
						<div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
							<ReaWorkflowStageDetail
								stage={stage}
								total={STAGES.length}
								live={stageLive}
								doctor={doctor}
								target={target}
							/>
							{examplesOpen ? (
								<div className="border-t border-border-subtle px-4 py-3">
									<ReaUsageExamples
										target={targetPath ?? ""}
										targetKind={target}
										onClose={() => setExamplesOpen(false)}
									/>
								</div>
							) : null}
						</div>
						<div className="border-t border-border-subtle px-4 py-2">
							<ReaWorkflowControls currentStage={currentStage} onChange={onSelectStage} />
						</div>
					</Panel>
				</div>
			</div>
		</ReaPage>
	);
}

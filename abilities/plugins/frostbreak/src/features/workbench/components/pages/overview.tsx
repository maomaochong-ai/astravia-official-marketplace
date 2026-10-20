import { useTranslation } from "@astravia-org/plugin-sdk";
import type { WorkbenchModel } from "../../hooks/use-workbench";
import { AiButton } from "../shell/ai-button";
import { Card } from "../shell/card";
import { Icon } from "../shell/icon";
import { PageHeader } from "../shell/page-header";
import { BlockedPanel } from "../workbench/blocked-panel";
import { FindingList } from "../workbench/finding-list";
import { RiskScore } from "../workbench/risk-score";
import { SampleDropzone } from "../workbench/sample-dropzone";
import { SampleMeta } from "../workbench/sample-meta";

export interface PageProps {
	model: WorkbenchModel;
}

const STEPS = ["step.pick", "step.run", "step.read", "step.ask"] as const;

/** 工作台：样本 → 分数 → 发现 → 下一步。没有样本时就是引导页。 */
export function OverviewPage({ model }: PageProps) {
	const { t } = useTranslation();
	const { report, phase, error, chat } = model;
	const busy = chat.sending || phase === "loading";

	return (
		<>
			<PageHeader
				title={t("page.overview.title")}
				description={t("page.overview.lead")}
				actions={<AiButton label={t("ai.summary")} onClick={() => model.ask("findings-summary")} busy={busy} disabled={!report} />}
			/>
			<div className="space-y-3 p-4">
				{error ? <BlockedPanel failure={error} root={model.cwd} busy={busy} onHandOff={model.handOff} onClear={model.reset} /> : null}

				<SampleDropzone report={report} busy={phase === "loading"} fromAgent={model.fromAgent} onClear={model.reset} onReanalyse={model.reanalyse} />

				{report ? (
					<div className="grid gap-3 @min-[900px]:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
						<div className="space-y-3">
							<Card title={t("page.overview.risk")}>
								<RiskScore report={report} busy={busy} onAsk={() => model.ask("finding")} />
							</Card>
							<Card
								title={t("page.overview.findings")}
								actions={
									<button type="button" onClick={() => model.go("findings")} className="flex items-center gap-0.5 rounded px-1 py-0.5 text-[10.5px] text-text-3 hover:bg-surface-hover hover:text-text">
										{t("page.overview.allFindings")}
										<Icon name="chevron" className="size-3" />
									</button>
								}
							>
								<FindingList findings={report.findings.slice(0, 4)} busy={busy} onAsk={finding => model.ask("finding", { ruleId: finding.ruleId })} />
							</Card>
						</div>
						<div className="space-y-3">
							<Card title={t("page.overview.meta")}>
								<SampleMeta report={report} />
							</Card>
							<Card title={t("page.overview.next")} bodyClassName="divide-y divide-line-subtle">
								<NextStep label={t("ai.harden")} hint={t("page.overview.next.harden")} onClick={() => model.ask("harden")} busy={busy} />
								<NextStep label={t("ai.toolchain")} hint={t("page.overview.next.toolchain")} onClick={() => model.ask("toolchain")} busy={busy} />
								<NextStep label={t("ai.report")} hint={t("page.overview.next.report")} onClick={() => model.ask("report")} busy={busy} />
							</Card>
						</div>
					</div>
				) : (
					<Card title={t("page.overview.start")} bodyClassName="p-3.5">
						<ol className="space-y-2">
							{STEPS.map((step, index) => (
								<li key={step} className="flex items-start gap-2.5">
									<span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-surface-4 font-mono text-[10px] text-text-2">{index + 1}</span>
									<div className="min-w-0">
										<div className="text-[12px] font-medium text-text">{t(`guide.${step}.title`)}</div>
										<div className="text-[10.5px] leading-relaxed text-text-4">{t(`guide.${step}.body`)}</div>
									</div>
								</li>
							))}
						</ol>
					</Card>
				)}
			</div>
		</>
	);
}

interface NextStepProps {
	label: string;
	hint: string;
	busy: boolean;
	onClick(): void;
}

function NextStep({ label, hint, busy, onClick }: NextStepProps) {
	return (
		<div className="flex items-start gap-2 px-3.5 py-2.5">
			<div className="min-w-0 flex-1">
				<div className="text-[12px] text-text">{label}</div>
				<div className="mt-0.5 text-[10.5px] leading-relaxed text-text-4">{hint}</div>
			</div>
			<AiButton label={label} onClick={onClick} busy={busy} compact />
		</div>
	);
}

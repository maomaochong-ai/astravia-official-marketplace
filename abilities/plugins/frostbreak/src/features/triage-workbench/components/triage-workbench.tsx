import { useTranslation } from "@astravia-org/plugin-sdk";
import { useEffect, useState } from "react";
import type { Severity } from "../../../domain/audit/rules";
import { SEVERITY_ORDER } from "../../../domain/audit/rules";
import { renderMarkdown } from "../../../domain/report/report";
import type { TriageBridge } from "../bridge";
import type { SampleFailure } from "../sample-error";
import { describeSampleFailure, isHandoffFailure } from "../sample-error";
import { useTriageWorkbench } from "../hooks/use-triage-workbench";
import { BlockedPanel } from "./blocked-panel";
import { FindingList } from "./finding-list";
import { PanelHeader } from "./panel-header";
import { ReportFacts } from "./report-facts";
import { ReportHeader } from "./report-header";
import { ReportNextSteps } from "./report-next-steps";
import { ReportSections } from "./report-sections";
import { RiskMeter } from "./risk-meter";
import { SampleRail } from "./sample-rail";
import { WorkbenchIntro } from "./workbench-intro";

export interface TriageWorkbenchProps {
	bridge: TriageBridge;
	cwd: string | null;
}

const FILTER_BUTTON = "rounded px-1.5 py-0.5 text-[10.5px] font-medium transition-colors";

export function TriageWorkbench({ bridge, cwd }: TriageWorkbenchProps) {
	const { t } = useTranslation();
	const model = useTriageWorkbench(bridge, cwd);
	const [filter, setFilter] = useState<Severity | "all">("all");
	/** 首屏即说明页；一旦开始分析就让位给结果，但随时能从头部切回来。 */
	const [guideOpen, setGuideOpen] = useState(true);
	const busy = model.phase === "loading";

	useEffect(() => {
		if (model.phase !== "idle") setGuideOpen(false);
	}, [model.phase]);

	const pickPrompt = (prompt: string) => {
		navigator.clipboard?.writeText(prompt).then(
			() => bridge.notify(t("panel.intro.prompts.copied"), "success"),
			() => bridge.notify(t("panel.intro.prompts.copyFailed"), "error"),
		);
	};

	const copyMarkdown = () => {
		if (!model.report) return;
		const markdown = renderMarkdown(model.report, { mode: model.mode });
		navigator.clipboard?.writeText(markdown).then(
			() => bridge.notify(t("panel.action.copied"), "success"),
			() => bridge.notify(t("panel.action.copyFailed"), "error"),
		);
	};

	const exportReport = (format: "markdown" | "json") => {
		model
			.exportReport(format)
			.then(saved => {
				if (saved) bridge.notify(t("panel.action.saved", { path: saved }), "success");
				else bridge.notify(t("panel.action.exportCancelled"), "info");
			})
			.catch((failure: unknown) => {
				bridge.notify(t("panel.action.exportFailed", { message: failure instanceof Error ? failure.message : String(failure) }), "error");
			});
	};

	/** 引擎读不到的样本：把「为什么」和「接着查什么」一并交给对话里的 Agent。 */
	const handOff = (failure: SampleFailure) => {
		if (!cwd) {
			bridge.notify(t("panel.blocked.noWorkspace"), "warning");
			return;
		}
		const reason = t(failure.kind === "too-large" ? "panel.blocked.reason.tooLarge" : "panel.blocked.reason.outside");
		model
			.handOff(t("panel.handoff.prompt", { path: failure.detail, reason }))
			.then(outcome => {
				if (!outcome) {
					bridge.notify(t("panel.blocked.handoffFailed", { message: failure.detail }), "error");
					return;
				}
				bridge.notify(t(outcome === "sent" ? "panel.blocked.handoffSent" : "panel.blocked.handoffOpened"), "success");
			});
	};

	const copyPath = (path: string) => {
		navigator.clipboard?.writeText(path).then(
			() => bridge.notify(t("panel.blocked.pathCopied"), "success"),
			() => bridge.notify(t("panel.blocked.pathCopyFailed"), "error"),
		);
	};

	const findings = model.report
		? filter === "all"
			? model.report.findings
			: model.report.findings.filter(finding => finding.severity === filter)
		: [];

	return (
		<div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background text-foreground">
			<PanelHeader guideOpen={guideOpen} onToggleGuide={() => setGuideOpen(open => !open)} />

			<div className="flex min-h-0 flex-1 overflow-hidden">
				<SampleRail
					cwd={cwd}
					files={model.files}
					loading={model.filesLoading}
					selectedPath={model.selectedPath}
					busy={busy}
					onRefresh={model.refreshFiles}
					onAnalyse={model.analyse}
				/>

				<main className="flex min-w-0 flex-1 flex-col">
					{guideOpen ? <WorkbenchIntro hasWorkspace={Boolean(cwd)} onPickPrompt={pickPrompt} /> : null}

					{!guideOpen && model.phase === "idle" ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-1 px-8 text-center">
							<p className="text-[12.5px] font-medium text-foreground/70">{t("panel.empty.title")}</p>
							<p className="max-w-[380px] text-[11px] leading-relaxed text-foreground/40">{t("panel.rail.hint")}</p>
						</div>
					) : null}

					{!guideOpen && model.phase === "loading" ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-2 text-foreground/50">
							<span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/70" />
							<p className="text-[11.5px]">{t("panel.loading", { path: model.selectedPath ?? "" })}</p>
						</div>
					) : null}

					{!guideOpen && model.phase === "error" && model.error && isHandoffFailure(model.error.kind) ? (
						<div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
							<BlockedPanel
								failure={model.error}
								root={cwd}
								hasWorkspace={Boolean(cwd)}
								busy={busy}
								onHandOff={() => handOff(model.error!)}
								onCopyPath={() => copyPath(model.error!.detail)}
							/>
						</div>
					) : null}

					{!guideOpen && model.phase === "error" && (!model.error || !isHandoffFailure(model.error.kind)) ? (
						<div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
							<p className="text-[12.5px] font-medium text-foreground/80">{t("panel.error.title")}</p>
							<p className="max-w-[420px] break-words rounded-md border border-red-500/25 bg-red-500/[0.06] px-2.5 py-1.5 text-[11px] leading-relaxed text-red-600 dark:text-red-400">
								{model.error ? describeSampleFailure(model.error, t, cwd) : ""}
							</p>
							<p className="max-w-[420px] text-[10.5px] leading-relaxed text-foreground/40">{t("panel.error.hint")}</p>
							{model.selectedPath ? (
								<button
									type="button"
									onClick={() => model.analyse(model.selectedPath!)}
									className="mt-1 rounded border border-black/10 px-2 py-1 text-[11px] text-foreground/70 hover:bg-foreground/[0.06] dark:border-white/10"
								>
									{t("panel.error.retry")}
								</button>
							) : null}
						</div>
					) : null}

					{!guideOpen && model.phase === "ready" && model.report ? (
						<div className="flex min-h-0 flex-1 flex-col">
							<div className="px-3 pt-2.5">
								<ReportHeader
									report={model.report}
									mode={model.mode}
									onModeChange={model.selectMode}
									onCopy={copyMarkdown}
									onExport={exportReport}
									onReset={model.reset}
								/>
							</div>
							<div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-2.5">
								<RiskMeter risk={model.report.risk} findingCount={model.report.findings.length} />

								{model.report.summary.length > 0 ? (
									<section className="space-y-1">
										<h3 className="text-[11px] font-semibold uppercase tracking-wide text-foreground/50">{t("panel.summary.title")}</h3>
										<ul className="space-y-1">
											{model.report.summary.map(line => (
												<li key={line} className="flex items-start gap-1.5 text-[11.5px] leading-relaxed text-foreground/75">
													<span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-foreground/30" />
													<span className="min-w-0">{line}</span>
												</li>
											))}
										</ul>
									</section>
								) : null}

								<section className="space-y-1.5">
									<div className="flex items-center gap-1">
										<h3 className="min-w-0 flex-1 text-[11px] font-semibold uppercase tracking-wide text-foreground/50">
											{t("panel.findings.title")}
										</h3>
										<div className="flex shrink-0 items-center gap-0.5">
											<button
												type="button"
												onClick={() => setFilter("all")}
												className={`${FILTER_BUTTON} ${filter === "all" ? "bg-foreground/10 text-foreground" : "text-foreground/45 hover:text-foreground"}`}
											>
												{t("panel.findings.filter.all", { count: model.report.findings.length })}
											</button>
											{SEVERITY_ORDER.map(severity => {
												const count = model.report!.findings.filter(finding => finding.severity === severity).length;
												if (count === 0) return null;
												return (
													<button
														key={severity}
														type="button"
														onClick={() => setFilter(severity)}
														className={`${FILTER_BUTTON} ${filter === severity ? "bg-foreground/10 text-foreground" : "text-foreground/45 hover:text-foreground"}`}
													>
														{t(`severity.${severity}`)} {count}
													</button>
												);
											})}
										</div>
									</div>
									<FindingList findings={findings} />
								</section>

								<ReportFacts facts={model.report.facts} />
								<ReportSections sections={model.mode === "summary" ? model.report.sections.slice(0, 4) : model.report.sections} />

								{model.report.limits.length > 0 ? (
									<section className="space-y-1 rounded-md bg-foreground/[0.03] p-2.5">
										<h3 className="text-[10.5px] font-semibold uppercase tracking-wide text-foreground/45">{t("panel.limits.title")}</h3>
										<ul className="space-y-0.5">
											{model.report.limits.map(line => (
												<li key={line} className="text-[10.5px] leading-relaxed text-foreground/45">
													{line}
												</li>
											))}
										</ul>
									</section>
								) : null}

								<ReportNextSteps sampleName={model.report.target.name} onPick={pickPrompt} />
							</div>
						</div>
					) : null}
				</main>
			</div>
		</div>
	);
}

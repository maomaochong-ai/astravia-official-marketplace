import { useTranslation } from "@astravia-org/plugin-sdk";
import { useState } from "react";
import type { Severity } from "../../../domain/audit/rules";
import { SEVERITY_ORDER } from "../../../domain/audit/rules";
import { renderMarkdown } from "../../../domain/report/report";
import type { TriageBridge } from "../bridge";
import { sampleErrorText } from "../sample-error";
import { useTriageWorkbench } from "../hooks/use-triage-workbench";
import { FindingList } from "./finding-list";
import { ReportFacts } from "./report-facts";
import { ReportHeader } from "./report-header";
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
	const busy = model.phase === "loading";

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

	const findings = model.report
		? filter === "all"
			? model.report.findings
			: model.report.findings.filter(finding => finding.severity === filter)
		: [];

	return (
		<div className="flex h-full min-h-0 w-full overflow-hidden bg-background text-foreground">
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
				{model.phase === "idle" ? (
					<WorkbenchIntro hasWorkspace={Boolean(cwd)} onPickPrompt={pickPrompt} />
				) : null}

				{model.phase === "loading" ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 text-foreground/50">
						<span className="h-4 w-4 animate-spin rounded-full border-2 border-foreground/20 border-t-foreground/70" />
						<p className="text-[11.5px]">{t("panel.loading", { path: model.selectedPath ?? "" })}</p>
					</div>
				) : null}

				{model.phase === "error" ? (
					<div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
						<p className="text-[12.5px] font-medium text-foreground/80">{t("panel.error.title")}</p>
						<p className="max-w-[420px] break-words rounded-md border border-red-500/25 bg-red-500/[0.06] px-2.5 py-1.5 text-[11px] leading-relaxed text-red-600 dark:text-red-400">
							{sampleErrorText(model.error ?? "", t)}
						</p>
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

				{model.phase === "ready" && model.report ? (
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
						</div>
					</div>
				) : null}
			</main>
		</div>
	);
}

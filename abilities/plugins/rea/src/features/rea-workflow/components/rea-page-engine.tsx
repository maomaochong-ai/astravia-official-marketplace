/**
 * 引擎分节：REA CLI provider 的真实状态、最近输出、doctor 逐项结果。
 *
 * 这里能回答「为什么整个面板都不动」：常见原因只有三种 —— provider 没装、
 * 版本过期、宿主没给命令权限。三种各自有不同的修法，所以分别显示，
 * 不合并成一句「初始化失败」。
 */

import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { DoctorCheck } from "../live/doctor-readiness";
import type { DoctorSummary } from "../live/doctor-summary";
import type { DoctorStatus } from "../hooks/use-doctor-report";
import { providerLabelKey, providerTone, type ProviderStatusState } from "../hooks/use-provider-status";
import { Panel, PanelHeader } from "../../../shared/components/panel";
import { StatusChip } from "../../../shared/components/status-chip";
import { StatusDot } from "../../../shared/components/status-dot";
import { ReaPage, ReaPageHeader } from "./rea-app-shell";
import { ReaDoctorChecks } from "./rea-doctor-checks";
import { ReaErrorExplainer, tryParseReaError } from "./rea-error-explainer";
import { ReaEngineIdentity } from "./rea-engine-identity";

interface EnginePageProps {
	readonly active: boolean;
	readonly provider: ProviderStatusState;
	readonly checks: readonly DoctorCheck[];
	readonly summary: DoctorSummary | null;
	readonly doctorStatus: DoctorStatus;
	readonly doctorMessage: string | null;
	readonly lastRunAt: number | null;
	readonly onRecheck: () => void;
	readonly onAskAgent: () => void;
	readonly rechecking: boolean;
	readonly askingAgent: boolean;
	readonly blocked: boolean;
}

const DOT_TONE: Record<"success" | "warning" | "danger" | "progress" | "neutral", "success" | "warning" | "danger" | "primary" | "idle"> = {
	success: "success",
	warning: "warning",
	danger: "danger",
	progress: "primary",
	neutral: "idle",
};

export function EnginePage({
	active,
	provider,
	checks,
	summary,
	doctorStatus,
	doctorMessage,
	lastRunAt,
	onRecheck,
	onAskAgent,
	rechecking,
	askingAgent,
	blocked,
}: EnginePageProps): JSX.Element {
	const { t } = useTranslation();
	const [showLog, setShowLog] = useState(false);
	const tone = providerTone(provider.phase);
	const recentLines = (provider.status?.recentOutput ?? "")
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.slice(-40);
	const parsedError = tryParseReaError(provider.status?.recentOutput);

	return (
		<ReaPage active={active}>
			<ReaPageHeader title={t("ui.page.engine.title")} subtitle={t("ui.page.engine.subtitle")} />

			<Panel>
				<PanelHeader
					title={t("setup.title")}
					hint={provider.status?.message ?? t("setup.subtitle")}
					actions={
						<>
							<StatusChip tone={tone}>{t(providerLabelKey(provider.phase))}</StatusChip>
							<button
								type="button"
								onClick={provider.retry}
								disabled={provider.busy}
								className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-surface-3 px-2 text-micro text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							>
								<span aria-hidden className={`icon-[lucide--refresh-cw] size-3 ${provider.busy ? "motion-safe:animate-spin" : ""}`} />
								{t("setup.action.retry")}
							</button>
						</>
					}
				/>

				<div className="flex flex-col gap-2 px-4 py-3">
					<div className="flex min-w-0 items-center gap-2">
						<StatusDot tone={DOT_TONE[tone]} pulse={provider.busy} />
						<span className="min-w-0 flex-1 truncate text-micro text-text-3">
							{provider.status === null ? t("ui.engine.waiting") : (provider.status.message ?? t("setup.subtitle"))}
						</span>
						{recentLines.length === 0 ? null : (
							<button
								type="button"
								onClick={() => setShowLog((prev) => !prev)}
								aria-expanded={showLog}
								className="inline-flex h-6 shrink-0 items-center gap-1 rounded-sm px-1.5 text-micro text-text-3 transition-colors hover:bg-surface-hover hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
							>
								<span aria-hidden className={`icon-[lucide--chevron-down] size-3 transition-transform ${showLog ? "rotate-180" : ""}`} />
								{t("setup.log.toggle", { count: recentLines.length })}
							</button>
						)}
					</div>

					{parsedError === null ? null : <ReaErrorExplainer error={parsedError} />}

					{provider.phase === "failed" ? (
						<div className="rounded-md border border-risk-medium/40 bg-risk-medium/10 px-2.5 py-1.5 text-micro leading-relaxed text-risk-medium">
							<span className="font-medium">{t("setup.failed.hintTitle")}</span>{" "}
							<code className="font-mono text-micro-up">npx rea-agents doctor --json</code>
						</div>
					) : null}

					{showLog && recentLines.length > 0 ? (
						<pre className="max-h-56 overflow-auto rounded-md border border-border bg-surface-3 px-2.5 py-2 font-mono text-micro-up leading-relaxed text-text-2">
							{recentLines.join("\n")}
						</pre>
					) : null}
				</div>
			</Panel>

			<ReaEngineIdentity summary={summary} onAskAgent={onAskAgent} askingAgent={askingAgent} />

			<ReaDoctorChecks
				checks={checks}
				status={doctorStatus}
				message={doctorMessage}
				lastRunAt={lastRunAt}
				onRecheck={onRecheck}
				rechecking={rechecking}
			/>

			{blocked ? (
				<Panel>
					<PanelHeader title={t("ui.engine.boundary")} />
					<p className="px-4 py-3 text-pretty text-micro leading-relaxed text-text-3">{t("tab.tools.blockedHint")}</p>
				</Panel>
			) : null}
		</ReaPage>
	);
}

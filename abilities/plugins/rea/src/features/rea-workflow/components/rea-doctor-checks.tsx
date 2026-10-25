/**
 * doctor 检查清单：`rea-agents doctor --json` 的逐项结果。
 *
 * 只显示命令真的返回过的东西：每行 = 一项检查 + 通过与否 + 原始 detail。
 * doctor 没跑过时明确写「还没跑」，不用「未确认」冒充失败 —— 两者含义不同，
 * 混在一起会让人去修一个并不存在的问题。
 */

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { DoctorStatus } from "../hooks/use-doctor-report";
import type { DoctorCheck } from "../live/doctor-readiness";
import { Panel, PanelHeader } from "../../../shared/components/panel";

interface DoctorChecksProps {
	readonly checks: readonly DoctorCheck[];
	readonly status: DoctorStatus;
	readonly message: string | null;
	readonly lastRunAt: number | null;
	readonly onRecheck: () => void;
	readonly rechecking: boolean;
}

export function ReaDoctorChecks({
	checks,
	status,
	message,
	lastRunAt,
	onRecheck,
	rechecking,
}: DoctorChecksProps): JSX.Element {
	const { t } = useTranslation();
	const passed = checks.filter((check) => check.ok).length;

	return (
		<Panel>
			<PanelHeader
				title={t("ui.engine.checks")}
				badge={checks.length === 0 ? undefined : `${passed}/${checks.length}`}
				hint={lastRunAt === null ? t("ui.engine.neverRun") : t("ui.engine.lastRun", { time: new Date(lastRunAt).toLocaleTimeString() })}
				actions={
					<button
						type="button"
						onClick={onRecheck}
						disabled={rechecking}
						className="inline-flex h-6 items-center gap-1 rounded-sm border border-border bg-surface-3 px-2 text-micro text-text-2 transition-colors hover:bg-surface-hover hover:text-text disabled:opacity-45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
					>
						<span aria-hidden className={`icon-[lucide--refresh-cw] size-3 ${rechecking ? "motion-safe:animate-spin" : ""}`} />
						{t("tab.tools.recheck")}
					</button>
				}
			/>

			{status === "failed" && message !== null ? (
				<div className="border-b border-border-subtle bg-risk-high/10 px-4 py-2 text-micro text-risk-high">{message}</div>
			) : null}

			{checks.length === 0 ? (
				<p className="px-4 py-3 text-micro text-text-4">{t("ui.engine.noChecks")}</p>
			) : (
				<ul className="flex flex-col divide-y divide-border-subtle">
					{checks.map((check) => (
						<li key={check.name} className="flex min-w-0 items-start gap-2.5 px-4 py-2">
							<span
								aria-hidden
								className={`mt-0.5 size-1.5 shrink-0 rounded-full ${check.ok ? "bg-risk-low" : "bg-risk-high"}`}
							/>
							<div className="min-w-0 flex-1">
								<div className="flex min-w-0 items-center gap-2">
									<span className="truncate font-mono text-micro text-text">{check.name}</span>
									<span className={`shrink-0 text-micro-up ${check.ok ? "text-risk-low" : "text-risk-high"}`}>
										{check.ok ? t("ui.engine.pass") : t("ui.engine.fail")}
									</span>
								</div>
								{check.detail === undefined ? null : (
									<p className="break-words text-micro-up leading-relaxed text-text-3">{check.detail}</p>
								)}
								{!check.ok && check.remediation !== undefined ? (
									<p className="break-words text-micro-up leading-relaxed text-text-4">{check.remediation}</p>
								) : null}
							</div>
						</li>
					))}
				</ul>
			)}
		</Panel>
	);
}

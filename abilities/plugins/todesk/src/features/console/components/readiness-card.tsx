import type { ReactNode } from "react";
import { StatusPill } from "../../../shared/components/status-pill";
import type { ReadinessReport } from "../../../domain/remote-readiness";

/**
 * The "before you leave / why can't they get in" block: a verdict first, then one line
 * per gap. It exists because the four facts it summarises live in four places, and a
 * person about to walk out of the office should not have to join them by hand.
 *
 * Verdict colour is the only colour on the panel; each item keeps the same shape so the
 * list reads as a checklist rather than as four unrelated warnings.
 */
export function ReadinessCard({
	report,
	busy,
	onRefresh,
	t,
}: {
	report: ReadinessReport | null;
	busy: boolean;
	onRefresh: () => void;
	t: (key: string, params?: Record<string, string | number>) => string;
}): ReactNode {
	if (!report) return null;

	const tone = report.verdict === "ready" ? "ok" : report.verdict === "degraded" ? "warn" : "bad";

	return (
		<section className="td-panel px-4 py-3.5" aria-live="polite">
			<div className="flex items-center justify-between gap-2">
				<div className="flex items-center gap-2">
					<h2 className="td-title">{t("readiness.title")}</h2>
					<StatusPill tone={tone} label={t(`readiness.verdict.${report.verdict}`)} />
				</div>
				<button type="button" className="td-btn" data-tone="ghost" onClick={onRefresh} disabled={busy}>
					{t("readiness.refresh")}
				</button>
			</div>

			<p className="td-meta mt-1.5">{t(`readiness.summary.${report.verdict}`, { count: report.items.length })}</p>

			<ul className="mt-2 flex flex-col gap-1.5">
				{report.items.map((item) => (
					<li key={item.code} className="flex items-start gap-2">
						<span className="td-dot mt-[5px]" data-tone={item.state === "ok" ? "ok" : item.state === "warn" ? "warn" : "bad"} aria-hidden />
						<span className="min-w-0 text-[12px] leading-relaxed">{t(`readiness.item.${item.code}`)}</span>
					</li>
				))}
			</ul>
		</section>
	);
}

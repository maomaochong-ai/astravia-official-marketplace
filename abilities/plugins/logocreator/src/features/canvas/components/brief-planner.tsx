import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { planFromBrief, type PlanCandidate } from "../../../domain/planner";
import { BUTTON_PRIMARY, FOCUS_RING, INPUT, SECTION_LABEL } from "../../../shared/styles/tokens";

export interface BriefPlannerProps {
	/** The engine adds the planned designs to history; this is the panel's bridge. */
	onPlan: (candidates: PlanCandidate[]) => Promise<void>;
}

/**
 * "Start from a sentence" — the offline path.
 *
 * There is no image model behind this. The brief is parsed locally into three
 * concrete specs (structure, style, palette, seed) and the engine draws them, which
 * is the same division of labour the host's design plugin uses at a larger scale:
 * the model picks fields, a local renderer draws. So the panel is never a dead
 * surface on a text-only session.
 */
export function BriefPlanner({ onPlan }: BriefPlannerProps): JSX.Element {
	const { t } = useTranslation();
	const [brief, setBrief] = useState("");
	const [busy, setBusy] = useState(false);
	const [planned, setPlanned] = useState<PlanCandidate[]>([]);

	const run = async () => {
		const text = brief.trim();
		if (!text) return;
		setBusy(true);
		try {
			const candidates = planFromBrief(text);
			setPlanned(candidates);
			await onPlan(candidates);
		} finally {
			setBusy(false);
		}
	};

	return (
		<section className="space-y-1.5">
			<span className={SECTION_LABEL}>{t("brief.title")}</span>
			<textarea
				rows={2}
				value={brief}
				onChange={(event) => setBrief(event.target.value)}
				placeholder={t("brief.placeholder")}
				aria-label={t("brief.title")}
				className={`${INPUT} h-auto resize-none py-1.5 text-[12px] leading-relaxed`}
			/>
			<div className="flex items-center gap-1.5">
				<button
					type="button"
					onClick={() => void run()}
					disabled={busy || !brief.trim()}
					className={`${BUTTON_PRIMARY} ${FOCUS_RING} h-8 px-2.5 text-[12px]`}
				>
					{busy ? t("action.working") : t("brief.action")}
				</button>
				<span className="min-w-0 flex-1 text-[10px] leading-snug text-muted-foreground">{t("brief.hint")}</span>
			</div>
			{planned.length > 0 ? (
				<ul className="space-y-1">
					{planned.map((candidate) => (
						<li key={candidate.spec.seed} className="rounded-md bg-muted/50 px-2 py-1 text-[10.5px] leading-snug">
							<span className="font-medium text-foreground">
								{candidate.type} · {candidate.style}
							</span>
							<span className="text-muted-foreground"> — {candidate.rationale}</span>
						</li>
					))}
				</ul>
			) : null}
		</section>
	);
}

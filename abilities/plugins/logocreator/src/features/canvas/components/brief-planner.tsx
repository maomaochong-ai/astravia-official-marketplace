import { useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { planFromBrief, type PlanCandidate } from "../../../domain/planner";
import { BUTTON_PRIMARY, FOCUS_RING, INPUT, SECTION_LABEL } from "../../../shared/styles/tokens";

export interface BriefPlannerProps {
	/** Hands the planned candidates to the panel, which generates them with the host AI. */
	onPlan: (candidates: PlanCandidate[]) => Promise<void>;
	/** 没有可用的图像模型：按钮改成「去连接模型」。 */
	needsProvider: boolean;
	onOpenAiSettings: () => void;
}

/**
 * "Start from a sentence".
 *
 * 这句话只负责**把口语变成三个具体方向**（结构、风格、配色、seed），出图由宿主的
 * 图像模型完成 —— 与画布上其它生成入口走同一条路。
 *
 * 上一版这里直接本地渲染：没有连接任何图像服务也能出图，让人误以为「AI 出图不需要模型」，
 * 而产物又是另一类东西（矢量草稿）。现在没有模型时按钮直接引导去连接，不再假装成功。
 */
export function BriefPlanner({ onPlan, needsProvider, onOpenAiSettings }: BriefPlannerProps): JSX.Element {
	const { t } = useTranslation();
	const [brief, setBrief] = useState("");
	const [busy, setBusy] = useState(false);
	const [planned, setPlanned] = useState<PlanCandidate[]>([]);

	const run = async (): Promise<void> => {
		const text = brief.trim();
		if (!text) return;
		if (needsProvider) {
			onOpenAiSettings();
			return;
		}
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
					className={`${BUTTON_PRIMARY} ${FOCUS_RING} h-8 px-2 text-[12px]`}
				>
					{busy ? t("action.working") : needsProvider ? t("brief.connect") : t("brief.action")}
				</button>
				<span className="min-w-0 flex-1 text-[10px] leading-snug text-muted-foreground">
					{needsProvider ? t("brief.needsProvider") : t("brief.hint")}
				</span>
			</div>
			{planned.length > 0 ? (
				<ul className="space-y-1">
					{planned.map((candidate) => (
						<li key={candidate.spec.seed} className="rounded-md bg-muted/50 px-2 py-1 text-[11px] leading-snug">
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

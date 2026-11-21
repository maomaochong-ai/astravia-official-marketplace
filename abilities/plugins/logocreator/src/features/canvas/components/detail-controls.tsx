import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { DETAIL_ENTRIES } from "../../../domain/catalog";
import type { LogoSpec } from "../../../domain/spec";
import { INPUT, SECTION_LABEL, TEXTAREA, FOCUS_RING } from "../../../shared/styles/tokens";
import { Segmented } from "../../../shared/components/segmented";

export interface DetailControlsProps {
	spec: LogoSpec;
	onPatch: (patch: Partial<LogoSpec>) => void;
	variations: number;
	onVariations: (value: number) => void;
	/** The subject the engine picked, shown as a confirmation of the brief. */
	subject: string;
	/** Set when the design will come from a host image provider instead of the engine. */
	aiMode: boolean;
}

/**
 * Detail level, monochrome, variation count and the freeform brief.
 *
 * The subject readout is not decoration: it is how a user learns that "warm
 * roastery" produced a cup rather than a leaf, without opening the debug tools.
 */
export function DetailControls({ spec, onPatch, variations, onVariations, subject, aiMode }: DetailControlsProps): JSX.Element {
	const { t } = useTranslation();

	return (
		<div className="space-y-3">
			<div>
				<span className={SECTION_LABEL}>{t("label.detail")}</span>
				<Segmented
					ariaLabel={t("label.detail")}
					value={spec.detail}
					onChange={(detail) => onPatch({ detail })}
					options={DETAIL_ENTRIES.map((entry) => ({ value: entry.id, label: t(entry.labelKey) }))}
				/>
			</div>

			<div>
				<span className={SECTION_LABEL}>{t("label.intent")}</span>
				<textarea
					className={TEXTAREA}
					rows={2}
					value={spec.intent}
					onChange={(event) => onPatch({ intent: event.target.value })}
					placeholder={t("placeholder.intent")}
					aria-label={t("label.intent")}
				/>
				<p className="mt-1 text-[11px] text-muted-foreground">
					{t("label.subject")}{" "}
					<span className="font-medium text-foreground">{subject.replace("abstract:", t("label.abstractShort"))}</span>
				</p>
			</div>

			<div className="flex flex-wrap items-center justify-between gap-2">
				<label className="flex cursor-pointer items-center gap-2 text-[12px] text-foreground">
					<input
						type="checkbox"
						checked={spec.monochrome}
						onChange={(event) => onPatch({ monochrome: event.target.checked })}
						className={`size-3.5 rounded border-border accent-[var(--primary)] ${FOCUS_RING}`}
					/>
					{t("label.monochrome")}
				</label>

				<label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
					{t("label.variations")}
					<input
						type="number"
						min={1}
						max={8}
						value={variations}
						onChange={(event) => onVariations(Number(event.target.value) || 1)}
						className={`${INPUT} h-7 w-14 px-2 text-center text-[12px]`}
						aria-label={t("label.variations")}
					/>
				</label>
			</div>

			{aiMode ? (
				<p className="rounded-lg bg-muted/60 px-2 py-1.5 text-[11px] leading-snug text-muted-foreground">
					{t("hint.aiMode")}
				</p>
			) : null}
		</div>
	);
}

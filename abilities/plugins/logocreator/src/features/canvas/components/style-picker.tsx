import { useMemo, useState, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STYLE_ENTRIES } from "../../../domain/catalog";
import { normalizeSpec } from "../../../domain/spec";
import { cachedRender } from "../preview-cache";
import { FOCUS_RING } from "../../../shared/styles/tokens";
import type { StyleId } from "../../../domain/spec";

export interface StylePickerProps {
	value: StyleId;
	onChange: (value: StyleId) => void;
}

/**
 * Eight styles, each previewed by its own sample.
 *
 * Two decisions here, both from a real defect:
 *
 *  - The tiles used to render *the user's current brief* in eight styles, which made
 *    them all look like the same leaf — indistinguishable placeholder art — and cost
 *    eight renders + eight data-URL encodes on every keystroke. Each tile now draws a
 *    fixed sample that is chosen to show what that style actually does (a cup for
 *    hand-drawn, a shield for geometric, an aperture for 3d), computed once and cached.
 *  - The samples are our own engine output, not stock images: a downloaded photo would
 *    not be what the style does, so it would misrepresent the choice.
 */
const SAMPLES: Record<StyleId, { brand: string; intent: string; type: "icon-name" | "icon" }> = {
	minimal: { brand: "Moss", intent: "a leaf mark for a garden studio", type: "icon-name" },
	geometric: { brand: "Quanta", intent: "a shield mark for security software", type: "icon-name" },
	gradient: { brand: "Tidewell", intent: "a wave mark for an ocean data platform", type: "icon-name" },
	mascot: { brand: "Hootly", intent: "a friendly owl mascot", type: "icon-name" },
	"hand-drawn": { brand: "Kettle Lane", intent: "a hand-drawn cup for a coffee roastery", type: "icon-name" },
	luxury: { brand: "Auric", intent: "a pillar mark for a private law firm", type: "icon-name" },
	retro: { brand: "Vintage", intent: "a flame badge for a grill house", type: "icon-name" },
	"3d": { brand: "Ember", intent: "a spark mark for a gaming studio", type: "icon-name" },
};

export function StylePicker({ value, onChange }: StylePickerProps): JSX.Element {
	const { t } = useTranslation();
	const [hovered, setHovered] = useState<StyleId | null>(null);

	// Computed once per mount, first paint only: the samples do not depend on the form.
	const previews = useMemo(
		() =>
			STYLE_ENTRIES.map((entry) => {
				const sample = SAMPLES[entry.id];
				const spec = normalizeSpec({
					brandName: sample.brand,
					intent: sample.intent,
					type: sample.type,
					style: entry.id,
					detail: "minimal",
					seed: 11,
				});
				return { id: entry.id, url: cachedRender(spec, { markOnly: true, idSalt: `sample-${entry.id}` }).url };
			}),
		[],
	);

	return (
		<div role="radiogroup" aria-label={t("label.style")} className="grid grid-cols-4 gap-1.5">
			{STYLE_ENTRIES.map((entry, index) => {
				const active = entry.id === value;
				const preview = previews[index];
				return (
					<button
						key={entry.id}
						type="button"
						role="radio"
						aria-checked={active}
						onClick={() => onChange(entry.id)}
						onMouseEnter={() => setHovered(entry.id)}
						onMouseLeave={() => setHovered(null)}
						title={t(entry.hintKey)}
						className={`${FOCUS_RING} overflow-hidden rounded-lg border transition-colors ${
							active ? "border-primary" : "border-border hover:border-foreground/25"
						}`}
					>
						<span className={`block aspect-square w-full ${active ? "bg-primary/10" : "bg-muted/40"}`}>
							<img src={preview?.url} alt="" className="size-full object-contain p-1" draggable={false} />
						</span>
						<span
							className={`block truncate px-1 pb-1 text-[10px] font-medium ${
								active || hovered === entry.id ? "text-foreground" : "text-muted-foreground"
							}`}
						>
							{t(entry.labelKey)}
						</span>
					</button>
				);
			})}
		</div>
	);
}

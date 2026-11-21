import { useMemo, type JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STYLE_ENTRIES } from "../../../domain/catalog";
import { renderLogo } from "../../../domain/engine/compose";
import { previewUrl } from "../../../domain/render-png";
import type { LogoSpec, StyleId } from "../../../domain/spec";
import { FOCUS_RING } from "../../../shared/styles/tokens";

export interface StylePickerProps {
	value: StyleId;
	/** The rest of the form; each tile previews the real style on this brief. */
	spec: LogoSpec;
	onChange: (value: StyleId) => void;
}

/**
 * Eight styles, each previewed on the user's own brand name.
 *
 * A label alone ("Luxury") is not enough to choose by — the same word means
 * different things to different people. Rendering the actual mark for each style
 * costs eight pure function calls and removes the guesswork.
 */
export function StylePicker({ value, spec, onChange }: StylePickerProps): JSX.Element {
	const { t } = useTranslation();

	const previews = useMemo(
		() =>
			STYLE_ENTRIES.map((entry) => ({
				id: entry.id,
				url: previewUrl(
					renderLogo({ ...spec, style: entry.id, detail: "minimal" }, { markOnly: true, idSalt: `style-${entry.id}` })
						.markSvg,
				),
			})),
		// Only the fields that change the mark belong in the key; `style` itself is
		// overridden per tile.
		[spec.brandName, spec.type, spec.primary, spec.intent, spec.monochrome, spec.seed],
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
								active ? "text-foreground" : "text-muted-foreground"
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

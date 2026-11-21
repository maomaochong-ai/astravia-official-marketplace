import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { STARTER_PRESETS } from "../../../domain/catalog";
import { CHIP, CHIP_ACTIVE, CHIP_IDLE, FOCUS_RING } from "../../../shared/styles/tokens";

export interface PresetRowProps {
	activeId: string | null;
	onApply: (preset: (typeof STARTER_PRESETS)[number]) => void;
}

/**
 * One-tap seeds. Tapping the active preset again clears it, so the row behaves
 * like a filter rather than a one-way door — the same interaction the upstream
 * app uses.
 */
export function PresetRow({ activeId, onApply }: PresetRowProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<div
			role="group"
			aria-label={t("label.presets")}
			className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
		>
			{STARTER_PRESETS.map((preset) => {
				const active = preset.id === activeId;
				return (
					<button
						key={preset.id}
						type="button"
						onClick={() => onApply(preset)}
						aria-pressed={active}
						title={preset.intent}
						className={`${CHIP} ${FOCUS_RING} ${active ? CHIP_ACTIVE : CHIP_IDLE}`}
					>
						{t(preset.labelKey)}
					</button>
				);
			})}
		</div>
	);
}

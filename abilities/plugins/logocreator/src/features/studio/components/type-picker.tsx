import type { JSX } from "react";
import { TYPE_ENTRIES } from "../../../domain/catalog";
import type { LogoType } from "../../../domain/spec";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { FOCUS_RING } from "../../../shared/styles/tokens";

export interface TypePickerProps {
	value: LogoType;
	onChange: (value: LogoType) => void;
}

/** What the mark is made of — the single most structural choice in the form. */
export function TypePicker({ value, onChange }: TypePickerProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<div role="radiogroup" aria-label={t("label.type")} className="grid grid-cols-2 gap-1.5">
			{TYPE_ENTRIES.map((entry) => {
				const active = entry.id === value;
				return (
					<button
						key={entry.id}
						type="button"
						role="radio"
						aria-checked={active}
						onClick={() => onChange(entry.id)}
						title={t(entry.hintKey)}
						className={`${FOCUS_RING} rounded-lg border px-2 py-1.5 text-left transition-colors ${
							active ? "border-primary bg-primary/10" : "border-border bg-background hover:border-foreground/25"
						}`}
					>
						<span className="block text-[12px] font-medium leading-tight text-foreground">{t(entry.labelKey)}</span>
						<span className="mt-0.5 block text-[10px] leading-tight text-muted-foreground">{t(entry.structureKey)}</span>
					</button>
				);
			})}
		</div>
	);
}

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LogoSpec } from "../../../domain/spec";
import { INPUT, SECTION_LABEL } from "../../../shared/styles/tokens";

export interface BrandNameFieldProps {
	spec: LogoSpec;
	onPatch: (patch: Partial<LogoSpec>) => void;
}

/**
 * Name and tagline. Both feed the wordmark, so they are the two fields with the
 * tightest length limits — the engine truncates rather than letting a 90-character
 * name escape the canvas.
 */
export function BrandNameField({ spec, onPatch }: BrandNameFieldProps): JSX.Element {
	const { t } = useTranslation();
	return (
		<div className="space-y-2">
			<label className="block">
				<span className={SECTION_LABEL}>{t("label.brandName")}</span>
				<input
					className={INPUT}
					value={spec.brandName}
					onChange={(event) => onPatch({ brandName: event.target.value })}
					placeholder={t("placeholder.brandName")}
					maxLength={48}
					autoComplete="off"
					spellCheck={false}
				/>
			</label>
			<label className="block">
				<span className={SECTION_LABEL}>{t("label.tagline")}</span>
				<input
					className={`${INPUT} h-8 text-[12px]`}
					value={spec.tagline}
					onChange={(event) => onPatch({ tagline: event.target.value })}
					placeholder={t("placeholder.tagline")}
					maxLength={64}
					autoComplete="off"
				/>
			</label>
		</div>
	);
}

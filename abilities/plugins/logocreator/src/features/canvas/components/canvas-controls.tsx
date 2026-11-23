import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { BRAND_COLORS, STARTER_PRESETS } from "../../../domain/catalog";
import { resolvePalette } from "../../../domain/color-plan";
import type { LogoSpec } from "../../../domain/spec";
import { CARD, SECTION_LABEL } from "../../../shared/styles/tokens";
import { BrandNameField } from "./brand-name-field";
import { ColourPicker } from "./colour-picker";
import { DetailControls } from "./detail-controls";
import { PresetRow } from "./preset-row";
import { StylePicker } from "./style-picker";
import { TypePicker } from "./type-picker";

export interface CanvasControlsProps {
	spec: LogoSpec;
	patch: (next: Partial<LogoSpec>) => void;
	activePreset: string | null;
	applyPreset: (preset: (typeof STARTER_PRESETS)[number]) => void;
	variations: number;
	onVariations: (value: number) => void;
	subject: string;
	aiMode: boolean;
	imageLabels: { fromImage: string; imageFailed: string; tooLarge: string };
}

/**
 * The form column.
 *
 * Order is deliberate: name → preset → structure → look → detail. Everything that
 * changes the layout of the mark comes before everything that only changes its
 * surface, so a user who stops halfway still has a coherent logo.
 */
export function CanvasControls({
	spec,
	patch,
	activePreset,
	applyPreset,
	variations,
	onVariations,
	subject,
	aiMode,
	imageLabels,
}: CanvasControlsProps): JSX.Element {
	const { t } = useTranslation();
	const palette = resolvePalette(spec);

	return (
		<div className="space-y-3">
			<BrandNameField spec={spec} onPatch={patch} />

			<div>
				<span className={SECTION_LABEL}>{t("label.presets")}</span>
				<PresetRow activeId={activePreset} onApply={applyPreset} />
			</div>

			<div>
				<span className={SECTION_LABEL}>{t("label.type")}</span>
				<TypePicker value={spec.type} onChange={(type) => patch({ type })} />
			</div>

			<div>
				<span className={SECTION_LABEL}>{t("label.style")}</span>
				<StylePicker value={spec.style} onChange={(style) => patch({ style })} />
			</div>

			<div>
				<span className={SECTION_LABEL}>{t("label.colour")}</span>
				<ColourPicker
					value={spec.primary}
					autoHex={palette.primary}
					onChange={(primary) => patch({ primary })}
					swatches={BRAND_COLORS.map((entry) => ({ hex: entry.hex, label: t(entry.nameKey) }))}
					labels={{
						auto: t("colour.auto"),
						custom: t("colour.custom"),
						fromImage: imageLabels.fromImage,
						imageFailed: imageLabels.imageFailed,
						tooLarge: imageLabels.tooLarge,
					}}
				/>
			</div>

			<div>
				<span className={SECTION_LABEL}>{t("label.surface")}</span>
				<div className="flex gap-1.5">
					{(
						[
							{ id: "light", label: t("surface.light"), bg: "#ffffff", ring: "border-border" },
							{ id: "dark", label: t("surface.dark"), bg: "#121210", ring: "border-border" },
							{ id: "transparent", label: t("surface.transparent"), bg: "transparent", ring: "border-border" },
						] as const
					).map((option) => {
						const active = spec.surface === option.id;
						return (
							<button
								key={option.id}
								type="button"
								onClick={() => patch({ surface: option.id })}
								aria-pressed={active}
								className={`flex h-7 items-center gap-1.5 rounded-full px-2 text-[11px] font-medium whitespace-nowrap transition-colors ${
									active ? "bg-primary/10 text-foreground ring-1 ring-primary" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
								}`}
							>
								<span
									className={`size-3.5 rounded-[4px] ring-1 ring-inset ring-black/15 ${
										option.id === "transparent" ? "bg-[repeating-conic-gradient(#ddd_0%_25%,#fff_0%_50%)] bg-[length:6px_6px]" : ""
									}`}
									style={option.id === "transparent" ? undefined : { background: option.bg }}
									aria-hidden
								/>
								{option.label}
							</button>
						);
					})}
				</div>
			</div>

			<DetailControls
				spec={spec}
				onPatch={patch}
				variations={variations}
				onVariations={onVariations}
				subject={subject}
				aiMode={aiMode}
			/>

		</div>
	);
}

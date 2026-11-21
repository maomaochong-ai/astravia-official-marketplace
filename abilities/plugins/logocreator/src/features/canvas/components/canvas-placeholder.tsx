import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { IconSpark } from "../../../shared/components/icons";

/**
 * The stage's empty state — a *cover*, not a blank canvas.
 *
 * Before this the stage rendered `renderLogo({brandName:"Untitled"})`, i.e. a real
 * wordmark for a brand that does not exist. That reads as "the plugin already made
 * something", which is the worst thing an empty state can say.
 *
 * The placeholder is deliberately made of the product's own vocabulary: a soft
 * construction grid (the engine draws on one), three ghost shapes standing in for the
 * three structures you can pick, and one line telling you the two ways to start.
 * `pointer-events-none` so a click still reaches the surface and drops a note.
 */
export function CanvasPlaceholder(): JSX.Element {
	const { t } = useTranslation();

	return (
		<div
			className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-hidden rounded-xl"
			aria-hidden
		>
			{/* Construction grid: 12.5% steps, the same rhythm the engine's box uses. */}
			<div
				className="absolute inset-0 opacity-[0.55]"
				style={{
					backgroundImage:
						"linear-gradient(to right, color-mix(in srgb, var(--foreground) 7%, transparent) 1px, transparent 1px)," +
						"linear-gradient(to bottom, color-mix(in srgb, var(--foreground) 7%, transparent) 1px, transparent 1px)",
					backgroundSize: "12.5% 12.5%",
				}}
			/>

			{/* Three ghost structures — what you are about to choose between. */}
			<svg viewBox="0 0 120 96" className="relative h-20 w-24 text-foreground/25" fill="none">
				<rect x="4" y="20" width="32" height="32" rx="9" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" />
				<rect x="44" y="8" width="32" height="32" rx="16" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" />
				<path d="M88 20l14 24H74z" stroke="currentColor" strokeWidth="1.4" strokeDasharray="3 3" strokeLinejoin="round" />
				<rect x="28" y="64" width="64" height="7" rx="3.5" fill="currentColor" fillOpacity="0.5" />
				<rect x="44" y="78" width="32" height="5" rx="2.5" fill="currentColor" fillOpacity="0.3" />
			</svg>

			<div className="relative flex flex-col items-center gap-1 px-6 text-center">
				<span className="flex items-center gap-1 text-[12px] font-medium text-foreground">
					<IconSpark className="size-3.5 text-primary" />
					{t("placeholder.title")}
				</span>
				<span className="text-[11px] leading-snug text-muted-foreground">{t("placeholder.body")}</span>
			</div>

			<div className="relative flex items-center gap-1 text-[10px] text-muted-foreground">
				<span>{t("placeholder.meta")}</span>
			</div>
		</div>
	);
}

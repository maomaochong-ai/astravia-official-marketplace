import { useTranslation } from "@astravia-org/plugin-sdk";
import type { ReactElement } from "react";
import { Button } from "../../../shared/components/button";

/**
 * The ability page's slot sits under the install header, where the marketplace
 * detail page used to carry a screenshot of the introduction page.
 *
 * A screenshot answers "what does it look like" once and then goes stale; this
 * slot answers "open it" every time, and the page it opens is the shipped file.
 */
export interface GuideEntrySlotProps {
	/** Opens the plugin's full-page view; the host owns the route, the plugin owns the page. */
	onOpen: () => void;
}

export function GuideEntrySlot({ onOpen }: GuideEntrySlotProps): ReactElement {
	const { t } = useTranslation();

	return (
		<section className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border/60 bg-gradient-to-br from-card/70 to-muted/20 p-4">
			<div className="flex min-w-0 items-start gap-3">
				<span
					className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-inset ring-primary/20"
					aria-hidden="true"
				>
					<svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
						<rect x="3" y="4" width="18" height="16" rx="3" />
						<path d="M3 10h18M9 10v10" />
					</svg>
				</span>
				<div className="min-w-0">
					<p className="text-sm font-semibold text-foreground">{t("guide.slot.title")}</p>
					<p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{t("guide.slot.subtitle")}</p>
				</div>
			</div>
			<Button className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/20" onClick={onOpen}>
				{t("guide.slot.open")}
			</Button>
		</section>
	);
}

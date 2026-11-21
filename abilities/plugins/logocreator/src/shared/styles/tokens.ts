/**
 * Shared class strings.
 *
 * Tailwind utilities only — the plugin's CSS is compiled into the host page, so a
 * business selector (`button { … }`) would restyle Astravia itself. Grouping the
 * repeated combinations here keeps the components readable without inventing a
 * CSS layer.
 */

export const PANEL = "flex h-full min-h-0 w-full flex-col bg-background text-foreground";

export const CARD = "rounded-xl border border-border/60 bg-card";

export const SECTION_LABEL = "mb-2 block text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground";

export const INPUT =
	"h-9 w-full rounded-lg border border-input bg-background px-3 text-[13px] text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export const TEXTAREA =
	"w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[12px] leading-relaxed text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring";

export const BUTTON_PRIMARY =
	"inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50";

export const BUTTON_SECONDARY =
	"inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-[12px] font-medium text-foreground transition-colors hover:bg-muted disabled:opacity-50";

export const BUTTON_GHOST =
	"inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg px-2 text-[12px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50";

export const CHIP =
	"inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors";

export const CHIP_IDLE = "border-border bg-background text-muted-foreground hover:border-foreground/25 hover:text-foreground";

export const CHIP_ACTIVE = "border-primary bg-primary/10 text-foreground";

export const FOCUS_RING = "outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background";

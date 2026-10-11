import type { ReactNode } from "react";

type Tone = "neutral" | "accent" | "primary" | "warning" | "danger" | "ai";

/** ~15% fill with matching text, per DESIGN.md "Components · pills". */
const TONES: Record<Tone, string> = {
	neutral: "bg-neutral-muted text-muted",
	accent: "bg-accent-soft text-accent",
	primary: "bg-primary/15 text-success",
	warning: "bg-warning-soft text-warning",
	danger: "bg-danger-soft text-danger",
	ai: "bg-ai-soft text-ai",
};

/** Small metadata pill: type, engine, count. Never decorative. */
export default function Chip({
	children,
	tone = "neutral",
	mono = false,
	icon,
	className = "",
}: {
	children: ReactNode;
	tone?: Tone;
	/** IDs, counts and column names read as code, so they get the mono stack. */
	mono?: boolean;
	/** full iconify class, e.g. "icon-[lucide--database]" */
	icon?: string;
	className?: string;
}) {
	return (
		<span
			className={`inline-flex h-[18px] shrink-0 items-center gap-1 rounded-chip px-1.5 text-[10px] leading-none whitespace-nowrap ${
				TONES[tone]
			} ${mono ? "font-mono tabular-nums" : "font-sans"} ${className}`}
		>
			{icon ? <span aria-hidden className={`${icon} size-2.5`} /> : null}
			{children}
		</span>
	);
}

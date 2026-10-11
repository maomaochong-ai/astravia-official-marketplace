/**
 * Chip — 小 pill 标签。
 *
 * ~15% 底色 + 匹配文字色。 never decorative — 永远传递 meta 信息。
 * 支持 mono 字重（ID/计数/列名）和可选图标。
 */

import type { JSX, ReactNode } from "react";
import { Icon } from "./icon";

export type ChipTone = "neutral" | "accent" | "primary" | "warning" | "danger" | "ai";

const TONES: Record<ChipTone, string> = {
	neutral: "bg-neutral-muted text-muted",
	accent: "bg-accent-soft text-accent",
	primary: "bg-primary/15 text-success",
	warning: "bg-warning-soft text-warning",
	danger: "bg-danger-soft text-danger",
	ai: "bg-ai-soft text-ai",
};

interface Props {
	children: ReactNode;
	tone?: ChipTone;
	mono?: boolean;
	icon?: string;
	className?: string;
}

export function Chip({ children, tone = "neutral", mono = false, icon, className = "" }: Props): JSX.Element {
	return (
		<span
			className={`inline-flex h-[18px] shrink-0 items-center gap-1 rounded-chip px-1.5 text-[10px] leading-none whitespace-nowrap ${
				TONES[tone]
			} ${mono ? "font-mono tabular-nums" : "font-sans"} ${className}`}
		>
			{icon ? <Icon name={icon} className="size-2.5" /> : null}
			{children}
		</span>
	);
}

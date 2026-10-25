/**
 * 小标题（eyebrow）：章节上方那行等宽大写小字。
 *
 * 面板里的层级只靠三种手段拉开 —— 字号、字重、这条 eyebrow。
 * 不再用边框和阴影堆层次，避免窄面板里出现「框中框」。
 */

import type { JSX, ReactNode } from "react";

export type EyebrowTone = "muted" | "sage" | "warm" | "strong";

const TONE_CLASS: Record<EyebrowTone, string> = {
	muted: "text-faint",
	sage: "text-sage-dark",
	warm: "text-ochre",
	strong: "text-foreground/70",
};

export interface EyebrowProps {
	readonly children: ReactNode;
	readonly tone?: EyebrowTone;
	readonly className?: string;
	readonly title?: string;
}

export function Eyebrow({ children, tone = "muted", className, title }: EyebrowProps): JSX.Element {
	const parts = ["text-micro-up font-medium uppercase tracking-[0.08em]", TONE_CLASS[tone]];
	if (className) parts.push(className);
	return (
		<span className={parts.join(" ")} title={title}>
			{children}
		</span>
	);
}

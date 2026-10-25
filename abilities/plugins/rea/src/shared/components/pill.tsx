/**
 * 胶囊标签 / 按钮的统一样式。
 *
 * 设计稿里几乎所有「可点的短动作」都是同一枚胶囊：高度一致、圆角一致、
 * 只有底色随语义变。把它收敛成一个 class 工厂，按钮和只读标签共用，
 * 面板窄到 320px 时也不会出现三种高度的按钮排在一起。
 *
 * tone 全部走宿主派生的语义 token（primary / apricot / mist / border），
 * 深浅色主题下没有第二份色值。
 */

import type { JSX, ReactNode } from "react";

export type PillTone = "primary" | "warm" | "ghost" | "quiet" | "inverse";

const TONE_CLASS: Record<PillTone, string> = {
	primary: "bg-primary text-primary-foreground shadow-card",
	warm: "bg-apricot text-ochre",
	ghost: "border border-border bg-transparent text-foreground/85 hover:border-border-strong hover:bg-mist",
	quiet: "bg-mist text-muted-foreground hover:text-foreground",
	inverse: "bg-foreground text-background",
};

const BASE =
	"inline-flex h-8 max-w-full shrink-0 items-center gap-1.5 whitespace-nowrap rounded-pill px-3.5 text-caption font-medium transition-colors";

const DISABLED =
	"disabled:cursor-not-allowed disabled:border-border disabled:bg-transparent disabled:text-faint disabled:shadow-none";

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40";

/** 胶囊类串：`<button className={pillClass("primary")}>` 与 `<Pill>` 共用。 */
export function pillClass(tone: PillTone = "ghost", extra?: string): string {
	const parts = [BASE, TONE_CLASS[tone], FOCUS];
	if (tone !== "ghost") parts.push(DISABLED);
	if (extra) parts.push(extra);
	return parts.join(" ");
}

export interface PillProps {
	readonly tone?: PillTone;
	readonly children: ReactNode;
	readonly className?: string;
	readonly title?: string;
}

export function Pill({ tone = "ghost", children, className, title }: PillProps): JSX.Element {
	return (
		<span className={pillClass(tone, className)} title={title}>
			{children}
		</span>
	);
}

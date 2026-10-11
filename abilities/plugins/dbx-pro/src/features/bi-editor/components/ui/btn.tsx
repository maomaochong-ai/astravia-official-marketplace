/**
 * Btn — 标准按钮。
 *
 * 6 种 variant 互斥（不同时叠两种背景 utility）。
 */

import type { JSX, ReactNode } from "react";
import { Icon } from "./icon";

type Variant = "default" | "primary" | "ghost" | "quiet" | "ai" | "danger";
type Size = "xs" | "sm" | "md";

const VARIANTS: Record<Variant, string> = {
	default: "border border-border bg-surface-raised text-surface-foreground hover:border-border-strong hover:bg-surface",
	primary: "border border-primary bg-primary text-primary-foreground hover:opacity-90",
	ghost: "border border-transparent text-muted hover:bg-surface-raised hover:text-surface-foreground",
	quiet: "border border-transparent text-muted hover:text-surface-foreground",
	ai: "border border-ai/40 bg-ai-soft text-ai hover:opacity-90",
	danger: "border border-danger/40 bg-danger-soft text-danger hover:opacity-90",
};

const SIZES: Record<Size, string> = {
	xs: "h-6 gap-1 px-2 text-[12px]",
	sm: "h-7 gap-1.5 px-2.5 text-[12px]",
	md: "h-8 gap-1.5 px-3 text-[14px]",
};

const ICON_SIZES: Record<Size, string> = { xs: "size-3", sm: "size-3.5", md: "size-4" };

interface Props {
	variant?: Variant;
	size?: Size;
	icon?: string;
	children?: ReactNode;
	title?: string;
	disabled?: boolean;
	className?: string;
	onClick?: () => void;
	type?: "button" | "submit";
}

export function Btn({
	variant = "default", size = "md", icon, children, title,
	disabled, className = "", onClick, type = "button",
}: Props): JSX.Element {
	return (
		<button
			type={type}
			title={title}
			disabled={disabled}
			onClick={onClick}
			className={`inline-flex appearance-none select-none items-center justify-center whitespace-nowrap rounded-control font-medium ${
				SIZES[size]
			} ${VARIANTS[variant]}${disabled ? " text-faint" : ""} ${className}`}
		>
			{icon ? <Icon name={icon} className={ICON_SIZES[size]} /> : null}
			{children}
		</button>
	);
}

import type { ReactNode } from "react";
import Icon from "./Icon";

type Variant = "default" | "primary" | "ghost" | "quiet" | "ai" | "danger";
type Size = "xs" | "sm" | "md";

/** Mutually exclusive sets — never two background utilities on one element. */
const VARIANTS: Record<Variant, string> = {
	default:
		"border border-border bg-surface-raised text-surface-foreground hover:border-border-strong hover:bg-surface-sunken",
	primary:
		"border border-primary bg-primary text-primary-foreground hover:opacity-90",
	ghost:
		"border border-transparent text-muted hover:bg-surface-raised hover:text-surface-foreground",
	quiet: "border border-transparent text-muted hover:text-surface-foreground",
	ai: "border border-ai/40 bg-ai-soft text-ai hover:opacity-90",
	danger: "border border-danger/40 bg-danger-soft text-danger hover:opacity-90",
};

const SIZES: Record<Size, string> = {
		xs: "h-6 gap-1 px-2 text-[12px]",
	sm: "h-7 gap-1.5 px-2.5 text-[12px]",
		md: "h-8 gap-1.5 px-3 text-[14px]",
};

const ICON_SIZES: Record<Size, string> = {
	xs: "size-3",
	sm: "size-3.5",
	md: "size-4",
};

export default function Btn({
	variant = "default",
	size = "md",
	icon,
	children,
	title,
	disabled,
	className = "",
}: {
	variant?: Variant;
	size?: Size;
	/** full iconify class, e.g. "icon-[lucide--play]" */
	icon?: string;
	children?: ReactNode;
	title?: string;
	disabled?: boolean;
	className?: string;
}) {
	return (
		<button
			type="button"
			title={title}
			disabled={disabled}
			className={`inline-flex appearance-none select-none items-center justify-center whitespace-nowrap rounded-control font-sans font-medium ${
				SIZES[size]
			} ${VARIANTS[variant]}${disabled ? " text-faint" : ""} ${className}`}
		>
			{icon ? <Icon name={icon} className={ICON_SIZES[size]} /> : null}
			{children}
		</button>
	);
}

/**
 * IconButton — 24/28/32 px 方形图标按钮。
 */

import type { JSX } from "react";
import { Icon } from "./icon";

const SIZES: Record<string, string> = { xs: "size-6", sm: "size-7", md: "size-8" };
const ICON_SIZES: Record<string, string> = { xs: "size-3", sm: "size-3.5", md: "size-4" };
const TONES: Record<string, string> = {
	default: "text-muted hover:bg-neutral-muted hover:text-surface-foreground",
	danger: "text-muted hover:bg-danger-soft hover:text-danger",
	ai: "text-ai hover:bg-ai-soft",
};

interface Props {
	icon: string;
	size?: "xs" | "sm" | "md";
	tone?: "default" | "danger" | "ai";
	active?: boolean;
	disabled?: boolean;
	title?: string;
	className?: string;
	onClick?: () => void;
}

export function IconButton({
	icon, size = "sm", tone = "default", active = false,
	disabled, title, className = "", onClick,
}: Props): JSX.Element {
	const variant = active ? "bg-accent-soft text-accent" : TONES[tone];
	return (
		<button
			type="button"
			title={title}
			disabled={disabled}
			onClick={onClick}
			className={`grid shrink-0 appearance-none place-items-center rounded-control ${SIZES[size]} ${variant}${disabled ? " text-faint" : ""} ${className}`}
		>
			<Icon name={icon} className={ICON_SIZES[size]} />
		</button>
	);
}

import Icon from "./Icon";

const SIZES: Record<string, string> = {
	xs: "size-6",
	sm: "size-7",
	md: "size-8",
};

const TONES: Record<string, string> = {
	default: "text-muted hover:bg-neutral-muted hover:text-surface-foreground",
	danger: "text-muted hover:bg-danger-soft hover:text-danger",
	ai: "text-ai hover:bg-ai-soft",
};

/** 24 / 28 / 32 px square target — the workbench's only icon affordance. */
export default function IconButton({
	icon,
	size = "sm",
	tone = "default",
	active = false,
	disabled,
	title,
	className = "",
}: {
	icon: string;
	size?: "xs" | "sm" | "md";
	tone?: "default" | "danger" | "ai";
	active?: boolean;
	disabled?: boolean;
	title?: string;
	className?: string;
}) {
	const variant = active ? "bg-accent-soft text-accent" : TONES[tone];
	return (
		<button
			type="button"
			title={title}
			disabled={disabled}
			className={`grid shrink-0 appearance-none place-items-center rounded-control ${
				SIZES[size]
			} ${variant}${disabled ? " text-faint" : ""} ${className}`}
		>
			<Icon name={icon} className={size === "xs" ? "size-3" : "size-3.5"} />
		</button>
	);
}

import type { JSX } from "react";

/** 筛选 chip：选中态用实心，未选中用描边；数字永远显示，选中时仍能看到总量。 */
export function FilterChip({
	label,
	count,
	active,
	onClick,
}: {
	label: string;
	count: number;
	active: boolean;
	onClick: () => void;
}): JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			aria-pressed={active}
			className={`rounded-full border px-2 py-0.5 text-[11px] transition-colors ${
				active
					? "border-primary/50 bg-primary/10 text-primary"
					: "border-border text-muted-foreground hover:bg-accent"
			}`}
		>
			{label}
			<span className="ml-1 tabular-nums opacity-70">{count}</span>
		</button>
	);
}

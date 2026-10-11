/** 28 × 16 px track, 12 px knob. */
export default function Switch({
	on,
	disabled,
}: {
	on: boolean;
	disabled?: boolean;
}) {
	return (
		<span
			className={`inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 ${
				on ? "bg-primary" : "bg-border-strong"
			}${disabled ? " opacity-40" : ""}`}
		>
			<span
				className={`size-3 rounded-full bg-surface-foreground ${
					on ? "translate-x-3" : "translate-x-0"
				}`}
			/>
		</span>
	);
}

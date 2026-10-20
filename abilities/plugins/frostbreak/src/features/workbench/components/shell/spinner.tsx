export interface SpinnerProps {
	className?: string;
}

/** 加载指示；只在 motion-safe 下转，减少动态效果时不播。 */
export function Spinner({ className }: SpinnerProps) {
	return (
		<span
			role="status"
			aria-live="polite"
			className={`inline-block animate-spin rounded-full border-2 border-current/25 border-t-current motion-reduce:animate-none ${className ?? "size-3.5"}`}
		/>
	);
}

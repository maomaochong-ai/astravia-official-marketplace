import type { ReactNode } from "react";

export type StatusTone = "ok" | "warn" | "bad" | "idle";

export function StatusPill({ tone, label }: { tone: StatusTone; label: string }): ReactNode {
	return (
		<span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--td-rule)] px-2 py-[3px] text-[11px] leading-none text-[var(--td-dim)]">
			<span className="td-dot" data-tone={tone} aria-hidden />
			{label}
		</span>
	);
}

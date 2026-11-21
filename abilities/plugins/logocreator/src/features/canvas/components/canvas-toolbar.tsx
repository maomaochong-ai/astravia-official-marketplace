import type { JSX, ReactNode } from "react";
import { BUTTON_GHOST, FOCUS_RING } from "../../../shared/styles/tokens";

export interface CanvasToolbarProps {
	title: string;
	subtitle: string;
	engineBadge: string;
	actions: { id: string; label: string; icon: ReactNode; onClick: () => void }[];
}

export function CanvasToolbar({ title, subtitle, engineBadge, actions }: CanvasToolbarProps): JSX.Element {
	return (
		<header className="flex items-start justify-between gap-2 border-b border-border/60 px-3 py-2.5">
			<div className="min-w-0">
				<div className="flex items-center gap-1.5">
					<h1 className="truncate text-[13.5px] font-semibold text-foreground">{title}</h1>
					<span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
						{engineBadge}
					</span>
				</div>
				<p className="mt-0.5 line-clamp-2 text-[10.5px] leading-snug text-muted-foreground">{subtitle}</p>
			</div>
			<div className="flex shrink-0 items-center gap-0.5">
				{actions.map((action) => (
					<button
						key={action.id}
						type="button"
						onClick={action.onClick}
						title={action.label}
						aria-label={action.label}
						className={`${BUTTON_GHOST} ${FOCUS_RING} size-8 px-0`}
					>
						{action.icon}
					</button>
				))}
			</div>
		</header>
	);
}

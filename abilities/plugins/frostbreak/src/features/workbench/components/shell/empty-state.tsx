import type { ReactNode } from "react";
import { Icon } from "./icon";

export interface EmptyStateProps {
	icon?: string;
	title: string;
	body?: string;
	action?: ReactNode;
}

/** 空态统一留白与文案层级，避免每页各写一套。 */
export function EmptyState({ icon = "info", title, body, action }: EmptyStateProps) {
	return (
		<div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
			<div className="flex size-9 items-center justify-center rounded-lg bg-surface-3 text-text-3">
				<Icon name={icon} className="size-4.5" />
			</div>
			<p className="text-[12.5px] font-medium text-text-2">{title}</p>
			{body ? <p className="max-w-[46ch] text-[11px] leading-relaxed text-text-4">{body}</p> : null}
			{action ? <div className="mt-1">{action}</div> : null}
		</div>
	);
}

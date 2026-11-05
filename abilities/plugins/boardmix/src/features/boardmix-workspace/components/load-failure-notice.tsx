export interface LoadFailureNoticeProps {
	title: string;
	body: string;
	retryLabel: string;
	externalLabel: string;
	onRetry(): void;
	onOpenExternal(): void;
}

export function LoadFailureNotice(props: LoadFailureNoticeProps) {
	return (
		<div className="flex flex-col gap-2 border-b border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
			<p className="font-medium text-foreground">{props.title}</p>
			<p className="text-muted-foreground">{props.body}</p>
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					onClick={props.onRetry}
					className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
				>
					{props.retryLabel}
				</button>
				<button
					type="button"
					onClick={props.onOpenExternal}
					className="rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-accent"
				>
					{props.externalLabel}
				</button>
			</div>
		</div>
	);
}

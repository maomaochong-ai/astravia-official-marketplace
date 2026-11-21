import { useEffect, type JSX, type ReactNode } from "react";

export interface ModalDialogProps {
	open: boolean;
	title: string;
	description?: string;
	onClose: () => void;
	children: ReactNode;
	footer?: ReactNode;
	/** Wider layout for the brand kit and history grids. */
	size?: "narrow" | "wide";
}

/**
 * An overlay confined to the activity panel, not the window.
 *
 * `absolute inset-0` inside the panel's `relative` root: a dialog that covers the
 * conversation is the wrong trade in a side panel — the user is usually reading a
 * reply while they rename a design. Anchoring is the panel's job (it sets
 * `relative`), so this component stays position-agnostic.
 *
 * Escape and backdrop clicks both close; the backdrop is a real button so a mouse
 * and a keyboard reach the same target.
 */
export function ModalDialog({ open, title, description, onClose, children, footer, size = "narrow" }: ModalDialogProps): JSX.Element | null {
	useEffect(() => {
		if (!open) return;
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				event.stopPropagation();
				onClose();
			}
		};
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [open, onClose]);

	if (!open) return null;

	return (
		<div className="absolute inset-0 z-50 flex items-center justify-center p-3">
			<button
				type="button"
				aria-label="Close dialog"
				onClick={onClose}
				className="absolute inset-0 cursor-default bg-black/45 backdrop-blur-[2px]"
			/>
			<div
				role="dialog"
				aria-modal="true"
				aria-label={title}
				className={`relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl ${
					size === "wide" ? "max-w-2xl" : "max-w-md"
				}`}
			>
				<header className="flex items-start justify-between gap-3 border-b border-border/60 px-4 py-3">
					<div className="min-w-0">
						<h2 className="text-[14px] font-semibold text-foreground">{title}</h2>
						{description ? <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{description}</p> : null}
					</div>
					<button
						type="button"
						onClick={onClose}
						aria-label="Close"
						className="flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
					>
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
							<path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
						</svg>
					</button>
				</header>
				<div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
				{footer ? <footer className="border-t border-border/60 px-4 py-2">{footer}</footer> : null}
			</div>
		</div>
	);
}

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { LOGO_TAB_ID } from "../../../tab-ids";
import { FOCUS_RING } from "../../../shared/styles/tokens";

export interface CanvasDockProps {
	canGenerate: boolean;
	running: boolean;
	mode: "local" | "ai";
	pendingNotes: number;
	inspectorOpen: boolean;
	/** Which inspector tab is showing, so the dock can reflect it. */
	inspectorTab: "design" | "notes";
	onGenerate: () => void;
	onSurprise: () => void;
	onOpenNotes: () => void;
	onToggleInspector: () => void;
	onOpenKit: () => void;
}

interface SlotProps {
	label: string;
	icon: JSX.Element;
	onClick: () => void;
	active?: boolean;
	disabled?: boolean;
	badge?: number;
	/** The one primary verb gets the filled treatment. */
	primary?: boolean;
}

function DockSlot({ label, icon, onClick, active, disabled, badge, primary }: SlotProps): JSX.Element {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled}
			aria-pressed={active}
			aria-label={label}
			title={label}
			className={`${FOCUS_RING} relative flex size-8 shrink-0 items-center justify-center rounded-[22%] border border-transparent transition-colors ${
				primary
					? "bg-primary text-primary-foreground hover:opacity-90"
					: active
						? "bg-primary/12 text-primary"
						: "bg-muted/55 text-foreground hover:bg-muted"
			} disabled:pointer-events-none disabled:opacity-40`}
		>
			{icon}
			{badge !== undefined && badge > 0 ? (
				<span className="absolute -right-1 -top-1 flex min-w-[14px] items-center justify-center rounded-full px-[3px] text-[9px] font-semibold leading-[14px] tabular-nums text-white"
						style={{ background: "#2563eb", boxShadow: "0 1px 3px -1px rgba(0,0,0,.4)" }}>
					{badge > 99 ? "99+" : badge}
				</span>
			) : null}
		</button>
	);
}

/**
 * The floating bottom dock — the reference canvas's control bar, one surface lower.
 *
 * Why a dock instead of a column of buttons: this panel is 400–600 px wide and the
 * art has to stay visible while you act on it. A dock pins the four verbs a user
 * actually repeats (generate, re-roll, inspect, notes) inside the canvas viewport,
 * and the label appears on hover so the icons stay dense.
 *
 * Deliberately no `backdrop-blur`: the surface behind it repaints on every edit,
 * and a blur would re-read those pixels each frame.
 */
export function CanvasDock({
	canGenerate,
	running,
	mode,
	pendingNotes,
	inspectorOpen,
	inspectorTab,
	onGenerate,
	onSurprise,
	onOpenNotes,
	onToggleInspector,
	onOpenKit,
}: CanvasDockProps): JSX.Element {
	const { t } = useTranslation();

	return (
		<div className="pointer-events-none absolute bottom-3 left-1/2 z-40 -translate-x-1/2">
			<div className="pointer-events-auto flex items-end gap-1 rounded-2xl border border-border/80 bg-popover px-2 py-1.5 shadow-md">
				<DockSlot
					primary
					label={
						running
							? t("action.working")
							: canGenerate
								? mode === "ai"
									? t("action.generateAi")
									: t("action.generate")
								: t("dock.locked")
					}
					disabled={running || !canGenerate}
					onClick={onGenerate}
					icon={
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
							<path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					}
				/>
				<DockSlot
					label={t("action.surprise")}
					disabled={running || !canGenerate}
					onClick={onSurprise}
					icon={
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M4 8.5l2.5 2.5L9 8.5 6.5 6zM15 8.5L17.5 11 20 8.5 17.5 6zM4 17l2.5 2.5L9 17l-2.5-2.5zM15 17l2.5 2.5L20 17l-2.5-2.5z" strokeLinejoin="round" />
							<circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
						</svg>
					}
				/>
				<span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
				<DockSlot
					label={t("dock.inspector")}
					active={inspectorOpen && inspectorTab === "design"}
					onClick={onToggleInspector}
					icon={
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M4 7h10M18 7h2M4 17h4M12 17h8M4 12h16" strokeLinecap="round" />
							<circle cx="16" cy="7" r="2" />
							<circle cx="10" cy="17" r="2" />
						</svg>
					}
				/>
				<DockSlot
					label={t("dock.notes")}
					active={inspectorOpen && inspectorTab === "notes"}
					badge={pendingNotes}
					onClick={onOpenNotes}
					icon={
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M4 6.5h16M4 12h10M4 17.5h7" strokeLinecap="round" />
							<path d="M16.5 15.5l2 2 3-3.5" strokeLinecap="round" strokeLinejoin="round" />
						</svg>
					}
				/>
				<DockSlot
					label={t("dock.kit")}
					onClick={onOpenKit}
					icon={
						<svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
							<path d="M4 8.5l8-3.5 8 3.5-8 3.5z" strokeLinejoin="round" />
							<path d="M4 12.5l8 3.5 8-3.5M4 16.5l8 3.5 8-3.5" strokeLinejoin="round" />
						</svg>
					}
				/>
			</div>
		</div>
	);
}

void LOGO_TAB_ID;

import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { LogoSpec } from "../../../domain/spec";
import type { CanvasNote } from "../../../domain/notes";
import type { PlanCandidate } from "../../../domain/planner";
import { FOCUS_RING } from "../../../shared/styles/tokens";
import { BriefPlanner } from "./brief-planner";
import { CanvasControls, type CanvasControlsProps } from "./canvas-controls";
import { NotesList } from "./notes-list";

export interface CanvasInspectorProps {
	open: boolean;
	tab: "design" | "notes";
	onTab: (tab: "design" | "notes") => void;
	onClose: () => void;
	controls: CanvasControlsProps;
	onPlan: (candidates: PlanCandidate[]) => Promise<void>;
	notes: CanvasNote[];
	onRemoveNote: (id: string) => void;
	onHandToAgent: () => void;
	busy: boolean;
}

/**
 * The right-hand inspector: everything that is *not* the canvas.
 *
 * The reference canvas keeps exactly one scrollable rail beside a fixed stage, so
 * the stage never moves and the rail never competes with the art for space. The
 * old panel was the opposite — one long column where the form pushed the canvas
 * out of view.
 *
 * It overlaps the stage instead of shrinking it: on a 400 px panel a split view
 * leaves ~120 px of art, which is a thumbnail, not a canvas.
 */
export function CanvasInspector({
	open,
	tab,
	onTab,
	onClose,
	controls,
	onPlan,
	notes,
	onRemoveNote,
	onHandToAgent,
	busy,
}: CanvasInspectorProps): JSX.Element | null {
	const { t } = useTranslation();
	if (!open) return null;

	return (
		<aside
			// Width is clamped both ways: below ~15rem the two-tab header starts wrapping
			// mid-word, above 20rem it eats the stage on a narrow panel.
			className="absolute inset-y-0 right-0 z-30 flex w-[clamp(15rem,88%,20rem)] min-w-0 flex-col border-l border-border/70 bg-background shadow-xl"
			aria-label={t("inspector.title")}
		>
			<header className="flex min-w-0 items-center gap-1 border-b border-border/60 px-2 py-1.5">
				<div role="tablist" aria-label={t("inspector.title")} className="flex items-center gap-0.5">
					{(
						[
							{ id: "design" as const, label: t("inspector.tabDesign") },
							{ id: "notes" as const, label: t("inspector.tabNotes") },
						]
					).map((entry) => (
						<button
							key={entry.id}
							type="button"
							role="tab"
							aria-selected={tab === entry.id}
							onClick={() => onTab(entry.id)}
							className={`${FOCUS_RING} rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
								tab === entry.id ? "bg-accent text-foreground" : "text-muted-foreground hover:text-foreground"
							}`}
						>
							{entry.label}
						</button>
					))}
				</div>
				<span className="flex-1" />
				<button
					type="button"
					onClick={onClose}
					aria-label={t("inspector.close")}
					className={`${FOCUS_RING} flex size-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground`}
				>
					<svg viewBox="0 0 24 24" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
						<path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
					</svg>
				</button>
			</header>

			<div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3">
				{tab === "design" ? (
					<div className="space-y-3">
						<BriefPlanner onPlan={onPlan} />
						<CanvasControls {...controls} />
					</div>
				) : (
					<div className="space-y-3">
						<NotesList notes={notes} onRemove={onRemoveNote} onHandToAgent={onHandToAgent} busy={busy} />
						<p className="text-[11px] leading-relaxed text-muted-foreground">{t("notes.emptyHint")}</p>
					</div>
				)}
			</div>
		</aside>
	);
}

export type { LogoSpec };

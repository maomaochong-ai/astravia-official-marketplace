import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import { IconExport, IconGenerate, IconNote, IconRaster, IconReference, IconShuffle, IconSliders } from "../../../shared/components/icons";
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
	/** True when the host reports a usable image provider (see probeImageProviders). */
	imageAvailable: boolean;
	/** Runs the raster path in-panel: the same work the agent does via the tool. */
	onGenerateImage: () => void;
	/** Present only when the selected design is an AI image: regenerate from it. */
	onGenerateFromReference?: () => void;
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
	imageAvailable,
	onGenerateFromReference,
	onGenerateImage,
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
			<div className="pointer-events-auto flex max-w-[calc(100vw-2rem)] flex-wrap items-end justify-center gap-1 rounded-2xl border border-border/80 bg-popover px-2 py-1.5 shadow-md">
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
					icon={<IconGenerate />}
				/>
				{imageAvailable ? (
					// The raster path is offered only when the host can actually run it, so the
					// button never leads to an error the user cannot act on.
					<>
						<DockSlot
							label={t("dock.image")}
							disabled={running || !canGenerate}
							onClick={onGenerateImage}
							icon={<IconRaster />}
						/>
						{onGenerateFromReference ? (
							// 「改这一张」：面板里的 image-to-image。以前只有对话里的工具能做，
							// 而用户看着画布想改的时机比在对话里多。
							<DockSlot
								label={t("dock.reference")}
								disabled={running}
								onClick={onGenerateFromReference}
								icon={<IconReference />}
							/>
						) : null}
					</>
				) : null}
				<DockSlot
					label={t("action.surprise")}
					disabled={running || !canGenerate}
					onClick={onSurprise}
					icon={<IconShuffle />}
				/>
				<span className="mx-0.5 h-5 w-px bg-border/70" aria-hidden />
				<DockSlot
					label={t("dock.inspector")}
					active={inspectorOpen && inspectorTab === "design"}
					onClick={onToggleInspector}
					icon={<IconSliders />}
				/>
				<DockSlot
					label={t("dock.notes")}
					active={inspectorOpen && inspectorTab === "notes"}
					badge={pendingNotes}
					onClick={onOpenNotes}
					icon={<IconNote />}
				/>
				<DockSlot
					label={t("dock.export")}
					onClick={onOpenKit}
					icon={<IconExport />}
				/>
			</div>
		</div>
	);
}

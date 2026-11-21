import type { JSX } from "react";
import { useTranslation } from "@astravia-org/plugin-sdk";
import type { CanvasNote } from "../../../domain/notes";
import { BUTTON_SECONDARY, FOCUS_RING, NOTE_DOT, NOTE_SOFT } from "../../../shared/styles/tokens";
import { IconCheck } from "../../../shared/components/icons";

export interface NotesListProps {
	notes: CanvasNote[];
	onRemove: (id: string) => void;
	onHandToAgent: () => void;
	/** A run is in flight; sending a second turn would interleave. */
	busy: boolean;
}

/**
 * The pending notes, as a checklist the user can review before handing over.
 *
 * The send button lives here rather than beside "Design": pinning a note and
 * asking the agent to act on it are one intention, and a hand-off button sitting
 * next to the generate button reads as a second way to *design*, which it is not.
 */
export function NotesList({ notes, onRemove, onHandToAgent, busy }: NotesListProps): JSX.Element | null {
	const { t } = useTranslation();
	const pending = notes.filter((note) => note.status === "pending");
	if (pending.length === 0) return null;

	return (
		<section className="space-y-1.5" aria-label={t("notes.listTitle")}>
			<div className="flex items-center justify-between">
				<span className="text-[11px] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
					{t("notes.listTitle", { count: pending.length })}
				</span>
				<button
					type="button"
					onClick={onHandToAgent}
					disabled={busy}
					aria-label={t("notes.handToAgent")}
					className={`${BUTTON_SECONDARY} ${FOCUS_RING} h-7 text-[11px]`}
				>
					<IconCheck className="size-3" />
					{t("notes.handToAgent")}
				</button>
			</div>
			<ul className="space-y-1">
				{pending.map((note, index) => (
					<li key={note.id} className={`flex items-start gap-1.5 rounded-lg ${NOTE_SOFT} px-2 py-1`}>
						<span className={`mt-[1px] flex size-4 shrink-0 items-center justify-center rounded-full ${NOTE_DOT} text-[9px] font-semibold text-white`}>
							{index + 1}
						</span>
						<span className="min-w-0 flex-1 break-words text-[11px] leading-snug text-foreground">{note.text}</span>
						<button
							type="button"
							onClick={() => onRemove(note.id)}
							aria-label={t("notes.remove")}
							className="shrink-0 px-0.5 text-[12px] leading-none text-muted-foreground hover:text-destructive"
						>
							×
						</button>
					</li>
				))}
			</ul>
		</section>
	);
}
